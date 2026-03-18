<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { handleCallback } from "$lib/atproto/client";
  import { goto } from "$app/navigation";

  let status = "Completing sign in...";
  let error: string | null = null;

  onMount(async () => {
    if (!browser) return;
    try {
      const params = new URLSearchParams(window.location.search);
      await handleCallback(params);
      status = "Signed in! Redirecting...";
      setTimeout(() => goto("/home"), 500);
    } catch (e: any) {
      error = e.message;
      status = "";
    }
  });
</script>

<main style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;">
  {#if error}
    <div style="text-align:center;">
      <p style="color:#dc3545;">{error}</p>
      <a href="/" style="color:#1185fe;">Go home</a>
    </div>
  {:else}
    <p style="color:#495057;">{status}</p>
  {/if}
</main>
