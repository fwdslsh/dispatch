<div class="vhs">
	<div class="noise"></div>
	<div class="scanlines"></div>
	<div class="tracking line-1"></div>
	<div class="tracking line-2"></div>
	<div class="tracking line-3"></div>
	<div class="glitchbar"></div>
</div>

<!-- SVG filter (not colorized; uses opacities above) -->
<svg width="0" height="0" style="position:absolute">
	<filter id="noise">
		<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2">
			<animate attributeName="seed" dur="1.3s" values="2;23;77;5;2" repeatCount="indefinite" />
			<animate
				attributeName="baseFrequency"
				dur="2s"
				values=".9;.6;.8;.95;.9"
				repeatCount="indefinite"
			/>
		</feTurbulence>
		<feColorMatrix type="saturate" values="0" />
	</filter>
</svg>

<style>
	:root {
		/* ---- sizing ---- */
		--w: 100vw;
		--h: 100vh;

		/** ---- Duration ---- */
		--speed: 5s;

		/* ---- backdrop palette ---- */
		--bg-1: #0c0f1a; /* inner glow */
		--bg-2: #07070b; /* mid */
		--bg-3: #000000; /* outer */

		/* ---- RGB fringe colors ---- */
		--fringe-cyan: var(--primary, rgba(0, 255, 255, 0.6));
		--fringe-magenta: rgba(255, 0, 255, 0.5);

		/* ---- scanlines ---- */
		--scanline-light: rgba(255, 255, 255, 0.035);
		--scanline-dark: rgba(0, 0, 0, 0.06);

		/* ---- tracking bar gradient ---- */
		--track-c1: var(--theme-cursor, #00a0ff);
		--track-c2: var(--theme-cursor, #c0c0ff);
		--track-c3: var(--theme-cursor, #ffffff);
		--track-c4: var(--theme-cursor, #ff00aa);

		/* ---- glitch bar ---- */
		--glitch-left: var(--theme-cursor, rgba(160, 160, 255, 0.4));
		--glitch-right: var(--theme-foreground, rgba(255, 120, 220, 0.45));

		/* ---- layer strengths (opacities) ---- */
		--noise-opacity: 0.75;
		--scanlines-opacity: 0.8; /* baseline; flicker anim varies it */
		--tracking-opacity: 0.25;
		--glitchbar-opacity: 0.95;

		/* ---- global post look ---- */
		--contrast: 1.3;
		--saturation: 1.1;
	}
	/* 
	html,
	body {
		height: 100%;
		background: #000;
		margin: 0;
		display: grid;
		place-items: center;
	} */

	.vhs {
		position: absolute;
		inset: 0;
		width: var(--w);
		height: var(--h);
		background: radial-gradient(
			120% 80% at 50% 50%,
			var(--bg-1) 0%,
			var(--bg-2) 40%,
			var(--bg-3) 100%
		);
		background: radial-gradient(
			120% 80% at 50% 50%,
			var(--theme-background) 0%,
			var(--theme-background) 40%,
			var(--theme-background) 100%
		);
		overflow: hidden;
		filter: contrast(var(--contrast)) saturate(var(--saturation));
	}

	/* chroma fringe */
	.vhs::before,
	.vhs::after {
		content: '';
		position: absolute;
		inset: -2% -4%;
		background: inherit;
		mix-blend-mode: screen;
		filter: blur(0.8px);
		animation: jitter 5.7s steps(2, end) infinite;
	}
	.vhs::before {
		transform: translateX(-1px);
		box-shadow: 0 0 0 9999px var(--fringe-cyan) inset;
		opacity: 0.35;
	}
	.vhs::after {
		transform: translateX(1px);
		box-shadow: 0 0 0 9999px var(--fringe-magenta) inset;
		opacity: 0.35;
	}

	/* noise layer */
	.noise {
		position: absolute;
		inset: -10%;
		filter: url(#noise);
		opacity: var(--noise-opacity);
		animation: drift calc(var(--speed) * 3) linear infinite;
		pointer-events: none;
	}

	/* scanlines */
	.scanlines {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			to bottom,
			var(--scanline-light) 0 1px,
			var(--scanline-dark) 1px 2px
		);
		mix-blend-mode: overlay;
		opacity: var(--scanlines-opacity);
		animation: flicker calc(var(--speed) * 0.6) steps(6, end) infinite;
		pointer-events: none;
	}

	/* tracking bar */
	.tracking {
		position: absolute;
		left: -10%;
		right: -10%;
		height: 2px;
		top: -5%;
		background: linear-gradient(
			90deg,
			var(--track-c1) 0%,
			var(--track-c2) 45%,
			var(--track-c3) 50%,
			var(--track-c2) 55%,
			var(--track-c4) 100%
		);
		box-shadow:
			0 0 10px var(--track-c2),
			0 0 2px var(--track-c3) inset;
		opacity: var(--tracking-opacity);
		animation: track calc(var(--speed) * 1.15) cubic-bezier(0.2, 0.7, 0.2, 1) infinite;
		pointer-events: none;
		animation-delay: 1s;
	}

	.tracking.line-1 {
		animation-delay: calc(var(--speed) * 1.45);
		background: linear-gradient(
			90deg,
			var(--theme-foreground) 0%,
			var(--theme-foreground) 45%,
			var(--theme-foreground) 50%,
			var(--theme-foreground) 55%,
			var(--theme-foreground) 100%
		);
	}
	.tracking.line-2 {
		animation-delay: calc(var(--speed) * 1.25);
		background: var(--theme-cyan);
	}

	/* glitch bar */
	.glitchbar {
		position: absolute;
		left: -5%;
		right: -5%;
		height: 8px;
		background: linear-gradient(
			90deg,
			#0000 0 10%,
			var(--glitch-left) 10% 45%,
			var(--glitch-right) 45% 80%,
			#0000 80% 100%
		);
		mix-blend-mode: screen;
		opacity: var(--glitchbar-opacity);
		animation: bar calc(var(--speed) * 0.9) steps(6, end) infinite;
		filter: blur(0.3px);
		pointer-events: none;
		display: none;
	}

	/* keyframes */
	@keyframes jitter {
		0%,
		100% {
			transform: translate(0, 0);
		}
		50% {
			transform: translateX(1px);
		}
	}
	@keyframes drift {
		0% {
			transform: translate(0, 0) scale(1.02);
		}
		100% {
			transform: translate(-2%, 1%) scale(1.02);
		}
	}
	@keyframes flicker {
		0%,
		100% {
			opacity: var(--scanlines-opacity);
		}
		50% {
			opacity: calc(var(--scanlines-opacity) + 0.11);
		}
	}
	@keyframes track {
		0% {
			top: -8%;
			opacity: 0;
		}
		6% {
			opacity: var(--tracking-opacity);
		}
		50% {
			opacity: var(--tracking-opacity);
			top: 125%;
		}
		60% {
			top: 125%;
			opacity: 0;
		}
		100% {
			top: -8%;
			opacity: 0;
		}
	}
	@keyframes bar {
		0% {
			top: -12%;
			transform: translateX(-1%);
		}
		20% {
			top: 33%;
			transform: translateX(2%);
		}
		40% {
			top: 58%;
			transform: translateX(-2%);
		}
		60% {
			top: 71%;
			transform: translateX(1%);
		}
		80% {
			top: 86%;
			transform: translateX(-3%);
		}
		100% {
			top: 100%;
			transform: translateX(-1%);
		}
	}
</style>
