<script>
  import "../app.css";
  import { dev } from "$app/environment";
  import { inject } from "@vercel/analytics";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { Agent } from "@atproto/api";
  import { getSession, clearSession } from "$lib/atproto/client";
  import logo from "$lib/assets/logo.png";

  inject({ mode: dev ? "development" : "production" });

  let scrolled = false;
  let session = null;
  let userAvatar = "";
  let userHandle = "";
  let showUserMenu = false;

  onMount(() => {
    const onScroll = () => {
      scrolled = window.scrollY > 10;
    };
    // Web app is always dark mode
    document.body.classList.add("dark-mode");
    window.addEventListener("scroll", onScroll, { passive: true });

    session = getSession();
    if (session) loadProfile(session);

    return () => window.removeEventListener("scroll", onScroll);
  });

  async function loadProfile(s) {
    try {
      const agent = new Agent("https://public.api.bsky.app");
      const res = await agent.getProfile({ actor: s.did });
      if (res.success) {
        userAvatar = res.data.avatar || "";
        userHandle = res.data.handle || s.handle || "";
      }
    } catch {}
  }

  function signOut() {
    clearSession();
    session = null;
    userAvatar = "";
    userHandle = "";
    showUserMenu = false;
    window.location.href = "/";
  }

  function handleMenuKeydown(e) {
    if (e.key === "Escape") showUserMenu = false;
  }
</script>

<svelte:window on:keydown={handleMenuKeydown} />

<header class="nav" class:scrolled>
  <div class="nav-inner">
    <a href="/" class="nav-logo">
      <img src={logo} alt="Rabbithole" class="nav-logo-img" />
      Rabbithole
    </a>
    <nav class="nav-links">
      <a
        href="/explore"
        class="nav-link"
        class:active={$page.url.pathname === "/explore"}>Explore</a
      >
      <a
        href="/home"
        class="nav-link"
        class:active={$page.url.pathname === "/home"}>My Rabbitholes</a
      >
    </nav>

    {#if session}
      <div class="avatar-wrap">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <button
          class="avatar-btn"
          on:click={() => (showUserMenu = !showUserMenu)}
          title={userHandle}
        >
          {#if userAvatar}
            <img src={userAvatar} alt={userHandle} class="avatar-img" />
          {:else}
            <div class="avatar-placeholder">
              {userHandle?.[0]?.toUpperCase() ?? "?"}
            </div>
          {/if}
        </button>

        {#if showUserMenu}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div
            class="user-menu-overlay"
            on:click={() => (showUserMenu = false)}
          />
          <div class="user-menu">
            <div class="user-menu-header">
              {#if userAvatar}
                <img src={userAvatar} alt={userHandle} class="menu-avatar" />
              {:else}
                <div class="menu-avatar-placeholder">
                  {userHandle?.[0]?.toUpperCase() ?? "?"}
                </div>
              {/if}
              <div class="menu-handle-wrap">
                <span class="menu-handle">@{userHandle}</span>
              </div>
            </div>
            <div class="user-menu-divider" />
            <button class="menu-item menu-item-danger" on:click={signOut}
              >Sign out</button
            >
          </div>
        {/if}
      </div>
    {:else}
      <a href="/home" class="nav-signin">Sign in</a>
    {/if}
  </div>
</header>

<div class="min-h-screen w-full">
  <slot />
</div>

<style>
  .nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 20px 0;
    transition:
      background 0.3s ease,
      padding 0.3s ease,
      box-shadow 0.3s ease,
      border-color 0.3s ease;
  }

  .nav.scrolled {
    background: rgba(10, 10, 10, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding: 12px 0;
    box-shadow: 0 1px 24px rgba(0, 0, 0, 0.4);
  }

  .nav-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nav-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 17px;
    font-weight: 700;
    color: #fff;
    text-decoration: none;
    letter-spacing: -0.3px;
    flex-shrink: 0;
    margin-right: 8px;
  }

  .nav-logo-img {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    object-fit: cover;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .nav-link {
    padding: 6px 14px;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.55);
    text-decoration: none;
    border-radius: 6px;
    transition:
      color 0.15s,
      background 0.15s;
  }

  .nav-link:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
  }
  .nav-link.active {
    color: #fff;
  }

  .nav-signin {
    flex-shrink: 0;
    padding: 7px 16px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition:
      background 0.15s,
      border-color 0.15s;
  }

  .nav-signin:hover {
    background: rgba(255, 255, 255, 0.13);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  /* Avatar */
  .avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .avatar-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.15);
    padding: 0;
    cursor: pointer;
    overflow: hidden;
    background: #25262b;
    transition: border-color 0.15s;
  }

  .avatar-btn:hover {
    border-color: #4dabf7;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #4dabf7;
    background: rgba(77, 171, 247, 0.12);
  }

  /* User menu */
  .user-menu-overlay {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .user-menu {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    min-width: 200px;
    background: #1a1b1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    z-index: 100;
    overflow: hidden;
    animation: menuIn 0.15s ease-out;
  }

  @keyframes menuIn {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .user-menu-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
  }

  .menu-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .menu-avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(77, 171, 247, 0.12);
    color: #4dabf7;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .menu-handle-wrap {
    min-width: 0;
  }

  .menu-handle {
    font-size: 13px;
    font-weight: 600;
    color: #c1c2c5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }

  .user-menu-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.07);
    margin: 0;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 11px 16px;
    background: none;
    border: none;
    text-align: left;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s;
  }

  .menu-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .menu-item-danger {
    color: #ff6b6b;
  }
  .menu-item-danger:hover {
    background: rgba(255, 107, 107, 0.08);
  }

  @media (max-width: 640px) {
    .nav {
      padding: 14px 0;
    }
    .nav.scrolled {
      padding: 10px 0;
    }
    .nav-inner {
      padding: 0 16px;
    }
  }
</style>
