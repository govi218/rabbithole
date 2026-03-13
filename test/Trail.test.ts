import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebsiteStore } from "../src/storage/db";

describe("Trail DB Operations", () => {
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

  describe("createTrail", () => {
    it("creates a trail with stops from website URLs", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "My Trail", [
        "https://a.com",
        "https://b.com",
      ]);

      expect(trail.id).toBeDefined();
      expect(trail.name).toBe("My Trail");
      expect(trail.rabbitholeId).toBe(rh.id);
      expect(trail.stops).toHaveLength(2);
      expect(trail.stops[0].websiteUrl).toBe("https://a.com");
      expect(trail.stops[1].websiteUrl).toBe("https://b.com");
      expect(trail.startNote).toBe("");
    });

    it("initializes all stop notes as empty strings", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Trail", [
        "https://x.com",
        "https://y.com",
        "https://z.com",
      ]);

      trail.stops.forEach((stop) => {
        expect(stop.note).toBe("");
      });
    });

    it("adds trail ID to the parent rabbithole's trails array", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Trail", []);

      const updatedRh = await store.getAllRabbitholes();
      const found = updatedRh.find((r) => r.id === rh.id);
      expect(found?.trails).toContain(trail.id);
    });

    it("sets the trail as the active trail", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createNewActiveTrail(rh.id, "Active Trail", []);

      const activeTrail = await store.getActiveTrail();
      expect(activeTrail?.id).toBe(trail.id);
    });


    it("creates a trail with zero stops", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Empty Trail", []);

      expect(trail.stops).toHaveLength(0);
    });
  });

  describe("getTrail", () => {
    it("retrieves a trail by ID", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const created = await store.createTrail(rh.id, "Get Me", [
        "https://a.com",
      ]);

      const fetched = await store.getTrail(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.name).toBe("Get Me");
    });

    it("returns undefined for non-existent trail ID", async () => {
      const result = await store.getTrail("nonexistent-id");
      expect(result).toBeUndefined();
    });
  });

  describe("getActiveTrail", () => {
    it("returns null when no active trail", async () => {
      await store.changeActiveTrail(null);
      const active = await store.getActiveTrail();
      expect(active).toBeNull();
    });

    it("returns the active trail after creation", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createNewActiveTrail(rh.id, "Active", []);

      const active = await store.getActiveTrail();
      expect(active?.id).toBe(trail.id);
    });

    it("returns null after changeActiveTrail(null)", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      await store.createTrail(rh.id, "Trail", []);
      await store.changeActiveTrail(null);

      const active = await store.getActiveTrail();
      expect(active).toBeNull();
    });
  });

  describe("changeActiveTrail", () => {
    it("sets a trail as active", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const t1 = await store.createTrail(rh.id, "T1", []);
      const t2 = await store.createTrail(rh.id, "T2", []);

      await store.changeActiveTrail(t1.id);
      const active = await store.getActiveTrail();
      expect(active?.id).toBe(t1.id);
    });


    it("sets active trail to null", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      await store.createTrail(rh.id, "Trail", []);
      await store.changeActiveTrail(null);

      const active = await store.getActiveTrail();
      expect(active).toBeNull();
    });
  });

  describe("updateTrail", () => {
    it("updates the trail name", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Old Name", []);

      const updated = await store.updateTrail(trail.id, { name: "New Name" });
      expect(updated.name).toBe("New Name");

      const fetched = await store.getTrail(trail.id);
      expect(fetched.name).toBe("New Name");
    });

    it("updates the startNote", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Trail", []);

      const updated = await store.updateTrail(trail.id, {
        startNote: "Begin here",
      });
      expect(updated.startNote).toBe("Begin here");
    });

    it("updates stop notes", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Trail", [
        "https://a.com",
        "https://b.com",
      ]);

      const newStops = [
        { websiteUrl: "https://a.com", note: "Look for X" },
        { websiteUrl: "https://b.com", note: "Look for Y" },
      ];

      const updated = await store.updateTrail(trail.id, { stops: newStops });
      expect(updated.stops[0].note).toBe("Look for X");
      expect(updated.stops[1].note).toBe("Look for Y");
    });

    it("updates both startNote and stops together", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Trail", ["https://a.com"]);

      const updated = await store.updateTrail(trail.id, {
        startNote: "Start here",
        stops: [{ websiteUrl: "https://a.com", note: "Check this" }],
      });

      expect(updated.startNote).toBe("Start here");
      expect(updated.stops[0].note).toBe("Check this");
    });

    it("rejects with error for non-existent trail", async () => {
      await expect(
        store.updateTrail("nonexistent", { name: "X" }),
      ).rejects.toThrow("Trail not found");
    });

    it("preserves unchanged fields when partially updating", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Original", [
        "https://a.com",
      ]);

      await store.updateTrail(trail.id, { startNote: "New note" });
      const fetched = await store.getTrail(trail.id);

      expect(fetched.name).toBe("Original");
      expect(fetched.stops).toHaveLength(1);
      expect(fetched.startNote).toBe("New note");
    });
  });

  describe("deleteTrail", () => {
    it("deletes a trail by ID", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Delete Me", []);

      await store.deleteTrailFromRabbithole(rh.id, trail.id);
      await store.deleteTrail(trail.id);

      const fetched = await store.getTrail(trail.id);
      expect(fetched).toBeUndefined();
    });

    it("removes trail ID from parent rabbithole", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Trail", []);

      await store.deleteTrailFromRabbithole(rh.id, trail.id);
      await store.deleteTrail(trail.id);

      const rabbitholes = await store.getAllRabbitholes();
      const found = rabbitholes.find((r) => r.id === rh.id);
      expect(found?.trails).not.toContain(trail.id);
    });

    it("clears active trail when the active trail is deleted", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const trail = await store.createTrail(rh.id, "Active Trail", []);

      await store.deleteTrailFromRabbithole(rh.id, trail.id);
      await store.deleteTrail(trail.id);

      const active = await store.getActiveTrail();
      expect(active).toBeNull();
    });

    it("does not affect other trails when one is deleted", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const t1 = await store.createTrail(rh.id, "T1", []);
      const t2 = await store.createTrail(rh.id, "T2", []);

      await store.deleteTrailFromRabbithole(rh.id, t1.id);
      await store.deleteTrail(t1.id);

      const t2Fetched = await store.getTrail(t2.id);
      expect(t2Fetched).toBeDefined();
      expect(t2Fetched.name).toBe("T2");
    });

    it("deletes all trails when rabbithole is deleted", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const t1 = await store.createTrail(rh.id, "T1", []);
      const t2 = await store.createTrail(rh.id, "T2", []);

      await store.deleteRabbithole(rh.id);

      expect(await store.getTrail(t1.id)).toBeUndefined();
      expect(await store.getTrail(t2.id)).toBeUndefined();
    });
  });

  describe("Trail and Rabbithole integration", () => {
    it("rabbithole initializes with empty trails array", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      expect(rh.trails).toEqual([]);
    });

    it("multiple trails can belong to the same rabbithole", async () => {
      const rh = await store.createNewActiveRabbithole("RH");
      const t1 = await store.createTrail(rh.id, "T1", []);
      const t2 = await store.createTrail(rh.id, "T2", []);
      const t3 = await store.createTrail(rh.id, "T3", []);

      const rabbitholes = await store.getAllRabbitholes();
      const found = rabbitholes.find((r) => r.id === rh.id);
      expect(found?.trails).toContain(t1.id);
      expect(found?.trails).toContain(t2.id);
      expect(found?.trails).toContain(t3.id);
    });

    it("switching active rabbithole clears active trail", async () => {
      const rh1 = await store.createNewActiveRabbithole("RH1");
      await store.createTrail(rh1.id, "Trail", []);

      const rh2 = await store.createNewActiveRabbithole("RH2");
      await store.changeActiveRabbithole(rh2.id);

      const active = await store.getActiveTrail();
      expect(active).toBeNull();
    });
  });
});
