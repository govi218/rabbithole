<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { Sun, Moon } from "radix-icons-svelte";
  import { Loader } from "@svelteuidev/core";
  import { MessageRequest } from "../utils";
  import logoStars from "@rabbithole/shared/assets/rabbithole-logo-stars.svg";

  const dispatch = createEventDispatcher();

  let currentSlide = 0; // 0: welcome, 1: import
  let isImporting = false;
  let importBookmarks = true;
  let isDark = false;
  let hasInteractedWithTheme = false;

  onMount(async () => {
    const cachedDarkMode = localStorage.getItem("rabbithole-dark-mode");
    if (cachedDarkMode !== null) {
      isDark = cachedDarkMode === "true";
    } else {
      const settings = await chrome.runtime.sendMessage({
        type: MessageRequest.GET_SETTINGS,
      });
      isDark = settings?.darkMode ?? false;
    }
    document.body.classList.toggle("dark-mode", isDark);
  });

  async function toggleTheme() {
    hasInteractedWithTheme = true;
    isDark = !isDark;
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem("rabbithole-dark-mode", String(isDark));

    const settings = await chrome.runtime.sendMessage({
      type: MessageRequest.GET_SETTINGS,
    });
    if (settings) {
      await chrome.runtime.sendMessage({
        type: MessageRequest.UPDATE_SETTINGS,
        settings: { ...settings, darkMode: isDark },
      });
    }
  }

  function goToImport() {
    currentSlide = 1;
  }

  async function finish() {
    if (importBookmarks) {
      isImporting = true;
      try {
        await chrome.runtime.sendMessage({
          type: MessageRequest.IMPORT_BROWSER_DATA,
          importBookmarks: true,
          importTabGroups: false,
        });
      } catch (e) {
        console.error(e);
      }
      isImporting = false;
    }
    dispatch("complete");
  }

  function skipImport() {
    dispatch("complete");
  }
</script>

<div class="onboarding-fullscreen">
  <div class="top-right-actions">
    <button
      class="theme-btn"
      class:pulse={!hasInteractedWithTheme}
      on:click={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {#if isDark}
        <Sun size={16} />
      {:else}
        <Moon size={16} />
      {/if}
    </button>
  </div>

  {#if currentSlide === 0}
    <!-- Welcome slide -->
    <div class="content-wrapper">
      <img class="logo" alt="Rabbithole logo" src={logoStars} />

      <h1 class="slide-title">Welcome to Rabbithole</h1>

      <div class="welcome-content">
        <p class="welcome-desc">
          Rabbithole helps you track and share the online journeys you get into.
        </p>

        <div class="feature-list">
          <div class="feature-item">
            <span class="feature-icon">🕳️</span>
            <div class="feature-text">
              <strong>Rabbitholes</strong>
              <span>Projects or topics to organize your research</span>
            </div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🏠</span>
            <div class="feature-text">
              <strong>Burrows</strong>
              <span>Unordered collections of links within a rabbithole</span>
            </div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🥾</span>
            <div class="feature-text">
              <strong>Trails</strong>
              <span>Ordered paths through content, like a guided tour</span>
            </div>
          </div>
        </div>
      </div>

      <div class="controls centered">
        <button class="primary-btn" on:click={goToImport}> Get Started </button>
      </div>
    </div>
  {:else}
    <!-- Import slide -->
    <div class="content-wrapper">
      <h1 class="slide-title">Import Bookmarks</h1>

      <div class="import-container">
        <p class="import-desc">
          Get started quickly by importing your browser bookmarks.
        </p>

        <label class="import-option">
          <input
            type="checkbox"
            bind:checked={importBookmarks}
            disabled={isImporting}
          />
          <div class="option-text">
            <strong>Bookmarks</strong>
            <span>Folders become Rabbitholes, subfolders become Burrows.</span>
          </div>
        </label>

        <div class="privacy-note">
          <p>
            <strong>Privacy First:</strong> Rabbithole does not collect any information
            about you and all your data is stored locally on your device.
          </p>
        </div>
      </div>

      <div class="controls">
        <button class="skip-btn" on:click={skipImport} disabled={isImporting}>
          Skip Import
        </button>

        <div class="spacer"></div>

        <button class="primary-btn" on:click={finish} disabled={isImporting}>
          {#if isImporting}
            <Loader size="sm" color="white" />
          {:else}
            Continue
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .onboarding-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 32px 16px;
    box-sizing: border-box;
  }

  :global(body.dark-mode) .onboarding-fullscreen {
    background-color: #141517;
  }

  .top-right-actions {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 10;
  }

  .theme-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    color: #495057;
    cursor: pointer;
    transition: background 0.2s;
  }

  .theme-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  :global(body.dark-mode) .theme-btn {
    background: rgba(255, 255, 255, 0.08);
    color: #c1c2c5;
  }

  :global(body.dark-mode) .theme-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .theme-btn.pulse {
    animation: subtle-pulse 2s ease-in-out infinite;
  }

  @keyframes subtle-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(17, 133, 254, 0);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(17, 133, 254, 0.3);
    }
  }

  .content-wrapper {
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .slide-title {
    font-size: 28px;
    font-weight: 800;
    text-align: center;
    margin-top: 0;
    margin-bottom: 24px;
    color: #1a1b1e;
  }

  :global(body.dark-mode) .slide-title {
    color: #e7e7e7;
  }

  .logo {
    width: 64px;
    height: auto;
    margin-bottom: 16px;
  }

  :global(body.dark-mode) .logo {
    filter: invert(1);
  }

  .welcome-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 400px;
  }

  .welcome-desc {
    font-size: 15px;
    color: #495057;
    text-align: center;
    margin-bottom: 32px;
    line-height: 1.5;
  }

  :global(body.dark-mode) .welcome-desc {
    color: #c1c2c5;
  }

  .feature-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    margin-bottom: 32px;
  }

  .feature-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 16px;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 10px;
  }

  :global(body.dark-mode) .feature-item {
    background: rgba(255, 255, 255, 0.03);
  }

  .feature-icon {
    font-size: 22px;
    line-height: 1;
  }

  .feature-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .feature-text strong {
    font-size: 14px;
    color: #1a1b1e;
  }

  .feature-text span {
    font-size: 13px;
    color: #868e96;
    line-height: 1.4;
  }

  :global(body.dark-mode) .feature-text strong {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .feature-text span {
    color: #909296;
  }

  .import-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 16px;
    margin-bottom: 24px;
    width: 100%;
  }

  .import-desc {
    font-size: 15px;
    color: #495057;
    text-align: center;
    margin-bottom: 32px;
  }

  :global(body.dark-mode) .import-desc {
    color: #c1c2c5;
  }

  .import-option {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 20px;
    border: 2px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(0, 0, 0, 0.01);
    width: 100%;
    max-width: 360px;
    margin-bottom: 32px;
  }

  .import-option:hover {
    border-color: #228be6;
    background: rgba(34, 139, 230, 0.05);
  }

  :global(body.dark-mode) .import-option {
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.01);
  }

  :global(body.dark-mode) .import-option:hover {
    border-color: #4dabf7;
    background: rgba(77, 171, 247, 0.05);
  }

  .import-option input[type="checkbox"] {
    margin-top: 2px;
    width: 20px;
    height: 20px;
    cursor: pointer;
  }

  .option-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .option-text strong {
    font-size: 15px;
    color: #1a1b1e;
  }

  .option-text span {
    font-size: 13px;
    color: #868e96;
  }

  :global(body.dark-mode) .option-text strong {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .option-text span {
    color: #909296;
  }

  .privacy-note {
    background: rgba(0, 0, 0, 0.03);
    padding: 16px 24px;
    border-radius: 12px;
    color: #495057;
    font-size: 13px;
    text-align: center;
    max-width: 360px;
  }

  :global(body.dark-mode) .privacy-note {
    background: rgba(255, 255, 255, 0.03);
    color: #909296;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
    max-width: 360px;
    gap: 12px;
  }

  .controls.centered {
    justify-content: center;
  }

  .spacer {
    flex: 1;
  }

  .skip-btn {
    background: transparent;
    border: none;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 500;
    color: #868e96;
    cursor: pointer;
    transition: color 0.2s;
  }

  .skip-btn:hover:not(:disabled) {
    color: #495057;
  }

  .skip-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(body.dark-mode) .skip-btn {
    color: #5c5f66;
  }

  :global(body.dark-mode) .skip-btn:hover:not(:disabled) {
    color: #c1c2c5;
  }

  .primary-btn {
    background-color: #1185fe;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 200px;
  }

  .primary-btn:hover:not(:disabled) {
    background-color: #0070e0;
  }

  .primary-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
</style>
