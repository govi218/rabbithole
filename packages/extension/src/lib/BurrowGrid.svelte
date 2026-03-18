<script lang="ts">
  import type { Burrow, Trail } from "src/utils/types";
  import { createEventDispatcher } from "svelte";
  import { Trash } from "radix-icons-svelte";

  export let burrows: Burrow[] = [];
  export let trails: Trail[] = [];
  export let selectedBurrowId: string = null;
  export let selectedTrailId: string = null;
  export let onSelectBurrow: (
    burrowId: string,
  ) => Promise<void> | void = () => {};
  export let onSelectTrail: (
    trailId: string,
  ) => Promise<void> | void = () => {};
  export let allowCreate: boolean = false;
  export let showDelete: boolean = false;

  const dispatch = createEventDispatcher();
</script>

<div class="grid">
  {#if allowCreate}
    <button
      type="button"
      class="card add-card"
      on:click={() => dispatch("organize")}
      title="Organize"
      aria-label="Organize"
    >
      <div class="add-plus">+</div>
      <div class="card-title" style="margin-top: 8px; font-size: 13px;">
        Organize
      </div>
    </button>
  {/if}

  {#each burrows as burrow (burrow.id)}
    <button
      type="button"
      class="card"
      class:selected={burrow.id === selectedBurrowId}
      on:click={() => onSelectBurrow(burrow.id)}
    >
      {#if showDelete}
        <button
          type="button"
          class="remove-btn"
          title="Delete Burrow"
          aria-label="Delete Burrow"
          on:click|stopPropagation={() =>
            dispatch("deleteBurrow", { burrowId: burrow.id })}
        >
          <Trash size={13} />
        </button>
      {/if}

      <div class="card-title">{burrow.name || "Untitled"}</div>
      <div class="card-meta">
        <div class="meta-item">
          Burrow • {burrow.websites?.length || 0} site{(burrow.websites
            ?.length || 0) === 1
            ? ""
            : "s"}
        </div>
      </div>
    </button>
  {/each}

  {#each trails as trail (trail.id)}
    <button
      type="button"
      class="card"
      class:selected={trail.id === selectedTrailId}
      on:click={() => onSelectTrail(trail.id)}
    >
      {#if showDelete}
        <button
          type="button"
          class="remove-btn"
          title="Delete Trail"
          aria-label="Delete Trail"
          on:click|stopPropagation={() =>
            dispatch("deleteTrail", { trailId: trail.id })}
        >
          <Trash size={13} />
        </button>
      {/if}

      <div class="card-title">{trail.name || "Untitled"}</div>
      <div class="card-meta">
        <div class="meta-item">
          Trail • {trail.stops?.length || 0} stop{(trail.stops?.length || 0) ===
          1
            ? ""
            : "s"}
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
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 22px rgba(0, 0, 0, 0.08);
    border-color: rgba(17, 133, 254, 0.35);
  }

  .card.selected {
    border-color: rgba(17, 133, 254, 0.6);
    background: rgba(17, 133, 254, 0.05);
  }

  .card-title {
    font-weight: 900;
    font-size: 14px;
    color: #1a1b1e;
    margin-bottom: 11px;
    line-height: 1.2;
  }

  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .meta-item {
    font-size: 10px;
    color: #868e96;
    font-weight: 600;
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

  @media (max-width: 980px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .grid {
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

  :global(body.dark-mode) .card.selected {
    border-color: rgba(77, 171, 247, 0.7);
    background: rgba(77, 171, 247, 0.08);
  }

  :global(body.dark-mode) .card-title {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .meta-item {
    color: #909296;
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
