import Overlay from "src/lib/Overlay.svelte";
import { MessageRequest } from "src/utils";
import "./styles.css";

let loaded = false;
let overlay: Overlay;
let currentTrailMode = false;

async function getMyTabId(): Promise<number | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_CURRENT_TAB_ID,
    });
    return response?.tabId ?? null;
  } catch {
    return null;
  }
}

async function resolveTrailMode(): Promise<boolean> {
  try {
    const activeTrail = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ACTIVE_TRAIL,
    });
    if (!activeTrail) {
      return false;
    }

    const res = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_TRAIL_WALK_STATE,
      trailId: activeTrail.id,
    });
    const walk = res?.walk;
    if (!walk || walk.completed) {
      return false;
    }

    const myTabId = await getMyTabId();
    if (myTabId === null) {
      return false;
    }

    const currentUrl = window.location.href;

    // Check if this page is one of the trail stops
    const isTrailStop = activeTrail.stops?.some(
      (s: any) => s.websiteUrl === currentUrl,
    );

    if (!isTrailStop) {
      return false;
    }

    // This page is a trail stop. Check the registered tab.
    const tabRes = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_TRAIL_WALK_TAB,
    });

    if (tabRes?.tabId === myTabId) {
      return true;
    }

    if (tabRes?.tabId === null || tabRes?.tabId === undefined) {
      // No tab registered yet — claim this tab
      await chrome.runtime.sendMessage({
        type: MessageRequest.REGISTER_TRAIL_WALK_TAB,
        tabId: myTabId,
      });
      return true;
    }

    // Another tab is registered. Check if it still exists.
    try {
      await chrome.tabs.get(tabRes.tabId);
      return false;
    } catch {
      // Registered tab no longer exists — claim this one
      await chrome.runtime.sendMessage({
        type: MessageRequest.REGISTER_TRAIL_WALK_TAB,
        tabId: myTabId,
      });
      return true;
    }
  } catch {
    return false;
  }
}

async function loadOverlay() {
  const trailMode = await resolveTrailMode();
  currentTrailMode = trailMode;

  if (overlay) {
    overlay.$destroy();
  }
  overlay = new Overlay({ target: document.body, props: { trailMode } });
  loaded = true;
}

async function handleTrailWalkUpdated() {
  const trailMode = await resolveTrailMode();

  if (trailMode !== currentTrailMode) {
    currentTrailMode = trailMode;
    if (overlay) overlay.$destroy();
    overlay = new Overlay({ target: document.body, props: { trailMode } });
    loaded = true;
  } else if (trailMode && overlay) {
    currentTrailMode = trailMode;
    overlay.refreshData();
  }
}

loadOverlay();

setTimeout(async () => {
  if (!currentTrailMode) {
    await handleTrailWalkUpdated();
  }
}, 300);

window.addEventListener("focus", () => {
  if (overlay && loaded) overlay.refreshData();
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (!("type" in request)) {
    sendResponse({ error: "request type required" });
    return;
  }
  if (request.type === "SETTINGS_UPDATED" && overlay && loaded) {
    overlay.refreshData();
  }
  if (request.type === "TRAIL_WALK_UPDATED") {
    handleTrailWalkUpdated();
  }
});
