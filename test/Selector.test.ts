import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebsiteStore } from "../src/storage/db";

describe("Overlay/Popup Selector", () => {
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

  it("selecting a rabbithole sets it as active", async () => {
    const rh1 = await store.createNewActiveRabbithole("Research");
    const rh2 = await store.createNewActiveRabbithole("Work");

    // rh2 is active after creation
    expect((await store.getActiveRabbithole())?.id).toBe(rh2.id);

    // Select rh1
    await store.changeActiveRabbithole(rh1.id);

    const active = await store.getActiveRabbithole();
    expect(active?.id).toBe(rh1.id);
  });

  it("selecting a burrow sets it as active", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    const b1 = await store.createNewBurrowInActiveRabbithole("Topic A");
    const b2 = await store.createNewBurrowInActiveRabbithole("Topic B");

    // b2 is active after creation
    expect((await store.getActiveBurrow())?.id).toBe(b2.id);

    // Select b1
    await store.changeActiveBurrow(b1.id);

    const active = await store.getActiveBurrow();
    expect(active?.id).toBe(b1.id);
  });

  it("saving a website to a rabbithole adds only that website to meta and doesn't mess with anything else", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    await store.saveWebsites([
      {
        url: "https://existing.com",
        name: "Existing",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ]);
    await store.addWebsitesToRabbitholeMeta(rh.id, ["https://existing.com"]);

    // Now save a new website
    await store.saveWebsites([
      {
        url: "https://new.com",
        name: "New",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ]);
    await store.addWebsitesToRabbitholeMeta(rh.id, ["https://new.com"]);

    const updated = await store.getRabbithole(rh.id);
    expect(updated.meta).toContain("https://existing.com");
    expect(updated.meta).toContain("https://new.com");
    expect(updated.meta).toHaveLength(2);
  });

  it("saving a website to a burrow adds only that website and doesn't mess with existing websites", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    await store.saveWebsites([
      {
        url: "https://old.com",
        name: "Old",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ]);
    const burrow = await store.createNewBurrowInActiveRabbithole("Topic", [
      "https://old.com",
    ]);

    // Save new website to burrow
    await store.saveWebsites([
      {
        url: "https://new.com",
        name: "New",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ]);
    await store.saveWebsitesToBurrow([
      {
        url: "https://new.com",
        name: "New",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ]);

    const updated = await store.getBurrow(burrow.id);
    expect(updated.websites).toContain("https://old.com");
    expect(updated.websites).toContain("https://new.com");
    expect(updated.websites).toHaveLength(2);
  });

  it("creating a new rabbithole through the selector creates it and sets it as active", async () => {
    const existing = await store.createNewActiveRabbithole("Existing");

    // Create new rabbithole (simulating selector create)
    const newRh = await store.createNewActiveRabbithole("Brand New RH");

    expect(newRh.title).toBe("Brand New RH");
    expect(newRh.burrows).toHaveLength(0);
    expect(newRh.trails).toHaveLength(0);
    expect(newRh.meta).toHaveLength(0);

    // It should be active
    const active = await store.getActiveRabbithole();
    expect(active?.id).toBe(newRh.id);

    // Existing rabbithole should still exist
    const allRh = await store.getAllRabbitholes();
    expect(allRh.find((r) => r.id === existing.id)).toBeDefined();
  });

  it("creating a new burrow through the selector creates it in the selected rabbithole and sets it as active", async () => {
    const rh = await store.createNewActiveRabbithole("Research");

    const newBurrow =
      await store.createNewBurrowInActiveRabbithole("New Burrow");

    expect(newBurrow.name).toBe("New Burrow");
    expect(newBurrow.websites).toHaveLength(0);

    // It should be active
    const activeBurrow = await store.getActiveBurrow();
    expect(activeBurrow?.id).toBe(newBurrow.id);

    // It should be in the rabbithole
    const updatedRh = await store.getRabbithole(rh.id);
    expect(updatedRh.burrows).toContain(newBurrow.id);
  });
});
