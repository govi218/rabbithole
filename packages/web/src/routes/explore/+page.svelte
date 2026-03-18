<script lang="ts">
  import Explore from "@rabbithole/shared/lib/Explore.svelte";
</script>

<svelte:head>
  <title>Explore — Rabbithole</title>
</svelte:head>

<main class="page">
  <h1>Explore</h1>
  <p class="subtitle">Browse published trails and collections from other explorers.</p>
  <Explore />
</main>

<style>
  .page {
    max-width: 860px;
    margin: 80px auto 40px;
    padding: 0 24px;
  }
  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .subtitle {
    color: #868e96;
    margin-bottom: 32px;
  }
</style>
