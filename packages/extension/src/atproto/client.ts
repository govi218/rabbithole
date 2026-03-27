import { Agent } from "@atproto/api";
import {
  base64UrlEncode,
  createDpopProof,
  generateCodeChallenge,
  generateDpopKeyPair,
  generateRandomString,
  getDpopKey,
  saveDpopKey,
} from "src/utils/crypto";
import { Logger } from "../utils";

export const ClientMetadataUrl =
  "https://rabbithole.land/oauth/client-metadata.json";
const SessionStorageKey = "rabbithole_atproto_session";
const DpopKeyStorageKey = "rabbithole_dpop_key";
const scopes =
  "atproto repo:network.cosmik.collection repo:network.cosmik.card repo:network.cosmik.collectionLink repo:app.sidetrail.trail repo:app.sidetrail.walk repo:app.sidetrail.completion";

export interface ATProtoSession {
  did: string;
  handle: string;
  pdsUrl: string;
  accessToken: string;
  tokenEndpoint: string;
  refreshToken?: string;
}

export async function getSession() {
  const result = await chrome.storage.local.get(SessionStorageKey);
  return result[SessionStorageKey];
}

export async function saveSession(session: any) {
  await chrome.storage.local.set({ [SessionStorageKey]: session });
}

export async function clearSession() {
  await chrome.storage.local.remove([SessionStorageKey, DpopKeyStorageKey]);
}

export function getRedirectUri(): string {
  return chrome.identity.getRedirectURL("callback");
}

export async function resolveHandleAndPds(
  handle: string,
): Promise<{ did: string; pdsUrl: string }> {
  const agent = new Agent("https://bsky.social");
  const resolved = await agent.resolveHandle({ handle });

  if (!resolved.success) {
    throw new Error("Failed to resolve handle");
  }

  const did = resolved.data.did;

  let pdsUrl = "https://bsky.social";
  try {
    const plcResponse = await fetch(`https://plc.directory/${did}`);
    if (plcResponse.ok) {
      const didDoc = await plcResponse.json();
      const pdsService = didDoc.service?.find(
        (s: any) =>
          s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer",
      );
      if (pdsService) {
        pdsUrl = pdsService.serviceEndpoint;
      }
    }
  } catch (err) {
    Logger.warn("Failed to resolve PDS, using default:", err);
  }

  return { did, pdsUrl };
}

export async function getAuthServerMetadata(pdsUrl: string): Promise<any> {
  const response = await fetch(
    `${pdsUrl}/.well-known/oauth-authorization-server`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch authorization server metadata");
  }
  return await response.json();
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  tokenEndpoint: string,
  keyPair: CryptoKeyPair,
  redirectUri: string,
  clientId: string,
): Promise<any> {
  // First attempt without nonce
  let dpopProof = await createDpopProof("POST", tokenEndpoint, keyPair);

  let response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: dpopProof,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  });

  // If we get a use_dpop_nonce error, retry with the nonce
  if (response.status === 400 || response.status === 401) {
    const dpopNonce = response.headers.get("DPoP-Nonce");
    if (dpopNonce) {
      dpopProof = await createDpopProof(
        "POST",
        tokenEndpoint,
        keyPair,
        dpopNonce,
      );

      response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          DPoP: dpopProof,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: codeVerifier,
        }),
      });
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    Logger.error("Token exchange failed:", {
      status: response.status,
      errText,
    });
    throw new Error("Failed to exchange code for tokens");
  }

  return await response.json();
}

export async function refreshAccessToken(): Promise<ATProtoSession> {
  const session = await getSession();
  if (!session) throw new Error("No session found");
  if (!session.refreshToken) throw new Error("No refresh token available");

  const keyPair = await getDpopKey();
  if (!keyPair) throw new Error("No DPoP key found");

  const tokenEndpoint = session.tokenEndpoint;

  let dpopProof = await createDpopProof("POST", tokenEndpoint, keyPair);

  let response = await fetch(tokenEndpoint, {
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

  // Handle DPoP nonce requirement on refresh
  if (response.status === 400 || response.status === 401) {
    const dpopNonce = response.headers.get("DPoP-Nonce");
    if (dpopNonce) {
      dpopProof = await createDpopProof(
        "POST",
        tokenEndpoint,
        keyPair,
        dpopNonce,
      );

      response = await fetch(tokenEndpoint, {
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
    const errText = await response.text();
    Logger.error("Token refresh failed:", { status: response.status, errText });
    // Refresh token is invalid/expired — clear session so user must re-auth
    await clearSession();
    throw new Error("Session expired, please sign in again");
  }

  const tokenData = await response.json();

  const updatedSession: ATProtoSession = {
    ...session,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? session.refreshToken,
  };

  await saveSession(updatedSession);
  return updatedSession;
}

export async function startAuthFlow(
  handleInput: string,
): Promise<ATProtoSession> {
  let handle = handleInput.trim();
  if (!handle) {
    throw new Error("Please enter your handle");
  }

  if (!handle.includes(".")) {
    handle = `${handle}.bsky.social`;
  }

  const { did, pdsUrl } = await resolveHandleAndPds(handle);
  const authServer = await getAuthServerMetadata(pdsUrl);

  const keyPair = await generateDpopKeyPair();
  await saveDpopKey(keyPair);

  const codeVerifier = generateRandomString(32);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);

  const redirectUri = getRedirectUri();

  const authUrl = new URL(authServer.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", ClientMetadataUrl);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("login_hint", handle);

  const callbackUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!callbackUrl) {
    throw new Error("Authentication was cancelled");
  }

  const url = new URL(callbackUrl);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (oauthError) {
    throw new Error(errorDescription || oauthError);
  }

  if (returnedState !== state) {
    throw new Error("OAuth state mismatch");
  }

  if (!code) {
    throw new Error("No authorization code received");
  }

  const tokenResponse = await exchangeCodeForTokens(
    code,
    codeVerifier,
    authServer.token_endpoint,
    keyPair,
    redirectUri,
    ClientMetadataUrl,
  );

  return {
    did,
    handle,
    pdsUrl,
    tokenEndpoint: authServer.token_endpoint,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
  };
}

/* Record operations */

async function authenticatedFetch(
  url: string,
  method: string,
  body: any = null,
  isRetryAfterRefresh = false,
) {
  const session = await getSession();
  if (!session) throw new Error("No session found");

  const keyPair = await getDpopKey();
  if (!keyPair) throw new Error("No DPoP key found");

  const accessTokenHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(session.accessToken),
  );
  const ath = base64UrlEncode(new Uint8Array(accessTokenHash));

  let proof = await createDpopProof(method, url, keyPair, null, ath);

  const headers: any = {
    Authorization: `DPoP ${session.accessToken}`,
    DPoP: proof,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  let response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle DPoP nonce requirement
  if (response.status === 401) {
    const nonce = response.headers.get("DPoP-Nonce");
    if (nonce) {
      proof = await createDpopProof(method, url, keyPair, nonce, ath);
      headers["DPoP"] = proof;
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    // If still 401 and we haven't already retried after a refresh, try refreshing the token
    if (response.status === 401 && !isRetryAfterRefresh) {
      Logger.warn("Access token likely expired, attempting refresh...");
      try {
        await refreshAccessToken();
      } catch (err) {
        Logger.error("Token refresh failed during authenticated fetch:", err);
        throw err;
      }
      // Retry the original request once with the new token
      return authenticatedFetch(url, method, body, true);
    }
  }

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${await response.text()}`,
    );
  }

  return response.json();
}

export async function createRecord(
  repo: string,
  collection: string,
  record: any,
): Promise<{ uri: string; cid: string }> {
  const session = await getSession();
  if (!session) {
    throw new Error("No session found");
  }

  const pdsUrl = session.pdsUrl || new URL(session.tokenEndpoint).origin;
  const url = `${pdsUrl}/xrpc/com.atproto.repo.createRecord`;

  const body = {
    repo,
    collection,
    record,
  };

  return authenticatedFetch(url, "POST", body);
}

export async function listRecords(
  repo: string,
  collection: string,
): Promise<{
  records: { uri: string; cid: string; value: any }[];
  cursor?: string;
}> {
  const session = await getSession();
  if (!session) throw new Error("No session found");

  const pdsUrl = session.pdsUrl || new URL(session.tokenEndpoint).origin;
  const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set("repo", repo);
  url.searchParams.set("collection", collection);
  url.searchParams.set("limit", "100");

  return authenticatedFetch(url.toString(), "GET");
}

export async function deleteRecord(
  repo: string,
  collection: string,
  rkey: string,
): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("No session found");

  const pdsUrl = session.pdsUrl || new URL(session.tokenEndpoint).origin;
  const url = `${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`;

  await authenticatedFetch(url, "POST", { repo, collection, rkey });
}

export async function putRecord(
  repo: string,
  collection: string,
  rkey: string,
  record: any,
  swapRecord?: string,
): Promise<{ uri: string; cid: string }> {
  const session = await getSession();
  if (!session) throw new Error("No session found");

  const pdsUrl = session.pdsUrl || new URL(session.tokenEndpoint).origin;
  const url = `${pdsUrl}/xrpc/com.atproto.repo.putRecord`;

  return authenticatedFetch(url, "POST", {
    repo,
    collection,
    rkey,
    record,
    swapRecord,
  });
}
