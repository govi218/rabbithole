<script lang="ts">
  import { TextInput, Paper } from "@svelteuidev/core";
  import { MessageRequest } from "../utils";
  import type { Burrow, Rabbithole } from "src/utils/types";

  interface SearchResult {
    type: "burrow" | "rabbithole";
    id: string;
    name: string;
    original: Burrow | Rabbithole;
  }

  export let handleBurrowChange: (burrowId: string) => Promise<void>;
  export let handleRabbitholeChange: (rabbitholeId: string) => Promise<void>;
  export let burrows: Burrow[] = [];
  export let rabbitholes: Rabbithole[] = [];
  export let selectedBurrow: Burrow | null = null;
  export let selectedRabbithole: Rabbithole | null = null;
  export let dropdownDirection: string = "down";
  export let allowCreate: boolean = false;

  let searchValue: string = "";
  let isOpen: boolean = false;
  let createMode: "choose" | "burrow-select-rh" | null = null;
  let selectedRhForNewBurrow: Rabbithole | null = null;

  $: displayValue = isOpen
    ? searchValue
    : (selectedBurrow?.name ?? selectedRabbithole?.title ?? "");

  $: console.log(displayValue);

  $: filteredResults = (() => {
    const query = searchValue.toLowerCase().trim();
    const results: SearchResult[] = [
      ...rabbitholes
        .filter((rh) => rh.title.toLowerCase().includes(query))
        .map(
          (rh) =>
            ({
              type: "rabbithole",
              id: rh.id,
              name: rh.title,
              original: rh,
            }) as SearchResult,
        ),
      ...burrows
        .filter((b) => b.name.toLowerCase().includes(query))
        .map(
          (b) =>
            ({
              type: "burrow",
              id: b.id,
              name: b.name,
              original: b,
            }) as SearchResult,
        ),
    ];

    return results;
  })();

  async function handleFocus(): Promise<void> {
    burrows = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ALL_BURROWS,
    });
    rabbitholes = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ALL_RABBITHOLES,
    });
    isOpen = true;
    searchValue = "";
    createMode = null;
    selectedRhForNewBurrow = null;
  }

  function handleBlur(): void {
    setTimeout(() => {
      isOpen = false;
      searchValue = "";
      createMode = null;
      selectedRhForNewBurrow = null;
    }, 200);
  }

  function handleInput(e: CustomEvent<any>): void {
    searchValue = e.target.value;
    createMode = null;
    selectedRhForNewBurrow = null;
  }

  function selectItem(result: SearchResult): void {
    isOpen = false;
    searchValue = "";
    createMode = null;

    if (result.type === "rabbithole") {
      selectedRabbithole = result.original as Rabbithole;
      selectedBurrow = null;
      handleRabbitholeChange(result.id);
    } else {
      selectedBurrow = result.original as Burrow;
      handleBurrowChange(result.id);
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function showCreateOptions(): void {
    createMode = "choose";
  }

  async function createNewRabbithole(): Promise<void> {
    const name = searchValue.trim();
    if (!name) {
      return;
    }

    try {
      const newRh = await chrome.runtime.sendMessage({
        type: MessageRequest.CREATE_NEW_RABBITHOLE,
        title: name,
      });

      rabbitholes = [newRh, ...rabbitholes];
      await handleRabbitholeChange(newRh.id);

      // Set selection state first
      selectedRabbithole = newRh;
      selectedBurrow = null;

      // Then close dropdown and clear search
      searchValue = "";
      createMode = null;
      isOpen = false;

      // Blur the input so displayValue shows the new rabbithole name
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    } catch (err) {
      // ignore
    }
  }

  function startCreateBurrow(): void {
    createMode = "burrow-select-rh";
    selectedRhForNewBurrow = null;
  }

  async function selectRhForNewBurrow(rh: Rabbithole): Promise<void> {
    const name = searchValue.trim();
    if (!name) return;

    try {
      // Set the target rabbithole as active first
      await chrome.runtime.sendMessage({
        type: MessageRequest.CHANGE_ACTIVE_RABBITHOLE,
        rabbitholeId: rh.id,
      });

      const newBurrow = await chrome.runtime.sendMessage({
        type: MessageRequest.CREATE_NEW_BURROW_IN_RABBITHOLE,
        burrowName: name,
      });

      burrows = [newBurrow, ...burrows];
      await handleBurrowChange(newBurrow.id);

      // Set selection state first
      selectedBurrow = newBurrow;
      selectedRabbithole = rh;

      // Then close dropdown and clear search
      searchValue = "";
      createMode = null;
      selectedRhForNewBurrow = null;
      isOpen = false;

      // Blur the input so displayValue shows the new burrow name
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    } catch (err) {
      // ignore
    }
  }

  function handleKeydown(e: CustomEvent<any>): void {
    const ke = e as unknown as KeyboardEvent;
    if (ke.key === "Escape") {
      isOpen = false;
      searchValue = "";
      createMode = null;
      selectedRhForNewBurrow = null;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    if (ke.key === "Enter" && createMode === null) {
      if (filteredResults.length > 0) {
        selectItem(filteredResults[0]);
      } else if (allowCreate && searchValue.trim()) {
        showCreateOptions();
      }
    }
  }
</script>

<div class="container-selector-container">
  <TextInput
    value={displayValue}
    on:focus={handleFocus}
    on:blur={handleBlur}
    on:input={handleInput}
    on:keydown={handleKeydown}
    placeholder="Search rabbitholes & burrows, or create a new one"
    radius="md"
    size="sm"
    class="container-selector-input"
  />

  {#if isOpen}
    <Paper
      class="container-dropdown {dropdownDirection === 'up'
        ? 'dropdown-up'
        : 'dropdown-down'}"
      shadow="md"
      radius="md"
      padding="xs"
    >
      {#if createMode === "choose"}
        <div class="create-header">Create "{searchValue.trim()}" as:</div>
        <button
          type="button"
          class="create-button"
          on:mousedown|preventDefault={createNewRabbithole}
        >
          New Rabbithole
        </button>
        <button
          type="button"
          class="create-button"
          on:mousedown|preventDefault={startCreateBurrow}
        >
          New Burrow
        </button>
      {:else if createMode === "burrow-select-rh"}
        <div class="create-header">
          Select rabbithole for "{searchValue.trim()}":
        </div>
        {#each rabbitholes
          .slice()
          .sort((a, b) => a.title.localeCompare(b.title)) as rh}
          <button
            type="button"
            class="container-option"
            on:mousedown|preventDefault={() => selectRhForNewBurrow(rh)}
          >
            {rh.title}
          </button>
        {/each}
      {:else if filteredResults.length > 0}
        {#each filteredResults as result}
          <button
            type="button"
            class="container-option"
            class:selected={(result.type === "burrow" &&
              selectedBurrow?.id === result.id) ||
              (result.type === "rabbithole" &&
                selectedRabbithole?.id === result.id)}
            on:mousedown|preventDefault={() => selectItem(result)}
          >
            <span class="result-name">{result.name}</span>
            <span class="result-type-label {result.type}"
              >{result.type === "rabbithole" ? "Rabbithole" : "Burrow"}</span
            >
          </button>
        {/each}
      {:else if allowCreate && searchValue.trim()}
        <button
          type="button"
          class="create-button"
          on:mousedown|preventDefault={showCreateOptions}
        >
          Create "{searchValue.trim()}"…
        </button>
      {:else}
        <div class="no-results">No results found</div>
      {/if}
    </Paper>
  {/if}
</div>

<style>
  .container-selector-container {
    width: 100%;
    position: relative;
  }

  :global(.container-selector-input input) {
    text-align: center;
    cursor: pointer;
  }

  :global(.container-selector-input input:focus) {
    text-align: left;
  }

  :global(.container-dropdown) {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
    background: white;
  }

  :global(.container-dropdown.dropdown-down) {
    top: 100%;
    margin-top: 4px;
  }

  :global(.container-dropdown.dropdown-up) {
    bottom: 100%;
    margin-bottom: 4px;
  }

  .container-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 12px;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    border-radius: 4px;
    color: inherit;
  }

  .container-option:hover {
    background-color: #f1f3f5;
  }

  .container-option.selected {
    background-color: #e7f5ff;
    color: #1c7ed6;
  }

  .result-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-type-label {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    margin-left: 8px;
    flex-shrink: 0;
    font-weight: 500;
  }

  .result-type-label.rabbithole {
    background-color: #fff3bf;
    color: #e67700;
  }

  .result-type-label.burrow {
    background-color: #d3f9d8;
    color: #2b8a3e;
  }

  .create-header {
    padding: 6px 12px;
    font-size: 12px;
    color: #868e96;
    font-weight: 500;
  }

  .create-button {
    display: block;
    width: 100%;
    padding: 8px 12px;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    border-radius: 4px;
    color: #1185fe;
    font-weight: 500;
  }

  .create-button:hover {
    background-color: #e7f5ff;
  }

  .confirm-button {
    margin-top: 4px;
    border-top: 1px solid #e9ecef;
    padding-top: 8px;
  }

  .no-results {
    padding: 8px 12px;
    text-align: center;
    color: #868e96;
    font-size: 14px;
  }

  /* Dark mode */
  :global(body.dark-mode .container-dropdown) {
    background: #25262b;
  }

  :global(body.dark-mode) .container-option {
    color: #c1c2c5;
  }

  :global(body.dark-mode) .container-option:hover {
    background-color: #2c2e33;
    color: #ffffff;
  }

  :global(body.dark-mode) .container-option.selected {
    background-color: #1c3a5e;
    color: #74c0fc;
  }

  :global(body.dark-mode) .result-type-label.rabbithole {
    background-color: #5c4813;
    color: #ffd43b;
  }

  :global(body.dark-mode) .result-type-label.burrow {
    background-color: #1b4332;
    color: #69db7c;
  }

  :global(body.dark-mode) .create-header {
    color: #909296;
  }

  :global(body.dark-mode) .create-button {
    color: #4dabf7;
  }

  :global(body.dark-mode) .create-button:hover {
    background-color: #1c3a5e;
  }

  :global(body.dark-mode) .confirm-button {
    border-top-color: #373a40;
  }

  :global(body.dark-mode) .no-results {
    color: #909296;
  }
</style>
