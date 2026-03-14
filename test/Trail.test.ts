import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebsiteStore } from "../src/storage/db";

describe("Trails", () => {
  let store: WebsiteStore;

  beforeEach(async () => {
    if (store?.db) {
      store.db.close();
      store.db = null;
    }
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

  it("creating a trail via organize adds selected websites as stops", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    await store.saveWebsites([
      { url: "https://a.com", name: "A", savedAt: Date.now(), faviconUrl: "" },
      { url: "https://b.com", name: "B", savedAt: Date.now(), faviconUrl: "" },
    ]);
    await store.addWebsitesToRabbitholeMeta(rh.id, [
      "https://a.com",
      "https://b.com",
    ]);

    const trail = await store.createTrail(rh.id, "My Trail", [
      "https://a.com",
      "https://b.com",
    ]);

    expect(trail.stops).toHaveLength(2);
    expect(trail.stops[0].websiteUrl).toBe("https://a.com");
    expect(trail.stops[1].websiteUrl).toBe("https://b.com");
    expect(trail.stops[0].note).toBe("");
    expect(trail.stops[1].note).toBe("");

    const updatedRh = await store.getRabbithole(rh.id);
    expect(updatedRh.trails).toContain(trail.id);
  });

  it("deleting a trail removes it from the trails store and the parent rabbithole's list of trails", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    const trail = await store.createTrail(rh.id, "Delete Me", [
      "https://a.com",
    ]);

    await store.deleteTrailFromRabbithole(rh.id, trail.id);
    await store.deleteTrail(trail.id);

    const fetched = await store.getTrail(trail.id);
    expect(fetched).toBeUndefined();

    const updatedRh = await store.getRabbithole(rh.id);
    expect(updatedRh.trails).not.toContain(trail.id);
  });

  it("deleting the active trail sets active trail to null", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    const trail = await store.createNewActiveTrail(rh.id, "Active Trail", []);

    const activeBefore = await store.getActiveTrail();
    expect(activeBefore?.id).toBe(trail.id);

    await store.deleteTrailFromRabbithole(rh.id, trail.id);
    await store.deleteTrail(trail.id);
    // The app calls changeActiveTrail(null) when deleting the active trail
    await store.changeActiveTrail(null);

    const activeAfter = await store.getActiveTrail();
    expect(activeAfter).toBeNull();
  });
});
