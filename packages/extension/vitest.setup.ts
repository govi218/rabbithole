import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import "fake-indexeddb/auto";

const chromeMock = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue({}),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn().mockImplementation((keys: any, callback?: any) => {
        if (typeof callback === "function") {
          callback({});
        }
        return Promise.resolve({});
      }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    reload: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(undefined),
  },
  windows: {
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
    getAll: vi.fn().mockResolvedValue([]),
  },
  bookmarks: {
    getTree: vi.fn().mockResolvedValue([]),
  },
  tabGroups: {
    get: vi.fn().mockResolvedValue({ title: "Test Group", color: "blue" }),
    TAB_GROUP_ID_NONE: -1,
  },
  identity: {
    getRedirectURL: vi.fn().mockReturnValue("https://mock-redirect.com"),
    launchWebAuthFlow: vi.fn(),
  },
};

(global as any).chrome = chromeMock;
