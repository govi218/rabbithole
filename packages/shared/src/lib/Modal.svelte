<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let title = "";
  export let isOpen = false;

  const dispatch = createEventDispatcher();

  function handleOverlayClick() {
    dispatch("close");
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click|self={handleOverlayClick}>
    <div class="modal">
      <h2>{title}</h2>
      <slot />
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
  }

  .modal {
    background: #1a1b1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 32px;
    width: 100%;
    max-width: 580px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    animation: popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal h2 {
    font-size: 20px;
    font-weight: 900;
    margin: 0;
    color: #e7e7e7;
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
</style>
