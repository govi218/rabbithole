import { writable } from "svelte/store";
import type { ATProtoSession } from "@rabbithole/shared/types";
import { recordOps } from "../atproto/client";

export interface PdsCollection {
  uri: string;
  name: string;
  urls: string[];
}

export interface PdsTrail {
  uri: string;
  cid: string;
  title: string;
  description: string;
  stops: { url: string; note: string }[];
}

export const collections = writable<PdsCollection[]>([]);
export const trails = writable<PdsTrail[]>([]);
export const isLoading = writable(false);

export async function loadUserData(session: ATProtoSession): Promise<void> {
  isLoading.set(true);
  try {
    const [collectionsRes, linksRes, cardsRes, trailsRes] = await Promise.all([
      recordOps.listRecords(session.did, "network.cosmik.collection"),
      recordOps.listRecords(session.did, "network.cosmik.collectionLink"),
      recordOps.listRecords(session.did, "network.cosmik.card"),
      recordOps.listRecords(session.did, "app.sidetrail.trail"),
    ]);

    // Build card map
    const cardMap = new Map<string, string>();
    for (const card of cardsRes.records) {
      const url = (card.value as any).url;
      if (url) cardMap.set(card.uri, url);
    }

    // Build collection → urls
    const collectionUrlMap = new Map<string, string[]>();
    for (const link of linksRes.records) {
      const collUri = (link.value as any).collection?.uri;
      const cardUri = (link.value as any).card?.uri;
      if (!collUri || !cardUri) continue;
      const url = cardMap.get(cardUri);
      if (!url) continue;
      if (!collectionUrlMap.has(collUri)) collectionUrlMap.set(collUri, []);
      collectionUrlMap.get(collUri)!.push(url);
    }

    collections.set(collectionsRes.records.map((r: { uri: string; cid: string; value: any }) => ({
      uri: r.uri,
      name: (r.value as any).name ?? "Untitled",
      urls: collectionUrlMap.get(r.uri) ?? [],
    })));

    trails.set(trailsRes.records.map((r: { uri: string; cid: string; value: any }) => {
      const v = r.value as any;
      return {
        uri: r.uri,
        cid: r.cid,
        title: v.title ?? "Untitled",
        description: v.description ?? "",
        stops: (v.stops ?? []).map((s: any) => ({ url: s.external?.uri ?? "", note: s.content ?? "" })).filter((s: any) => s.url),
      };
    }));
  } finally {
    isLoading.set(false);
  }
}
