import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebsiteStore } from "../src/storage/db";

describe("Burrows", () => {
  let store: WebsiteStore;

  beforeEach(async () => {
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

  it("creating a burrow via organize adds selected websites to the burrow", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    await store.saveWebsites([
      { url: "https://a.com", name: "A", savedAt: Date.now(), faviconUrl: "" },
      { url: "https://b.com", name: "B", savedAt: Date.now(), faviconUrl: "" },
    ]);
    await store.addWebsitesToRabbitholeMeta(rh.id, [
      "https://a.com",
      "https://b.com",
    ]);

    const burrow = await store.createNewBurrowInActiveRabbithole("My Burrow", [
      "https://a.com",
      "https://b.com",
    ]);

    expect(burrow.websites).toContain("https://a.com");
    expect(burrow.websites).toContain("https://b.com");

    const updatedRh = await store.getRabbithole(rh.id);
    expect(updatedRh.burrows).toContain(burrow.id);
  });

  it("creating an empty burrow should be possible", async () => {
    await store.createNewActiveRabbithole("Research");
    const burrow =
      await store.createNewBurrowInActiveRabbithole("Empty Burrow");

    expect(burrow.id).toBeDefined();
    expect(burrow.name).toBe("Empty Burrow");
    expect(burrow.websites).toHaveLength(0);
  });

  it("creating an empty burrow and then syncing adds websites to burrow and parent rabbithole meta", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    const burrow =
      await store.createNewBurrowInActiveRabbithole("Empty Burrow");

    // Simulate syncing: save websites, add to burrow, add to rabbithole meta
    const sites = [
      {
        url: "https://synced1.com",
        name: "Synced 1",
        savedAt: Date.now(),
        faviconUrl: "",
      },
      {
        url: "https://synced2.com",
        name: "Synced 2",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ];
    await store.saveWebsites(sites);
    await store.saveWebsitesToBurrow(sites);
    await store.addWebsitesToRabbitholeMeta(rh.id, [
      "https://synced1.com",
      "https://synced2.com",
    ]);

    const updatedBurrow = await store.getBurrow(burrow.id);
    expect(updatedBurrow.websites).toContain("https://synced1.com");
    expect(updatedBurrow.websites).toContain("https://synced2.com");

    const updatedRh = await store.getRabbithole(rh.id);
    expect(updatedRh.meta).toContain("https://synced1.com");
    expect(updatedRh.meta).toContain("https://synced2.com");
  });

  it("syncing a window to an existing burrow keeps old websites and adds new ones, all in parent rabbithole meta", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    await store.saveWebsites([
      {
        url: "https://old.com",
        name: "Old",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ]);
    const burrow = await store.createNewBurrowInActiveRabbithole("Burrow", [
      "https://old.com",
    ]);
    await store.addWebsitesToRabbitholeMeta(rh.id, ["https://old.com"]);

    // Sync new websites
    const newSites = [
      {
        url: "https://new1.com",
        name: "New 1",
        savedAt: Date.now(),
        faviconUrl: "",
      },
      {
        url: "https://new2.com",
        name: "New 2",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ];
    await store.saveWebsites(newSites);
    await store.saveWebsitesToBurrow(newSites);
    await store.addWebsitesToRabbitholeMeta(rh.id, [
      "https://new1.com",
      "https://new2.com",
    ]);

    const updatedBurrow = await store.getBurrow(burrow.id);
    expect(updatedBurrow.websites).toContain("https://old.com");
    expect(updatedBurrow.websites).toContain("https://new1.com");
    expect(updatedBurrow.websites).toContain("https://new2.com");

    const updatedRh = await store.getRabbithole(rh.id);
    expect(updatedRh.meta).toContain("https://old.com");
    expect(updatedRh.meta).toContain("https://new1.com");
    expect(updatedRh.meta).toContain("https://new2.com");
  });

  it("deleting a burrow removes it from the burrows store and the parent rabbithole's list of burrows", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    const burrow = await store.createNewBurrowInActiveRabbithole("Delete Me");

    await store.deleteBurrowFromRabbithole(rh.id, burrow.id);
    await store.deleteBurrow(burrow.id);

    const allBurrows = await store.getAllBurrows();
    expect(allBurrows.find((b) => b.id === burrow.id)).toBeUndefined();

    const updatedRh = await store.getRabbithole(rh.id);
    expect(updatedRh.burrows).not.toContain(burrow.id);
  });

  it("deleting the active burrow sets active burrow to null", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    const burrow =
      await store.createNewBurrowInActiveRabbithole("Active Burrow");

    // Verify it's active
    const activeBefore = await store.getActiveBurrow();
    expect(activeBefore?.id).toBe(burrow.id);

    await store.deleteBurrowFromRabbithole(rh.id, burrow.id);
    await store.deleteBurrow(burrow.id);

    // Active burrow should now be null (or the last created one is gone)
    const activeAfter = await store.getActiveBurrow();
    // The burrow no longer exists, so getActiveBurrow should return null or undefined
    expect(activeAfter === null || activeAfter === undefined).toBe(true);
  });
});
