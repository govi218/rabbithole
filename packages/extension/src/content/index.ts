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
    const myTabId = await getMyTabId();
    if (myTabId === null) {
      return false;
    }

    const tabRes = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_TRAIL_WALK_TAB,
    });

    if (tabRes?.tabId === myTabId) {
      return true;
    }

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

    // Check if this page is a trail stop
    const currentUrl = window.location.href;
    const normalizeUrl = (url: string) => {
      try {
        const u = new URL(url);
        return u.origin + u.pathname.replace(/\/+$/, '');
      } catch {
        return url.replace(/\/+$/, '');
      }
    };

    const normalizedCurrent = normalizeUrl(currentUrl);
    const isTrailStop = activeTrail.stops?.some(
      (s: any) => s.websiteUrl && normalizeUrl(s.websiteUrl) === normalizedCurrent,
    );

    if (!isTrailStop) {
      return false;
    }

    // No tab registered or registered tab doesn't exist - claim this tab
    if (tabRes?.tabId === null || tabRes?.tabId === undefined) {
      await chrome.runtime.sendMessage({
        type: MessageRequest.REGISTER_TRAIL_WALK_TAB,
        tabId: myTabId,
      });
      return true;
    }

    // Check if registered tab still exists
    try {
      await chrome.tabs.get(tabRes.tabId);
      return false;
    } catch {
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
