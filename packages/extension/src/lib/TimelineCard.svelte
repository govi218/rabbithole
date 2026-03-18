<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    Button,
    Card,
    Group,
    Tooltip,
    Menu,
    ActionIcon,
  } from "@svelteuidev/core";
  import { Trash, DotsHorizontal, Plus, Copy } from "radix-icons-svelte";
  import type { Website } from "src/utils/types";
  import default1 from "../assets/rabbit-default-1.jpg";

  const dispatch = createEventDispatcher();

  export let website: Website;
  export let showDelete: boolean = true;
  export let fixedHeight: boolean = false;

  let isHoveringTitle: boolean = false;
  let isHoveringDesc: boolean = false;
  let imageLoadError: boolean = false;

  const defaultImages = [default1];

  function getDefaultImage(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) - hash + url.charCodeAt(i);
      hash |= 0;
    }
    return defaultImages[Math.abs(hash) % defaultImages.length];
  }

  function handleImageError() {
    imageLoadError = true;
  }

  async function deleteWebsite(): Promise<void> {
    dispatch("websiteDelete", {
      url: website.url,
    });
  }

  function addToBurrow(): void {
    dispatch("websiteAddToBurrow", {
      url: website.url,
    });
  }

  function addToRabbithole(): void {
    dispatch("websiteAddToRabbithole", {
      url: website.url,
    });
  }

  function handleUpdate(): void {
    dispatch("websiteUpdate", {
      url: website.url,
      name: website.name,
      description: website.description,
    });
  }

  function autoResize(node: HTMLTextAreaElement) {
    const resize = () => {
      node.style.height = "auto";
      node.style.height = node.scrollHeight + "px";
    };
    node.addEventListener("input", resize);

    // Wait for next tick to ensure value is populated and layout is done
    setTimeout(resize, 0);

    return {
      destroy() {
        node.removeEventListener("input", resize);
      },
    };
  }
</script>

<div class="card-container" class:fixed-height-container={fixedHeight}>
  <Card
    shadow="sm"
    padding="md"
    radius="sm"
    class="timeline-card {fixedHeight ? 'fixed-height' : ''}"
    withBorder
  >
    <div class="card-image-wrapper">
      {#if website.openGraphImageUrl && !imageLoadError}
        <img
          src={website.openGraphImageUrl}
          alt={website.name}
          class="card-image"
          loading="lazy"
          on:error={handleImageError}
        />
      {:else}
        <img
          src={getDefaultImage(website.url)}
          alt={website.name}
          class="card-image"
          loading="lazy"
        />
      {/if}
    </div>

    {#if showDelete}
      <div class="card-actions">
        <Menu position="bottom-end" withArrow>
          <ActionIcon
            slot="control"
            variant="transparent"
            color="gray"
            size="sm"
            radius="xl"
          >
            <DotsHorizontal />
          </ActionIcon>
          <Menu.Item icon={Plus} on:click={addToBurrow}>Add to Burrow</Menu.Item
          >
          <Menu.Item icon={Copy} on:click={addToRabbithole}
            >Add to another Rabbithole</Menu.Item
          >
          <Menu.Item icon={Trash} color="red" on:click={deleteWebsite}
            >Delete</Menu.Item
          >
        </Menu>
      </div>
    {/if}

    <!-- Header: Title -->
    <Group
      position="apart"
      noWrap
      align="start"
      style="margin-bottom: 8px; padding-right: 24px;"
    >
      <div
        class="title-wrapper"
        on:mouseenter={() => (isHoveringTitle = true)}
        on:mouseleave={() => (isHoveringTitle = false)}
      >
        <Tooltip
          label="Click to change title"
          withArrow
          opened={isHoveringTitle}
          allowPointerEvents={false}
          style="width: 100%;"
        >
          <input
            type="text"
            class="card-title-input"
            bind:value={website.name}
            on:blur={handleUpdate}
            on:keydown={(e) => e.key === "Enter" && e.target.blur()}
          />
        </Tooltip>
      </div>
    </Group>

    <!-- Body: Description -->
    <div
      class="description-container"
      on:mouseenter={() => (isHoveringDesc = true)}
      on:mouseleave={() => (isHoveringDesc = false)}
    >
      <Tooltip
        label="Click to change description"
        withArrow
        opened={isHoveringDesc}
        allowPointerEvents={false}
        style="width: 100%;"
      >
        <textarea
          use:autoResize
          class="card-desc-input"
          bind:value={website.description}
          on:blur={handleUpdate}
          placeholder="No description available."
          rows="2"
        ></textarea>
      </Tooltip>
    </div>

    <!-- Footer: Action Button -->
    <div class="card-footer">
      <Button
        variant="light"
        color="blue"
        size="xs"
        href={website.url}
        target="_blank"
      >
        Open
      </Button>
    </div>
  </Card>
</div>

<style>
  .card-container {
    width: 100%;
    padding: 5px 0;
  }

  .card-container.fixed-height-container {
    padding: 0;
    height: 100%;
  }

  .card-image-wrapper {
    margin: -16px -16px 12px -16px;
    height: 128px;
    overflow: hidden;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background-color: #f8f9fa;
    position: relative;
    flex-shrink: 0;
  }

  .card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
  }

  :global(.timeline-card:hover) .card-image {
    transform: scale(1.05);
  }

  .description-container {
    min-height: 48px;
    width: 100%;
  }

  :global(.timeline-card.fixed-height) {
    height: 256px;
  }

  :global(.timeline-card.fixed-height) .card-image-wrapper {
    height: 112px;
  }

  :global(.timeline-card.fixed-height) .description-container {
    overflow: hidden;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  :global(.timeline-card.fixed-height) .card-desc-input {
    height: 100% !important;
    overflow-y: auto;
    resize: none;
  }

  :global(.timeline-card.fixed-height) .card-desc-input::-webkit-scrollbar {
    width: 6px;
  }

  :global(.timeline-card.fixed-height)
    .card-desc-input::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
  }

  :global(body.dark-mode .timeline-card.fixed-height)
    .card-desc-input::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.1);
  }

  /* Ensure Tooltip wrapper takes full width */
  .title-wrapper :global(.mantine-Tooltip-root),
  .description-container :global(.mantine-Tooltip-root) {
    width: 100%;
    display: block;
  }

  :global(.timeline-card) {
    position: relative;
    background-color: #ffffff;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  :global(.timeline-card:hover) {
    transform: translateY(-2px);
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  .card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 999px;
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  :global(body.dark-mode) .card-actions {
    background: rgba(26, 27, 30, 0.9);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .title-wrapper {
    flex: 1;
    width: 100%;
  }

  .card-title-input {
    width: 100%;
    border: none;
    background: transparent;
    font-family: 'Share Tech', system-ui, sans-serif;
    font-weight: 700;
    font-size: 1rem; /* 16px */
    color: #1a1b1e;
    padding: 3px 6px;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    text-overflow: ellipsis;
  }

  .card-title-input:hover,
  .card-title-input:focus {
    background-color: rgba(0, 0, 0, 0.05);
    outline: none;
  }

  .card-desc-input {
    width: 100%;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 0.76rem;
    color: #868e96;
    padding: 3px 6px;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    resize: none;
    line-height: 1.5;
    display: block;
  }

  .card-desc-input:hover,
  .card-desc-input:focus {
    background-color: rgba(0, 0, 0, 0.05);
    outline: none;
    color: #495057; /* Darker text on focus/hover for better readability */
  }

  .card-footer {
    margin-top: auto;
    padding-top: 12px;
  }

  :global(.timeline-card.fixed-height) .card-footer {
    margin-bottom: 12px;
  }

  /* Dark mode styles */
  :global(body.dark-mode .timeline-card) {
    background-color: #25262b !important;
    border-color: #373a40 !important;
    color: #c1c2c5 !important;
  }

  :global(body.dark-mode) .card-image-wrapper {
    border-bottom-color: rgba(255, 255, 255, 0.12);
    background-color: #2c2e33;
  }

  :global(body.dark-mode) .card-title-input {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .card-title-input:hover,
  :global(body.dark-mode) .card-title-input:focus {
    background-color: rgba(255, 255, 255, 0.1);
  }

  :global(body.dark-mode) .card-desc-input {
    color: #909296;
  }

  :global(body.dark-mode) .card-desc-input:hover,
  :global(body.dark-mode) .card-desc-input:focus {
    background-color: rgba(255, 255, 255, 0.1);
    color: #c1c2c5;
  }
</style>
