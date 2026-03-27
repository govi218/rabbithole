<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { MessageRequest } from "src/utils";
  import type { Trail, Website } from "src/utils/types";
  import TimelineCard from "./TimelineCard.svelte";

  export let trail: Trail;
  export let websites: Website[];

  const dispatch = createEventDispatcher();

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

  // Keep these exports so Timeline.svelte doesn't break
  export function toggleEdit() {}
  export function getIsEditing() {
    return false;
  }

  $: startNoteEmpty = !trail.startNote || trail.startNote.trim() === "";
</script>

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
    />
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
      />
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
    />
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
