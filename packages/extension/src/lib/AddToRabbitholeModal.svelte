<script lang="ts">
  import { afterUpdate, createEventDispatcher } from "svelte";
  import {
    ActionIcon,
    TextInput,
    Text,
    Stack,
    Loader,
  } from "@svelteuidev/core";
  import { Cross2, MagnifyingGlass, Trash } from "radix-icons-svelte";
  import Fuse from "fuse.js";
  import { MessageRequest, Logger } from "../utils";
  import type { Burrow, Rabbithole } from "src/utils/types";

  export let isOpen: boolean = false;
  export let activeBurrow: Burrow | null = null;
  export let existingRabbitholes: Rabbithole[] = [];

  const dispatch = createEventDispatcher();

  let searchQuery: string = "";
  let allRabbitholes: Rabbithole[] = [];
  let filtered: Rabbithole[] = [];
  let isLoading: boolean = false;
  let isAdding: boolean = false;
  let inputRef: HTMLElement;

  let wasOpen: boolean = false;
  let hoveredAddedId: string = null;

  afterUpdate(() => {
    if (isOpen && inputRef) {
      const input = inputRef.querySelector("input");
      if (input) input.focus();
    }
  });

  function close(): void {
    isOpen = false;
    searchQuery = "";
    filtered = [];
    hoveredAddedId = null;
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && isOpen) {
      close();
    }
  }

  function isAlreadyMember(rabbitholeId: string): boolean {
    return (existingRabbitholes || []).some((rh) => rh?.id === rabbitholeId);
  }

  async function loadAllRabbitholes(): Promise<void> {
    isLoading = true;
    try {
      const res = await chrome.runtime.sendMessage({
        type: MessageRequest.GET_ALL_RABBITHOLES,
      });
      allRabbitholes = Array.isArray(res) ? res : [];
    } catch (err) {
      Logger.error("Failed to load rabbitholes:", err);
      allRabbitholes = [];
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
  }

  async function addToRabbithole(rabbithole: Rabbithole): Promise<void> {
    if (!activeBurrow?.id || !rabbithole?.id) return;
    if (isAlreadyMember(rabbithole.id)) return;

    isAdding = true;
    try {
      const res = await chrome.runtime.sendMessage({
        type: MessageRequest.ADD_BURROWS_TO_RABBITHOLE,
        rabbitholeId: rabbithole.id,
        burrowIds: [activeBurrow.id],
      });

      if (res && typeof res === "object" && "error" in res) {
        Logger.error("Failed to add burrow to rabbithole:", res.error);
        return;
      }

      dispatch("updated");
      close();
    } catch (err) {
      Logger.error("Failed to add burrow to rabbithole:", err);
    } finally {
      isAdding = false;
    }
  }

  async function removeFromRabbithole(rabbitholeId: string): Promise<void> {
    if (!activeBurrow?.id || !rabbitholeId) return;

    isAdding = true;
    try {
      const res = await chrome.runtime.sendMessage({
        type: MessageRequest.DELETE_BURROW_FROM_RABBITHOLE,
        rabbitholeId,
        burrowId: activeBurrow.id,
      });

      if (res && typeof res === "object" && "error" in res) {
        Logger.error("Failed to remove burrow from rabbithole:", res.error);
        return;
      }

      dispatch("updated");
      close();
    } catch (err) {
      Logger.error("Failed to remove burrow from rabbithole:", err);
    } finally {
      isAdding = false;
    }
  }

  async function onOpen(): Promise<void> {
    searchQuery = "";
    filtered = [];
    hoveredAddedId = null;
    await loadAllRabbitholes();
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

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click={close}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2 class="modal-title">Add to Rabbithole</h2>
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

        {#if !activeBurrow?.id}
          <div class="empty-state">
            <Text size="sm" color="dimmed" align="center">
              No active burrow selected.
            </Text>
          </div>
        {:else if isLoading}
          <div class="loading-container">
            <Loader size="md" variant="dots" />
            <Text size="sm" color="dimmed" style="margin-top: 1rem;">
              Loading rabbitholes...
            </Text>
          </div>
        {:else if filtered.length === 0}
          <div class="empty-state">
            <Text size="sm" color="dimmed" align="center">
              No rabbitholes found for "{searchQuery}"
            </Text>
          </div>
        {:else}
          <div class="results-container">
            <Text size="sm" color="dimmed" style="margin-bottom: 12px;">
              Select a rabbithole to add "{activeBurrow?.name || "this burrow"}"
            </Text>

            <Stack spacing="xs">
              {#each filtered as rh (rh.id)}
                <button
                  type="button"
                  class="result-row"
                  disabled={isAdding}
                  on:click={() =>
                    !isAlreadyMember(rh.id) ? addToRabbithole(rh) : null}
                  title={isAlreadyMember(rh.id)
                    ? "Already in this rabbithole"
                    : "Add to this rabbithole"}
                >
                  <div class="row-main">
                    <div class="row-title">{rh.title || "Untitled"}</div>
                    {#if rh.description}
                      <div class="row-desc">{rh.description}</div>
                    {/if}
                  </div>

                  <div class="row-action">
                    {#if isAlreadyMember(rh.id)}
                      <button
                        type="button"
                        class="added-pill"
                        on:mouseenter={() => (hoveredAddedId = rh.id)}
                        on:mouseleave={() => (hoveredAddedId = null)}
                        on:click|stopPropagation={() =>
                          removeFromRabbithole(rh.id)}
                        title="Remove from this rabbithole"
                        aria-label="Remove from this rabbithole"
                        disabled={isAdding}
                      >
                        {#if hoveredAddedId === rh.id}
                          <Trash size={14} />
                        {:else}
                          Added
                        {/if}
                      </button>
                    {:else}
                      <span class="add-label"
                        >{isAdding ? "Working..." : "Add"}</span
                      >
                    {/if}
                  </div>
                </button>
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
    max-width: 700px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    animation: popIn 0.2s ease-out;
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
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

  .search-input-wrapper {
    margin-bottom: 16px;
  }

  .loading-container,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
  }

  .results-container {
    overflow-y: auto;
    flex: 1;
    padding-right: 8px;
  }

  .result-row {
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 12px;
    border-radius: 10px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: rgba(255, 255, 255, 0.9);
    cursor: pointer;
    text-align: left;
  }

  .result-row:hover {
    border-color: rgba(17, 133, 254, 0.35);
    background: rgba(231, 245, 255, 0.6);
  }

  .result-row:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .row-main {
    flex: 1;
    min-width: 0;
  }

  .row-title {
    font-weight: 800;
    color: #1a1b1e;
    font-size: 14px;
    line-height: 1.2;
  }

  .row-desc {
    margin-top: 4px;
    color: #868e96;
    font-size: 12px;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-box-orient: vertical;
  }

  .row-action {
    flex: 0 0 auto;
    padding-top: 2px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 70px;
  }

  .add-label {
    font-weight: 800;
    color: #1185fe;
    font-size: 13px;
  }

  .added-pill {
    border: 1px solid rgba(47, 158, 68, 0.25);
    background: rgba(47, 158, 68, 0.12);
    color: #2f9e44;
    font-weight: 800;
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 58px;
    height: 26px;
  }

  .added-pill:hover {
    border-color: rgba(224, 49, 49, 0.35);
    background: rgba(255, 245, 245, 0.9);
    color: #e03131;
  }

  /* Custom scrollbar */
  .results-container::-webkit-scrollbar {
    width: 8px;
  }

  .results-container::-webkit-scrollbar-track {
    background: #f1f3f5;
    border-radius: 4px;
  }

  .results-container::-webkit-scrollbar-thumb {
    background: #adb5bd;
    border-radius: 4px;
  }

  .results-container::-webkit-scrollbar-thumb:hover {
    background: #868e96;
  }

  /* Dark mode styles */
  :global(body.dark-mode) .modal-content {
    background-color: #25262b;
    border: 1px solid #373a40;
    color: #c1c2c5;
  }

  :global(body.dark-mode) .modal-title {
    color: #e7f5ff;
  }

  :global(body.dark-mode) .result-row {
    background: rgba(26, 27, 30, 0.9);
    border-color: rgba(255, 255, 255, 0.12);
  }

  :global(body.dark-mode) .result-row:hover {
    border-color: rgba(77, 171, 247, 0.45);
    background: rgba(28, 58, 94, 0.35);
  }

  :global(body.dark-mode) .row-title {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .row-desc {
    color: #909296;
  }

  :global(body.dark-mode) .add-label {
    color: #4dabf7;
  }

  :global(body.dark-mode) .added-pill {
    border-color: rgba(47, 158, 68, 0.25);
    background: rgba(47, 158, 68, 0.12);
    color: #69db7c;
  }

  :global(body.dark-mode) .added-pill:hover {
    border-color: rgba(255, 107, 107, 0.35);
    background: rgba(66, 0, 0, 0.25);
    color: #ff6b6b;
  }

  :global(body.dark-mode) .results-container::-webkit-scrollbar-track {
    background: #1a1b1e;
  }

  :global(body.dark-mode) .results-container::-webkit-scrollbar-thumb {
    background: #5c5f66;
  }

  :global(body.dark-mode) .results-container::-webkit-scrollbar-thumb:hover {
    background: #909296;
  }

  :global(body.dark-mode .search-input-wrapper .mantine-TextInput-input) {
    background-color: #1a1b1e;
    border-color: #373a40;
    color: #c1c2c5;
  }
</style>
