<script>
  import GitHubButton from './GitHubButton.svelte';
</script>

<div
  class="max-w-4xl mx-auto w-full flex md:flex-row flex-col items-center md:justify-between py-8 mt-20 border-t border-white/20"
  >
  <div class="text-white/70 flex items-center flex-none">
    Powered by <a href="https://github.com/dataxresearch"><span class="mx-1 font-bold"> DataX Research</span></a>
  </div>
  <div class="text-white/70 flex items-center flex-none">
    <a href="/privacy.html"><span class="mx-1 font-bold">Privacy policy</span></a>
  </div>
  <div class="flex items-center mt-2 md:mt-0">
    <GitHubButton />
  </div>
</div>
