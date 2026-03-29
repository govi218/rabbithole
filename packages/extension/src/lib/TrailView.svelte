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

<div class="trail-nodes">
  <!-- Start note -->
  {#if trail.startNote}
    <div class="note-node">
      <div class="note-label">Start</div>
      <div class="note-text">{trail.startNote}</div>
    </div>
  {/if}

  {#each trail.stops as stop, i}
    {#if trail.startNote || i > 0}
      <div class="trail-edge"></div>
    {/if}
    <div class="stop-block">
      {#if stop.title}
        <div class="stop-title">{stop.title}</div>
      {/if}
      <div class="website-node">
        {#if getWebsite(stop.websiteUrl)}
          <TimelineCard
            website={getWebsite(stop.websiteUrl)}
            showDelete={false}
          />
        {:else if stop.websiteUrl}
          <div class="missing-site">{stop.websiteUrl}</div>
        {:else}
          <div class="concept-stop">
            <span class="concept-icon">💡</span>
            <span class="concept-label">Concept</span>
          </div>
        {/if}
      </div>
      {#if stop.note}
        <div class="stop-note">{stop.note}</div>
      {/if}
    </div>
  {/each}

  <!-- End note -->
  {#if trail.endNote}
    <div class="trail-edge"></div>
    <div class="note-node end-note">
      <div class="note-label">🏁 Finish</div>
      <div class="note-text">{trail.endNote}</div>
    </div>
  {/if}
</div>

<style>
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
  }

  .note-label {
    font-size: 11px;
    font-weight: 700;
    color: #868e96;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  .note-text {
    font-size: 14px;
    color: #495057;
    line-height: 1.5;
  }

  .stop-block {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .stop-title {
    font-size: 13px;
    font-weight: 600;
    color: #1185fe;
    background: rgba(17, 133, 254, 0.1);
    padding: 4px 12px;
    border-radius: 6px;
  }

  .website-node {
    width: 100%;
  }

  .stop-note {
    font-size: 13px;
    color: #868e96;
    font-style: italic;
    text-align: center;
    max-width: 80%;
  }

  .trail-edge {
    width: 2px;
    height: 24px;
    background: rgba(0, 0, 0, 0.12);
    margin: 4px 0;
  }

  .missing-site {
    padding: 16px;
    text-align: center;
    background: #fff5f5;
    color: #e03131;
    border-radius: 12px;
    border: 1px solid rgba(224, 49, 49, 0.2);
    font-size: 13px;
  }

  .concept-stop {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    background: rgba(17, 133, 254, 0.05);
    border: 1px solid rgba(17, 133, 254, 0.2);
    border-radius: 12px;
  }

  .concept-icon {
    font-size: 18px;
  }

  .concept-label {
    font-size: 13px;
    font-weight: 600;
    color: #1185fe;
  }

  .end-note {
    border-color: rgba(64, 192, 87, 0.3);
    background: rgba(64, 192, 87, 0.05);
  }

  .end-note .note-label {
    color: #40c057;
  }

  /* Dark mode */
  :global(body.dark-mode) .note-node {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.12);
  }
  :global(body.dark-mode) .note-label {
    color: #5c5f66;
  }
  :global(body.dark-mode) .note-text {
    color: #c1c2c5;
  }
  :global(body.dark-mode) .stop-title {
    color: #4dabf7;
    background: rgba(77, 171, 247, 0.15);
  }
  :global(body.dark-mode) .stop-note {
    color: #868e96;
  }
  :global(body.dark-mode) .trail-edge {
    background: rgba(255, 255, 255, 0.14);
  }
  :global(body.dark-mode) .missing-site {
    background: rgba(224, 49, 49, 0.1);
    border-color: rgba(224, 49, 49, 0.2);
    color: #ff8787;
  }
  :global(body.dark-mode) .concept-stop {
    background: rgba(77, 171, 247, 0.1);
    border-color: rgba(77, 171, 247, 0.2);
  }
  :global(body.dark-mode) .concept-label {
    color: #4dabf7;
  }
  :global(body.dark-mode) .end-note {
    border-color: rgba(64, 192, 87, 0.3);
    background: rgba(64, 192, 87, 0.08);
  }
  :global(body.dark-mode) .end-note .note-label {
    color: #51cf66;
  }
</style>
