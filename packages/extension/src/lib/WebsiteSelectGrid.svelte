<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Website } from "src/utils/types";
  import TimelineCard from "./TimelineCard.svelte";
  import { Button } from "@svelteuidev/core";
  import { isValidWebUrl } from "src/utils/browser";

  export let websites: Website[] = [];
  export let mode: "Burrow" | "Trail" = "Burrow";

  const dispatch = createEventDispatcher();

  let selectedUrls: string[] = [];

  function toggleSelection(url: string) {
    const idx = selectedUrls.indexOf(url);
    if (idx >= 0) {
      selectedUrls = selectedUrls.filter((u) => u !== url);
    } else {
      selectedUrls = [...selectedUrls, url];
    }
  }

  async function selectFromOpenTabs() {
    // Use lastFocusedWindow so we get the actual browser window, not the
    // extension popup window. This ensures all real tabs are captured.
    const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
    const openUrls = tabs.map((t) => t.url).filter((url) => isValidWebUrl(url));

    // Add any open-tab URLs that aren't already in the websites list
    const existingUrls = new Set(websites.map((w) => w.url));
    for (const url of openUrls) {
      if (!existingUrls.has(url)) {
        const tab = tabs.find((t) => t.url === url);
        websites = [
          ...websites,
          {
            url,
            name: tab?.title || url,
            savedAt: Date.now(),
            faviconUrl: tab?.favIconUrl || "",
          },
        ];
      }
    }

    const merged = new Set([...selectedUrls, ...openUrls]);
    selectedUrls = [...merged];
  }
</script>

<div class="select-grid-container">
  <div class="select-header">
    <div class="select-title">Select websites for {mode}</div>
    <div class="select-actions">
      <Button variant="subtle" color="gray" on:click={() => dispatch("cancel")}
        >Cancel</Button
      >
      <Button variant="light" on:click={selectFromOpenTabs}>
        Add open tabs
      </Button>
      <Button
        on:click={() => dispatch("done", { selectedUrls })}
        disabled={selectedUrls.length === 0}
      >
        Done ({selectedUrls.length})
      </Button>
    </div>
  </div>
  <div class="grid-feed">
    {#each websites as site}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        class="grid-item selectable"
        class:selected={selectedUrls.includes(site.url)}
        on:click={() => toggleSelection(site.url)}
      >
        <div class="click-overlay"></div>
        <TimelineCard website={site} showDelete={false} fixedHeight={true} />
        {#if selectedUrls.includes(site.url)}
          <div class="selection-badge">
            {selectedUrls.indexOf(site.url) + 1}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .select-grid-container {
    width: 100%;
    padding-bottom: 32px;
  }
  .select-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    background: rgba(255, 255, 255, 0.8);
    padding: 16px 24px;
    border-radius: 12px;
    border: 1px solid rgba(0, 0, 0, 0.08);
  }
  .select-title {
    font-size: 18px;
    font-weight: 800;
    color: #1a1b1e;
  }
  .select-actions {
    display: flex;
    gap: 12px;
  }
  .grid-feed {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(224px, 1fr));
    gap: 16px;
    width: 100%;
  }
  .grid-item {
    height: 100%;
  }
  .selectable {
    position: relative;
    cursor: pointer;
    transition: transform 0.2s;
  }
  .selectable:hover {
    transform: translateY(-2px);
  }
  .click-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
  }
  .selection-badge {
    position: absolute;
    top: -10px;
    right: -10px;
    background: #1185fe;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 14px;
    z-index: 11;
    box-shadow: 0 4px 8px rgba(17, 133, 254, 0.4);
  }
  .selected {
    outline: 3px solid #1185fe;
    border-radius: 8px;
  }
  :global(body.dark-mode) .select-header {
    background: rgba(37, 38, 43, 0.8);
    border-color: rgba(255, 255, 255, 0.12);
  }
  :global(body.dark-mode) .select-title {
    color: #e7e7e7;
  }
</style>
