<script>
  import { fade } from "svelte/transition";
  import { onMount } from "svelte";
  import Home from "$lib/Home.svelte";
  import Footer from "$lib/Footer.svelte";

  const faqs = [
    {
      q: "What browsers are supported?",
      a: "Any Chromium-based browser: Chrome, Brave, Arc, Edge, and Opera. Firefox support is not available yet.",
    },
    {
      q: "Where is my data stored?",
      a: "Everything stays in your browser's local storage by default. When you sign in with your ATProto/Bluesky account and publish, your trails and burrows are stored on your personal data server (PDS) — meaning you own them, not us.",
    },
    {
      q: "Do I need a Bluesky account?",
      a: "No. The extension works fully offline and locally without any account. Signing in with an ATProto handle is optional — it lets you publish trails, access them on the web, and share them with others.",
    },
    {
      q: "What is a trail?",
      a: "A trail is an ordered list of URLs — a path through the web you want to remember or share. You can walk a trail later, following each stop in sequence.",
    },
    {
      q: "What is a burrow?",
      a: "A burrow is an unordered collection of saved URLs, like a bookmark folder. Great for grouping related links without a specific sequence.",
    },
    {
      q: "Is Rabbithole free?",
      a: "Yes, completely free and open source. The code is available on GitHub.",
    },
    {
      q: "Does the extension track my browsing?",
      a: "No. Rabbithole only reads URLs you explicitly interact with — it does not run in the background or passively monitor your browsing history.",
    },
    {
      q: "Can I self-host my data?",
      a: "Yes. If you run your own ATProto PDS, Rabbithole will store your data there. Your data follows your account, not this website.",
    },
  ];

  let openIndex = null;
  let canvas;

  function toggle(i) {
    openIndex = openIndex === i ? null : i;
  }

  onMount(() => {
    const ctx = canvas.getContext("2d");
    let raf;
    let holes = [];
    const MAX_HOLES = 6;

    function spawnHole(ts) {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        startTime: ts,
        duration: 8000 + Math.random() * 6000,
        maxRadius: 180 + Math.random() * 220,
        ringCount: 14,
        spinDir: Math.random() < 0.5 ? 1 : -1,
        tilt: 0.35 + Math.random() * 0.3, // y-scale for perspective (0.35–0.65)
      };
    }

    function draw(ts) {
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      if (holes.length < MAX_HOLES && Math.random() < 0.012) {
        holes.push(spawnHole(ts));
      }

      for (let i = holes.length - 1; i >= 0; i--) {
        const hole = holes[i];
        const holeProgress = (ts - hole.startTime) / hole.duration;

        if (holeProgress >= 1) {
          holes.splice(i, 1);
          continue;
        }

        let holeAlpha = 1;
        if (holeProgress < 0.15) holeAlpha = holeProgress / 0.15;
        else if (holeProgress > 0.75) holeAlpha = (1 - holeProgress) / 0.25;

        const ringCycle = 2200;

        ctx.save();
        ctx.translate(hole.x, hole.y);
        ctx.scale(1, hole.tilt); // perspective squish

        // Dark void at center
        const voidGrad = ctx.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          hole.maxRadius * 0.45,
        );
        voidGrad.addColorStop(0, `rgba(0,0,0,${holeAlpha * 0.95})`);
        voidGrad.addColorStop(0.6, `rgba(0,0,0,${holeAlpha * 0.5})`);
        voidGrad.addColorStop(1, `rgba(0,0,0,0)`);
        ctx.beginPath();
        ctx.arc(0, 0, hole.maxRadius * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = voidGrad;
        ctx.fill();

        // Inner glow — bright core light
        const glowGrad = ctx.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          hole.maxRadius * 0.18,
        );
        glowGrad.addColorStop(0, `rgba(160, 220, 255, ${holeAlpha * 0.35})`);
        glowGrad.addColorStop(1, `rgba(77, 171, 247, 0)`);
        ctx.beginPath();
        ctx.arc(0, 0, hole.maxRadius * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // Rings
        for (let j = 0; j < hole.ringCount; j++) {
          const offset = (j / hole.ringCount) * ringCycle;
          const ringT = (ts - hole.startTime + offset) % ringCycle;
          const ringProgress = ringT / ringCycle;

          // Ease-out so rings slow as they expand (depth illusion)
          const r = Math.pow(ringProgress, 0.6) * hole.maxRadius;

          let ringAlpha;
          if (ringProgress < 0.12) ringAlpha = ringProgress / 0.12;
          else if (ringProgress < 0.65) ringAlpha = 1;
          else ringAlpha = 1 - (ringProgress - 0.65) / 0.35;

          // Inner rings brighter/cyan, outer rings deeper blue
          const cyan = Math.round(180 + (1 - ringProgress) * 75); // 180–255
          const blue = 247;
          const green = Math.round(171 + (1 - ringProgress) * 60); // 171–231

          const finalAlpha = holeAlpha * ringAlpha * 0.65;
          const lineW = ringProgress < 0.08 ? 1.5 : 1;

          // Spinning dash offset — gives it a swirl
          const dashOffset = hole.spinDir * ts * 0.04 + j * 8;

          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${cyan}, ${green}, ${blue}, ${finalAlpha})`;
          ctx.lineWidth = lineW;
          ctx.setLineDash([5, 10]);
          ctx.lineDashOffset = dashOffset;
          ctx.stroke();
        }

        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  });
</script>

<canvas bind:this={canvas} class="bg-canvas"></canvas>
<div class="bg-overlay"></div>

<div class="relative px-6 flex flex-col z-10">
  <div
    in:fade
    class="h-screen max-w-4xl mx-auto w-full flex flex-col items-center justify-center"
  >
    <Home />
  </div>

  <section class="max-w-4xl mx-auto w-full mt-32 mb-16">
    <h2 class="faq-heading">Frequently asked questions</h2>
    <div class="faq-list">
      {#each faqs as faq, i}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div
          class="faq-item"
          class:open={openIndex === i}
          on:click={() => toggle(i)}
        >
          <div class="faq-question">
            <span>{faq.q}</span>
            <span class="faq-chevron" class:rotated={openIndex === i}>›</span>
          </div>
          {#if openIndex === i}
            <p class="faq-answer" in:fade={{ duration: 120 }}>{faq.a}</p>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <Footer />
</div>

<style>
  .bg-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 0;
    background: #0a0a0a;
    pointer-events: none;
    display: block;
  }

  .bg-overlay {
    position: fixed;
    inset: 0;
    z-index: 1;
    background: radial-gradient(circle at center, transparent 0%, #0a0a0a 80%);
    pointer-events: none;
  }

  .faq-heading {
    font-size: 1.5rem;
    font-weight: 800;
    color: #e7e7e7;
    margin: 0 0 24px;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .faq-item {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 18px 20px;
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .faq-item:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .faq-item.open {
    background: rgba(77, 171, 247, 0.05);
    border-color: rgba(77, 171, 247, 0.2);
  }

  .faq-question {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-size: 15px;
    font-weight: 600;
    color: #c1c2c5;
    user-select: none;
  }

  .faq-item.open .faq-question {
    color: #e7e7e7;
  }

  .faq-chevron {
    font-size: 20px;
    color: #5c5f66;
    transition: transform 0.2s;
    flex-shrink: 0;
    line-height: 1;
  }

  .faq-chevron.rotated {
    transform: rotate(90deg);
    color: #4dabf7;
  }

  .faq-answer {
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 1.7;
    color: #909296;
  }
</style>
