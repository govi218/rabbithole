<script lang="ts">
  import Fuse from "fuse.js";
  import { createEventDispatcher, onMount, tick } from "svelte";
  import {
    Group,
    Input,
    Text,
    Tooltip,
    Loader,
    ActionIcon,
    Button,
  } from "@svelteuidev/core";
  import CollapsibleContainer from "src/lib/CollapsibleContainer.svelte";
  import TimelineCard from "src/lib/TimelineCard.svelte";
  import Modal from "src/lib/Modal.svelte";
  import BurrowGrid from "src/lib/BurrowGrid.svelte";
  import PinnedWebsites from "src/lib/PinnedWebsites.svelte";
  import CopyWebsiteModal from "src/lib/CopyWebsiteModal.svelte";
  import ActionBar from "src/lib/ActionBar.svelte";
  import OrganizeModal from "src/lib/OrganizeModal.svelte";
  import WebsiteSelectGrid from "src/lib/WebsiteSelectGrid.svelte";
  import TrailView from "src/lib/TrailView.svelte";
  import NameInputModal from "src/lib/NameInputModal.svelte";
  import { ChevronLeft, ListBullet, Grid, Update } from "radix-icons-svelte";
  import { getSession } from "../atproto/client";
  import {
    createCollection,
    createUrlCard,
    createCollectionLink,
  } from "../atproto/cosmik";
  import { MessageRequest, Logger } from "../utils";
  import type { Burrow, Rabbithole, Website, Trail } from "src/utils/types";

  const dispatch = createEventDispatcher();

  export let activeBurrow: Burrow | null = null;
  export let activeTrail: Trail | null = null;
  export let activeRabbithole: Rabbithole | null = null;
  export let websites: Website[] = [];
  export let isLoading: boolean = false;
  export let selectBurrow: (burrowId: string) => Promise<void>;
  export let selectTrail: (trailId: string) => Promise<void>;
  export let autoFocusTitle: boolean = false;
  export let burrowsInActiveRabbithole: Burrow[] = [];
  export let trailsInActiveRabbithole: Trail[] = [];

  let searchResults: Website[] = [];
  let searchQuery: string = "";
  let filteredWebsites: Website[] = [];
  let previousWebsitesLength: number = 0;
  let isPublishing: boolean = false;
  let showPublishModal: boolean = false;
  let isSyncing: boolean = false;

  let hoveredTimestamp: number = null;
  let hoverX: number = 0;
  let hoverY: number = 0;
  let isHoveringTimestamp: boolean = false;

  // Slider-controlled date window
  let startDate: Date = null;
  let endDate: Date = null;

  let showCopyModal: boolean = false;
  let copyModalMode: "burrow" | "rabbithole" = "burrow";
  let websiteToCopy: string = "";

  let isUpdatingPinnedWebsites: boolean = false;
  let isSavingWindow: boolean = false;
  let isDeletingContainer: boolean = false;
  let burrowNameError: string | null = null;

  let viewMode: "timeline" | "grid" = "grid";

  let showOrganizeModal = false;
  let selectionMode: "Burrow" | "Trail" | null = null;

  let showNameModal: boolean = false;
  let nameModalTitle: string = "";
  let nameModalPlaceholder: string = "";
  let nameModalResolve: ((value: string | null) => void) | null = null;

  let openTrailInEditMode: boolean = false;

  let trailViewRef: TrailView = null;
  let trailIsEditing: boolean = false;

  function promptName(
    title: string,
    placeholder: string,
  ): Promise<string | null> {
    nameModalTitle = title;
    nameModalPlaceholder = placeholder;
    showNameModal = true;
    return new Promise((resolve) => {
      nameModalResolve = resolve;
    });
  }

  $: gridWebsites =
    searchQuery.length >= 3
      ? websitesToDisplay
      : [...websitesToDisplay].sort((a, b) => {
          const tA = getWebsiteTimeMs(a) || 0;
          const tB = getWebsiteTimeMs(b) || 0;
          return tB - tA;
        });

  onMount(async () => {
    if (autoFocusTitle) {
      await tick();
      const input = document.querySelector(
        ".project-name-input input",
      ) as HTMLInputElement;
      input?.focus();
      input?.select();
    }
  });

  $: if (activeTrail) {
    trailIsEditing = openTrailInEditMode;
  }

  async function updatePinnedWebsites(): Promise<void> {
    isUpdatingPinnedWebsites = true;
    try {
      if (activeRabbithole?.id) {
        await chrome.runtime.sendMessage({
          type: MessageRequest.UPDATE_RABBITHOLE_PINNED_WEBSITES,
          rabbitholeId: activeRabbithole.id,
        });
      }
      dispatch("refresh");
    } catch (e) {
      Logger.error("Failed to update burrow home:", e);
    } finally {
      isUpdatingPinnedWebsites = false;
    }
  }

  async function saveWindow(): Promise<void> {
    isSavingWindow = true;
    try {
      if (activeBurrow?.id) {
        await chrome.runtime.sendMessage({
          type: MessageRequest.SAVE_WINDOW_TO_ACTIVE_BURROW,
        });
      } else if (activeRabbithole?.id) {
        await chrome.runtime.sendMessage({
          type: MessageRequest.SAVE_WINDOW_TO_RABBITHOLE,
          rabbitholeId: activeRabbithole.id,
        });
      }
      dispatch("refresh");
    } catch (e) {
      Logger.error("Failed to save window to burrow:", e);
    } finally {
      isSavingWindow = false;
    }
  }

  async function deleteContainer(): Promise<void> {
    dispatch("deleteContainer");
  }

  async function renameContainer(): Promise<void> {
    if (activeBurrow) {
      const name = activeBurrow.name.trim();
      if (name === "") {
        burrowNameError = "Burrow name cannot be empty";
        return;
      }

      if (
        burrowsInActiveRabbithole.some(
          (b) => b.id !== activeBurrow.id && b.name === name,
        )
      ) {
        burrowNameError = "Burrow name must be unique in this rabbithole";
        return;
      }

      burrowNameError = null;

      dispatch("containerRename", {
        type: "burrow",
        id: activeBurrow.id,
        name: name,
      });
    } else if (activeTrail) {
      const name = activeTrail.name.trim();
      if (name === "") {
        burrowNameError = "Trail name cannot be empty";
        return;
      }

      burrowNameError = null;

      dispatch("containerRename", {
        type: "trail",
        id: activeTrail.id,
        name: name,
      });
    } else if (activeRabbithole) {
      const title = activeRabbithole.title.trim();
      if (title === "") {
        burrowNameError = "Rabbithole name cannot be empty";
        return;
      }

      burrowNameError = null;

      dispatch("containerRename", {
        type: "rabbithole",
        id: activeRabbithole.id,
        name: title,
      });
    }
  }

  async function deleteWebsite(event: CustomEvent<any>): Promise<void> {
    dispatch("websiteDelete", {
      url: event.detail.url,
    });
  }

  function openAddToBurrowModal(event: CustomEvent<any>): void {
    websiteToCopy = event.detail.url;
    copyModalMode = "burrow";
    showCopyModal = true;
  }

  function openAddToRabbitholeModal(event: CustomEvent<any>): void {
    websiteToCopy = event.detail.url;
    copyModalMode = "rabbithole";
    showCopyModal = true;
  }

  async function updateWebsite(event: CustomEvent<any>): Promise<void> {
    const { url, name, description } = event.detail;
    try {
      await chrome.runtime.sendMessage({
        type: MessageRequest.UPDATE_WEBSITE,
        url,
        name,
        description,
      });

      // Update local state
      const index = websites.findIndex((w) => w.url === url);
      if (index !== -1) {
        websites[index] = { ...websites[index], name, description };
      }
    } catch (e) {
      Logger.error("Failed to update website:", e);
    }
  }

  function handleSearch(event: CustomEvent<any>): void {
    searchQuery = event.detail.query;
    if (!searchQuery) {
      searchResults = [];
      return;
    }
    const fuse = new Fuse(websites, {
      keys: ["name", "description", "url"],
      includeScore: true,
      threshold: 0.3,
    });

    const results = fuse.search(searchQuery);
    searchResults = results.map((res) => res.item);
  }

  function openPublishModal(): void {
    showPublishModal = true;
  }

  async function confirmPublish(): Promise<void> {
    await publishRabbithole();
    showPublishModal = false;
  }

  async function publishRabbithole(): Promise<void> {
    if (!activeBurrow) {
      return;
    }
    if (websites.length === 0) {
      alert("Rabbithole is empty!");
      return;
    }

    isPublishing = true;
    let lastError = null;

    try {
      const session = await getSession();

      if (!session) {
        alert("Please log in first.");
        return;
      }

      const did = session.did;
      const title = activeBurrow.name;

      const collectionData = await createCollection(did, title);

      let successCount = 0;
      for (const site of websites) {
        try {
          const cardData = await createUrlCard(did, site);

          await createCollectionLink(did, collectionData, cardData);

          successCount++;
        } catch (err) {
          Logger.error(`Failed to create card/link for ${site.url}`, err);
          lastError = err;
        }
      }

      if (successCount === 0 && websites.length > 0) {
        alert(
          `Failed to publish any cards. Last error: ${
            lastError?.message || "Unknown error"
          }`,
        );
      } else {
        const timestamp = Date.now();

        const response = await chrome.runtime.sendMessage({
          type: MessageRequest.PUBLISH_BURROW,
          burrowId: activeBurrow.id,
          uri: collectionData.uri,
          timestamp: timestamp,
        });

        if (response && response.error) {
          throw new Error(response.error);
        }

        activeBurrow.sembleCollectionUri = collectionData.uri;
        activeBurrow.lastSembleSync = timestamp;

        alert(
          `Rabbithole published successfully! Created collection and ${successCount} cards.`,
        );
      }
    } catch (e) {
      Logger.error(e);
      if (e.message.includes("ScopeMissingError")) {
        alert(
          "Permission denied. Please log out and log back in to grant the necessary permissions.",
        );
      } else {
        alert("Error publishing rabbithole: " + e.message);
      }
    } finally {
      isPublishing = false;
    }
  }

  async function syncBurrow(): Promise<void> {
    const uri = activeBurrow?.sembleCollectionUri;
    if (!uri) return;

    isSyncing = true;
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageRequest.SYNC_BURROW,
        burrowId: activeBurrow.id,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      activeBurrow.lastSembleSync = response.timestamp;
    } catch (e) {
      Logger.error("Sync failed:", e);
      alert("Sync failed: " + e.message);
    } finally {
      isSyncing = false;
    }
  }

  function formatDate(ts: number): string {
    if (!ts) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    }).format(new Date(ts));
  }

  function formatDateTime(ts: number): string {
    if (!ts) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(ts));
  }

  function toTimeMs(value: Date): number {
    if (value === null || value === undefined) return null;

    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      // Heuristic: if it's in seconds, convert to ms
      return value < 10_000_000_000 ? value * 1000 : value;
    }

    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isFinite(t) ? t : null;
    }

    if (typeof value === "string") {
      const t = new Date(value).getTime();
      return Number.isFinite(t) ? t : null;
    }

    return null;
  }

  function getWebsiteTimeMs(w): number {
    if (!w || typeof w !== "object") return null;

    const candidates = [
      w.savedAt,
      w.saved_at,
      w.createdAt,
      w.created_at,
      w.timestamp,
      w.time,
      w.date,
      w.saved,
      w.addedAt,
      w.added_at,
      w.indexedAt,
      w.indexed_at,
    ];

    for (const c of candidates) {
      const t = toTimeMs(c);
      if (t !== null) return t;
    }

    return null;
  }

  function dateKeyFromMs(ms: number): string {
    if (!ms) return "";
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function groupByDate(items): any[] {
    const map = new Map();
    for (const site of items) {
      const t = getWebsiteTimeMs(site);
      if (t === null) continue;
      const key = dateKeyFromMs(t);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(site);
    }

    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((key) => ({
      key,
      label: formatDate(
        map.get(key)[0] ? getWebsiteTimeMs(map.get(key)[0]) : null,
      ),
      items: map.get(key),
    }));
  }

  function isWithinRange(site): boolean {
    if (!startDate || !endDate) return true;
    const t = getWebsiteTimeMs(site);
    if (t === null) return false;
    return t >= startDate.getTime() && t <= endDate.getTime();
  }

  function getFullRange(items): { min: Date; max: Date } {
    if (!items || items.length === 0) return { min: null, max: null };
    const times = items.map(getWebsiteTimeMs).filter((t) => t !== null);
    if (times.length === 0) return { min: null, max: null };
    return {
      min: new Date(Math.min(...times)),
      max: new Date(Math.max(...times)),
    };
  }

  $: fullRange = getFullRange(websites);

  // Reset slider range when burrow/websites change
  $: if (websites.length !== previousWebsitesLength) {
    filteredWebsites = websites;
    searchResults = [];
    searchQuery = "";
    previousWebsitesLength = websites.length;

    // Reset slider to full range for the new dataset
    startDate = fullRange.min;
    endDate = fullRange.max;
  }

  // Compose filters: search + date window
  $: baseList = searchQuery.length < 3 ? filteredWebsites : searchResults;
  $: websitesToDisplay = baseList.filter(isWithinRange);

  $: groupedWebsites = groupByDate(websitesToDisplay);

  $: sembleUrl = (() => {
    const uri = activeBurrow?.sembleCollectionUri;
    if (!uri) return null;
    if (!uri.startsWith("at://")) return null;
    const parts = uri.replace("at://", "").split("/");
    if (parts.length >= 3) {
      const did = parts[0];
      const rkey = parts[parts.length - 1];
      return `https://semble.so/profile/${did}/collections/${rkey}`;
    }
    return null;
  })();

  function openSemble(): void {
    if (sembleUrl) {
      window.open(sembleUrl, "_blank");
    }
  }

  function showTimestamp(ts: number): void {
    hoveredTimestamp = ts;
    isHoveringTimestamp = true;
  }

  function clearTimestamp(): void {
    isHoveringTimestamp = false;
    hoveredTimestamp = null;
  }

  function updateHoverPosition(e: MouseEvent): void {
    hoverX = e.clientX;
    hoverY = e.clientY;
  }

  $: shouldShowBurrows =
    !searchQuery && activeRabbithole && !activeBurrow && !activeTrail;
  $: shouldShowBurrowHome =
    !searchQuery && activeRabbithole && !activeBurrow && !activeTrail;

  async function goBackToRabbithole(): Promise<void> {
    await chrome.runtime.sendMessage({
      type: MessageRequest.CHANGE_ACTIVE_BURROW,
      burrowId: null,
    });
    await chrome.runtime.sendMessage({
      type: MessageRequest.CHANGE_ACTIVE_TRAIL,
      trailId: null,
    });
    dispatch("navigateUp");
  }

  async function handleSelectionDone(e: CustomEvent<any>) {
    const selectedUrls = e.detail.selectedUrls;
    if (selectionMode === "Burrow") {
      const name =
        (await promptName("Burrow name", "New Burrow")) ?? "New Burrow";
      await chrome.runtime.sendMessage({
        type: MessageRequest.CREATE_NEW_BURROW_IN_RABBITHOLE,
        burrowName: name,
        websites: selectedUrls,
      });
      dispatch("navigateUp");
    } else if (selectionMode === "Trail") {
      const name = (await promptName("Trail name", "New Trail")) ?? "New Trail";
      await chrome.runtime.sendMessage({
        type: MessageRequest.CREATE_TRAIL,
        rabbitholeId: activeRabbithole.id,
        name,
        websites: selectedUrls,
      });
      openTrailInEditMode = true;
      trailIsEditing = true;
      await selectTrail(
        await chrome.runtime.sendMessage({
          type: MessageRequest.GET_ACTIVE_TRAIL,
        }).then((t) => t?.id),
      );
    }
    selectionMode = null;
  }

  async function handleSaveTrail(e: CustomEvent<any>) {
    await chrome.runtime.sendMessage({
      type: MessageRequest.UPDATE_TRAIL,
      trailId: activeTrail.id,
      updates: {
        startNote: e.detail.trail.startNote,
        endNote: e.detail.trail.endNote ?? "",
        stops: e.detail.trail.stops,
      },
    });
    openTrailInEditMode = false;
    trailIsEditing = false;
    dispatch("refresh");
  }

  function handleTrailEditToggle() {
    if (trailViewRef) {
      trailViewRef.toggleEdit();
      trailIsEditing = trailViewRef.getIsEditing();
    }
  }

  function handleStartTrail() {
    if (trailViewRef) {
      trailViewRef.startTrail();
    }
  }
</script>

<OrganizeModal
  isOpen={showOrganizeModal}
  on:close={() => (showOrganizeModal = false)}
  on:select={(e) => {
    selectionMode = e.detail.type;
    showOrganizeModal = false;
  }}
/>

<CopyWebsiteModal
  bind:isOpen={showCopyModal}
  mode={copyModalMode}
  websiteUrl={websiteToCopy}
  currentRabbitholeId={activeRabbithole?.id}
  on:added={() => dispatch("refresh")}
/>

<Modal
  isOpen={showPublishModal}
  title={sembleUrl ? "Update on Semble" : "Publish to Semble"}
  on:close={() => (showPublishModal = false)}
>
  <p>
    {sembleUrl
      ? "Update this collection on Semble with the latest changes?"
      : "Publish this rabbithole as a collection on Semble?"} Note that it might take
    a few minutes for your changes to show up.
  </p>

  <div style="margin: 20px 0;">
    <CollapsibleContainer title="What is Semble?" defaultOpen={false}>
      <p><strong>A social knowledge network for researchers.</strong></p>
      <p>
        Follow your peers' research trails. Surface and discover new
        connections. Built on ATProto so you own your data.
      </p>

      <ul style="padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
        <li style="margin-bottom: 8px;">
          <strong>Curate your research trails.</strong> Collect interesting links,
          add notes, and organize them into shareable collections.
        </li>
        <li style="margin-bottom: 8px;">
          <strong>Connect with peers.</strong> See what your peers are sharing and
          find new collaborators with shared interests.
        </li>
        <li>
          <strong>Own your data.</strong> Built on ATProto, new apps will come to
          you. No more rebuilding your social graph and data when apps pivot and shut
          down.
        </li>
      </ul>

      <div style="margin-top: 24px; text-align: center;">
        <a
          href="https://semble.so"
          target="_blank"
          rel="noopener noreferrer"
          class="semble-link"
        >
          Visit Semble.so &rarr;
        </a>
      </div>
    </CollapsibleContainer>
  </div>

  <Group position="right">
    <Button
      variant="subtle"
      color="gray"
      on:click={() => (showPublishModal = false)}>Cancel</Button
    >
    <Button on:click={confirmPublish} loading={isPublishing}>
      {sembleUrl ? "Update" : "Publish"}
    </Button>
  </Group>
</Modal>

<NameInputModal
  bind:isOpen={showNameModal}
  title={nameModalTitle}
  placeholder={nameModalPlaceholder}
  on:confirm={(e) => {
    nameModalResolve?.(e.detail);
    nameModalResolve = null;
  }}
  on:cancel={() => {
    nameModalResolve?.(null);
    nameModalResolve = null;
  }}
/>

<div class="timeline">
  <div class="header-section">
    {#if (activeBurrow || activeTrail) && activeRabbithole}
      <div class="breadcrumb-container">
        <button class="breadcrumb-btn" on:click={goBackToRabbithole}>
          <ChevronLeft />
          <span>{activeRabbithole.title}</span>
        </button>
      </div>
    {/if}

    <div class="title-row">
      {#if activeBurrow}
        <div class="tooltip-wrapper">
          <Tooltip
            label={burrowNameError || "Click to rename burrow"}
            withArrow
            color={burrowNameError ? "red" : "gray"}
            opened={!!burrowNameError || undefined}
          >
            <Input
              id="project-name"
              variant="unstyled"
              size="lg"
              class="project-name-input {burrowNameError ? 'input-error' : ''}"
              bind:value={activeBurrow.name}
              on:blur={renameContainer}
              on:input={() => (burrowNameError = null)}
              on:keydown={(e) => e.key === "Enter" && renameContainer()}
            />
          </Tooltip>
        </div>
      {:else if activeTrail}
        <div class="tooltip-wrapper">
          <Tooltip
            label={burrowNameError || "Click to rename trail"}
            withArrow
            color={burrowNameError ? "red" : "gray"}
            opened={!!burrowNameError || undefined}
          >
            <Input
              id="project-name"
              variant="unstyled"
              size="lg"
              class="project-name-input {burrowNameError ? 'input-error' : ''}"
              bind:value={activeTrail.name}
              on:blur={renameContainer}
              on:input={() => (burrowNameError = null)}
              on:keydown={(e) => e.key === "Enter" && renameContainer()}
            />
          </Tooltip>
        </div>
      {:else if activeRabbithole}
        <div class="tooltip-wrapper">
          <Tooltip
            label={burrowNameError || "Click to rename rabbithole"}
            withArrow
            color={burrowNameError ? "red" : "gray"}
            opened={!!burrowNameError || undefined}
          >
            <Input
              id="project-name"
              variant="unstyled"
              size="lg"
              class="project-name-input {burrowNameError ? 'input-error' : ''}"
              bind:value={activeRabbithole.title}
              on:blur={renameContainer}
              on:input={() => (burrowNameError = null)}
              on:keydown={(e) => e.key === "Enter" && renameContainer()}
            />
          </Tooltip>
        </div>
      {/if}

      {#if sembleUrl}
        <div class="sync-indicator">
          <Tooltip
            label={activeBurrow?.lastSembleSync
              ? `Last synced: ${formatDateTime(
                  activeBurrow.lastSembleSync,
                )}. Click to sync.`
              : "Click to sync"}
            withArrow
          >
            <ActionIcon
              variant="transparent"
              color="orange"
              size="md"
              on:click={syncBurrow}
              loading={isSyncing}
            >
              <Update size={16} />
            </ActionIcon>
          </Tooltip>
        </div>
      {/if}
    </div>

    <ActionBar
      {sembleUrl}
      {isPublishing}
      {isSavingWindow}
      {isUpdatingPinnedWebsites}
      activeBurrowId={activeBurrow?.id}
      activeTrailId={activeTrail?.id}
      activeRabbitholeId={activeRabbithole?.id}
      isDeleting={activeBurrow || activeTrail ? isDeletingContainer : false}
      on:saveWindow={saveWindow}
      on:updatePinnedWebsites={updatePinnedWebsites}
      on:search={handleSearch}
      on:openSemble={openSemble}
      on:publish={openPublishModal}
      on:deleteContainer={deleteContainer}
    />

    {#if activeTrail}
      <div class="trail-action-row">
        <Button size="xs" variant="light" color="blue" on:click={handleStartTrail}>
          Start Trail
        </Button>
        <Button
          size="xs"
          variant={trailIsEditing ? "filled" : "light"}
          on:click={handleTrailEditToggle}
        >
          {trailIsEditing ? "Done" : "Edit"}
        </Button>
      </div>
    {/if}
  </div>

  <div class="feed">
    {#if isLoading}
      <div class="loading-container">
        <Loader size="md" variant="dots" />
        <Text size="sm" color="dimmed" style="margin-top: 1rem;"
          >Loading websites...</Text
        >
      </div>
    {:else if selectionMode}
      <WebsiteSelectGrid
        {websites}
        mode={selectionMode}
        on:done={handleSelectionDone}
        on:cancel={() => (selectionMode = null)}
      />
    {:else if activeTrail}
      <TrailView
        bind:this={trailViewRef}
        trail={activeTrail}
        {websites}
        initialEditMode={openTrailInEditMode}
        on:save={handleSaveTrail}
      />
    {:else}
      {#if shouldShowBurrows}
        <div class="rabbitholes-collapsible">
          <BurrowGrid
            burrows={burrowsInActiveRabbithole}
            trails={trailsInActiveRabbithole}
            selectedBurrowId={activeBurrow?.id}
            selectedTrailId={activeTrail?.id}
            onSelectBurrow={selectBurrow}
            onSelectTrail={selectTrail}
            allowCreate={true}
            on:organize={() => (showOrganizeModal = true)}
            showDelete={false}
          />
        </div>
      {/if}

      {#if shouldShowBurrowHome}
        <PinnedWebsites
          {websites}
          on:websiteUpdate={updateWebsite}
          bind:activeRabbithole
        />
      {/if}

      <div class="view-toggles">
        <Group spacing={4}>
          <ActionIcon
            variant={viewMode === "timeline" ? "filled" : "default"}
            color="blue"
            size="md"
            on:click={() => (viewMode = "timeline")}
            title="Timeline View"
          >
            <ListBullet size={16} />
          </ActionIcon>
          <ActionIcon
            variant={viewMode === "grid" ? "filled" : "default"}
            color="blue"
            size="md"
            on:click={() => (viewMode = "grid")}
            title="Grid View"
          >
            <Grid size={16} />
          </ActionIcon>
        </Group>
      </div>

      {#if viewMode === "timeline"}
        <div class="timeline-feed">
          <div class="timeline-gutter">
            <div class="timeline-line"></div>
          </div>

          <div class="timeline-body">
            {#each groupedWebsites as group (group.key)}
              <div class="date-group">
                <div class="date-header">{group.label}</div>

                <div class="date-cards">
                  {#each group.items as site (site.url)}
                    <div class="timeline-item">
                      <div
                        class="timeline-dot"
                        on:mouseenter={(e) => {
                          updateHoverPosition(e);
                          showTimestamp(getWebsiteTimeMs(site));
                        }}
                        on:mousemove={updateHoverPosition}
                        on:mouseleave={clearTimestamp}
                      ></div>
                      <div
                        class="timeline-connector"
                        on:mouseenter={(e) => {
                          updateHoverPosition(e);
                          showTimestamp(getWebsiteTimeMs(site));
                        }}
                        on:mousemove={updateHoverPosition}
                        on:mouseleave={clearTimestamp}
                      ></div>

                      <div class="timeline-card-wrap">
                        <TimelineCard
                          website={site}
                          on:websiteDelete={deleteWebsite}
                          on:websiteAddToBurrow={openAddToBurrowModal}
                          on:websiteAddToRabbithole={openAddToRabbitholeModal}
                          on:websiteUpdate={updateWebsite}
                        />
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

          {#if isHoveringTimestamp && hoveredTimestamp}
            <div
              class="timeline-tooltip"
              style="left: {hoverX}px; top: {hoverY}px;"
            >
              {formatDateTime(hoveredTimestamp)}
            </div>
          {/if}
        </div>
      {:else}
        <div class="grid-feed">
          {#each gridWebsites as site (site.url)}
            <div class="grid-item">
              <TimelineCard
                website={site}
                fixedHeight={true}
                on:websiteDelete={deleteWebsite}
                on:websiteAddToBurrow={openAddToBurrowModal}
                on:websiteAddToRabbithole={openAddToRabbitholeModal}
                on:websiteUpdate={updateWebsite}
              />
            </div>
          {/each}
          {#if gridWebsites.length === 0}
            <div class="empty-grid">No websites found.</div>
          {/if}
        </div>
      {/if}

      {#if websitesToDisplay.length === 0 && searchQuery.length > 0}
        <Text align="center" color="dimmed" size="sm" style="margin-top: 2rem;"
          >No results found.</Text
        >
      {/if}
    {/if}
  </div>
</div>

<style>
  .timeline {
    width: 100%;
    padding: 32px 16px;
    transition:
      background-color 0.3s ease,
      color 0.3s ease;
  }

  .header-section {
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 32px;
    max-width: 640px;
    position: relative;
  }

  .breadcrumb-container {
    width: 100%;
    display: flex;
    justify-content: flex-start;
    margin-bottom: 6px;
  }

  .breadcrumb-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: #868e96;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    padding: 3px 6px;
    border-radius: 5px;
    transition: all 0.2s;
  }

  .breadcrumb-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #1a1b1e;
  }

  :global(body.dark-mode) .breadcrumb-btn {
    color: #909296;
  }

  :global(body.dark-mode) .breadcrumb-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e7e7e7;
  }

  .title-row {
    width: 100%;
    display: flex;
    text-align: center;
    justify-content: center;
    align-items: center;
    margin-bottom: 6px;
    position: relative;
  }

  .tooltip-wrapper {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .tooltip-wrapper :global(> *) {
    width: 100%;
  }

  .sync-indicator {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
  }

  :global(.project-name-input),
  :global(.project-name-input input) {
    text-align: center !important;
    font-weight: 700;
    font-size: 1.6rem !important;
    height: auto !important;
    padding: 0 !important;
    width: 100% !important;
  }

  :global(.input-error input) {
    color: #fa5252 !important;
  }

  :global(.input-error) {
    border: 1px solid #fa5252 !important;
    border-radius: 4px;
    background-color: rgba(250, 82, 82, 0.1) !important;
  }

  .trail-action-row {
    display: flex;
    gap: 8px;
    justify-content: center;
    margin-top: 8px;
    width: 100%;
  }

  .timeline-feed {
    display: grid;
    grid-template-columns: 14px 1fr;
    gap: 0;
    width: 100%;
    position: relative;
  }

  .timeline-gutter {
    position: relative;
  }

  .timeline-line {
    position: absolute;
    left: 6px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(0, 0, 0, 0.12);
    z-index: 1;
  }

  .timeline-body {
    width: 100%;
  }

  .date-group {
    margin-bottom: 18px;
  }

  .date-header {
    font-size: 10px;
    font-weight: 800;
    color: rgba(0, 0, 0, 0.55);
    letter-spacing: 0.02em;
    margin-bottom: 24px;
    padding-left: 0;
  }

  .date-cards {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .timeline-item {
    position: relative;
    display: grid;
    max-width: 640px;
    align-items: start;
    margin-bottom: 24px;
  }

  .timeline-dot {
    position: absolute;
    left: -14px;
    top: 16px;
    width: 11px;
    height: 11px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.35);
    z-index: 20;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .timeline-dot:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  .timeline-connector {
    position: absolute;
    left: -8px;
    top: 21px;
    width: 60px;
    height: 1px;
    background: rgba(0, 0, 0, 0.12);
    z-index: 2;
  }

  .timeline-card-wrap {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    margin-left: 64px;
  }

  .timeline-tooltip {
    position: fixed;
    transform: translate(12px, -12px);
    background: rgba(20, 21, 23, 0.95);
    color: #f8f9fa;
    font-size: 10px;
    font-weight: 700;
    padding: 6px 8px;
    border-radius: 8px;
    white-space: nowrap;
    z-index: 9999;
    pointer-events: none;
  }

  .timeline-tooltip::after {
    content: "";
    position: absolute;
    left: -6px;
    top: 14px;
    width: 0;
    height: 0;
    border-right: 6px solid rgba(20, 21, 23, 0.95);
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
  }

  .semble-link {
    color: #228be6;
    text-decoration: none;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 3px;
    background-color: rgba(34, 139, 230, 0.1);
    transition: background-color 0.2s;
  }

  .semble-link:hover {
    background-color: rgba(34, 139, 230, 0.2);
  }

  .rabbitholes-collapsible {
    margin-bottom: 24px;
  }

  :global(body.dark-mode .feed) {
    background-color: transparent;
  }

  :global(body.dark-mode .search-bar .mantine-TextInput-input) {
    background-color: #25262b;
    border-color: #373a40;
    color: #c1c2c5;
  }

  :global(body.dark-mode .search-bar .mantine-TextInput-input::placeholder) {
    color: #5c5f66;
  }

  :global(body.dark-mode .loading-container .mantine-Text-root) {
    color: #c1c2c5;
  }

  :global(body.dark-mode) .timeline-line {
    background: rgba(255, 255, 255, 0.14);
  }

  :global(body.dark-mode) .timeline-dot {
    background: rgba(255, 255, 255, 0.35);
  }

  :global(body.dark-mode) .timeline-connector {
    background: rgba(255, 255, 255, 0.14);
  }

  :global(body.dark-mode) .date-header {
    color: rgba(255, 255, 255, 0.55);
  }

  :global(body.dark-mode) .timeline-tooltip {
    background: rgba(231, 231, 231, 0.95);
    color: #141517;
  }

  :global(body.dark-mode) .timeline-tooltip::after {
    border-right-color: rgba(231, 231, 231, 0.95);
  }

  @media (max-width: 640px) {
    .timeline-feed {
      grid-template-columns: 11px 1fr;
    }

    .timeline-line {
      left: 5px;
    }

    .timeline-dot {
      left: -13px;
      top: 13px;
    }

    .timeline-connector {
      left: -6px;
      top: 18px;
      width: 60px;
    }

    .timeline-card-wrap {
      margin-left: 64px;
    }
  }

  .view-toggles {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 13px;
    padding: 0 3px;
  }

  .grid-feed {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(224px, 1fr));
    gap: 16px;
    width: 100%;
    padding-bottom: 32px;
  }

  .grid-item {
    height: 100%;
  }

  .empty-grid {
    grid-column: 1 / -1;
    text-align: center;
    color: #868e96;
    padding: 32px;
  }

  :global(body.dark-mode) .empty-grid {
    color: #909296;
  }
</style>
