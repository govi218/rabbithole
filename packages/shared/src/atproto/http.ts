import {
  base64UrlEncode,
  createDpopProof,
  generateDpopKeyPair,
  generateRandomString,
  generateCodeChallenge,
} from "../utils/crypto";
import type { ATProtoSession } from "../utils/types";

export const ClientMetadataUrl = "https://rabbithole.to/oauth/client-metadata.json";
export const scopes =
  "atproto repo:network.cosmik.collection repo:network.cosmik.card repo:network.cosmik.collectionLink repo:app.sidetrail.trail repo:app.sidetrail.walk repo:app.sidetrail.completion";

export { generateDpopKeyPair, generateRandomString, generateCodeChallenge, base64UrlEncode, createDpopProof };

export async function resolveHandleAndPds(
  handle: string,
): Promise<{ did: string; pdsUrl: string }> {
  const { Agent } = await import("@atproto/api");
  const agent = new Agent("https://bsky.social");
  const resolved = await agent.resolveHandle({ handle });
  if (!resolved.success) throw new Error("Failed to resolve handle");
  const did = resolved.data.did;
  let pdsUrl = "https://bsky.social";
  try {
    const plcResponse = await fetch(`https://plc.directory/${did}`);
    if (plcResponse.ok) {
      const didDoc = await plcResponse.json();
      const pdsService = didDoc.service?.find(
        (s: any) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer",
      );
      if (pdsService) pdsUrl = pdsService.serviceEndpoint;
    }
  } catch {}
  return { did, pdsUrl };
}

export async function getAuthServerMetadata(pdsUrl: string): Promise<any> {
  const response = await fetch(`${pdsUrl}/.well-known/oauth-authorization-server`);
  if (!response.ok) throw new Error("Failed to fetch authorization server metadata");
  return response.json();
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  tokenEndpoint: string,
  keyPair: CryptoKeyPair,
  redirectUri: string,
  clientId: string,
): Promise<any> {
  let dpopProof = await createDpopProof("POST", tokenEndpoint, keyPair);
  let response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", DPoP: dpopProof },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier }),
  });
  if (response.status === 400 || response.status === 401) {
    const dpopNonce = response.headers.get("DPoP-Nonce");
    if (dpopNonce) {
      dpopProof = await createDpopProof("POST", tokenEndpoint, keyPair, dpopNonce);
      response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", DPoP: dpopProof },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier }),
      });
    }
  }
  if (!response.ok) throw new Error("Failed to exchange code for tokens");
  return response.json();
}

// Returns an authenticated fetch function bound to the given session + key provider
export function createAuthenticatedFetch(
  getSession: () => Promise<ATProtoSession | null>,
  getKeyPair: () => Promise<CryptoKeyPair | null>,
  refreshSession: () => Promise<ATProtoSession>,
) {
  async function authenticatedFetch(
    url: string,
    method: string,
    body: any = null,
    isRetryAfterRefresh = false,
  ): Promise<any> {
    const session = await getSession();
    if (!session) throw new Error("No session found");
    const keyPair = await getKeyPair();
    if (!keyPair) throw new Error("No DPoP key found");
    const accessTokenHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(session.accessToken));
    const ath = base64UrlEncode(new Uint8Array(accessTokenHash));
    let proof = await createDpopProof(method, url, keyPair, null, ath);
    const headers: any = { Authorization: `DPoP ${session.accessToken}`, DPoP: proof };
    if (body) headers["Content-Type"] = "application/json";
    let response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (response.status === 401) {
      const nonce = response.headers.get("DPoP-Nonce");
      if (nonce) {
        proof = await createDpopProof(method, url, keyPair, nonce, ath);
        headers["DPoP"] = proof;
        response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      }
      if (response.status === 401 && !isRetryAfterRefresh) {
        await refreshSession();
        return authenticatedFetch(url, method, body, true);
      }
    }
    if (!response.ok) throw new Error(`Request failed: ${response.status} ${await response.text()}`);
    return response.json();
  }
  return authenticatedFetch;
}

// Standalone record operations that accept an authenticatedFetch function
export function createRecordOps(
  authenticatedFetch: ReturnType<typeof createAuthenticatedFetch>,
  getSession: () => Promise<ATProtoSession | null>,
) {
  async function getPdsUrl(): Promise<string> {
    const session = await getSession();
    if (!session) throw new Error("No session");
    return session.pdsUrl || new URL(session.tokenEndpoint).origin;
  }

  return {
    async createRecord(repo: string, collection: string, record: any): Promise<{ uri: string; cid: string }> {
      const pdsUrl = await getPdsUrl();
      return authenticatedFetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, "POST", { repo, collection, record });
    },
    async listRecords(repo: string, collection: string): Promise<{ records: { uri: string; cid: string; value: any }[] }> {
      const pdsUrl = await getPdsUrl();
      const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
      url.searchParams.set("repo", repo);
      url.searchParams.set("collection", collection);
      url.searchParams.set("limit", "100");
      return authenticatedFetch(url.toString(), "GET");
    },
    async deleteRecord(repo: string, collection: string, rkey: string): Promise<void> {
      const pdsUrl = await getPdsUrl();
      await authenticatedFetch(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, "POST", { repo, collection, rkey });
    },
    async putRecord(repo: string, collection: string, rkey: string, record: any, swapRecord?: string): Promise<{ uri: string; cid: string }> {
      const pdsUrl = await getPdsUrl();
      return authenticatedFetch(`${pdsUrl}/xrpc/com.atproto.repo.putRecord`, "POST", { repo, collection, rkey, record, swapRecord });
    },
  };
}
