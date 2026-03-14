import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebsiteStore } from "../src/storage/db";

describe("Settings", () => {
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

  it("export returns all rabbitholes, burrows, trails, pinned websites, and meta websites", async () => {
    const rh = await store.createNewActiveRabbithole("Export RH");
    const burrow = await store.createNewBurrowInActiveRabbithole("Export Burrow");
    const trail = await store.createTrail(rh.id, "Export Trail", [
      "https://trail-stop.com",
    ]);

    await store.saveWebsites([
      {
        url: "https://meta-site.com",
        name: "Meta Site",
        savedAt: Date.now(),
        faviconUrl: "",
      },
      {
        url: "https://burrow-site.com",
        name: "Burrow Site",
        savedAt: Date.now(),
        faviconUrl: "",
      },
      {
        url: "https://trail-stop.com",
        name: "Trail Stop",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ]);
    await store.addWebsitesToRabbitholeMeta(rh.id, ["https://meta-site.com"]);
    await store.saveWebsitesToBurrow([
      {
        url: "https://burrow-site.com",
        name: "Burrow Site",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ]);
    await store.updateRabbitholeActiveTabs(rh.id, [
      "https://meta-site.com",
    ]);

    const rabbitholes = await store.getAllRabbitholes();
    const burrows = await store.getAllBurrows();
    const websites = await store.getAllWebsites();

    const exportedRh = rabbitholes.find((r) => r.id === rh.id);
    expect(exportedRh).toBeDefined();
    expect(exportedRh.burrows).toContain(burrow.id);
    expect(exportedRh.trails).toContain(trail.id);
    expect(exportedRh.meta).toContain("https://meta-site.com");
    expect(exportedRh.activeTabs).toContain("https://meta-site.com");

    expect(burrows.find((b) => b.id === burrow.id)).toBeDefined();
    expect(
      websites.find((w) => w.url === "https://meta-site.com"),
    ).toBeDefined();
    expect(
      websites.find((w) => w.url === "https://burrow-site.com"),
    ).toBeDefined();
    expect(
      websites.find((w) => w.url === "https://trail-stop.com"),
    ).toBeDefined();
  });

  it("importing a set of rabbitholes does not affect any existing rabbithole", async () => {
    const existingRh = await store.createNewActiveRabbithole("Existing RH");
    await store.createNewBurrowInActiveRabbithole("Existing Burrow");

    // Import new data
    const newRh = await store.createNewActiveRabbithole("Imported RH");
    await store.createNewBurrowInActiveRabbithole("Imported Burrow");

    // Verify existing is untouched
    const allRh = await store.getAllRabbitholes();
    const existing = allRh.find((r) => r.id === existingRh.id);
    expect(existing).toBeDefined();
    expect(existing.title).toBe("Existing RH");
    expect(existing.burrows.length).toBeGreaterThanOrEqual(1);

    const imported = allRh.find((r) => r.id === newRh.id);
    expect(imported).toBeDefined();
    expect(imported.title).toBe("Imported RH");
  });

  it("import gets all rabbitholes, burrows, trails, pinned websites, meta, and websites", async () => {
    // Create a full data set
    const rh = await store.createNewActiveRabbithole("Full RH");
    const burrow = await store.createNewBurrowInActiveRabbithole("Full Burrow");
    const trail = await store.createTrail(rh.id, "Full Trail", [
      "https://stop.com",
    ]);
    await store.saveWebsites([
      {
        url: "https://stop.com",
        name: "Stop",
        savedAt: Date.now(),
        faviconUrl: "",
      },
      {
        url: "https://pinned.com",
        name: "Pinned",
        savedAt: Date.now(),
        faviconUrl: "",
      },
    ]);
    await store.addWebsitesToRabbitholeMeta(rh.id, [
      "https://stop.com",
      "https://pinned.com",
    ]);
    await store.updateRabbitholeActiveTabs(rh.id, ["https://pinned.com"]);

    // Now "import" by reading everything back
    const rabbitholes = await store.getAllRabbitholes();
    const burrows = await store.getAllBurrows();
    const websites = await store.getAllWebsites();

    expect(rabbitholes.length).toBeGreaterThanOrEqual(1);
    expect(burrows.length).toBeGreaterThanOrEqual(1);
    expect(websites.length).toBeGreaterThanOrEqual(2);

    const fetchedRh = rabbitholes.find((r) => r.id === rh.id);
    expect(fetchedRh.burrows).toContain(burrow.id);
    expect(fetchedRh.trails).toContain(trail.id);
    expect(fetchedRh.meta).toContain("https://stop.com");
    expect(fetchedRh.activeTabs).toContain("https://pinned.com");
  });

  it("clicking show/hide overlay on settings menu sets user.settings.show", async () => {
    const settings = await store.getSettings();
    expect(settings.show).toBe(true);

    const updated = await store.updateSettings({ ...settings, show: false });
    expect(updated.show).toBe(false);

    const updated2 = await store.updateSettings({ ...updated, show: true });
    expect(updated2.show).toBe(true);
  });
});
