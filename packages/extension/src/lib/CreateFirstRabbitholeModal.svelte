<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import Modal from "./Modal.svelte";

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher();

  let title: string = "";
  let inputElement: HTMLInputElement;

  const examples = ["Aliens", "Job Search", "Startup Ideas", "Travel Planning"];

  onMount(() => {
    if (isOpen && inputElement) {
      inputElement.focus();
    }
  });

  $: if (isOpen && inputElement) {
    setTimeout(() => inputElement?.focus(), 50);
  }

  function handleCreate() {
    if (title.trim()) {
      dispatch("create", { title: title.trim() });
      title = "";
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && title.trim()) {
      handleCreate();
    }
  }

  function handleExampleClick(example: string) {
    title = example;
    inputElement?.focus();
  }
</script>

<Modal
  {isOpen}
  title="Create your first rabbithole"
  on:close={() => dispatch("close")}
>
  <div class="modal-content">
    <p class="description">
      A rabbithole is a project or collection, a place to consolidate all your
      research on a topic.
    </p>

    <div class="examples">
      <span class="examples-label">Some examples:</span>
      <div class="example-tags">
        {#each examples as example}
          <button
            class="example-tag"
            on:click={() => handleExampleClick(example)}
          >
            {example}
          </button>
        {/each}
      </div>
    </div>

    <div class="input-container">
      <input
        bind:this={inputElement}
        bind:value={title}
        type="text"
        placeholder="e.g., AI Research"
        class="title-input"
        on:keydown={handleKeydown}
      />
    </div>

    <div class="actions">
      <button
        class="create-btn"
        on:click={handleCreate}
        disabled={!title.trim()}
      >
        Create
      </button>
    </div>
  </div>
</Modal>

<style>
  .modal-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
    max-width: 100%;
    overflow-x: hidden;
    padding: 0 8px;
  }

  .description {
    font-size: 14px;
    color: #495057;
    margin: 0;
    line-height: 1.5;
  }

  :global(body.dark-mode) .description {
    color: #909296;
  }

  .examples {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .examples-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #868e96;
    font-weight: 600;
  }

  :global(body.dark-mode) .examples-label {
    color: #5c5f66;
  }

  .example-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }

  .example-tag {
    background: rgba(17, 133, 254, 0.08);
    border: 1px solid rgba(17, 133, 254, 0.2);
    color: #1185fe;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .example-tag:hover {
    background: rgba(17, 133, 254, 0.15);
    border-color: rgba(17, 133, 254, 0.35);
  }

  :global(body.dark-mode) .example-tag {
    background: rgba(77, 171, 247, 0.08);
    border-color: rgba(77, 171, 247, 0.2);
    color: #4dabf7;
  }

  :global(body.dark-mode) .example-tag:hover {
    background: rgba(77, 171, 247, 0.15);
    border-color: rgba(77, 171, 247, 0.35);
  }

  .input-container {
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
  }

  .title-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    background: #fff;
    color: #1a1b1e;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }

  .title-input:focus {
    outline: none;
    border-color: #1185fe;
  }

  .title-input::placeholder {
    color: #adb5bd;
    font-weight: 400;
  }

  :global(body.dark-mode) .title-input {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.1);
    color: #e7e7e7;
  }

  :global(body.dark-mode) .title-input:focus {
    border-color: #4dabf7;
  }

  :global(body.dark-mode) .title-input::placeholder {
    color: #5c5f66;
  }

  .actions {
    margin-top: 4px;
  }

  .create-btn {
    background-color: #1185fe;
    color: white;
    border: none;
    padding: 10px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .create-btn:hover:not(:disabled) {
    background-color: #0070e0;
  }

  .create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
