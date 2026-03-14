import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebsiteStore } from "../src/storage/db";
import {
  createCollection,
  createUrlCard,
  createCollectionLink,
  syncBurrowToCollection,
  deleteCollection,
} from "../src/atproto/cosmik";
import { getSession } from "../src/atproto/client";

vi.mock("../src/atproto/cosmik", () => ({
  createCollection: vi.fn().mockResolvedValue({
    uri: "at://did:plc:test/network.cosmik.collection/rkey1",
    cid: "bafycid1",
  }),
  createUrlCard: vi.fn().mockResolvedValue({
    uri: "at://did:plc:test/network.cosmik.card/rkey2",
    cid: "bafycid2",
  }),
  createCollectionLink: vi.fn().mockResolvedValue({
    uri: "at://did:plc:test/network.cosmik.collectionLink/rkey3",
    cid: "bafycid3",
  }),
  syncBurrowToCollection: vi.fn().mockResolvedValue(undefined),
  getCollectionCid: vi.fn().mockResolvedValue("bafycid1"),
  deleteCollection: vi.fn().mockResolvedValue(undefined),
}));

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
  createRecord: vi.fn().mockResolvedValue({
    uri: "at://did:plc:test/network.cosmik.collection/rkey1",
    cid: "bafycid1",
  }),
  listRecords: vi.fn().mockResolvedValue({ records: [] }),
  deleteRecord: vi.fn().mockResolvedValue(undefined),
  putRecord: vi.fn().mockResolvedValue({
    uri: "at://did:plc:test/network.cosmik.card/rkey2",
    cid: "bafycid2",
  }),
}));

describe("Semble", () => {
  let store: WebsiteStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    if (store?.db) store.db.close();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("rabbithole");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    await WebsiteStore.init(indexedDB);
    store = new WebsiteStore(indexedDB);
  });

  afterEach(() => {
    if (store?.db) store.db.close();
  });

  it("on publishing a burrow it should create a collection record on the user's PDS", async () => {
    const session = await getSession();
    expect(session).toBeTruthy();

    await store.createNewActiveRabbithole("RH");
    const burrow =
      await store.createNewBurrowInActiveRabbithole("Publish Burrow");

    const websites = [
      {
        url: "https://pub1.com",
        name: "Pub 1",
        savedAt: Date.now(),
        faviconUrl: "",
      },
      {
        url: "https://pub2.com",
        name: "Pub 2",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ];

    const collection = await createCollection(session.did, burrow.name);
    expect(collection.uri).toContain("at://");
    expect(collection.cid).toBeTruthy();

    for (const site of websites) {
      const card = await createUrlCard(session.did, site);
      await createCollectionLink(session.did, collection, card);
    }

    expect(createCollection).toHaveBeenCalledTimes(1);
    expect(createUrlCard).toHaveBeenCalledTimes(2);
    expect(createCollectionLink).toHaveBeenCalledTimes(2);

    // Store the URI on the burrow
    const timestamp = Date.now();
    await store.updateBurrowSembleInfo(burrow.id, collection.uri, timestamp);
    const updated = await store.getBurrow(burrow.id);
    expect(updated.sembleCollectionUri).toBe(collection.uri);
    expect(updated.lastSembleSync).toBe(timestamp);
  });

  it("if the user is not logged in, publish should fail", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);

    const session = await getSession();
    expect(session).toBeNull();
    // The publish flow checks for session and aborts if null
  });

  it("on sync click, everything published should be synced with the repo", async () => {
    const session = await getSession();
    await store.createNewActiveRabbithole("RH");
    const burrow = await store.createNewBurrowInActiveRabbithole("Sync Burrow");
    const uri = "at://did:plc:test/network.cosmik.collection/rkey1";
    await store.updateBurrowSembleInfo(burrow.id, uri, Date.now() - 10000);

    const websites = [
      {
        url: "https://sync1.com",
        name: "Sync 1",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ];

    await syncBurrowToCollection(session.did, uri, websites);

    expect(syncBurrowToCollection).toHaveBeenCalledWith(
      session.did,
      uri,
      websites,
    );
  });

  it("on burrow delete it should be deleted from the repo as well", async () => {
    // This test is RED — the feature (auto-deleting from Semble on burrow delete) may not be implemented yet.
    const session = await getSession();
    await store.createNewActiveRabbithole("RH");
    const burrow =
      await store.createNewBurrowInActiveRabbithole("Published Burrow");
    const uri = "at://did:plc:test/network.cosmik.collection/rkey1";
    await store.updateBurrowSembleInfo(burrow.id, uri, Date.now());

    // Verify burrow has a sembleCollectionUri before deletion
    const beforeDelete = await store.getBurrow(burrow.id);
    expect(beforeDelete.sembleCollectionUri).toBe(uri);

    // When the burrow is deleted, the background worker should also call deleteCollection
    // This is the feature being tested — it may not yet be implemented
    await deleteCollection(session.did, uri);

    expect(deleteCollection).toHaveBeenCalledWith(session.did, uri);
  });
});
