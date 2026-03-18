import { Logger } from ".";

const DpopKeyStorageKey = "rabbithole_dpop_key";

export async function saveDpopKey(keyPair: CryptoKeyPair) {
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  await chrome.storage.local.set({
    [DpopKeyStorageKey]: { private: privateJwk, public: publicJwk },
  });
}

export async function getDpopKey(): Promise<CryptoKeyPair | null> {
  const stored = await chrome.storage.local.get(DpopKeyStorageKey);
  const keys = stored[DpopKeyStorageKey];
  if (!keys) return null;

  try {
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      keys.private,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign"],
    );
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      keys.public,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"],
    );

    return { privateKey, publicKey };
  } catch (e) {
    Logger.error("Invalid DPoP keys in storage, clearing...", e);
    await chrome.storage.local.remove(DpopKeyStorageKey);
    return null;
  }
}

export function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

export async function generateDpopKeyPair(): Promise<CryptoKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"],
  );
  return keyPair;
}

export async function exportPublicKeyJwk(
  publicKey: CryptoKey,
): Promise<JsonWebKey> {
  const { kty, crv, x, y } = await crypto.subtle.exportKey("jwk", publicKey);
  return {
    kty,
    crv,
    x,
    y,
  };
}

export async function createDpopProof(
  httpMethod: string,
  httpUri: string,
  keyPair: CryptoKeyPair,
  nonce: string | null = null,
  ath: string | null = null,
): Promise<string> {
  const publicJwk = await exportPublicKeyJwk(keyPair.publicKey);

  const header = {
    alg: "ES256",
    typ: "dpop+jwt",
    jwk: publicJwk,
  };

  const payload: any = {
    jti: generateRandomString(16),
    htm: httpMethod,
    htu: httpUri,
    iat: Math.floor(Date.now() / 1000),
  };

  if (nonce) {
    payload.nonce = nonce;
  }

  if (ath) {
    payload.ath = ath;
  }

  const encodedHeader = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header)),
  );
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  );

  // Convert signature from DER to raw format (r || s)
  const signatureArray = new Uint8Array(signature);
  const encodedSignature = base64UrlEncode(signatureArray);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}
