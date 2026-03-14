<script lang="ts">
  import { onMount } from "svelte";
  import {
    Group,
    Tooltip,
    ActionIcon,
    Text,
    Button,
    Input,
    Textarea,
  } from "@svelteuidev/core";
  import Options from "./Options.svelte";
  import ContainerSelector from "src/lib/ContainerSelector.svelte";
  import { MessageRequest, NotificationDuration, Logger } from "../utils";
  import { Move, EyeNone, Update, Check, Cross2 } from "radix-icons-svelte";
  import type {
    Burrow,
    Rabbithole,
    Settings,
    Trail,
    TrailStop,
    TrailWalk,
    TrailWalkState,
    Website,
  } from "src/utils/types";

  export let isPopup: boolean = false;
  export let trailMode: boolean = false;

  let settings: Settings | null = null;
  let alignment: "left" | "right" = "right";
  let show: boolean = false;
  let burrows: Burrow[] = [];
  let rabbitholes: Rabbithole[] = [];
  let selectedBurrow: Burrow | null = null;
  let selectedRabbithole: Rabbithole | null = null;
  let isSyncingWindow: boolean = false;
  let syncWindowSuccess: boolean = false;
  let showOverlayHelp: boolean = false;

  // Save Page State
  let isSavingPage: boolean = false;
  let pageTitle: string = "";
  let pageDescription: string = "";
  let pageUrl: string = "";
  let isSaving: boolean = false;
  let saveSuccess: boolean = false;

  // trail walk state
  let trail: Trail | null = null;
  let walk: TrailWalk | null = null;
  let trailWebsites: Website[] = [];

  $: visitedCount = walk?.visitedStops?.length ?? 0;
  $: currentStop = (trail?.stops?.[visitedCount] ?? null) as TrailStop | null;
  $: totalStops = trail?.stops?.length ?? 0;

  function getTrailWebsite(url: string): Website | undefined {
    return trailWebsites.find((w) => w.url === url);
  }

  async function refreshTrailWalk(): Promise<void> {
    const activeTrail: Trail | null = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ACTIVE_TRAIL,
    });
    if (!activeTrail) {
      trail = null;
      walk = null;
      return;
    }
    const res: TrailWalkState = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_TRAIL_WALK_STATE,
      trailId: activeTrail.id,
    });
    trail = res.trail;
    walk = res.walk;
    trailWebsites = res.websites;
  }

  async function advanceTrail(): Promise<void> {
    if (!currentStop || !trail) return;

    walk = await chrome.runtime.sendMessage({
      type: MessageRequest.ADVANCE_TRAIL_WALK,
      trailId: trail.id,
      websiteUrl: currentStop.websiteUrl,
    });

    const nextStop: TrailStop | undefined =
      trail.stops[walk.visitedStops.length];

    if (!nextStop) {
      await chrome.runtime.sendMessage({
        type: MessageRequest.COMPLETE_TRAIL_WALK,
        trailId: trail.id,
      });
      const trailPageUrl = chrome.runtime.getURL(
        `src/trail/trail.html?trailId=${trail.id}&completed=1`,
      );
      window.location.href = trailPageUrl;
      return;
    }

    // If the next stop has a note, navigate back to the trail page to show it
    if (nextStop.note && nextStop.note.trim()) {
      const trailPageUrl = chrome.runtime.getURL(
        `src/trail/trail.html?trailId=${trail.id}&showNote=1`,
      );
      window.location.href = trailPageUrl;
    } else {
      window.location.href = nextStop.websiteUrl;
    }
  }

  async function goBackTrail(): Promise<void> {
    if (!trail || !walk || visitedCount === 0) return;
    const prevUrl: string = walk.visitedStops[visitedCount - 1];
    walk = await chrome.runtime.sendMessage({
      type: MessageRequest.REWIND_TRAIL_WALK,
      trailId: trail.id,
    });
    window.location.href = prevUrl;
  }

  async function abandonTrail(): Promise<void> {
    if (!trail) return;
    await chrome.runtime.sendMessage({
      type: MessageRequest.ABANDON_TRAIL_WALK,
      trailId: trail.id,
    });
    walk = null;
    trail = null;
  }

  function orderBurrows(activeBurrowId: string | null): void {
    if (!activeBurrowId) return;
    for (let i = 0; i < burrows.length; i++) {
      if (burrows[i].id === activeBurrowId) {
        const temp = burrows[0];
        burrows[0] = burrows[i];
        burrows[i] = temp;
        break;
      }
    }
  }

  function orderRabbitholes(activeRabbitholeId: string | null): void {
    if (!activeRabbitholeId) return;
    for (let i = 0; i < rabbitholes.length; i++) {
      if (rabbitholes[i].id === activeRabbitholeId) {
        const [active] = rabbitholes.splice(i, 1);
        rabbitholes.unshift(active);
        break;
      }
    }
  }

  async function fetchAll(): Promise<void> {
    burrows = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ALL_BURROWS,
    });
    rabbitholes = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ALL_RABBITHOLES,
    });
  }

  async function refreshActiveContainers(): Promise<void> {
    const activeBurrow: Burrow | null = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ACTIVE_BURROW,
    });
    const activeRabbithole: Rabbithole | null =
      await chrome.runtime.sendMessage({
        type: MessageRequest.GET_ACTIVE_RABBITHOLE,
      });
    selectedBurrow = activeBurrow;
    selectedRabbithole = activeRabbithole;

    orderBurrows(selectedBurrow?.id || null);
    orderRabbitholes(selectedRabbithole?.id || null);
  }

  async function refreshSettings(): Promise<void> {
    settings = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_SETTINGS,
    });
    alignment = settings.alignment;
    show = settings.show;
  }

  export async function refreshData(): Promise<void> {
    await fetchAll();
    await refreshActiveContainers();
    await refreshSettings();
    if (trailMode) {
      await refreshTrailWalk();
    }
  }

  function dismissOverlayHelp(): void {
    if (showOverlayHelp) {
      showOverlayHelp = false;
      chrome.storage.local.set({ hasSeenOverlayHelpV2: true });
    }
  }

  function handleWindowClick(): void {
    dismissOverlayHelp();
  }

  onMount(async () => {
    settings = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_SETTINGS,
    });
    alignment = settings.alignment;
    show = settings.show;
    await fetchAll();
    await refreshActiveContainers();

    if (trailMode) {
      await refreshTrailWalk();
    }

    if (!isPopup && !trailMode) {
      chrome.storage.local.get("hasSeenOverlayHelpV2", (result) => {
        if (!result.hasSeenOverlayHelpV2) {
          setTimeout(() => {
            showOverlayHelp = true;
            setTimeout(() => {
              dismissOverlayHelp();
            }, 3000);
          }, 1000);
        }
      });
    }
  });

  export function changeAlignment(): void {
    alignment = alignment === "left" ? "right" : "left";
    chrome.runtime.sendMessage({
      type: MessageRequest.UPDATE_SETTINGS,
      settings: { ...settings, alignment },
    });
  }

  export async function hideOverlay(): Promise<void> {
    show = false;
    dismissOverlayHelp();
    chrome.runtime.sendMessage({
      type: MessageRequest.UPDATE_SETTINGS,
      settings: { ...settings, show },
    });
  }

  async function handleBurrowChange(burrowId: string): Promise<void> {
    await chrome.runtime.sendMessage({
      type: MessageRequest.CHANGE_ACTIVE_BURROW,
      burrowId: burrowId,
    });
    selectedRabbithole = await chrome.runtime.sendMessage({
      type: MessageRequest.FETCH_RABBITHOLE_FOR_BURROW,
      burrowId: burrowId,
    });

    selectedBurrow = burrows.find((b) => b.id === burrowId) || null;
    orderBurrows(burrowId);
    orderRabbitholes(selectedRabbithole.id || null);
  }

  async function handleRabbitholeChange(rabbitholeId: string): Promise<void> {
    await chrome.runtime.sendMessage({
      type: MessageRequest.CHANGE_ACTIVE_RABBITHOLE,
      rabbitholeId: rabbitholeId,
    });
    await chrome.runtime.sendMessage({
      type: MessageRequest.CHANGE_ACTIVE_BURROW,
      burrowId: null,
    });
    selectedRabbithole = rabbitholes.find((r) => r.id === rabbitholeId) || null;
    selectedBurrow = null;
    orderRabbitholes(rabbitholeId);
  }

  async function saveAllTabsToActiveBurrow(): Promise<void> {
    isSyncingWindow = true;
    try {
      await chrome.runtime.sendMessage({
        type: MessageRequest.SAVE_WINDOW_TO_ACTIVE_BURROW,
      });
      syncWindowSuccess = true;
      setTimeout(() => {
        syncWindowSuccess = false;
      }, NotificationDuration);
    } catch (e) {
      Logger.error(e);
    } finally {
      isSyncingWindow = false;
    }
  }

  async function initSavePage(): Promise<void> {
    if (isPopup) {
      // in the popup context, the DOM is the extension popup
      // so ask the active tab for its title/meta instead
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (tab) {
          pageTitle = tab.title || "";
          pageUrl = tab.url || "";
        }
      } catch (e) {
        Logger.error("Failed to read active tab metadata:", e);
      }
    } else {
      // Content-script overlay: we have direct access to the page DOM.
      pageTitle = document.title;
      pageUrl = window.location.href;

      const metaDesc = document.querySelector('meta[name="description"]');
      const ogDesc = document.querySelector('meta[property="og:description"]');
      pageDescription = metaDesc
        ? metaDesc.getAttribute("content")
        : ogDesc
          ? ogDesc.getAttribute("content")
          : "";
    }

    isSavingPage = true;
  }

  function cancelSavePage(): void {
    isSavingPage = false;
    pageTitle = "";
    pageDescription = "";
  }

  async function savePage(): Promise<void> {
    isSaving = true;
    try {
      // 1. Save the tab (creates the website record)
      await chrome.runtime.sendMessage({
        type: MessageRequest.SAVE_TAB,
      });

      // 2. Update with user's custom metadata
      await chrome.runtime.sendMessage({
        type: MessageRequest.UPDATE_WEBSITE,
        url: pageUrl,
        name: pageTitle,
        description: pageDescription,
      });

      // 3. If we have an active rabbithole, add to its meta
      const activeRabbithole: Rabbithole | null =
        await chrome.runtime.sendMessage({
          type: MessageRequest.GET_ACTIVE_RABBITHOLE,
        });
      if (activeRabbithole) {
        await chrome.runtime.sendMessage({
          type: MessageRequest.ADD_WEBSITES_TO_RABBITHOLE_META,
          rabbitholeId: activeRabbithole.id,
          urls: [pageUrl],
        });
      }

      saveSuccess = true;
      setTimeout(() => {
        saveSuccess = false;
        isSavingPage = false;
      }, 500);
    } catch (e) {
      Logger.error("Failed to save page:", e);
    } finally {
      isSaving = false;
    }
  }
</script>

<svelte:window on:click={handleWindowClick} />

{#if show || isPopup || trailMode}
  <div
    id="rabbithole-overlay-container"
    class="rabbithole-overlay rabbithole-{alignment}"
    class:rabbithole-popup={isPopup}
    class:rabbithole-trail={trailMode}
  >
    {#if !isPopup}
      <div class="rabbithole-header">
        <Text size="sm" weight="bold" class="rabbithole-icon">
          {#if trailMode && trail}
            🐾 {trail.name}
          {:else}
            Rabbithole
          {/if}
        </Text>
        <Group spacing="xs">
          {#if !trailMode}
            <Tooltip
              label="Save all tabs in window to current burrow"
              withArrow
            >
              <div class="icon-wrapper">
                <ActionIcon
                  on:click={saveAllTabsToActiveBurrow}
                  size="sm"
                  class="rabbithole-icon header-icon"
                  disabled={isSyncingWindow}
                >
                  <Update />
                </ActionIcon>
                {#if syncWindowSuccess}
                  <div class="success-check-icon">
                    <Check size={12} />
                  </div>
                {/if}
              </div>
            </Tooltip>
            <Tooltip label="Move Position" withArrow>
              <ActionIcon
                on:click={changeAlignment}
                size="sm"
                class="rabbithole-icon header-icon"
              >
                <Move />
              </ActionIcon>
            </Tooltip>
            <Tooltip
              label={"Hide Overlay (You can show/hide anytime using popup or settings)"}
              opened={showOverlayHelp || undefined}
              withArrow
            >
              <ActionIcon
                on:click={(e) => {
                  e.stopPropagation();
                  hideOverlay();
                }}
                size="sm"
                class="rabbithole-icon header-icon"
              >
                <EyeNone />
              </ActionIcon>
            </Tooltip>
          {:else}
            <Tooltip label="Abandon trail" withArrow>
              <ActionIcon
                on:click={abandonTrail}
                size="sm"
                class="rabbithole-icon header-icon abandon-icon"
              >
                <Cross2 />
              </ActionIcon>
            </Tooltip>
          {/if}
        </Group>
      </div>
    {/if}

    <div class="rabbithole-content">
      {#if trailMode && trail && walk && !walk.completed}
        <div class="trail-progress-dots">
          {#each trail.stops as stop, i}
            <div
              class="dot"
              class:visited={walk.visitedStops.includes(stop.websiteUrl)}
              class:current={i === visitedCount}
              title={getTrailWebsite(stop.websiteUrl)?.name ?? stop.websiteUrl}
            ></div>
          {/each}
        </div>
        <div class="trail-step-info">
          {#if currentStop}
            <div class="trail-step-label">
              Stop {visitedCount + 1} of {totalStops}
            </div>
            <div class="trail-step-name">
              {getTrailWebsite(currentStop.websiteUrl)?.name ??
                currentStop.websiteUrl}
            </div>
          {:else}
            <div class="trail-step-label">All stops visited!</div>
          {/if}
        </div>
        <div class="trail-nav-actions">
          <button
            class="trail-nav-btn"
            on:click={goBackTrail}
            disabled={visitedCount === 0}>←</button
          >
          <button
            class="trail-nav-btn primary"
            on:click={advanceTrail}
            disabled={!currentStop}
          >
            {visitedCount + 1 < totalStops ? "Next →" : "Done ✓"}
          </button>
        </div>
      {:else if trailMode && (!walk || walk?.completed)}
        <div class="trail-done">
          <div class="trail-step-label">Trail complete 🎉</div>
        </div>
      {:else if isSavingPage}
        <div class="save-page-form">
          <div class="form-header">
            <Text size="xs" weight="bold" color="dimmed">Save to Burrow</Text>
            <ActionIcon size="xs" on:click={cancelSavePage}>
              <Cross2 />
            </ActionIcon>
          </div>

          <Input
            placeholder="Title"
            bind:value={pageTitle}
            size="xs"
            class="save-input"
          />

          <Textarea
            placeholder="Description"
            bind:value={pageDescription}
            size="xs"
            minRows={2}
            maxRows={4}
            autosize
            class="save-input"
          />

          <Button
            size="xs"
            on:click={savePage}
            loading={isSaving}
            color={saveSuccess ? "green" : "blue"}
          >
            {saveSuccess ? "Saved!" : "Save Page"}
          </Button>
        </div>
      {:else}
        <div class="container-selector-wrapper">
          <ContainerSelector
            {burrows}
            {rabbitholes}
            {handleBurrowChange}
            {handleRabbitholeChange}
            bind:selectedBurrow
            bind:selectedRabbithole
            dropdownDirection={isPopup ? "down" : "up"}
            allowCreate={true}
          />
        </div>
        <div class="rabbithole-options-wrapper">
          <Options on:save={initSavePage} />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .rabbithole-overlay {
    z-index: 2147483647;
    width: 260px;
    position: fixed;
    bottom: 24px;
    background-color: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    border: 1px solid rgba(0, 0, 0, 0.05);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: all 0.3s ease;
  }

  .rabbithole-overlay:hover {
    background-color: rgba(255, 255, 255, 0.95);
  }

  .rabbithole-overlay.rabbithole-trail {
    border-color: rgba(17, 133, 254, 0.25);
    background-color: rgba(255, 255, 255, 0.6);
  }

  .rabbithole-overlay.rabbithole-trail:hover {
    background-color: rgba(255, 255, 255, 0.97);
  }

  .rabbithole-overlay.rabbithole-popup {
    position: static;
    width: 100%;
    height: 100%;
    border-radius: 0;
    border: none;
    background-color: transparent;
    box-shadow: none;
    padding: 0;
    z-index: auto;
    gap: 16px;
    outline: none;
  }

  .rabbithole-overlay.rabbithole-popup:hover {
    background-color: transparent;
  }

  .rabbithole-overlay.rabbithole-popup .rabbithole-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .rabbithole-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .rabbithole-right {
    right: 24px;
  }

  .rabbithole-left {
    left: 24px;
  }

  .container-selector-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .rabbithole-overlay.rabbithole-popup .container-selector-wrapper {
    margin-bottom: 0;
  }

  .rabbithole-options-wrapper {
    width: 100%;
  }

  .rabbithole-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .save-page-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(255, 255, 255, 0.5);
    padding: 8px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .trail-progress-dots {
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

  .trail-step-info {
    text-align: center;
  }

  .trail-step-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #868e96;
    margin-bottom: 4px;
  }

  .trail-step-name {
    font-size: 13px;
    font-weight: 700;
    color: #1a1b1e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .trail-nav-actions {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .trail-nav-btn {
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    color: #495057;
    transition: all 0.2s;
  }

  .trail-nav-btn:hover:not(:disabled) {
    background: #f1f3f5;
  }

  .trail-nav-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .trail-nav-btn.primary {
    background: #1185fe;
    color: white;
    border-color: #1185fe;
  }

  .trail-nav-btn.primary:hover:not(:disabled) {
    background: #0070e0;
  }

  .trail-done {
    text-align: center;
    padding: 8px 0;
  }

  :global(.abandon-icon svg) {
    color: #e03131 !important;
  }

  :global(.save-input input),
  :global(.save-input textarea) {
    background-color: rgba(255, 255, 255, 0.8) !important;
  }

  :global(.rabbithole-icon) {
    color: white !important;
  }

  :global(.rabbithole-icon svg) {
    color: white !important;
  }

  :global(.rabbithole-icon.header-icon:hover) {
    background-color: rgba(255, 255, 255, 0.15) !important;
  }

  .icon-wrapper {
    position: relative;
    display: inline-flex;
  }

  .success-check-icon {
    position: absolute;
    bottom: -2px;
    right: -2px;
    background-color: rgba(64, 192, 87, 0.9);
    border-radius: 50%;
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    pointer-events: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  @media (prefers-color-scheme: dark) {
    .rabbithole-overlay:not(.rabbithole-popup) {
      background-color: rgba(37, 38, 43, 0.4);
      border-color: rgba(255, 255, 255, 0.1);
      color: white;
    }
    .rabbithole-overlay:not(.rabbithole-popup):hover {
      background-color: rgba(37, 38, 43, 0.95);
    }
    .rabbithole-overlay.rabbithole-trail:not(.rabbithole-popup) {
      border-color: rgba(77, 171, 247, 0.3);
    }
    .rabbithole-overlay.rabbithole-popup {
      background-color: transparent;
    }
    .rabbithole-overlay.rabbithole-popup:hover {
      background-color: transparent;
    }
    :global(.rabbithole-icon.header-icon:hover) {
      background-color: rgba(255, 255, 255, 0.1) !important;
    }
    .save-page-form {
      background: rgba(0, 0, 0, 0.2);
      border-color: rgba(255, 255, 255, 0.1);
    }
    :global(.save-input input),
    :global(.save-input textarea) {
      background-color: rgba(0, 0, 0, 0.3) !important;
      color: white !important;
      border-color: rgba(255, 255, 255, 0.1) !important;
    }
    .trail-step-name {
      color: #e7e7e7;
    }
    .trail-nav-btn {
      background: #25262b;
      border-color: rgba(255, 255, 255, 0.12);
      color: #c1c2c5;
    }
    .trail-nav-btn:hover:not(:disabled) {
      background: #2c2e33;
    }
  }
</style>
