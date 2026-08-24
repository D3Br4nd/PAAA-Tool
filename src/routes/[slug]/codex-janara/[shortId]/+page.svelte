<script lang="ts">
    import { enhance } from "$app/forms";
    import { fade, slide } from "svelte/transition";
    import { getAvatarUrl } from "$lib/utils/avatar";
    import {
        Shield,
        Lock,
        Unlock,
        ArrowRight,
        Sun,
        Moon,
        Sparkles,
        BookOpen,
        ChevronLeft,
    } from "lucide-svelte";

    let { data, form }: { data: any; form: any } = $props();
    const event = $derived(data.event);
    const puzzle = $derived(data.puzzle);
    const faction = $derived(data.faction);

    let isDark = $state(false);

    function toggleTheme() {
        isDark = !isDark;
    }
</script>

<svelte:head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
    <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,700;1,400&family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&display=swap"
        rel="stylesheet"
    />
</svelte:head>

<div
    class="min-h-screen transition-colors duration-700 font-serif pb-20 overflow-x-hidden relative {isDark
        ? 'dark-theme'
        : 'light-theme'}"
>
    <!-- Background Texture/Overlay -->
    <div
        class="fixed inset-0 pointer-events-none opacity-20 mix-blend-multiply grain-overlay"
    ></div>
    {#if isDark}
        <div
            class="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,#10b98122_0%,transparent_50%)]"
        ></div>
    {/if}

    <!-- Header -->
    <header
        class="sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b backdrop-blur-md transition-all duration-500 {isDark
            ? 'border-emerald-900/30 bg-zinc-950/80'
            : 'border-amber-900/20 bg-stone-50/80'}"
    >
        <a
            href="/game"
            class="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black uppercase tracking-widest transition-all {isDark
                ? 'text-emerald-300 hover:bg-emerald-950/60'
                : 'text-amber-900 hover:bg-amber-100'}"
        >
            <ChevronLeft size={16} />
            PWA
        </a>

        <div class="flex items-center gap-3 min-w-0">
            <div
                class="w-10 h-10 rounded-lg flex items-center justify-center border transition-all duration-500 shrink-0 {isDark
                    ? 'bg-emerald-900/30 border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]'
                    : 'bg-amber-100 border-amber-300'}"
            >
                <BookOpen
                    size={20}
                    class={isDark ? "text-emerald-400" : "text-amber-800"}
                />
            </div>
            <div class="min-w-0">
                <h1
                    class="text-lg font-bold uppercase tracking-[0.2em] transition-colors duration-500 truncate {isDark
                        ? 'text-emerald-400'
                        : 'text-amber-900'}"
                >
                    Codex Janara
                </h1>
                <p
                    class="text-[9px] uppercase tracking-widest font-bold opacity-50 {isDark
                        ? 'text-zinc-500'
                        : 'text-amber-800'}"
                >
                    {event.name}
                </p>
            </div>
        </div>

        <button
            onclick={toggleTheme}
            class="p-2 rounded-full border transition-all duration-500 {isDark
                ? 'bg-zinc-800 border-zinc-700 text-yellow-400'
                : 'bg-stone-200 border-stone-300 text-zinc-800'}"
        >
            {#if isDark}<Sun size={18} />{:else}<Moon size={18} />{/if}
        </button>
    </header>

    <div class="max-w-lg mx-auto p-6 mt-8 relative z-10">
        <!-- Main Scroll/Card -->
        <article
            class="transition-all duration-700 rounded-lg overflow-hidden border-2 relative shadow-2xl {isDark
                ? 'bg-zinc-900/80 border-emerald-900/30 shadow-emerald-950/20'
                : 'bg-[#f4ead5] border-amber-900/10 shadow-amber-900/10 parchment-texture'}"
        >
            <!-- Decorative corner -->
            <div
                class="absolute top-0 right-0 w-24 h-24 opacity-10 pointer-events-none"
            >
                <svg
                    viewBox="0 0 100 100"
                    class="w-full h-full"
                    fill="currentColor"
                >
                    <path d="M100 0 L100 100 L0 0 Z" />
                </svg>
            </div>

            <div class="p-8 space-y-10">
                <!-- Faction Sigil -->
                <div class="flex flex-col items-center text-center space-y-4">
                    <div
                        class="w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-500 p-1 relative"
                        style="border-color: {faction?.color || '#333'}"
                    >
                        <div
                            class="absolute inset-0 rounded-full animate-pulse opacity-20"
                            style="background: {faction?.color}"
                        ></div>
                        {#if faction?.avatarUrl}
                            <img
                                src={getAvatarUrl(
                                    faction.avatarUrl,
                                    faction.name,
                                    "faction",
                                )}
                                alt=""
                                class="w-full h-full object-cover rounded-full z-10"
                            />
                        {:else}
                            <Shield
                                size={32}
                                style="color: {faction?.color}"
                                class="z-10"
                            />
                        {/if}
                    </div>
                    <div class="space-y-1">
                        <p
                            class="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40"
                        >
                            Per ordine di
                        </p>
                        <h3
                            class="text-3xl font-bold tracking-tight italic {isDark
                                ? 'text-emerald-50'
                                : 'text-amber-950'}"
                        >
                            {faction?.name || "Sconosciuto"}
                        </h3>
                    </div>
                </div>

                <!-- Decryption Area -->
                <div class="pt-4 pb-2">
                    {#if form?.success}
                        <div
                            class="p-8 rounded-2xl border-2 relative overflow-hidden transition-all duration-700 {isDark
                                ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]'
                                : 'bg-white/80 border-emerald-700/30'}"
                            transition:slide
                        >
                            <div class="space-y-4 text-center">
                                <div
                                    class="inline-flex p-3 rounded-full transition-colors {isDark
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-emerald-100 text-emerald-800'}"
                                >
                                    <Unlock size={24} />
                                </div>
                                <div class="space-y-2">
                                    <p
                                        class="text-[11px] uppercase font-black tracking-[0.3em] opacity-60"
                                    >
                                        Revelatio
                                    </p>
                                    <p
                                        class="text-2xl font-bold tracking-tight whitespace-pre-wrap leading-tight {isDark
                                            ? 'text-emerald-50'
                                            : 'text-emerald-950'}"
                                    >
                                        {form.plaintext}
                                    </p>
                                    <div
                                        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest {isDark
                                            ? 'bg-emerald-500/20 text-emerald-300'
                                            : 'bg-emerald-100 text-emerald-800'}"
                                    >
                                        Decodificato con successo
                                        {#if form.pointsAwarded > 0}
                                            · +{form.pointsAwarded} punti ottenuti
                                        {:else}
                                            · punti gia assegnati o non previsti
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="mt-8 flex justify-center">
                            <button
                                onclick={() => window.location.reload()}
                                class="text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-all flex items-center gap-2"
                            >
                                <Lock size={12} /> Sigilla di nuovo
                            </button>
                        </div>
                    {:else}
                        <form
                            method="POST"
                            action="?/decrypt"
                            use:enhance
                            class="space-y-6"
                        >
                            <input
                                type="hidden"
                                name="shortId"
                                value={puzzle.id}
                            />

                            <div class="space-y-2">
                                <label
                                    for="keyword"
                                    class="text-[10px] uppercase font-bold tracking-widest pl-2 opacity-50 block"
                                    >Verbum Secretum</label
                                >
                                <div class="relative group">
                                    <input
                                        id="keyword"
                                        type="text"
                                        name="keyword"
                                        autocomplete="off"
                                        placeholder="Inserisci la parola magica..."
                                        class="w-full h-16 px-6 transition-all duration-500 border-2 rounded-xl text-lg font-bold outline-none shadow-lg {isDark
                                            ? 'bg-zinc-800/50 border-emerald-900/20 focus:border-emerald-500/50 text-white'
                                            : 'bg-white/50 border-amber-900/10 focus:border-amber-900/30 text-amber-950'}"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        class="absolute right-2 top-2 bottom-2 px-5 rounded-lg flex items-center justify-center transition-all shadow-xl group/btn {isDark
                                            ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                            : 'bg-amber-900 hover:bg-amber-800 text-white'}"
                                    >
                                        <ArrowRight
                                            size={22}
                                            class="group-hover/btn:translate-x-1 transition-transform"
                                        />
                                    </button>
                                </div>
                            </div>

                            {#if form?.error}
                                <div
                                    class="text-xs font-bold text-center py-4 rounded-xl border-2 transition-all duration-500 {isDark
                                        ? 'text-red-400 bg-red-950/20 border-red-900/30'
                                        : 'text-red-900 bg-red-50 border-red-200'}"
                                    transition:slide
                                >
                                    {form.error}
                                </div>
                            {/if}
                        </form>
                    {/if}
                </div>

                <!-- Encrypted content -->
                <div class="space-y-4">
                    <div class="flex items-center gap-3">
                        <div
                            class="h-px flex-1 opacity-20 {isDark
                                ? 'bg-emerald-500'
                                : 'bg-amber-900'}"
                        ></div>
                        <Sparkles size={14} class="opacity-30" />
                        <div
                            class="h-px flex-1 opacity-20 {isDark
                                ? 'bg-emerald-500'
                                : 'bg-amber-900'}"
                        ></div>
                    </div>

                    <div
                        class="p-8 transition-all duration-500 rounded-xl border relative overflow-hidden group shadow-inner {isDark
                            ? 'bg-black/40 border-emerald-500/10'
                            : 'bg-white/30 border-amber-900/5'}"
                    >
                        <div
                            class="absolute top-2 left-3 text-[10px] uppercase font-bold tracking-widest opacity-20"
                        >
                            Scriptum Crypticum
                        </div>

                        <p
                            class="relative z-10 text-lg leading-relaxed break-all font-serif italic text-center transition-all duration-700 {isDark
                                ? 'text-emerald-500/40 group-hover:text-emerald-400'
                                : 'text-amber-900/40 group-hover:text-amber-900/60'}"
                        >
                            {puzzle.encryptedText}
                        </p>

                        <div class="mt-6 flex justify-center opacity-20">
                            <span class="text-[8px] font-mono tracking-tighter"
                                >IDENTIFIER: {puzzle.id.substring(0, 8)}</span
                            >
                        </div>
                    </div>

                    {#if !form?.success}
                        <p
                            class="text-center text-[10px] opacity-40 font-bold px-8 mt-4 leading-relaxed italic"
                        >
                            "Soltanto chi possiede la conoscenza potrà
                            squarciare il velo dell'ignoto."
                        </p>
                    {/if}
                </div>
            </div>

            <!-- Bottom decorative border -->
            <div
                class="h-1 w-full opacity-20 {isDark
                    ? 'bg-emerald-900'
                    : 'bg-amber-950'}"
            ></div>
        </article>

        <!-- Footer Seal -->
        <div
            class="mt-16 text-center transition-opacity duration-1000 {isDark
                ? 'opacity-10'
                : 'opacity-20'}"
        >
            <Shield size={48} class="mx-auto" />
            <p class="mt-4 text-[10px] uppercase tracking-[0.5em] font-bold">
                Janara Codex
            </p>
        </div>
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
    }

    .dark-theme {
        background-color: #0a0a0a;
        color: #ecfdf5;
    }

    .light-theme {
        background-color: #fcf8f0;
        color: #451a03;
    }

    .parchment-texture {
        background-image: url("https://www.transparenttextures.com/patterns/parchment.png");
    }

    .grain-overlay {
        background-image: url("https://www.transparenttextures.com/patterns/asfalt-dark.png");
    }

    :global(.font-serif) {
        font-family: "Cormorant Garamond", "Old Standard TT", serif;
    }

    @keyframes pulse-glow {
        0%,
        100% {
            opacity: 0.1;
            transform: scale(1);
        }
        50% {
            opacity: 0.3;
            transform: scale(1.05);
        }
    }

    .animate-pulse {
        animation: pulse-glow 4s ease-in-out infinite;
    }
</style>
