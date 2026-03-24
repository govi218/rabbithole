<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { Agent } from "@atproto/api";
  import { InfoCircled } from "radix-icons-svelte";
  import CollapsibleContainer from "./CollapsibleContainer.svelte";
  import {
    getSession,
    saveSession,
    clearSession,
    startAuthFlow,
  } from "../atproto/client";
  import type { ATProtoSession } from "../atproto/client";
  import { MessageRequest } from "../utils";
  import { getDpopKey } from "src/utils/crypto";

  export let showWhyBluesky: boolean = false;

  const dispatch = createEventDispatcher();

  let isLoading: boolean = false;
  let isSyncing: boolean = false;
  let error: string = null;
  let handleInput: string = "";

  type Actor = { handle: string; displayName?: string; avatar?: string };
  let suggestions: Actor[] = [];
  let showSuggestions: boolean = false;
  let suggestionsDebounce: ReturnType<typeof setTimeout> | null = null;

  async function fetchSuggestions(q: string): Promise<void> {
    if (q.length < 2) {
      suggestions = [];
      showSuggestions = false;
      return;
    }
    try {
      const res = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(q)}&limit=6`,
      );
      if (!res.ok) return;
      const data = await res.json();
      suggestions = data.actors ?? [];
      showSuggestions = suggestions.length > 0;
    } catch {
      // non-fatal
    }
  }

  function handleInput_change(): void {
    if (suggestionsDebounce) clearTimeout(suggestionsDebounce);
    suggestionsDebounce = setTimeout(() => fetchSuggestions(handleInput), 200);
  }

  function selectSuggestion(actor: Actor): void {
    handleInput = actor.handle;
    suggestions = [];
    showSuggestions = false;
  }

  function dismissSuggestions(): void {
    showSuggestions = false;
  }

  onMount(async () => {
    await restoreSession();
  });

  async function restoreSession(): Promise<void> {
    try {
      const stored = await getSession();
      if (stored) {
        // Verify we have valid DPoP keys
        const keys = await getDpopKey();
        if (!keys) {
          await clearSession();
          return;
        }
        await fetchProfile(stored);
      }
    } catch (err) {
      await clearSession();
    }
  }

  async function fetchProfile(session: ATProtoSession): Promise<void> {
    const agent = new Agent("https://public.api.bsky.app");
    const response = await agent.getProfile({ actor: session.did });

    if (!response.success) {
      throw new Error("Failed to fetch profile");
    }
  }

  async function submitHandle(): Promise<void> {
    error = null;
    isLoading = true;

    try {
      const result = await startAuthFlow(handleInput);

      const session = {
        did: result.did,
        handle: result.handle,
        pdsUrl: result.pdsUrl,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenEndpoint: result.tokenEndpoint,
      };

      await saveSession(session);
      await fetchProfile(session);

      // Sync remote trails/collections and report what was imported
      isSyncing = true;
      let imported = { trails: { count: 0, names: [] }, burrows: { count: 0, names: [] } };
      try {
        const syncResult = await chrome.runtime.sendMessage({
          type: MessageRequest.SYNC_ATPROTO,
        });
        if (syncResult?.imported) {
          imported = syncResult.imported;
        }
      } catch {
        // sync failure is non-fatal
      } finally {
        isSyncing = false;
      }

      error = null;
      isLoading = false;
      dispatch("authSuccess", { imported });
    } catch (err) {
      error = err.message || "Failed to start authentication";
    }

    handleInput = "";
  }

  let activeIndex: number = -1;

  function handleKeydown(event: KeyboardEvent): void {
    if (showSuggestions && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % suggestions.length;
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex =
          (activeIndex - 1 + suggestions.length) % suggestions.length;
        return;
      }
      if (event.key === "Escape") {
        dismissSuggestions();
        return;
      }
      if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
        activeIndex = -1;
        return;
      }
    }
    if (event.key === "Enter") {
      submitHandle();
    }
  }
</script>

<div class="auth-container">
  {#if isLoading}
    <div class="auth-loading">
      <span class="syncing-text">Connecting...</span>
    </div>
  {:else}
    <div class="handle-input-container">
      <div class="bluesky-info">
        <InfoCircled size={16} />
        <span
          >You can use your <a
            href="https://bsky.app"
            target="_blank"
            rel="noopener noreferrer">Bluesky</a
          > handle</span
        >
      </div>

      <div class="input-wrapper">
        <input
          type="text"
          class="handle-input"
          placeholder="user.bsky.social"
          bind:value={handleInput}
          on:input={handleInput_change}
          on:keydown={handleKeydown}
          on:blur={() => setTimeout(dismissSuggestions, 150)}
          autocomplete="off"
        />
        {#if showSuggestions}
          <ul class="suggestions">
            {#each suggestions as actor, i}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
              <li
                class="suggestion-item"
                class:active={i === activeIndex}
                on:click={() => selectSuggestion(actor)}
              >
                {#if actor.avatar}
                  <img src={actor.avatar} alt="" class="suggestion-avatar" />
                {:else}
                  <div class="suggestion-avatar-placeholder" />
                {/if}
                <div class="suggestion-text">
                  <span class="suggestion-display"
                    >{actor.displayName || actor.handle}</span
                  >
                  <span class="suggestion-handle">@{actor.handle}</span>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <button
        class="auth-button login"
        on:click={submitHandle}
        disabled={isLoading}
      >
        {#if isSyncing}
          Syncing...
        {:else if isLoading}
          Connecting...
        {:else}
          Sign in
        {/if}
      </button>
    </div>

    {#if showWhyBluesky}
      <div class="why-bluesky-wrapper">
        <CollapsibleContainer title="Why Internet Handle?" defaultOpen={false}>
          <div class="why-bluesky-content">
            <ul
              style="padding-left: 20px; margin-top: 10px; margin-bottom: 20px;"
            >
              <li style="margin-bottom: 8px;">
                <strong>Own your Rabbitholes.</strong> We do not store any of
                your information (nor do we want to). All your data is tied to
                your handle and
                <strong>you control where it's stored</strong>
              </li>
              <li style="margin-bottom: 8px;">
                <strong>Share your Rabbithole info with other apps.</strong> For
                e.g. share your rabbitholes as curated collections on the
                <a href="https://semble.so">Semble network</a>.
              </li>
              <li>
                <strong>Control your data.</strong> Your collections are stored in
                your personal data repository, not locked in a walled garden.
              </li>
            </ul>
            <p style="margin-top: 20px;">
              <a
                href="https://overreacted.io/open-social/"
                target="_blank"
                rel="noopener noreferrer"
                >Learn more about the open social web</a
              >
            </p>
            <p>👀 Coming soon:</p>
            <ul style="padding-left: 20px;">
              <li>
                Create a <a
                  href="https://sidetrail.app"
                  target="_blank"
                  rel="noopener noreferrer">Sidetrail</a
                >
              </li>
              <li>
                Add annotations with <a
                  href="https://seams.so/"
                  target="_blank"
                  rel="noopener noreferrer">Seams</a
                >
              </li>
            </ul>
          </div>
        </CollapsibleContainer>
      </div>
    {/if}
  {/if}

  {#if error}
    <p class="error-message">{error}</p>
  {/if}
</div>

<style>
  a {
    color: #1185fe;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  .auth-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
  }

  .auth-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
  }

  .syncing-text {
    font-size: 14px;
    color: #666;
  }

  .bluesky-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: #495057;
    align-self: flex-start;
    margin-bottom: 4px;
  }

  .handle-input-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 400px;
    align-items: center;
  }

  .input-wrapper {
    position: relative;
    width: 100%;
  }

  .suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    list-style: none;
    margin: 0;
    padding: 4px 0;
    z-index: 100;
    overflow: hidden;
  }

  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background-color 0.1s;
  }

  .suggestion-item:hover,
  .suggestion-item.active {
    background-color: #f1f3f5;
  }

  .suggestion-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .suggestion-avatar-placeholder {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #dee2e6;
    flex-shrink: 0;
  }

  .suggestion-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .suggestion-display {
    font-size: 13px;
    font-weight: 500;
    color: #1a1b1e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .suggestion-handle {
    font-size: 12px;
    color: #868e96;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .handle-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    background: white;
    color: #333;
  }

  .handle-input:focus {
    border-color: #1185fe;
  }

  .handle-input::placeholder {
    color: #999;
  }

  .auth-button {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.2s,
      opacity 0.2s;
  }

  .auth-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-button.login,
  .auth-button.logout {
    background-color: #1185fe;
    color: white;
  }

  .auth-button.login {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 120px;
  }

  .auth-button.login:hover:not(:disabled),
  .auth-button.logout:hover {
    background-color: #0070e0;
  }

  .why-bluesky-wrapper {
    margin-top: 24px;
    width: 100%;
    max-width: 500px;
  }

  .why-bluesky-content {
    font-size: 14px;
    line-height: 1.6;
    color: #495057;
  }

  .why-bluesky-content p {
    margin: 0 0 12px 0;
  }

  .error-message {
    color: #dc3545;
    font-size: 13px;
    margin: 0;
  }

  /* Dark mode */
  :global(body.dark-mode) .user-handle {
    color: #a0a0a0;
  }

  :global(body.dark-mode) .user-avatar {
    border-color: #3a3b3c;
  }

  :global(body.dark-mode) .bluesky-info {
    color: #c1c2c5;
  }

  :global(body.dark-mode) .handle-input {
    background: #2c2e33;
    border-color: #3a3b3c;
    color: #e4e6eb;
  }

  :global(body.dark-mode) .handle-input:focus {
    border-color: #1185fe;
  }

  :global(body.dark-mode) .handle-input::placeholder {
    color: #666;
  }

  :global(body.dark-mode) .suggestions {
    background: #2c2e33;
    border-color: #3a3b3c;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  :global(body.dark-mode) .suggestion-item:hover,
  :global(body.dark-mode) .suggestion-item.active {
    background-color: #373a40;
  }

  :global(body.dark-mode) .suggestion-display {
    color: #e4e6eb;
  }

  :global(body.dark-mode) .suggestion-handle {
    color: #868e96;
  }

  :global(body.dark-mode) .suggestion-avatar-placeholder {
    background: #3a3b3c;
  }

  :global(body.dark-mode) .why-bluesky-content {
    color: #c1c2c5;
  }
</style>
