<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "./Modal.svelte";

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch("close");
  }
</script>

<Modal {isOpen} title="Explore Rabbitholes" on:close={handleClose}>
  <div class="modal-content">
    <p class="description">
      You can explore rabbitholes made by other users here.
    </p>
    <p class="subtitle">
      Discover curated collections of links, follow trails created by the
      community, and import them to your own rabbithole. When you're done, hit
      "Rabbitholes" on top to continue working on yours!
    </p>
    <div class="actions">
      <button class="explore-btn" on:click={handleClose}>
        Start Exploring
      </button>
    </div>
  </div>
</Modal>

<style>
  .modal-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }

  .description {
    font-size: 16px;
    color: #1a1b1e;
    margin: 0;
    font-weight: 600;
  }

  :global(body.dark-mode) .description {
    color: #e7e7e7;
  }

  .subtitle {
    font-size: 14px;
    color: #495057;
    margin: 0;
    line-height: 1.5;
  }

  :global(body.dark-mode) .subtitle {
    color: #909296;
  }

  .actions {
    margin-top: 8px;
  }

  .explore-btn {
    background-color: #1185fe;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .explore-btn:hover {
    background-color: #0070e0;
  }
</style>
