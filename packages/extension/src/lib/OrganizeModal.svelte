<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "./Modal.svelte";

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher();

  function select(type: "Burrow" | "Trail") {
    dispatch("select", { type });
  }
</script>

<Modal
  {isOpen}
  title="Create a focused view of links in this rabbithole"
  on:close={() => dispatch("close")}
>
  <div class="options">
    <button class="option-card" on:click={() => select("Burrow")}>
      <h3>Burrow</h3>
      <p>
        A focused collection within a rabbithole — like a playlist of links for
        a specific goal or topic
      </p>
    </button>
    <button class="option-card" on:click={() => select("Trail")}>
      <h3>Trail</h3>
      <p>
        An ordered path through a set of links — built to be followed, shared,
        or published as a trail
      </p>
    </button>
  </div>
</Modal>

<style>
  .options {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .option-card {
    text-align: left;
    background: #f8f9fa;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .option-card:hover {
    border-color: #1185fe;
    background: rgba(17, 133, 254, 0.05);
    transform: translateY(-2px);
  }
  .option-card h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    color: #1a1b1e;
  }
  .option-card p {
    margin: 0;
    font-size: 14px;
    color: #495057;
    line-height: 1.5;
  }
  :global(body.dark-mode) .option-card {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.12);
  }
  :global(body.dark-mode) .option-card:hover {
    border-color: #4dabf7;
    background: rgba(77, 171, 247, 0.05);
  }
  :global(body.dark-mode) .option-card h3 {
    color: #e7e7e7;
  }
  :global(body.dark-mode) .option-card p {
    color: #c1c2c5;
  }
</style>
