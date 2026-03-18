import { Logger } from "./index";
import type { WebsiteStore } from "../storage/db";
import { isNewtabPage } from "./browser";

export async function importBookmarksFromBrowser(db: WebsiteStore) {
  if (chrome.bookmarks) {
    const tree = await chrome.bookmarks.getTree();

    async function traverse(
      n: chrome.bookmarks.BookmarkTreeNode,
      parentRabbitholeId?: string,
    ) {
      if (!n.children) return;

      const isRoot = n.id === "0" || n.parentId === "0";
      let currentRhId = parentRabbitholeId;

      if (isRoot) {
        // Root folders (Bookmarks Bar, Other Bookmarks) don't become Rabbitholes themselves,
        // UNLESS they have direct URLs. Their children will become the Rabbitholes.
        const urls = n.children.filter((c) => c.url).map((c) => c.url);
        if (urls.length > 0) {
          const rh = await db.createNewActiveRabbithole(n.title || "Bookmarks");
          currentRhId = rh.id;
          const sites = n.children
            .filter((c) => c.url)
            .map((c) => ({
              url: c.url,
              name: c.title || c.url,
              savedAt: Date.now(),
              faviconUrl: "",
              description: "Imported from bookmarks",
            }));
          await db.saveWebsites(sites);
          await db.addWebsitesToRabbitholeMeta(currentRhId, urls);
        }

        // Traverse children. We pass undefined so user's top-level folders become Rabbitholes.
        for (const child of n.children) {
          if (child.children) {
            await traverse(child, undefined);
          }
        }
      } else {
        // This is a user folder
        if (!parentRabbitholeId) {
          // It becomes a Rabbithole
          const rh = await db.createNewActiveRabbithole(n.title || "Folder");
          currentRhId = rh.id;

          const urls = n.children.filter((c) => c.url).map((c) => c.url);
          if (urls.length > 0) {
            const sites = n.children
              .filter((c) => c.url)
              .map((c) => ({
                url: c.url,
                name: c.title || c.url,
                savedAt: Date.now(),
                faviconUrl: "",
                description: "Imported from bookmarks",
              }));
            await db.saveWebsites(sites);
            await db.addWebsitesToRabbitholeMeta(currentRhId, urls);
          }

          // Its subfolders become Burrows
          for (const child of n.children) {
            if (child.children) {
              await traverse(child, currentRhId);
            }
          }
        } else {
          // It becomes a Burrow inside the parent Rabbithole
          const urls = n.children.filter((c) => c.url).map((c) => c.url);
          if (urls.length > 0) {
            const sites = n.children
              .filter((c) => c.url)
              .map((c) => ({
                url: c.url,
                name: c.title || c.url,
                savedAt: Date.now(),
                faviconUrl: "",
                description: "Imported from bookmarks",
              }));
            await db.saveWebsites(sites);

            const burrow = await db.createNewActiveBurrow(
              n.title || "Folder",
              urls,
            );
            await db.addBurrowsToRabbithole(parentRabbitholeId, [burrow.id]);
          }

          // Flatten subfolders: they also become Burrows in the SAME parent Rabbithole
          for (const child of n.children) {
            if (child.children) {
              await traverse(child, parentRabbitholeId);
            }
          }
        }
      }
    }

    await traverse(tree[0]);
  } else {
    Logger.warn("Bookmarks permission not available");
  }
}

export async function importTabGroupsFromBrowser(db: WebsiteStore) {
  const windows = await chrome.windows.getAll({ populate: true });
  let workspaceCounter = 1;

  for (const win of windows) {
    const rh = await db.createNewActiveRabbithole(
      `Imported workspace ${workspaceCounter++}`,
    );

    const tabs = win.tabs || [];
    const TAB_GROUP_ID_NONE = chrome.tabGroups
      ? chrome.tabGroups.TAB_GROUP_ID_NONE
      : -1;
    const ungroupedTabs = tabs.filter(
      (t) => t.groupId === TAB_GROUP_ID_NONE || t.groupId === undefined,
    );
    const groupedTabs = tabs.filter(
      (t) => t.groupId !== TAB_GROUP_ID_NONE && t.groupId !== undefined,
    );

    const ungroupedUrls = ungroupedTabs
      .filter((t) => t.url && !isNewtabPage(t.url))
      .map((t) => t.url);
    if (ungroupedUrls.length > 0) {
      const sites = ungroupedTabs
        .filter((t) => t.url && !isNewtabPage(t.url))
        .map((t) => ({
          url: t.url,
          name: t.title || t.url,
          savedAt: Date.now(),
          faviconUrl: t.favIconUrl || "",
          description: "Imported from workspace",
        }));
      await db.saveWebsites(sites);
      await db.addWebsitesToRabbitholeMeta(rh.id, ungroupedUrls);
    }

    const groups = new Set(groupedTabs.map((t) => t.groupId));
    for (const groupId of groups) {
      try {
        let groupTitle = `Group ${groupId}`;
        if (chrome.tabGroups) {
          const group = await chrome.tabGroups.get(groupId);
          if (group.title) {
            groupTitle = group.title;
          } else if (group.color) {
            groupTitle = `${
              group.color.charAt(0).toUpperCase() + group.color.slice(1)
            } Group`;
          } else {
            groupTitle = "Unnamed Group";
          }
        }

        const groupTabs = groupedTabs.filter(
          (t) => t.groupId === groupId && t.url && !isNewtabPage(t.url),
        );
        const urls = groupTabs.map((t) => t.url);

        if (urls.length > 0) {
          const sites = groupTabs.map((t) => ({
            url: t.url,
            name: t.title || t.url,
            savedAt: Date.now(),
            faviconUrl: t.favIconUrl || "",
            description: "Imported from tab group",
          }));
          await db.saveWebsites(sites);

          const burrow = await db.createNewActiveBurrow(groupTitle, urls);
          await db.addBurrowsToRabbithole(rh.id, [burrow.id]);
        }
      } catch (e) {
        Logger.warn("Failed to get tab group", e);
      }
    }
  }
}
