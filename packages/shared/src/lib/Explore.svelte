<script lang="ts">
  import { onMount } from "svelte";
  import type { ActorTrail, ActorCollectionWithAuthor } from "../atproto/explore";
  import { fetchLatestTrails, fetchLatestCollections } from "../atproto/explore";


  export let onWalkTrail: ((trail: ActorTrail) => void) | undefined = undefined;
  export let onTrailClick: ((trail: ActorTrail) => void) | undefined = undefined;
  export let onBurrowClick: ((burrow: ActorCollectionWithAuthor) => void) | undefined = undefined;
  export let selectedTrail: ActorTrail | null = null;

  let tab: "trails" | "burrows" = "trails";

  let trails: ActorTrail[] = [];
  let isLoadingTrails = false;
  let trailsError: string | null = null;

  let burrows: ActorCollectionWithAuthor[] = [];
  let isLoadingBurrows = false;
  let burrowsError: string | null = null;

  onMount(async () => {
    loadTrails();
  });

  async function loadTrails() {
    if (trails.length) return;
    isLoadingTrails = true; trailsError = null;
    try { trails = await fetchLatestTrails(); }
    catch (e: any) { trailsError = e.message; }
    finally { isLoadingTrails = false; }
  }

  async function loadBurrows() {
    if (burrows.length) return;
    isLoadingBurrows = true; burrowsError = null;
    try { burrows = await fetchLatestCollections(); }
    catch (e: any) { burrowsError = e.message; }
    finally { isLoadingBurrows = false; }
  }

  function switchTab(t: "trails" | "burrows") {
    tab = t;
    selectedTrail = null;
    if (t === "burrows") loadBurrows();
  }

  function timeAgo(iso: string | undefined): string {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return s <= 5 ? "just now" : `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    if (d < 30) return `${Math.floor(d / 7)}w ago`;
    if (d < 365) return `${Math.floor(d / 30)}mo ago`;
    return `${Math.floor(d / 365)}y ago`;
  }

  function fullDate(iso: string | undefined): string {
    if (!iso) return "";
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }
</script>

<div class="explore-container">

  <div class="view-tabs">
    <button class="view-tab" class:active={tab === "trails"} on:click={() => switchTab("trails")}>
      Trails
    </button>
    <button class="view-tab" class:active={tab === "burrows"} on:click={() => switchTab("burrows")}>
      Burrows
    </button>
  </div>

  {#if selectedTrail}
    <div class="trail-detail">
      <button class="back-btn" on:click={() => selectedTrail = null}>← Back</button>
      <h2 class="trail-title">{selectedTrail.title}</h2>
      {#if selectedTrail.description}
        <p class="trail-desc">{selectedTrail.description}</p>
      {/if}
      <div class="stops-list">
        {#each selectedTrail.stops as stop, i}
          <div class="stop-row">
            <div class="stop-num">{i + 1}</div>
            <div class="stop-content">
              <a href={stop.url} target="_blank" rel="noopener noreferrer" class="stop-url">{stop.url}</a>
              {#if stop.note}
                <p class="stop-note">{stop.note}</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      {#if onWalkTrail}
        <button class="walk-btn" on:click={() => selectedTrail && onWalkTrail(selectedTrail)}>Walk this trail →</button>
      {/if}
    </div>

  {:else if tab === "trails"}
    {#if isLoadingTrails}
      <p class="feed-empty">Loading trails...</p>
    {:else if trailsError}
      <p class="feed-error">{trailsError}</p>
    {:else}
      <div class="feed">
        {#each trails as trail}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="feed-card" on:click={() => onTrailClick ? onTrailClick(trail) : (selectedTrail = trail)}>
            <div class="feed-author">
              {#if trail.authorAvatar}
                <img src={trail.authorAvatar} alt={trail.authorHandle} class="author-avatar" />
              {:else}
                <div class="author-avatar-placeholder" />
              {/if}
              <span class="author-label">
                <strong>@{trail.authorHandle ?? trail.authorDid?.slice(0, 16) ?? "unknown"}</strong> created a trail
              </span>
              {#if trail.createdAt}
                <span class="timestamp" title={fullDate(trail.createdAt)}>{timeAgo(trail.createdAt)}</span>
              {/if}
            </div>
            <div class="feed-card-body">
              <h3 class="card-title">{trail.title}</h3>
              {#if trail.description}
                <p class="card-desc">{trail.description}</p>
              {/if}
              <span class="stop-badge">{trail.stops.length} stop{trail.stops.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  {:else}
    {#if isLoadingBurrows}
      <p class="feed-empty">Loading burrows...</p>
    {:else if burrowsError}
      <p class="feed-error">{burrowsError}</p>
    {:else}
      <div class="feed">
        {#each burrows as burrow}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="feed-card" class:no-click={!onBurrowClick} on:click={() => onBurrowClick && onBurrowClick(burrow)}>
            <div class="feed-author">
              {#if burrow.authorAvatar}
                <img src={burrow.authorAvatar} alt={burrow.authorHandle} class="author-avatar" />
              {:else}
                <div class="author-avatar-placeholder" />
              {/if}
              <span class="author-label">
                <strong>@{burrow.authorHandle ?? burrow.authorDid?.slice(0, 16) ?? "unknown"}</strong> created a burrow
              </span>
              {#if burrow.createdAt}
                <span class="timestamp" title={fullDate(burrow.createdAt)}>{timeAgo(burrow.createdAt)}</span>
              {/if}
            </div>
            <div class="feed-card-body">
              <h3 class="card-title">{burrow.name}</h3>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

</div>

<style>
  .explore-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-width: 800px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .view-tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  :global(body.dark-mode) .view-tabs {
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .view-tab {
    padding: 8px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    font-weight: 500;
    color: #868e96;
    cursor: pointer;
    margin-bottom: -1px;
    transition: color 0.15s;
    font-family: inherit;
  }

  .view-tab.active { color: #4dabf7; border-bottom-color: #4dabf7; }
  .view-tab:hover:not(.active) { color: #c1c2c5; }

  .feed { display: flex; flex-direction: column; gap: 12px; }

  .feed-card {
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  :global(body.dark-mode) .feed-card {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.1);
  }
  .feed-card:hover { border-color: #4dabf7; box-shadow: 0 4px 20px rgba(77, 171, 247, 0.12); }
  .feed-card.no-click { cursor: default; }
  .feed-card.no-click:hover { border-color: rgba(0,0,0,0.08); box-shadow: none; }
  :global(body.dark-mode) .feed-card.no-click:hover { border-color: rgba(255,255,255,0.1); }

  .feed-author {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }
  :global(body.dark-mode) .feed-author {
    border-bottom-color: rgba(255, 255, 255, 0.06);
  }

  .author-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
  .author-avatar-placeholder { width: 24px; height: 24px; border-radius: 50%; background: #e9ecef; flex-shrink: 0; }
  :global(body.dark-mode) .author-avatar-placeholder { background: #373a40; }

  .author-label { font-size: 12px; color: #868e96; flex: 1; }
  .author-label strong { color: #1a1b1e; font-weight: 600; }
  :global(body.dark-mode) .author-label strong { color: #c1c2c5; }

  .timestamp { font-size: 11px; color: #5c5f66; white-space: nowrap; flex-shrink: 0; }
  .timestamp:hover { color: #868e96; }

  .feed-card-body { padding: 12px 16px 14px; display: flex; flex-direction: column; gap: 6px; }


  .feed-error { color: #ff6b6b; font-size: 13px; margin: 0; }
  .feed-empty { color: #868e96; font-size: 14px; text-align: center; padding: 32px 0; }

  .card-title {
    font-size: 15px; font-weight: 700; margin: 0; color: #1a1b1e;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  :global(body.dark-mode) .card-title { color: #e7e7e7; }

  .card-desc {
    font-size: 12px; color: #909296; margin: 0;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }

  .stop-badge {
    display: inline-block; background: rgba(77, 171, 247, 0.1); color: #4dabf7;
    font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; align-self: flex-start;
  }

  /* ── Trail detail ── */
  .trail-detail { display: flex; flex-direction: column; gap: 16px; }

  .back-btn {
    background: none; border: none; color: #4dabf7; font-size: 13px;
    cursor: pointer; padding: 0; text-align: left; font-family: inherit;
  }

  .trail-title { font-size: 24px; font-weight: 900; margin: 0; color: #1a1b1e; }
  :global(body.dark-mode) .trail-title { color: #e7e7e7; }
  .trail-desc { font-size: 14px; color: #909296; margin: 0; line-height: 1.5; }

  .stops-list { display: flex; flex-direction: column; gap: 10px; }

  .stop-row {
    display: flex; align-items: flex-start; gap: 14px;
    background: #fff; border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 10px; padding: 14px 16px;
  }
  :global(body.dark-mode) .stop-row {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .stop-num {
    width: 28px; height: 28px; border-radius: 50%; background: #1185fe; color: white;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 13px; flex-shrink: 0;
  }

  .stop-content { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
  .stop-url { font-size: 13px; color: #4dabf7; word-break: break-all; text-decoration: none; font-weight: 500; }
  .stop-url:hover { text-decoration: underline; }
  .stop-note { font-size: 12px; color: #909296; margin: 0; line-height: 1.5; }

  .walk-btn {
    padding: 12px 24px; background: #1185fe; color: white; border: none;
    border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer;
    align-self: flex-start; font-family: inherit; transition: background 0.15s;
  }
  .walk-btn:hover { background: #0070e0; }
</style>
