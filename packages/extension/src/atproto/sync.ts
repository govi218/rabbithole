import { listRecords } from "./client";
import type { WebsiteStore } from "../storage/db";
import type { Website } from "../utils/types";
import { Logger } from "../utils";

const SIDETRAILS_RH_TITLE = "Sidetrails";
const SEMBLE_RH_TITLE = "Semble Collections";

async function getOrCreateRabbithole(db: WebsiteStore, title: string) {
  const all = await db.getAllRabbitholes();
  const existing = all.find((r) => r.title === title);
  if (existing) return existing;
  return db.createRabbithole(title);
}

async function importSidetrailTrails(
  did: string,
  db: WebsiteStore,
): Promise<{ count: number; names: string[] }> {
  const res = await listRecords(did, "app.sidetrail.trail");
  if (!res.records.length) return { count: 0, names: [] };

  const localTrails = await db.getAllTrails();
  const publishedUris = new Set(
    localTrails.map((t) => t.sidetrailUri).filter(Boolean),
  );

  const missing = res.records.filter((r) => !publishedUris.has(r.uri));
  if (!missing.length) return { count: 0, names: [] };

  const rh = await getOrCreateRabbithole(db, SIDETRAILS_RH_TITLE);

  const names: string[] = [];
  for (const record of missing) {
    const value = record.value as any;
    const title = value.title ?? "Imported Trail";
    names.push(title);

    const remoteStops: any[] = value.stops ?? [];
    const urls = remoteStops
      .map((s: any) => s.external?.uri)
      .filter(Boolean) as string[];

    const stubs: Website[] = urls.map((url) => ({
      url,
      name: url,
      savedAt: Date.now(),
      faviconUrl: "",
    }));

    await db.saveWebsiteStubs(stubs);
    if (urls.length) await db.addWebsitesToRabbitholeMeta(rh.id, urls);

    // Build TrailStops with full metadata from remote
    const trailStops = remoteStops.map((s: any, i: number) => ({
      tid: s.tid || `stop-${i}`,
      title: s.title || "",
      websiteUrl: s.external?.uri || "",
      note: s.content || "",
      buttonText: s.buttonText || "Next",
    }));

    const trail = await db.createTrail(
      rh.id,
      value.title ?? "Imported Trail",
      trailStops,
    );

    await db.updateTrail(trail.id, {
      description: value.description ?? "",
      startNote: value.description ?? "",
      sidetrailUri: record.uri,
      sidetrailCid: record.cid,
    });

    Logger.info(`Imported sidetrail: ${value.title}`);
  }

  return { count: missing.length, names };
}

async function importSembleCollections(
  did: string,
  db: WebsiteStore,
): Promise<{ count: number; names: string[] }> {
  const [collectionsRes, linksRes, cardsRes] = await Promise.all([
    listRecords(did, "network.cosmik.collection"),
    listRecords(did, "network.cosmik.collectionLink"),
    listRecords(did, "network.cosmik.card"),
  ]);

  if (!collectionsRes.records.length) return { count: 0, names: [] };

  const localBurrows = await db.getAllBurrows();
  const publishedUris = new Set(
    localBurrows.map((b) => b.sembleCollectionUri).filter(Boolean),
  );

  const missing = collectionsRes.records.filter(
    (r) => !publishedUris.has(r.uri),
  );
  if (!missing.length) return { count: 0, names: [] };

  // card URI → { url, name }
  const cardMap = new Map<string, { url: string; name: string }>();
  for (const card of cardsRes.records) {
    const url = (card.value as any).url as string | undefined;
    if (!url) continue;
    const name = (card.value as any).content?.metadata?.title ?? url;
    cardMap.set(card.uri, { url, name });
  }

  // collection URI → items[]
  const collectionItems = new Map<string, { url: string; name: string }[]>();
  for (const link of linksRes.records) {
    const collUri = (link.value as any).collection?.uri as string | undefined;
    const cardUri = (link.value as any).card?.uri as string | undefined;
    if (!collUri || !cardUri) continue;
    const card = cardMap.get(cardUri);
    if (!card) continue;
    if (!collectionItems.has(collUri)) collectionItems.set(collUri, []);
    collectionItems.get(collUri)!.push(card);
  }

  const rh = await getOrCreateRabbithole(db, SEMBLE_RH_TITLE);

  const names: string[] = [];
  
  for (const record of missing) {
    const value = record.value as any;
    const name = value.name ?? "Imported Collection";
    names.push(name);

    const items = collectionItems.get(record.uri) ?? [];
    const urls = items.map((i) => i.url);

    const stubs: Website[] = items.map(({ url, name }) => ({
      url,
      name,
      savedAt: Date.now(),
      faviconUrl: "",
    }));

    await db.saveWebsiteStubs(stubs);
    if (urls.length) await db.addWebsitesToRabbitholeMeta(rh.id, urls);

    await db.createBurrow(
      rh.id,
      value.name ?? "Imported Collection",
      record.uri,
      urls,
    );

    Logger.info(`Imported Semble collection: ${value.name}`);
  }

  return { count: missing.length, names };
}

export async function syncFromAtproto(
  did: string,
  db: WebsiteStore,
): Promise<{ trails: { count: number; names: string[] }; burrows: { count: number; names: string[] } }> {
  const [trails, collections] = await Promise.all([
    importSidetrailTrails(did, db).catch(() => {
      Logger.warn("Sidetrail import failed:", err);
      return { count: 0, names: [] };
    }),
    importSembleCollections(did, db).catch(() => {
      Logger.warn("Semble import failed:", err);
      return { count: 0, names: [] };
    }),
  ]);
  return { trails, burrows: collections };
}
