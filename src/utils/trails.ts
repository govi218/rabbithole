/**
 * Trail walk tab tracking utilities for the background service worker.
 * Keeps trail-specific logic out of the main background index.
 */

const TrailWalkTabKey = "trailWalkTabId";

export async function getTrailWalkTabId(): Promise<number | null> {
  const result = await chrome.storage.session.get(TrailWalkTabKey);
  return result[TrailWalkTabKey] ?? null;
}

export async function setTrailWalkTabId(tabId: number | null): Promise<void> {
  if (tabId === null) {
    await chrome.storage.session.remove(TrailWalkTabKey);
  } else {
    await chrome.storage.session.set({ [TrailWalkTabKey]: tabId });
  }
}

export async function clearTrailWalkTab(): Promise<void> {
  await setTrailWalkTabId(null);
}

/**
 * Broadcast a message to all tabs that have the content script loaded.
 * Silently ignores tabs that don't have the content script.
 */
export async function broadcastToTabs(message: any): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  }
}

/**
 * Broadcast TRAIL_WALK_UPDATED to all tabs so overlays and the newtab
 * page can react to walk state changes.
 */
export async function broadcastTrailWalkUpdated(): Promise<void> {
  await broadcastToTabs({ type: "TRAIL_WALK_UPDATED" });
}

/**
 * Focus the registered trail walk tab, or open a new one at the given URL
 * if the tab no longer exists.
 */
export async function focusOrOpenTrailTab(
  url?: string,
): Promise<{ success: boolean; action?: "focused" | "opened" }> {
  const tabId = await getTrailWalkTabId();
  if (tabId !== null) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
      await chrome.tabs.update(tabId, { active: true });
      return { success: true, action: "focused" };
    } catch {
      // Tab no longer exists — fall through to open a new one
    }
  }
  if (url) {
    const newTab = await chrome.tabs.create({ url });
    await setTrailWalkTabId(newTab.id);
    await broadcastTrailWalkUpdated();
    return { success: true, action: "opened" };
  }
  return { success: false };
}
