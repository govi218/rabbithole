<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Trash } from "radix-icons-svelte";
  import type { Rabbithole, Burrow } from "src/utils/types";

  export let rabbitholes: Rabbithole[] = [];
  export let burrows: Burrow[] = [];
  export let onSelect: (rabbitholeId: string) => Promise<void> | void;

  export let horizontal: boolean = false;
  export let allowCreate: boolean = false;
  export let showDelete: boolean = false;

  const dispatch = createEventDispatcher();

  function getBurrowCount(rabbithole: Rabbithole): number {
    return rabbithole.burrows?.length || 0;
  }

  function getWebsiteCount(rabbithole: Rabbithole): number {
    // Only count websites from the rabbithole "meta" list.
    // Burrow websites are subsets of the rabbithole websites and should not be double-counted.
    return rabbithole.meta?.length || 0;
  }

  function getTrailCount(rabbithole: Rabbithole): number {
    return rabbithole.trails?.length || 0;
  }
</script>

<div class="grid" class:horizontal>
  {#if allowCreate}
    <button
      type="button"
      class="card add-card"
      on:click={() => dispatch("createRabbithole")}
      title="Create new rabbithole"
      aria-label="Create new rabbithole"
    >
      <div class="add-plus">+</div>
      <div class="card-title" style="margin-top: 8px; font-size: 13px;">
        Create
      </div>
    </button>
  {/if}

  {#each rabbitholes as rabbithole (rabbithole.id)}
    <button type="button" class="card" on:click={() => onSelect(rabbithole.id)}>
      {#if showDelete}
        <button
          type="button"
          class="remove-btn"
          title="Delete Rabbithole"
          aria-label="Delete Rabbithole"
          on:click|stopPropagation={() =>
            dispatch("deleteRabbithole", { rabbitholeId: rabbithole.id })}
        >
          <Trash size={13} />
        </button>
      {/if}

      <div class="card-content">
        <div class="card-title">{rabbithole.title || "Untitled"}</div>
        <div class="card-stats">
          <span class="stat"
            >{getBurrowCount(rabbithole)} burrow{getBurrowCount(rabbithole) !==
            1
              ? "s"
              : ""}</span
          >
          <span class="stat-divider">•</span>
          <span class="stat"
            >{getWebsiteCount(rabbithole)} site{getWebsiteCount(rabbithole) !==
            1
              ? "s"
              : ""}</span
          >
          {#if getTrailCount(rabbithole) > 0}
            <span class="stat-divider">•</span>
            <span class="stat"
              >{getTrailCount(rabbithole)} trail{getTrailCount(rabbithole) !== 1
                ? "s"
                : ""}</span
            >
          {/if}
        </div>
      </div>
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    width: 100%;
  }

  .grid.horizontal {
    display: flex;
    gap: 11px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 5px 0;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }

  .grid.horizontal::-webkit-scrollbar {
    height: 8px;
  }

  .grid.horizontal::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.12);
    border-radius: 999px;
  }

  :global(body.dark-mode) .grid.horizontal::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.14);
  }

  .card {
    position: relative;
    text-align: left;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: #ffffff;
    border-radius: 12px;
    padding: 18px;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease,
      border-color 0.15s ease;
    min-height: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .grid.horizontal .card {
    flex: 0 0 224px;
    min-height: 120px;
    scroll-snap-align: start;
    display: block;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 22px rgba(0, 0, 0, 0.08);
    border-color: rgba(17, 133, 254, 0.35);
  }

  .remove-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: rgba(255, 255, 255, 0.9);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgba(0, 0, 0, 0.55);
    z-index: 2;
  }

  .remove-btn:hover {
    color: #e03131;
    border-color: rgba(224, 49, 49, 0.35);
    background: rgba(255, 245, 245, 0.9);
  }

  .card-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .card-title {
    font-weight: 900;
    font-size: 14px;
    color: #1a1b1e;
    line-height: 1.2;
    text-align: center;
    width: 100%;
  }

  .card-stats {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: rgba(0, 0, 0, 0.5);
    font-weight: 500;
  }

  .stat-divider {
    color: rgba(0, 0, 0, 0.25);
  }

  .add-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .add-plus {
    font-size: 35px;
    font-weight: 900;
    color: rgba(17, 133, 254, 0.9);
    line-height: 1;
    transform: translateY(-2px);
  }

  @media (max-width: 980px) {
    .grid:not(.horizontal) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .grid:not(.horizontal) {
      grid-template-columns: 1fr;
    }
  }

  :global(body.dark-mode) .card {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.12);
  }

  :global(body.dark-mode) .card:hover {
    border-color: rgba(77, 171, 247, 0.45);
    box-shadow: 0 12px 22px rgba(0, 0, 0, 0.35);
  }

  :global(body.dark-mode) .card-title {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .card-stats {
    color: rgba(255, 255, 255, 0.5);
  }

  :global(body.dark-mode) .stat-divider {
    color: rgba(255, 255, 255, 0.25);
  }

  :global(body.dark-mode) .add-plus {
    color: rgba(77, 171, 247, 0.95);
  }

  :global(body.dark-mode) .remove-btn {
    background: rgba(26, 27, 30, 0.9);
    border-color: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.65);
  }

  :global(body.dark-mode) .remove-btn:hover {
    color: #ff6b6b;
    border-color: rgba(255, 107, 107, 0.35);
    background: rgba(66, 0, 0, 0.25);
  }
</style>
