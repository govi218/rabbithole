<script lang="ts">
  import type { ActorTrail, ActorCollection } from "../atproto/explore";
  import { resolveHandle, fetchActorTrails, fetchActorCollections } from "../atproto/explore";

  export let isExtension: boolean = false;
  export let onWalkTrail: ((trail: ActorTrail) => void) | undefined = undefined;

  let handleInput = "";
  let isLoading = false;
  let error: string | null = null;
  let trails: ActorTrail[] = [];
  let collections: ActorCollection[] = [];
  let activeTab: "trails" | "collections" = "trails";
  let selectedTrail: ActorTrail | null = null;
  let hasSearched = false;

  async function search() {
    if (!handleInput.trim()) return;
    isLoading = true;
    error = null;
    trails = [];
    collections = [];
    hasSearched = false;
    try {
      let handle = handleInput.trim();
      if (!handle.includes(".")) handle = `${handle}.bsky.social`;
      const did = await resolveHandle(handle);
      [trails, collections] = await Promise.all([
        fetchActorTrails(did),
        fetchActorCollections(did),
      ]);
      hasSearched = true;
      if (trails.length > 0) activeTab = "trails";
      else if (collections.length > 0) activeTab = "collections";
    } catch (e: any) {
      error = e.message || "Failed to load profile";
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") search();
  }
</script>

<div class="explore-container">
  <div class="explore-search">
    <input
      type="text"
      placeholder="Enter a handle (e.g. jay.bsky.social)"
      bind:value={handleInput}
      on:keydown={handleKeydown}
      class="explore-input"
    />
    <button class="explore-btn" on:click={search} disabled={isLoading}>
      {isLoading ? "Loading..." : "Explore"}
    </button>
  </div>

  {#if error}
    <p class="explore-error">{error}</p>
  {/if}

  {#if hasSearched}
    {#if trails.length === 0 && collections.length === 0}
      <p class="explore-empty">No published trails or collections found.</p>
    {:else}
      <div class="explore-tabs">
        <button
          class="tab-btn"
          class:active={activeTab === "trails"}
          on:click={() => { activeTab = "trails"; selectedTrail = null; }}
        >
          Trails ({trails.length})
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === "collections"}
          on:click={() => { activeTab = "collections"; selectedTrail = null; }}
        >
          Collections ({collections.length})
        </button>
      </div>

      {#if selectedTrail}
        <div class="trail-detail">
          <button class="back-btn" on:click={() => selectedTrail = null}>← Back</button>
          <h2 class="trail-title">{selectedTrail.title}</h2>
          {#if selectedTrail.description}
            <p class="trail-desc">{selectedTrail.description}</p>
          {/if}
          <ol class="stops-list">
            {#each selectedTrail.stops as stop, i}
              <li class="stop-item">
                <a href={stop.url} target="_blank" rel="noopener noreferrer" class="stop-url">{stop.url}</a>
                {#if stop.note}
                  <p class="stop-note">{stop.note}</p>
                {/if}
              </li>
            {/each}
          </ol>
          {#if isExtension && onWalkTrail}
            <button class="walk-btn" on:click={() => onWalkTrail(selectedTrail)}>
              Walk this trail
            </button>
          {/if}
        </div>
      {:else if activeTab === "trails"}
        <div class="results-grid">
          {#each trails as trail}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div class="result-card" on:click={() => selectedTrail = trail}>
              <h3 class="card-title">{trail.title}</h3>
              {#if trail.description}
                <p class="card-desc">{trail.description}</p>
              {/if}
              <span class="card-meta">{trail.stops.length} stop{trail.stops.length !== 1 ? "s" : ""}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="results-grid">
          {#each collections as col}
            <div class="result-card">
              <h3 class="card-title">{col.name}</h3>
              <span class="card-meta">{col.urls.length} URL{col.urls.length !== 1 ? "s" : ""}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .explore-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 24px;
    max-width: 800px;
    margin: 0 auto;
  }

  .explore-search {
    display: flex;
    gap: 8px;
  }

  .explore-input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    background: white;
    color: #333;
  }

  .explore-input:focus {
    border-color: #1185fe;
  }

  .explore-btn {
    padding: 10px 20px;
    background: #1185fe;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  .explore-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .explore-error {
    color: #dc3545;
    font-size: 13px;
    margin: 0;
  }

  .explore-empty {
    color: #868e96;
    font-size: 14px;
    text-align: center;
    padding: 32px 0;
  }

  .explore-tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid #dee2e6;
    padding-bottom: 0;
  }

  .tab-btn {
    padding: 8px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    color: #868e96;
    cursor: pointer;
    margin-bottom: -1px;
  }

  .tab-btn.active {
    color: #1185fe;
    border-bottom-color: #1185fe;
    font-weight: 500;
  }

  .results-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .result-card {
    padding: 14px;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .result-card:hover {
    border-color: #1185fe;
    box-shadow: 0 2px 8px rgba(17, 133, 254, 0.1);
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 4px;
    color: #1a1b1e;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-desc {
    font-size: 12px;
    color: #868e96;
    margin: 0 0 8px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .card-meta {
    font-size: 11px;
    color: #adb5bd;
  }

  .trail-detail {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .back-btn {
    background: none;
    border: none;
    color: #1185fe;
    font-size: 13px;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .trail-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #1a1b1e;
  }

  .trail-desc {
    font-size: 14px;
    color: #495057;
    margin: 0;
  }

  .stops-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-left: 20px;
    margin: 0;
  }

  .stop-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stop-url {
    font-size: 13px;
    color: #1185fe;
    word-break: break-all;
    text-decoration: none;
  }

  .stop-url:hover {
    text-decoration: underline;
  }

  .stop-note {
    font-size: 12px;
    color: #495057;
    margin: 0;
  }

  .walk-btn {
    padding: 10px 20px;
    background: #1185fe;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    align-self: flex-start;
  }

  /* Dark mode */
  :global(body.dark-mode) .explore-input {
    background: #2c2e33;
    border-color: #3a3b3c;
    color: #e4e6eb;
  }

  :global(body.dark-mode) .result-card {
    border-color: #3a3b3c;
    background: #25262b;
  }

  :global(body.dark-mode) .result-card:hover {
    border-color: #1185fe;
  }

  :global(body.dark-mode) .card-title,
  :global(body.dark-mode) .trail-title {
    color: #e4e6eb;
  }

  :global(body.dark-mode) .trail-desc,
  :global(body.dark-mode) .stop-note {
    color: #c1c2c5;
  }

  :global(body.dark-mode) .explore-tabs {
    border-bottom-color: #3a3b3c;
  }
</style>
