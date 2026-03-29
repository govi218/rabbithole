<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let title = "";
  export let description = "";
  export let stops: {
    tid: string;
    title: string;
    url: string;
    note: string;
    buttonText: string;
  }[] = [{ tid: "", title: "", url: "", note: "", buttonText: "" }];
  export let isSaving = false;
  export let error: string | null = null;
  export let isEditing = false;

  const dispatch = createEventDispatcher();

  function addStop() {
    stops = [...stops, { tid: "", title: "", url: "", note: "", buttonText: "" }];
  }

  function insertStop(afterIndex: number) {
    const newStop = { tid: "", title: "", url: "", note: "", buttonText: "" };
    stops = [
      ...stops.slice(0, afterIndex + 1),
      newStop,
      ...stops.slice(afterIndex + 1),
    ];
  }

  function removeStop(i: number) {
    stops = stops.filter((_, idx) => idx !== i);
  }

  function handleSave() {
    dispatch("save", {
      title,
      description,
      stops: stops.map((s, i) => ({
        ...s,
        tid: s.tid || `stop-${Date.now()}-${i}`,
      })),
    });
  }

  function handleCancel() {
    dispatch("cancel");
  }

  $: isValid = title.trim().length > 0;
</script>

<div class="trail-form">
  <div class="form-group">
    <label class="form-label">Title</label>
    <input
      class="form-input"
      placeholder="My trail"
      bind:value={title}
    />
  </div>

  <div class="form-group">
    <label class="form-label"
      >Starting note <span class="optional">optional</span></label
    >
    <input
      class="form-input"
      placeholder="Context shown before the first stop..."
      bind:value={description}
    />
  </div>

  <div class="form-group">
    <label class="form-label">Stops</label>
    <div class="stops-form">
      {#each stops as stop, i}
        <div class="stop-form-block">
          <div class="stop-form-header">
            <div class="stop-num">{i + 1}</div>
            {#if stops.length > 1}
              <button class="remove-stop-btn" on:click={() => removeStop(i)}
                >✕</button
              >
            {/if}
          </div>
          <input
            class="form-input"
            placeholder="Step title (e.g. Create an account)"
            bind:value={stop.title}
          />
          <input
            class="form-input"
            placeholder="https://... (optional)"
            bind:value={stop.url}
          />
          <textarea
            class="form-input note-textarea"
            placeholder="Note (optional)"
            bind:value={stop.note}
            rows="2"
          ></textarea>
          <div class="btn-preview-row">
            <span class="btn-preview-label">Button</span>
            <div class="btn-preview-wrap">
              <input
                class="btn-preview-input"
                placeholder="Next"
                bind:value={stop.buttonText}
                style="width: {Math.max(
                  4,
                  (stop.buttonText || 'Next').length
                )}ch"
              />
              <span class="btn-preview-arrow">→</span>
            </div>
          </div>
        </div>

        <!-- Insert stop button between stops -->
        {#if i < stops.length - 1}
          <button class="insert-stop-btn" on:click={() => insertStop(i)}>
            <span class="insert-icon">+</span>
            <span class="insert-text">Add stop here</span>
          </button>
        {/if}
      {/each}
      <button class="add-stop-btn" on:click={addStop}>+ Add stop</button>
    </div>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="modal-actions">
    <button class="ghost-btn" on:click={handleCancel}>Cancel</button>
    <button
      class="primary-btn"
      on:click={handleSave}
      disabled={isSaving || !isValid}
    >
      {isSaving ? "Saving..." : isEditing ? "Save Changes" : "Create Trail"}
    </button>
  </div>
</div>

<style>
  .trail-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 12px;
    font-weight: 700;
    color: #868e96;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .optional {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: #adb5bd;
  }

  .form-input {
    padding: 10px 14px;
    border: 1px solid #dee2e6;
    border-radius: 10px;
    font-size: 14px;
    outline: none;
    background: #fff;
    color: #212529;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .form-input::placeholder {
    color: #adb5bd;
  }

  .form-input:focus {
    border-color: #228be6;
    box-shadow: 0 0 0 2px rgba(34, 139, 230, 0.15);
  }

  .stops-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .stop-form-block {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .stop-form-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .stop-num {
    font-size: 11px;
    font-weight: 700;
    color: #228be6;
    background: rgba(34, 139, 230, 0.1);
    padding: 2px 8px;
    border-radius: 6px;
  }

  .note-textarea {
    resize: none;
    line-height: 1.5;
    font-size: 13px;
  }

  .btn-preview-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-preview-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #868e96;
    flex-shrink: 0;
  }

  .btn-preview-wrap {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #228be6;
    border-radius: 8px;
    padding: 6px 14px;
    min-width: 60px;
    cursor: text;
  }

  .btn-preview-input {
    background: none;
    border: none;
    outline: none;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    min-width: 20px;
    max-width: 200px;
    padding: 0;
    margin: 0;
  }

  .btn-preview-input::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }

  .btn-preview-arrow {
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    flex-shrink: 0;
    pointer-events: none;
  }

  .remove-stop-btn {
    background: none;
    border: none;
    color: #868e96;
    cursor: pointer;
    font-size: 14px;
    padding: 4px 6px;
    border-radius: 6px;
    flex-shrink: 0;
    font-family: inherit;
    transition: color 0.15s;
  }

  .remove-stop-btn:hover {
    color: #fa5252;
  }

  .insert-stop-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: none;
    border: 1px dashed #dee2e6;
    border-radius: 8px;
    padding: 8px;
    color: #868e96;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    margin: -6px 0;
  }

  .insert-stop-btn:hover {
    border-color: #228be6;
    color: #228be6;
    background: rgba(34, 139, 230, 0.05);
  }

  .insert-icon {
    font-size: 14px;
    font-weight: 700;
  }

  .insert-text {
    opacity: 0;
    transition: opacity 0.15s;
  }

  .insert-stop-btn:hover .insert-text {
    opacity: 1;
  }

  .add-stop-btn {
    background: none;
    border: 1px dashed #dee2e6;
    border-radius: 8px;
    padding: 8px;
    color: #868e96;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }

  .add-stop-btn:hover {
    border-color: #228be6;
    color: #228be6;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
  }

  .primary-btn {
    padding: 10px 20px;
    background: #228be6;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }

  .primary-btn:hover {
    background: #1c7ed6;
  }

  .primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ghost-btn {
    padding: 10px 20px;
    background: none;
    border: 1px solid #dee2e6;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    color: #495057;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }

  .ghost-btn:hover {
    border-color: #adb5bd;
    color: #212529;
  }

  .error {
    color: #fa5252;
    font-size: 13px;
    margin: 0;
  }

  /* Dark mode styles */
  :global(body.dark-mode) .form-label,
  :global(.dark) .form-label {
    color: #868e96;
  }

  :global(body.dark-mode) .optional,
  :global(.dark) .optional {
    color: #5c5f66;
  }

  :global(body.dark-mode) .form-input,
  :global(.dark) .form-input {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.1);
    color: #e7e7e7;
  }

  :global(body.dark-mode) .form-input::placeholder,
  :global(.dark) .form-input::placeholder {
    color: #5c5f66;
  }

  :global(body.dark-mode) .form-input:focus,
  :global(.dark) .form-input:focus {
    border-color: #4dabf7;
    box-shadow: 0 0 0 2px rgba(77, 171, 247, 0.15);
  }

  :global(body.dark-mode) .stop-form-block,
  :global(.dark) .stop-form-block {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.07);
  }

  :global(body.dark-mode) .stop-num,
  :global(.dark) .stop-num {
    color: #4dabf7;
    background: rgba(77, 171, 247, 0.15);
  }

  :global(body.dark-mode) .btn-preview-label,
  :global(.dark) .btn-preview-label {
    color: #5c5f66;
  }

  :global(body.dark-mode) .btn-preview-wrap,
  :global(.dark) .btn-preview-wrap {
    background: #1185fe;
  }

  :global(body.dark-mode) .remove-stop-btn,
  :global(.dark) .remove-stop-btn {
    color: #5c5f66;
  }

  :global(body.dark-mode) .remove-stop-btn:hover,
  :global(.dark) .remove-stop-btn:hover {
    color: #ff6b6b;
  }

  :global(body.dark-mode) .insert-stop-btn,
  :global(.dark) .insert-stop-btn {
    border-color: rgba(255, 255, 255, 0.1);
    color: #5c5f66;
  }

  :global(body.dark-mode) .insert-stop-btn:hover,
  :global(.dark) .insert-stop-btn:hover {
    border-color: #4dabf7;
    color: #4dabf7;
    background: rgba(77, 171, 247, 0.1);
  }

  :global(body.dark-mode) .add-stop-btn,
  :global(.dark) .add-stop-btn {
    border-color: rgba(255, 255, 255, 0.15);
    color: #868e96;
  }

  :global(body.dark-mode) .add-stop-btn:hover,
  :global(.dark) .add-stop-btn:hover {
    border-color: #4dabf7;
    color: #4dabf7;
  }

  :global(body.dark-mode) .primary-btn,
  :global(.dark) .primary-btn {
    background: #1185fe;
  }

  :global(body.dark-mode) .primary-btn:hover,
  :global(.dark) .primary-btn:hover {
    background: #0070e0;
  }

  :global(body.dark-mode) .ghost-btn,
  :global(.dark) .ghost-btn {
    border-color: rgba(255, 255, 255, 0.12);
    color: #909296;
  }

  :global(body.dark-mode) .ghost-btn:hover,
  :global(.dark) .ghost-btn:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #c1c2c5;
  }

  :global(body.dark-mode) .error,
  :global(.dark) .error {
    color: #ff6b6b;
  }
</style>
