<script lang="ts">
  import Overlay from "src/lib/Overlay.svelte";
  import { Tooltip } from "@svelteuidev/core";
  import { onMount } from "svelte";
  import { MessageRequest, NotificationDuration, Logger } from "../utils";
  import type { Settings } from "../utils/types";

  let isSyncingWindow = false;
  let syncWindowSuccess = false;
  let settings: Settings | null = null;
  let show: boolean = true;

  onMount(async () => {
    settings = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_SETTINGS,
    });
    show = settings.show;
  });

  async function toggleOverlay() {
    const newShowValue = !show;
    show = newShowValue;

    await chrome.runtime.sendMessage({
      type: MessageRequest.UPDATE_SETTINGS,
      settings: { ...settings, show: newShowValue },
    });

    // Update local settings reference
    settings = { ...settings, show: newShowValue };

    // Reload the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id) {
      await chrome.tabs.reload(tab.id);
    }
  }

  async function saveAllTabsToActiveProject() {
    isSyncingWindow = true;
    try {
      await chrome.runtime.sendMessage({
        type: MessageRequest.SAVE_WINDOW_TO_ACTIVE_BURROW,
      });
      syncWindowSuccess = true;
      setTimeout(() => {
        syncWindowSuccess = false;
      }, NotificationDuration);
    } catch (e) {
      Logger.error(e);
    } finally {
      isSyncingWindow = false;
    }
  }
</script>

<div class="popup-container">
  <div class="popup-wrapper">
    <div class="popup-header">
      <span class="popup-title">Rabbithole</span>
      <div class="header-actions">
        <Tooltip label="Save all tabs in window to current project" withArrow>
          <button
            class="link-button"
            on:click={saveAllTabsToActiveProject}
            disabled={isSyncingWindow}
          >
            {syncWindowSuccess ? "Synced!" : "Sync Window"}
          </button>
        </Tooltip>
        <Tooltip label="This will refresh the page" withArrow>
          <button class="link-button" on:click={toggleOverlay}>
            {show ? "Hide" : "Show"} Overlay
          </button>
        </Tooltip>
      </div>
    </div>
    <Overlay isPopup={true} />
  </div>
</div>

<style>
  .popup-container {
    width: 100%;
    height: 100%;
    background-color: white;
    margin: 0;
    padding: 0;
    border: none;
    outline: none;
    overflow: visible;
  }

  .popup-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-sizing: border-box;
    border: none;
    gap: 16px;
    overflow: visible;
  }

  .popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid #e9ecef;
  }

  .popup-title {
    font-weight: bold;
    font-size: 14px;
    color: #212529;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .link-button {
    background: none;
    border: none;
    color: #1185fe;
    text-decoration: underline;
    cursor: pointer;
    font-size: 13px;
    padding: 0;
    font-family: inherit;
  }

  .link-button:hover {
    color: #0070e0;
  }

  .link-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (prefers-color-scheme: dark) {
    .popup-container {
      background-color: #1a1b1e;
    }

    .popup-header {
      border-bottom-color: #373a40;
    }

    .popup-title {
      color: #c1c2c5;
    }

    .link-button {
      color: #4dabf7;
    }

    .link-button:hover {
      color: #74c0fc;
    }
  }
</style>
