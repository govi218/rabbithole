import { recordOps } from "./client";

export async function addCardToBurrow(
  did: string,
  collectionUri: string,
  collectionCid: string,
  url: string,
): Promise<void> {
  const card = await recordOps.createRecord(did, "network.cosmik.card", {
    $type: "network.cosmik.card",
    type: "URL",
    url,
    content: {
      $type: "network.cosmik.card#urlContent",
      url,
    },
  });
  await recordOps.createRecord(did, "network.cosmik.collectionLink", {
    $type: "network.cosmik.collectionLink",
    collection: { uri: collectionUri, cid: collectionCid },
    card: { uri: card.uri, cid: card.cid },
    addedBy: did,
    addedAt: new Date().toISOString(),
  });
}

export async function removeCardFromBurrow(
  did: string,
  cardUri: string,
  linkUri: string,
): Promise<void> {
  const cardRkey = cardUri.split("/").pop()!;
  const linkRkey = linkUri.split("/").pop()!;
  await recordOps.deleteRecord(did, "network.cosmik.collectionLink", linkRkey);
  await recordOps.deleteRecord(did, "network.cosmik.card", cardRkey);
}
