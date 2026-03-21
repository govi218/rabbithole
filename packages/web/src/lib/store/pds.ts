import { writable } from "svelte/store";
import type { ATProtoSession } from "@rabbithole/shared/types";
import { recordOps } from "../atproto/client";
import { resolvePds } from "@rabbithole/shared/atproto/explore";

export interface PdsCollectionCard {
  url: string;
  cardUri: string;
  linkUri: string;
}

export interface PdsCollection {
  uri: string;
  cid: string;
  name: string;
  urls: string[];
  cards: PdsCollectionCard[];
}

export interface PdsTrail {
  uri: string;
  cid: string;
  title: string;
  description: string;
  stops: {
    tid: string;
    title: string;
    url: string;
    note: string;
    buttonText: string;
  }[];
}

export interface PdsWalk {
  uri: string;
  cid: string;
  trailUri: string;
  trailTitle: string;
  visitedTids: string[];
}

export interface PdsCompletion {
  uri: string;
  trailUri: string;
  trailTitle: string;
  createdAt: string;
}

export const collections = writable<PdsCollection[]>([]);
export const trails = writable<PdsTrail[]>([]);
export const walks = writable<PdsWalk[]>([]);
export const completions = writable<PdsCompletion[]>([]);
export const isLoading = writable(false);

export async function loadUserData(session: ATProtoSession): Promise<void> {
  isLoading.set(true);
  try {
    const [
      collectionsRes,
      linksRes,
      cardsRes,
      trailsRes,
      walksRes,
      completionsRes,
    ] = await Promise.all([
      recordOps.listRecords(session.did, "network.cosmik.collection"),
      recordOps.listRecords(session.did, "network.cosmik.collectionLink"),
      recordOps.listRecords(session.did, "network.cosmik.card"),
      recordOps.listRecords(session.did, "app.sidetrail.trail"),
      recordOps.listRecords(session.did, "app.sidetrail.walk"),
      recordOps.listRecords(session.did, "app.sidetrail.completion"),
    ]);

    // Build card map: uri → { url }
    const cardMap = new Map<string, string>();
    for (const card of cardsRes.records) {
      const url = (card.value as any).content?.url;
      if (url) cardMap.set(card.uri, url);
    }

    // Build collection → cards (with full URIs for add/remove)
    const collectionCards = new Map<string, PdsCollectionCard[]>();
    for (const link of linksRes.records) {
      const collUri = (link.value as any).collection?.uri;
      const cardUri = (link.value as any).card?.uri;
      if (!collUri || !cardUri) continue;
      const url = cardMap.get(cardUri);
      if (!url) continue;
      if (!collectionCards.has(collUri)) collectionCards.set(collUri, []);
      collectionCards.get(collUri)!.push({ url, cardUri, linkUri: link.uri });
    }

    collections.set(
      collectionsRes.records.map(
        (r: { uri: string; cid: string; value: any }) => {
          const cards = collectionCards.get(r.uri) ?? [];
          return {
            uri: r.uri,
            cid: r.cid,
            name: (r.value as any).name ?? "Untitled",
            urls: cards.map((c) => c.url),
            cards,
          };
        },
      ),
    );

    // Build own trail title map for fast lookup
    const ownTrailTitles = new Map<string, string>();
    for (const r of trailsRes.records) {
      ownTrailTitles.set(r.uri, (r.value as any).title ?? "Untitled");
    }

    async function resolveTrailTitle(trailUri: string): Promise<string> {
      const own = ownTrailTitles.get(trailUri);
      if (own) return own;
      try {
        const match = trailUri.match(/^at:\/\/(did:[^/]+)\/[^/]+\/([^/]+)$/);
        if (match) {
          const [, did, rkey] = match;
          const pdsUrl = await resolvePds(did);
          const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.getRecord`);
          url.searchParams.set("repo", did);
          url.searchParams.set("collection", "app.sidetrail.trail");
          url.searchParams.set("rkey", rkey);
          const res = await fetch(url.toString());
          if (res.ok) return (await res.json()).value?.title ?? "Untitled";
        }
      } catch {}
      return "Untitled";
    }

    // Deduplicate walks by trailUri (ATProto returns newest first), keep most recent per trail
    const seenTrailUris = new Set<string>();
    const walkRecords = (
      walksRes.records as { uri: string; cid: string; value: any }[]
    ).filter((r) => {
      const trailUri = r.value?.trail?.uri ?? "";
      if (seenTrailUris.has(trailUri)) return false;
      seenTrailUris.add(trailUri);
      return true;
    });
    const resolvedWalks = await Promise.all(
      walkRecords.map(async (r) => {
        const trailUri: string = r.value?.trail?.uri ?? "";
        return {
          uri: r.uri,
          cid: r.cid,
          trailUri,
          trailTitle: await resolveTrailTitle(trailUri),
          visitedTids: r.value?.visitedStops ?? [],
        };
      }),
    );
    walks.set(resolvedWalks);

    // Deduplicate completions by trailUri, keep most recent
    const seenCompletionUris = new Set<string>();
    const completionRecords = (
      completionsRes.records as { uri: string; cid: string; value: any }[]
    ).filter((r) => {
      const trailUri = r.value?.trail?.uri ?? "";
      if (seenCompletionUris.has(trailUri)) return false;
      seenCompletionUris.add(trailUri);
      return true;
    });
    const resolvedCompletions = await Promise.all(
      completionRecords.map(async (r) => {
        const trailUri: string = r.value?.trail?.uri ?? "";
        return {
          uri: r.uri,
          trailUri,
          trailTitle: await resolveTrailTitle(trailUri),
          createdAt: r.value?.createdAt ?? "",
        };
      }),
    );
    completions.set(resolvedCompletions);

    trails.set(
      trailsRes.records.map((r: { uri: string; cid: string; value: any }) => {
        const v = r.value as any;
        return {
          uri: r.uri,
          cid: r.cid,
          title: v.title ?? "Untitled",
          description: v.description ?? "",
          stops: (v.stops ?? []).map((s: any, i: number) => ({
            tid: s.tid ?? `stop-${i}`,
            title: s.title ?? "",
            url: s.external?.uri ?? "",
            note: s.content ?? "",
            buttonText: s.buttonText || "Next",
          })),
        };
      }),
    );
  } finally {
    isLoading.set(false);
  }
}
