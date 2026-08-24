<script lang="ts">
	import {
		Rocket,
		Map,
		Star,
		Compass,
		Info,
		Download,
		Share,
		PlusSquare,
		X,
		ArrowDown,
		Shield,
		User,
	} from "lucide-svelte";
	import InteractiveBackground from "$lib/components/InteractiveBackground.svelte";
	import { Button } from "$lib/components/ui/button";
	import { browser } from "$app/environment";
	import { onMount } from "svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
	let deferredPrompt = $state<any>(null);
	let isIOS = $state(false);
	let showIOSInstructions = $state(false);
	let isInstalled = $state(false);

	onMount(() => {
		if (browser) {
			// Platform Detection
			isIOS =
				/iPad|iPhone|iPod/.test(navigator.userAgent) &&
				!(window as any).MSStream;

			// Check if already installed
			if (
				(window.navigator as any).standalone ||
				window.matchMedia("(display-mode: standalone)").matches
			) {
				isInstalled = true;
			}

			// Capture PWA prompt
			window.addEventListener("beforeinstallprompt", (e) => {
				e.preventDefault();
				deferredPrompt = e;
			});

			window.addEventListener("appinstalled", () => {
				isInstalled = true;
				deferredPrompt = null;
			});
		}
	});

	async function handleInstall(fallbackUrl = "/game") {
		if (isIOS) {
			showIOSInstructions = true;
		} else if (deferredPrompt) {
			deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === "accepted") {
				deferredPrompt = null;
			}
		} else {
			// Fallback if no prompt but not iOS
			window.location.href = fallbackUrl;
		}
	}
</script>

<main
	class="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-fuchsia-500/30"
>
	<!-- Dynamic Background -->
	<InteractiveBackground />

	<!-- Top Gradient/Glow overlay for better text readability if needed, but keeping it subtle -->
	<div
		class="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-950/50 via-transparent to-slate-950/80"
	></div>

	<!-- Header and quick access navigation -->
	<header class="relative z-20 px-4 pt-4 sm:px-6 sm:pt-6">
		<div class="mx-auto flex max-w-7xl items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-2.5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-3">
			<div class="flex min-w-0 items-center gap-2 sm:gap-3">
				<img
					src="/mini-icon-plv-white.png"
					alt="Pro Loco Venticano"
					class="h-10 w-auto drop-shadow-lg sm:h-12"
				/>
				<div class="h-8 w-px bg-white/10 sm:h-10"></div>
				<img
					src="/paaa-logo.png"
					alt="Comitato Per Aspera ad Astra"
					class="h-10 w-auto min-w-0 drop-shadow-lg sm:h-12"
				/>
			</div>

			<nav class="ml-auto flex shrink-0 items-center gap-2" aria-label="Accesso rapido">
				<a
					href="/login?role=player"
					class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 text-xs font-bold text-fuchsia-100 transition-all hover:border-fuchsia-300/40 hover:bg-fuchsia-500/20 active:scale-95 sm:px-4 sm:text-sm"
				>
					<User class="h-4 w-4" />
					<span><span class="hidden sm:inline">Login </span>Giocatori</span>
				</a>
				<a
					href="/login?role=admin"
					class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-slate-950 transition-all hover:bg-sky-100 active:scale-95 sm:px-4 sm:text-sm"
				>
					<Shield class="h-4 w-4 text-sky-700" />
					<span>Staff<span class="hidden sm:inline"> / Admin</span></span>
				</a>
			</nav>
		</div>
	</header>

	<div class="relative mx-auto max-w-7xl px-6 py-12 sm:py-20 z-10">
		<!-- Hero Section -->
		<section class="mx-auto max-w-4xl text-center mb-20 animate-fade-in-up">
			<div
				class="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-sm shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:border-white/20 transition-colors"
			>
				<Star class="h-3.5 w-3.5 text-yellow-200" />
				<span class="tracking-wider uppercase text-[10px] sm:text-xs"
					>Pro Loco Venticanese</span
				>
			</div>

			<h1
				class="text-balance text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl drop-shadow-2xl"
			>
				<span
					class="bg-linear-to-r from-violet-200 via-white to-fuchsia-200 bg-clip-text text-transparent"
				>
					Per Aspera
				</span>
				<br class="hidden sm:block" />
				<span
					class="bg-linear-to-r from-fuchsia-200 via-sky-200 to-indigo-200 bg-clip-text text-transparent"
				>
					ad Astra
				</span>
			</h1>

			<p
				class="mt-8 text-pretty text-lg leading-relaxed text-slate-300 sm:text-xl max-w-2xl mx-auto"
			>
				L'anima creativa della <span class="text-white font-semibold"
					>Pro Loco Venticanese</span
				>. Trasformiamo il territorio in un palcoscenico per
				<span class="text-fuchsia-200">avventure straordinarie</span>,
				unendo gioco, cultura e mistero.
			</p>

			<div
				class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
			>
				<a
					href="#pwa"
					class="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-8 py-3 bg-linear-to-r from-violet-600/90 to-fuchsia-600/90 hover:from-violet-600 hover:to-fuchsia-600 text-white font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all hover:scale-105 active:scale-95"
				>
					<Download class="mr-2 h-4 w-4" />
					Installa la PWA
				</a>
				<a
					href="#about"
					class="w-full sm:w-auto inline-flex items-center justify-center rounded-full px-8 py-3 border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 text-violet-200 hover:text-white backdrop-blur-sm shadow-[0_0_15px_rgba(168,85,247,0.1)] transition-all hover:scale-105 active:scale-95"
				>
					<Info class="mr-2 h-4 w-4" />
					Chi Siamo
				</a>
			</div>
		</section>

		<!-- About Section -->
		<section id="about" class="mb-32 scroll-mt-24">
			<div class="grid gap-12 lg:grid-cols-2 items-center">
				<div class="order-2 lg:order-1 space-y-6">
					<h2 class="text-3xl font-bold text-white sm:text-4xl">
						Costruiamo ricordi, <br />
						<span class="text-sky-300">sfide e momenti unici.</span>
					</h2>
					<div
						class="space-y-4 text-slate-300 text-lg leading-relaxed"
					>
						<p>
							Nato in seno alla storica Pro Loco Venticanese, il
							comitato <strong class="text-fuchsia-200"
								>"Per Aspera ad Astra"</strong
							> rappresenta la sua anima più innovativa.
						</p>
						<p>
							La nostra missione è ambiziosa: trasformare
							Venticano in un grande palcoscenico per eventi
							immersivi. Non organizziamo semplici eventi, ma
							costruiamo esperienze che uniscono la scoperta del
							territorio all'adrenalina del gioco.
						</p>
					</div>
				</div>
				<div class="order-1 lg:order-2">
					<div class="relative group">
						<div
							class="absolute -inset-1 bg-linear-to-r from-fuchsia-600 to-violet-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"
						></div>
						<div
							class="relative rounded-2xl border border-white/10 bg-slate-900/50 p-8 backdrop-blur-xl ring-1 ring-white/10"
						>
							<div class="grid grid-cols-2 gap-4">
								<div
									class="flex flex-col items-center p-4 rounded-xl bg-white/5"
								>
									<Map
										class="h-8 w-8 text-fuchsia-300 mb-3"
									/>
									<span class="font-semibold text-slate-200"
										>Territorio</span
									>
								</div>
								<div
									class="flex flex-col items-center p-4 rounded-xl bg-white/5"
								>
									<Compass
										class="h-8 w-8 text-sky-300 mb-3"
									/>
									<span class="font-semibold text-slate-200"
										>Mistero</span
									>
								</div>
								<div
									class="flex flex-col items-center p-4 rounded-xl bg-white/5"
								>
									<Star
										class="h-8 w-8 text-yellow-200 mb-3"
									/>
									<span class="font-semibold text-slate-200"
										>Cultura</span
									>
								</div>
								<div
									class="flex flex-col items-center p-4 rounded-xl bg-white/5"
								>
									<Rocket
										class="h-8 w-8 text-violet-300 mb-3"
									/>
									<span class="font-semibold text-slate-200"
										>Gioco</span
									>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Access Section -->
		<section id="accessi" class="mt-28 scroll-mt-24">
			<div class="mb-10">
				<h2 class="text-3xl font-bold text-white sm:text-4xl mb-2">
					Accessi
				</h2>
				<p class="text-slate-400 max-w-2xl">
					Scegli l'area corretta in base al tuo ruolo durante l'evento.
				</p>
			</div>

			<div class="grid gap-6 md:grid-cols-2">
				<a
					href="/login?role=player"
					class="group rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-6 backdrop-blur-sm transition-all hover:border-fuchsia-400/50 hover:bg-fuchsia-500/10 active:scale-[0.99]"
				>
					<div class="mb-5 inline-flex rounded-2xl bg-fuchsia-500/10 p-3 border border-fuchsia-500/20">
						<User class="h-6 w-6 text-fuchsia-300" />
					</div>
					<h3 class="text-xl font-bold text-white">Giocatori</h3>
					<p class="mt-2 text-sm leading-relaxed text-slate-400">
						Accedi alla PWA di squadra per mappa, messaggi, GeoPhase e attività live.
					</p>
					<span class="mt-5 inline-flex text-sm font-bold text-fuchsia-200 group-hover:text-white">
						Apri area giocatori
					</span>
				</a>

				<a
					href="/login?role=admin"
					class="group rounded-xl border border-sky-500/20 bg-sky-500/5 p-6 backdrop-blur-sm transition-all hover:border-sky-400/50 hover:bg-sky-500/10 active:scale-[0.99]"
				>
					<div class="mb-5 inline-flex rounded-2xl bg-sky-500/10 p-3 border border-sky-500/20">
						<Shield class="h-6 w-6 text-sky-300" />
					</div>
					<h3 class="text-xl font-bold text-white">Staff / Admin</h3>
					<p class="mt-2 text-sm leading-relaxed text-slate-400">
						Accedi con user e password per gestione evento, validazioni, punteggi e dashboard.
					</p>
					<span class="mt-5 inline-flex text-sm font-bold text-sky-200 group-hover:text-white">
						Apri area riservata
					</span>
				</a>
			</div>
		</section>

		<!-- PWA Download Section -->
		<section id="pwa" class="mt-28 scroll-mt-24">
			<div class="rounded-2xl border border-white/10 bg-slate-900/50 p-6 sm:p-8 backdrop-blur-xl">
				<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
					<div class="max-w-2xl">
						<div class="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
							<Download class="h-3.5 w-3.5 text-fuchsia-300" />
							Installazione PWA
						</div>
						<h2 class="text-3xl font-bold text-white sm:text-4xl">
							Installa l'app sul dispositivo
						</h2>
						<p class="mt-3 text-slate-400 leading-relaxed">
							Android usa il download/installazione PWA del browser. iOS non permette il download diretto: apri la guida e aggiungi l'app web alla schermata Home.
						</p>
						<div class="mt-5 grid gap-3 sm:grid-cols-2">
							<div class="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
								<p class="text-xs font-black uppercase tracking-widest text-emerald-300">
									Android
								</p>
								<p class="mt-1 text-sm text-slate-400">
									Premi Download PWA e conferma l'installazione dal popup del browser.
								</p>
							</div>
							<div class="rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
								<p class="text-xs font-black uppercase tracking-widest text-sky-300">
									iOS
								</p>
								<p class="mt-1 text-sm text-slate-400">
									Premi Guida iOS e segui Condividi → Aggiungi alla schermata Home.
								</p>
							</div>
						</div>
					</div>

					<div class="grid w-full gap-3 sm:grid-cols-2 lg:max-w-xl">
						{#if !isInstalled}
							<button
								onclick={() => handleInstall("/game")}
								class="inline-flex min-h-14 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition-all hover:bg-slate-200 active:scale-[0.98]"
							>
								{#if isIOS}<PlusSquare class="mr-2 h-5 w-5 text-fuchsia-600" />Guida iOS Giocatori{:else}<Download class="mr-2 h-5 w-5 text-fuchsia-600" />Download PWA Giocatori{/if}
							</button>
							<button
								onclick={() => handleInstall("/staff")}
								class="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition-all hover:bg-white/10 active:scale-[0.98]"
							>
								{#if isIOS}<PlusSquare class="mr-2 h-5 w-5 text-sky-300" />Guida iOS Staff{:else}<Download class="mr-2 h-5 w-5 text-sky-300" />Download PWA Staff{/if}
							</button>
						{:else}
							<a
								href="/game"
								class="inline-flex min-h-14 items-center justify-center rounded-xl bg-fuchsia-600 px-5 py-3 text-sm font-black text-white transition-all hover:bg-fuchsia-500 active:scale-[0.98]"
							>
								<Rocket class="mr-2 h-5 w-5" />Apri PWA Giocatori
							</a>
							<a
								href="/staff"
								class="inline-flex min-h-14 items-center justify-center rounded-xl bg-sky-600 px-5 py-3 text-sm font-black text-white transition-all hover:bg-sky-500 active:scale-[0.98]"
							>
								<Shield class="mr-2 h-5 w-5" />Apri PWA Staff
							</a>
						{/if}
					</div>
				</div>
			</div>
		</section>

		<!-- iOS Instructions Modal -->
		{#if showIOSInstructions}
			<div
				class="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
				onclick={(e) => e.target === e.currentTarget && (showIOSInstructions = false)}
				onkeydown={(e) => e.key === "Escape" && (showIOSInstructions = false)}
				role="presentation"
			>
				<!-- The shell must not scroll: the close button is anchored to it
					     and would otherwise scroll out of reach on short viewports. -->
				<div
					class="relative w-full max-w-sm max-h-[calc(100dvh-2rem)] my-auto flex flex-col bg-slate-900 border border-white/10 rounded-xl shadow-2xl animate-in zoom-in-95 duration-300"
				>
					<button
						onclick={() => (showIOSInstructions = false)}
						class="absolute top-4 right-4 z-10 p-2 text-slate-400 hover:text-white transition-colors"
						aria-label="Chiudi"
					>
						<X size={24} />
					</button>

					<div class="overflow-y-auto p-8 text-center space-y-6">
						<div
							class="mx-auto w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center border border-indigo-600/20"
						>
							<Rocket class="h-8 w-8 text-indigo-400" />
						</div>

						<div class="space-y-2">
							<h3 class="text-xl font-bold text-white">
								Aggiungi app web su iPhone
							</h3>
							<p class="text-sm text-slate-400 text-balance">
								Su iOS non c'è download diretto della PWA. Segui questi passaggi per aggiungere l'app alla schermata Home.
							</p>
						</div>

						<div class="space-y-4 text-left">
							<div
								class="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5"
							>
								<div
									class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"
								>
									<Share class="h-4 w-4 text-sky-400" />
								</div>
								<p class="text-sm text-slate-200">
									Premi il tasto <strong>Condividi</strong> nella
									barra del browser
								</p>
							</div>

							<div
								class="flex justify-center py-2 animate-bounce"
							>
								<ArrowDown class="h-6 w-6 text-indigo-500" />
							</div>

							<div
								class="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5"
							>
								<div
									class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"
								>
									<PlusSquare
										class="h-4 w-4 text-fuchsia-400"
									/>
								</div>
								<p class="text-sm text-slate-200">
									Seleziona <strong
										>"Aggiungi alla schermata Home"</strong
									>
								</p>
							</div>
						</div>

						<Button
							onclick={() => (showIOSInstructions = false)}
							class="w-full bg-slate-800 hover:bg-slate-700 text-white h-12 rounded-xl"
						>
							Ho capito
						</Button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Footer -->
		<footer class="mt-24 border-t border-white/10 pt-10">
			<div
				class="flex flex-col gap-8 md:flex-row md:justify-between items-center text-center md:text-left"
			>
				<div class="space-y-2">
					<h4 class="text-lg font-bold text-white">
						Pro Loco Venticanese
					</h4>
					<p class="text-sm text-slate-400">
						Comitato Per Aspera ad Astra
					</p>
					<p class="text-xs text-slate-500">
						Piazza Monumento ai Caduti, Venticano (AV)
					</p>
				</div>

				<div
					class="flex flex-wrap justify-center gap-6 text-sm text-slate-400"
				>
					<a
						href="https://www.prolocoventicano.com/privacy-policy/"
						target="_blank"
						class="hover:text-white transition-colors"
						>Privacy Policy</a
					>
					<a
						href="https://www.prolocoventicano.com/cookie-policy/"
						target="_blank"
						class="hover:text-white transition-colors"
						>Cookie Policy</a
					>
					<a
						href="https://www.prolocoventicano.com/"
						target="_blank"
						class="hover:text-white transition-colors"
						>Sito Ufficiale Pro Loco</a
					>
				</div>
			</div>
			<div class="mt-8 text-center text-xs text-slate-600">
				&copy; {new Date().getFullYear()} PAAA Tool. All rights reserved.
			</div>
		</footer>
	</div>
</main>

<style>
	/* Custom animations if not in tailwind config */
	@keyframes fade-in-up {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fade-in-up {
		animation: fade-in-up 0.8s ease-out forwards;
	}
</style>
