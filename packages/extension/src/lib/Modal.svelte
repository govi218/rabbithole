<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { ActionIcon } from "@svelteuidev/core";
  import { Cross2 } from "radix-icons-svelte";

  export let isOpen: boolean = false;
  export let title: string = "";
  export let titleLink: string = "";

  const dispatch = createEventDispatcher();

  function close(): void {
    dispatch("close");
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && isOpen) {
      close();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click={close}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        {#if titleLink}
          <h2 class="modal-title">
            Sign in with <a
              href={titleLink}
              target="_blank"
              rel="noopener noreferrer"
              class="modal-title-link">Internet Handle</a
            >
          </h2>
        {:else}
          <h2 class="modal-title">{title}</h2>
        {/if}
        <ActionIcon on:click={close}>
          <Cross2 />
        </ActionIcon>
      </div>
      <div class="modal-body">
        <slot />
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
    max-height: 90vh;
    overflow-y: auto;
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
    margin-bottom: 16px;
  }

  .modal-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1b1e;
  }

  .modal-title-link {
    color: #1a1b1e;
    text-decoration: none;
    border-bottom: 1px dotted #1a1b1e;
    transition:
      color 0.2s ease,
      border-bottom-color 0.2s ease;
  }

  .modal-title-link:hover {
    color: #228be6;
    border-bottom-color: #228be6;
  }

  .modal-body {
    color: #495057;
    line-height: 1.6;
    font-size: 1rem;
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

  :global(body.dark-mode) .modal-title-link {
    color: #e7f5ff;
    border-bottom-color: #e7f5ff;
  }

  :global(body.dark-mode) .modal-title-link:hover {
    color: #4dabf7;
    border-bottom-color: #4dabf7;
  }

  :global(body.dark-mode) .modal-body {
    color: #c1c2c5;
  }
</style>
