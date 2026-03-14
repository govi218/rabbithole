<script lang="ts">
  import { afterUpdate, createEventDispatcher } from "svelte";
  import {
    ActionIcon,
    TextInput,
    Text,
    Stack,
    Loader,
    Button,
  } from "@svelteuidev/core";
  import { Cross2, MagnifyingGlass, Plus } from "radix-icons-svelte";
  import Fuse from "fuse.js";
  import CollapsibleContainer from "./CollapsibleContainer.svelte";
  import { MessageRequest, Logger } from "../utils";
  import type { Burrow, Rabbithole } from "src/utils/types";
  import NameInputModal from "src/lib/NameInputModal.svelte";

  export let isOpen: boolean = false;
  export let websiteUrl: string = "";
  export let currentRabbitholeId: string = "";
  export let currentBurrowId: string | null = null;

  const dispatch = createEventDispatcher();

  let searchQuery: string = "";
  let allRabbitholes: Rabbithole[] = [];
  let allBurrows: Burrow[] = [];
  let filtered: Rabbithole[] = [];
  let isLoading: boolean = false;
  let isMoving: boolean = false;
  let inputRef: HTMLElement;

  let wasOpen: boolean = false;

  let showNameModal: boolean = false;
  let nameModalResolve: ((value: string | null) => void) | null = null;

  function promptName(): Promise<string | null> {
    showNameModal = true;
    return new Promise((resolve) => {
      nameModalResolve = resolve;
    });
  }
  // Track open state of rabbitholes in the list
  let openRabbitholes: Record<string, boolean> = {};

  afterUpdate(() => {
    if (isOpen && !showNameModal && inputRef) {
      const input = inputRef.querySelector("input");
      if (input) input.focus();
    }
  });

  function close(): void {
    isOpen = false;
    searchQuery = "";
    filtered = [];
    openRabbitholes = {};
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && isOpen) {
      close();
    }
  }

  async function loadData(): Promise<void> {
    isLoading = true;
    try {
      const [rhRes, bRes] = await Promise.all([
        chrome.runtime.sendMessage({
          type: MessageRequest.GET_ALL_RABBITHOLES,
        }),
        chrome.runtime.sendMessage({ type: MessageRequest.GET_ALL_BURROWS }),
      ]);
      allRabbitholes = Array.isArray(rhRes) ? rhRes : [];
      allBurrows = Array.isArray(bRes) ? bRes : [];
    } catch (err) {
      Logger.error("Failed to load data:", err);
    } finally {
      isLoading = false;
    }
  }

  function performSearch(): void {
    const q = searchQuery.trim();
    if (q.length < 1) {
      filtered = allRabbitholes;
      return;
    }

    const fuse = new Fuse(allRabbitholes, {
      keys: ["title", "description"],
      includeScore: true,
      threshold: 0.35,
    });

    filtered = fuse.search(q).map((r) => r.item);
    // Auto-open filtered results
    filtered.forEach((r) => (openRabbitholes[r.id] = true));
  }

  function getBurrowsFor(rabbithole: Rabbithole): Burrow[] {
    if (!rabbithole.burrows) return [];
    return allBurrows.filter((b) => rabbithole.burrows.includes(b.id));
  }

  async function moveWebsite(
    targetRabbitholeId: string,
    targetBurrowId: string | null,
  ): Promise<void> {
    if (!websiteUrl) return;
    if (
      targetRabbitholeId === currentRabbitholeId &&
      targetBurrowId === currentBurrowId
    ) {
      // Same location
      close();
      return;
    }

    isMoving = true;
    try {
      // 1. Remove from source
      if (currentBurrowId) {
        await chrome.runtime.sendMessage({
          type: MessageRequest.DELETE_WEBSITE,
          burrowId: currentBurrowId,
          url: websiteUrl,
        });
      } else if (currentRabbitholeId) {
        await chrome.runtime.sendMessage({
          type: MessageRequest.DELETE_WEBSITE_FROM_RABBITHOLE_META,
          rabbitholeId: currentRabbitholeId,
          url: websiteUrl,
        });
      }

      // 2. Add to destination
      if (targetBurrowId) {
        const items = await chrome.runtime.sendMessage({
          type: MessageRequest.GET_ALL_ITEMS,
        });
        const website = items.find((w) => w.url === websiteUrl);

        if (website) {
          await chrome.runtime.sendMessage({
            type: "IMPORT_DATA",
            burrows: [
              {
                id: targetBurrowId,
                name: "ignored", // won't overwrite name if ID matches
                websites: [websiteUrl],
              },
            ],
            websites: [website],
          });
        }
      } else {
        // Target is Rabbithole Meta
        await chrome.runtime.sendMessage({
          type: MessageRequest.ADD_WEBSITES_TO_RABBITHOLE_META,
          rabbitholeId: targetRabbitholeId,
          urls: [websiteUrl],
        });
      }

      dispatch("moved");
      close();
    } catch (err) {
      Logger.error("Failed to move website:", err);
    } finally {
      isMoving = false;
    }
  }

  async function createBurrowAndMove(rabbitholeId: string): Promise<void> {
    const name = await promptName();
    if (!name) return;

    isMoving = true;
    try {
      const items = await chrome.runtime.sendMessage({
        type: MessageRequest.GET_ALL_ITEMS,
      });
      const website = items.find((w) => w.url === websiteUrl);

      if (website) {
        // Remove from source first
        if (currentBurrowId) {
          await chrome.runtime.sendMessage({
            type: MessageRequest.DELETE_WEBSITE,
            burrowId: currentBurrowId,
            url: websiteUrl,
          });
        } else if (currentRabbitholeId) {
          await chrome.runtime.sendMessage({
            type: MessageRequest.DELETE_WEBSITE_FROM_RABBITHOLE_META,
            rabbitholeId: currentRabbitholeId,
            url: websiteUrl,
          });
        }

        const newBurrow = await chrome.runtime.sendMessage({
          type: MessageRequest.CREATE_NEW_BURROW,
          newBurrowName: name,
        });
        await chrome.runtime.sendMessage({
          type: MessageRequest.ADD_BURROWS_TO_RABBITHOLE,
          rabbitholeId: rabbitholeId,
          burrowIds: [newBurrow.id],
        });

        await chrome.runtime.sendMessage({
          type: "IMPORT_DATA",
          burrows: [{ id: newBurrow.id, name: name, websites: [websiteUrl] }],
          websites: [website],
        });
      }

      dispatch("moved");
      close();
    } catch (e) {
      Logger.error(e);
    } finally {
      isMoving = false;
    }
  }

  async function onOpen(): Promise<void> {
    searchQuery = "";
    filtered = [];
    openRabbitholes = {};
    if (currentRabbitholeId) {
      openRabbitholes[currentRabbitholeId] = true;
    }
    await loadData();
    filtered = allRabbitholes;
  }

  $: if (isOpen && !wasOpen) {
    wasOpen = true;
    onOpen();
  }

  $: if (!isOpen && wasOpen) {
    wasOpen = false;
  }

  $: if (isOpen) {
    performSearch();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<NameInputModal
  bind:isOpen={showNameModal}
  title="New burrow name"
  placeholder="Burrow name"
  on:confirm={(e) => { nameModalResolve?.(e.detail); nameModalResolve = null; }}
  on:cancel={() => { nameModalResolve?.(null); nameModalResolve = null; }}
/>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click={close}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2 class="modal-title">Move Website</h2>
        <ActionIcon on:click={close}>
          <Cross2 />
        </ActionIcon>
      </div>

      <div class="modal-body">
        <div class="search-input-wrapper" bind:this={inputRef}>
          <TextInput
            placeholder="Search rabbitholes..."
            icon={MagnifyingGlass}
            size="md"
            radius="md"
            bind:value={searchQuery}
          />
        </div>

        {#if isLoading}
          <div class="loading-container">
            <Loader size="md" variant="dots" />
          </div>
        {:else}
          <div class="results-container">
            <Stack spacing="xs">
              {#each filtered as rh (rh.id)}
                <CollapsibleContainer
                  title={rh.title}
                  open={openRabbitholes[rh.id]}
                  on:toggle={(e) => (openRabbitholes[rh.id] = e.detail.open)}
                >
                  <div class="rh-content">
                    <button
                      class="move-option"
                      disabled={isMoving ||
                        (rh.id === currentRabbitholeId && !currentBurrowId)}
                      on:click={() => moveWebsite(rh.id, null)}
                    >
                      <span class="option-name">Main List (Meta)</span>
                      {#if rh.id === currentRabbitholeId && !currentBurrowId}
                        <span class="current-badge">Current</span>
                      {/if}
                    </button>

                    {#each getBurrowsFor(rh) as burrow}
                      <button
                        class="move-option"
                        disabled={isMoving || burrow.id === currentBurrowId}
                        on:click={() => moveWebsite(rh.id, burrow.id)}
                      >
                        <span class="option-name">Burrow: {burrow.name}</span>
                        {#if burrow.id === currentBurrowId}
                          <span class="current-badge">Current</span>
                        {/if}
                      </button>
                    {/each}

                    <button
                      class="move-option create-new"
                      disabled={isMoving}
                      on:click={() => createBurrowAndMove(rh.id)}
                    >
                      <Plus size={14} />
                      <span>Create new burrow</span>
                    </button>
                  </div>
                </CollapsibleContainer>
              {/each}
            </Stack>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
  }

  .modal-content {
    background-color: white;
    padding: 24px;
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .modal-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1b1e;
  }

  .modal-body {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex: 1;
  }

  .results-container {
    overflow-y: auto;
    flex: 1;
    padding-right: 4px;
  }

  .rh-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .move-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    color: #495057;
    transition: all 0.2s;
  }

  .move-option:hover:not(:disabled) {
    background: rgba(17, 133, 254, 0.1);
    color: #1185fe;
  }

  .move-option:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .create-new {
    color: #1185fe;
    font-weight: 500;
    background: transparent;
    border: 1px dashed rgba(17, 133, 254, 0.3);
    justify-content: flex-start;
    gap: 8px;
  }

  .current-badge {
    font-size: 10px;
    text-transform: uppercase;
    background: #dee2e6;
    padding: 2px 6px;
    border-radius: 4px;
    color: #495057;
  }

  :global(body.dark-mode) .modal-content {
    background-color: #25262b;
    border: 1px solid #373a40;
    color: #c1c2c5;
  }

  :global(body.dark-mode) .modal-title {
    color: #e7f5ff;
  }

  :global(body.dark-mode) .move-option {
    background: rgba(255, 255, 255, 0.05);
    color: #c1c2c5;
  }

  :global(body.dark-mode) .move-option:hover:not(:disabled) {
    background: rgba(77, 171, 247, 0.15);
    color: #74c0fc;
  }
</style>
