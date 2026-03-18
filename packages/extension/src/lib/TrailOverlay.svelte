<script lang="ts">
  import { onMount } from "svelte";
  import { MessageRequest } from "../utils";
  import type { Trail, TrailWalk, Website } from "../utils/types";

  let trail: Trail | null = null;
  let walk: TrailWalk | null = null;
  let websites: Website[] = [];
  let show = false;
  let showNoteModal = false;
  let currentNoteText = "";

  onMount(async () => {
    await refresh();
  });

  export async function refresh() {
    const activeTrail = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ACTIVE_TRAIL,
    });
    if (!activeTrail) {
      show = false;
      return;
    }
    const res = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_TRAIL_WALK_STATE,
      trailId: activeTrail.id,
    });
    trail = res.trail;
    walk = res.walk;
    websites = res.websites || [];
    show = !!walk && !walk.completed;
  }

  $: visitedCount = walk?.visitedStops?.length ?? 0;
  $: currentStop = trail?.stops?.[visitedCount] ?? null;
  $: totalStops = trail?.stops?.length ?? 0;

  function getWebsite(url: string): Website | undefined {
    return websites.find((w) => w.url === url);
  }

  async function advance() {
    if (!currentStop || !trail) return;
    walk = await chrome.runtime.sendMessage({
      type: MessageRequest.ADVANCE_TRAIL_WALK,
      trailId: trail.id,
      websiteUrl: currentStop.websiteUrl,
    });
    const nextStop = trail.stops[walk.visitedStops.length];
    if (nextStop) {
      currentNoteText = nextStop.note || "";
      if (currentNoteText) {
        showNoteModal = true;
      } else {
        window.location.href = nextStop.websiteUrl;
      }
    } else {
      await chrome.runtime.sendMessage({
        type: MessageRequest.COMPLETE_TRAIL_WALK,
        trailId: trail.id,
      });
      show = false;
    }
  }

  async function goBack() {
    if (!trail || visitedCount === 0) return;
    const prevUrl = walk.visitedStops[visitedCount - 1];
    walk = { ...walk, visitedStops: walk.visitedStops.slice(0, -1) };
    await chrome.runtime.sendMessage({
      type: MessageRequest.ADVANCE_TRAIL_WALK,
      trailId: trail.id,
      websiteUrl: prevUrl,
    });
    window.location.href = prevUrl;
  }

  function acknowledgeNote() {
    showNoteModal = false;
    const nextStop = trail?.stops[walk?.visitedStops?.length ?? 0];
    if (nextStop) window.location.href = nextStop.websiteUrl;
  }

  async function abandon() {
    if (!trail) return;
    await chrome.runtime.sendMessage({
      type: MessageRequest.ABANDON_TRAIL_WALK,
      trailId: trail.id,
    });
    show = false;
  }
</script>

{#if show && trail && walk}
  <div class="trail-overlay">
    <div class="overlay-header">
      <div class="trail-name">{trail.name}</div>
      <button class="abandon-btn" on:click={abandon} title="Abandon trail"
        >✕</button
      >
    </div>
    <div class="progress-dots">
      {#each trail.stops as stop, i}
        <div
          class="dot"
          class:visited={walk.visitedStops.includes(stop.websiteUrl)}
          class:current={i === visitedCount}
          title={getWebsite(stop.websiteUrl)?.name ?? stop.websiteUrl}
        ></div>
      {/each}
    </div>
    <div class="step-info">
      {#if currentStop}
        <div class="step-label">Stop {visitedCount + 1} of {totalStops}</div>
        <div class="step-name">
          {getWebsite(currentStop.websiteUrl)?.name ?? currentStop.websiteUrl}
        </div>
      {:else}
        <div class="step-label">All stops visited</div>
      {/if}
    </div>
    <div class="overlay-actions">
      <button class="nav-btn" on:click={goBack} disabled={visitedCount === 0}
        >←</button
      >
      <button
        class="nav-btn primary"
        on:click={advance}
        disabled={!currentStop}
      >
        {visitedCount + 1 < totalStops ? "Next →" : "Done ✓"}
      </button>
    </div>
  </div>
{/if}

{#if showNoteModal}
  <div class="note-modal-overlay">
    <div class="note-modal">
      <div class="note-label">
        Before stop {(walk?.visitedStops?.length ?? 0) + 1}...
      </div>
      <p class="note-text">{currentNoteText}</p>
      <button class="ok-btn" on:click={acknowledgeNote}>OK</button>
    </div>
  </div>
{/if}

<style>
  .trail-overlay {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 16px;
    padding: 16px 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    z-index: 2147483646;
    min-width: 280px;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .overlay-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .trail-name {
    font-weight: 800;
    font-size: 13px;
    color: #1a1b1e;
  }
  .abandon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #868e96;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .abandon-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #e03131;
  }
  .progress-dots {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #dee2e6;
    transition: all 0.2s;
  }
  .dot.visited {
    background: #1185fe;
  }
  .dot.current {
    background: #1185fe;
    box-shadow: 0 0 0 3px rgba(17, 133, 254, 0.25);
    transform: scale(1.3);
  }
  .step-info {
    text-align: center;
  }
  .step-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #868e96;
    margin-bottom: 4px;
  }
  .step-name {
    font-size: 14px;
    font-weight: 700;
    color: #1a1b1e;
  }
  .overlay-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }
  .nav-btn {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    color: #495057;
    transition: all 0.2s;
  }
  .nav-btn:hover:not(:disabled) {
    background: #f1f3f5;
  }
  .nav-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .nav-btn.primary {
    background: #1185fe;
    color: white;
    border-color: #1185fe;
  }
  .nav-btn.primary:hover:not(:disabled) {
    background: #0070e0;
  }
  .note-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    backdrop-filter: blur(4px);
  }
  .note-modal {
    background: #fff;
    border-radius: 16px;
    padding: 28px 32px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .note-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #868e96;
    letter-spacing: 0.05em;
  }
  .note-text {
    font-size: 17px;
    line-height: 1.6;
    color: #1a1b1e;
    margin: 0;
    white-space: pre-wrap;
  }
  .ok-btn {
    align-self: flex-end;
    padding: 10px 24px;
    background: #1185fe;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .ok-btn:hover {
    background: #0070e0;
  }
</style>
