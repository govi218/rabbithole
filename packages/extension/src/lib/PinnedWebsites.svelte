<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Button } from "@svelteuidev/core";
  import { OpenInNewWindow } from "radix-icons-svelte";
  import TimelineCard from "src/lib/TimelineCard.svelte";
  import CollapsibleContainer from "src/lib/CollapsibleContainer.svelte";
  import { MessageRequest } from "../utils";
  import type { Rabbithole, Website } from "src/utils/types";

  const dispatch = createEventDispatcher();

  export let activeRabbithole: Rabbithole | null = null;
  export let websites: Website[] = [];

  let isOpen: boolean = true;

  $: activeContainer = activeRabbithole;

  $: burrowHomeWebsites = (() => {
    if (
      !activeContainer?.activeTabs ||
      activeContainer.activeTabs.length === 0
    ) {
      return [];
    }
    // Map URLs to website objects from the main list
    // Note: This assumes all active tabs are also in the main saved list, which they should be after sync
    return activeContainer.activeTabs
      .map((url) => websites.find((w) => w.url === url))
      .filter(Boolean);
  })();

  $: hasBurrowHome = burrowHomeWebsites.length > 0;

  // If Burrow Home becomes empty, reset open state so it doesn't "stick"
  $: if (!hasBurrowHome && !isOpen) {
    isOpen = true;
  }

  async function openAllBurrowHomeTabs(): Promise<void> {
    if (activeContainer?.activeTabs && activeContainer.activeTabs.length > 0) {
      await chrome.runtime.sendMessage({
        type: "OPEN_TABS",
        urls: activeContainer.activeTabs,
      });
    }
  }

  async function removeFromBurrowHome(url: string): Promise<void> {
    if (activeRabbithole) {
      await chrome.runtime.sendMessage({
        type: MessageRequest.REMOVE_FROM_ACTIVE_TABS,
        rabbitholeId: activeRabbithole.id,
        url: url,
      });
    }

    if (activeContainer && activeContainer.activeTabs) {
      activeContainer.activeTabs = activeContainer.activeTabs.filter(
        (u) => u !== url,
      );
    }
  }

  function handleToggle(e: CustomEvent<any>): void {
    isOpen = e.detail.open;
  }

  function handleOpenAllClick(e: CustomEvent<any>): void {
    // Prevent toggling collapse when clicking "Open All"
    e.stopPropagation();
    openAllBurrowHomeTabs();
  }

  function handleWebsiteUpdate(e: CustomEvent<any>): void {
    dispatch("websiteUpdate", e.detail);
  }
</script>

{#if hasBurrowHome}
  <div class="burrow-home-wrapper">
    <CollapsibleContainer
      title="Pinned Websites"
      open={isOpen}
      on:toggle={handleToggle}
      defaultOpen={true}
    >
      <div class="header-actions">
        <Button
          class="open-all-btn"
          variant="subtle"
          compact
          size="xs"
          on:click={handleOpenAllClick}
        >
          <svelte:fragment slot="leftIcon">
            <OpenInNewWindow size={13} />
          </svelte:fragment>
          Open All
        </Button>
      </div>

      <div class="horizontal-list" aria-label="Pinned websites">
        {#each burrowHomeWebsites as site (site.url)}
          <div class="card-wrap">
            <TimelineCard
              website={site}
              on:websiteDelete={() => removeFromBurrowHome(site.url)}
              on:websiteUpdate={handleWebsiteUpdate}
            />
          </div>
        {/each}
      </div>
    </CollapsibleContainer>
  </div>
{/if}

<style>
  .burrow-home-wrapper {
    margin-bottom: 32px;
  }

  :global(body.dark-mode .burrow-home-title) {
    color: rgba(255, 255, 255, 0.65);
  }

  .header-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 10px;
  }

  .horizontal-list {
    display: flex;
    gap: 11px;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 5px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }

  .card-wrap {
    flex: 0 0 288px;
    scroll-snap-align: start;
  }

  /* Scrollbar styling */
  .horizontal-list::-webkit-scrollbar {
    height: 8px;
  }

  .horizontal-list::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.12);
    border-radius: 999px;
  }

  :global(body.dark-mode) .horizontal-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.14);
  }

  @media (max-width: 640px) {
    .card-wrap {
      flex-basis: 240px;
    }
  }
</style>
