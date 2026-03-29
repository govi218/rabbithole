<script lang="ts">
  import { onMount, tick } from "svelte";
  import Modal from "./Modal.svelte";
  import Timeline from "src/lib/Timeline.svelte";
  import Navbar from "src/lib/Navbar.svelte";
  import Explore from "@rabbithole/shared/lib/Explore.svelte";
  import RabbitholeGrid from "src/lib/RabbitholeGrid.svelte";
  import Onboarding from "src/lib/Onboarding.svelte";
  import { MessageRequest } from "../utils";
  import { SvelteUIProvider, Loader, Text, AppShell } from "@svelteuidev/core";
  import type {
    Burrow,
    Rabbithole,
    Settings,
    Trail,
    TrailWalk,
    TrailWalkState,
    Website,
  } from "src/utils/types";

  let activeBurrow: Burrow | null = null;
  let activeTrail: Trail | null = null;
  let websites: Website[] = [];
  let burrowsInActiveRabbithole: Burrow[] = [];
  let trailsInActiveRabbithole: Trail[] = [];
  let rabbitholes: Rabbithole[] = [];
  let activeRabbithole: Rabbithole | null = null;

  let isDark: boolean = true;
  let opened: boolean = true;

  let isLoadingWebsites: boolean = false;
  let isLoadingHome: boolean = true;

  let autoFocusTimelineTitle: boolean = false;

  let settings: Settings | null = null;
  let showOnboarding: boolean = false;
  let showExplore: boolean = false;

  let importNotice: {
    trails: { count: number; names: string[] };
    burrows: { count: number; names: string[] };
  } | null = null;

  interface ActiveTrailWalkIndicator {
    trail: Trail;
    walk: TrailWalk;
  }
  let activeTrailWalk: ActiveTrailWalkIndicator | null = null;

  let trailsExpanded: boolean = false;
  let burrowsExpanded: boolean = false;

  // Apply theme immediately from localStorage to prevent flash
  const cachedDarkMode = localStorage.getItem("rabbithole-dark-mode");
  if (cachedDarkMode !== null) {
    isDark = cachedDarkMode === "true";
    document.body.classList.toggle("dark-mode", isDark);
  }

  onMount(async () => {
    settings = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_SETTINGS,
    });

    if (!settings.hasSeenOnboarding) {
      showOnboarding = true;
    }

    const actualDarkMode = settings?.darkMode ?? false;
    if (actualDarkMode !== isDark) {
      isDark = actualDarkMode;
      document.body.classList.toggle("dark-mode", isDark);
      localStorage.setItem("rabbithole-dark-mode", String(isDark));
    }

    await refreshHomeState();
    if (activeRabbithole) {
      updateWebsites();
    }
    isLoadingHome = false;
  });

  async function refreshTrailWalkIndicator(): Promise<void> {
    try {
      const trail: Trail | null = await chrome.runtime.sendMessage({
        type: MessageRequest.GET_ACTIVE_TRAIL,
      });
      if (trail) {
        const res: TrailWalkState = await chrome.runtime.sendMessage({
          type: MessageRequest.GET_TRAIL_WALK_STATE,
          trailId: trail.id,
        });
        if (res?.walk && !res.walk.completed) {
          activeTrailWalk = { trail: res.trail, walk: res.walk };
          return;
        }
      }
    } catch {}
    activeTrailWalk = null;
  }

  async function focusTrailTab(): Promise<void> {
    if (!activeTrailWalk) return;

    // Get current stop based on progress
    const visitedCount = activeTrailWalk.walk?.visitedStops?.length ?? 0;
    const currentStop = activeTrailWalk.trail?.stops?.[visitedCount];

    // Determine URL to open
    let targetUrl: string | null = null;
    if (currentStop?.websiteUrl) {
      targetUrl = currentStop.websiteUrl;
    } else {
      // Concept stop or no URL - open trail page
      const trailId = activeTrailWalk.trail?.id;
      if (trailId) {
        targetUrl = chrome.runtime.getURL(
          `src/trail/trail.html?trailId=${trailId}&concept=1`,
        );
      }
    }

    await chrome.runtime.sendMessage({
      type: MessageRequest.FOCUS_TRAIL_TAB,
      url: targetUrl,
    });
  }

  async function abandonTrailWalk(): Promise<void> {
    if (!activeTrailWalk) return;
    await chrome.runtime.sendMessage({
      type: MessageRequest.ABANDON_TRAIL_WALK,
      trailId: activeTrailWalk.trail?.id,
    });
    activeTrailWalk = null;
  }

  async function handleOnboardingComplete(): Promise<void> {
    showOnboarding = false;

    const currentSettings: Settings = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_SETTINGS,
    });

    isDark = currentSettings.darkMode;

    await chrome.runtime.sendMessage({
      type: MessageRequest.UPDATE_SETTINGS,
      settings: { ...currentSettings, hasSeenOnboarding: true },
    });

    // Ensure we go to the home overview after onboarding/import
    await chrome.runtime.sendMessage({
      type: MessageRequest.CHANGE_ACTIVE_RABBITHOLE,
      rabbitholeId: null,
    });

    await refreshHomeState();
  }

  async function toggleTheme(): Promise<void> {
    isDark = !isDark;
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem("rabbithole-dark-mode", String(isDark));

    await chrome.runtime.sendMessage({
      type: MessageRequest.UPDATE_SETTINGS,
      settings: { ...settings, darkMode: isDark },
    });
  }

  async function refreshHomeState(): Promise<void> {
    [activeRabbithole, rabbitholes, activeBurrow, activeTrail] =
      await Promise.all([
        chrome.runtime.sendMessage({
          type: MessageRequest.GET_ACTIVE_RABBITHOLE,
        }),
        chrome.runtime.sendMessage({
          type: MessageRequest.GET_ALL_RABBITHOLES,
        }),
        chrome.runtime.sendMessage({
          type: MessageRequest.GET_ACTIVE_BURROW,
        }),
        chrome.runtime.sendMessage({
          type: MessageRequest.GET_ACTIVE_TRAIL,
        }),
      ]);
    burrowsInActiveRabbithole = await Promise.all(
      activeRabbithole?.burrows?.map((burrowId: string) =>
        chrome.runtime.sendMessage({
          type: MessageRequest.GET_BURROW,
          burrowId,
        }),
      ) ?? [],
    );
    burrowsInActiveRabbithole = burrowsInActiveRabbithole.filter(Boolean);

    trailsInActiveRabbithole = await Promise.all(
      activeRabbithole?.trails?.map((trailId: string) =>
        chrome.runtime.sendMessage({
          type: MessageRequest.GET_TRAIL,
          trailId,
        }),
      ) ?? [],
    );
    trailsInActiveRabbithole = trailsInActiveRabbithole.filter(Boolean);

    updateWebsites();
    await refreshTrailWalkIndicator();
  }

  function handleAuthStateChange(
    event: CustomEvent<{
      type: "login" | "logout";
      imported?: {
        trails: { count: number; names: string[] };
        burrows: { count: number; names: string[] };
      };
    }>,
  ): void {
    const { type, imported } = event.detail;

    if (type === "login") {
      refreshHomeState();
      if (
        imported &&
        (imported.trails?.count > 0 || imported.burrows?.count > 0)
      ) {
        importNotice = imported;
      }
    } else if (type === "logout") {
      refreshHomeState();
    }
  }

  async function updateWebsites(): Promise<void> {
    isLoadingWebsites = true;
    try {
      if (activeBurrow?.id) {
        websites = await chrome.runtime.sendMessage({
          type: MessageRequest.GET_BURROW_WEBSITES,
          burrowId: activeBurrow.id,
        });
      } else if (activeRabbithole?.id) {
        websites = await chrome.runtime.sendMessage({
          type: MessageRequest.GET_RABBITHOLE_WEBSITES,
          rabbitholeId: activeRabbithole.id,
        });
      } else {
        websites = [];
      }
    } finally {
      isLoadingWebsites = false;
    }
  }

  function goExplore(): void {
    showExplore = true;
  }

  async function goHome(): Promise<void> {
    showExplore = false;
    await chrome.runtime.sendMessage({
      type: MessageRequest.CHANGE_ACTIVE_RABBITHOLE,
      rabbitholeId: null,
    });
    await refreshHomeState();
  }

  async function selectRabbithole(rabbitholeId: string): Promise<void> {
    isLoadingWebsites = true;
    await chrome.runtime.sendMessage({
      type: MessageRequest.CHANGE_ACTIVE_RABBITHOLE,
      rabbitholeId,
    });
    await refreshHomeState();
  }

  async function selectBurrow(burrowId: string): Promise<void> {
    isLoadingWebsites = true;
    await chrome.runtime.sendMessage({
      type: MessageRequest.CHANGE_ACTIVE_BURROW,
      burrowId,
    });
    await refreshHomeState();
  }

  async function selectTrail(trailId: string): Promise<void> {
    isLoadingWebsites = true;
    await chrome.runtime.sendMessage({
      type: MessageRequest.CHANGE_ACTIVE_TRAIL,
      trailId,
    });
    await refreshHomeState();
  }

  async function handleCreateRabbithole(): Promise<void> {
    let baseName = "New Rabbithole";
    let newName = baseName;
    let counter = 1;
    while (rabbitholes.some((b) => b.title === newName)) {
      counter++;
      newName = `${baseName} ${counter}`;
    }

    await chrome.runtime.sendMessage({
      type: MessageRequest.CREATE_NEW_RABBITHOLE,
      title: newName,
    });

    await refreshHomeState();

    // Focus the input after render
    await tick();
    const input = document.querySelector<HTMLInputElement>(
      ".rabbithole-title-input",
    );
    if (input) {
      input.focus();
      input.select();
    }
  }

  async function deleteRabbithole(rabbitholeId: string): Promise<void> {
    // FIXME: use modal
    if (confirm("Are you sure you want to delete this rabbithole?")) {
      await chrome.runtime.sendMessage({
        type: MessageRequest.DELETE_RABBITHOLE,
        rabbitholeId,
      });
      await refreshHomeState();
    }
  }

  async function deleteBurrow(burrowId: string): Promise<void> {
    // FIXME: use modal
    if (confirm("Are you sure you want to delete this burrow?")) {
      await chrome.runtime.sendMessage({
        type: MessageRequest.DELETE_BURROW,
        burrowId,
        rabbitholeId: activeRabbithole.id,
      });
      activeBurrow = null;
      burrowsInActiveRabbithole = burrowsInActiveRabbithole.filter(
        (b) => b.id !== burrowId,
      );
      await refreshHomeState();
    }
  }

  async function deleteTrail(trailId: string): Promise<void> {
    if (confirm("Are you sure you want to delete this trail?")) {
      await chrome.runtime.sendMessage({
        type: MessageRequest.DELETE_TRAIL,
        trailId,
        rabbitholeId: activeRabbithole.id,
      });
      await refreshHomeState();
    }
  }

  async function renameContainer(event: CustomEvent): Promise<void> {
    const { type, id, name } = event.detail;

    if (type === "burrow") {
      await chrome.runtime.sendMessage({
        type: MessageRequest.RENAME_BURROW,
        newName: name,
        burrowId: id,
      });
    } else if (type === "trail") {
      await chrome.runtime.sendMessage({
        type: MessageRequest.UPDATE_TRAIL,
        trailId: id,
        updates: { name },
      });
    } else if (type === "rabbithole") {
      await chrome.runtime.sendMessage({
        type: MessageRequest.UPDATE_RABBITHOLE,
        rabbitholeId: id,
        title: name,
      });
    }

    await refreshHomeState();
  }

  async function deleteWebsite(event: CustomEvent): Promise<void> {
    if (activeBurrow) {
      await chrome.runtime.sendMessage({
        type: MessageRequest.DELETE_WEBSITE,
        burrowId: activeBurrow.id,
        url: event.detail.url,
      });
    } else if (activeRabbithole) {
      await chrome.runtime.sendMessage({
        type: MessageRequest.DELETE_WEBSITE_FROM_RABBITHOLE_META,
        rabbitholeId: activeRabbithole.id,
        url: event.detail.url,
      });
    }
    updateWebsites();
  }

  async function handleDelete(): Promise<void> {
    if (activeBurrow) {
      await deleteBurrow(activeBurrow.id);
    } else if (activeTrail) {
      await deleteTrail(activeTrail.id);
    } else if (activeRabbithole) {
      await deleteRabbithole(activeRabbithole.id);
    }
    await refreshHomeState();
  }

  async function handleSearchSelectBurrow(
    event: CustomEvent<Burrow>,
  ): Promise<void> {
    await selectBurrow(event.detail.id);
  }

  async function handleSearchSelectTrail(
    event: CustomEvent<Burrow>,
  ): Promise<void> {
    await selectTrail(event.detail.id);
  }

  async function handleNavigation(): Promise<void> {
    await refreshHomeState();
  }
</script>

{#if showOnboarding}
  <Onboarding on:complete={handleOnboardingComplete} />
{:else}
  <SvelteUIProvider>
    <Navbar
      onRabbitholesClick={goHome}
      onExploreClick={goExplore}
      {isDark}
      on:toggleTheme={toggleTheme}
      on:selectRabbithole={(event) => selectRabbithole(event.detail)}
      on:selectBurrow={handleSearchSelectBurrow}
      on:selectTrail={handleSearchSelectTrail}
      on:navigate={handleNavigation}
      on:authStateChange={handleAuthStateChange}
    />

    <AppShell class={!opened ? "sidebar-closed-shell" : ""}>
      <div class="main-content" class:sidebar-closed={!opened}>
        <div class="timeline-wrapper">
          {#if showExplore}
            <Explore
              onWalkTrail={async (actorTrail) => {
                const result = await chrome.runtime.sendMessage({
                  type: MessageRequest.IMPORT_TRAIL_FROM_EXPLORE,
                  trail: actorTrail,
                });
                if (result?.trailId) {
                  if (result.firstStopUrl) {
                    window.location.href = result.firstStopUrl;
                  } else {
                    window.location.href = chrome.runtime.getURL(
                      `src/trail/trail.html?trailId=${result.trailId}&concept=1`,
                    );
                  }
                  await refreshHomeState();
                }
              }}
            />
          {:else if isLoadingHome}
            <div class="home-loading">
              <Loader size="md" variant="dots" />
              <Text size="sm" color="dimmed" style="margin-top: 1rem;">
                Loading...
              </Text>
            </div>
          {:else}
            {#if activeTrailWalk}
              <button class="trail-walk-banner" on:click={focusTrailTab}>
                <span class="trail-walk-icon">🐾</span>
                <span class="trail-walk-text">
                  Trail in progress: <strong
                    >{activeTrailWalk.trail?.name}</strong
                  >
                  — stop {(activeTrailWalk.walk?.visitedStops?.length ?? 0) + 1}
                  of {activeTrailWalk.trail?.stops?.length ?? 0}
                </span>
                <span
                  class="trail-walk-cta"
                  on:click|stopPropagation={abandonTrailWalk}>Abandon</span
                >
                <span class="trail-walk-cta">Continue</span>
              </button>
            {/if}

            <div class="home-header" role="button" tabindex="0">
              {#if !activeRabbithole}
                <h1 class="home-title">{"Rabbitholes"}</h1>
              {/if}
            </div>

            {#if activeRabbithole}
              <Timeline
                {activeBurrow}
                {activeTrail}
                {activeRabbithole}
                {websites}
                {selectBurrow}
                {selectTrail}
                {burrowsInActiveRabbithole}
                {trailsInActiveRabbithole}
                isLoading={isLoadingWebsites}
                autoFocusTitle={autoFocusTimelineTitle}
                on:websiteDelete={deleteWebsite}
                on:containerRename={renameContainer}
                on:deleteContainer={handleDelete}
                on:refresh={updateWebsites}
                on:navigateUp={handleNavigation}
              />
            {:else}
              <div class="timeline-placeholder timeline-placeholder-grid">
                <RabbitholeGrid
                  {rabbitholes}
                  onSelect={selectRabbithole}
                  allowCreate={true}
                  on:createRabbithole={handleCreateRabbithole}
                  showDelete={true}
                  on:deleteRabbithole={(event) =>
                    deleteRabbithole(event.detail.rabbitholeId)}
                />
              </div>
            {/if}
          {/if}
        </div>
      </div>
    </AppShell>
  </SvelteUIProvider>
{/if}

<Modal
  isOpen={importNotice !== null}
  title="Welcome back!"
  on:close={() => (importNotice = null)}
>
  <div class="import-modal-content">
    <p style="margin-bottom: 16px;">Imported from your Bluesky account:</p>
    {#if importNotice?.trails?.count > 0}
      <div class="import-section">
        <div
          class="import-header"
          on:click={() => (trailsExpanded = !trailsExpanded)}
        >
          <span class="import-arrow">{trailsExpanded ? "▼" : "▶"}</span>
          <span
            >{importNotice.trails.count} trail{importNotice.trails.count !== 1
              ? "s"
              : ""}</span
          >
        </div>
        {#if trailsExpanded}
          <ul class="import-list">
            {#each importNotice.trails.names as name}
              <li>{name}</li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
    {#if importNotice?.burrows?.count > 0}
      <div class="import-section">
        <div
          class="import-header"
          on:click={() => (burrowsExpanded = !burrowsExpanded)}
        >
          <span class="import-arrow">{burrowsExpanded ? "▼" : "▶"}</span>
          <span
            >{importNotice.burrows.count} burrow{importNotice.burrows.count !==
            1
              ? "s"
              : ""}</span
          >
        </div>
        {#if burrowsExpanded}
          <ul class="import-list">
            {#each importNotice.burrows.names as name}
              <li>{name}</li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>
</Modal>

<style>
  .import-section {
    margin-bottom: 12px;
  }
  .import-header {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
  }
  .import-arrow {
    font-size: 10px;
  }
  .import-list {
    margin: 4px 0 0 24px;
    padding-left: 0;
  }
  .import-list li {
    margin-bottom: 4px;
  }
  :global(body) {
    background-color: #f8f9fa;
    margin: 0;
  }

  :global(body.dark-mode) {
    background-color: #141517;
  }

  :global(.mantine-AppShell-main) {
    background-color: #f8f9fa;
    padding: 0 !important;
  }

  :global(body.dark-mode .mantine-AppShell-main) {
    background-color: #141517;
  }

  .main-content {
    display: flex;
    width: 100%;
    min-height: 100vh;
    background-color: #f8f9fa;
    transition: background-color 0.3s ease;
    padding-top: 58px;
  }

  :global(body.dark-mode) .main-content {
    background-color: #141517;
  }

  .timeline-wrapper {
    flex: 1;
    width: 100%;
    padding: 32px 16px;
    max-width: 880px;
    margin: 0 auto;
  }

  .main-content.sidebar-closed {
    justify-content: center;
  }

  :global(.sidebar-closed-shell .mantine-AppShell-main) {
    padding-left: 0 !important;
  }

  :global(.hamburger-only .sidebar-wrapper) {
    background: transparent !important;
    width: auto !important;
    padding: 20px !important;
  }

  .trail-walk-banner {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(
      135deg,
      rgba(17, 133, 254, 0.1),
      rgba(17, 133, 254, 0.05)
    );
    border: 1px solid rgba(17, 133, 254, 0.25);
    border-radius: 10px;
    padding: 10px 16px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    font-family: inherit;
    margin-bottom: 16px;
  }

  .trail-walk-banner:hover {
    background: linear-gradient(
      135deg,
      rgba(17, 133, 254, 0.18),
      rgba(17, 133, 254, 0.1)
    );
    border-color: rgba(17, 133, 254, 0.45);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(17, 133, 254, 0.15);
  }

  .trail-walk-cta {
    color: #ef4444;
    font-weight: 600;
    margin-left: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(17, 133, 254, 0.25);
  }

  .trail-walk-cta:hover {
    background: rgba(17, 133, 254, 0.15);
  }

  .trail-walk-icon {
    font-size: 18px;
    flex-shrink: 0;
  }

  .trail-walk-text {
    flex: 1;
    font-size: 13px;
    color: #495057;
  }

  .trail-walk-text strong {
    color: #1185fe;
  }

  .trail-walk-cta {
    font-size: 12px;
    font-weight: 700;
    color: #1185fe;
    flex-shrink: 0;
    white-space: nowrap;
  }

  :global(body.dark-mode) .trail-walk-banner {
    background: linear-gradient(
      135deg,
      rgba(77, 171, 247, 0.1),
      rgba(77, 171, 247, 0.05)
    );
    border-color: rgba(77, 171, 247, 0.25);
  }

  :global(body.dark-mode) .trail-walk-banner:hover {
    background: linear-gradient(
      135deg,
      rgba(77, 171, 247, 0.18),
      rgba(77, 171, 247, 0.1)
    );
    border-color: rgba(77, 171, 247, 0.45);
    box-shadow: 0 4px 12px rgba(77, 171, 247, 0.15);
  }

  :global(body.dark-mode) .trail-walk-text {
    color: #c1c2c5;
  }

  :global(body.dark-mode) .trail-walk-text strong {
    color: #4dabf7;
  }

  :global(body.dark-mode) .trail-walk-cta {
    color: #4dabf7;
  }

  .home-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 20px;
    cursor: pointer;
    user-select: none;
  }

  .home-header:hover .home-title {
    text-decoration: underline;
  }

  .home-title {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 800;
    color: #1a1b1e;
    text-align: center;
  }

  :global(body.dark-mode) .home-title {
    color: #e7e7e7;
  }

  .timeline-placeholder {
    margin-top: 22px;
    min-height: 336px;
    border-radius: 12px;
    border: 2px dashed rgba(0, 0, 0, 0.12);
    background: rgba(0, 0, 0, 0.02);
  }

  .timeline-placeholder-grid {
    padding: 14px;
    border-style: solid;
    border-width: 1px;
    border-color: rgba(0, 0, 0, 0.08);
    background: rgba(255, 255, 255, 0.6);
  }

  :global(body.dark-mode) .timeline-placeholder {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.03);
  }

  :global(body.dark-mode) .timeline-placeholder-grid {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(26, 27, 30, 0.6);
  }

  .home-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
  }

  :global(body.dark-mode .mantine-AppShell-root) {
    background-color: #141517;
  }

  :global(body.dark-mode .mantine-AppShell-main) {
    color: #c1c2c5;
  }

  :global(body.dark-mode .mantine-Text-root) {
    color: #c1c2c5;
  }

  :global(body.dark-mode .mantine-TextInput-input),
  :global(body.dark-mode .mantine-Input-input),
  :global(body.dark-mode .mantine-Select-input),
  :global(body.dark-mode .mantine-NativeSelect-select) {
    background-color: #25262b;
    color: #c1c2c5;
    border-color: #373a40;
  }

  :global(body.dark-mode .mantine-Navbar-root) {
    background-color: #1a1b1e !important;
    border-right: 1px solid #2c2e33 !important;
  }

  :global(body.dark-mode .mantine-Navbar-root[aria-hidden="true"]) {
    background-color: transparent !important;
  }

  :global(body.dark-mode .mantine-Divider-root) {
    border-color: #373a40;
  }

  :global(body.dark-mode #project-name) {
    color: #ffffff !important;
  }

  :global(body.dark-mode .active-rabbithole) {
    color: #ffffff !important;
    font-weight: bold;
  }

  :global(body.dark-mode .hamburger-btn) {
    color: #e7e7e7 !important;
  }

  :global(body.dark-mode .hamburger-btn:hover) {
    background-color: #25262b;
  }
</style>
