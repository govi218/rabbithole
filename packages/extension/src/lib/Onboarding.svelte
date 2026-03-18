<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    ChevronLeft,
    ChevronRight,
    Cross2,
    Sun,
    Moon,
  } from "radix-icons-svelte";
  import { Loader } from "@svelteuidev/core";
  import { MessageRequest } from "../utils";
  import tutorial1 from "../assets/tutorial-1-burrows-rabbitholes.mp4";
  import tutorial2 from "../assets/tutorial-2-overlay-popup.mp4";
  import tutorial3 from "../assets/tutorial-3-sync.mp4";
  import tutorial4 from "../assets/tutorial-4-pinned.mp4";
  import tutorial5 from "../assets/tutorial-5-search.mp4";
  import tutorial6 from "../assets/tutorial-6-semble.mp4";

  const dispatch = createEventDispatcher();

  let step: "tutorial" | "import" = "tutorial";
  let currentSlide = 0;

  let isImporting = false;
  let importBookmarks = true;
  let importTabGroups = true;
  let isDark = false;

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

  const slides = [
    {
      title: "Organize with Rabbitholes",
      image: tutorial1,
      content: `
        <p><strong>Structure your research.</strong></p>
        <p>Create <strong>Burrows</strong> for specific topics and group them into <strong>Rabbitholes</strong>. Keep your projects distinct and organized.</p>
      `,
    },
    {
      title: "Quick Access Overlay",
      image: tutorial2,
      content: `
        <p><strong>Track without interruption.</strong></p>
        <p>Use the <strong>Overlay</strong> or <strong>Popup</strong> to save pages to your active Burrow with one click, without leaving your current tab.</p>
      `,
    },
    {
      title: "Save Context Instantly",
      image: tutorial3,
      content: `
        <p><strong>Close all the tabs you want without batting an eye.</strong></p>
        <p>Click the <strong>Sync</strong> button to save all open tabs in your window to the active Burrow. Perfect for switching contexts without losing open pages.</p>
      `,
    },
    {
      title: "Pick Up Where You Left Off",
      image: tutorial4,
      content: `
        <p><strong>Get right back into where you last were.</strong></p>
        <p>Click the <strong>Home</strong> button to save all open tabs in your window as pinned websites for your Burrow. Whether you're in the depths of research or coming back to your desk after the weekend, you can keep track of the most important websites in your Burrow.</p>
      `,
    },
    {
      title: "Search Everywhere",
      image: tutorial5,
      content: `
        <p><strong>Find anything, fast.</strong></p>
        <p>Press <strong>Cmd+K</strong> (or Ctrl+K) to open the command palette. Search across all your Rabbitholes, Burrows, and saved websites instantly.</p>
      `,
    },
    {
      title: "Publish to Semble",
      image: tutorial6,
      content: `
        <p><strong>Share your knowledge.</strong></p>
        <p>Publish your Burrows as curated collections to <strong>Semble</strong> on the AT Protocol. Share your research trails with the world.</p>
      `,
    },
  ];

  function next() {
    if (step === "tutorial") {
      if (currentSlide < slides.length - 1) {
        currentSlide++;
      } else {
        step = "import";
      }
    }
  }

  function prev() {
    if (step === "tutorial") {
      if (currentSlide > 0) {
        currentSlide--;
      }
    } else if (step === "import") {
      step = "tutorial";
      currentSlide = slides.length - 1;
    }
  }

  function skipTutorial() {
    step = "import";
  }

  async function finish() {
    if (importBookmarks || importTabGroups) {
      isImporting = true;
      try {
        await chrome.runtime.sendMessage({
          type: "IMPORT_BROWSER_DATA",
          importBookmarks,
          importTabGroups,
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
      on:click={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {#if isDark}
        <Sun size={16} />
      {:else}
        <Moon size={16} />
      {/if}
    </button>

    {#if step === "tutorial"}
      <button class="skip-btn" on:click={skipTutorial}>
        Skip Tutorial <Cross2 size={14} style="margin-left: 4px;" />
      </button>
    {:else if step === "import"}
      <button class="skip-btn" on:click={skipImport} disabled={isImporting}>
        Skip Import <Cross2 size={14} style="margin-left: 4px;" />
      </button>
    {/if}
  </div>

  {#if step === "tutorial"}
    <div class="content-wrapper">
      <h1 class="slide-title">{slides[currentSlide].title}</h1>

      <div class="slide-image-container">
        {#key currentSlide}
          <video
            src={slides[currentSlide].image}
            class="slide-image"
            autoplay
            loop
            muted
            playsinline
          >
            Your browser does not support the video tag.
          </video>
        {/key}
      </div>

      <div class="slide-content">
        {@html slides[currentSlide].content}
      </div>

      <div class="controls">
        <button
          class="nav-btn"
          on:click={prev}
          disabled={currentSlide === 0}
          aria-label="Previous slide"
        >
          <ChevronLeft size={22} />
        </button>

        <div class="dots">
          {#each slides as _, i}
            <button
              class="dot"
              class:active={i === currentSlide}
              on:click={() => (currentSlide = i)}
              aria-label="Go to slide {i + 1}"
            ></button>
          {/each}
        </div>

        <button class="nav-btn" on:click={next} aria-label="Next slide">
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  {:else if step === "import"}
    <div class="content-wrapper">
      <h1 class="slide-title">Import Existing Data</h1>

      <div class="import-container">
        <p class="import-desc">
          Get started quickly by importing your existing browser data into
          Rabbithole.
        </p>

        <div class="import-options">
          <label class="import-option">
            <input
              type="checkbox"
              bind:checked={importBookmarks}
              disabled={isImporting}
            />
            <div class="option-text">
              <strong>Bookmarks</strong>
              <span>Folders become Rabbitholes, subfolders become Burrows.</span
              >
            </div>
          </label>

          <label class="import-option">
            <input
              type="checkbox"
              bind:checked={importTabGroups}
              disabled={isImporting}
            />
            <div class="option-text">
              <strong>Workspaces & Tab Groups</strong>
              <span>Windows become Rabbitholes, tab groups become Burrows.</span
              >
            </div>
          </label>
        </div>

        <div class="privacy-note">
          <p>
            🛡️ <strong>Privacy First:</strong> Rabbithole does not collect any information
            about you and all your data is stored locally on your device.
          </p>
        </div>
      </div>

      <div class="controls import-controls">
        <button
          class="nav-btn"
          on:click={prev}
          disabled={isImporting}
          aria-label="Back to tutorial"
        >
          <ChevronLeft size={22} />
        </button>

        <div class="spacer"></div>

        <button class="primary-btn" on:click={finish} disabled={isImporting}>
          {#if isImporting}
            <Loader size="sm" color="white" />
          {:else}
            {importBookmarks || importTabGroups
              ? "Import & Continue"
              : "Continue"}
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

  .skip-btn {
    display: flex;
    align-items: center;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    color: #495057;
    cursor: pointer;
    transition: background 0.2s;
  }

  .skip-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.1);
  }

  .skip-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(body.dark-mode) .skip-btn {
    background: rgba(255, 255, 255, 0.08);
    color: #c1c2c5;
  }

  :global(body.dark-mode) .skip-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
  }

  .content-wrapper {
    width: 100%;
    max-width: 1200px;
    height: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
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
    flex: 0 0 auto;
  }

  :global(body.dark-mode) .slide-title {
    color: #e7e7e7;
  }

  .slide-image-container {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    background-color: rgba(0, 0, 0, 0.02);
    border-radius: 16px;
    padding: 16px;
    box-sizing: border-box;
  }

  :global(body.dark-mode) .slide-image-container {
    background-color: rgba(255, 255, 255, 0.02);
  }

  .slide-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .slide-content {
    flex: 0 0 auto;
    font-size: 15px;
    line-height: 1.5;
    color: #495057;
    margin-bottom: 24px;
    text-align: center;
    padding: 0 16px;
    max-width: 640px;
    margin-left: auto;
    margin-right: auto;
  }

  .slide-content :global(p) {
    margin-bottom: 12px;
  }

  .slide-content :global(strong) {
    color: #1a1b1e;
    font-weight: 700;
  }

  :global(body.dark-mode) .slide-content {
    color: #c1c2c5;
  }

  :global(body.dark-mode) .slide-content :global(strong) {
    color: #e7e7e7;
  }

  .import-container {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    margin-bottom: 24px;
    overflow-y: auto;
  }

  .import-desc {
    font-size: 15px;
    color: #495057;
    text-align: center;
    margin-bottom: 32px;
    flex: 0 0 auto;
  }

  :global(body.dark-mode) .import-desc {
    color: #c1c2c5;
  }

  .import-options {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 480px;
    margin-bottom: 32px;
    flex: 0 0 auto;
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
    max-width: 560px;
    flex: 0 0 auto;
  }

  :global(body.dark-mode) .privacy-note {
    background: rgba(255, 255, 255, 0.03);
    color: #909296;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 20px;
    flex: 0 0 auto;
    max-width: 640px;
    width: 100%;
    margin: 0 auto;
  }

  .import-controls {
    justify-content: flex-start;
  }

  .spacer {
    flex: 1;
  }

  .nav-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #228be6;
    padding: 12px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
  }

  .nav-btn:hover:not(:disabled) {
    background-color: rgba(34, 139, 230, 0.1);
  }

  .nav-btn:disabled {
    color: #adb5bd;
    cursor: default;
  }

  :global(body.dark-mode) .nav-btn {
    color: #4dabf7;
  }

  :global(body.dark-mode) .nav-btn:hover:not(:disabled) {
    background-color: rgba(77, 171, 247, 0.15);
  }

  :global(body.dark-mode) .nav-btn:disabled {
    color: #5c5f66;
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
    min-width: 160px;
  }

  .primary-btn:hover:not(:disabled) {
    background-color: #0070e0;
  }

  .primary-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .dots {
    display: flex;
    gap: 10px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #dee2e6;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: all 0.2s;
  }

  .dot:hover:not(:disabled) {
    background-color: #ced4da;
    transform: scale(1.2);
  }

  .dot.active {
    background-color: #228be6;
    transform: scale(1.2);
  }

  :global(body.dark-mode) .dot {
    background-color: #373a40;
  }

  :global(body.dark-mode) .dot:hover:not(:disabled) {
    background-color: #5c5f66;
  }

  :global(body.dark-mode) .dot.active {
    background-color: #4dabf7;
  }
</style>
