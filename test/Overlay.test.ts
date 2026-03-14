import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import Overlay from "../src/lib/Overlay.svelte";
import { MessageRequest } from "../src/utils";

const defaultSettings = {
  show: true,
  alignment: "right" as const,
  darkMode: false,
  hasSeenOnboarding: false,
};

function setupSendMessage(settingsOverride: Partial<typeof defaultSettings> = {}) {
  const settings = { ...defaultSettings, ...settingsOverride };
  vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (req: any) => {
    switch (req.type) {
      case MessageRequest.GET_SETTINGS: return settings;
      case MessageRequest.GET_ALL_BURROWS: return [];
      case MessageRequest.GET_ALL_RABBITHOLES: return [];
      case MessageRequest.GET_ACTIVE_BURROW: return null;
      case MessageRequest.GET_ACTIVE_RABBITHOLE: return null;
      default: return {};
    }
  });
}

describe("Overlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.storage.local.get).mockImplementation((keys: any, callback?: any) => {
      if (typeof callback === "function") callback({});
      return Promise.resolve({});
    });
  });

  it("renders if user.settings.show is true", async () => {
    setupSendMessage({ show: true });
    const { container, component } = render(Overlay, { props: { isPopup: false } });
    await (component as any).refreshData();
    await tick();
    expect(container.querySelector("#rabbithole-overlay-container")).toBeInTheDocument();
  });

  it("doesn't render if user.settings.show is false", async () => {
    setupSendMessage({ show: false });
    const { container, component } = render(Overlay, { props: { isPopup: false } });
    await (component as any).refreshData();
    await tick();
    expect(container.querySelector("#rabbithole-overlay-container")).not.toBeInTheDocument();
  });

  it("clicking hide overlay sets user.settings.show to false", async () => {
    setupSendMessage({ show: true });
    const { container, component } = render(Overlay, { props: { isPopup: false } });
    await (component as any).refreshData();
    await tick();

    const calls: any[] = [];
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (req: any) => {
      calls.push(req);
      return {};
    });

    // Header buttons in order: [0]=Sync, [1]=Move, [2]=Hide
    const headerButtons = container.querySelectorAll(".rabbithole-header button");
    expect(headerButtons.length).toBeGreaterThanOrEqual(3);
    await fireEvent.click(headerButtons[2]);

    const updateCall = calls.find((c) => c.type === MessageRequest.UPDATE_SETTINGS);
    expect(updateCall).toBeTruthy();
    expect(updateCall.settings.show).toBe(false);
  });

  it("clicking move toggles overlay alignment from right to left and vice versa", async () => {
    setupSendMessage({ show: true, alignment: "right" });
    const { container, component } = render(Overlay, { props: { isPopup: false } });
    await (component as any).refreshData();
    await tick();

    const calls: any[] = [];
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (req: any) => {
      calls.push(req);
      return {};
    });

    // Header buttons: [1]=Move
    const headerButtons = container.querySelectorAll(".rabbithole-header button");
    await fireEvent.click(headerButtons[1]);

    const updateCall = calls.find((c) => c.type === MessageRequest.UPDATE_SETTINGS);
    expect(updateCall).toBeTruthy();
    expect(updateCall.settings.alignment).toBe("left");
  });

  it("clicking sync on the overlay syncs websites in window to current burrow, or rabbithole, or does nothing", async () => {
    setupSendMessage({ show: true });
    const { container, component } = render(Overlay, { props: { isPopup: false } });
    await (component as any).refreshData();
    await tick();

    const calls: any[] = [];
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(async (req: any) => {
      calls.push(req);
      return {};
    });

    // Header buttons: [0]=Sync (SAVE_WINDOW_TO_ACTIVE_BURROW)
    const headerButtons = container.querySelectorAll(".rabbithole-header button");
    await fireEvent.click(headerButtons[0]);

    await waitFor(() => {
      const syncCall = calls.find((c) => c.type === MessageRequest.SAVE_WINDOW_TO_ACTIVE_BURROW);
      expect(syncCall).toBeTruthy();
    });
  });
});
