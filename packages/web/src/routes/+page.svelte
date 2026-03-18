<script>
  import * as animateScroll from 'svelte-scrollto';
  import { fade } from 'svelte/transition';
  import Home from '$lib/Home.svelte';
  import Footer from '$lib/Footer.svelte';
  import Header from '$lib/Header.svelte';
</script>

<div>
  <div class="absolute inset-0 px-6 flex flex-col h-screen overflor-auto">
    <Header />
      <div
        in:fade
        class="flex-grow max-w-4xl mx-auto w-full md:pt-20  flex flex-col items-center justify-center"
        >
        <Home />
      </div>
      <Footer />
  </div>
</div>
