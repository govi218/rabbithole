<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Trail, Website } from "src/utils/types";
  import TimelineCard from "./TimelineCard.svelte";
  import TrailNoteModal from "./TrailNoteModal.svelte";

  export let trail: Trail;
  export let websites: Website[];
  export let initialEditMode: boolean = false;

  const dispatch = createEventDispatcher();

  let isEditing = initialEditMode;
  // -1 = startNote, -2 = endNote, 0+ = stop index
  let editingNoteIndex: number | null = null;
  let showNoteModal = false;

  $: startNoteEmpty = !trail.startNote || trail.startNote.trim() === "";
  $: highlightStartNote = isEditing && startNoteEmpty;

  function getWebsite(url: string) {
    return websites.find((w) => w.url === url);
  }

  function editNote(index: number) {
    if (!isEditing) return;
    editingNoteIndex = index;
    showNoteModal = true;
  }

  function getCurrentNoteValue(): string {
    if (editingNoteIndex === -1) return trail.startNote || "";
    if (editingNoteIndex === -2) return trail.endNote || "";
    if (editingNoteIndex !== null) return trail.stops[editingNoteIndex]?.note || "";
    return "";
  }

  function saveNote(event: CustomEvent<{ note: string }>) {
    const newNote = event.detail.note;
    if (editingNoteIndex === -1) {
      trail.startNote = newNote;
    } else if (editingNoteIndex === -2) {
      trail.endNote = newNote;
    } else if (editingNoteIndex !== null) {
      trail.stops[editingNoteIndex].note = newNote;
    }
    showNoteModal = false;
    editingNoteIndex = null;
  }

  export function toggleEdit() {
    if (isEditing) {
      isEditing = false;
      dispatch("save", { trail });
    } else {
      isEditing = true;
    }
  }

  export function startTrail() {
    const trailPageUrl = chrome.runtime.getURL(
      `src/trail/trail.html?trailId=${trail.id}`,
    );
    window.open(trailPageUrl, "_blank");
  }

  export function getIsEditing() {
    return isEditing;
  }
</script>

<TrailNoteModal
  isOpen={showNoteModal}
  initialNote={getCurrentNoteValue()}
  on:save={saveNote}
  on:close={() => (showNoteModal = false)}
/>

<div class="trail-nodes">
  <!-- Start note -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="note-node"
    class:editing={isEditing}
    class:highlight-required={highlightStartNote}
    on:click={() => isEditing && editNote(-1)}
  >
    {#if highlightStartNote}
      <div class="required-label">✦ Add a starting note to begin your trail</div>
    {/if}
    <div class="note-content">
      {trail.startNote || (isEditing ? "Click to add a starting note..." : "")}
    </div>
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
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
      class="note-node"
      class:editing={isEditing}
      on:click={() => isEditing && editNote(i)}
    >
      <div class="note-content">
        {stop.note || (isEditing ? "Add a note before the next stop..." : "")}
      </div>
    </div>
  {/each}

  <!-- End note: shown after all stops, labelled clearly as the completion message -->
  <div class="trail-edge"></div>
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="note-node end-note-node"
    class:editing={isEditing}
    on:click={() => isEditing && editNote(-2)}
  >
    <div class="end-note-label">🏁 Completion message</div>
    <div class="note-content">
      {trail.endNote || (isEditing ? "Click to add a completion message..." : "No completion message")}
    </div>
  </div>
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
    padding: 16px 20px;
    font-size: 15px;
    line-height: 1.5;
    color: #495057;
    text-align: center;
    transition: all 0.2s;
  }
  .note-node.editing {
    cursor: pointer;
    border: 1px dashed #1185fe;
    background: rgba(17, 133, 254, 0.05);
  }
  .note-node.editing:hover {
    background: rgba(17, 133, 254, 0.1);
  }

  .note-node.highlight-required {
    border: 2px dashed #f59f00;
    background: rgba(245, 159, 0, 0.07);
    animation: pulse-border 1.8s ease-in-out infinite;
  }
  .note-node.highlight-required:hover {
    background: rgba(245, 159, 0, 0.14);
  }

  @keyframes pulse-border {
    0%   { box-shadow: 0 0 0 0 rgba(245, 159, 0, 0.35); }
    50%  { box-shadow: 0 0 0 6px rgba(245, 159, 0, 0); }
    100% { box-shadow: 0 0 0 0 rgba(245, 159, 0, 0); }
  }

  .required-label {
    font-size: 11px;
    font-weight: 700;
    color: #f59f00;
    letter-spacing: 0.02em;
    margin-bottom: 6px;
    text-transform: uppercase;
  }

  /* End note styling — green to signal it's the completion message */
  .end-note-node {
    border-style: dashed;
    border-color: rgba(64, 192, 87, 0.4);
    background: rgba(64, 192, 87, 0.04);
  }

  .end-note-node.editing {
    border-color: #40c057;
    background: rgba(64, 192, 87, 0.07);
    cursor: pointer;
  }

  .end-note-node.editing:hover {
    background: rgba(64, 192, 87, 0.13);
  }

  .end-note-label {
    font-size: 11px;
    font-weight: 700;
    color: #40c057;
    letter-spacing: 0.02em;
    margin-bottom: 6px;
    text-transform: uppercase;
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

  :global(body.dark-mode) .note-node {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.12);
    color: #c1c2c5;
  }
  :global(body.dark-mode) .note-node.editing {
    border-color: #4dabf7;
    background: rgba(77, 171, 247, 0.05);
  }
  :global(body.dark-mode) .note-node.editing:hover {
    background: rgba(77, 171, 247, 0.1);
  }
  :global(body.dark-mode) .note-node.highlight-required {
    border-color: #fab005;
    background: rgba(250, 176, 5, 0.07);
  }
  :global(body.dark-mode) .note-node.highlight-required:hover {
    background: rgba(250, 176, 5, 0.14);
  }
  :global(body.dark-mode) .required-label {
    color: #fab005;
  }
  :global(body.dark-mode) .end-note-node {
    border-color: rgba(64, 192, 87, 0.3);
    background: rgba(64, 192, 87, 0.04);
  }
  :global(body.dark-mode) .end-note-node.editing {
    border-color: #51cf66;
    background: rgba(81, 207, 102, 0.07);
  }
  :global(body.dark-mode) .end-note-node.editing:hover {
    background: rgba(81, 207, 102, 0.13);
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
