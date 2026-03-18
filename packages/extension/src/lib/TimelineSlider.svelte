<script lang="ts">
  import type { Website } from "src/utils/types";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let websites: Website[] = [];
  export let startDate: Date = null;
  export let endDate: Date = null;

  let sliderEl: HTMLDivElement;
  let isDragging: boolean = false;
  let dragMode: string = null;
  let dragStartX: number = 0;
  let dragStartStart: number = 0;
  let dragStartEnd: number = 0;

  const DAY_MS: number = 24 * 60 * 60 * 1000;

  // Get timestamp from website object
  function getTimestamp(w: Website): number {
    const d = new Date(w.savedAt);
    return d.getTime();
  }

  // Calculate min/max dates from websites
  $: times = websites.map(getTimestamp).filter((t) => t !== null);
  $: minDate = times.length ? new Date(Math.min(...times)) : null;
  $: maxDate = times.length ? new Date(Math.max(...times)) : null;
  $: totalDays =
    minDate && maxDate ? Math.ceil((maxDate - minDate) / DAY_MS) : 0;

  // Initialize date range when data loads
  $: if (minDate && maxDate && !startDate && !endDate) {
    startDate = minDate;
    endDate = maxDate;
  }

  // Convert dates to day positions (0 to totalDays)
  $: startDay =
    minDate && startDate ? Math.round((startDate - minDate) / DAY_MS) : 0;
  $: endDay =
    minDate && endDate ? Math.round((endDate - minDate) / DAY_MS) : totalDays;

  // Convert to percentages for CSS
  $: startPct = totalDays ? (startDay / totalDays) * 100 : 0;
  $: endPct = totalDays ? (endDay / totalDays) * 100 : 100;

  function dayToDate(day: number): Date {
    return new Date(minDate.getTime() + day * DAY_MS);
  }

  function xToDay(clientX: number): number {
    const rect = sliderEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return Math.round((x / rect.width) * totalDays);
  }

  function updateRange(newStart: number, newEnd: number): void {
    startDate = dayToDate(Math.max(0, Math.min(totalDays, newStart)));
    endDate = dayToDate(Math.max(0, Math.min(totalDays, newEnd)));
    dispatch("dateRangeChange", { startDate, endDate });
  }

  function onPointerDown(e: PointerEvent, mode: string): void {
    e.preventDefault();
    isDragging = true;
    dragMode = mode;
    dragStartX = e.clientX;
    dragStartStart = startDay;
    dragStartEnd = endDay;

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!isDragging) return;

    const rect = sliderEl.getBoundingClientRect();
    const dx = e.clientX - dragStartX;
    const dayDelta = Math.round((dx / rect.width) * totalDays);

    if (dragMode === "start") {
      updateRange(
        Math.min(dragStartStart + dayDelta, dragStartEnd),
        dragStartEnd,
      );
    } else if (dragMode === "end") {
      updateRange(
        dragStartStart,
        Math.max(dragStartEnd + dayDelta, dragStartStart),
      );
    } else {
      const span = dragStartEnd - dragStartStart;
      let newStart = dragStartStart + dayDelta;
      let newEnd = dragStartEnd + dayDelta;

      if (newStart < 0) {
        newStart = 0;
        newEnd = span;
      }
      if (newEnd > totalDays) {
        newEnd = totalDays;
        newStart = totalDays - span;
      }

      updateRange(newStart, newEnd);
    }
  }

  function onPointerUp(): void {
    isDragging = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }

  function onTrackClick(e: MouseEvent): void {
    const clickDay = xToDay(e.clientX);
    const span = endDay - startDay;
    let newStart = clickDay - Math.floor(span / 2);
    let newEnd = newStart + span;

    if (newStart < 0) {
      newStart = 0;
      newEnd = span;
    }
    if (newEnd > totalDays) {
      newEnd = totalDays;
      newStart = totalDays - span;
    }

    updateRange(newStart, newEnd);
  }
</script>

<div class="timeline-slider-wrap">
  {#if minDate && maxDate}
    <div class="timeline-slider" bind:this={sliderEl} on:keydown={onTrackClick}>
      <div class="slider-track"></div>

      <div
        class="range-selection"
        style="left: {startPct}%; width: {endPct - startPct}%;"
        on:pointerdown={(e) => onPointerDown(e, "range")}
      ></div>

      <div
        class="slider-handle"
        style="left: {startPct}%;"
        on:pointerdown={(e) => onPointerDown(e, "start")}
      ></div>

      <div
        class="slider-handle"
        style="left: {endPct}%;"
        on:pointerdown={(e) => onPointerDown(e, "end")}
      ></div>
    </div>

    <div class="date-labels">
      <span>{startDate?.toLocaleDateString()}</span>
      <span>{endDate?.toLocaleDateString()}</span>
    </div>
  {:else}
    <div class="timeline-slider disabled">
      <div class="slider-track"></div>
      <div class="disabled-text">
        Add saved websites to enable the timeline slider
      </div>
    </div>
  {/if}
</div>

<style>
  .timeline-slider-wrap {
    width: 100%;
  }

  .timeline-slider {
    position: relative;
    height: 44px;
    width: 100%;
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 10px;
    cursor: pointer;
    overflow: hidden;
    padding: 0 20px;
  }

  .disabled-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: rgba(0, 0, 0, 0.45);
    padding: 0 12px;
    text-align: center;
    pointer-events: none;
  }

  .slider-track {
    position: absolute;
    top: 50%;
    left: 10px;
    right: 10px;
    height: 3px;
    background: rgba(0, 0, 0, 0.18);
    transform: translateY(-50%);
    border-radius: 999px;
  }

  .range-selection {
    position: absolute;
    top: 50%;
    height: 18px;
    transform: translateY(-50%);
    background: rgba(17, 133, 254, 0.22);
    border: 1px solid rgba(17, 133, 254, 0.35);
    border-radius: 999px;
    cursor: grab;
  }

  .range-selection:active {
    cursor: grabbing;
  }

  .slider-handle {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 26px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.25);
    border-radius: 6px;
    transform: translate(-50%, -50%);
    cursor: ew-resize;
    z-index: 3;
  }

  .slider-handle:hover {
    border-color: rgba(17, 133, 254, 0.7);
  }

  .date-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.55);
    font-weight: 700;
  }

  :global(body.dark-mode) .timeline-slider {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.14);
  }

  :global(body.dark-mode) .slider-track {
    background: rgba(255, 255, 255, 0.22);
  }

  :global(body.dark-mode) .range-selection {
    background: rgba(77, 171, 247, 0.22);
    border-color: rgba(77, 171, 247, 0.35);
  }

  :global(body.dark-mode) .slider-handle {
    background: rgba(26, 27, 30, 0.95);
    border-color: rgba(255, 255, 255, 0.22);
  }

  :global(body.dark-mode) .date-labels {
    color: rgba(255, 255, 255, 0.6);
  }

  :global(body.dark-mode) .disabled-text {
    color: rgba(255, 255, 255, 0.55);
  }
</style>
