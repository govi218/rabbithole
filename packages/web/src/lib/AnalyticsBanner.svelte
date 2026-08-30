<script>
  import { setConsent } from "$lib/posthog";

  export let onDismiss = () => {};

  function accept() {
    setConsent(true);
    onDismiss();
  }

  function decline() {
    setConsent(false);
    onDismiss();
  }
</script>

<div class="analytics-banner">
  <div class="banner-content">
    <p class="banner-text">
      We collect anonymous usage data to improve Rabbithole. No personal info, ever.
      <a href="https://rabbithole.land/privacy" class="banner-link">Learn more</a>
    </p>
    <div class="banner-actions">
      <button class="btn-decline" on:click={decline}>Decline</button>
      <button class="btn-accept" on:click={accept}>Accept</button>
    </div>
  </div>
</div>

<style>
  .analytics-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    background: #1a1b1e;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .banner-content {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .banner-text {
    font-size: 13px;
    color: #909296;
    line-height: 1.5;
    margin: 0;
  }

  .banner-link {
    color: #4dabf7;
    text-decoration: none;
  }

  .banner-link:hover {
    text-decoration: underline;
  }

  .banner-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-decline {
    padding: 7px 14px;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #909296;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-decline:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #c1c2c5;
  }

  .btn-accept {
    padding: 7px 14px;
    background: rgba(77, 171, 247, 0.15);
    border: 1px solid rgba(77, 171, 247, 0.3);
    border-radius: 6px;
    color: #4dabf7;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s;
  }

  .btn-accept:hover {
    background: rgba(77, 171, 247, 0.25);
    border-color: rgba(77, 171, 247, 0.5);
  }

  @media (max-width: 640px) {
    .banner-content {
      flex-direction: column;
      align-items: flex-start;
      padding: 14px 16px;
    }
    .banner-actions {
      width: 100%;
    }
    .btn-decline,
    .btn-accept {
      flex: 1;
      text-align: center;
    }
  }
</style>
