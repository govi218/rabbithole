<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import {
    fetchTrailByUri,
    resolveHandle,
  } from "@rabbithole/shared/atproto/explore";
  import type {
    ActorTrail,
    TrailStop,
  } from "@rabbithole/shared/atproto/explore";
  import { getSession, recordOps } from "$lib/atproto/client";
  import { walks, completions } from "$lib/store/pds";
  import type { ATProtoSession } from "@rabbithole/shared/types";

  let session: ATProtoSession | null = null;
  let trail: ActorTrail | null = null;
  let isLoading = true;
  let loadError: string | null = null;

  // edit state
  let showEdit = false;
  let editTitle = "";
  let editDesc = "";
  let editStops: {
    tid: string;
    title: string;
    url: string;
    note: string;
    buttonText: string;
  }[] = [];
  let isSaving = false;
  let saveError: string | null = null;
  let isDeleting = false;
  let showConfirmDelete = false;
  let deleteError: string | null = null;

  function openEdit() {
    if (!trail) return;
    editTitle = trail.title;
    editDesc = trail.description;
    editStops = trail.stops.map((s) => ({
      tid: s.tid,
      title: s.title,
      url: s.url,
      note: s.note,
      buttonText: s.buttonText === "Next" ? "" : s.buttonText,
    }));
    if (editStops.length === 0)
      editStops = [{ tid: "", title: "", url: "", note: "", buttonText: "" }];
    saveError = null;
    showEdit = true;
  }

  function addEditStop() {
    editStops = [
      ...editStops,
      { tid: "", title: "", url: "", note: "", buttonText: "" },
    ];
  }
  function removeEditStop(i: number) {
    editStops = editStops.filter((_, idx) => idx !== i);
  }

  async function saveEdit() {
    if (!session || !trail || !editTitle.trim()) return;
    isSaving = true;
    saveError = null;
    try {
      const stops = editStops
        .filter((s) => s.title.trim() || s.url.trim())
        .map((s, i) => ({
          tid: s.tid || `stop-${i}`,
          title: s.title.trim(),
          content: s.note.trim(),
          buttonText: s.buttonText.trim() || "Next",
          ...(s.url.trim() ? { external: { uri: s.url.trim() } } : {}),
        }));
      const rkey = trail.uri.split("/").pop()!;
      await recordOps.putRecord(
        session.did,
        "app.sidetrail.trail",
        rkey,
        {
          $type: "app.sidetrail.trail",
          title: editTitle.trim(),
          description: editDesc.trim(),
          stops,
        },
        trail.cid,
      );
      // Refresh trail data
      const did = await resolveHandle($page.params.did);
      trail = await fetchTrailByUri(
        `at://${did}/app.sidetrail.trail/${$page.params.rkey}`,
      );
      showEdit = false;
    } catch (e: any) {
      saveError = e.message;
    } finally {
      isSaving = false;
    }
  }

  $: isOwner = !!(session && trail && session.did === trail.authorDid);

  async function deleteTrail() {
    if (!session || !trail) return;
    isDeleting = true;
    deleteError = null;
    try {
      const rkey = trail.uri.split("/").pop()!;
      await recordOps.deleteRecord(session.did, "app.sidetrail.trail", rkey);
      goto("/home");
    } catch (e: any) {
      deleteError = e.message ?? "Failed to delete trail.";
    } finally {
      isDeleting = false;
    }
  }

  // walk state
  let walkPhase: "idle" | "walking" | "complete" = "idle";
  let walkRkey = "";
  let walkVisitedTids: string[] = [];
  let currentStopIndex = 0;
  let isWalkLoading = false;
  let walkError: string | null = null;

  onMount(async () => {
    session = getSession();
    try {
      const did = await resolveHandle($page.params.did);
      trail = await fetchTrailByUri(
        `at://${did}/app.sidetrail.trail/${$page.params.rkey}`,
      );
      if (!trail) {
        loadError = "Trail not found.";
        return;
      }

      // resume active walk if one exists
      if (session) {
        try {
          const walksRes = await recordOps.listRecords(
            session.did,
            "app.sidetrail.walk",
          );
          const active = walksRes.records.find(
            (r: any) => r.value?.trail?.uri === trail!.uri,
          );
          if (active) {
            const v = active.value as any;
            const visited: string[] = v.visitedStops ?? [];
            const lastTid = visited[visited.length - 1];
            const idx = trail.stops.findIndex((s) => s.tid === lastTid);
            walkRkey = active.uri.split("/").pop() ?? "";
            walkVisitedTids = visited;
            currentStopIndex = idx >= 0 ? idx : 0;
            walkPhase = "walking";
          }
        } catch {}
      }
    } catch (e: any) {
      loadError = e.message ?? "Failed to load trail.";
    } finally {
      isLoading = false;
    }
  });

  // ── walk ──────────────────────────────────────────────────────────────────

  async function startWalk() {
    if (!session || !trail) return;
    isWalkLoading = true;
    walkError = null;
    try {
      const firstTid = trail.stops[0]?.tid ?? "stop-0";
      const res = await recordOps.createRecord(
        session.did,
        "app.sidetrail.walk",
        {
          $type: "app.sidetrail.walk",
          trail: { uri: trail.uri, cid: trail.cid },
          visitedStops: [firstTid],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      );
      walkRkey = res.uri.split("/").pop() ?? "";
      walkVisitedTids = [firstTid];
      currentStopIndex = 0;
      walkPhase = "walking";
    } catch (e: any) {
      walkError = e.message;
    } finally {
      isWalkLoading = false;
    }
  }

  async function advance() {
    if (!session || !trail) return;
    isWalkLoading = true;
    walkError = null;
    try {
      const nextIndex = currentStopIndex + 1;
      if (nextIndex >= trail.stops.length) {
        await complete();
        return;
      }
      const nextTid = trail.stops[nextIndex].tid;
      const newVisited = [...walkVisitedTids, nextTid];
      await recordOps.putRecord(session.did, "app.sidetrail.walk", walkRkey, {
        $type: "app.sidetrail.walk",
        trail: { uri: trail.uri, cid: trail.cid },
        visitedStops: newVisited,
        updatedAt: new Date().toISOString(),
      });
      walkVisitedTids = newVisited;
      currentStopIndex = nextIndex;
    } catch (e: any) {
      walkError = e.message;
    } finally {
      isWalkLoading = false;
    }
  }

  async function complete() {
    if (!session || !trail) return;
    try {
      await recordOps.deleteRecord(session.did, "app.sidetrail.walk", walkRkey);
      await recordOps.createRecord(session.did, "app.sidetrail.completion", {
        $type: "app.sidetrail.completion",
        trail: { uri: trail.uri, cid: trail.cid },
        createdAt: new Date().toISOString(),
      });
      walks.update((ws) => ws.filter((w) => w.trailUri !== trail!.uri));
      completions.update((cs) => [
        {
          uri: "",
          trailUri: trail!.uri,
          trailTitle: trail!.title,
          createdAt: new Date().toISOString(),
        },
        ...cs.filter((c) => c.trailUri !== trail!.uri),
      ]);
      walkPhase = "complete";
    } catch (e: any) {
      walkError = e.message;
    } finally {
      isWalkLoading = false;
    }
  }

  async function abandon() {
    if (session && walkRkey)
      try {
        await recordOps.deleteRecord(
          session.did,
          "app.sidetrail.walk",
          walkRkey,
        );
      } catch {}
    walkPhase = "idle";
  }

  function maybeOpenUrl(stop: TrailStop) {
    if (stop.url && stop.url.startsWith("http")) {
      window.open(stop.url, "_blank", "noopener,noreferrer");
    }
  }

  $: currentStop = trail?.stops[currentStopIndex] ?? null;
  $: totalStops = trail?.stops.length ?? 0;
</script>

<svelte:head>
  <title>{trail ? `${trail.title} — Rabbithole` : "Trail — Rabbithole"}</title>
</svelte:head>

<main class="page">
  {#if isLoading}
    <p class="status">Loading trail...</p>
  {:else if loadError}
    <p class="error">{loadError}</p>
    <a href="/explore" class="back-link">← Back to Explore</a>
  {:else if trail}
    {#if walkPhase === "idle"}
      <!-- ── Trail detail ── -->
      <a href="/explore" class="back-link">← Explore</a>

      <div class="trail-hero">
        <div class="trail-meta">
          {#if trail.authorAvatar}
            <img
              src={trail.authorAvatar}
              alt={trail.authorHandle}
              class="author-avatar"
            />
          {/if}
          <a
            href="https://bsky.app/profile/{trail.authorHandle ?? trail.authorDid}"
            target="_blank"
            rel="noopener noreferrer"
            class="author-handle"
            >@{trail.authorHandle ?? trail.authorDid}</a
          >
        </div>

        <h1>{trail.title}</h1>

        {#if trail.description}
          <p class="trail-desc">{trail.description}</p>
        {/if}

        <div class="trail-stats">
          <span class="stop-count"
            >{totalStops} stop{totalStops !== 1 ? "s" : ""}</span
          >
        </div>

        <div class="trail-actions">
          {#if session}
            <button
              class="walk-btn"
              on:click={startWalk}
              disabled={isWalkLoading}
            >
              {isWalkLoading ? "Starting…" : "Walk this trail →"}
            </button>
          {:else}
            <a href="/home" class="signin-cta">Sign in to walk this trail →</a>
          {/if}
          {#if isOwner}
            <button class="edit-btn" on:click={openEdit}>Edit ✎</button>
            <button class="delete-btn" on:click={() => (showConfirmDelete = true)}>
              Delete
            </button>
          {/if}
        </div>
      </div>

      <a
        href="https://chromewebstore.google.com/detail/rabbithole/nbklhnbdhfhbcojfbhncgkdlppbkiaec"
        class="ext-cta"
        target="_blank"
        rel="noopener noreferrer"
      >
        🐇 Get the Rabbithole extension for the best experience
      </a>

      <!-- Stop list -->
      <div class="stops-list">
        {#each trail.stops as stop, i}
          <div class="stop-row">
            <div class="stop-num">{i + 1}</div>
            <span class="stop-title"
              >{stop.title || stop.url || "Stop " + (i + 1)}</span
            >
          </div>
        {/each}
      </div>
    {:else if walkPhase === "walking" && currentStop}
      <!-- ── Walking ── -->
      <div class="walk-view">
        <div class="walk-top">
          <span class="walk-trail-name">{trail.title}</span>
          <div class="progress-dots">
            {#each trail.stops as _, i}
              <div
                class="dot"
                class:visited={i < currentStopIndex}
                class:current={i === currentStopIndex}
              ></div>
            {/each}
          </div>
        </div>

        <div class="walk-card">
          <div class="walk-card-num">{currentStopIndex + 1}</div>
          <h2 class="walk-stop-title">
            {currentStop.title || "Stop " + (currentStopIndex + 1)}
          </h2>
          {#if currentStop.note}
            <p class="walk-stop-note">{currentStop.note}</p>
          {/if}
          {#if currentStop.url && currentStop.url.startsWith("http")}
            <a
              href={currentStop.url}
              target="_blank"
              rel="noopener noreferrer"
              class="walk-stop-url">{currentStop.url}</a
            >
            <button class="open-btn" on:click={() => maybeOpenUrl(currentStop)}
              >Open ↗</button
            >
          {/if}
        </div>

        {#if walkError}<p class="error">{walkError}</p>{/if}

        <div class="walk-actions">
          <button class="abandon-btn" on:click={abandon}>Abandon</button>
          <button
            class="advance-btn"
            on:click={advance}
            disabled={isWalkLoading}
          >
            {isWalkLoading
              ? "…"
              : currentStopIndex + 1 < totalStops
                ? (currentStop.buttonText || "Next") + " →"
                : "Complete ✓"}
          </button>
        </div>
      </div>
    {:else if walkPhase === "complete"}
      <!-- ── Complete ── -->
      <div class="completion-wrap">
        <div class="completion-card">
          <div class="confetti">🎉</div>
          <h1>Trail Complete!</h1>
          <p class="completion-sub">
            You finished <strong>{trail.title}</strong>
          </p>
          <div class="stat-pill">
            <span class="stat-num">{totalStops}</span>
            <span class="stat-label"
              >stop{totalStops !== 1 ? "s" : ""} visited</span
            >
          </div>
          <div class="completion-actions">
            <button class="walk-btn" on:click={() => (walkPhase = "idle")}
              >Back to trail</button
            >
            <a href="/explore" class="ghost-link">Explore more</a>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</main>

{#if showConfirmDelete}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click|self={() => (showConfirmDelete = false)}>
    <div class="modal confirm-modal">
      <h2>Delete trail?</h2>
      <p class="confirm-body">This will permanently delete <strong>{trail?.title}</strong>. This cannot be undone.</p>
      {#if deleteError}<p class="save-error">{deleteError}</p>{/if}
      <div class="modal-actions">
        <button class="ghost-btn" on:click={() => (showConfirmDelete = false)} disabled={isDeleting}>Cancel</button>
        <button class="danger-btn" on:click={deleteTrail} disabled={isDeleting}>
          {isDeleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showEdit}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click|self={() => (showEdit = false)}>
    <div class="modal">
      <h2>Edit Trail</h2>

      <div class="form-group">
        <label class="form-label">Title</label>
        <input
          class="form-input"
          placeholder="My trail"
          bind:value={editTitle}
        />
      </div>

      <div class="form-group">
        <label class="form-label"
          >Starting note <span class="optional">optional</span></label
        >
        <input
          class="form-input"
          placeholder="Context shown before the first stop..."
          bind:value={editDesc}
        />
      </div>

      <div class="form-group">
        <label class="form-label">Stops</label>
        <div class="stops-form">
          {#each editStops as stop, i}
            <div class="stop-form-block">
              <div class="stop-form-header">
                <div class="stop-num-sm">{i + 1}</div>
                {#if editStops.length > 1}
                  <button
                    class="remove-stop-btn"
                    on:click={() => removeEditStop(i)}>✕</button
                  >
                {/if}
              </div>
              <input
                class="form-input"
                placeholder="Step title"
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
              ></textarea>
              <div class="btn-preview-row">
                <span class="btn-preview-label">Button</span>
                <div class="btn-preview-wrap">
                  <input
                    class="btn-preview-input"
                    placeholder="Next"
                    bind:value={stop.buttonText}
                    style="width: {Math.max(
                      4,
                      (stop.buttonText || 'Next').length,
                    )}ch"
                  />
                  <span class="btn-preview-arrow">→</span>
                </div>
              </div>
            </div>
          {/each}
          <button class="add-stop-btn" on:click={addEditStop}>+ Add stop</button
          >
        </div>
      </div>

      {#if saveError}<p class="save-error">{saveError}</p>{/if}
      <div class="modal-actions">
        <button class="ghost-btn" on:click={() => (showEdit = false)}
          >Cancel</button
        >
        <button
          class="primary-btn"
          on:click={saveEdit}
          disabled={isSaving || !editTitle.trim()}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page {
    max-width: 680px;
    margin: 80px auto 80px;
    padding: 0 24px;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status {
    color: #868e96;
    font-size: 14px;
  }
  .error {
    color: #ff6b6b;
    font-size: 13px;
    margin: 0;
  }

  .back-link {
    color: #4dabf7;
    font-size: 13px;
    text-decoration: none;
    align-self: flex-start;
  }
  .back-link:hover {
    text-decoration: underline;
  }

  /* ── Trail hero ── */
  .trail-hero {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 28px 0 8px;
  }

  .trail-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .author-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: cover;
  }
  .author-handle {
    font-size: 13px;
    color: #868e96;
    text-decoration: none;
  }
  .author-handle:hover {
    color: #c1c2c5;
    text-decoration: underline;
  }

  h1 {
    font-size: 2rem;
    font-weight: 900;
    margin: 0;
    color: #e7e7e7;
    line-height: 1.15;
  }

  .trail-desc {
    font-size: 15px;
    color: #909296;
    margin: 0;
    line-height: 1.6;
  }

  .trail-stats {
    display: flex;
    gap: 8px;
  }
  .stop-count {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(77, 171, 247, 0.1);
    color: #4dabf7;
    border: 1px solid rgba(77, 171, 247, 0.25);
  }

  .walk-btn {
    align-self: flex-start;
    padding: 11px 22px;
    background: #1185fe;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .walk-btn:hover {
    background: #0070e0;
  }
  .walk-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .signin-cta {
    align-self: flex-start;
    padding: 11px 22px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #c1c2c5;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.15s;
  }
  .signin-cta:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* ── Stop list ── */
  .stops-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .stop-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #1c1d21;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 14px;
    transition: border-color 0.15s;
  }
  .stop-row:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .stop-num {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #1185fe;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 12px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .stop-content {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-width: 0;
  }

  .stop-title {
    font-size: 14px;
    font-weight: 600;
    color: #e7e7e7;
  }

  .stop-note {
    font-size: 13px;
    color: #868e96;
    margin: 0;
    line-height: 1.5;
  }

  .stop-url {
    font-size: 12px;
    color: #5c6470;
    word-break: break-all;
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stop-url:hover {
    color: #909296;
  }

  .btn-preview {
    display: inline-flex;
    align-items: center;
    background: #1185fe;
    color: white;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 12px;
    border-radius: 6px;
    align-self: flex-start;
    margin-top: 2px;
  }

  /* ── Walk ── */
  .walk-view {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-top: 16px;
  }

  .walk-top {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .walk-trail-name {
    font-size: 13px;
    color: #868e96;
    font-weight: 500;
  }

  .progress-dots {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #373a40;
    transition:
      background 0.2s,
      transform 0.2s;
  }
  .dot.visited {
    background: #4dabf7;
    opacity: 0.5;
  }
  .dot.current {
    background: #4dabf7;
    transform: scale(1.4);
  }

  .walk-card {
    background: #1c1d21;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 16px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .walk-card-num {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #1185fe;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 14px;
    flex-shrink: 0;
  }

  .walk-stop-title {
    font-size: 22px;
    font-weight: 800;
    color: #e7e7e7;
    margin: 0;
  }

  .walk-stop-note {
    font-size: 15px;
    color: #909296;
    margin: 0;
    line-height: 1.6;
  }

  .walk-stop-url {
    font-size: 12px;
    color: #5c6470;
    text-decoration: none;
    word-break: break-all;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .walk-stop-url:hover {
    color: #909296;
  }

  .open-btn {
    align-self: flex-start;
    background: rgba(77, 171, 247, 0.08);
    border: 1px solid rgba(77, 171, 247, 0.2);
    border-radius: 8px;
    padding: 6px 14px;
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

  .advance-btn {
    padding: 11px 24px;
    background: #1185fe;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    min-width: 120px;
  }
  .advance-btn:hover {
    background: #0070e0;
  }
  .advance-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .abandon-btn {
    background: none;
    border: none;
    color: #5c5f66;
    font-size: 14px;
    cursor: pointer;
    padding: 8px 0;
    font-family: inherit;
    transition: color 0.15s;
  }
  .abandon-btn:hover {
    color: #ff6b6b;
  }

  /* ── Completion ── */
  .completion-wrap {
    display: flex;
    justify-content: center;
    padding: 40px 0;
  }
  .completion-card {
    background: #1c1d21;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 24px;
    padding: 48px 40px;
    max-width: 440px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
    animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes popIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(12px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  .confetti {
    font-size: 52px;
    line-height: 1;
  }
  .completion-card h1 {
    font-size: 26px;
    font-weight: 900;
    color: #e7e7e7;
    margin: 0;
  }
  .completion-sub {
    font-size: 14px;
    color: #909296;
    margin: 0;
  }
  .completion-sub strong {
    color: #e7e7e7;
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
    font-size: 26px;
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
  .completion-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .ghost-link {
    padding: 11px 20px;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    color: #909296;
    text-decoration: none;
    transition:
      border-color 0.15s,
      color 0.15s;
  }
  .ghost-link:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #c1c2c5;
  }

  .ext-cta {
    display: inline-block;
    align-self: flex-start;
    font-size: 12px;
    color: #868e96;
    text-decoration: none;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px 12px;
    transition:
      color 0.15s,
      border-color 0.15s;
  }
  .ext-cta:hover {
    color: #c1c2c5;
    border-color: rgba(255, 255, 255, 0.18);
  }

  .trail-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .edit-btn {
    padding: 11px 18px;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    color: #909296;
    font-family: inherit;
    transition:
      border-color 0.15s,
      color 0.15s;
  }
  .edit-btn:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #c1c2c5;
  }

  .delete-btn {
    padding: 11px 18px;
    background: none;
    border: 1px solid rgba(255, 107, 107, 0.25);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    color: #ff6b6b;
    font-family: inherit;
    transition: border-color 0.15s, background 0.15s;
  }
  .delete-btn:hover {
    background: rgba(255, 107, 107, 0.08);
    border-color: rgba(255, 107, 107, 0.5);
  }
  .delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Edit modal ── */
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
  .stop-num-sm {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #1185fe;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 11px;
    flex-shrink: 0;
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
    transition:
      border-color 0.15s,
      color 0.15s;
  }
  .add-stop-btn:hover {
    border-color: #4dabf7;
    color: #4dabf7;
  }
  .save-error {
    color: #ff6b6b;
    font-size: 13px;
    margin: 0;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
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
    transition:
      border-color 0.15s,
      color 0.15s;
  }
  .ghost-btn:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #c1c2c5;
  }

  .confirm-modal {
    max-width: 400px;
  }
  .confirm-body {
    font-size: 14px;
    color: #909296;
    margin: 0;
    line-height: 1.6;
  }
  .confirm-body strong {
    color: #e7e7e7;
  }
  .danger-btn {
    padding: 10px 20px;
    background: #e03131;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }
  .danger-btn:hover {
    background: #c92a2a;
  }
  .danger-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
