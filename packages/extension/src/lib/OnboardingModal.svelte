<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { ChevronLeft, ChevronRight, Check } from "radix-icons-svelte";
  import Modal from "./Modal.svelte";
  import tutorial1 from "../assets/tutorial-1-burrows-rabbitholes.mp4";
  import tutorial2 from "../assets/tutorial-2-overlay-popup.mp4";
  import tutorial3 from "../assets/tutorial-3-sync.mp4";
  import tutorial4 from "../assets/tutorial-4-pinned.mp4";
  import tutorial5 from "../assets/tutorial-5-search.mp4";
  import tutorial6 from "../assets/tutorial-6-semble.mp4";

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher();

  let currentSlide: number = 0;

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

  function next(): void {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
    } else {
      close();
    }
  }

  function prev(): void {
    if (currentSlide > 0) {
      currentSlide--;
    }
  }

  function close(): void {
    dispatch("close");
    // Reset slide after a delay so it doesn't jump while closing
    setTimeout(() => {
      currentSlide = 0;
    }, 300);
  }

  function goToSlide(index: number): void {
    currentSlide = index;
  }
</script>

<Modal {isOpen} title={slides[currentSlide].title} on:close={close}>
  <div class="onboarding-container">
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
        <ChevronLeft size={24} />
      </button>

      <div class="dots">
        {#each slides as _, i}
          <button
            class="dot"
            class:active={i === currentSlide}
            on:click={() => goToSlide(i)}
            aria-label="Go to slide {i + 1}"
          ></button>
        {/each}
      </div>

      <button
        class="nav-btn"
        on:click={next}
        aria-label={currentSlide === slides.length - 1
          ? "Finish"
          : "Next slide"}
      >
        {#if currentSlide === slides.length - 1}
          <Check size={24} />
        {:else}
          <ChevronRight size={24} />
        {/if}
      </button>
    </div>
  </div>
</Modal>

<style>
  .onboarding-container {
    display: flex;
    flex-direction: column;
    min-height: 200px;
  }

  .slide-image-container {
    width: 100%;
    height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    background-color: #f8f9fa;
    border-radius: 8px;
    overflow: hidden;
  }

  .slide-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .slide-content {
    flex: 1;
    font-size: 16px;
    line-height: 1.6;
    color: #495057;
    margin-bottom: 24px;
    text-align: center;
    padding: 0 10px;
  }

  /* Deep selector for html content */
  .slide-content :global(p) {
    margin-bottom: 16px;
  }

  .slide-content :global(strong) {
    color: #1a1b1e;
    font-weight: 600;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }

  .nav-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #228be6;
    padding: 8px;
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

  .dots {
    display: flex;
    gap: 8px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #dee2e6;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .dot:hover {
    background-color: #ced4da;
  }

  .dot.active {
    background-color: #228be6;
  }

  /* Dark mode */
  :global(body.dark-mode) .slide-image-container {
    background-color: #25262b;
  }

  :global(body.dark-mode) .slide-content {
    color: #c1c2c5;
  }

  :global(body.dark-mode) .slide-content :global(strong) {
    color: #e7e7e7;
  }

  :global(body.dark-mode) .controls {
    border-top-color: rgba(255, 255, 255, 0.1);
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

  :global(body.dark-mode) .dot {
    background-color: #373a40;
  }

  :global(body.dark-mode) .dot:hover {
    background-color: #5c5f66;
  }

  :global(body.dark-mode) .dot.active {
    background-color: #4dabf7;
  }
</style>
