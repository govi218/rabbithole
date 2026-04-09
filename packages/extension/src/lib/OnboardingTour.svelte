<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { Button } from "@svelteuidev/core";

  export let steps: { selector: string; title: string; content: string }[] = [];
  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher();

  let currentStep = 0;
  let targetElement: HTMLElement | null = null;
  let position = { top: 0, left: 0 };
  let previousZIndex: string = "";
  let highlightedElement: HTMLElement | null = null;

  $: if (isOpen && steps.length > 0) {
    highlightTarget();
    updatePosition();
  }

  function highlightTarget() {
    // Remove highlight from previous element
    if (highlightedElement) {
      highlightedElement.style.zIndex = previousZIndex;
      highlightedElement.classList.remove("tour-highlight");
      highlightedElement = null;
    }

    const selector = steps[currentStep]?.selector;
    if (selector) {
      targetElement = document.querySelector(selector);
      if (targetElement) {
        highlightedElement = targetElement;
        previousZIndex = targetElement.style.zIndex;
        targetElement.style.zIndex = "2147483642";
        targetElement.classList.add("tour-highlight");
        // Scroll into view if needed
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  function updatePosition() {
    if (!targetElement) return;
    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 280;
    const tooltipHeight = 150;

    // Position below the element, centered
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.bottom + 12;

    // Keep within viewport
    if (left < 16) left = 16;
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16;
    }
    if (top + tooltipHeight > window.innerHeight - 16) {
      // Show above instead
      top = rect.top - tooltipHeight - 12;
    }

    position = { top, left };
  }

  function next() {
    if (currentStep < steps.length - 1) {
      currentStep++;
      highlightTarget();
      updatePosition();
    } else {
      complete();
    }
  }

  function prev() {
    if (currentStep > 0) {
      currentStep--;
      highlightTarget();
      updatePosition();
    }
  }

  function skip() {
    cleanup();
    currentStep = 0;
    dispatch("skip");
  }

  function complete() {
    cleanup();
    currentStep = 0;
    dispatch("complete");
  }

  function cleanup() {
    if (highlightedElement) {
      highlightedElement.style.zIndex = previousZIndex;
      highlightedElement.classList.remove("tour-highlight");
      highlightedElement = null;
    }
  }

  onDestroy(() => {
    cleanup();
  });
</script>

{#if isOpen && steps.length > 0}
  <!-- Overlay -->
  <div class="tour-overlay" on:click={skip}></div>

  <!-- Tooltip -->
  <div class="tour-tooltip" style="top: {position.top}px; left: {position.left}px;">
    <div class="tour-header">
      <span class="tour-step">{currentStep + 1} / {steps.length}</span>
      <span class="tour-title">{steps[currentStep].title}</span>
      <button class="tour-close" on:click={skip}>×</button>
    </div>
    <div class="tour-content">
      {steps[currentStep].content}
    </div>
    <div class="tour-footer">
      <div class="tour-dots">
        {#each steps as _, i}
          <button
            class="tour-dot"
            class:active={i === currentStep}
            on:click={() => { currentStep = i; updatePosition(); }}
          ></button>
        {/each}
      </div>
      <div class="tour-actions">
        {#if currentStep > 0}
          <Button variant="subtle" size="xs" on:click={prev}>Back</Button>
        {:else}
          <div></div>
        {/if}
        <Button variant="filled" size="xs" on:click={next}>
          {currentStep === steps.length - 1 ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .tour-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 2147483640;
    pointer-events: auto;
  }

  .tour-tooltip {
    position: fixed;
    width: 280px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    z-index: 2147483645;
    overflow: hidden;
    animation: fadeIn 0.2s ease-out;
  }

  :global(body.dark-mode) .tour-tooltip {
    background: #25262b;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
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

  .tour-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: rgba(17, 133, 254, 0.08);
    gap: 8px;
  }

  :global(body.dark-mode) .tour-header {
    background: rgba(77, 171, 247, 0.08);
  }

  .tour-step {
    font-size: 11px;
    font-weight: 600;
    color: #1185fe;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  :global(body.dark-mode) .tour-step {
    color: #4dabf7;
  }

  .tour-title {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: #1a1b1e;
  }

  :global(body.dark-mode) .tour-title {
    color: #e7e7e7;
  }

  .tour-close {
    background: none;
    border: none;
    font-size: 20px;
    color: #868e96;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .tour-close:hover {
    color: #495057;
  }

  :global(body.dark-mode) .tour-close:hover {
    color: #c1c2c5;
  }

  .tour-content {
    padding: 16px;
    font-size: 14px;
    color: #495057;
    line-height: 1.5;
  }

  :global(body.dark-mode) .tour-content {
    color: #909296;
  }

  .tour-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    gap: 12px;
  }

  :global(body.dark-mode) .tour-footer {
    border-top-color: rgba(255, 255, 255, 0.1);
  }

  .tour-dots {
    display: flex;
    gap: 6px;
  }

  .tour-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #dee2e6;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tour-dot:hover {
    background: #ced4da;
  }

  .tour-dot.active {
    background: #1185fe;
    transform: scale(1.2);
  }

  :global(body.dark-mode) .tour-dot {
    background: #373a40;
  }

  :global(body.dark-mode) .tour-dot:hover {
    background: #5c5f66;
  }

  :global(body.dark-mode) .tour-dot.active {
    background: #4dabf7;
  }

  .tour-actions {
    display: flex;
    gap: 8px;
  }

  /* Highlighted element styling */
  :global(.tour-highlight) {
    position: relative;
    background-color: rgba(17, 133, 254, 0.15) !important;
    border-radius: 8px;
    transition: background-color 0.3s;
  }

  :global(body.dark-mode .tour-highlight) {
    background-color: rgba(77, 171, 247, 0.2) !important;
  }
</style>
