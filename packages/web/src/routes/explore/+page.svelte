<script lang="ts">
  import { goto } from "$app/navigation";
  import Explore from "@rabbithole/shared/lib/Explore.svelte";
  import type {
    ActorTrail,
    ActorCollectionWithAuthor,
  } from "@rabbithole/shared/atproto/explore";

  function trailUrl(trail: ActorTrail): string {
    const match = trail.uri.match(/^at:\/\/(did:[^/]+)\/[^/]+\/([^/]+)$/);
    if (!match) return "/explore";
    const actor = trail.authorHandle ? `@${trail.authorHandle}` : match[1];
    return `/trail/${actor}/${match[2]}`;
  }

  function burrowUrl(burrow: ActorCollectionWithAuthor): string {
    const match = burrow.uri.match(/^at:\/\/(did:[^/]+)\/[^/]+\/([^/]+)$/);
    if (!match) return "/explore";
    const actor = burrow.authorHandle ? `@${burrow.authorHandle}` : match[1];
    return `/burrow/${actor}/${match[2]}`;
  }
</script>

<svelte:head>
  <title>Explore — Rabbithole</title>
</svelte:head>

<main class="page">
  <h1>Explore</h1>
  <p class="subtitle">
    Browse published trails and collections from other explorers.
  </p>
  <Explore
    onTrailClick={(trail) => goto(trailUrl(trail))}
    onBurrowClick={(burrow) => goto(burrowUrl(burrow))}
  />
</main>

<style>
  .page {
    max-width: 860px;
    margin: 80px auto 40px;
    padding: 0 24px;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 8px;
    color: #e7e7e7;
  }
  .subtitle {
    color: #868e96;
    margin-bottom: 32px;
    font-size: 14px;
  }
</style>
