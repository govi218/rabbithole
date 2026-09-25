<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "src/lib/Modal.svelte";
  import Categorise from "src/lib/Categorise.svelte";

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher();

  function handleClose(): void {
    isOpen = false;
    dispatch("close");
  }
</script>

<Modal {isOpen} title="Clean Up My Tabs" wide on:close={handleClose}>
  {#if isOpen}
    <Categorise
      on:applied={() => dispatch("applied")}
      on:done={handleClose}
      on:close={handleClose}
    />
  {/if}
</Modal>
