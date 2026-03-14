import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSession, startAuthFlow } from "../src/atproto/client";

vi.mock("../src/atproto/client", () => ({
  getSession: vi.fn().mockResolvedValue({
    did: "did:plc:testuser",
    handle: "testuser.bsky.social",
    pdsUrl: "https://bsky.social",
    accessToken: "mock-access-token",
    tokenEndpoint: "https://bsky.social/xrpc/com.atproto.server.createSession",
  }),
  saveSession: vi.fn().mockResolvedValue(undefined),
  clearSession: vi.fn().mockResolvedValue(undefined),
  startAuthFlow: vi.fn().mockResolvedValue({
    did: "did:plc:testuser",
    handle: "testuser.bsky.social",
    pdsUrl: "https://bsky.social",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    tokenEndpoint: "https://bsky.social/xrpc/com.atproto.server.createSession",
  }),
}));

vi.mock("src/utils/crypto", () => ({
  getDpopKey: vi
    .fn()
    .mockResolvedValue({ publicKey: "mock", privateKey: "mock" }),
}));

describe("Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("session creation succeeds and returns did and handle", async () => {
    const session = await getSession();

    expect(session).toBeTruthy();
    expect(session.did).toBe("did:plc:testuser");
    expect(session.handle).toBe("testuser.bsky.social");
  });

  it("returns null when no session exists", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);

    const session = await getSession();
    expect(session).toBeNull();
  });

  it("startAuthFlow returns a valid session with tokens", async () => {
    const result = await startAuthFlow("testuser.bsky.social");

    expect(result.did).toBe("did:plc:testuser");
    expect(result.handle).toBe("testuser.bsky.social");
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });
});
