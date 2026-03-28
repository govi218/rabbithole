import {
  resolveHandleAndPds,
  getAuthServerUrl,
  getAuthServerMetadata,
  exchangeCodeForTokens,
  createAuthenticatedFetch,
  createRecordOps,
  ClientMetadataUrl,
  scopes,
  generateDpopKeyPair,
  generateRandomString,
  generateCodeChallenge,
  createDpopProof,
} from "@rabbithole/shared/atproto/http";
import { getDpopKey, saveDpopKey } from "src/utils/crypto";
import { Logger } from "../utils";
import type { ATProtoSession } from "@rabbithole/shared/types";

const SessionStorageKey = "rabbithole_atproto_session";
const DpopKeyStorageKey = "rabbithole_dpop_key";

export { ClientMetadataUrl };

export async function getSession(): Promise<ATProtoSession | null> {
  const result = await chrome.storage.local.get(SessionStorageKey);
  return result[SessionStorageKey] || null;
}

export async function saveSession(session: ATProtoSession): Promise<void> {
  await chrome.storage.local.set({ [SessionStorageKey]: session });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove([SessionStorageKey, DpopKeyStorageKey]);
}

export function getRedirectUri(): string {
  return chrome.identity.getRedirectURL("callback");
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

  // Get the Authorization Server URL (may be delegated from PDS)
  const authServerUrl = await getAuthServerUrl(pdsUrl);
  const authServer = await getAuthServerMetadata(authServerUrl);

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

// Create authenticated fetch using extension storage
const authenticatedFetch = createAuthenticatedFetch(
  getSession,
  getDpopKey,
  refreshAccessToken,
);

// Export record operations
export const recordOps = createRecordOps(authenticatedFetch, getSession);

// Convenience exports for backward compatibility
export const createRecord = recordOps.createRecord;
export const listRecords = recordOps.listRecords;
export const deleteRecord = recordOps.deleteRecord;
export const putRecord = recordOps.putRecord;
