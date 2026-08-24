<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { flip } from "svelte/animate";
    import { cubicOut } from "svelte/easing";
    import { onMount } from "svelte";
    import { getAvatarUrl } from "$lib/utils/avatar";
    import { ArrowDown, ArrowUp, Flag, Gem, Trophy } from "lucide-svelte";

    let { data }: { data: any } = $props();
    const event = $derived(data.event);
    const leaderboard = $derived(data.leaderboard || []);
    const stats = $derived(data.stats || {});

    let previousRanks: Record<string, number> = $state({});
    let previousPercents: Record<string, number> = $state({});

    $effect(() => {
        const currentList = leaderboard;
        if (currentList.length > 0) {
            const timer = setTimeout(() => {
                const rankMap: Record<string, number> = {};
                const percentMap: Record<string, number> = {};
                currentList.forEach((row: any) => {
                    rankMap[row.id] = row.rank;
                    percentMap[row.id] = row.percent;
                });
                previousRanks = rankMap;
                previousPercents = percentMap;
            }, 8500);
            return () => clearTimeout(timer);
        }
    });

    onMount(() => {
        const rankMap: Record<string, number> = {};
        const percentMap: Record<string, number> = {};
        leaderboard.forEach((row: any) => {
            rankMap[row.id] = row.rank;
            percentMap[row.id] = row.percent;
        });
        previousRanks = rankMap;
        previousPercents = percentMap;

        const interval = setInterval(() => {
            invalidateAll();
        }, 10000);

        return () => clearInterval(interval);
    });

    function movedUp(row: any) {
        return previousRanks[row.id] && previousRanks[row.id] > row.rank;
    }

    function movedDown(row: any) {
        return previousRanks[row.id] && previousRanks[row.id] < row.rank;
    }

    function changedPercent(row: any) {
        return previousPercents[row.id] !== undefined && previousPercents[row.id] !== row.percent;
    }
</script>

<main class="phase-four-board relative min-h-screen overflow-hidden bg-zinc-950 text-white">
    <div class="animated-field absolute inset-0"></div>
    <div class="absolute inset-0 bg-linear-to-b from-zinc-950/80 via-zinc-950/40 to-zinc-950"></div>

    <header class="relative z-10 flex items-center justify-between gap-4 px-5 py-5 md:px-10">
        <a href="/{event.slug}" class="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-md transition-colors hover:bg-white/10">
            <img src="/mini-icon-plv-white.png" alt="Pro Loco Venticano" class="h-10 w-auto" />
            <span class="hidden sm:block text-[11px] font-black uppercase tracking-widest text-white/70">
                Classifica generale
            </span>
        </a>

        <div class="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-200">
            <span class="relative flex h-2 w-2">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75"></span>
                <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-300"></span>
            </span>
            Live
        </div>
    </header>

    <section class="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-7xl flex-col px-4 pb-10 md:px-8">
        <div class="mx-auto mb-8 max-w-4xl text-center">
            {#if event.logoUrl}
                <img src={event.logoUrl} alt="{event.name} Logo" class="mx-auto mb-5 h-20 w-20 object-contain drop-shadow-[0_0_24px_rgba(250,204,21,0.35)] md:h-28 md:w-28" />
            {/if}

            <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-yellow-200">
                <Gem size={16} />
                Fase 4
            </div>
            <h1 class="text-4xl font-black uppercase leading-tight text-white md:text-7xl">
                Caccia al Tesoro
            </h1>
            <p class="mt-4 text-sm font-bold uppercase tracking-widest text-white/55 md:text-base">
                {event.name}
            </p>
        </div>

        <div class="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div class="rounded-xl border border-white/10 bg-white/[0.07] p-5 text-center backdrop-blur-md">
                <div class="text-4xl font-black tabular-nums text-white">{stats.totalTeams || 0}</div>
                <div class="mt-1 text-[10px] font-black uppercase tracking-widest text-white/45">Squadre in finale</div>
            </div>
            <div class="rounded-xl border border-yellow-300/25 bg-yellow-300/10 p-5 text-center backdrop-blur-md">
                <div class="text-4xl font-black tabular-nums text-yellow-200">{stats.bestPercent || 0}%</div>
                <div class="mt-1 text-[10px] font-black uppercase tracking-widest text-yellow-100/60">Miglior avanzamento</div>
            </div>
            <div class="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-5 text-center backdrop-blur-md">
                <div class="text-4xl font-black tabular-nums text-emerald-200">{stats.foundTreasure || 0}</div>
                <div class="mt-1 text-[10px] font-black uppercase tracking-widest text-emerald-100/60">Tesori trovati</div>
            </div>
        </div>

        {#if leaderboard.length > 0}
            <div class="space-y-4">
                {#each leaderboard as row (row.id)}
                    <article
                        animate:flip={{ duration: 850, easing: cubicOut }}
                        class="team-row relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.08] p-4 shadow-2xl backdrop-blur-xl transition-all duration-500 md:p-5 {changedPercent(row) ? 'is-changing' : ''} {row.foundTreasure ? 'is-winner' : ''}"
                        style="--faction-color: {row.factionColor || '#facc15'}; --progress: {row.percent}%"
                    >
                        <div class="absolute inset-y-0 left-0 w-1.5 bg-[var(--faction-color)]"></div>
                        <div class="progress-glow absolute inset-y-0 left-0 bg-linear-to-r from-yellow-300/20 via-amber-300/10 to-transparent"></div>

                        <div class="relative z-10 grid grid-cols-1 gap-4 lg:grid-cols-[90px_1fr_320px_130px] lg:items-center">
                            <div class="flex items-center gap-3 lg:justify-center">
                                <div class="rank-badge flex h-16 w-16 items-center justify-center rounded-xl border border-white/10 bg-zinc-950/70 text-2xl font-black tabular-nums text-white shadow-lg">
                                    #{row.rank}
                                </div>
                                <div class="lg:hidden">
                                    {#if movedUp(row)}
                                        <ArrowUp size={22} class="text-emerald-300 animate-bounce" />
                                    {:else if movedDown(row)}
                                        <ArrowDown size={22} class="text-red-300" />
                                    {/if}
                                </div>
                            </div>

                            <div class="flex min-w-0 items-center gap-4">
                                <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-zinc-900">
                                    <img
                                        src={getAvatarUrl(row.teamAvatarUrl, row.teamName || "Team", "team")}
                                        alt=""
                                        class="h-full w-full object-cover"
                                    />
                                </div>
                                <div class="min-w-0">
                                    <h2 class="truncate text-2xl font-black uppercase leading-tight text-white md:text-4xl">
                                        {row.teamName}
                                    </h2>
                                    <div class="mt-2 inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest" style="border-color: {row.factionColor || '#facc15'}55; color: {row.factionColor || '#facc15'}; background-color: {row.factionColor || '#facc15'}18">
                                        <Flag size={13} />
                                        {row.factionName}
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-2">
                                <div class="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-white/45">
                                    <span>Completamento</span>
                                    <span>{row.percent}%</span>
                                </div>
                                <div class="h-5 overflow-hidden rounded-full border border-white/10 bg-zinc-950/70">
                                    <div class="treasure-bar h-full rounded-full"></div>
                                </div>
                            </div>

                            <div class="flex items-center justify-between gap-3 lg:justify-end">
                                <div class="hidden lg:block w-6">
                                    {#if movedUp(row)}
                                        <ArrowUp size={24} class="text-emerald-300 animate-bounce" />
                                    {:else if movedDown(row)}
                                        <ArrowDown size={24} class="text-red-300" />
                                    {/if}
                                </div>
                                <div class="text-right">
                                    <div class="text-4xl font-black tabular-nums text-yellow-200 md:text-5xl">{row.percent}%</div>
                                    {#if row.foundTreasure}
                                        <div class="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-300 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-950">
                                            <Trophy size={13} />
                                            Tesoro trovato
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </article>
                {/each}
            </div>
        {:else}
            <div class="mx-auto mt-8 max-w-xl rounded-xl border border-white/10 bg-white/[0.08] p-10 text-center backdrop-blur-xl">
                <Gem size={42} class="mx-auto mb-4 text-yellow-200" />
                <h2 class="text-2xl font-black uppercase text-white">Nessuna squadra in Fase 4</h2>
                <p class="mt-3 text-sm font-bold text-white/50">
                    Il tabellone si aggiornerà appena lo staff inserirà la prima squadra.
                </p>
            </div>
        {/if}
    </section>
</main>

<style>
    .animated-field {
        background:
            linear-gradient(115deg, rgba(250, 204, 21, 0.12), transparent 28%),
            linear-gradient(245deg, rgba(20, 184, 166, 0.12), transparent 30%),
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            #09090b;
        background-size:
            100% 100%,
            100% 100%,
            48px 48px,
            48px 48px,
            100% 100%;
        animation: field-drift 18s linear infinite;
    }

    .team-row {
        box-shadow: 0 22px 60px rgba(0, 0, 0, 0.32);
    }

    .team-row.is-changing {
        animation: row-flash 1.4s ease-out;
    }

    .team-row.is-winner {
        border-color: rgba(110, 231, 183, 0.5);
        background: rgba(6, 95, 70, 0.28);
    }

    .progress-glow {
        width: var(--progress);
        transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .treasure-bar {
        width: var(--progress);
        background: linear-gradient(90deg, #22d3ee, #facc15, #fb923c, #34d399);
        background-size: 220% 100%;
        box-shadow: 0 0 28px rgba(250, 204, 21, 0.42);
        transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1);
        animation: treasure-flow 2.8s linear infinite;
    }

    @keyframes field-drift {
        from {
            background-position:
                0 0,
                0 0,
                0 0,
                0 0,
                0 0;
        }
        to {
            background-position:
                0 0,
                0 0,
                48px 48px,
                48px 48px,
                0 0;
        }
    }

    @keyframes treasure-flow {
        from {
            background-position: 0 0;
        }
        to {
            background-position: 220% 0;
        }
    }

    @keyframes row-flash {
        0% {
            transform: scale(1);
            border-color: rgba(250, 204, 21, 0.25);
        }
        35% {
            transform: scale(1.015);
            border-color: rgba(250, 204, 21, 0.95);
            box-shadow: 0 0 44px rgba(250, 204, 21, 0.28);
        }
        100% {
            transform: scale(1);
        }
    }
</style>
