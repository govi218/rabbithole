<script lang="ts">
  import { Text, ActionIcon } from "@svelteuidev/core";
  import { ChevronDown, ChevronUp } from "radix-icons-svelte";
  import { slide } from "svelte/transition";

  export let title: string = "";
  export let open: boolean = true;

  function toggle(): void {
    open = !open;
  }
</script>

<div class="collapsible-section">
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="header" on:click={toggle}>
    <Text
      weight="bold"
      size="xs"
      transform="uppercase"
      color="dimmed"
      style="letter-spacing: 0.5px;"
    >
      {title}
    </Text>
    <ActionIcon variant="transparent" size="sm" style="color: inherit;">
      {#if open}
        <ChevronUp />
      {:else}
        <ChevronDown />
      {/if}
    </ActionIcon>
  </div>

  {#if open}
    <div class="content" transition:slide|local={{ duration: 200 }}>
      <slot />
    </div>
  {/if}
</div>

<style>
  .collapsible-section {
    width: 100%;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    padding: 8px 0;
    user-select: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }

  .header:hover :global(.mantine-Text-root) {
    color: #1185fe;
  }

  :global(body.dark-mode) .header:hover :global(.mantine-Text-root) {
    color: #4dabf7;
  }

  .content {
    padding-top: 10px;
    padding-bottom: 10px;
  }
</style>
