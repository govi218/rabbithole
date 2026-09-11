<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Button } from "@svelteuidev/core";
  import { ArrowRight } from "svelte-radix";
  import Modal from "src/lib/Modal.svelte";
  import { MessageRequest } from "../utils/types";
  import type { CloudProviderConfig, CloudProviderId } from "../llm/cloud";
  import { CloudProviders } from "../llm/cloud";
  import type { Rabbithole } from "../utils/types";
  import type { TabInfo } from "../llm/skills/categorise";

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher();

  const providerEntries = Object.entries(CloudProviders) as [
    CloudProviderId,
    (typeof CloudProviders)[CloudProviderId],
  ][];

  interface CategoriseGroup {
    id: string;
    title: string;
    description: string;
    isNew: boolean;
    tabIndices: number[];
  }

  let loading: boolean = false;
  let error: string | null = null;
  let hasRun: boolean = false;
  let needsSetup: boolean = false;
  let setupProvider: string = "";
  let setupApiKey: string = "";
  let setupModel: string = "";
  let tabs: TabInfo[] = [];
  let groups: CategoriseGroup[] = [];
  let miscIndices: number[] = [];
  let allRabbitholes: Rabbithole[] = [];
  let applying: boolean = false;
  let showSuccess: boolean = false;
  let savedTabCount: number = 0;

  let newRabbitholeDefs: Map<string, { title: string; description: string }> =
    new Map();

  let movingTabIdx: number | null = null;
  let searchQuery: string = "";
  let searchInput: HTMLInputElement;

  async function loadCloudConfig(): Promise<CloudProviderConfig | undefined> {
    const saved = await chrome.storage.local.get([
      "cloudProvider",
      "cloudApiKey",
      "cloudModel",
    ]);
    if (saved.cloudProvider && saved.cloudApiKey) {
      return {
        apiKey: saved.cloudApiKey,
        providerId: saved.cloudProvider as CloudProviderId,
        model: saved.cloudModel || undefined,
      };
    }
    return undefined;
  }

  async function checkSetup(): Promise<void> {
    const config = await loadCloudConfig();
    if (!config) {
      needsSetup = true;
      const saved = await chrome.storage.local.get([
        "cloudProvider",
        "cloudModel",
      ]);
      setupProvider = saved.cloudProvider ?? "";
      setupModel = saved.cloudModel ?? "";
    } else {
      needsSetup = false;
      runCategorise();
    }
  }

  async function saveSetup(): Promise<void> {
    await chrome.storage.local.set({
      cloudProvider: setupProvider,
      cloudApiKey: setupApiKey,
      cloudModel: setupModel,
    });
    needsSetup = false;
    runCategorise();
  }

  function modelPlaceholder(): string {
    if (!setupProvider) return "Model (optional override)";
    const p = CloudProviders[setupProvider as CloudProviderId];
    return p ? `Model (default: ${p.model})` : "Model (optional override)";
  }

  function getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  async function runCategorise(): Promise<void> {
    loading = true;
    error = null;
    hasRun = true;
    groups = [];
    miscIndices = [];
    movingTabIdx = null;

    try {
      const cloudConfig = await loadCloudConfig();
      const result = await chrome.runtime.sendMessage({
        type: MessageRequest.RUN_CATEGORISE,
        cloudConfig,
      });

      if (result?.error) {
        const errStr = String(result.error);
        if (
          errStr.includes("invalid_api_key") ||
          errStr.includes("401") ||
          errStr.includes("Incorrect API key")
        ) {
          needsSetup = true;
          hasRun = false;
          const saved = await chrome.storage.local.get([
            "cloudProvider",
            "cloudModel",
          ]);
          setupProvider = saved.cloudProvider ?? "";
          setupModel = saved.cloudModel ?? "";
          setupApiKey = "";
        } else {
          error = result.error;
        }
        return;
      }

      tabs = result.tabs ?? [];
      const assignments = result.assignments ?? [];
      const newRabbitholes = result.newRabbitholes ?? [];
      miscIndices = result.misc ?? [];

      allRabbitholes = await chrome.runtime.sendMessage({
        type: MessageRequest.GET_ALL_RABBITHOLES,
      });

      groups = [];

      const merged = new Map<
        string,
        { rabbitholeId: string; rabbitholeTitle: string; tabIndices: number[] }
      >();
      for (const a of assignments) {
        const existing = merged.get(a.rabbitholeId);
        if (existing) {
          existing.tabIndices.push(...a.tabIndices);
        } else {
          merged.set(a.rabbitholeId, {
            rabbitholeId: a.rabbitholeId,
            rabbitholeTitle: a.rabbitholeTitle,
            tabIndices: [...a.tabIndices],
          });
        }
      }

      for (const a of merged.values()) {
        const rh = allRabbitholes.find((r) => r.id === a.rabbitholeId);
        const isNew = !rh;
        groups.push({
          id: a.rabbitholeId,
          title: a.rabbitholeTitle || rh?.title || a.rabbitholeId,
          description: rh?.description ?? "",
          isNew,
          tabIndices: a.tabIndices,
        });
        if (isNew) {
          newRabbitholeDefs.set(a.rabbitholeId, {
            title: a.rabbitholeTitle || a.rabbitholeId,
            description: "",
          });
        }
      }

      newRabbitholeDefs = new Map();
      for (const nr of newRabbitholes) {
        const id = `new-${nr.topic}`;
        newRabbitholeDefs.set(id, {
          title: nr.topic,
          description: nr.description,
        });
        groups.push({
          id,
          title: nr.topic,
          description: nr.description,
          isNew: true,
          tabIndices: [...nr.tabIndices],
        });
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to categorise tabs";
    } finally {
      loading = false;
    }
  }

  function startMove(tabIdx: number): void {
    if (movingTabIdx === tabIdx) {
      movingTabIdx = null;
      searchQuery = "";
      return;
    }
    movingTabIdx = tabIdx;
    searchQuery = "";
    setTimeout(() => searchInput?.focus(), 0);
  }

  function getMoveTargets(): { id: string; title: string; isNew: boolean }[] {
    const targets: { id: string; title: string; isNew: boolean }[] = [];

    for (const rh of allRabbitholes) {
      targets.push({ id: rh.id, title: rh.title, isNew: false });
    }

    for (const g of groups) {
      if (g.isNew && !targets.find((t) => t.id === g.id)) {
        targets.push({ id: g.id, title: g.title, isNew: true });
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return targets.filter((t) => t.title.toLowerCase().includes(q));
    }

    return targets;
  }

  function moveTab(tabIdx: number, targetId: string): void {
    for (const g of groups) {
      g.tabIndices = g.tabIndices.filter((i) => i !== tabIdx);
    }
    miscIndices = miscIndices.filter((i) => i !== tabIdx);

    let target = groups.find((g) => g.id === targetId);
    if (!target) {
      const rh = allRabbitholes.find((r) => r.id === targetId);
      if (rh) {
        target = {
          id: rh.id,
          title: rh.title,
          description: rh.description ?? "",
          isNew: false,
          tabIndices: [],
        };
        groups.push(target);
      } else {
        const nrDef = newRabbitholeDefs.get(targetId);
        if (nrDef) {
          target = {
            id: targetId,
            title: nrDef.title,
            description: nrDef.description,
            isNew: true,
            tabIndices: [],
          };
          groups.push(target);
        }
      }
    }

    if (target) {
      target.tabIndices.push(tabIdx);
    }

    movingTabIdx = null;
    searchQuery = "";
    groups = groups.filter((g) => g.tabIndices.length > 0);
    miscIndices = miscIndices;
  }

  function moveToMisc(tabIdx: number): void {
    for (const g of groups) {
      g.tabIndices = g.tabIndices.filter((i) => i !== tabIdx);
    }
    if (!miscIndices.includes(tabIdx)) {
      miscIndices.push(tabIdx);
    }
    movingTabIdx = null;
    searchQuery = "";
    groups = groups.filter((g) => g.tabIndices.length > 0);
    miscIndices = miscIndices;
  }

  async function applyChanges(): Promise<void> {
    applying = true;
    try {
      const assignments = groups
        .filter((g) => !g.isNew && g.tabIndices.length > 0)
        .map((g) => ({
          rabbitholeId: g.id,
          tabIndices: g.tabIndices,
        }));

      const newRabbitholes = groups
        .filter((g) => g.isNew && g.tabIndices.length > 0)
        .map((g) => ({
          topic: g.title,
          description: g.description,
          tabIndices: g.tabIndices,
        }));

      await chrome.runtime.sendMessage({
        type: MessageRequest.APPLY_CATEGORISE,
        assignments,
        newRabbitholes,
        tabs,
      });

      savedTabCount = groups
        .filter((g) => g.tabIndices.length > 0)
        .reduce((sum, g) => sum + g.tabIndices.length, 0);
      showSuccess = true;
      dispatch("applied");
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to apply changes";
    } finally {
      applying = false;
    }
  }

  function closeSavedTabs(): void {
    const savedTabIds = groups
      .filter((g) => g.tabIndices.length > 0)
      .flatMap((g) => g.tabIndices)
      .map((i) => tabs[i]?.tabId)
      .filter((id): id is number => id != null);
    if (savedTabIds.length > 0) {
      chrome.tabs.remove(savedTabIds);
    }
    showSuccess = false;
    isOpen = false;
    hasRun = false;
    groups = [];
    miscIndices = [];
  }

  function keepTabsOpen(): void {
    showSuccess = false;
    isOpen = false;
    hasRun = false;
    groups = [];
    miscIndices = [];
  }

  function handleClose(): void {
    if (loading || applying) return;
    isOpen = false;
    error = null;
    hasRun = false;
    needsSetup = false;
    showSuccess = false;
    groups = [];
    miscIndices = [];
    movingTabIdx = null;
    dispatch("close");
  }

  $: if (isOpen && !hasRun && !loading) {
    checkSetup();
  }
</script>

<Modal {isOpen} title="Clean Up My Tabs" on:close={handleClose}>
  {#if showSuccess}
    <div class="success">
      <p class="success-text">
        You closed {savedTabCount}
        {savedTabCount === 1 ? "tab" : "tabs"} but lost none of the content you care
        about!
      </p>
      <div class="success-actions">
        <Button variant="light" color="blue" on:click={closeSavedTabs}>
          Close saved tabs
        </Button>
        <Button variant="subtle" color="gray" on:click={keepTabsOpen}>
          Keep tabs open
        </Button>
      </div>
    </div>
  {:else if needsSetup}
    <div class="setup">
      <p class="setup-desc">
        Connect an AI provider to categorise your tabs. Your key is stored
        locally and never sent anywhere except the provider's API.
      </p>
      <select bind:value={setupProvider} class="setup-input">
        <option value="">Select a provider...</option>
        {#each providerEntries as [id, p]}
          <option value={id}>{p.label}</option>
        {/each}
      </select>
      <input
        type="password"
        bind:value={setupApiKey}
        placeholder="API key"
        class="setup-input"
      />
      <input
        type="text"
        bind:value={setupModel}
        placeholder={modelPlaceholder()}
        class="setup-input"
      />
      <div class="setup-actions">
        <Button
          variant="light"
          color="blue"
          on:click={saveSetup}
          disabled={!setupProvider || !setupApiKey}
        >
          Connect &amp; Categorise
        </Button>
        <Button variant="subtle" color="gray" on:click={handleClose}>
          Cancel
        </Button>
      </div>
    </div>
  {:else if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Analyzing your tabs...</p>
    </div>
  {:else if error}
    <p class="error">{error}</p>
    <div class="error-actions">
      <Button
        variant="subtle"
        color="gray"
        on:click={() => {
          error = null;
          runCategorise();
        }}
      >
        Retry
      </Button>
      <Button variant="subtle" color="gray" on:click={handleClose}
        >Cancel</Button
      >
    </div>
  {:else}
    <div class="editor">
      <p class="hint">
        Click <ArrowRight size={11} class="hint-icon" /> to move a tab to a different
        rabbithole
      </p>
      {#each groups as group (group.id)}
        <div class="group-section">
          <div class="group-header">
            <span class="group-title">{group.title}</span>
            {#if group.isNew}
              <span class="badge new-badge">new</span>
            {/if}
            <span class="group-count">{group.tabIndices.length} tabs</span>
          </div>
          {#if group.isNew && group.description}
            <p class="group-desc">{group.description}</p>
          {/if}
          <div class="tab-list">
            {#each group.tabIndices as tabIdx (tabIdx)}
              <div class="tab-row">
                <div class="tab-info">
                  <span class="tab-title"
                    >{tabs[tabIdx]?.title || "Untitled"}</span
                  >
                  <span class="tab-domain"
                    >{getDomain(tabs[tabIdx]?.url ?? "")}</span
                  >
                </div>
                <button
                  class="move-btn"
                  class:active={movingTabIdx === tabIdx}
                  on:click={() => startMove(tabIdx)}
                  title="Move to another rabbithole"
                >
                  <ArrowRight size={14} />
                </button>
                {#if movingTabIdx === tabIdx}
                  <div class="move-panel" on:click|stopPropagation>
                    <input
                      bind:this={searchInput}
                      bind:value={searchQuery}
                      placeholder="Search rabbitholes..."
                      class="search-input"
                    />
                    <div class="search-results">
                      {#each getMoveTargets() as target (target.id)}
                        <button
                          class="search-result-item"
                          on:click={() => moveTab(tabIdx, target.id)}
                        >
                          <span>{target.title}</span>
                          {#if target.isNew}
                            <span class="badge new-badge">new</span>
                          {/if}
                        </button>
                      {:else}
                        <div class="no-results">No matching rabbitholes</div>
                      {/each}
                    </div>
                    <button
                      class="move-to-misc"
                      on:click={() => moveToMisc(tabIdx)}
                    >
                      Move to Misc
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}

      {#if miscIndices.length > 0}
        <div class="group-section misc-section">
          <div class="group-header">
            <span class="group-title">Misc</span>
            <span class="misc-note">(will not be saved)</span>
            <span class="group-count">{miscIndices.length} tabs</span>
          </div>
          <div class="tab-list">
            {#each miscIndices as tabIdx (tabIdx)}
              <div class="tab-row">
                <div class="tab-info">
                  <span class="tab-title"
                    >{tabs[tabIdx]?.title || "Untitled"}</span
                  >
                  <span class="tab-domain"
                    >{getDomain(tabs[tabIdx]?.url ?? "")}</span
                  >
                </div>
                <button
                  class="move-btn"
                  class:active={movingTabIdx === tabIdx}
                  on:click={() => startMove(tabIdx)}
                  title="Move to a rabbithole"
                >
                  <ArrowRight size={14} />
                </button>
                {#if movingTabIdx === tabIdx}
                  <div class="move-panel" on:click|stopPropagation>
                    <input
                      bind:this={searchInput}
                      bind:value={searchQuery}
                      placeholder="Search rabbitholes..."
                      class="search-input"
                    />
                    <div class="search-results">
                      {#each getMoveTargets() as target (target.id)}
                        <button
                          class="search-result-item"
                          on:click={() => moveTab(tabIdx, target.id)}
                        >
                          <span>{target.title}</span>
                          {#if target.isNew}
                            <span class="badge new-badge">new</span>
                          {/if}
                        </button>
                      {:else}
                        <div class="no-results">No matching rabbitholes</div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="confirm-bar">
        <Button
          variant="light"
          color="blue"
          on:click={applyChanges}
          disabled={applying}
        >
          {applying ? "Applying..." : "Confirm Changes"}
        </Button>
      </div>
    </div>
  {/if}
</Modal>

<style>
  .success {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
    padding: 20px 0;
  }

  .success-text {
    font-size: 15px;
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }

  .success-actions {
    display: flex;
    gap: 8px;
  }

  .hint {
    font-size: 12px;
    color: #868e96;
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .hint-icon {
    display: inline-flex;
    vertical-align: middle;
  }

  .misc-note {
    font-size: 12px;
    color: #868e96;
    font-weight: normal;
  }

  .setup {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .setup-desc {
    font-size: 13px;
    color: #868e96;
    margin: 0 0 4px;
    line-height: 1.5;
  }

  .setup-input {
    padding: 8px 12px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    background: transparent;
    color: #1a1b1e;
    font-family: inherit;
  }

  .setup-input:focus {
    border-color: #1185fe;
  }

  .setup-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    gap: 16px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top-color: #1185fe;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading p {
    color: #868e96;
    font-size: 14px;
  }

  .error {
    color: #e03131;
    font-size: 14px;
    margin: 0 0 16px;
  }

  .error-actions {
    display: flex;
    gap: 8px;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .group-section {
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 10px;
    padding: 14px;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .group-title {
    font-weight: 700;
    font-size: 14px;
    color: #1a1b1e;
  }

  .group-count {
    font-size: 12px;
    color: #868e96;
    margin-left: auto;
  }

  .group-desc {
    font-size: 12px;
    color: #868e96;
    margin: 0 0 10px;
    line-height: 1.4;
  }

  .badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .new-badge {
    color: #2b8a3e;
    background: rgba(43, 138, 62, 0.12);
  }

  .tab-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tab-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.03);
    transition: background 0.15s ease;
  }

  .tab-row:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  .tab-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .tab-title {
    font-size: 13px;
    font-weight: 600;
    color: #1a1b1e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-domain {
    font-size: 11px;
    color: #868e96;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .move-btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #868e96;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .move-btn:hover {
    background: rgba(17, 133, 254, 0.1);
    color: #1185fe;
  }

  .move-btn.active {
    background: rgba(17, 133, 254, 0.15);
    color: #1185fe;
  }

  .move-panel {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 10;
    width: 240px;
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    overflow: hidden;
  }

  .search-input {
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    font-size: 13px;
    outline: none;
    background: transparent;
    color: #1a1b1e;
  }

  .search-results {
    max-height: 200px;
    overflow-y: auto;
  }

  .search-result-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
    color: #1a1b1e;
    transition: background 0.1s ease;
  }

  .search-result-item:hover {
    background: rgba(17, 133, 254, 0.08);
  }

  .no-results {
    padding: 12px;
    font-size: 13px;
    color: #868e96;
    text-align: center;
  }

  .move-to-misc {
    display: block;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
    color: #868e96;
    transition: background 0.1s ease;
  }

  .move-to-misc:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  .misc-section {
    border-style: dashed;
  }

  .confirm-bar {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
  }

  /* Dark mode */
  :global(body.dark-mode) .group-section {
    border-color: rgba(255, 255, 255, 0.08);
  }

  :global(body.dark-mode) .group-title {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .group-desc {
    color: #909296;
  }

  :global(body.dark-mode) .new-badge {
    color: #69db7c;
    background: rgba(105, 219, 124, 0.15);
  }

  :global(body.dark-mode) .tab-row {
    background: rgba(255, 255, 255, 0.04);
  }

  :global(body.dark-mode) .tab-row:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  :global(body.dark-mode) .tab-title {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .tab-domain {
    color: #909296;
  }

  :global(body.dark-mode) .move-btn {
    color: #909296;
  }

  :global(body.dark-mode) .move-btn:hover {
    background: rgba(77, 171, 247, 0.15);
    color: #4dabf7;
  }

  :global(body.dark-mode) .move-btn.active {
    background: rgba(77, 171, 247, 0.2);
    color: #4dabf7;
  }

  :global(body.dark-mode) .move-panel {
    background: #25262b;
    border-color: rgba(255, 255, 255, 0.12);
  }

  :global(body.dark-mode) .search-input {
    border-bottom-color: rgba(255, 255, 255, 0.08);
    color: #e7e7e7;
  }

  :global(body.dark-mode) .search-result-item {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .search-result-item:hover {
    background: rgba(77, 171, 247, 0.12);
  }

  :global(body.dark-mode) .no-results {
    color: #909296;
  }

  :global(body.dark-mode) .move-to-misc {
    border-top-color: rgba(255, 255, 255, 0.08);
    color: #909296;
  }

  :global(body.dark-mode) .move-to-misc:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  :global(body.dark-mode) .error {
    color: #ff6b6b;
  }

  :global(body.dark-mode) .setup-desc {
    color: #909296;
  }

  :global(body.dark-mode) .hint {
    color: #909296;
  }

  :global(body.dark-mode) .misc-note {
    color: #909296;
  }

  :global(body.dark-mode) .setup-input {
    border-color: rgba(255, 255, 255, 0.12);
    color: #e7e7e7;
  }

  :global(body.dark-mode) .setup-input:focus {
    border-color: #4dabf7;
  }
</style>
