<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import {
    resolveHandle,
    fetchCollectionByUri,
  } from "@rabbithole/shared/atproto/explore";
  import type { ActorCollection } from "@rabbithole/shared/atproto/explore";
  import LinkCard from "@rabbithole/shared/lib/LinkCard.svelte";
  import { getSession, recordOps } from "$lib/atproto/client";
  import { addCardToBurrow, removeCardFromBurrow } from "$lib/atproto/cosmik";
  import type { ATProtoSession } from "@rabbithole/shared/types";

  let session: ATProtoSession | null = null;
  let burrow: ActorCollection | null = null;
  let isLoading = true;
  let loadError: string | null = null;

  // edit state
  let showEdit = false;
  let editName = "";
  let editUrls: string[] = [""];
  let editCards: { url: string; cardUri: string; linkUri: string }[] = [];
  let isSaving = false;
  let saveError: string | null = null;
  let isDeleting = false;
  let showConfirmDelete = false;
  let deleteError: string | null = null;

  $: ownerDid = burrow?.uri.split("/")[2] ?? null;
  $: isOwner = !!(session && ownerDid && session.did === ownerDid);

  async function openEdit() {
    if (!session || !burrow) return;
    editName = burrow.name;
    saveError = null;
    const [linksRes, cardsRes] = await Promise.all([
      recordOps.listRecords(session.did, "network.cosmik.collectionLink"),
      recordOps.listRecords(session.did, "network.cosmik.card"),
    ]);
    const cardMap = new Map<string, string>();
    for (const card of cardsRes.records) {
      const url = (card.value as any).content?.url;
      if (url) cardMap.set(card.uri, url);
    }
    editCards = [];
    for (const link of linksRes.records) {
      const collUri = (link.value as any).collection?.uri;
      const cardUri = (link.value as any).card?.uri;
      if (collUri !== burrow.uri || !cardUri) continue;
      const url = cardMap.get(cardUri);
      if (!url) continue;
      editCards.push({ url, cardUri, linkUri: link.uri });
    }
    editUrls = editCards.length ? editCards.map((c) => c.url) : [""];
    showEdit = true;
  }

  function addEditUrl() {
    editUrls = [...editUrls, ""];
  }
  function removeEditUrl(i: number) {
    editUrls = editUrls.filter((_, idx) => idx !== i);
  }

  async function saveEdit() {
    if (!session || !burrow || !editName.trim()) return;
    isSaving = true;
    saveError = null;
    try {
      const newUrls = editUrls.map((u) => u.trim()).filter(Boolean);
      const rkey = burrow.uri.split("/").pop()!;

      let collectionCid = burrow.cid;
      if (editName.trim() !== burrow.name) {
        const updated = await recordOps.putRecord(
          session.did,
          "network.cosmik.collection",
          rkey,
          { $type: "network.cosmik.collection", name: editName.trim(), accessType: "CLOSED" },
        );
        collectionCid = updated.cid;
      }

      const existing = new Map(editCards.map((c) => [c.url, c]));
      const toRemove = editCards.filter((c) => !newUrls.includes(c.url));
      const toAdd = newUrls.filter((u) => !existing.has(u));

      await Promise.all(
        toRemove.map((c) => removeCardFromBurrow(session!.did, c.cardUri, c.linkUri)),
      );
      for (const url of toAdd) {
        await addCardToBurrow(session.did, burrow.uri, collectionCid, url);
      }

      const did = await resolveHandle($page.params.did);
      burrow = await fetchCollectionByUri(
        `at://${did}/network.cosmik.collection/${$page.params.rkey}`,
      );
      showEdit = false;
    } catch (e: any) {
      saveError = e.message;
    } finally {
      isSaving = false;
    }
  }

  async function deleteBurrow() {
    if (!session || !burrow) return;
    isDeleting = true;
    deleteError = null;
    try {
      const [linksRes, cardsRes] = await Promise.all([
        recordOps.listRecords(session.did, "network.cosmik.collectionLink"),
        recordOps.listRecords(session.did, "network.cosmik.card"),
      ]);
      const burrowLinks = linksRes.records.filter(
        (r: any) => r.value?.collection?.uri === burrow!.uri,
      );
      const burrowCardUris = new Set(
        burrowLinks.map((r: any) => r.value?.card?.uri),
      );
      await Promise.all(
        burrowLinks.map((r: any) =>
          recordOps.deleteRecord(
            session!.did,
            "network.cosmik.collectionLink",
            r.uri.split("/").pop()!,
          ),
        ),
      );
      await Promise.all(
        cardsRes.records
          .filter((r: any) => burrowCardUris.has(r.uri))
          .map((r: any) =>
            recordOps.deleteRecord(
              session!.did,
              "network.cosmik.card",
              r.uri.split("/").pop()!,
            ),
          ),
      );
      const rkey = burrow.uri.split("/").pop()!;
      await recordOps.deleteRecord(session.did, "network.cosmik.collection", rkey);
      goto("/home");
    } catch (e: any) {
      deleteError = e.message ?? "Failed to delete burrow.";
    } finally {
      isDeleting = false;
    }
  }

  onMount(async () => {
    session = getSession();
    try {
      const did = await resolveHandle($page.params.did);
      burrow = await fetchCollectionByUri(
        `at://${did}/network.cosmik.collection/${$page.params.rkey}`,
      );
      if (!burrow) {
        loadError = "Burrow not found.";
        return;
      }
    } catch (e: any) {
      loadError = e.message ?? "Failed to load burrow.";
    } finally {
      isLoading = false;
    }
  });
</script>

<svelte:head>
  <title>{burrow ? `${burrow.name} — Rabbithole` : "Burrow — Rabbithole"}</title>
</svelte:head>

<main class="page">
  {#if isLoading}
    <p class="status">Loading burrow...</p>
  {:else if loadError}
    <p class="error">{loadError}</p>
    <a href="/explore" class="back-link">← Back to Explore</a>
  {:else if burrow}
    <a href="/explore" class="back-link">← Explore</a>

    <div class="burrow-hero">
      <h1>{burrow.name}</h1>
      <div class="burrow-stats">
        <span class="url-count"
          >{burrow.cards.length} link{burrow.cards.length !== 1 ? "s" : ""}</span
        >
      </div>
      {#if isOwner}
        <div class="owner-actions">
          <button class="edit-btn" on:click={openEdit}>Edit ✎</button>
          <button class="delete-btn" on:click={() => (showConfirmDelete = true)}>
            Delete
          </button>
        </div>
      {/if}
    </div>

    <a
      href="https://chromewebstore.google.com/detail/rabbithole/nbklhnbdhfhbcojfbhncgkdlppbkiaec"
      class="ext-cta"
      target="_blank"
      rel="noopener noreferrer"
    >
      🐇 Get the Rabbithole extension for the best experience
    </a>

    {#if burrow.cards.length === 0}
      <p class="empty">No links in this burrow.</p>
    {:else}
      <div class="cards-grid">
        {#each burrow.cards as card}
          <LinkCard
            url={card.url}
            title={card.title ?? null}
            description={card.description ?? null}
            image={card.image ?? null}
          />
        {/each}
      </div>
    {/if}
  {/if}
</main>

{#if showEdit}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click|self={() => (showEdit = false)}>
    <div class="modal">
      <h2>Edit Burrow</h2>
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" placeholder="My burrow" bind:value={editName} />
      </div>
      <div class="form-group">
        <label class="form-label">Links</label>
        {#each editUrls as _, i}
          <div class="url-row">
            <input
              class="form-input"
              placeholder="https://..."
              bind:value={editUrls[i]}
            />
            {#if editUrls.length > 1}
              <button class="remove-btn" on:click={() => removeEditUrl(i)} title="Remove">✕</button>
            {/if}
          </div>
        {/each}
        <button class="add-btn" on:click={addEditUrl}>+ Add link</button>
      </div>
      {#if saveError}<p class="save-error">{saveError}</p>{/if}
      <div class="modal-actions">
        <button class="ghost-btn" on:click={() => (showEdit = false)}>Cancel</button>
        <button
          class="primary-btn"
          on:click={saveEdit}
          disabled={isSaving || !editName.trim()}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showConfirmDelete}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click|self={() => (showConfirmDelete = false)}>
    <div class="modal confirm-modal">
      <h2>Delete burrow?</h2>
      <p class="confirm-body">This will permanently delete <strong>{burrow?.name}</strong> and all its links. This cannot be undone.</p>
      {#if deleteError}<p class="save-error">{deleteError}</p>{/if}
      <div class="modal-actions">
        <button class="ghost-btn" on:click={() => (showConfirmDelete = false)} disabled={isDeleting}>Cancel</button>
        <button class="danger-btn" on:click={deleteBurrow} disabled={isDeleting}>
          {isDeleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 860px;
    margin: 80px auto 80px;
    padding: 0 24px;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status {
    color: #868e96;
    font-size: 14px;
  }
  .error {
    color: #ff6b6b;
    font-size: 13px;
    margin: 0;
  }
  .empty {
    color: #868e96;
    font-size: 14px;
    margin: 0;
  }

  .back-link {
    color: #4dabf7;
    font-size: 13px;
    text-decoration: none;
    align-self: flex-start;
  }
  .back-link:hover {
    text-decoration: underline;
  }

  .burrow-hero {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 28px 0 8px;
  }
  h1 {
    font-size: 2rem;
    font-weight: 900;
    margin: 0;
    color: #e7e7e7;
    line-height: 1.15;
  }

  .burrow-stats {
    display: flex;
    gap: 8px;
  }
  .url-count {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(77, 171, 247, 0.1);
    color: #4dabf7;
    border: 1px solid rgba(77, 171, 247, 0.25);
  }

  .owner-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .edit-btn {
    padding: 9px 16px;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    color: #909296;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }
  .edit-btn:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #c1c2c5;
  }

  .delete-btn {
    padding: 9px 16px;
    background: none;
    border: 1px solid rgba(255, 107, 107, 0.25);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    color: #ff6b6b;
    font-family: inherit;
    transition: border-color 0.15s, background 0.15s;
  }
  .delete-btn:hover {
    background: rgba(255, 107, 107, 0.08);
    border-color: rgba(255, 107, 107, 0.5);
  }
  .delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ext-cta {
    display: inline-block;
    align-self: flex-start;
    font-size: 12px;
    color: #868e96;
    text-decoration: none;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px 12px;
    transition:
      color 0.15s,
      border-color 0.15s;
  }
  .ext-cta:hover {
    color: #c1c2c5;
    border-color: rgba(255, 255, 255, 0.18);
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
    margin-top: 8px;
  }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
  }
  .modal {
    background: #1a1b1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 32px;
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal h2 {
    font-size: 20px;
    font-weight: 900;
    margin: 0;
    color: #e7e7e7;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .form-label {
    font-size: 12px;
    font-weight: 700;
    color: #868e96;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .form-input {
    padding: 10px 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    font-size: 14px;
    outline: none;
    background: #25262b;
    color: #e7e7e7;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input::placeholder {
    color: #5c5f66;
  }
  .form-input:focus {
    border-color: #4dabf7;
  }
  .url-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .remove-btn {
    background: none;
    border: none;
    color: #5c5f66;
    cursor: pointer;
    font-size: 14px;
    padding: 4px 6px;
    border-radius: 6px;
    flex-shrink: 0;
    font-family: inherit;
    transition: color 0.15s;
  }
  .remove-btn:hover {
    color: #ff6b6b;
  }
  .add-btn {
    background: none;
    border: 1px dashed rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 8px;
    color: #868e96;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }
  .add-btn:hover {
    border-color: #4dabf7;
    color: #4dabf7;
  }
  .save-error {
    color: #ff6b6b;
    font-size: 13px;
    margin: 0;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .primary-btn {
    padding: 10px 20px;
    background: #1185fe;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .primary-btn:hover {
    background: #0070e0;
  }
  .primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .ghost-btn {
    padding: 10px 20px;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    color: #909296;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }
  .ghost-btn:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #c1c2c5;
  }

  .confirm-modal {
    max-width: 400px;
  }
  .confirm-body {
    font-size: 14px;
    color: #909296;
    margin: 0;
    line-height: 1.6;
  }
  .confirm-body strong {
    color: #e7e7e7;
  }
  .danger-btn {
    padding: 10px 20px;
    background: #e03131;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .danger-btn:hover {
    background: #c92a2a;
  }
  .danger-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
