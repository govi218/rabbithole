<script lang="ts">
  export let url: string;
  export let title: string | null = null;
  export let description: string | null = null;
  export let image: string | null = null;
  export let defaultImage: string = "/rabbit-default-1.jpg";

  function useDefaultImage(e: Event) {
    const img = e.target as HTMLImageElement;
    img.src = defaultImage;
  }

  let hostname = "";
  try { hostname = new URL(url).hostname.replace(/^www\./, ""); } catch {}

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
</script>

<a href={url} target="_blank" rel="noopener noreferrer" class="link-card">
  <div class="card-image">
    <img src={image ?? defaultImage} alt={title ?? hostname} loading="lazy" on:error={useDefaultImage} />
  </div>
  <div class="card-body">
    <div class="card-top">
      <div class="card-favicon-host">
        <img src={faviconUrl} alt="" class="favicon" width="16" height="16" />
        <span class="hostname">{hostname}</span>
      </div>
      <span class="card-arrow">↗</span>
    </div>
    {#if title}
      <p class="card-title">{title}</p>
    {/if}
    {#if description}
      <p class="card-desc">{description}</p>
    {/if}
    {#if !title}
      <p class="card-url">{url}</p>
    {/if}
  </div>
</a>

<style>
  .link-card {
    display: flex;
    flex-direction: column;
    background: #1c1d21;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    overflow: hidden;
    text-decoration: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .link-card:hover {
    border-color: #4dabf7;
    box-shadow: 0 4px 16px rgba(77,171,247,0.1);
  }

  .card-image {
    height: 140px;
    overflow: hidden;
    background: #25262b;
    flex-shrink: 0;
  }
  .card-image img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform 0.2s;
  }
  .link-card:hover .card-image img { transform: scale(1.03); }

  .card-body {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-favicon-host {
    display: flex; align-items: center; gap: 5px; flex: 1; min-width: 0;
  }
  .favicon { border-radius: 3px; flex-shrink: 0; }
  .hostname {
    font-size: 12px; color: #868e96;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .card-arrow { font-size: 12px; color: #5c5f66; flex-shrink: 0; }

  .card-title {
    font-size: 13px; font-weight: 600; color: #e7e7e7; margin: 0;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }

  .card-desc {
    font-size: 12px; color: #868e96; margin: 0; line-height: 1.5;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }

  .card-url {
    font-size: 12px; color: #4dabf7; margin: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
</style>
