import { MessageRequest, Logger } from "../utils";
import { WebsiteStore } from "../storage/db";
import type { Burrow } from "../utils/types";
import { getSession } from "../atproto/client";
import { syncBurrowToCollection } from "../atproto/cosmik";
import {
  publishTrail as publishSidetrailTrail,
  startSidetrailWalk,
  advanceSidetrailWalk,
  completeSidetrailWalk,
  abandonSidetrailWalk,
} from "../atproto/sidetrail";
import { syncFromAtproto } from "../atproto/sync";
import { storeWebsites } from "../utils/browser";
import {
  importBookmarksFromBrowser,
  importTabGroupsFromBrowser,
} from "../utils/import";
import {
  getTrailWalkTabId,
  setTrailWalkTabId,
  clearTrailWalkTab,
  broadcastToTabs,
  broadcastTrailWalkUpdated,
  focusOrOpenTrailTab,
} from "../utils/trails";

type Handler = (
  request: any,
  sender: chrome.runtime.MessageSender,
) => Promise<any>;

function handle(
  sendResponse: (response?: any) => void,
  fn: Handler,
  request: any,
  sender: chrome.runtime.MessageSender,
) {
  fn(request, sender)
    .then((res) => sendResponse(res))
    .catch((err) => {
      Logger.error("Handler failed", err);
      sendResponse({ error: err?.message || "Unknown error" });
    });
}

chrome.runtime.onInstalled.addListener(async () => {
  WebsiteStore.init(indexedDB);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!("type" in request)) {
    // arcane incantation required for async `sendResponse`s to work
    // https://developer.chrome.com/docs/extensions/mv3/messaging/#simple
    sendResponse({ error: "request type required" });
    return true;
  }

  const requestName = MessageRequest[request.type] || "UNKNOWN_REQUEST";

  Logger.info(`Background received: ${requestName}`, {
    request,
    sender: sender.tab ? `Tab ${sender.tab.id}` : "Extension",
  });

  const db = new WebsiteStore(indexedDB);

  const handlers: Partial<Record<MessageRequest, Handler>> = {
    [MessageRequest.GET_CURRENT_TAB_ID]: async (_req, sender) => {
      return { tabId: sender.tab?.id ?? null };
    },

    [MessageRequest.REGISTER_TRAIL_WALK_TAB]: async (req, sender) => {
      const tabId = req.tabId ?? sender.tab?.id ?? null;
      if (tabId !== null) {
        await setTrailWalkTabId(tabId);
        return { success: true };
      }
      return { success: false };
    },

    [MessageRequest.SAVE_TAB]: async (_req, _sender) => {
      const tabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });

      const sites = await storeWebsites(tabs, db);
      if (sites.length > 0) {
        const activeBurrow = await db.getActiveBurrow();
        if (activeBurrow) {
          await db.saveWebsitesToBurrow(sites);
        }

        // Also add to active rabbithole meta
        const activeRabbithole = await db.getActiveRabbithole();
        if (activeRabbithole) {
          const urls = sites.map((s) => s.url);
          await db.addWebsitesToRabbitholeMeta(activeRabbithole.id, urls);
        }
      }

      return { success: true };
    },

    [MessageRequest.GET_ALL_ITEMS]: async () => db.getAllWebsites(),

    [MessageRequest.GET_SETTINGS]: async () => db.getSettings(),

    [MessageRequest.UPDATE_SETTINGS]: async (req) => {
      if (!("settings" in req)) {
        throw new Error("settings required");
      }
      return db.updateSettings(req.settings);
    },

    [MessageRequest.GET_ALL_BURROWS]: async () => db.getAllBurrows(),

    [MessageRequest.GET_BURROW_WEBSITES]: async (req) => {
      if (!("burrowId" in req)) {
        throw new Error("burrowId required");
      }
      return db.getAllWebsitesForBurrow(req.burrowId);
    },

    [MessageRequest.GET_RABBITHOLE_WEBSITES]: async (req) => {
      if (!("rabbitholeId" in req)) {
        throw new Error("rabbitholeId required");
      }
      return db.getAllWebsitesForRabbithole(req.rabbitholeId);
    },

    [MessageRequest.CREATE_NEW_BURROW]: async (req) => {
      if (!("newBurrowName" in req)) {
        throw new Error("newBurrowName required");
      }
      return db.createNewActiveBurrow(req.newBurrowName);
    },

    // Fix: guard against null burrowId before trying to fetch the parent rabbithole
    [MessageRequest.CHANGE_ACTIVE_BURROW]: async (req) => {
      if (!("burrowId" in req)) {
        throw new Error("burrowId required");
      }
      if (req.burrowId === null) {
        await db.changeActiveBurrow(null);
        await db.changeActiveTrail(null);
        return { success: true };
      }
      const parentRabbithole = await db.fetchRabbitholeForBurrow(req.burrowId);
      await db.changeActiveRabbithole(parentRabbithole.id);
      await db.changeActiveBurrow(req.burrowId);
      await db.changeActiveTrail(null);
      return { success: true };
    },

    [MessageRequest.GET_ACTIVE_BURROW]: async () => db.getActiveBurrow(),

    [MessageRequest.GET_BURROW]: async (req) => {
      if (!("burrowId" in req)) {
        throw new Error("burrowId required");
      }
      return db.getBurrow(req.burrowId);
    },

    [MessageRequest.SAVE_WINDOW_TO_NEW_BURROW]: async (req, sender) => {
      if (!sender.tab?.windowId) {
        throw new Error("sender tab windowId required");
      }
      if (!("newBurrowName" in req)) {
        throw new Error("burrowName required");
      }

      const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
      const sites = await storeWebsites(tabs, db);
      const urls = sites.map((s) => s.url);

      const burrow = await db.createNewActiveBurrow(req.newBurrowName, urls);

      const activeRabbithole = await db.getActiveRabbithole();
      if (activeRabbithole) {
        await db.addWebsitesToRabbitholeMeta(activeRabbithole.id, urls);
      }

      return burrow;
    },

    // Fix: use lastFocusedWindow to get the actual browser window the user is in,
    // not the extension's own window context. Fall back gracefully if none found.
    [MessageRequest.SAVE_WINDOW_TO_ACTIVE_BURROW]: async () => {
      const windows = await chrome.windows.getAll({ populate: false });
      // Find the last focused normal browser window (not the extension popup)
      const lastFocused = await chrome.windows.getLastFocused({
        populate: false,
        windowTypes: ["normal"],
      });

      if (!lastFocused?.id) {
        Logger.warn("SAVE_WINDOW_TO_ACTIVE_BURROW: no focused window found");
        return { success: false };
      }

      const tabs = await chrome.tabs.query({ windowId: lastFocused.id });
      const sites = await storeWebsites(tabs, db);

      if (sites.length > 0) {
        await db.saveWebsitesToBurrow(sites);

        // make sure to sync with rabbithole meta
        const activeBurrow = await db.getActiveBurrow();
        if (activeBurrow) {
          const rabbithole = await db.fetchRabbitholeForBurrow(activeBurrow.id);
          const urls = sites.map((s) => s.url);
          await db.addWebsitesToRabbitholeMeta(rabbithole.id, urls);
        }
      }

      return { success: true };
    },

    [MessageRequest.SAVE_WINDOW_TO_RABBITHOLE]: async (req) => {
      if (!("rabbitholeId" in req)) {
        throw new Error("rabbitholeId required");
      }

      const lastFocused = await chrome.windows.getLastFocused({
        populate: false,
        windowTypes: ["normal"],
      });

      if (!lastFocused?.id) {
        Logger.warn("SAVE_WINDOW_TO_RABBITHOLE: no focused window found");
        return { success: false };
      }

      const tabs = await chrome.tabs.query({ windowId: lastFocused.id });
      const sites = await storeWebsites(tabs, db);
      const urls = sites.map((s) => s.url);

      await db.addWebsitesToRabbitholeMeta(req.rabbitholeId, urls);
      return { success: true };
    },

    [MessageRequest.UPDATE_RABBITHOLE_PINNED_WEBSITES]: async (
      _req,
      sender,
    ) => {
      if (!sender.tab?.windowId) {
        throw new Error("sender tab windowId required");
      }

      const tabs = await chrome.tabs.query({ windowId: sender.tab.windowId });
      const sites = await storeWebsites(tabs, db);
      const urls = sites.map((s) => s.url);

      const activeRabbithole = await db.getActiveRabbithole();
      if (activeRabbithole) {
        await db.updateRabbitholeActiveTabs(activeRabbithole.id, urls);
        await db.addWebsitesToRabbitholeMeta(activeRabbithole.id, urls);
      }

      return { success: true };
    },

    [MessageRequest.RENAME_BURROW]: async (req) => {
      if (!("newName" in req) || !("burrowId" in req)) {
        throw new Error("burrowId and newName required");
      }
      return db.renameBurrow(req.burrowId, req.newName);
    },

    [MessageRequest.DELETE_BURROW]: async (req) => {
      if (!("rabbitholeId" in req) || !("burrowId" in req)) {
        throw new Error("rabbitholeId and burrowId required");
      }
      await db.deleteBurrowFromRabbithole(req.rabbitholeId, req.burrowId);
      await db.deleteBurrow(req.burrowId);
      // Always clear the active burrow and trail when a burrow is deleted,
      // regardless of which burrow was active, to avoid a stuck UI state.
      await db.changeActiveBurrow(null);
      await db.changeActiveTrail(null);
    },

    [MessageRequest.DELETE_WEBSITE]: async (req) => {
      if (!("url" in req) || !("burrowId" in req)) {
        throw new Error("burrowId and url required");
      }
      await db.deleteWebsiteFromBurrow(req.burrowId, req.url);
      return { success: true };
    },

    [MessageRequest.PUBLISH_BURROW]: async (req) => {
      if (!("burrowId" in req) || !("uri" in req) || !("timestamp" in req)) {
        throw new Error("burrowId, uri, and timestamp required");
      }
      await db.updateBurrowSembleInfo(req.burrowId, req.uri, req.timestamp);
      return { success: true };
    },

    [MessageRequest.GET_ACTIVE_RABBITHOLE]: async () =>
      db.getActiveRabbithole(),

    [MessageRequest.GET_ALL_RABBITHOLES]: async () => db.getAllRabbitholes(),

    [MessageRequest.FETCH_RABBITHOLE_FOR_BURROW]: async (req) => {
      if (!("burrowId" in req)) {
        throw new Error("burrowId required");
      }
      return db.fetchRabbitholeForBurrow(req.burrowId);
    },

    [MessageRequest.CHANGE_ACTIVE_RABBITHOLE]: async (req) => {
      const rabbitholeId = "rabbitholeId" in req ? req.rabbitholeId : null;
      // TODO: does perf here ever measurably affect UX?
      await db.changeActiveRabbithole(rabbitholeId);
      await db.changeActiveBurrow(null);
      await db.changeActiveTrail(null);
      return { success: true };
    },

    [MessageRequest.CREATE_NEW_RABBITHOLE]: async (req) => {
      if (!("title" in req)) {
        throw new Error("title required");
      }
      return db.createNewActiveRabbithole(req.title, req.description);
    },

    [MessageRequest.UPDATE_RABBITHOLE]: async (req) => {
      if (!("rabbitholeId" in req)) {
        throw new Error("rabbitholeId required");
      }
      return db.updateRabbithole(req.rabbitholeId, req.title, req.description);
    },

    [MessageRequest.DELETE_RABBITHOLE]: async (req) => {
      if (!("rabbitholeId" in req)) {
        throw new Error("rabbitholeId required");
      }
      const rabbithole = await db.getRabbithole(req.rabbitholeId);
      await Promise.all([
        ...(rabbithole?.burrows || []).map((b) => db.deleteBurrow(b)),
        ...(rabbithole?.trails || []).map((t) => db.deleteTrail(t)),
      ]);
      await db.deleteRabbithole(req.rabbitholeId);

      const activeRabbithole = await db.getActiveRabbithole();
      if (activeRabbithole?.id === req.rabbitholeId) {
        await db.changeActiveRabbithole(null);
        await db.changeActiveBurrow(null);
        await db.changeActiveTrail(null);
      }
    },

    [MessageRequest.ADD_BURROWS_TO_RABBITHOLE]: async (req) => {
      if (!("rabbitholeId" in req) || !("burrowIds" in req)) {
        throw new Error("rabbitholeId and burrowIds required");
      }
      return db.addBurrowsToRabbithole(req.rabbitholeId, req.burrowIds);
    },

    [MessageRequest.CREATE_NEW_BURROW_IN_RABBITHOLE]: async (req) => {
      if (!("burrowName" in req)) {
        throw new Error("burrowName required");
      }
      return db.createNewBurrowInActiveRabbithole(
        req.burrowName,
        req.websites ?? [],
      );
    },

    [MessageRequest.ADD_WEBSITES_TO_RABBITHOLE_META]: async (req) => {
      if (!("rabbitholeId" in req) || !("urls" in req)) {
        throw new Error("rabbitholeId and urls required");
      }
      return db.addWebsitesToRabbitholeMeta(req.rabbitholeId, req.urls);
    },

    [MessageRequest.ADD_WEBSITES_TO_BURROW]: async (req) => {
      if (!("burrowId" in req) || !("urls" in req)) {
        throw new Error("burrowId and urls required");
      }
      return db.addWebsitesToBurrow(req.burrowId, req.urls);
    },

    [MessageRequest.DELETE_WEBSITE_FROM_RABBITHOLE_META]: async (req) => {
      if (!("rabbitholeId" in req) || !("url" in req)) {
        throw new Error("rabbitholeId and url required");
      }
      return db.deleteWebsiteFromRabbitholeMeta(req.rabbitholeId, req.url);
    },

    [MessageRequest.UPDATE_WEBSITE]: async (req) => {
      if (!("url" in req)) {
        throw new Error("url required");
      }
      return db.updateWebsite(req.url, req.name, req.description);
    },

    [MessageRequest.SYNC_BURROW]: async (req) => {
      if (!("burrowId" in req)) {
        throw new Error("burrowId required");
      }

      const burrow = await db.getBurrow(req.burrowId);
      if (!burrow.sembleCollectionUri) {
        throw new Error("Burrow is not published");
      }

      const websites = await db.getAllWebsitesForBurrow(req.burrowId);
      const session = await getSession();
      if (!session) {
        throw new Error("Not logged in");
      }

      await syncBurrowToCollection(
        session.did,
        burrow.sembleCollectionUri,
        websites,
      );

      // Update last sync time
      const timestamp = Date.now();
      await db.updateBurrowSembleInfo(
        burrow.id,
        burrow.sembleCollectionUri,
        timestamp,
      );

      return { success: true, timestamp };
    },

    [MessageRequest.REMOVE_FROM_ACTIVE_TABS]: async (req) => {
      if (!("url" in req)) {
        throw new Error("url required");
      }

      const activeRabbithole = await db.getActiveRabbithole();
      if (!activeRabbithole) {
        throw new Error("No active rabbithole found");
      }

      await db.removeWebsiteFromRabbitholeActiveTabs(
        activeRabbithole.id,
        req.url,
      );
      return { success: true };
    },

    [MessageRequest.GET_TRAIL]: async (req) => {
      if (!("trailId" in req)) {
        throw new Error("trailId required");
      }
      return db.getTrail(req.trailId);
    },

    [MessageRequest.GET_ACTIVE_TRAIL]: async () => db.getActiveTrail(),

    [MessageRequest.CHANGE_ACTIVE_TRAIL]: async (req) => {
      if (!("trailId" in req)) {
        throw new Error("trailId required");
      }
      await db.changeActiveBurrow(null);
      await db.changeActiveTrail(req.trailId);
    },

    [MessageRequest.CREATE_TRAIL]: async (req) => {
      if (
        !("rabbitholeId" in req) ||
        !("name" in req) ||
        !("websites" in req)
      ) {
        throw new Error("rabbitholeId, name, and websites required");
      }
      await db.changeActiveBurrow(null);
      return db.createNewActiveTrail(req.rabbitholeId, req.name, req.websites);
    },

    [MessageRequest.UPDATE_TRAIL]: async (req) => {
      if (!("trailId" in req) || !("updates" in req)) {
        throw new Error("trailId and updates required");
      }
      return db.updateTrail(req.trailId, req.updates);
    },

    [MessageRequest.DELETE_TRAIL]: async (req) => {
      if (!("rabbitholeId" in req) || !("trailId" in req)) {
        throw new Error("rabbitholeId and trailId required");
      }
      await db.deleteTrailFromRabbithole(req.rabbitholeId, req.trailId);
      await db.deleteTrail(req.trailId);
      await db.changeActiveTrail(null);
      await clearTrailWalkTab();
      await broadcastTrailWalkUpdated();
    },

    [MessageRequest.SYNC_ATPROTO]: async () => {
      const session = await getSession();
      if (!session) return { success: false };
      const imported = await syncFromAtproto(session.did, db);
      return { success: true, imported };
    },

    [MessageRequest.PUBLISH_TRAIL]: async (req) => {
      if (!("trailId" in req)) {
        throw new Error("trailId required");
      }
      const session = await getSession();
      if (!session) throw new Error("Not logged in");

      const trail = await db.getTrail(req.trailId);
      if (!trail) throw new Error("Trail not found");

      const existingRkey = trail.sidetrailUri
        ? trail.sidetrailUri.split("/").pop()
        : undefined;

      const ref = await publishSidetrailTrail(
        session.did,
        trail,
        existingRkey,
        trail.sidetrailCid,
      );

      await db.updateTrail(req.trailId, {
        sidetrailUri: ref.uri,
        sidetrailCid: ref.cid,
      });

      return { uri: ref.uri, cid: ref.cid };
    },

    [MessageRequest.START_TRAIL_WALK]: async (req, sender) => {
      if (!("trailId" in req)) {
        throw new Error("trailId required");
      }
      const walk = await db.startTrailWalk(req.trailId);
      if (sender.tab?.id) {
        await setTrailWalkTabId(sender.tab.id);
      }

      // Optionally push walk to sidetrail if trail is published
      const session = await getSession();
      if (session) {
        const trail = await db.getTrail(req.trailId);
        if (trail?.sidetrailUri && trail.sidetrailCid) {
          try {
            const walkRef = await startSidetrailWalk(
              session.did,
              trail.sidetrailUri,
              trail.sidetrailCid,
              "stop-0",
            );
            walk.sidetrailWalkUri = walkRef.uri;
            await db.patchTrailWalkById(walk.id, {
              sidetrailWalkUri: walkRef.uri,
            });
          } catch (err) {
            Logger.warn("Failed to start sidetrail walk:", err);
          }
        }
      }

      await broadcastTrailWalkUpdated();
      return walk;
    },

    [MessageRequest.ADVANCE_TRAIL_WALK]: async (req) => {
      if (!("trailId" in req) || !("websiteUrl" in req)) {
        throw new Error("trailId and websiteUrl required");
      }
      const walk = await db.advanceTrailWalk(req.trailId, req.websiteUrl);

      if (walk.sidetrailWalkUri) {
        (async () => {
          const session = await getSession();
          if (!session) return;
          const trail = await db.getTrail(req.trailId);
          if (!trail?.sidetrailUri) return;
          const walkRkey = walk.sidetrailWalkUri.split("/").pop()!;
          const stopIdx = trail.stops.findIndex(
            (s) => s.websiteUrl === req.websiteUrl,
          );
          const visitedTids = Array.from(
            { length: stopIdx + 1 },
            (_, i) => `stop-${i}`,
          );
          await advanceSidetrailWalk(
            session.did,
            walkRkey,
            undefined,
            trail.sidetrailUri,
            trail.sidetrailCid ?? "",
            visitedTids,
          );
        })().catch((err) =>
          Logger.warn("Failed to advance sidetrail walk:", err),
        );
      }

      return walk;
    },

    [MessageRequest.REWIND_TRAIL_WALK]: async (req, sender) => {
      if (!("trailId" in req)) {
        throw new Error("trailId required");
      }
      const walk = await db.rewindTrailWalk(req.trailId);
      if (sender.tab?.id) {
        await setTrailWalkTabId(sender.tab.id);
      }
      await broadcastTrailWalkUpdated();
      return walk;
    },

    [MessageRequest.COMPLETE_TRAIL_WALK]: async (req) => {
      if (!("trailId" in req)) {
        throw new Error("trailId required");
      }
      // Get walk and trail before completing (getTrailWalk filters out completed)
      const [walkBeforeComplete, trail] = await Promise.all([
        db.getTrailWalk(req.trailId),
        db.getTrail(req.trailId),
      ]);

      await db.completeTrailWalk(req.trailId);
      await clearTrailWalkTab();
      await broadcastTrailWalkUpdated();

      // Fire-and-forget sidetrail completion
      if (walkBeforeComplete?.sidetrailWalkUri && trail?.sidetrailUri) {
        (async () => {
          const session = await getSession();
          if (!session) return;
          const walkRkey = walkBeforeComplete.sidetrailWalkUri
            .split("/")
            .pop()!;
          await completeSidetrailWalk(
            session.did,
            walkRkey,
            trail.sidetrailUri,
            trail.sidetrailCid ?? "",
          );
        })().catch((err) =>
          Logger.warn("Failed to complete sidetrail walk:", err),
        );
      }
    },

    [MessageRequest.ABANDON_TRAIL_WALK]: async (req) => {
      if (!("trailId" in req)) {
        throw new Error("trailId required");
      }
      // Get walk before abandoning (abandonTrailWalk deletes the record)
      const walkBeforeAbandon = await db.getTrailWalk(req.trailId);

      await db.abandonTrailWalk(req.trailId);
      await clearTrailWalkTab();
      await broadcastTrailWalkUpdated();

      // Fire-and-forget sidetrail abandon
      if (walkBeforeAbandon?.sidetrailWalkUri) {
        (async () => {
          const session = await getSession();
          if (!session) return;
          const walkRkey = walkBeforeAbandon.sidetrailWalkUri.split("/").pop()!;
          await abandonSidetrailWalk(session.did, walkRkey);
        })().catch((err) =>
          Logger.warn("Failed to abandon sidetrail walk:", err),
        );
      }
    },

    [MessageRequest.GET_TRAIL_WALK_STATE]: async (req) => {
      if (!("trailId" in req)) {
        throw new Error("trailId required");
      }
      const trail = await db.getTrail(req.trailId);
      const walk = await db.getTrailWalk(req.trailId);
      const websites = trail
        ? await db.getAllWebsitesForRabbithole(trail.rabbitholeId)
        : [];
      return { trail, walk, websites };
    },

    [MessageRequest.GET_TRAIL_WALK_TAB]: async () => {
      return { tabId: await getTrailWalkTabId() };
    },

    [MessageRequest.FOCUS_TRAIL_TAB]: async (req) => {
      return focusOrOpenTrailTab("url" in req ? req.url : undefined);
    },

    [MessageRequest.OPEN_TABS]: async (req) => {
      if (!("urls" in req)) {
        throw new Error("urls required");
      }
      req.urls.forEach((url: string) => {
        chrome.tabs.create({ url });
      });
      return { success: true };
    },

    [MessageRequest.IMPORT_DATA]: async (req) => {
      if (!("rabbitholes" in req && "websites" in req)) {
        throw new Error("projects required");
      }

      const burrowsToImport = (req as any).burrows as (Burrow & {
        savedWebsites?: string[];
      })[];
      const websitesToImport = (req as any).websites || [];
      const rabbitholesToImport = ((req as any).rabbitholes || []) as any[];

      if (websitesToImport.length > 0) {
        await db.saveWebsites(websitesToImport);
      }

      const existingBurrows = await db.getAllBurrows();
      const allWebsites = await db.getAllWebsites();

      const existingUrls = new Set(allWebsites.map((w) => w.url));
      const existingBurrowMap = new Map<string, Burrow>(
        existingBurrows.map((b) => [b.name, b]),
      );
      const oldIdToNewId = new Map<string, string>();

      for (const burrow of burrowsToImport) {
        const missingWebsites: any[] = [];
        const websites = burrow.websites ?? burrow.savedWebsites ?? [];
        if (websites) {
          for (const url of websites) {
            if (!existingUrls.has(url)) {
              missingWebsites.push({
                url,
                name: url,
                savedAt: Date.now(),
                faviconUrl: "",
                description: "Imported",
              });
              existingUrls.add(url);
            }
          }
        }

        if (missingWebsites.length > 0) {
          await db.saveWebsites(missingWebsites);
        }

        let burrowName = burrow.name;
        const existingBurrow = existingBurrowMap.get(burrowName);

        if (existingBurrow) {
          const existingWebsites = new Set(existingBurrow.websites);
          const newWebsites = new Set(websites);

          let isConsistent = existingWebsites.size === newWebsites.size;
          if (isConsistent) {
            for (const w of newWebsites) {
              if (!existingWebsites.has(w)) {
                isConsistent = false;
                break;
              }
            }
          }

          if (isConsistent) {
            oldIdToNewId.set(burrow.id, existingBurrow.id);
            continue;
          } else {
            let counter = 1;
            while (existingBurrowMap.has(burrowName)) {
              burrowName = `${burrow.name} (${counter})`;
              counter++;
            }
          }
        }

        const newBurrow = await db.createNewActiveBurrow(burrowName, websites);
        oldIdToNewId.set(burrow.id, newBurrow.id);

        existingBurrowMap.set(burrowName, {
          id: newBurrow.id,
          createdAt: Date.now(),
          name: burrowName,
          websites: websites,
        } as any);
      }

      // Import Rabbitholes
      const existingRabbitholes = await db.getAllRabbitholes();
      const existingRabbitholeMap = new Map(
        existingRabbitholes.map((r) => [r.title, r]),
      );

      for (const rh of rabbitholesToImport) {
        const metaUrls: string[] = rh.meta || [];
        const existing = existingRabbitholeMap.get(rh.title);

        let rhId: string;
        if (existing) {
          rhId = existing.id;
          if ((existing.meta || []).length > 0) continue;
        } else {
          const newRh = await db.createNewActiveRabbithole(
            rh.title,
            rh.description,
          );
          rhId = newRh.id;

          const newBurrowIds = (rh.burrows || [])
            .map((oldId: string) => oldIdToNewId.get(oldId))
            .filter((id: string | undefined) => id !== undefined);
          if (newBurrowIds.length > 0) {
            await db.addBurrowsToRabbithole(rhId, newBurrowIds);
          }
        }

        if (metaUrls.length > 0) {
          await db.addWebsitesToRabbitholeMeta(rhId, metaUrls);
        }

        const activeTabUrls: string[] = rh.activeTabs || [];
        if (activeTabUrls.length > 0) {
          await db.updateRabbitholeActiveTabs(rhId, activeTabUrls);
        }
      }

      return { success: true };
    },

    [MessageRequest.IMPORT_BROWSER_DATA]: async (req) => {
      const { importBookmarks, importTabGroups } = req as any;
      if (importBookmarks) {
        await importBookmarksFromBrowser(db);
      }
      if (importTabGroups) {
        await importTabGroupsFromBrowser(db);
      }
      return { success: true };
    },
  };

  const handler = handlers[request.type as MessageRequest];
  if (handler) {
    handle(sendResponse, handler, request, sender);
  } else {
    Logger.warn(`Unknown message type: ${request.type}`);
  }

  // arcane incantation required for async `sendResponse`s to work
  // https://developer.chrome.com/docs/extensions/mv3/messaging/#simple
  return true;
});
