<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { Button, ActionIcon, Menu, Tooltip } from "@svelteuidev/core";
  import { Agent } from "@atproto/api";
  import {
    MagnifyingGlass,
    Person,
    Sun,
    Moon,
    Gear,
    Exit,
    Download,
    Upload,
    QuestionMarkCircled,
    FileText,
    EyeNone,
    EyeOpen,
  } from "radix-icons-svelte";
  import SearchEverywhereModal from "src/lib/SearchEverywhereModal.svelte";
  import Modal from "src/lib/Modal.svelte";
  import logoStars from "@rabbithole/shared/assets/rabbithole-logo-stars.svg";
  import Auth from "src/lib/Auth.svelte";
  import OnboardingModal from "src/lib/OnboardingModal.svelte";
  import { getSession, clearSession } from "../atproto/client";
  import { MessageRequest, Logger } from "../utils";
  import type { Settings } from "src/utils/types";

  export let onRabbitholesClick = () => {};
  export let onBurrowsClick = () => {};
  export let onExploreClick = () => {};
  export let isDark: boolean = false;

  const dispatch = createEventDispatcher();

  let showSearchModal: boolean = false;
  let showAuthModal: boolean = false;
  let showOnboardingModal: boolean = false;
  let showHelpTooltip: boolean = false;
  let isMac = navigator.userAgent.includes("Mac");
  let isLoggedIn: boolean = false;
  let userHandle: string = "";
  let userAvatar: string = "";
  let fileInput: HTMLInputElement;

  let settings: Settings | null = null;
  let showOverlay: boolean = true;

  function dismissHelpTooltip() {
    if (showHelpTooltip) {
      showHelpTooltip = false;
      localStorage.setItem("rabbithole_has_seen_help_v2", "true");
    }
  }

  function handleWindowClick() {
    dismissHelpTooltip();
  }

  onMount(async () => {
    settings = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_SETTINGS,
    });
    showOverlay = settings?.show ?? true;

    const session = await getSession();
    if (session) {
      isLoggedIn = true;
      userHandle = session.handle || "";
      loadUserProfile(session);
    }

    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearchModal();
      }
    }

    window.addEventListener("keydown", handleKeydown);

    // Show help tooltip on first startup
    if (!localStorage.getItem("rabbithole_has_seen_help_v2")) {
      setTimeout(() => {
        showHelpTooltip = true;
        setTimeout(() => {
          dismissHelpTooltip();
        }, 3000);
      }, 1000);
    }

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  });

  async function loadUserProfile(session): Promise<void> {
    try {
      const agent = new Agent("https://public.api.bsky.app");
      const response = await agent.getProfile({ actor: session.did });
      if (response.success) {
        userAvatar = response.data.avatar;
        userHandle = response.data.handle;
      }
    } catch (e) {
      Logger.error("Failed to load user profile", e);
    }
  }

  function openSearchModal(): void {
    showSearchModal = true;
  }

  function handleSignIn(): void {
    showAuthModal = true;
  }

  function handleToggleTheme(): void {
    dispatch("toggleTheme");
  }

  async function handleToggleOverlay(): Promise<void> {
    showOverlay = !showOverlay;
    if (settings) {
      settings.show = showOverlay;
      await chrome.runtime.sendMessage({
        type: MessageRequest.UPDATE_SETTINGS,
        settings,
      });
    }
  }

  async function handleAuthSuccess(
    event: CustomEvent<{ imported: { trails: number; collections: number } }>,
  ): Promise<void> {
    showAuthModal = false;

    // Refresh login state
    const session = await getSession();
    if (session) {
      isLoggedIn = true;
      userHandle = session.handle || "";
      await loadUserProfile(session);
    }

    const imported = event.detail?.imported;
    dispatch("authStateChange", { type: "login", imported });
  }

  async function handleSignOut(): Promise<void> {
    await clearSession();
    isLoggedIn = false;
    userHandle = "";
    userAvatar = "";
    dispatch("authStateChange", { type: "logout" });
  }

  async function handleDownloadLogs(): Promise<void> {
    await Logger.downloadLogs();
  }

  async function exportData(): Promise<void> {
    const burrows = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ALL_BURROWS,
    });
    const websites = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ALL_ITEMS,
    });
    const rabbitholes = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ALL_RABBITHOLES,
    });
    const trails = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_ALL_TRAILS,
    });

    const exportData = {
      burrows,
      websites,
      rabbitholes,
      trails,
    };

    const blob = new Blob([JSON.stringify(exportData)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date();
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const filename = `rabbithole-${day}-${month}-${year}.json`;

    link.href = url;
    link.setAttribute("download", filename);
    link.click();
  }

  async function handleImport(event: CustomEvent<any>): Promise<void> {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e: CustomEvent<any>) => {
      try {
        const data = JSON.parse(e.target.result);

        let burrowsToImport = [];
        let websitesToImport = [];
        let rabbitholesToImport = [];

        if (Array.isArray(data)) {
          burrowsToImport = data;
        } else if (data && typeof data === "object") {
          burrowsToImport = data.burrows ?? data.projects ?? [];
          websitesToImport = data.websites ?? data.savedWebsites ?? [];
          rabbitholesToImport = data.rabbitholes ?? [];
        }

        await chrome.runtime.sendMessage({
          type: MessageRequest.IMPORT_DATA,
          burrows: burrowsToImport,
          websites: websitesToImport,
          rabbitholes: rabbitholesToImport,
        });

        onBurrowsClick();
      } catch (err) {
        Logger.error("Failed to parse import file", err);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function triggerImport(): void {
    fileInput.click();
  }

  function handleSearchSelectRabbithole(event: CustomEvent<any>): void {
    dispatch("selectRabbithole", event.detail);
  }

  function handleSearchSelectBurrow(event: CustomEvent<any>): void {
    dispatch("selectBurrow", event.detail);
  }

  function handleSearchSelectTrail(event: CustomEvent<any>): void {
    dispatch("selectTrail", event.detail);
  }

  async function handleOnboardingClose(): Promise<void> {
    showOnboardingModal = false;
  }
</script>

<svelte:window on:click={handleWindowClick} />

<SearchEverywhereModal
  bind:isOpen={showSearchModal}
  on:selectRabbithole={handleSearchSelectRabbithole}
  on:selectBurrow={handleSearchSelectBurrow}
  on:selectTrail={handleSearchSelectTrail}
/>

<Modal
  isOpen={showAuthModal}
  title="Sign in with Internet Handle"
  titleLink="https://internethandle.org/"
  on:close={() => (showAuthModal = false)}
>
  <Auth on:authSuccess={handleAuthSuccess} showWhyBluesky={true} />
</Modal>

<input
  type="file"
  accept=".json"
  style="display: none;"
  bind:this={fileInput}
  on:change={handleImport}
/>

<nav class="navbar">
  <div class="navbar-left">
    <div class="logo-container">
      <img class="logo" alt="Rabbithole logo" src={logoStars} /><span class="alpha-badge">alpha</span>
    </div>
    <Button
      variant="subtle"
      color="gray"
      size="md"
      on:click={onRabbitholesClick}
      class="rabbitholes-btn"
    >
      Rabbitholes
    </Button>
    <Button
      variant="subtle"
      color="gray"
      size="md"
      on:click={onExploreClick}
      class="rabbitholes-btn"
    >
      Explore
    </Button>
  </div>

  <div class="navbar-center">
    <button class="search-button" on:click={openSearchModal}>
      <MagnifyingGlass size={14} />
      <span class="search-text">Search everywhere...</span>
      <span class="search-shortcut">{isMac ? "⌘K" : "Ctrl+K"}</span>
    </button>
  </div>

  <div class="navbar-right">
    <Tooltip
      label={showHelpTooltip ? "Click here to see the tour again" : "Help"}
      opened={showHelpTooltip || undefined}
      withArrow
    >
      <ActionIcon
        color="gray"
        size="lg"
        radius="xl"
        on:click={(e) => {
          e.stopPropagation();
          showOnboardingModal = true;
          dismissHelpTooltip();
        }}
      >
        <QuestionMarkCircled size={18} />
      </ActionIcon>
    </Tooltip>

    <ActionIcon
      color="gray"
      size="lg"
      radius="xl"
      on:click={handleToggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {#if isDark}
        <Sun size={18} />
      {:else}
        <Moon size={18} />
      {/if}
    </ActionIcon>

    {#if isLoggedIn}
      <Menu placement="end" withArrow>
        <ActionIcon
          slot="control"
          variant="light"
          color="blue"
          size="lg"
          radius="xl"
          title={userHandle}
          style="overflow: hidden; padding: {userAvatar ? '0' : ''};"
        >
          {#if userAvatar}
            <img
              src={userAvatar}
              alt={userHandle}
              style="width: 100%; height: 100%; object-fit: cover;"
            />
          {:else}
            <Person size={18} />
          {/if}
        </ActionIcon>

        <Menu.Item
          icon={showOverlay ? EyeNone : EyeOpen}
          on:click={handleToggleOverlay}
        >
          {showOverlay ? "Hide Overlay" : "Show Overlay"}
        </Menu.Item>
        <Menu.Item icon={Upload} on:click={triggerImport}>
          Import Data
        </Menu.Item>
        <Menu.Item icon={Download} on:click={exportData}>Export Data</Menu.Item>
        <Menu.Item icon={FileText} on:click={handleDownloadLogs}>
          Download Logs
        </Menu.Item>
        <Menu.Item icon={Exit} color="red" on:click={handleSignOut}>
          Sign Out
        </Menu.Item>
      </Menu>
    {:else}
      <div class="connect-container">
        <Button variant="light" color="blue" size="sm" on:click={handleSignIn}>
          Sign in
        </Button>
        <Menu placement="end" withArrow>
          <ActionIcon
            slot="control"
            variant="filled"
            color="gray"
            size="lg"
            radius="xl"
            title="Settings"
          >
            <Gear size={18} />
          </ActionIcon>

          <Menu.Item
            icon={showOverlay ? EyeNone : EyeOpen}
            on:click={handleToggleOverlay}
          >
            {showOverlay ? "Hide Overlay" : "Show Overlay"}
          </Menu.Item>
          <Menu.Item icon={Upload} on:click={triggerImport}>
            Import Data
          </Menu.Item>
          <Menu.Item icon={Download} on:click={exportData}>
            Export Data
          </Menu.Item>
          <Menu.Item icon={FileText} on:click={handleDownloadLogs}>
            Download Logs
          </Menu.Item>
        </Menu>
      </div>
    {/if}
  </div>
</nav>

<style>
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 26px;
    background-color: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(10px);
    transition: background-color 0.3s ease;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    z-index: 1000;
    gap: 26px;
    color: #1a1b1e;
  }

  .navbar:hover {
    background-color: rgba(255, 255, 255, 0.95);
  }

  .navbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-shrink: 0;
  }

  .logo-container {
    display: flex;
    align-items: center;
  }

  .logo {
    width: 38px;
    height: auto;
  }

  :global(body.dark-mode) .logo {
    filter: invert(1);
  }

  .alpha-badge {
    font-size: 9px;
    font-weight: 700;
    color: #4dabf7;
    background: rgba(77, 171, 247, 0.15);
    padding: 2px 5px;
    border-radius: 4px;
    margin-left: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :global(.rabbitholes-btn) {
    font-weight: 600;
    font-size: 13px;
  }

  .navbar-center {
    flex: 1;
    max-width: 560px;
    display: flex;
    justify-content: center;
  }

  .search-button {
    width: 100%;
    max-width: 480px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 13px;
    background-color: rgba(0, 0, 0, 0.05);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 12px;
    color: #1a1b1e;
  }

  .search-button:hover {
    background-color: rgba(0, 0, 0, 0.08);
    border-color: rgba(0, 0, 0, 0.2);
  }

  .search-text {
    flex: 1;
    text-align: left;
  }

  .search-shortcut {
    font-size: 10px;
    padding: 2px 6px;
    background-color: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    color: #1a1b1e;
    font-family: monospace;
  }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .connect-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Dark mode */
  :global(body.dark-mode) .navbar {
    background-color: rgba(37, 38, 43, 0.4);
    border-bottom-color: rgba(255, 255, 255, 0.1);
    color: white;
  }

  :global(body.dark-mode) .navbar:hover {
    background-color: rgba(37, 38, 43, 0.95);
  }

  :global(body.dark-mode) .search-button {
    background-color: rgba(37, 38, 43, 0.8);
    border-color: rgba(55, 58, 64, 0.6);
    color: white;
  }

  :global(body.dark-mode) .search-button:hover {
    background-color: rgba(44, 46, 51, 0.9);
    border-color: rgba(73, 80, 87, 0.8);
  }

  :global(body.dark-mode) .search-shortcut {
    background-color: rgba(26, 27, 30, 0.9);
    border-color: rgba(55, 58, 64, 0.6);
    color: white;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .navbar {
      padding: 0 16px;
      gap: 13px;
      height: 51px;
    }

    .navbar-center {
      max-width: 320px;
    }

    .search-text {
      display: none;
    }

    .search-button {
      padding: 10px;
      justify-content: center;
    }

    .logo {
      width: 32px;
    }
  }

  @media (max-width: 480px) {
    .logo {
      width: 28px;
    }

    :global(.rabbitholes-btn) {
      font-size: 12px;
      padding: 8px 11px;
    }

    .navbar-center {
      max-width: 160px;
    }
  }
</style>
