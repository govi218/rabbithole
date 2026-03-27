import {
  ClientMetadataUrl,
  scopes,
  resolveHandleAndPds,
  getAuthServerUrl,
  getAuthServerMetadata,
  exchangeCodeForTokens,
  createAuthenticatedFetch,
  createRecordOps,
  generateDpopKeyPair,
  generateRandomString,
  generateCodeChallenge,
  createDpopProof,
} from "@rabbithole/shared/atproto/http";
import type { ATProtoSession } from "@rabbithole/shared/types";

const SESSION_KEY = "rabbithole_session";
const DPOP_KEY = "rabbithole_dpop_key";
const PKCE_KEY = "rabbithole_pkce";

export function getSession(): ATProtoSession | null {
  try {
    const s = localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: ATProtoSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(DPOP_KEY);
  localStorage.removeItem(PKCE_KEY);
}

async function saveDpopKey(keyPair: CryptoKeyPair): Promise<void> {
  const priv = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const pub = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  localStorage.setItem(
    DPOP_KEY,
    JSON.stringify({ private: priv, public: pub })
  );
}

export async function getDpopKey(): Promise<CryptoKeyPair | null> {
  try {
    const stored = localStorage.getItem(DPOP_KEY);
    if (!stored) return null;
    const keys = JSON.parse(stored);
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      keys.private,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign"]
    );
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      keys.public,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"]
    );
    return { privateKey, publicKey };
  } catch {
    return null;
  }
}

export async function startAuthFlow(handle: string): Promise<void> {
  let h = handle.trim();
  if (h.startsWith("@")) h = h.slice(1);
  const { did, pdsUrl } = await resolveHandleAndPds(h);
  const authServerUrl = await getAuthServerUrl(pdsUrl);
  const authServer = await getAuthServerMetadata(authServerUrl);
  const keyPair = await generateDpopKeyPair();
  await saveDpopKey(keyPair);
  const codeVerifier = generateRandomString(32);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);
  const redirectUri = `${window.location.origin.replace(
    "localhost",
    "127.0.0.1"
  )}/oauth/callback`;
  // Persist PKCE state for callback
  localStorage.setItem(
    PKCE_KEY,
    JSON.stringify({
      codeVerifier,
      state,
      did,
      pdsUrl,
      tokenEndpoint: authServer.token_endpoint,
      handle: h,
    })
  );
  const authUrl = new URL(authServer.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", ClientMetadataUrl);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("login_hint", h);
  window.location.href = authUrl.toString();
}

export async function handleCallback(
  params: URLSearchParams
): Promise<ATProtoSession> {
  const code = params.get("code");
  const returnedState = params.get("state");
  const oauthError = params.get("error");
  if (oauthError)
    throw new Error(params.get("error_description") || oauthError);
  if (!code) throw new Error("No authorization code received");
  const pkce = localStorage.getItem(PKCE_KEY);
  if (!pkce) throw new Error("No PKCE state found");
  const { codeVerifier, state, did, pdsUrl, tokenEndpoint, handle } =
    JSON.parse(pkce);
  if (returnedState !== state) throw new Error("OAuth state mismatch");
  const keyPair = await getDpopKey();
  if (!keyPair) throw new Error("No DPoP key found");
  const redirectUri = `${window.location.origin.replace(
    "localhost",
    "127.0.0.1"
  )}/oauth/callback`;
  const tokenResponse = await exchangeCodeForTokens(
    code,
    codeVerifier,
    tokenEndpoint,
    keyPair,
    redirectUri,
    ClientMetadataUrl
  );
  const session: ATProtoSession = {
    did,
    handle,
    pdsUrl,
    tokenEndpoint,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
  };
  saveSession(session);
  localStorage.removeItem(PKCE_KEY);
  return session;
}

async function refreshSessionImpl(): Promise<ATProtoSession> {
  const session = getSession();
  if (!session) throw new Error("No session");
  if (!session.refreshToken) throw new Error("No refresh token");
  const keyPair = await getDpopKey();
  if (!keyPair) throw new Error("No DPoP key");
  let dpopProof = await createDpopProof("POST", session.tokenEndpoint, keyPair);
  let response = await fetch(session.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: dpopProof,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: ClientMetadataUrl,
    }),
  });
  if (response.status === 400 || response.status === 401) {
    const nonce = response.headers.get("DPoP-Nonce");
    if (nonce) {
      dpopProof = await createDpopProof(
        "POST",
        session.tokenEndpoint,
        keyPair,
        nonce
      );
      response = await fetch(session.tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          DPoP: dpopProof,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: session.refreshToken,
          client_id: ClientMetadataUrl,
        }),
      });
    }
  }
  if (!response.ok) {
    clearSession();
    throw new Error("Session expired");
  }
  const data = await response.json();
  const updated = {
    ...session,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? session.refreshToken,
  };
  saveSession(updated);
  return updated;
}

export const recordOps = createRecordOps(
  createAuthenticatedFetch(
    async () => getSession(),
    getDpopKey,
    refreshSessionImpl
  ),
  async () => getSession()
);
