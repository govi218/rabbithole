import { createRecord, listRecords, deleteRecord, putRecord } from "./client";
import type { Website } from "../utils/types";

export interface CosmikRef {
  uri: string;
  cid: string;
}

export async function createCollection(
  did: string,
  name: string,
): Promise<CosmikRef> {
  const collectionRecord = {
    name: name,
    accessType: "CLOSED",
    $type: "network.cosmik.collection",
  };

  return await createRecord(did, "network.cosmik.collection", collectionRecord);
}

export async function createUrlCard(
  did: string,
  site: any,
): Promise<CosmikRef> {
  const metadata = {
    $type: "network.cosmik.card#urlMetadata",
    title: site.name,
    description: site.description || undefined,
    imageUrl:
      site.openGraphImageUrl && site.openGraphImageUrl.startsWith("http")
        ? site.openGraphImageUrl
        : undefined,
    retrievedAt: new Date(site.savedAt).toISOString(),
  };

  const cardRecord = {
    type: "URL",
    $type: "network.cosmik.card",
    url: site.url,
    content: {
      $type: "network.cosmik.card#urlContent",
      url: site.url,
      metadata: metadata,
    },
  };

  return await createRecord(did, "network.cosmik.card", cardRecord);
}

export async function createCollectionLink(
  did: string,
  collection: CosmikRef,
  card: CosmikRef,
): Promise<CosmikRef> {
  const linkRecord = {
    $type: "network.cosmik.collectionLink",
    collection: {
      uri: collection.uri,
      cid: collection.cid,
    },
    card: {
      uri: card.uri,
      cid: card.cid,
    },
    addedBy: did,
    addedAt: new Date().toISOString(),
  };

  return await createRecord(did, "network.cosmik.collectionLink", linkRecord);
}

export async function getCollectionCid(
  did: string,
  collectionUri: string,
): Promise<string> {
  const res = await listRecords(did, "network.cosmik.collection");
  const coll = res.records.find((r) => r.uri === collectionUri);
  if (coll) return coll.cid;
  throw new Error("Collection not found");
}

export async function syncBurrowToCollection(
  did: string,
  collectionUri: string,
  websites: Website[],
) {
  // 1. Get all links and cards
  const linksRes = await listRecords(did, "network.cosmik.collectionLink");
  const cardsRes = await listRecords(did, "network.cosmik.card");

  const links = linksRes.records.filter(
    (r: any) => r.value.collection.uri === collectionUri,
  );

  // Store full record including CID for swapRecord usage
  const cards = new Map(
    cardsRes.records.map((r: any) => [
      r.uri,
      { ...r.value, rkey: r.uri.split("/").pop(), cid: r.cid },
    ]),
  );

  // Map of URL -> { linkRkey, cardRkey, cardCid, cardRecord }
  const remoteItems = new Map();

  for (const link of links) {
    const cardUri = link.value.card.uri;
    const card = cards.get(cardUri);
    if (card && card.url) {
      remoteItems.set(card.url, {
        linkRkey: link.uri.split("/").pop(),
        cardRkey: card.rkey,
        cardCid: card.cid,
        cardRecord: card,
        linkRecord: link.value,
      });
    }
  }

  // Get collection CID for new links
  const collectionCid = await getCollectionCid(did, collectionUri);

  // 2. Iterate local websites
  for (const site of websites) {
    const remote = remoteItems.get(site.url);

    if (remote) {
      // Update if changed
      const card = remote.cardRecord;
      const metadata = card.content?.metadata;

      const needsUpdate =
        metadata?.title !== site.name ||
        metadata?.description !== (site.description || undefined);

      if (needsUpdate) {
        const updatedCard = {
          $type: "network.cosmik.card",
          type: "URL",
          url: card.url,
          content: {
            $type: "network.cosmik.card#urlContent",
            url: card.url,
            metadata: {
              $type: "network.cosmik.card#urlMetadata",
              title: site.name,
              description: site.description || undefined,
              imageUrl: metadata?.imageUrl,
              retrievedAt: metadata?.retrievedAt,
            },
          },
        };

        await putRecord(
          did,
          "network.cosmik.card",
          remote.cardRkey,
          updatedCard,
          remote.cardCid,
        );
      }

      // Remove from remoteItems map so we know it's handled
      remoteItems.delete(site.url);
    } else {
      // Create new
      const cardRef = await createUrlCard(did, site);
      await createCollectionLink(
        did,
        { uri: collectionUri, cid: collectionCid },
        cardRef,
      );
    }
  }

  // 3. Delete remaining remote items
  for (const [url, remote] of remoteItems) {
    await deleteRecord(did, "network.cosmik.collectionLink", remote.linkRkey);
    await deleteRecord(did, "network.cosmik.card", remote.cardRkey);
  }
}
