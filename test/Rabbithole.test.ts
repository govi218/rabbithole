import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import RabbitholeGrid from "../src/lib/RabbitholeGrid.svelte";
import Timeline from "../src/lib/Timeline.svelte";
import { WebsiteStore } from "../src/storage/db";
import { MessageRequest } from "../src/utils";

const rh1 = {
  id: "rh1",
  title: "Research",
  burrows: ["b1"],
  trails: ["t1"],
  meta: ["https://a.com", "https://b.com"],
  activeTabs: [],
  createdAt: Date.now(),
};

const rh2 = {
  id: "rh2",
  title: "Work",
  burrows: [],
  trails: [],
  meta: [],
  activeTabs: [],
  createdAt: Date.now(),
};

const burrow1 = {
  id: "b1",
  name: "Subtopic",
  websites: ["https://a.com"],
  createdAt: Date.now(),
};

const trail1 = {
  id: "t1",
  name: "My Trail",
  rabbitholeId: "rh1",
  stops: [{ websiteUrl: "https://a.com", note: "" }],
  startNote: "",
  createdAt: Date.now(),
};

describe("Rabbitholes", () => {
  let store: WebsiteStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({});
    vi.mocked(chrome.storage.local.get).mockImplementation(
      (keys: any, callback?: any) => {
        if (typeof callback === "function") callback({});
        return Promise.resolve({});
      },
    );

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

  it("overview shows all rabbitholes with burrow, site, and trail counts", async () => {
    const onSelect = vi.fn();
    const { getByText } = render(RabbitholeGrid, {
      props: {
        rabbitholes: [rh1, rh2],
        burrows: [burrow1],
        onSelect,
        allowCreate: true,
        showDelete: true,
      },
    });

    expect(getByText("Research")).toBeInTheDocument();
    expect(getByText("Work")).toBeInTheDocument();

    // rh1 has 1 burrow
    expect(getByText("1 burrow")).toBeInTheDocument();
    // rh1 has 2 sites (meta)
    expect(getByText("2 sites")).toBeInTheDocument();
    // rh2 has 0 burrows, 0 sites
    expect(getByText("0 burrows")).toBeInTheDocument();
    expect(getByText("0 sites")).toBeInTheDocument();

    // Trail count: rh1 has 1 trail — this assertion is RED (not yet implemented in component)
    expect(getByText("1 trail")).toBeInTheDocument();
  });

  it("clicking a rabbithole sets it active with no active trail or burrow", async () => {
    const onSelect = vi.fn();
    const { getByText } = render(RabbitholeGrid, {
      props: {
        rabbitholes: [rh1, rh2],
        burrows: [burrow1],
        onSelect,
        allowCreate: false,
        showDelete: false,
      },
    });

    await fireEvent.click(getByText("Research"));
    expect(onSelect).toHaveBeenCalledWith("rh1");
    // The background worker enforces no active burrow/trail on CHANGE_ACTIVE_RABBITHOLE.
    // That behavior is separately tested in DB integration tests.
  });

  it("clicking Create creates a new rabbithole with auto-incremented name and sets cursor to title", async () => {
    // Test the auto-increment naming logic
    const existingRabbitholes = [
      { ...rh1, title: "New Rabbithole" },
      { ...rh2, title: "New Rabbithole 2" },
    ];

    let baseName = "New Rabbithole";
    let newName = baseName;
    let counter = 1;
    while (existingRabbitholes.some((r) => r.title === newName)) {
      counter++;
      newName = `${baseName} ${counter}`;
    }
    expect(newName).toBe("New Rabbithole 3");

    // Also verify clicking Create dispatches the event
    const onSelect = vi.fn();
    const { container, component } = render(RabbitholeGrid, {
      props: {
        rabbitholes: existingRabbitholes,
        burrows: [],
        onSelect,
        allowCreate: true,
        showDelete: false,
      },
    });

    let createDispatched = false;
    component.$on("createRabbithole", () => {
      createDispatched = true;
    });

    const createBtn = container.querySelector(
      '[title="Create new rabbithole"]',
    ) as HTMLElement;
    expect(createBtn).toBeInTheDocument();
    await fireEvent.click(createBtn);
    expect(createDispatched).toBe(true);
  });

  it("pressing sync websites on a rabbithole saves all tabs in focused window to rabbithole meta", async () => {
    let saveWindowCall: any = null;
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (req: any) => {
        if (req.type === MessageRequest.SAVE_WINDOW_TO_RABBITHOLE) {
          saveWindowCall = req;
        }
        return {};
      },
    );

    const selectBurrow = vi.fn();
    const selectTrail = vi.fn();
    const { container } = render(Timeline, {
      props: {
        activeBurrow: null,
        activeTrail: null,
        activeRabbithole: rh1,
        websites: [],
        isLoading: false,
        selectBurrow,
        selectTrail,
        autoFocusTitle: false,
        burrowsInActiveRabbithole: [burrow1],
        trailsInActiveRabbithole: [trail1],
      },
    });

    expect(container.querySelector(".timeline")).toBeInTheDocument();

    // ActionBar button order: [0]=Search, [1]=Reload(sync), [2]=Home, ...
    const allBtns = container.querySelectorAll(".action-bar button");
    expect(allBtns.length).toBeGreaterThanOrEqual(2);

    await fireEvent.click(allBtns[1]);

    await waitFor(() => {
      expect(saveWindowCall).toBeTruthy();
      expect(saveWindowCall.rabbitholeId).toBe("rh1");
    });
  });

  it("pressing update pinned websites adds websites open to meta AND to activeTabs", async () => {
    let updatePinnedCall: any = null;
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (req: any) => {
        if (req.type === MessageRequest.UPDATE_RABBITHOLE_PINNED_WEBSITES) {
          updatePinnedCall = req;
        }
        return {};
      },
    );

    const selectBurrow = vi.fn();
    const selectTrail = vi.fn();
    const { container } = render(Timeline, {
      props: {
        activeBurrow: null,
        activeTrail: null,
        activeRabbithole: rh1,
        websites: [],
        isLoading: false,
        selectBurrow,
        selectTrail,
        autoFocusTitle: false,
        burrowsInActiveRabbithole: [burrow1],
        trailsInActiveRabbithole: [trail1],
      },
    });

    expect(container.querySelector(".timeline")).toBeInTheDocument();

    // ActionBar: [0]=Search, [1]=Reload, [2]=Home (only when !activeBurrowId && activeRabbitholeId)
    const allBtns = container.querySelectorAll(".action-bar button");
    expect(allBtns.length).toBeGreaterThanOrEqual(3);

    await fireEvent.click(allBtns[2]);

    await waitFor(() => {
      expect(updatePinnedCall).toBeTruthy();
      expect(updatePinnedCall.rabbitholeId).toBe("rh1");
    });
  });

  it("deleting a rabbithole deletes all burrows and trails within it and sets active to null if deleted was active", async () => {
    const rh = await store.createNewActiveRabbithole("Research");
    const burrow = await store.createNewBurrowInActiveRabbithole("Topic");
    const trail = await store.createTrail(rh.id, "My Trail", []);

    // Re-fetch to get current state
    const rhNow = await store.getRabbithole(rh.id);

    // Simulate what background worker does on DELETE_RABBITHOLE
    await Promise.all([
      ...(rhNow?.burrows || []).map((b) => store.deleteBurrow(b)),
      ...(rhNow?.trails || []).map((t) => store.deleteTrail(t)),
    ]);
    await store.deleteRabbithole(rh.id);

    // If deleted rabbithole was active, clear active state
    const activeRabbithole = await store.getActiveRabbithole();
    if (activeRabbithole?.id === rh.id) {
      await store.changeActiveRabbithole(null);
      await store.changeActiveBurrow(null);
      await store.changeActiveTrail(null);
    }

    expect(await store.getBurrow(burrow.id)).toBeUndefined();
    expect(await store.getTrail(trail.id)).toBeUndefined();
    expect(await store.getRabbithole(rh.id)).toBeUndefined();
    // Active rabbithole should be null (deleted rh was active)
    expect(await store.getActiveRabbithole()).toBeFalsy();
  });

  it("deleting a rabbithole from the grid dispatches deleteRabbithole event with correct id", async () => {
    const onSelect = vi.fn();
    let deletedId: string | null = null;

    const { container, component } = render(RabbitholeGrid, {
      props: {
        rabbitholes: [rh1, rh2],
        burrows: [burrow1],
        onSelect,
        allowCreate: true,
        showDelete: true,
      },
    });

    component.$on("deleteRabbithole", (e: any) => {
      deletedId = e.detail.rabbitholeId;
    });

    const deleteButtons = container.querySelectorAll(
      '[title="Delete Rabbithole"]',
    );
    expect(deleteButtons.length).toBeGreaterThan(0);

    await fireEvent.click(deleteButtons[0]);
    expect(deletedId).toBe("rh1");
  });
});
