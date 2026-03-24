<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let isOpen: boolean = false;
  export let title: string = "";
  export let placeholder: string = "";
  export let defaultValue: string = "";

  const dispatch = createEventDispatcher();

  let value: string = "";

  $: if (isOpen) {
    value = defaultValue;
  }

  function autoFocus(node: HTMLInputElement) {
    node.focus();
    node.select();
    return {};
  }

  function confirm(): void {
    if (!value.trim()) return;
    dispatch("confirm", value.trim());
    isOpen = false;
  }

  function cancel(): void {
    dispatch("cancel");
    isOpen = false;
  }

  function handleKeydown(e: KeyboardEvent): void {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="overlay" on:click={cancel}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="modal"
      on:click|stopPropagation
      on:keydown|stopPropagation
      on:keyup|stopPropagation
      on:keypress|stopPropagation
    >
      <h2 class="title">{title}</h2>
      <input
        use:autoFocus
        bind:value
        class="input"
        {placeholder}
        type="text"
        on:keydown={handleKeydown}
      />
      <div class="actions">
        <button class="btn-cancel" on:click={cancel}>Cancel</button>
        <button class="btn-confirm" on:click={confirm} disabled={!value.trim()}
          >Confirm</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    backdrop-filter: blur(2px);
  }

  .modal {
    background: white;
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    animation: popIn 0.15s ease-out;
    display: flex;
    flex-direction: column;
    gap: 16px;
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

  .title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1a1b1e;
  }

  .input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 0.95rem;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .input:focus {
    border-color: #228be6;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn-cancel,
  .btn-confirm {
    padding: 7px 16px;
    border-radius: 6px;
    border: none;
    font-size: 0.9rem;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.15s ease;
  }

  .btn-cancel {
    background: #f1f3f5;
    color: #495057;
  }

  .btn-cancel:hover {
    background: #e9ecef;
  }

  .btn-confirm {
    background: #228be6;
    color: white;
  }

  .btn-confirm:hover:not(:disabled) {
    background: #1c7ed6;
  }

  .btn-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(body.dark-mode) .modal {
    background: #25262b;
    border: 1px solid #373a40;
  }

  :global(body.dark-mode) .title {
    color: #e7f5ff;
  }

  :global(body.dark-mode) .input {
    background: #1a1b1e;
    border-color: #373a40;
    color: #c1c2c5;
  }

  :global(body.dark-mode) .input:focus {
    border-color: #4dabf7;
  }

  :global(body.dark-mode) .btn-cancel {
    background: #373a40;
    color: #c1c2c5;
  }

  :global(body.dark-mode) .btn-cancel:hover {
    background: #2c2e33;
  }
</style>
