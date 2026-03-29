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
    // Navigate to TrailPage which handles starting the walk and showing notes
    const trailPageUrl = chrome.runtime.getURL(
      `src/trail/trail.html?trailId=${trail.id}`,
    );
    window.location.href = trailPageUrl;
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

<div class="trail-view">
  <!-- Start note card -->
  {#if trail.startNote}
    <div class="note-card start-card">
      <div class="note-badge">Start</div>
      <div class="note-content">{trail.startNote}</div>
    </div>
  {/if}

  <!-- Steps -->
  {#each trail.stops as stop, i}
    <div class="step-card">
      <div class="step-header">
        <div class="step-num">{i + 1}</div>
        {#if stop.title}
          <div class="step-title">{stop.title}</div>
        {/if}
      </div>
      
      <div class="step-content">
        {#if getWebsite(stop.websiteUrl)}
          <TimelineCard
            website={getWebsite(stop.websiteUrl)}
            showDelete={false}
          />
        {:else if stop.websiteUrl}
          <a href={stop.websiteUrl} target="_blank" class="url-link">
            {stop.websiteUrl}
          </a>
        {:else}
          <div class="concept-block">
            <span class="concept-icon">💡</span>
            <span>Concept step</span>
          </div>
        {/if}
      </div>

      {#if stop.note}
        <div class="step-note">{stop.note}</div>
      {/if}
    </div>
  {/each}

  <!-- End note card -->
  {#if trail.endNote}
    <div class="note-card end-card">
      <div class="note-badge">🏁 Finish</div>
      <div class="note-content">{trail.endNote}</div>
    </div>
  {/if}
</div>

<style>
  .trail-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding-bottom: 64px;
  }

  .note-card {
    background: #f8f9fa;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    padding: 16px;
  }

  .note-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    color: #868e96;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
    background: rgba(0, 0, 0, 0.05);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .note-content {
    font-size: 14px;
    color: #495057;
    line-height: 1.5;
  }

  .start-card {
    border-left: 3px solid #1185fe;
  }

  .start-card .note-badge {
    color: #1185fe;
    background: rgba(17, 133, 254, 0.1);
  }

  .end-card {
    border-left: 3px solid #40c057;
    background: rgba(64, 192, 87, 0.04);
  }

  .end-card .note-badge {
    color: #40c057;
    background: rgba(64, 192, 87, 0.1);
  }

  .step-card {
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .step-num {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1185fe;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    border-radius: 50%;
  }

  .step-title {
    font-size: 14px;
    font-weight: 600;
    color: #212529;
  }

  .step-content {
    margin-bottom: 8px;
  }

  .url-link {
    display: block;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 8px;
    color: #1185fe;
    font-size: 13px;
    text-decoration: none;
    word-break: break-all;
  }

  .url-link:hover {
    background: rgba(17, 133, 254, 0.1);
  }

  .concept-block {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(17, 133, 254, 0.05);
    border-radius: 8px;
    color: #1185fe;
    font-size: 13px;
    font-weight: 500;
  }

  .concept-icon {
    font-size: 16px;
  }

  .step-note {
    padding: 12px;
    background: #f8f9fa;
    border-radius: 8px;
    font-size: 13px;
    color: #868e96;
    font-style: italic;
    line-height: 1.5;
  }

  /* Dark mode */
  :global(body.dark-mode) .note-card {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.12);
  }

  :global(body.dark-mode) .note-badge {
    color: #868e96;
    background: rgba(255, 255, 255, 0.05);
  }

  :global(body.dark-mode) .note-content {
    color: #c1c2c5;
  }

  :global(body.dark-mode) .start-card {
    border-left-color: #4dabf7;
  }

  :global(body.dark-mode) .start-card .note-badge {
    color: #4dabf7;
    background: rgba(77, 171, 247, 0.15);
  }

  :global(body.dark-mode) .end-card {
    border-left-color: #51cf66;
    background: rgba(81, 207, 102, 0.05);
  }

  :global(body.dark-mode) .end-card .note-badge {
    color: #51cf66;
    background: rgba(81, 207, 102, 0.15);
  }

  :global(body.dark-mode) .step-card {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: none;
  }

  :global(body.dark-mode) .step-num {
    background: #4dabf7;
  }

  :global(body.dark-mode) .step-title {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .url-link {
    background: #373a40;
    color: #4dabf7;
  }

  :global(body.dark-mode) .url-link:hover {
    background: rgba(77, 171, 247, 0.15);
  }

  :global(body.dark-mode) .concept-block {
    background: rgba(77, 171, 247, 0.1);
    color: #4dabf7;
  }

  :global(body.dark-mode) .step-note {
    background: #373a40;
    color: #868e96;
  }
</style>
