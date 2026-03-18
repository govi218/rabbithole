<script>
	import '../app.css';
	import { dev } from '$app/environment';
	import { inject } from '@vercel/analytics';
	import { page } from '$app/stores';

	inject({ mode: dev ? 'development' : 'production' });
</script>

<nav class="nav">
	<a href="/" class="nav-logo">Rabbithole</a>
	<div class="nav-links">
		<a href="/explore" class="nav-link" class:active={$page.url.pathname === '/explore'}>Explore</a>
		<a href="/home" class="nav-link" class:active={$page.url.pathname === '/home'}>My Rabbitholes</a>
	</div>
</nav>

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
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
		height: 56px;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid #f0f0f0;
	}

	.nav-logo {
		font-size: 16px;
		font-weight: 700;
		color: #1a1b1e;
		text-decoration: none;
		letter-spacing: -0.3px;
	}

	.nav-links {
		display: flex;
		gap: 4px;
	}

	.nav-link {
		padding: 6px 12px;
		font-size: 14px;
		color: #495057;
		text-decoration: none;
		border-radius: 6px;
		transition: background 0.15s, color 0.15s;
	}

	.nav-link:hover {
		background: #f8f9fa;
		color: #1a1b1e;
	}

	.nav-link.active {
		color: #1185fe;
		font-weight: 500;
	}
</style>
