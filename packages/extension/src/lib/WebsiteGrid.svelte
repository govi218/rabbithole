<script lang="ts">
  import type { Website } from "src/utils/types";
  import default1 from "../assets/rabbit-default-1.jpg";

  export let websites: Website[] = [];
  export let onSelect: (url: string) => void = () => {};

  let imageErrors: Set<string> = new Set();

  const defaultImages = [default1];

  function getDefaultImage(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) - hash + url.charCodeAt(i);
      hash |= 0;
    }
    return defaultImages[Math.abs(hash) % defaultImages.length];
  }

  function handleImageError(url: string): void {
    imageErrors = new Set(imageErrors).add(url);
  }

  function getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
</script>

<div class="grid">
  {#each websites as website (website.url)}
    <button type="button" class="card" on:click={() => onSelect(website.url)}>
      <div class="card-image-wrapper">
        {#if website.openGraphImageUrl && !imageErrors.has(website.url)}
          <img
            src={website.openGraphImageUrl}
            alt={website.name}
            class="card-image"
            loading="lazy"
            on:error={() => handleImageError(website.url)}
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
      <div class="card-title">{website.name || getDomain(website.url)}</div>
      <div class="card-meta">
        <div class="meta-item">{getDomain(website.url)}</div>
      </div>
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    width: 100%;
  }

  .card {
    position: relative;
    text-align: left;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: #ffffff;
    border-radius: 12px;
    padding: 0;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease,
      border-color 0.15s ease;
    overflow: hidden;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 22px rgba(0, 0, 0, 0.08);
    border-color: rgba(17, 133, 254, 0.35);
  }

  .card-image-wrapper {
    height: 100px;
    overflow: hidden;
    background-color: #f8f9fa;
  }

  .card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
  }

  .card:hover .card-image {
    transform: scale(1.05);
  }

  .card-title {
    font-weight: 900;
    font-size: 14px;
    color: #1a1b1e;
    padding: 10px 14px 4px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta {
    padding: 0 14px 12px;
  }

  .meta-item {
    font-size: 10px;
    color: #868e96;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 980px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  :global(body.dark-mode) .card {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.12);
  }

  :global(body.dark-mode) .card:hover {
    border-color: rgba(77, 171, 247, 0.45);
    box-shadow: 0 12px 22px rgba(0, 0, 0, 0.35);
  }

  :global(body.dark-mode) .card-image-wrapper {
    background-color: #2c2e33;
  }

  :global(body.dark-mode) .card-title {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .meta-item {
    color: #909296;
  }
</style>
