<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Group, Tooltip, ActionIcon, TextInput } from "@svelteuidev/core";
  import {
    MagnifyingGlass,
    Globe,
    Rocket,
    Reload,
    Trash,
    Home,
    Upload,
    Play,
  } from "radix-icons-svelte";

  export let activeBurrowId: string | null = null;
  export let activeTrailId: string | null = null;
  export let activeRabbitholeId: string | null = null;
  export let sembleUrl: string | null = null;
  export let trailPublished: boolean = false;
  export let isSavingWindow: boolean = false;
  export let isUpdatingPinnedWebsites: boolean = false;
  export let isPublishing: boolean = false;
  export let isPublishingTrail: boolean = false;
  export let isDeleting: boolean = false;

  const dispatch = createEventDispatcher();

  let showSearchBar: boolean = false;
  let searchQuery: string = "";

  function toggleSearchBar() {
    showSearchBar = !showSearchBar;
    if (!showSearchBar) {
      searchQuery = "";
      dispatch("search", { query: "" });
    } else {
      setTimeout(() => {
        const input = document.querySelector(
          ".action-search-bar input",
        ) as HTMLInputElement;
        input?.focus();
      }, 50);
    }
  }

  function handleSearchInput() {
    dispatch("search", { query: searchQuery });
  }
</script>

<div class="action-bar-container">
  <div class="action-bar">
    <Group spacing="xs">
      {#if activeTrailId}
        <!-- Trail mode: Start Trail + Publish + Delete -->
        <Tooltip label="Start Trail" withArrow transition="fade">
          <ActionIcon
            size="lg"
            radius="md"
            color="blue"
            on:click={() => dispatch("startTrail")}
          >
            <Play size={18} />
          </ActionIcon>
        </Tooltip>

        <div class="action-divider"></div>

        <Tooltip
          label={trailPublished
            ? "Update on Sidetrail"
            : "Publish to Sidetrail"}
          withArrow
          transition="fade"
        >
          <ActionIcon
            size="lg"
            radius="md"
            color={trailPublished ? "orange" : "grape"}
            on:click={() => dispatch("publishTrail")}
            loading={isPublishingTrail}
          >
            {#if trailPublished}
              <Upload size={18} />
            {:else}
              <Rocket size={18} />
            {/if}
          </ActionIcon>
        </Tooltip>

        <div class="action-divider"></div>

        <Tooltip label="Delete trail" withArrow color="red" transition="fade">
          <ActionIcon
            size="lg"
            radius="md"
            color="red"
            on:click={() => dispatch("deleteContainer")}
            loading={isDeleting}
          >
            <Trash size={18} />
          </ActionIcon>
        </Tooltip>
      {:else}
        <!-- Normal burrow/rabbithole mode -->
        <Tooltip label="Search within list" withArrow transition="fade">
          <ActionIcon
            size="lg"
            radius="md"
            color="blue"
            on:click={toggleSearchBar}
          >
            <MagnifyingGlass size={18} />
          </ActionIcon>
        </Tooltip>

        <div class="action-divider"></div>

        <Tooltip
          label={activeBurrowId
            ? "Sync open tabs with this burrow"
            : "Sync open tabs with this rabbithole"}
          withArrow
          transition="fade"
        >
          <ActionIcon
            size="lg"
            radius="md"
            color="blue"
            on:click={() => dispatch("saveWindow")}
            loading={isSavingWindow}
          >
            <Reload size={18} />
          </ActionIcon>
        </Tooltip>

        <div class="action-divider"></div>

        {#if !activeBurrowId && activeRabbitholeId}
          <Tooltip label="Update pinned websites" withArrow transition="fade">
            <ActionIcon
              size="lg"
              radius="md"
              color="blue"
              on:click={() => dispatch("updatePinnedWebsites")}
              loading={isUpdatingPinnedWebsites}
            >
              <Home size={18} />
            </ActionIcon>
          </Tooltip>

          <div class="action-divider"></div>
        {/if}

        {#if activeBurrowId}
          {#if sembleUrl}
            <Tooltip label="View on Semble" withArrow transition="fade">
              <ActionIcon
                size="lg"
                radius="md"
                color="cyan"
                on:click={() => dispatch("openSemble")}
              >
                <Globe size={18} />
              </ActionIcon>
            </Tooltip>

            <div class="action-divider"></div>

            <Tooltip label="Update on Semble" withArrow transition="fade">
              <ActionIcon
                size="lg"
                radius="md"
                color="orange"
                on:click={() => dispatch("publish")}
                loading={isPublishing}
              >
                <Upload size={18} />
              </ActionIcon>
            </Tooltip>
          {:else}
            <Tooltip label="Publish to Semble" withArrow transition="fade">
              <ActionIcon
                size="lg"
                radius="md"
                color="grape"
                on:click={() => dispatch("publish")}
                loading={isPublishing}
              >
                <Rocket size={18} />
              </ActionIcon>
            </Tooltip>
          {/if}
          <div class="action-divider"></div>
        {/if}

        <Tooltip
          label={activeBurrowId ? "Delete burrow" : "Delete rabbithole"}
          withArrow
          color="red"
          transition="fade"
        >
          <ActionIcon
            size="lg"
            radius="md"
            color="red"
            on:click={() => dispatch("deleteContainer")}
            loading={isDeleting}
          >
            <Trash size={18} />
          </ActionIcon>
        </Tooltip>
      {/if}
    </Group>
  </div>

  {#if showSearchBar && !activeTrailId}
    <div class="action-search-bar">
      <TextInput
        placeholder="Search..."
        icon={MagnifyingGlass}
        size="sm"
        radius="md"
        bind:value={searchQuery}
        on:input={handleSearchInput}
      />
    </div>
  {/if}
</div>

<style>
  .action-bar-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 10px;
    width: 100%;
  }

  .action-bar {
    display: flex;
    justify-content: center;
    padding: 6px;
    background: rgba(0, 0, 0, 0.03);
    border-radius: 10px;
    width: fit-content;
  }

  .action-divider {
    width: 1px;
    height: 19px;
    background-color: rgba(0, 0, 0, 0.1);
    margin: 0 6px;
  }

  .action-search-bar {
    margin: 14px 0 10px 0;
    width: 100%;
    max-width: 640px;
  }

  :global(body.dark-mode) .action-bar {
    background: rgba(255, 255, 255, 0.05);
  }

  :global(body.dark-mode) .action-divider {
    background-color: rgba(255, 255, 255, 0.1);
  }

  :global(body.dark-mode .action-search-bar .mantine-TextInput-input) {
    background-color: #25262b;
    border-color: #373a40;
    color: #c1c2c5;
  }
</style>
