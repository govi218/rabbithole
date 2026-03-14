import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, getByText } from "@testing-library/svelte";
import Popup from "../src/lib/Popup.svelte";
import { MessageRequest } from "../src/utils";

function makeDefaultSendMessage(overrides: Partial<Record<string, any>> = {}) {
  return vi.fn().mockImplementation(async (req: any) => {
    switch (req.type) {
      case MessageRequest.GET_SETTINGS:
        return (
          overrides.settings ?? {
            show: true,
            alignment: "right",
            darkMode: false,
            hasSeenOnboarding: false,
          }
        );
      case MessageRequest.GET_ALL_BURROWS:
        return overrides.burrows ?? [];
      case MessageRequest.GET_ALL_RABBITHOLES:
        return overrides.rabbitholes ?? [];
      case MessageRequest.GET_ACTIVE_BURROW:
        return overrides.activeBurrow ?? null;
      case MessageRequest.GET_ACTIVE_RABBITHOLE:
        return overrides.activeRabbithole ?? null;
      default:
        return {};
    }
  });
}

describe("Popup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.storage.local.get).mockImplementation(
      (keys: any, callback?: any) => {
        if (typeof callback === "function") callback({});
        return Promise.resolve({});
      },
    );
    vi.mocked(chrome.tabs.query).mockResolvedValue([]);
  });

  it("clicking sync on the popup syncs websites in window to current burrow if set, or current rabbithole if set, or does nothing", async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      makeDefaultSendMessage(),
    );

    const { container } = render(Popup);

    // Wait for mount
    await waitFor(() => {
      expect(container.querySelector(".popup-container")).toBeInTheDocument();
    });

    const calls: any[] = [];
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (req: any) => {
        calls.push(req);
        return {};
      },
    );

    const syncButton = container.querySelector(".link-button") as HTMLElement;
    expect(syncButton).toBeTruthy();
    expect(syncButton.textContent).toContain("Sync Window");
    await fireEvent.click(syncButton);

    await waitFor(() => {
      const syncCall = calls.find(
        (c) => c.type === MessageRequest.SAVE_WINDOW_TO_ACTIVE_BURROW,
      );
      expect(syncCall).toBeTruthy();
    });
  });

  it("clicking show/hide overlay on the popup sets user.settings.show to true/false", async () => {
    // Start with show:true (so the button says "Hide Overlay")
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      makeDefaultSendMessage({
        settings: {
          show: true,
          alignment: "right",
          darkMode: false,
          hasSeenOnboarding: false,
        },
      }),
    );

    const { container } = render(Popup);

    await waitFor(() => {
      expect(container.querySelector(".popup-container")).toBeInTheDocument();
    });

    const calls: any[] = [];
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(
      async (req: any) => {
        calls.push(req);
        return {};
      },
    );

    // Second link-button is the "Hide Overlay" / "Show Overlay" toggle
    const linkButtons = container.querySelectorAll(".link-button");
    expect(linkButtons.length).toBeGreaterThanOrEqual(2);
    const toggleButton = linkButtons[1] as HTMLElement;
    expect(toggleButton.textContent).toContain("Hide");

    await fireEvent.click(toggleButton);

    await waitFor(() => {
      const updateCall = calls.find(
        (c) => c.type === MessageRequest.UPDATE_SETTINGS,
      );
      expect(updateCall).toBeTruthy();
      expect(updateCall.settings.show).toBe(false);
    });
  });
});
