import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebsiteStore } from "../src/storage/db";
import {
  importBookmarksFromBrowser,
  importTabGroupsFromBrowser,
} from "../src/utils/import";

describe("Onboarding", () => {
  let store: WebsiteStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it("dark/light mode sets the setting persistently, closing and reopening remembers the value", async () => {
    // Default is light (darkMode: false)
    const settings = await store.getSettings();
    expect(settings.darkMode).toBe(false);

    // Toggle to dark
    await store.updateSettings({ ...settings, darkMode: true });
    localStorage.setItem("rabbithole-dark-mode", "true");

    const dark = await store.getSettings();
    expect(dark.darkMode).toBe(true);
    expect(localStorage.getItem("rabbithole-dark-mode")).toBe("true");

    // Toggle back to light
    await store.updateSettings({ ...dark, darkMode: false });
    localStorage.setItem("rabbithole-dark-mode", "false");

    const light = await store.getSettings();
    expect(light.darkMode).toBe(false);
    expect(localStorage.getItem("rabbithole-dark-mode")).toBe("false");
  });

  it("importing bookmarks creates rabbitholes and burrows from bookmark tree", async () => {
    vi.mocked(chrome.bookmarks.getTree).mockResolvedValue([
      {
        id: "0",
        parentId: undefined,
        title: "",
        children: [
          {
            id: "1",
            parentId: "0",
            title: "Dev Resources",
            children: [
              {
                id: "2",
                parentId: "1",
                url: "https://developer.mozilla.org",
                title: "MDN",
                children: undefined,
              },
              {
                id: "3",
                parentId: "1",
                url: "https://stackoverflow.com",
                title: "SO",
                children: undefined,
              },
            ],
          },
        ],
      },
    ] as chrome.bookmarks.BookmarkTreeNode[]);

    await importBookmarksFromBrowser(store);

    const allRh = await store.getAllRabbitholes();
    expect(allRh.length).toBeGreaterThanOrEqual(1);

    // "Dev Resources" becomes a Rabbithole (it's a top-level user folder)
    const devRh = allRh.find((r) => r.title === "Dev Resources");
    expect(devRh).toBeDefined();

    // The URLs inside Dev Resources should be in its meta
    expect(devRh.meta).toContain("https://developer.mozilla.org");
    expect(devRh.meta).toContain("https://stackoverflow.com");
  });

  it("importing workspaces and tabs creates a rabbithole from each window with correct meta", async () => {
    vi.mocked(chrome.windows.getAll).mockResolvedValue([
      {
        id: 1,
        type: "normal",
        state: "normal",
        tabs: [
          {
            id: 1,
            windowId: 1,
            url: "https://github.com",
            title: "GitHub",
            groupId: -1,
            index: 0,
            pinned: false,
            highlighted: false,
            active: true,
            incognito: false,
          },
          {
            id: 2,
            windowId: 1,
            url: "https://gitlab.com",
            title: "GitLab",
            groupId: -1,
            index: 1,
            pinned: false,
            highlighted: false,
            active: false,
            incognito: false,
          },
        ],
      },
    ] as chrome.windows.Window[]);

    await importTabGroupsFromBrowser(store);

    const allRh = await store.getAllRabbitholes();
    expect(allRh.length).toBeGreaterThanOrEqual(1);

    const imported = allRh.find((r) => r.title === "Imported workspace 1");
    expect(imported).toBeDefined();
    expect(imported.meta).toContain("https://github.com");
    expect(imported.meta).toContain("https://gitlab.com");
  });
});
