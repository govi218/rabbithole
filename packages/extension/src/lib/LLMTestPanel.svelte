<script lang="ts">
  import type { CloudProviderId, CloudProviderConfig } from "src/llm/cloud";
  import { CloudProviders } from "src/llm/cloud";
  import { MessageRequest } from "src/utils/types";

  const providerEntries = Object.entries(CloudProviders) as [
    CloudProviderId,
    (typeof CloudProviders)[CloudProviderId],
  ][];

  let selectedProvider = "";
  let apiKey = "";
  let modelOverride = "";
  let output = "";
  let outputColor = "#aaa";
  let showOutput = false;
  let btnText = "Categorise";

  function modelPlaceholder() {
    if (!selectedProvider) return "Model (optional override)";
    const p = CloudProviders[selectedProvider as CloudProviderId];
    return p ? `Model (default: ${p.model})` : "Model (optional override)";
  }

  async function loadSettings() {
    const saved = await chrome.storage.local.get([
      "cloudProvider",
      "cloudApiKey",
      "cloudModel",
    ]);
    if (saved.cloudProvider) selectedProvider = saved.cloudProvider;
    if (saved.cloudApiKey) apiKey = saved.cloudApiKey;
    if (saved.cloudModel) modelOverride = saved.cloudModel;
  }

  loadSettings();

  function onProviderChange() {
    chrome.storage.local.set({ cloudProvider: selectedProvider });
  }
  function onKeyChange() {
    chrome.storage.local.set({ cloudApiKey: apiKey });
  }
  function onModelChange() {
    chrome.storage.local.set({ cloudModel: modelOverride });
  }

  async function categorise() {
    const t0 = performance.now();
    btnText = "Running...";
    showOutput = true;
    output = "";
    outputColor = "#aaa";

    let cloudConfig: CloudProviderConfig | undefined;
    if (selectedProvider && apiKey) {
      cloudConfig = {
        apiKey,
        providerId: selectedProvider as CloudProviderId,
        model: modelOverride || undefined,
      };
    }

    try {
      const result = await chrome.runtime.sendMessage({
        type: MessageRequest.PROPOSE_CATEGORISE,
        cloudConfig,
      });

      if (result?.error) {
        outputColor = "#f87171";
        output = result.error;
        btnText = "Categorise";
        return;
      }

      const totalMs = Math.round(performance.now() - t0);
      const { assignments, newRabbitholes, misc } = result;

      let display = "";

      if (assignments?.length > 0) {
        display += "Existing rabbithole assignments:\n";
        for (const a of assignments) {
          display += `  ▸ ${a.rabbitholeId}: ${a.tabIndices.join(", ")}\n`;
        }
        display += "\n";
      }

      if (newRabbitholes?.length > 0) {
        display += "New rabbitholes:\n";
        for (const rh of newRabbitholes) {
          display += `  ▸ ${rh.topic}\n    ${rh.description}\n    tabs: ${rh.tabIndices.join(", ")}\n\n`;
        }
      }

      if (misc?.length > 0) {
        display += `Misc (unassigned): ${misc.join(", ")}\n`;
      }

      display += `\n— ${assignments?.length ?? 0} assignments, ${newRabbitholes?.length ?? 0} new, ${misc?.length ?? 0} misc | ${totalMs}ms`;

      outputColor = "#4ade80";
      output = display;
      btnText = "Categorise";
    } catch (e) {
      const totalMs = Math.round(performance.now() - t0);
      outputColor = "#f87171";
      output = `${e instanceof Error ? e.message : "error"} (${totalMs}ms)`;
      btnText = "Categorise";
    }
  }
</script>

<div class="panel">
  <div class="label">AI Test</div>

  <select
    bind:value={selectedProvider}
    on:change={onProviderChange}
    class="input"
  >
    <option value="">No cloud (use on-device)</option>
    {#each providerEntries as [id, p]}
      <option value={id}>{p.label}</option>
    {/each}
  </select>

  <input
    type="password"
    bind:value={apiKey}
    on:change={onKeyChange}
    placeholder="API key"
    class="input"
  />

  <input
    type="text"
    bind:value={modelOverride}
    on:change={onModelChange}
    placeholder={modelPlaceholder()}
    class="input"
  />

  {#if showOutput}
    <div class="output" style="color: {outputColor}">{output}</div>
  {/if}

  <button on:click={categorise} class="btn">{btnText}</button>
</div>

<style>
  .panel {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: #1a1a2e;
    border: 1px solid #333;
    border-radius: 12px;
    font-size: 14px;
    color: #fff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    width: 320px;
  }

  .label {
    font-weight: 600;
    font-size: 13px;
    color: #999;
  }

  .input {
    padding: 6px 10px;
    background: #0d0d1a;
    border: 1px solid #444;
    border-radius: 6px;
    color: #fff;
    font-size: 13px;
    outline: none;
  }

  .output {
    padding: 8px 10px;
    background: #0d0d1a;
    border: 1px solid #333;
    border-radius: 6px;
    font-size: 12px;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .btn {
    padding: 8px 16px;
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
  }
</style>
