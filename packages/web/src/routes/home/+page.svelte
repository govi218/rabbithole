<script lang="ts">
  import { onMount } from "svelte";
  import { getSession, startAuthFlow, clearSession } from "$lib/atproto/client";
  import { collections, trails, isLoading, loadUserData } from "$lib/store/pds";
  import type { ATProtoSession } from "@rabbithole/shared/types";

  let session: ATProtoSession | null = null;
  let handleInput = "";
  let authError: string | null = null;
  let isSigningIn = false;
  let activeTrail: (typeof $trails)[0] | null = null;

  onMount(() => {
    session = getSession();
    if (session) loadUserData(session);
  });

  async function signIn() {
    authError = null;
    isSigningIn = true;
    try {
      await startAuthFlow(handleInput);
      // page will redirect to OAuth provider
    } catch (e: any) {
      authError = e.message;
      isSigningIn = false;
    }
  }

  function signOut() {
    clearSession();
    session = null;
    collections.set([]);
    trails.set([]);
  }
</script>

<svelte:head>
  <title>My Rabbitholes — Rabbithole</title>
</svelte:head>

<main class="page">
  {#if !session}
    <div class="auth-panel">
      <h1>Sign in</h1>
      <p>Use your Bluesky or ATProto handle to access your collections and trails.</p>
      <input
        type="text"
        placeholder="user.bsky.social"
        bind:value={handleInput}
        on:keydown={(e) => e.key === "Enter" && signIn()}
        class="handle-input"
      />
      <button class="primary-btn" on:click={signIn} disabled={isSigningIn}>
        {isSigningIn ? "Redirecting..." : "Sign in"}
      </button>
      {#if authError}
        <p class="error">{authError}</p>
      {/if}
    </div>
  {:else if $isLoading}
    <p class="loading">Loading your data...</p>
  {:else if activeTrail}
    <div class="trail-detail">
      <button class="back-btn" on:click={() => activeTrail = null}>← Back</button>
      <h2>{activeTrail.title}</h2>
      {#if activeTrail.description}<p class="desc">{activeTrail.description}</p>{/if}
      <ol class="stops">
        {#each activeTrail.stops as stop}
          <li>
            <a href={stop.url} target="_blank" rel="noopener noreferrer">{stop.url}</a>
            {#if stop.note}<p class="note">{stop.note}</p>{/if}
          </li>
        {/each}
      </ol>
    </div>
  {:else}
    <div class="header-row">
      <h1>My Rabbitholes</h1>
      <button class="logout-btn" on:click={signOut}>Sign out</button>
    </div>

    {#if $trails.length > 0}
      <section>
        <h2>Trails</h2>
        <div class="grid">
          {#each $trails as trail}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div class="card" on:click={() => activeTrail = trail}>
              <h3>{trail.title}</h3>
              {#if trail.description}<p class="desc">{trail.description}</p>{/if}
              <span class="meta">{trail.stops.length} stop{trail.stops.length !== 1 ? "s" : ""}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if $collections.length > 0}
      <section>
        <h2>Collections</h2>
        <div class="grid">
          {#each $collections as col}
            <div class="card">
              <h3>{col.name}</h3>
              <span class="meta">{col.urls.length} URL{col.urls.length !== 1 ? "s" : ""}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if $trails.length === 0 && $collections.length === 0}
      <p class="empty">No published trails or collections yet. Use the extension to publish some!</p>
    {/if}
  {/if}
</main>

<style>
  .page { max-width: 860px; margin: 80px auto 40px; padding: 0 24px; font-family: system-ui, sans-serif; }
  h1 { font-size: 2rem; font-weight: 700; margin-bottom: 8px; }
  h2 { font-size: 1.25rem; font-weight: 600; margin: 24px 0 12px; }
  h3 { font-size: 14px; font-weight: 600; margin: 0 0 4px; }
  .auth-panel { max-width: 400px; display: flex; flex-direction: column; gap: 12px; }
  .handle-input { padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; outline: none; }
  .handle-input:focus { border-color: #1185fe; }
  .primary-btn { padding: 10px 20px; background: #1185fe; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
  .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .logout-btn { padding: 6px 12px; background: none; border: 1px solid #dee2e6; border-radius: 6px; font-size: 13px; cursor: pointer; }
  .header-row { display: flex; align-items: center; justify-content: space-between; }
  .error { color: #dc3545; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .card { padding: 14px; border: 1px solid #dee2e6; border-radius: 8px; cursor: pointer; transition: border-color 0.15s; }
  .card:hover { border-color: #1185fe; }
  .desc { font-size: 12px; color: #868e96; margin: 0 0 8px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .meta { font-size: 11px; color: #adb5bd; }
  .loading, .empty { color: #868e96; }
  .back-btn { background: none; border: none; color: #1185fe; cursor: pointer; padding: 0; font-size: 13px; }
  .stops { display: flex; flex-direction: column; gap: 12px; padding-left: 20px; }
  .stops li { display: flex; flex-direction: column; gap: 4px; }
  .stops a { font-size: 13px; color: #1185fe; word-break: break-all; }
  .note { font-size: 12px; color: #495057; margin: 0; }
</style>
