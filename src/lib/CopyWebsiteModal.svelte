<script lang="ts">
  import { afterUpdate, createEventDispatcher } from "svelte";
  import {
    ActionIcon,
    TextInput,
    Text,
    Stack,
    Loader,
  } from "@svelteuidev/core";
  import { Cross2, MagnifyingGlass, Plus } from "radix-icons-svelte";
  import Fuse from "fuse.js";
  import { MessageRequest, Logger } from "../utils";
  import type { Burrow, Rabbithole } from "src/utils/types";
  import NameInputModal from "src/lib/NameInputModal.svelte";

  export let isOpen: boolean = false;
  export let mode: "burrow" | "rabbithole" = "burrow"; // 'burrow' = add to burrow in current RH, 'rabbithole' = add to another RH
  export let websiteUrl: string = "";
  export let currentRabbitholeId: string = "";

  const dispatch = createEventDispatcher();

  let searchQuery: string = "";
  let items: (Burrow | Rabbithole)[] = [];
  let filtered: (Burrow | Rabbithole)[] = [];
  let isLoading: boolean = false;
  let isProcessing: boolean = false;
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
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && isOpen) {
      close();
    }
  }

  async function loadData(): Promise<void> {
    isLoading = true;
    try {
      if (mode === "burrow") {
        // Load burrows for current rabbithole
        const allBurrows: Burrow[] = await chrome.runtime.sendMessage({
          type: MessageRequest.GET_ALL_BURROWS,
        });
        const activeRh: Rabbithole = await chrome.runtime.sendMessage({
          type: MessageRequest.GET_ACTIVE_RABBITHOLE,
        });

        if (activeRh && activeRh.burrows) {
          items = allBurrows.filter((b) => activeRh.burrows.includes(b.id));
        } else {
          items = [];
        }
      } else {
        // Load other rabbitholes
        const allRabbitholes: Rabbithole[] = await chrome.runtime.sendMessage({
          type: MessageRequest.GET_ALL_RABBITHOLES,
        });
        items = allRabbitholes.filter((r) => r.id !== currentRabbitholeId);
      }
      filtered = items;
    } catch (err) {
      Logger.error("Failed to load data:", err);
    } finally {
      isLoading = false;
    }
  }

  function performSearch(): void {
    const q = searchQuery.trim();
    if (q.length < 1) {
      filtered = items;
      return;
    }

    const keys = mode === "burrow" ? ["name"] : ["title", "description"];
    const fuse = new Fuse(items, {
      keys,
      includeScore: true,
      threshold: 0.35,
    });

    filtered = fuse.search(q).map((r) => r.item);
  }

  async function handleSelect(targetId: string): Promise<void> {
    if (!websiteUrl) return;
    isProcessing = true;

    try {
      if (mode === "burrow") {
        await chrome.runtime.sendMessage({
          type: MessageRequest.ADD_WEBSITES_TO_BURROW,
          burrowId: targetId,
          urls: [websiteUrl],
        });
      } else {
        // Add to Rabbithole Meta
        await chrome.runtime.sendMessage({
          type: MessageRequest.ADD_WEBSITES_TO_RABBITHOLE_META,
          rabbitholeId: targetId,
          urls: [websiteUrl],
        });
      }
      dispatch("added");
      close();
    } catch (err) {
      Logger.error("Failed to add website:", err);
    } finally {
      isProcessing = false;
    }
  }

  async function createBurrowAndAdd(): Promise<void> {
    const name = await promptName();
    if (!name) return;

    isProcessing = true;
    try {
      // Create burrow (active)
      const newBurrow = await chrome.runtime.sendMessage({
        type: MessageRequest.CREATE_NEW_BURROW,
        newBurrowName: name,
      });

      // Add to current RH
      await chrome.runtime.sendMessage({
        type: MessageRequest.ADD_BURROWS_TO_RABBITHOLE,
        rabbitholeId: currentRabbitholeId,
        burrowIds: [newBurrow.id],
      });

      // Add website
      const allWebsites: Website[] = await chrome.runtime.sendMessage({
        type: MessageRequest.GET_ALL_ITEMS,
      });
      const website = allWebsites.find((w) => w.url === websiteUrl);

      if (website) {
        await chrome.runtime.sendMessage({
          type: "IMPORT_DATA",
          burrows: [{ id: newBurrow.id, name: name, websites: [websiteUrl] }],
          websites: [website],
        });
      }

      dispatch("added");
      close();
    } catch (e) {
      Logger.error(e);
    } finally {
      isProcessing = false;
    }
  }

  $: if (isOpen && !wasOpen) {
    wasOpen = true;
    loadData();
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
        <h2 class="modal-title">
          {mode === "burrow" ? "Add to Burrow" : "Add to another Rabbithole"}
        </h2>
        <ActionIcon on:click={close}>
          <Cross2 />
        </ActionIcon>
      </div>

      <div class="modal-body">
        <div class="search-input-wrapper" bind:this={inputRef}>
          <TextInput
            placeholder={mode === "burrow"
              ? "Search burrows..."
              : "Search rabbitholes..."}
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
              {#if mode === "burrow"}
                <button
                  class="option-row create-new"
                  disabled={isProcessing}
                  on:click={createBurrowAndAdd}
                >
                  <Plus size={14} />
                  <span>Create new burrow</span>
                </button>
              {/if}

              {#each filtered as item (item.id)}
                <button
                  class="option-row"
                  disabled={isProcessing}
                  on:click={() => handleSelect(item.id)}
                >
                  <span class="option-name">
                    {mode === "burrow" ? item.name : item.title}
                  </span>
                </button>
              {/each}

              {#if filtered.length === 0 && (mode !== "burrow" || searchQuery)}
                <div class="empty-state">No results found</div>
              {/if}
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
    max-width: 500px;
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

  .option-row {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    color: #495057;
    transition: all 0.2s;
  }

  .option-row:hover:not(:disabled) {
    background: rgba(17, 133, 254, 0.1);
    color: #1185fe;
  }

  .option-row:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .create-new {
    color: #1185fe;
    font-weight: 500;
    background: transparent;
    border: 1px dashed rgba(17, 133, 254, 0.3);
    gap: 8px;
    margin-bottom: 8px;
  }

  .empty-state {
    text-align: center;
    color: #868e96;
    padding: 20px;
    font-size: 14px;
  }

  :global(body.dark-mode) .modal-content {
    background-color: #25262b;
    border: 1px solid #373a40;
    color: #c1c2c5;
  }

  :global(body.dark-mode) .modal-title {
    color: #e7f5ff;
  }

  :global(body.dark-mode) .option-row {
    background: rgba(255, 255, 255, 0.05);
    color: #c1c2c5;
  }

  :global(body.dark-mode) .option-row:hover:not(:disabled) {
    background: rgba(77, 171, 247, 0.15);
    color: #74c0fc;
  }
</style>
