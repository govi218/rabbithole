<script lang="ts">
  import { onMount } from "svelte";
  import { Loader } from "@svelteuidev/core";
  import { MessageRequest } from "../utils";
  import type {
    Trail,
    TrailStop,
    TrailWalk,
    TrailWalkState,
    Website,
  } from "../utils/types";

  let trail: Trail | null = null;
  let walk: TrailWalk | null = null;
  let websites: Website[] = [];
  let isLoading: boolean = true;
  let isDark: boolean = false;

  let showNoteModal: boolean = false;
  let currentNoteText: string = "";

  const params = new URLSearchParams(window.location.search);
  const trailId: string | null = params.get("trailId");
  const isCompleted: boolean = params.get("completed") === "1";
  const showNote: boolean = params.get("showNote") === "1";

  onMount(async () => {
    const cachedDarkMode = localStorage.getItem("rabbithole-dark-mode");
    if (cachedDarkMode !== null) {
      isDark = cachedDarkMode === "true";
    } else {
      try {
        const settings = await chrome.runtime.sendMessage({
          type: MessageRequest.GET_SETTINGS,
        });
        isDark = settings?.darkMode ?? false;
      } catch {}
    }
    document.body.classList.toggle("dark-mode", isDark);

    if (!trailId) {
      isLoading = false;
      return;
    }
    await loadState();
    isLoading = false;
  });

  async function loadState(): Promise<void> {
    const res: TrailWalkState = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_TRAIL_WALK_STATE,
      trailId,
    });
    trail = res.trail;
    walk = res.walk;
    websites = res.websites;
  }

  $: visitedCount = walk?.visitedStops?.length ?? 0;
  $: currentStop = (trail?.stops?.[visitedCount] ?? null) as TrailStop | null;
  $: totalStops = trail?.stops?.length ?? 0;

  $: upcomingNote = showNote && currentStop ? currentStop.note : "";

  function getWebsite(url: string): Website | undefined {
    return websites.find((w) => w.url === url);
  }

  function goToStop(url: string): void {
    window.location.href = url;
  }

  async function acknowledgeUpcomingNote(): Promise<void> {
    if (!currentStop) return;
    goToStop(currentStop.websiteUrl);
  }

  async function startWalk(): Promise<void> {
    walk = await chrome.runtime.sendMessage({
      type: MessageRequest.START_TRAIL_WALK,
      trailId,
    });
    currentNoteText = trail.startNote || "";
    const firstStop: TrailStop | undefined = trail?.stops?.[0];
    if (!firstStop) return;

    if (currentNoteText) {
      showNoteModal = true;
    } else {
      goToStop(firstStop.websiteUrl);
    }
  }

  async function acknowledgeStartNote(): Promise<void> {
    showNoteModal = false;
    const firstStop: TrailStop | undefined = trail?.stops?.[0];
    if (firstStop) {
      goToStop(firstStop.websiteUrl);
    }
  }

  async function advance(): Promise<void> {
    if (!currentStop || !trail) return;
    walk = await chrome.runtime.sendMessage({
      type: MessageRequest.ADVANCE_TRAIL_WALK,
      trailId,
      websiteUrl: currentStop.websiteUrl,
    });
    const nextStop: TrailStop | undefined =
      trail.stops[walk.visitedStops.length];
    if (nextStop) {
      if (nextStop.note && nextStop.note.trim()) {
        window.location.href = `${window.location.pathname}?trailId=${trailId}&showNote=1`;
      } else {
        goToStop(nextStop.websiteUrl);
      }
    } else {
      // All stops visited — complete and go straight to completion screen
      await chrome.runtime.sendMessage({
        type: MessageRequest.COMPLETE_TRAIL_WALK,
        trailId,
      });
      window.location.href = `${window.location.pathname}?trailId=${trailId}&completed=1`;
    }
  }

  async function abandon(): Promise<void> {
    if (!confirm("Abandon this trail walk?")) return;
    await chrome.runtime.sendMessage({
      type: MessageRequest.ABANDON_TRAIL_WALK,
      trailId,
    });
    walk = null;
  }

  async function walkAgain(): Promise<void> {
    window.location.href = `${window.location.pathname}?trailId=${trailId}`;
  }
</script>

<div class="trail-page">
  {#if isLoading}
    <div class="center"><Loader size="lg" variant="dots" /></div>
  {:else if !trail}
    <div class="center">
      <h2>Trail not found.</h2>
    </div>
  {:else if isCompleted}
    <!-- Completion screen — end note shown here as the custom completion message -->
    <div class="completion-screen">
      <div class="completion-card">
        <div class="confetti-row">🎉</div>
        <h1 class="completion-title">Trail Complete!</h1>
        <p class="completion-subtitle">
          You finished <strong>{trail.name}</strong>
        </p>

        {#if trail.endNote && trail.endNote.trim()}
          <div class="end-note-display">
            <div class="end-note-display-label">🏁 Ending note</div>
            <div class="end-note-display-text">{trail.endNote}</div>
          </div>
        {/if}

        <div class="completion-stats">
          <div class="stat-pill">
            <span class="stat-num">{trail.stops.length}</span>
            <span class="stat-label"
              >stop{trail.stops.length !== 1 ? "s" : ""} visited</span
            >
          </div>
        </div>

        <div class="completion-stops">
          {#each trail.stops as stop}
            <div class="completion-stop">
              <div class="stop-check">✓</div>
              <div class="stop-name">
                {getWebsite(stop.websiteUrl)?.name ?? stop.websiteUrl}
              </div>
            </div>
          {/each}
        </div>

        <div class="completion-actions">
          <button class="secondary-btn" on:click={walkAgain}>
            Walk Again
          </button>
          <button class="primary-btn" on:click={() => window.close()}>
            Done
          </button>
        </div>
      </div>
    </div>
  {:else if showNote && currentStop}
    <!-- Between-stop note screen -->
    <div class="note-screen">
      <div class="note-card">
        <div class="note-screen-label">
          Before stop {visitedCount + 1} of {totalStops}...
        </div>
        <div class="note-screen-site">
          {getWebsite(currentStop.websiteUrl)?.name ?? currentStop.websiteUrl}
        </div>
        <div class="note-screen-text">{upcomingNote}</div>
        <button class="primary-btn" on:click={acknowledgeUpcomingNote}>
          Go to stop {visitedCount + 1} →
        </button>
      </div>
    </div>
  {:else if !walk}
    <!-- Start state -->
    <div class="start-state">
      <h1>{trail.name}</h1>
      <p class="subtitle">
        {trail.stops.length} stop{trail.stops.length !== 1 ? "s" : ""} on this trail
      </p>
      {#if trail.startNote}
        <div class="note-preview">
          <div class="note-label">Starting note</div>
          <div class="note-text">{trail.startNote}</div>
        </div>
      {/if}
      <div class="stops-list">
        {#each trail.stops as stop, i}
          <div class="stop-row">
            <div class="stop-num">{i + 1}</div>
            <div class="stop-name">
              {getWebsite(stop.websiteUrl)?.name ?? stop.websiteUrl}
            </div>
          </div>
        {/each}
      </div>
      {#if trail.endNote && trail.endNote.trim()}
        <div class="note-preview end-note-preview">
          <div class="note-label">Ending note</div>
          <div class="note-text">{trail.endNote}</div>
        </div>
      {/if}
      <button class="primary-btn large" on:click={startWalk}>Start Trail</button
      >
    </div>
  {:else}
    <!-- Walk state -->
    <div class="walk-state">
      <div class="walk-header">
        <h1>{trail.name}</h1>
        <div class="progress-dots">
          {#each trail.stops as stop, i}
            <div
              class="dot"
              class:visited={walk.visitedStops.includes(stop.websiteUrl)}
              class:current={i === visitedCount}
            ></div>
          {/each}
        </div>
        <div class="progress-label">{visitedCount} / {totalStops}</div>
      </div>

      {#if currentStop}
        <div class="stop-badge">Stop {visitedCount + 1} of {totalStops}</div>
        {#if getWebsite(currentStop.websiteUrl)}
          {@const site = getWebsite(currentStop.websiteUrl)}
          <div class="site-card">
            {#if site.openGraphImageUrl}
              <img
                src={site.openGraphImageUrl}
                alt={site.name}
                class="site-image"
              />
            {/if}
            <div class="site-info">
              <h2>{site.name}</h2>
              {#if site.description}<p>{site.description}</p>{/if}
              <a href={site.url} target="_blank" rel="noopener noreferrer"
                >{site.url}</a
              >
            </div>
          </div>
        {:else}
          <div class="site-card">
            <div class="site-info">
              <a
                href={currentStop.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {currentStop.websiteUrl}
              </a>
            </div>
          </div>
        {/if}
        <div class="walk-actions">
          <button class="abandon-btn" on:click={abandon}>Abandon</button>
          <button class="primary-btn" on:click={advance}>
            {visitedCount + 1 < totalStops ? "Next Stop →" : "Complete Trail ✓"}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showNoteModal}
  <div class="note-modal-overlay">
    <div class="note-modal">
      <div class="note-modal-label">Before you begin...</div>
      <p class="note-modal-text">{currentNoteText}</p>
      <button class="primary-btn" on:click={acknowledgeStartNote}>OK</button>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    margin: 0;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #f8f9fa;
    color: #1a1b1e;
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  :global(body.dark-mode) {
    background: #141517;
    color: #e7e7e7;
  }

  .trail-page {
    min-height: 100vh;
    padding: 48px 24px;
    box-sizing: border-box;
  }

  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 16px;
    text-align: center;
  }

  /* ── Note screen (between stops) ── */
  .note-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 90vh;
  }

  .note-card {
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 24px;
    padding: 48px 40px;
    max-width: 520px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
    animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    text-align: center;
  }

  :global(body.dark-mode) .note-card {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .note-screen-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #868e96;
    letter-spacing: 0.06em;
  }

  .note-screen-site {
    font-size: 13px;
    font-weight: 700;
    color: #1185fe;
  }

  :global(body.dark-mode) .note-screen-site {
    color: #4dabf7;
  }

  .note-screen-text {
    font-size: 22px;
    font-weight: 600;
    line-height: 1.5;
    color: #1a1b1e;
    white-space: pre-wrap;
  }

  :global(body.dark-mode) .note-screen-text {
    color: #e7e7e7;
  }

  /* ── Completion screen ── */
  .completion-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 90vh;
  }

  .completion-card {
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 24px;
    padding: 48px 40px;
    max-width: 520px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
    animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  :global(body.dark-mode) .completion-card {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0.88) translateY(16px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .confetti-row {
    font-size: 56px;
    line-height: 1;
    animation: bounce 0.6s ease 0.3s both;
  }

  @keyframes bounce {
    0% {
      transform: scale(0.5);
      opacity: 0;
    }
    60% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .completion-title {
    font-size: 32px;
    font-weight: 900;
    color: #1a1b1e;
    margin: 0;
    text-align: center;
  }

  :global(body.dark-mode) .completion-title {
    color: #e7e7e7;
  }

  .completion-subtitle {
    font-size: 16px;
    color: #868e96;
    margin: 0;
    text-align: center;
  }

  .completion-subtitle strong {
    color: #1185fe;
  }

  :global(body.dark-mode) .completion-subtitle {
    color: #909296;
  }

  :global(body.dark-mode) .completion-subtitle strong {
    color: #4dabf7;
  }

  /* End note shown prominently on the completion screen */
  .end-note-display {
    width: 100%;
    background: rgba(64, 192, 87, 0.06);
    border: 1px solid rgba(64, 192, 87, 0.25);
    border-radius: 14px;
    padding: 20px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  :global(body.dark-mode) .end-note-display {
    background: rgba(81, 207, 102, 0.06);
    border-color: rgba(81, 207, 102, 0.2);
  }

  .end-note-display-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #40c057;
    letter-spacing: 0.06em;
  }

  :global(body.dark-mode) .end-note-display-label {
    color: #51cf66;
  }

  .end-note-display-text {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.5;
    color: #1a1b1e;
    white-space: pre-wrap;
  }

  :global(body.dark-mode) .end-note-display-text {
    color: #e7e7e7;
  }

  .completion-stats {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .stat-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(17, 133, 254, 0.08);
    border: 1px solid rgba(17, 133, 254, 0.2);
    border-radius: 12px;
    padding: 12px 24px;
    min-width: 80px;
  }

  :global(body.dark-mode) .stat-pill {
    background: rgba(77, 171, 247, 0.08);
    border-color: rgba(77, 171, 247, 0.2);
  }

  .stat-num {
    font-size: 28px;
    font-weight: 900;
    color: #1185fe;
    line-height: 1;
  }

  :global(body.dark-mode) .stat-num {
    color: #4dabf7;
  }

  .stat-label {
    font-size: 11px;
    font-weight: 600;
    color: #868e96;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 4px;
  }

  .completion-stops {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 240px;
    overflow-y: auto;
  }

  .completion-stop {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 10px;
  }

  :global(body.dark-mode) .completion-stop {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.08);
  }

  .stop-check {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #40c057;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    flex-shrink: 0;
  }

  .completion-stop .stop-name {
    font-size: 13px;
    font-weight: 600;
    color: #1a1b1e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(body.dark-mode) .completion-stop .stop-name {
    color: #c1c2c5;
  }

  .completion-actions {
    display: flex;
    gap: 12px;
    width: 100%;
    justify-content: center;
    margin-top: 8px;
  }

  /* ── Start / Walk states ── */
  .start-state,
  .walk-state {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  h1 {
    font-size: 32px;
    font-weight: 900;
    color: #1a1b1e;
    margin: 0;
  }

  :global(body.dark-mode) h1 {
    color: #e7e7e7;
  }

  h2 {
    font-size: 22px;
    font-weight: 800;
    color: #1a1b1e;
    margin: 0;
  }

  :global(body.dark-mode) h2 {
    color: #e7e7e7;
  }

  .subtitle {
    color: #868e96;
    font-size: 16px;
    margin: 0;
  }

  .note-preview {
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    padding: 16px 20px;
  }

  :global(body.dark-mode) .note-preview {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .end-note-preview {
    border-color: rgba(64, 192, 87, 0.3);
    background: rgba(64, 192, 87, 0.03);
  }

  :global(body.dark-mode) .end-note-preview {
    border-color: rgba(81, 207, 102, 0.25);
    background: rgba(81, 207, 102, 0.04);
  }

  .note-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #868e96;
    margin-bottom: 8px;
  }

  .note-text {
    font-size: 15px;
    color: #1a1b1e;
    line-height: 1.6;
  }

  :global(body.dark-mode) .note-text {
    color: #c1c2c5;
  }

  .stops-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .stop-row {
    display: flex;
    align-items: center;
    gap: 14px;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 10px;
    padding: 14px 18px;
  }

  :global(body.dark-mode) .stop-row {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .stop-num {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #1185fe;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 13px;
    flex-shrink: 0;
  }

  .stop-name {
    font-weight: 600;
    color: #1a1b1e;
    font-size: 14px;
  }

  :global(body.dark-mode) .stop-name {
    color: #c1c2c5;
  }

  .walk-header {
    text-align: center;
  }

  .progress-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin: 16px 0 8px;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #dee2e6;
    transition: all 0.2s;
  }

  :global(body.dark-mode) .dot {
    background: #373a40;
  }

  .dot.visited {
    background: #1185fe;
  }

  :global(body.dark-mode) .dot.visited {
    background: #4dabf7;
  }

  .dot.current {
    background: #1185fe;
    box-shadow: 0 0 0 3px rgba(17, 133, 254, 0.3);
    transform: scale(1.3);
  }

  :global(body.dark-mode) .dot.current {
    background: #4dabf7;
    box-shadow: 0 0 0 3px rgba(77, 171, 247, 0.3);
  }

  .progress-label {
    font-size: 13px;
    color: #868e96;
    font-weight: 600;
  }

  .stop-badge {
    display: inline-block;
    background: rgba(17, 133, 254, 0.1);
    color: #1185fe;
    font-weight: 700;
    font-size: 13px;
    padding: 6px 16px;
    border-radius: 999px;
    align-self: center;
  }

  :global(body.dark-mode) .stop-badge {
    background: rgba(77, 171, 247, 0.1);
    color: #4dabf7;
  }

  .site-card {
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 16px;
    overflow: hidden;
  }

  :global(body.dark-mode) .site-card {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .site-image {
    width: 100%;
    height: 200px;
    object-fit: cover;
  }

  .site-info {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .site-info h2 {
    font-size: 20px;
  }

  .site-info p {
    font-size: 14px;
    color: #495057;
    line-height: 1.6;
    margin: 0;
  }

  :global(body.dark-mode) .site-info p {
    color: #909296;
  }

  .site-info a {
    font-size: 13px;
    color: #1185fe;
    text-decoration: none;
    word-break: break-all;
  }

  :global(body.dark-mode) .site-info a {
    color: #4dabf7;
  }

  .walk-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* ── Buttons ── */
  .primary-btn {
    background: #1185fe;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition:
      background 0.2s,
      transform 0.15s;
    font-family: inherit;
  }

  .primary-btn:hover {
    background: #0070e0;
    transform: translateY(-1px);
  }

  .primary-btn.large {
    padding: 16px 32px;
    font-size: 17px;
    align-self: center;
  }

  .secondary-btn {
    background: transparent;
    color: #1185fe;
    border: 2px solid #1185fe;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .secondary-btn:hover {
    background: rgba(17, 133, 254, 0.08);
    transform: translateY(-1px);
  }

  :global(body.dark-mode) .secondary-btn {
    color: #4dabf7;
    border-color: #4dabf7;
  }

  :global(body.dark-mode) .secondary-btn:hover {
    background: rgba(77, 171, 247, 0.08);
  }

  .abandon-btn {
    background: none;
    border: none;
    color: #e03131;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 8px;
    transition: background 0.2s;
    font-family: inherit;
  }

  .abandon-btn:hover {
    background: rgba(224, 49, 49, 0.08);
  }

  :global(body.dark-mode) .abandon-btn {
    color: #ff6b6b;
  }

  :global(body.dark-mode) .abandon-btn:hover {
    background: rgba(255, 107, 107, 0.08);
  }

  /* ── Start note modal ── */
  .note-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }

  .note-modal {
    background: #fff;
    border-radius: 16px;
    padding: 32px;
    max-width: 480px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: popIn 0.2s ease-out;
  }

  :global(body.dark-mode) .note-modal {
    background: #25262b;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .note-modal-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #868e96;
    letter-spacing: 0.05em;
  }

  .note-modal-text {
    font-size: 18px;
    line-height: 1.6;
    color: #1a1b1e;
    margin: 0;
    white-space: pre-wrap;
  }

  :global(body.dark-mode) .note-modal-text {
    color: #e7e7e7;
  }
</style>
