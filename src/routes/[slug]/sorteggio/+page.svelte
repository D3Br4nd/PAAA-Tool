<script lang="ts">
    import InteractiveBackground from "$lib/components/InteractiveBackground.svelte";
    import { getAvatarUrl } from "$lib/utils/avatar";
    import { flip } from "svelte/animate";
    import { fade, fly, scale } from "svelte/transition";
    import { cubicOut, elasticOut } from "svelte/easing";
    import { onMount, onDestroy } from "svelte";
    import {
        Shuffle,
        RotateCcw,
        Users,
        Trophy,
        Swords,
        ChevronRight,
        AlertCircle,
        Check,
        X,
        ArrowLeft,
        Radio,
        Sun,
        Moon,
    } from "lucide-svelte";
    import { browser } from "$app/environment";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    const event = $derived(data.event);
    const allTeams = $derived(data.teams);
    const isAdmin = $derived(data.isAdmin);

    // Map team IDs to team objects for quick lookup
    const teamsById = $derived(
        Object.fromEntries(allTeams.map((t) => [t.id, t])),
    );

    let theme = $state<"light" | "dark">("dark");

    $effect(() => {
        if (browser) {
            const saved = document.cookie.match(/theme=(dark|light)/)?.[1] || "dark";
            theme = saved as "light" | "dark";
            document.documentElement.classList.toggle("dark", theme === "dark");
        }
    });

    function toggleTheme() {
        theme = theme === "dark" ? "light" : "dark";
        if (browser) {
            document.cookie = `theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
            document.documentElement.classList.toggle("dark", theme === "dark");
        }
    }

    // State
    let isDrawing = $state(false);
    let drawComplete = $state(false);
    let drawnPairs = $state<
        Array<{ team1: any; team2: any; revealed: boolean }>
    >([]);
    let oddTeam = $state<any>(null);
    let reselectionList = $state<any[]>([]);
    let currentRevealIndex = $state(-1);
    let pairedTeam = $state<any>(null);
    let declinedTeams = $state<Set<string>>(new Set());
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let isLive = $state(false);
    let drawTitle = $state(""); // Custom title for this draw

    // Fisher-Yates shuffle
    function shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Load draw state from API
    async function loadDraw() {
        try {
            const res = await fetch(`/${event.slug}/sorteggio/api`);
            const { draw } = await res.json();

            if (draw) {
                isLive = true;
                // Rebuild state from saved draw
                const pairs = (draw.pairs || []).map((p: any, i: number) => ({
                    team1: teamsById[p.team1Id],
                    team2: teamsById[p.team2Id],
                    revealed: i <= draw.revealIndex,
                }));
                drawnPairs = pairs;

                if (draw.oddTeamId) {
                    oddTeam = teamsById[draw.oddTeamId];
                    // Rebuild reselection list from drawOrder
                    reselectionList = (draw.drawOrder || [])
                        .map((id: string) => teamsById[id])
                        .filter(Boolean);
                } else {
                    oddTeam = null;
                    reselectionList = [];
                }

                currentRevealIndex = draw.revealIndex;
                pairedTeam = draw.pairedTeamId
                    ? teamsById[draw.pairedTeamId]
                    : null;
                declinedTeams = new Set(draw.declinedTeamIds || []);
                drawComplete = draw.status === "complete";
                isDrawing =
                    draw.status === "revealing" &&
                    draw.revealIndex < pairs.length - 1;
                drawTitle = draw.title || "";
            } else {
                isLive = false;
                // No draw exists - reset draw state but keep title input for user
                isDrawing = false;
                drawComplete = false;
                drawnPairs = [];
                oddTeam = null;
                reselectionList = [];
                currentRevealIndex = -1;
                pairedTeam = null;
                declinedTeams = new Set();
                // Note: Don't reset drawTitle here - user might be typing
            }
        } catch (e) {
            console.error("Failed to load draw:", e);
        }
    }

    function resetLocalState() {
        isDrawing = false;
        drawComplete = false;
        drawnPairs = [];
        oddTeam = null;
        reselectionList = [];
        currentRevealIndex = -1;
        pairedTeam = null;
        declinedTeams = new Set();
        drawTitle = "";
    }

    async function startDraw() {
        if (!isAdmin || allTeams.length < 2) return;

        isDrawing = true;
        drawComplete = false;

        // Shuffle teams
        const shuffled = shuffleArray(allTeams);
        const isOdd = shuffled.length % 2 !== 0;

        let oddTeamLocal: any = null;
        if (isOdd) {
            oddTeamLocal = shuffled.pop();
        }

        // Create pairs
        const pairs: Array<{ team1Id: string; team2Id: string }> = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            pairs.push({
                team1Id: shuffled[i].id,
                team2Id: shuffled[i + 1].id,
            });
        }

        // Save to API
        await fetch(`/${event.slug}/sorteggio/api`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "start",
                title: drawTitle || null,
                pairs,
                oddTeamId: oddTeamLocal?.id || null,
                drawOrder: shuffled.map((t) => t.id),
            }),
        });

        // Set local state
        drawnPairs = pairs.map((p, i) => ({
            team1: teamsById[p.team1Id],
            team2: teamsById[p.team2Id],
            revealed: false,
        }));
        oddTeam = oddTeamLocal;
        reselectionList = shuffled;
        currentRevealIndex = -1;

        // Animated reveal with API updates
        for (let i = 0; i < drawnPairs.length; i++) {
            await new Promise((resolve) => setTimeout(resolve, 800));
            currentRevealIndex = i;
            drawnPairs[i].revealed = true;
            drawnPairs = [...drawnPairs];

            // Update API with reveal progress
            await fetch(`/${event.slug}/sorteggio/api`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reveal", revealIndex: i }),
            });
        }

        // Mark complete
        await fetch(`/${event.slug}/sorteggio/api`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "complete" }),
        });

        isDrawing = false;
        drawComplete = true;
        isLive = true;
    }

    async function resetDraw() {
        if (!isAdmin) return;

        await fetch(`/${event.slug}/sorteggio/api`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reset" }),
        });

        resetLocalState();
        isLive = false;
    }

    async function acceptPairing(team: any) {
        if (!isAdmin) return;

        await fetch(`/${event.slug}/sorteggio/api`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "accept", pairedTeamId: team.id }),
        });

        pairedTeam = team;
    }

    async function declinePairing(team: any) {
        if (!isAdmin) return;

        await fetch(`/${event.slug}/sorteggio/api`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "decline", teamId: team.id }),
        });

        declinedTeams = new Set([...declinedTeams, team.id]);
    }

    // Available teams for reselection (not declined)
    const availableForReselection = $derived(
        reselectionList.filter((t) => !declinedTeams.has(t.id)),
    );

    // Start polling on mount
    onMount(() => {
        loadDraw();
        // Spectators poll every 2 seconds, admins every 5 seconds
        const pollInterval = isAdmin ? 5000 : 2000;
        pollingInterval = setInterval(loadDraw, pollInterval);
    });

    onDestroy(() => {
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }
    });
</script>

<main
    class="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-fuchsia-500/30 overflow-x-hidden"
>
    <div class="opacity-20 dark:opacity-100 transition-opacity duration-300">
        <InteractiveBackground />
    </div>

    <!-- Overlay for readability -->
    <div
        class="pointer-events-none absolute inset-0 bg-linear-to-b from-slate-50/90 dark:from-slate-950/80 via-transparent to-slate-50/95 dark:to-slate-950/90 z-0"
    ></div>

    <!-- Header / Nav -->
    <div
        class="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-center"
    >
        <a
            href="/{event.slug}"
            class="opacity-90 hover:opacity-100 transition-opacity flex items-center gap-3 group"
        >
            <div
                class="w-10 h-10 rounded-xl bg-slate-900/80 dark:bg-slate-800/50 border border-white/10 flex items-center justify-center group-hover:bg-slate-800 dark:group-hover:bg-slate-700/50 transition-colors"
            >
                <ArrowLeft size={20} class="text-fuchsia-400" />
            </div>
            <span
                class="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors hidden sm:block"
                >Torna all'evento</span
            >
        </a>

        <button
            onclick={toggleTheme}
            class="p-2.5 rounded-xl bg-slate-900/80 dark:bg-white/5 border border-white/20 dark:border-white/10 backdrop-blur-md hover:bg-slate-800 dark:hover:bg-white/10 transition-all shadow-lg"
            aria-label="Cambia tema"
        >
            {#if theme === "dark"}
                <Sun size={20} class="text-amber-400" />
            {:else}
                <Moon size={20} class="text-slate-200" />
            {/if}
        </button>
    </div>

    <div class="relative z-10 container mx-auto px-4 pt-24 pb-20">
        <!-- Header Section -->
        <div
            class="max-w-4xl mx-auto text-center mb-12 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700"
        >
            {#if event.logoUrl}
                <div class="flex justify-center mb-6">
                    <img
                        src={event.logoUrl}
                        alt="{event.name} Logo"
                        class="h-20 w-20 object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.2)]"
                    />
                </div>
            {/if}

            <div class="flex items-center justify-center gap-2 flex-wrap">
                <div
                    class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-fuchsia-300"
                >
                    <Shuffle size={14} />
                    <span>Sorteggio Squadre</span>
                </div>

                {#if isLive}
                    <div
                        class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-red-400"
                        in:scale={{ duration: 300 }}
                    >
                        <Radio size={14} class="animate-pulse" />
                        <span>LIVE</span>
                    </div>
                {/if}
            </div>

            <h1
                class="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white drop-shadow-xl"
            >
                Giochi del Pomeriggio
            </h1>

            <p class="text-lg text-slate-400 max-w-2xl mx-auto">
                Estrazione casuale degli abbinamenti per le sfide del
                pomeriggio.
                {#if allTeams.length % 2 !== 0}
                    <span class="text-amber-400"
                        >Numero dispari di squadre: una squadra verrà
                        riabbinata.</span
                    >
                {/if}
            </p>

            <!-- Stats -->
            <div class="flex justify-center gap-6 pt-4">
                <div
                    class="flex items-center gap-2 bg-white/80 dark:bg-slate-900/50 px-4 py-2 rounded-xl backdrop-blur-sm border border-slate-200 dark:border-white/5"
                >
                    <Users size={18} class="text-sky-400" />
                    <span class="font-bold text-white">{allTeams.length}</span>
                    <span class="text-slate-400">Squadre</span>
                </div>
                <div
                    class="flex items-center gap-2 bg-white/80 dark:bg-slate-900/50 px-4 py-2 rounded-xl backdrop-blur-sm border border-slate-200 dark:border-white/5"
                >
                    <Swords size={18} class="text-fuchsia-400" />
                    <span class="font-bold text-white"
                        >{Math.ceil(allTeams.length / 2)}</span
                    >
                    <span class="text-slate-400">Sfide</span>
                </div>
            </div>
        </div>

        <!-- Title Display (when live and has title) — visible to all -->
        {#if isLive && drawTitle}
            <div class="text-center mb-8">
                <h2 class="text-2xl md:text-3xl font-bold text-fuchsia-600 dark:text-fuchsia-300">
                    {drawTitle}
                </h2>
            </div>
        {/if}

        <!-- Admin-only controls -->
        {#if isAdmin}
            <div class="flex flex-col items-center gap-4 mb-12">
                <!-- Title Input (before starting) -->
                {#if !isLive}
                    <div class="w-full max-w-md">
                        <label
                            for="draw-title"
                            class="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 text-center"
                        >
                            Nome del gioco (opzionale)
                        </label>
                        <input
                            id="draw-title"
                            type="text"
                            bind:value={drawTitle}
                            placeholder="Es: Tiro alla Fune, Staffetta, ecc."
                            class="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-fuchsia-500/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 transition-all"
                        />
                    </div>
                {/if}

                <div class="flex gap-4 flex-wrap justify-center">
                    {#if !isLive}
                        <button
                            onclick={startDraw}
                            disabled={isDrawing || allTeams.length < 2}
                            class="group relative px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 overflow-hidden
                                {isDrawing
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-linear-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white shadow-lg shadow-fuchsia-500/25 hover:shadow-fuchsia-500/40 hover:scale-105'}"
                        >
                            <span class="relative z-10 flex items-center gap-3">
                                {#if isDrawing}
                                    <div
                                        class="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"
                                    ></div>
                                    Estrazione in corso...
                                {:else}
                                    <Shuffle size={22} />
                                    Avvia Sorteggio
                                {/if}
                            </span>
                        </button>
                    {:else}
                        <button
                            onclick={resetDraw}
                            disabled={isDrawing}
                            class="group px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 flex items-center gap-3 border border-slate-200 dark:border-white/10
                                {isDrawing
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/50 hover:border-red-300 dark:hover:border-red-500/30 text-slate-700 dark:text-white'}"
                        >
                            <RotateCcw
                                size={22}
                                class="group-hover:rotate-[-360deg] transition-transform duration-500"
                            />
                            Reset Sorteggio
                        </button>
                    {/if}
                </div>
            </div>
        {/if}

        <!-- Draw Results -->
        {#if drawnPairs.length > 0}
            <div class="max-w-4xl mx-auto space-y-4">
                <h2
                    class="text-xl font-bold text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-3"
                >
                    <Trophy size={20} class="text-amber-400" />
                    Abbinamenti Estratti
                </h2>

                <div class="space-y-3">
                    {#each drawnPairs as pair, i (i)}
                        <div
                            class="relative overflow-hidden rounded-2xl transition-all duration-500
                                {pair.revealed
                                ? 'bg-white/90 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none'
                                : 'bg-slate-100/50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/5'}"
                            in:fly={{ y: 20, duration: 400, delay: i * 100 }}
                        >
                            {#if pair.revealed}
                                <div
                                    class="p-4 md:p-6 flex flex-col md:flex-row items-center gap-4"
                                    in:scale={{
                                        duration: 400,
                                        easing: elasticOut,
                                    }}
                                >
                                    <!-- Match Number -->
                                    <div
                                        class="shrink-0 w-12 h-12 rounded-xl bg-linear-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-lg font-black text-white shadow-lg"
                                    >
                                        {i + 1}
                                    </div>

                                    <!-- Team 1 -->
                                    <div
                                        class="flex-1 flex items-center gap-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-white/5"
                                    >
                                        <div
                                            class="w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0"
                                            style="border-color: {pair.team1
                                                .factionColor || '#3b82f6'}"
                                        >
                                            <img
                                                src={getAvatarUrl(
                                                    pair.team1.avatarUrl,
                                                    pair.team1.name,
                                                    "team",
                                                )}
                                                alt=""
                                                class="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div class="min-w-0">
                                            <div
                                                class="font-bold text-slate-900 dark:text-white truncate"
                                            >
                                                {pair.team1.name}
                                            </div>
                                            <div
                                                class="text-xs text-slate-400 dark:text-slate-500 truncate"
                                            >
                                                {pair.team1.factionName}
                                            </div>
                                        </div>
                                    </div>

                                    <!-- VS -->
                                    <div
                                        class="shrink-0 w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center"
                                    >
                                        <span
                                            class="text-xs font-black text-amber-400"
                                            >VS</span
                                        >
                                    </div>

                                    <!-- Team 2 -->
                                    <div
                                        class="flex-1 flex items-center gap-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-white/5"
                                    >
                                        <div
                                            class="w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0"
                                            style="border-color: {pair.team2
                                                .factionColor || '#3b82f6'}"
                                        >
                                            <img
                                                src={getAvatarUrl(
                                                    pair.team2.avatarUrl,
                                                    pair.team2.name,
                                                    "team",
                                                )}
                                                alt=""
                                                class="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div class="min-w-0">
                                            <div
                                                class="font-bold text-slate-900 dark:text-white truncate"
                                            >
                                                {pair.team2.name}
                                            </div>
                                            <div
                                                class="text-xs text-slate-400 dark:text-slate-500 truncate"
                                            >
                                                {pair.team2.factionName}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            {:else}
                                <!-- Placeholder during reveal -->
                                <div
                                    class="p-6 flex items-center justify-center gap-4"
                                >
                                    <div
                                        class="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse"
                                    ></div>
                                    <div
                                        class="flex-1 h-16 rounded-xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse"
                                    ></div>
                                    <div
                                        class="w-12 h-12 rounded-full bg-slate-200/30 dark:bg-slate-800/30 animate-pulse"
                                    ></div>
                                    <div
                                        class="flex-1 h-16 rounded-xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse"
                                    ></div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>

                <!-- Odd Team Section -->
                {#if oddTeam && drawComplete}
                    <div
                        class="mt-8 p-6 rounded-2xl bg-linear-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/30 backdrop-blur-xl"
                        in:fly={{ y: 30, duration: 500 }}
                    >
                        <div class="flex items-start gap-4">
                            <div
                                class="shrink-0 w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center"
                            >
                                <AlertCircle size={24} class="text-amber-400" />
                            </div>
                            <div class="flex-1">
                                <h3
                                    class="text-lg font-bold text-amber-300 mb-2"
                                >
                                    Squadra Dispari - Riabbinamento
                                </h3>

                                {#if pairedTeam}
                                    <!-- Pairing confirmed -->
                                    <div
                                        class="p-4 rounded-xl bg-green-900/30 border border-green-500/30 mb-4"
                                    >
                                        <p class="text-sm text-green-300 mb-3">
                                            <strong class="text-white"
                                                >{pairedTeam.name}</strong
                                            > ha accettato la sfida!
                                        </p>
                                        <div
                                            class="flex items-center gap-4 justify-center"
                                        >
                                            <!-- Odd Team -->
                                            <div
                                                class="flex items-center gap-2 bg-slate-900/60 rounded-xl p-3 border border-green-500/20"
                                            >
                                                <div
                                                    class="w-8 h-8 rounded-lg overflow-hidden border-2"
                                                    style="border-color: {oddTeam.factionColor ||
                                                        '#3b82f6'}"
                                                >
                                                    <img
                                                        src={getAvatarUrl(
                                                            oddTeam.avatarUrl,
                                                            oddTeam.name,
                                                            "team",
                                                        )}
                                                        alt=""
                                                        class="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <span
                                                    class="font-bold text-white text-sm"
                                                    >{oddTeam.name}</span
                                                >
                                            </div>
                                            <span
                                                class="text-xs font-black text-green-400"
                                                >VS</span
                                            >
                                            <!-- Paired Team -->
                                            <div
                                                class="flex items-center gap-2 bg-slate-900/60 rounded-xl p-3 border border-green-500/20"
                                            >
                                                <div
                                                    class="w-8 h-8 rounded-lg overflow-hidden border-2"
                                                    style="border-color: {pairedTeam.factionColor ||
                                                        '#3b82f6'}"
                                                >
                                                    <img
                                                        src={getAvatarUrl(
                                                            pairedTeam.avatarUrl,
                                                            pairedTeam.name,
                                                            "team",
                                                        )}
                                                        alt=""
                                                        class="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <span
                                                    class="font-bold text-white text-sm"
                                                    >{pairedTeam.name}</span
                                                >
                                            </div>
                                        </div>
                                    </div>
                                {:else}
                                    <p class="text-sm text-amber-800/80 dark:text-amber-200/70 mb-4">
                                        La squadra <strong class="text-white"
                                            >{oddTeam.name}</strong
                                        >
                                        deve essere riabbinata.
                                        {#if isAdmin}
                                            Seleziona una squadra dalla lista
                                            (in ordine di estrazione) che
                                            accetta una seconda sfida.
                                        {:else}
                                            Un admin deve selezionare
                                            l'avversario.
                                        {/if}
                                    </p>

                                    <!-- Odd Team Card -->
                                    <div
                                        class="inline-flex items-center gap-3 bg-white/80 dark:bg-slate-900/60 rounded-xl p-3 border border-amber-500/20 mb-4"
                                    >
                                        <div
                                            class="w-10 h-10 rounded-lg overflow-hidden border-2"
                                            style="border-color: {oddTeam.factionColor ||
                                                '#3b82f6'}"
                                        >
                                            <img
                                                src={getAvatarUrl(
                                                    oddTeam.avatarUrl,
                                                    oddTeam.name,
                                                    "team",
                                                )}
                                                alt=""
                                                class="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div>
                                            <div class="font-bold text-white">
                                                {oddTeam.name}
                                            </div>
                                            <div class="text-xs text-slate-500">
                                                {oddTeam.factionName}
                                            </div>
                                        </div>
                                        <ChevronRight
                                            size={20}
                                            class="text-amber-400 ml-2"
                                        />
                                        <span class="text-slate-400 text-sm"
                                            >in attesa di avversario</span
                                        >
                                    </div>

                                    <!-- Reselection List -->
                                    <div class="space-y-2">
                                        <p
                                            class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"
                                        >
                                            Squadre disponibili per
                                            riabbinamento (in ordine di
                                            estrazione):
                                        </p>
                                        <div
                                            class="grid grid-cols-1 sm:grid-cols-2 gap-2"
                                        >
                                            {#each availableForReselection as team, i (team.id)}
                                                <div
                                                    class="flex items-center gap-3 p-3 rounded-xl bg-white/80 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 transition-all
                                                        {isAdmin
                                                        ? 'hover:border-amber-500/30 hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer group'
                                                        : ''}"
                                                >
                                                    <span
                                                        class="text-xs font-mono text-slate-400 dark:text-slate-600 w-6"
                                                        >{i + 1}.</span
                                                    >
                                                    <div
                                                        class="w-8 h-8 rounded-lg overflow-hidden border shrink-0"
                                                        style="border-color: {team.factionColor ||
                                                            '#3b82f6'}"
                                                    >
                                                        <img
                                                            src={getAvatarUrl(
                                                                team.avatarUrl,
                                                                team.name,
                                                                "team",
                                                            )}
                                                            alt=""
                                                            class="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <div
                                                            class="font-medium text-sm text-slate-900 dark:text-white truncate"
                                                        >
                                                            {team.name}
                                                        </div>
                                                    </div>
                                                    {#if isAdmin}
                                                        <div
                                                            class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <button
                                                                onclick={() =>
                                                                    acceptPairing(
                                                                        team,
                                                                    )}
                                                                class="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                                                                title="Accetta"
                                                            >
                                                                <Check
                                                                    size={14}
                                                                />
                                                            </button>
                                                            <button
                                                                onclick={() =>
                                                                    declinePairing(
                                                                        team,
                                                                    )}
                                                                class="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                                title="Rifiuta"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                        {#if availableForReselection.length === 0}
                                            <p
                                                class="text-sm text-red-400 text-center py-4"
                                            >
                                                Tutte le squadre hanno
                                                rifiutato. Premi "Nuovo
                                                Sorteggio" per ricominciare.
                                            </p>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        {:else if !isDrawing}
            <!-- Empty State -->
            <div class="max-w-2xl mx-auto text-center py-20">
                <div
                    class="w-24 h-24 mx-auto mb-6 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm dark:shadow-none"
                >
                    <Shuffle size={40} class="text-slate-400 dark:text-slate-600" />
                </div>
                <h3 class="text-xl font-bold text-slate-500 dark:text-slate-500 mb-2">
                    Nessun sorteggio effettuato
                </h3>
                <p class="text-slate-500 dark:text-slate-600">
                    Clicca su "Avvia Sorteggio" per estrarre casualmente gli
                    abbinamenti delle squadre.
                </p>
            </div>
        {/if}
    </div>
</main>
