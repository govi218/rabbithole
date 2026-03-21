<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import {
    getSession,
    startAuthFlow,
    clearSession,
    recordOps,
  } from "$lib/atproto/client";
  import {
    collections,
    trails,
    walks,
    completions,
    isLoading,
    loadUserData,
  } from "$lib/store/pds";
  import type { PdsTrail, PdsCollection, PdsWalk } from "$lib/store/pds";
  import type { ATProtoSession } from "@rabbithole/shared/types";
  import { addCardToBurrow, removeCardFromBurrow } from "$lib/atproto/cosmik";

  let session: ATProtoSession | null = null;
  let handleInput = "";
  let authError: string | null = null;
  let isSigningIn = false;

  // typeahead
  let suggestions: { handle: string; displayName?: string; avatar?: string }[] =
    [];
  let showSuggestions = false;
  let activeIndex = -1;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let homeTab: "trails" | "burrows" = "trails";

  // create/edit modals
  let showCreateTrail = false;
  let showCreateBurrow = false;
  let editingTrail: PdsTrail | null = null;
  let editingBurrow: PdsCollection | null = null;
  let isSaving = false;
  let saveError: string | null = null;

  // trail form
  let trailTitle = "";
  let trailDesc = "";
  let trailStops: {
    tid: string;
    title: string;
    url: string;
    note: string;
    buttonText: string;
  }[] = [{ tid: "", title: "", url: "", note: "", buttonText: "" }];

  // burrow form
  let burrowName = "";
  let burrowUrls: string[] = [];

  onMount(() => {
    session = getSession();
    if (session) loadUserData(session);
  });

  async function fetchSuggestions(q: string) {
    if (q.length < 2) {
      suggestions = [];
      showSuggestions = false;
      return;
    }
    try {
      const res = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(
          q
        )}&limit=6`
      );
      if (!res.ok) return;
      const data = await res.json();
      suggestions = data.actors ?? [];
      showSuggestions = suggestions.length > 0;
    } catch {}
  }

  function onHandleInput() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchSuggestions(handleInput), 200);
  }

  function selectSuggestion(actor: { handle: string }) {
    handleInput = actor.handle;
    suggestions = [];
    showSuggestions = false;
    activeIndex = -1;
  }

  function handleSignInKeydown(e: KeyboardEvent) {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % suggestions.length;
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex =
          (activeIndex - 1 + suggestions.length) % suggestions.length;
        return;
      }
      if (e.key === "Escape") {
        showSuggestions = false;
        return;
      }
      if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
        return;
      }
    }
    if (e.key === "Enter") signIn();
  }

  async function signIn() {
    authError = null;
    isSigningIn = true;
    try {
      await startAuthFlow(handleInput);
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

  function addStop() {
    trailStops = [
      ...trailStops,
      { tid: "", title: "", url: "", note: "", buttonText: "" },
    ];
  }

  function removeStop(i: number) {
    trailStops = trailStops.filter((_, idx) => idx !== i);
  }

  function openCreateTrail() {
    editingTrail = null;
    trailTitle = "";
    trailDesc = "";
    trailStops = [{ tid: "", title: "", url: "", note: "", buttonText: "" }];
    saveError = null;
    showCreateTrail = true;
  }

  function openEditTrail(trail: PdsTrail) {
    editingTrail = trail;
    trailTitle = trail.title;
    trailDesc = trail.description;
    trailStops = trail.stops.map((s) => ({
      tid: s.tid,
      title: s.title,
      url: s.url,
      note: s.note,
      buttonText: s.buttonText === "Next" ? "" : s.buttonText,
    }));
    if (trailStops.length === 0)
      trailStops = [{ tid: "", title: "", url: "", note: "", buttonText: "" }];
    saveError = null;
    showCreateTrail = true;
  }

  function openCreateBurrow() {
    editingBurrow = null;
    burrowName = "";
    burrowUrls = [""];
    saveError = null;
    showCreateBurrow = true;
  }

  function openEditBurrow(col: PdsCollection) {
    editingBurrow = col;
    burrowName = col.name;
    burrowUrls = col.urls.length ? [...col.urls] : [""];
    saveError = null;
    showCreateBurrow = true;
  }

  function addBurrowUrl() {
    burrowUrls = [...burrowUrls, ""];
  }

  function removeBurrowUrl(i: number) {
    burrowUrls = burrowUrls.filter((_, idx) => idx !== i);
  }

  async function saveTrail() {
    if (!session || !trailTitle.trim()) return;
    isSaving = true;
    saveError = null;
    try {
      const stops = trailStops
        .filter((s) => s.title.trim() || s.url.trim())
        .map((s, i) => ({
          tid: s.tid || `stop-${i}`,
          title: s.title.trim(),
          content: s.note.trim(),
          buttonText: s.buttonText.trim() || "Next",
          ...(s.url.trim() ? { external: { uri: s.url.trim() } } : {}),
        }));
      const record = {
        $type: "app.sidetrail.trail",
        title: trailTitle.trim(),
        description: trailDesc.trim(),
        stops,
      };
      if (editingTrail) {
        const rkey = editingTrail.uri.split("/").pop()!;
        await recordOps.putRecord(
          session.did,
          "app.sidetrail.trail",
          rkey,
          record,
          editingTrail.cid
        );
      } else {
        await recordOps.createRecord(
          session.did,
          "app.sidetrail.trail",
          record
        );
      }
      showCreateTrail = false;
      await loadUserData(session);
    } catch (e: any) {
      saveError = e.message;
    } finally {
      isSaving = false;
    }
  }

  async function saveBurrow() {
    if (!session || !burrowName.trim()) return;
    isSaving = true;
    saveError = null;
    try {
      const newUrls = burrowUrls.map((u) => u.trim()).filter(Boolean);

      let collectionUri: string;
      let collectionCid: string;

      if (editingBurrow) {
        const rkey = editingBurrow.uri.split("/").pop()!;
        if (burrowName.trim() !== editingBurrow.name) {
          await recordOps.putRecord(
            session.did,
            "network.cosmik.collection",
            rkey,
            {
              $type: "network.cosmik.collection",
              name: burrowName.trim(),
              accessType: "CLOSED",
            }
          );
        }
        collectionUri = editingBurrow.uri;
        collectionCid = editingBurrow.cid;

        const existing = new Map(editingBurrow.cards.map((c) => [c.url, c]));
        const toRemove = editingBurrow.cards.filter(
          (c) => !newUrls.includes(c.url)
        );
        const toAdd = newUrls.filter((u) => !existing.has(u));

        await Promise.all(
          toRemove.map((c) =>
            removeCardFromBurrow(session!.did, c.cardUri, c.linkUri)
          )
        );
        for (const url of toAdd) {
          await addCardToBurrow(session.did, collectionUri, collectionCid, url);
        }
      } else {
        const res = await recordOps.createRecord(
          session.did,
          "network.cosmik.collection",
          {
            $type: "network.cosmik.collection",
            name: burrowName.trim(),
            accessType: "CLOSED",
          }
        );
        collectionUri = res.uri;
        collectionCid = res.cid;
        for (const url of newUrls) {
          await addCardToBurrow(session.did, collectionUri, collectionCid, url);
        }
      }

      showCreateBurrow = false;
      await loadUserData(session);
    } catch (e: any) {
      saveError = e.message;
    } finally {
      isSaving = false;
    }
  }

  function trailUrl(trail: PdsTrail): string {
    const rkey = trail.uri.split("/").pop()!;
    const actor = session?.handle
      ? `@${session.handle}`
      : trail.uri.split("/")[2];
    return `/trail/${actor}/${rkey}`;
  }

  function burrowUrl(uri: string): string {
    const parts = uri.match(/^at:\/\/(did:[^/]+)\/[^/]+\/([^/]+)$/);
    if (!parts) return "/home";
    const [, did, rkey] = parts;
    const actor =
      session?.did && did === session.did && session.handle
        ? `@${session.handle}`
        : did;
    return `/burrow/${actor}/${rkey}`;
  }

  function completionUrl(trailUri: string): string {
    const parts = trailUri.match(/^at:\/\/(did:[^/]+)\/[^/]+\/([^/]+)$/);
    if (!parts) return "/explore";
    const [, did, rkey] = parts;
    const actor =
      session?.did && did === session.did && session.handle
        ? `@${session.handle}`
        : did;
    return `/trail/${actor}/${rkey}`;
  }

  function walkUrl(walk: PdsWalk): string {
    const parts = walk.trailUri.match(/^at:\/\/(did:[^/]+)\/[^/]+\/([^/]+)$/);
    if (!parts) return "/explore";
    const [, did, rkey] = parts;
    // use own handle if it's the user's own trail, otherwise DID
    const actor =
      session?.did && did === session.did && session.handle
        ? `@${session.handle}`
        : did;
    return `/trail/${actor}/${rkey}`;
  }
</script>

<svelte:head>
  <title>My Rabbitholes — Rabbithole</title>
</svelte:head>

<main class="page">
  {#if !session}
    <div class="auth-panel">
      <h1>Sign in</h1>
      <p>
        Use your Bluesky or ATProto handle to access your collections and
        trails.
      </p>
      <div class="input-wrap">
        <input
          type="text"
          placeholder="user.bsky.social"
          bind:value={handleInput}
          on:input={onHandleInput}
          on:keydown={handleSignInKeydown}
          on:blur={() =>
            setTimeout(() => {
              showSuggestions = false;
            }, 150)}
          autocomplete="off"
          class="handle-input"
        />
        {#if showSuggestions}
          <ul class="suggestions">
            {#each suggestions as actor, i}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <li
                class="suggestion-item"
                class:active={i === activeIndex}
                on:click={() => selectSuggestion(actor)}
              >
                {#if actor.avatar}
                  <img src={actor.avatar} alt="" class="sug-avatar" />
                {:else}
                  <div class="sug-avatar-placeholder" />
                {/if}
                <div class="sug-text">
                  <span class="sug-display"
                    >{actor.displayName || actor.handle}</span
                  >
                  <span class="sug-handle">@{actor.handle}</span>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <button class="primary-btn" on:click={signIn} disabled={isSigningIn}>
        {isSigningIn ? "Redirecting..." : "Sign in"}
      </button>
      {#if authError}<p class="error">{authError}</p>{/if}
    </div>
  {:else if $isLoading}
    <p class="loading">Loading your data...</p>
  {:else}
    <div class="header-row">
      <h1>My Rabbitholes</h1>
      <div class="header-actions">
        <button
          class="create-btn"
          on:click={() => {
            homeTab = "trails";
            openCreateTrail();
          }}>+ Trail</button
        >
        <button
          class="create-btn"
          on:click={() => {
            homeTab = "burrows";
            openCreateBurrow();
          }}>+ Burrow</button
        >
        <button class="logout-btn" on:click={signOut}>Sign out</button>
      </div>
    </div>

    <div class="home-tabs">
      <button
        class="home-tab"
        class:active={homeTab === "trails"}
        on:click={() => (homeTab = "trails")}>Trails</button
      >
      <button
        class="home-tab"
        class:active={homeTab === "burrows"}
        on:click={() => (homeTab = "burrows")}>Burrows</button
      >
    </div>

    {#if homeTab === "trails"}
      {#if $trails.length > 0}
        <section>
          <h2>My Trails</h2>
          <div class="trail-scroll">
            {#each $trails as trail}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <div class="trail-chip" on:click={() => goto(trailUrl(trail))}>
                <div class="trail-chip-top">
                  <span class="trail-chip-title">{trail.title}</span>
                  <button
                    class="icon-btn"
                    on:click|stopPropagation={() => openEditTrail(trail)}
                    title="Edit">✎</button
                  >
                </div>
                <div class="trail-chip-footer">
                  <span class="stop-badge"
                    >{trail.stops.length} stop{trail.stops.length !== 1
                      ? "s"
                      : ""}</span
                  >
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if $walks.length > 0}
        <section>
          <h2>In Progress</h2>
          <div class="grid">
            {#each $walks as walk}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <div class="card" on:click={() => goto(walkUrl(walk))}>
                <div class="in-progress-label">In progress</div>
                <h3>{walk.trailTitle}</h3>
                <div class="card-footer-row">
                  <span class="stop-badge"
                    >{walk.visitedTids.length} stop{walk.visitedTids.length !==
                    1
                      ? "s"
                      : ""} visited</span
                  >
                  <button
                    class="walk-btn-sm"
                    on:click|stopPropagation={() => goto(walkUrl(walk))}
                    >Resume →</button
                  >
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if $completions.length > 0}
        <section>
          <h2>Completed</h2>
          <div class="grid">
            {#each $completions as completion}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <div
                class="card"
                on:click={() => goto(completionUrl(completion.trailUri))}
              >
                <div class="completed-label">Completed</div>
                <h3>{completion.trailTitle}</h3>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if $trails.length === 0 && $walks.length === 0 && $completions.length === 0}
        <p class="empty">
          No trails yet. Create one above or use the extension.
        </p>
      {/if}
    {:else if $collections.length > 0}
      <div class="grid" style="margin-top: 24px;">
        {#each $collections as col}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div class="card" on:click={() => goto(burrowUrl(col.uri))}>
            <h3>{col.name}</h3>
            <div class="card-footer-row">
              <span class="stop-badge"
                >{col.urls.length} URL{col.urls.length !== 1 ? "s" : ""}</span
              >
              <button
                class="icon-btn"
                on:click|stopPropagation={() => openEditBurrow(col)}
                title="Edit">✎</button
              >
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty">No burrows yet. Create one above.</p>
    {/if}
  {/if}
</main>

<!-- Create Trail Modal -->
{#if showCreateTrail}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click|self={() => (showCreateTrail = false)}>
    <div class="modal">
      <h2>{editingTrail ? "Edit Trail" : "New Trail"}</h2>

      <div class="form-group">
        <label class="form-label">Title</label>
        <input
          class="form-input"
          placeholder="My trail"
          bind:value={trailTitle}
        />
      </div>

      <div class="form-group">
        <label class="form-label"
          >Starting note <span class="optional">optional</span></label
        >
        <input
          class="form-input"
          placeholder="Context shown before the first stop..."
          bind:value={trailDesc}
        />
      </div>

      <div class="form-group">
        <label class="form-label">Stops</label>
        <div class="stops-form">
          {#each trailStops as stop, i}
            <div class="stop-form-block">
              <div class="stop-form-header">
                <div class="stop-num">{i + 1}</div>
                {#if trailStops.length > 1}
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
              />
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
          {/each}
          <button class="add-stop-btn" on:click={addStop}>+ Add stop</button>
        </div>
      </div>

      {#if saveError}<p class="error">{saveError}</p>{/if}
      <div class="modal-actions">
        <button class="ghost-btn" on:click={() => (showCreateTrail = false)}
          >Cancel</button
        >
        <button
          class="primary-btn"
          on:click={saveTrail}
          disabled={isSaving || !trailTitle.trim()}
        >
          {isSaving
            ? "Saving..."
            : editingTrail
            ? "Save Changes"
            : "Create Trail"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Create Burrow Modal -->
{#if showCreateBurrow}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click|self={() => (showCreateBurrow = false)}>
    <div class="modal">
      <h2>{editingBurrow ? "Edit Burrow" : "New Burrow"}</h2>
      <div class="form-group">
        <label class="form-label">Name</label>
        <input
          class="form-input"
          placeholder="My burrow"
          bind:value={burrowName}
        />
      </div>
      <div class="form-group">
        <label class="form-label">Links</label>
        {#each burrowUrls as url, i}
          <div class="stop-form-block" style="margin-bottom:8px;">
            <div class="stop-form-row">
              <input
                class="form-input"
                placeholder="https://..."
                bind:value={burrowUrls[i]}
              />
              {#if burrowUrls.length > 1}
                <button
                  class="remove-stop-btn"
                  on:click={() => removeBurrowUrl(i)}
                  title="Remove">✕</button
                >
              {/if}
            </div>
          </div>
        {/each}
        <button class="add-stop-btn" on:click={addBurrowUrl}>+ Add link</button>
      </div>
      {#if saveError}<p class="error">{saveError}</p>{/if}
      <div class="modal-actions">
        <button class="ghost-btn" on:click={() => (showCreateBurrow = false)}
          >Cancel</button
        >
        <button
          class="primary-btn"
          on:click={saveBurrow}
          disabled={isSaving || !burrowName.trim()}
        >
          {isSaving
            ? "Saving..."
            : editingBurrow
            ? "Save Changes"
            : "Create Burrow"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 860px;
    margin: 80px auto 40px;
    padding: 0 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
  }

  h1 {
    font-size: 2rem;
    font-weight: 900;
    margin: 0 0 8px;
    color: #e7e7e7;
  }
  h2 {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 24px 0 10px;
    color: #c1c2c5;
  }
  h2:first-child {
    margin-top: 24px;
  }

  .home-tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-top: 8px;
  }
  .home-tab {
    padding: 8px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    font-weight: 500;
    color: #868e96;
    cursor: pointer;
    margin-bottom: -1px;
    transition: color 0.15s;
    font-family: inherit;
  }
  .home-tab.active {
    color: #4dabf7;
    border-bottom-color: #4dabf7;
  }
  .home-tab:hover:not(.active) {
    color: #c1c2c5;
  }

  /* ── Auth ── */
  .auth-panel {
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .auth-panel p {
    color: #909296;
    font-size: 14px;
    margin: 0;
  }

  .input-wrap {
    position: relative;
    width: 100%;
  }

  .suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #1a1b1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    list-style: none;
    margin: 0;
    padding: 4px 0;
    z-index: 50;
    overflow: hidden;
  }
  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.1s;
  }
  .suggestion-item:hover,
  .suggestion-item.active {
    background: rgba(255, 255, 255, 0.06);
  }
  .sug-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }
  .sug-avatar-placeholder {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #373a40;
    flex-shrink: 0;
  }
  .sug-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .sug-display {
    font-size: 13px;
    font-weight: 600;
    color: #e7e7e7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sug-handle {
    font-size: 12px;
    color: #868e96;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .handle-input {
    padding: 10px 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    font-size: 14px;
    outline: none;
    background: #25262b;
    color: #e7e7e7;
    box-sizing: border-box;
    width: 100%;
    font-family: inherit;
  }
  .handle-input::placeholder {
    color: #868e96;
  }
  .handle-input:focus {
    border-color: #4dabf7;
  }

  /* ── Buttons ── */
  .primary-btn {
    padding: 10px 20px;
    background: #1185fe;
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
    background: #0070e0;
  }
  .primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .back-btn {
    background: none;
    border: none;
    color: #4dabf7;
    cursor: pointer;
    padding: 0;
    font-size: 13px;
    font-family: inherit;
  }

  /* ── Dashboard ── */
  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .create-btn {
    padding: 7px 14px;
    background: rgba(17, 133, 254, 0.12);
    border: 1px solid rgba(17, 133, 254, 0.3);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    color: #4dabf7;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s;
  }
  .create-btn:hover {
    background: rgba(17, 133, 254, 0.2);
    border-color: #4dabf7;
  }

  .logout-btn {
    padding: 6px 14px;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    color: #909296;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }
  .logout-btn:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #c1c2c5;
  }

  .error {
    color: #ff6b6b;
    font-size: 13px;
    margin: 0;
  }
  .loading,
  .empty {
    color: #868e96;
    font-size: 14px;
  }

  section {
    margin-bottom: 32px;
  }

  .grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .trail-scroll {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }
  .trail-scroll::-webkit-scrollbar {
    display: none;
  }

  .trail-chip {
    flex-shrink: 0;
    width: 200px;
    background: #25262b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 14px;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .trail-chip:hover {
    border-color: #4dabf7;
    box-shadow: 0 4px 20px rgba(77, 171, 247, 0.1);
  }

  .trail-chip-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .trail-chip-title {
    font-size: 14px;
    font-weight: 700;
    color: #e7e7e7;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    flex: 1;
  }
  .trail-chip-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .card {
    background: #25262b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 16px;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .card:hover {
    border-color: #4dabf7;
    box-shadow: 0 4px 20px rgba(77, 171, 247, 0.1);
  }
  .card.no-hover {
    cursor: default;
  }
  .card.no-hover:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: none;
  }
  .in-progress-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #f08c00;
    background: rgba(240, 140, 0, 0.1);
    border: 1px solid rgba(240, 140, 0, 0.25);
    border-radius: 999px;
    padding: 2px 8px;
    align-self: flex-start;
  }
  .completed-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #51cf66;
    background: rgba(81, 207, 102, 0.1);
    border: 1px solid rgba(81, 207, 102, 0.25);
    border-radius: 999px;
    padding: 2px 8px;
    align-self: flex-start;
  }
  .card h3 {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
    color: #e7e7e7;
  }

  .card-footer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .card-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .icon-btn {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 13px;
    color: #5c5f66;
    cursor: pointer;
    font-family: inherit;
    transition: color 0.15s, border-color 0.15s;
  }
  .icon-btn:hover {
    color: #c1c2c5;
    border-color: rgba(255, 255, 255, 0.25);
  }

  .desc {
    font-size: 12px;
    color: #909296;
    margin: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .stop-badge {
    display: inline-block;
    background: rgba(77, 171, 247, 0.1);
    color: #4dabf7;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
    align-self: flex-start;
  }

  .walk-btn-sm {
    background: none;
    border: 1px solid rgba(77, 171, 247, 0.3);
    border-radius: 6px;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
    color: #4dabf7;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .walk-btn-sm:hover {
    background: rgba(77, 171, 247, 0.1);
  }

  /* ── Walk experience ── */
  .walk-view {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 640px;
  }

  .walk-title {
    font-size: 28px;
    font-weight: 900;
    margin: 0;
    color: #e7e7e7;
  }

  .walk-subtitle {
    font-size: 15px;
    color: #868e96;
    margin: 0;
  }

  .walk-note-block {
    background: #25262b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .walk-note-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #868e96;
    letter-spacing: 0.05em;
  }
  .walk-note-text {
    font-size: 15px;
    color: #c1c2c5;
    margin: 0;
    line-height: 1.6;
  }

  .walk-start-btn {
    align-self: flex-start;
    padding: 12px 28px;
    font-size: 15px;
    font-weight: 700;
  }

  .walk-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .progress-dots {
    display: flex;
    gap: 8px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #373a40;
    transition: background 0.2s;
  }
  .dot.visited {
    background: #4dabf7;
  }
  .dot.current {
    background: #4dabf7;
    box-shadow: 0 0 0 3px rgba(77, 171, 247, 0.25);
    transform: scale(1.2);
  }

  .progress-label {
    font-size: 13px;
    color: #868e96;
    font-weight: 600;
    margin: 0;
  }

  .current-stop-badge {
    display: inline-block;
    background: rgba(77, 171, 247, 0.1);
    color: #4dabf7;
    font-size: 13px;
    font-weight: 700;
    padding: 6px 16px;
    border-radius: 999px;
    align-self: flex-start;
  }

  .site-card {
    background: #25262b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
  }
  .site-info {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .site-note {
    font-size: 14px;
    color: #909296;
    margin: 0;
    line-height: 1.6;
  }
  .site-url {
    font-size: 13px;
    color: #4dabf7;
    word-break: break-all;
    text-decoration: none;
  }
  .site-url:hover {
    text-decoration: underline;
  }

  .open-btn {
    align-self: flex-start;
    background: rgba(77, 171, 247, 0.08);
    border: 1px solid rgba(77, 171, 247, 0.2);
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 600;
    color: #4dabf7;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .open-btn:hover {
    background: rgba(77, 171, 247, 0.15);
  }

  .walk-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .abandon-btn {
    background: none;
    border: none;
    color: #868e96;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 8px;
    font-family: inherit;
    transition: color 0.15s, background 0.15s;
  }
  .abandon-btn:hover {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.08);
  }

  /* ── Completion ── */
  .completion-view {
    align-items: center;
    justify-content: center;
    min-height: 60vh;
  }

  .completion-card {
    background: #25262b;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 48px 40px;
    max-width: 480px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    text-align: center;
    animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0.88) translateY(16px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .confetti {
    font-size: 56px;
    line-height: 1;
  }
  .completion-title {
    font-size: 28px;
    font-weight: 900;
    color: #e7e7e7;
    margin: 0;
  }
  .completion-sub {
    font-size: 15px;
    color: #909296;
    margin: 0;
  }
  .completion-sub strong {
    color: #4dabf7;
  }

  .stat-pill {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(77, 171, 247, 0.08);
    border: 1px solid rgba(77, 171, 247, 0.2);
    border-radius: 12px;
    padding: 12px 28px;
  }
  .stat-num {
    font-size: 28px;
    font-weight: 900;
    color: #4dabf7;
    line-height: 1;
  }
  .stat-label {
    font-size: 11px;
    font-weight: 600;
    color: #868e96;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 4px;
  }

  /* ── Create modals ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
  }

  .modal {
    background: #1a1b1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 32px;
    width: 100%;
    max-width: 580px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    animation: popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal h2 {
    font-size: 20px;
    font-weight: 900;
    margin: 0;
    color: #e7e7e7;
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
    color: #5c5f66;
  }

  .form-input {
    padding: 10px 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    font-size: 14px;
    outline: none;
    background: #25262b;
    color: #e7e7e7;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .form-input::placeholder {
    color: #5c5f66;
  }
  .form-input:focus {
    border-color: #4dabf7;
  }

  .stops-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .stop-form-block {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
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
    color: #5c5f66;
    flex-shrink: 0;
  }

  .btn-preview-wrap {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #1185fe;
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
    color: rgba(255, 255, 255, 0.5);
  }

  .btn-preview-arrow {
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    flex-shrink: 0;
    pointer-events: none;
  }

  .remove-stop-btn {
    background: none;
    border: none;
    color: #5c5f66;
    cursor: pointer;
    font-size: 14px;
    padding: 4px 6px;
    border-radius: 6px;
    flex-shrink: 0;
    font-family: inherit;
    transition: color 0.15s;
  }
  .remove-stop-btn:hover {
    color: #ff6b6b;
  }

  .add-stop-btn {
    background: none;
    border: 1px dashed rgba(255, 255, 255, 0.15);
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
    border-color: #4dabf7;
    color: #4dabf7;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
  }

  .ghost-btn {
    padding: 10px 20px;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    color: #909296;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }
  .ghost-btn:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #c1c2c5;
  }
</style>
