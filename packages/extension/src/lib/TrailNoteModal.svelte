<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "./Modal.svelte";
  import { Button, Textarea } from "@svelteuidev/core";

  export let isOpen = false;
  export let initialNote = "";

  let note = "";
  $: if (isOpen) note = initialNote;

  const dispatch = createEventDispatcher();

  function save() {
    dispatch("save", { note });
  }
</script>

<Modal {isOpen} title="Edit Note" on:close={() => dispatch("close")}>
  <Textarea
    bind:value={note}
    minRows={4}
    autosize
    placeholder="Enter your note here..."
  />
  <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
    <Button on:click={save}>Save</Button>
  </div>
</Modal>
