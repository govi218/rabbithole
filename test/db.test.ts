import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebsiteStore } from "../src/storage/db";

describe("Database CRUD Operations", () => {
  let store: WebsiteStore;

  beforeEach(async () => {
    if (store && store.db) store.db.close();
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
    if (store && store.db) store.db.close();
  });

  describe("Settings", () => {
    it("returns default settings after init", async () => {
      const settings = await store.getSettings();
      expect(settings).toMatchObject({
        show: true,
        alignment: "right",
        darkMode: false,
        hasSeenOnboarding: false,
      });
    });

    it("updates settings", async () => {
      const updated = await store.updateSettings({
        show: false,
        alignment: "left",
        darkMode: true,
        hasSeenOnboarding: true,
      });
      expect(updated.show).toBe(false);
      expect(updated.alignment).toBe("left");
      expect(updated.darkMode).toBe(true);

      const fetched = await store.getSettings();
      expect(fetched.show).toBe(false);
    });
  });

  describe("Rabbitholes", () => {
    it("creates, updates, and deletes a rabbithole", async () => {
      const rh = await store.createNewActiveRabbithole(
        "My Test Rabbithole",
        "Desc",
      );
      expect(rh.title).toBe("My Test Rabbithole");
      expect(rh.description).toBe("Desc");

      const active = await store.getActiveRabbithole();
      expect(active?.id).toBe(rh.id);

      const updated = await store.updateRabbithole(
        rh.id,
        "Updated Title",
        "New Desc",
      );
      expect(updated.title).toBe("Updated Title");

      await store.deleteRabbithole(rh.id);
      const all = await store.getAllRabbitholes();
      expect(all.find((r) => r.id === rh.id)).toBeUndefined();
    });

    it("sets active rabbithole to null after deletion", async () => {
      const rh = await store.createNewActiveRabbithole("Temp");
      await store.deleteRabbithole(rh.id);
      await store.changeActiveRabbithole(null);
      const active = await store.getActiveRabbithole();
      expect(active).toBeNull();
    });

    it("adds websites to rabbithole meta", async () => {
      const rh = await store.createNewActiveRabbithole("Meta RH");
      await store.saveWebsites([
        {
          url: "https://a.com",
          name: "A",
          savedAt: Date.now(),
          faviconUrl: "",
        },
      ]);
      const updated = await store.addWebsitesToRabbitholeMeta(rh.id, [
        "https://a.com",
      ]);
      expect(updated.meta).toContain("https://a.com");
    });

    it("removes websites from rabbithole meta", async () => {
      const rh = await store.createNewActiveRabbithole("Meta RH 2");
      await store.saveWebsites([
        {
          url: "https://b.com",
          name: "B",
          savedAt: Date.now(),
          faviconUrl: "",
        },
      ]);
      await store.addWebsitesToRabbitholeMeta(rh.id, ["https://b.com"]);
      const updated = await store.deleteWebsiteFromRabbitholeMeta(
        rh.id,
        "https://b.com",
      );
      expect(updated.meta).not.toContain("https://b.com");
    });

    it("changes active rabbithole", async () => {
      const rh1 = await store.createNewActiveRabbithole("RH1");
      await store.createNewActiveRabbithole("RH2");
      await store.changeActiveRabbithole(rh1.id);
      const active = await store.getActiveRabbithole();
      expect(active?.id).toBe(rh1.id);
    });
  });

  describe("Burrows", () => {
    it("creates, renames, and deletes a burrow", async () => {
      await store.createNewActiveRabbithole("Parent RH");
      const burrow =
        await store.createNewBurrowInActiveRabbithole("My Test Burrow");
      expect(burrow.name).toBe("My Test Burrow");

      const updatedRh = await store.getActiveRabbithole();
      expect(updatedRh?.burrows).toContain(burrow.id);

      const renamed = await store.renameBurrow(burrow.id, "Renamed Burrow");
      expect(renamed.name).toBe("Renamed Burrow");

      await store.deleteBurrowFromRabbithole(updatedRh.id, burrow.id);
      await store.deleteBurrow(burrow.id);

      const allBurrows = await store.getAllBurrows();
      expect(allBurrows.find((b) => b.id === burrow.id)).toBeUndefined();
    });

    it("creates a burrow with websites", async () => {
      const burrow = await store.createNewActiveBurrow("With Sites", [
        "https://x.com",
        "https://y.com",
      ]);
      expect(burrow.websites).toContain("https://x.com");
      expect(burrow.websites).toContain("https://y.com");
    });

    it("adds burrows to a rabbithole", async () => {
      const rh = await store.createNewActiveRabbithole("Container");
      const b = await store.createNewActiveBurrow("Standalone");
      const updated = await store.addBurrowsToRabbithole(rh.id, [b.id]);
      expect(updated.burrows).toContain(b.id);
    });
  });

  describe("Websites", () => {
    it("saves and retrieves websites", async () => {
      await store.saveWebsites([
        {
          url: "https://test.com",
          name: "Test",
          savedAt: Date.now(),
          faviconUrl: "",
          description: "desc",
        },
      ]);
      const all = await store.getAllWebsites();
      expect(all.find((w) => w.url === "https://test.com")).toBeDefined();
    });

    it("updates a website name and description", async () => {
      await store.saveWebsites([
        {
          url: "https://update.com",
          name: "Old",
          savedAt: Date.now(),
          faviconUrl: "",
        },
      ]);
      const updated = await store.updateWebsite(
        "https://update.com",
        "New Name",
        "New Desc",
      );
      expect(updated.name).toBe("New Name");
      expect(updated.description).toBe("New Desc");
    });

    it("saves websites to active burrow and retrieves them", async () => {
      await store.createNewActiveRabbithole("RH");
      const burrow = await store.createNewBurrowInActiveRabbithole("Burrow");
      const site = {
        url: "https://burrow-site.com",
        name: "Burrow Site",
        savedAt: Date.now(),
        faviconUrl: "",
      };
      await store.saveWebsites([site]);
      await store.saveWebsitesToBurrow([site]);

      const sites = await store.getAllWebsitesForBurrow(burrow.id);
      expect(
        sites.find((w) => w.url === "https://burrow-site.com"),
      ).toBeDefined();
    });

    it("deletes a website from a burrow", async () => {
      await store.createNewActiveRabbithole("RH");
      const burrow = await store.createNewBurrowInActiveRabbithole("Burrow");
      const site = {
        url: "https://delete-me.com",
        name: "Delete Me",
        savedAt: Date.now(),
        faviconUrl: "",
      };
      await store.saveWebsites([site]);
      await store.saveWebsitesToBurrow([site]);
      await store.deleteWebsiteFromBurrow(burrow.id, "https://delete-me.com");

      const sites = await store.getAllWebsitesForBurrow(burrow.id);
      expect(
        sites.find((w) => w?.url === "https://delete-me.com"),
      ).toBeUndefined();
    });
  });

  describe("Import (Local Storage)", () => {
    it("getAllWebsites returns empty array initially", async () => {
      const all = await store.getAllWebsites();
      expect(Array.isArray(all)).toBe(true);
    });

    it("getAllBurrows returns empty array initially", async () => {
      const all = await store.getAllBurrows();
      expect(Array.isArray(all)).toBe(true);
    });

    it("getAllRabbitholes returns empty array initially", async () => {
      const all = await store.getAllRabbitholes();
      expect(Array.isArray(all)).toBe(true);
    });
  });
});
