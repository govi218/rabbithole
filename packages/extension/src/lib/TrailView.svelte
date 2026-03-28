<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { MessageRequest } from "src/utils";
  import type { Trail, Website } from "src/utils/types";
  import TimelineCard from "./TimelineCard.svelte";
  import Modal from "./Modal.svelte";
  import { TrailForm } from "@rabbithole/shared/lib";

  export let trail: Trail;
  export let initialEditMode = false;
  export let websites: Website[];

  const dispatch = createEventDispatcher();

  // Edit modal state
  let showEditModal = false;
  let editTitle = "";
  let editDesc = "";
  let editStops: { tid: string; title: string; url: string; note: string; buttonText: string }[] = [];
  let editSaving = false;
  let editError: string | null = null;

  function getWebsite(url: string) {
    return websites.find((w) => w.url === url);
  }

  function handleNoteBlur() {
    dispatch("save", { trail });
  }

  export async function startTrail() {
    // Start the trail walk directly and navigate to the first stop
    const walk = await chrome.runtime.sendMessage({
      type: MessageRequest.START_TRAIL_WALK,
      trailId: trail.id,
    });

    const firstStop = trail.stops?.[0];
    if (!firstStop) return;

    // Check if first stop is a concept stop (no URL)
    if (!firstStop.websiteUrl) {
      const trailPageUrl = chrome.runtime.getURL(
        `src/trail/trail.html?trailId=${trail.id}&concept=1`,
      );
      window.location.href = trailPageUrl;
    } else {
      // Navigate directly to the first URL - the modal will auto-show if there's a note
      window.location.href = firstStop.websiteUrl;
    }
  }

  export function toggleEdit() {
    if (showEditModal) {
      showEditModal = false;
    } else {
      openEditModal();
    }
  }

  export function getIsEditing() {
    return showEditModal;
  }

  function openEditModal() {
    editTitle = trail.name || "";
    editDesc = trail.startNote || "";
    editStops = (trail.stops || []).map((s) => ({
      tid: s.id || "",
      title: s.title || "",
      url: s.websiteUrl || "",
      note: s.note || "",
      buttonText: s.buttonText === "Next" ? "" : s.buttonText || "",
    }));
    if (editStops.length === 0) {
      editStops = [{ tid: "", title: "", url: "", note: "", buttonText: "" }];
    }
    editError = null;
    editSaving = false;
    showEditModal = true;
  }

  async function handleEditSave(e: CustomEvent<any>) {
    if (!trail) return;
    editSaving = true;
    editError = null;
    try {
      const { title, description, stops } = e.detail;
      await chrome.runtime.sendMessage({
        type: MessageRequest.UPDATE_TRAIL,
        trailId: trail.id,
        updates: {
          name: title,
          startNote: description,
          stops: stops.map((s: any, i: number) => ({
            id: s.tid || `stop-${i}`,
            websiteUrl: s.url.trim(),
            note: s.note.trim(),
            title: s.title.trim(),
            buttonText: s.buttonText.trim() || "Next",
          })),
        },
      });
      // Update local trail
      trail.name = title;
      trail.startNote = description;
      trail.stops = stops.map((s: any, i: number) => ({
        id: s.tid || `stop-${i}`,
        websiteUrl: s.url.trim(),
        note: s.note.trim(),
        title: s.title.trim(),
        buttonText: s.buttonText.trim() || "Next",
      }));
      showEditModal = false;
      dispatch("save", { trail });
    } catch (err: any) {
      editError = err.message || "Failed to save";
    } finally {
      editSaving = false;
    }
  }

  $: if (initialEditMode) openEditModal();
  $: startNoteEmpty = !trail.startNote || trail.startNote.trim() === "";
</script>

<!-- Edit Modal -->
{#if showEditModal}
  <Modal isOpen={true} title="Edit Trail" on:close={() => (showEditModal = false)}>
    <TrailForm
      bind:title={editTitle}
      bind:description={editDesc}
      bind:stops={editStops}
      isSaving={editSaving}
      error={editError}
      isEditing={true}
      on:save={handleEditSave}
      on:cancel={() => (showEditModal = false)}
    />
  </Modal>
{/if}

<div class="trail-header">
    <button class="edit-btn" on:click={openEditModal}>Edit Trail</button>
  </div>
  <div class="trail-nodes">
  <!-- Start note -->
  <div class="note-node" class:highlight-required={startNoteEmpty}>
    {#if startNoteEmpty}
      <div class="required-label">
        ✦ Add a starting note to begin your trail
      </div>
    {/if}
    <textarea
      class="note-input"
      placeholder="Starting note..."
      bind:value={trail.startNote}
      on:blur={handleNoteBlur}
      rows={2}
    ></textarea>
  </div>

  {#each trail.stops as stop, i}
    <div class="trail-edge"></div>
    <div class="website-node">
      {#if getWebsite(stop.websiteUrl)}
        <TimelineCard
          website={getWebsite(stop.websiteUrl)}
          showDelete={false}
        />
      {:else}
        <div class="missing-site">{stop.websiteUrl}</div>
      {/if}
    </div>
    <div class="trail-edge"></div>
    <div class="note-node">
      <textarea
        class="note-input"
        placeholder="Add a note before the next stop..."
        bind:value={stop.note}
        on:blur={handleNoteBlur}
        rows={2}
      ></textarea>
    </div>
  {/each}

  <!-- End note -->
  <div class="trail-edge"></div>
  <div class="note-node end-note-node">
    <div class="end-note-label">🏁 Completion message</div>
    <textarea
      class="note-input"
      placeholder="Add a completion message..."
      bind:value={trail.endNote}
      on:blur={handleNoteBlur}
      rows={2}
    ></textarea>
  </div>
</div>

<style>
  .trail-header {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
  }
  .edit-btn {
    padding: 8px 16px;
    background: rgba(17, 133, 254, 0.1);
    border: 1px solid rgba(17, 133, 254, 0.3);
    border-radius: 8px;
    color: #1185fe;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .edit-btn:hover {
    background: rgba(17, 133, 254, 0.2);
    border-color: #1185fe;
  }
  .trail-nodes {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding-bottom: 64px;
  }

  .note-node {
    width: 100%;
    background: #f8f9fa;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    padding: 12px 16px;
    transition: all 0.2s;
  }

  .note-node:focus-within {
    border-color: #1185fe;
    background: rgba(17, 133, 254, 0.03);
    box-shadow: 0 0 0 2px rgba(17, 133, 254, 0.1);
  }

  .note-node.highlight-required {
    border: 2px dashed #f59f00;
    background: rgba(245, 159, 0, 0.07);
    animation: pulse-border 1.8s ease-in-out infinite;
  }

  @keyframes pulse-border {
    0% {
      box-shadow: 0 0 0 0 rgba(245, 159, 0, 0.35);
    }
    50% {
      box-shadow: 0 0 0 6px rgba(245, 159, 0, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(245, 159, 0, 0);
    }
  }

  .required-label {
    font-size: 11px;
    font-weight: 700;
    color: #f59f00;
    letter-spacing: 0.02em;
    margin-bottom: 6px;
    text-transform: uppercase;
    text-align: center;
  }

  .note-input {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    font-size: 14px;
    line-height: 1.5;
    color: #495057;
    font-family: inherit;
    box-sizing: border-box;
    padding: 0;
    text-align: center;
  }

  .note-input::placeholder {
    color: #adb5bd;
    text-align: center;
  }

  /* End note */
  .end-note-node {
    border-style: dashed;
    border-color: rgba(64, 192, 87, 0.4);
    background: rgba(64, 192, 87, 0.04);
  }

  .end-note-node:focus-within {
    border-color: #40c057;
    border-style: solid;
    background: rgba(64, 192, 87, 0.07);
    box-shadow: 0 0 0 2px rgba(64, 192, 87, 0.12);
  }

  .end-note-label {
    font-size: 11px;
    font-weight: 700;
    color: #40c057;
    letter-spacing: 0.02em;
    margin-bottom: 6px;
    text-transform: uppercase;
    text-align: center;
  }

  .trail-edge {
    width: 2px;
    height: 32px;
    background: rgba(0, 0, 0, 0.12);
    margin: 8px 0;
  }

  .website-node {
    width: 100%;
  }

  .missing-site {
    padding: 24px;
    text-align: center;
    background: #fff5f5;
    color: #e03131;
    border-radius: 12px;
    border: 1px solid rgba(224, 49, 49, 0.2);
  }

  /* Dark mode */
  :global(body.dark-mode) .note-node {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.12);
  }
  :global(body.dark-mode) .note-node:focus-within {
    border-color: #4dabf7;
    background: rgba(77, 171, 247, 0.05);
    box-shadow: 0 0 0 2px rgba(77, 171, 247, 0.12);
  }
  :global(body.dark-mode) .note-node.highlight-required {
    border-color: #fab005;
    background: rgba(250, 176, 5, 0.07);
  }
  :global(body.dark-mode) .required-label {
    color: #fab005;
  }
  :global(body.dark-mode) .note-input {
    color: #c1c2c5;
  }
  :global(body.dark-mode) .note-input::placeholder {
    color: #5c5f66;
  }
  :global(body.dark-mode) .end-note-node {
    border-color: rgba(64, 192, 87, 0.3);
    background: rgba(64, 192, 87, 0.04);
  }
  :global(body.dark-mode) .end-note-node:focus-within {
    border-color: #51cf66;
    border-style: solid;
    background: rgba(81, 207, 102, 0.07);
    box-shadow: 0 0 0 2px rgba(81, 207, 102, 0.12);
  }
  :global(body.dark-mode) .end-note-label {
    color: #51cf66;
  }
  :global(body.dark-mode) .trail-edge {
    background: rgba(255, 255, 255, 0.14);
  }
  :global(body.dark-mode) .missing-site {
    background: rgba(224, 49, 49, 0.1);
    border-color: rgba(224, 49, 49, 0.2);
    color: #ff8787;
  }
</style>
