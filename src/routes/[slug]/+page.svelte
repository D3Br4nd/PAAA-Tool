<script lang="ts">
    import InteractiveBackground from "$lib/components/InteractiveBackground.svelte";
    import * as Card from "$lib/components/ui/card";

    import { flip } from "svelte/animate";
    import { cubicOut } from "svelte/easing";
    import { onMount } from "svelte";
    import { getAvatarUrl } from "$lib/utils/avatar";
    import { invalidateAll } from "$app/navigation";
    import type { PageData } from "./$types";
    import {
        Users,
        Flag,
        Trophy,
        Calendar,
        MapPin,
        Info,
        ChevronRight,
        Timer,
        UserCheck,
        ArrowUp,
        ArrowDown,
        Sun,
        Moon,
    } from "lucide-svelte";
    import { browser } from "$app/environment";

    let { data }: { data: any } = $props();
    const event = $derived(data.event);
    const stats = $derived(data.stats);

    let previousRanks: Record<string, number> = $state({});
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

    // We update previousRanks BEFORE the leaderboard updates on screen
    // so we can compare the NEW rank with the OLD one.
    $effect.pre(() => {
        if (data.leaderboard) {
            const newRanks: Record<string, number> = {};
            // Capture current ranks before they might change effectively
            // But actually, data.leaderboard IS the new data.
            // So we need to have stored the OLD data somewhere.
            // The simple way: Store the previous data in a state that we update manually AFTER render or check.
            // Actually, let's just keep 'previousRanks' as a record of ID -> Rank from the PREVIOUS update.

            // Wait, if we use $effect, it runs when data changes.
            // We can use a local variable to store the 'last' leaderboard we processed.
        }
    });

    const leaderboard = $derived.by(() => {
        const list = data.leaderboard || [];
        // Helper side-effect: update previous tracking
        // This is a bit hacky inside a derived, but meaningful for transitions.
        // Better: just let the list flow, and handle previousRanks update in an effect.
        return list;
    });

    $effect(() => {
        // When data.leaderboard changes...
        const currentList = data.leaderboard || [];

        // We want to KEEP the old ranks to show the arrow, then update them for the NEXT time.
        // So we shouldn't update previousRanks immediately if we want to show "You went up!".
        // Actually, we want: Compare Current (new) vs Previous (old).
        // Then, after some time, sync Previous = Current? Or just keep Previous = "Rank at last sample".

        // Strategy:
        // 1. Snapshot current ranks to a temp map.
        // 2. We have `previousRanks` from the last cycle.
        // 3. We let the template render arrows based on (previousRanks vs currentList).
        // 4. We update `previousRanks` to `currentList` for the NEXT update.

        // BUT if we update `previousRanks` immediately, the arrows disappear.
        // So we update `previousRanks` ONLY just before the New Data arrives? No.

        // Correct flow:
        // 1. Data comes in. `leaderboard` updates. UI renders.
        // 2. UI sees `previousRanks[id]` (old) vs `row.rank` (new). Arrows appear.
        // 3. We set a timeout to update `previousRanks` to match `leaderboard` so the arrows disappear after 5-9 seconds, ready for next refresh.

        if (currentList.length > 0) {
            const timer = setTimeout(() => {
                const newMap: Record<string, number> = {};
                currentList.forEach((r: any) => (newMap[r.id] = r.rank));
                previousRanks = newMap;
            }, 9000); // Update "basis" just before next 10s refresh
            return () => clearTimeout(timer);
        }
    });

    onMount(() => {
        // Initialize previous ranks immediately
        if (data.leaderboard) {
            const newMap: Record<string, number> = {};
            data.leaderboard.forEach((r: any) => (newMap[r.id] = r.rank));
            previousRanks = newMap;
        }

        const interval = setInterval(() => {
            invalidateAll();
        }, 10000); // Refresh every 10 seconds

        return () => clearInterval(interval);
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
        class="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-start"
    >
        <a
            href="/"
            class="opacity-90 hover:opacity-100 transition-opacity flex items-center gap-4 bg-slate-900/80 dark:bg-transparent backdrop-blur-md dark:backdrop-blur-none px-3 py-2 rounded-xl"
        >
            <img
                src="/mini-icon-plv-white.png"
                alt="Pro Loco Venticano Logo"
                class="h-12 w-auto drop-shadow-lg"
            />
            <div class="h-8 w-px bg-white/20 hidden sm:block"></div>
            <img
                src="/paaa-logo.png"
                alt="Comitato PAAA Logo"
                class="h-12 w-auto drop-shadow-lg hidden sm:block"
            />
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

    <div class="relative z-10 container mx-auto px-4 pt-32 pb-20">
        <!-- Hero Event Info -->
        <div
            class="max-w-4xl mx-auto text-center mb-16 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700"
        >
            {#if event.logoUrl}
                <div class="flex justify-center mb-8 min-h-[128px]">
                    <img
                        src={event.logoUrl}
                        alt="{event.name} Logo"
                        onerror={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = "none";
                            if (target.parentElement) {
                                target.parentElement.innerHTML =
                                    '<div class="h-32 w-32 md:h-48 md:w-48 flex items-center justify-center bg-white/5 rounded-xl border border-white/10 backdrop-blur-md"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-compass text-fuchsia-400"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg></div>';
                            }
                        }}
                        class="h-32 w-32 md:h-48 md:w-48 object-contain drop-shadow-[0_0_25px_rgba(255,255,255,0.2)]"
                    />
                </div>
            {/if}

            <div
                class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-100 dark:bg-white/10 border border-fuchsia-300 dark:border-white/10 backdrop-blur-md text-xs font-medium uppercase tracking-wider text-fuchsia-700 dark:text-fuchsia-200"
            >
                <span
                    >{event.eventType === "other"
                        ? event.classification
                        : event.eventType}</span
                >
                <span class="w-1 h-1 rounded-full bg-fuchsia-400 dark:bg-white/50"></span>
                <span>Evento Ufficiale</span>
            </div>

            <h1
                class="text-5xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-4 drop-shadow-xl"
            >
                {event.name}
            </h1>

            <div
                class="flex flex-wrap items-center justify-center gap-4 text-slate-700 dark:text-slate-300"
            >
                <div
                    class="flex items-center gap-2 bg-white/80 dark:bg-slate-900/50 px-4 py-2 rounded-xl backdrop-blur-sm border border-slate-200 dark:border-white/5"
                >
                    <Calendar size={18} class="text-fuchsia-400" />
                    <span class="font-medium">
                        {#if event.startDate}
                            {new Date(event.startDate).toLocaleDateString(
                                "it-IT",
                                {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                },
                            )}
                            {#if event.endDate && new Date(event.startDate).getTime() !== new Date(event.endDate).getTime()}
                                - {new Date(event.endDate).toLocaleDateString(
                                    "it-IT",
                                    {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                    },
                                )}
                            {/if}
                        {:else}
                            {new Date().getFullYear()}
                        {/if}
                    </span>
                </div>
                <div
                    class="flex items-center gap-2 bg-white/80 dark:bg-slate-900/50 px-4 py-2 rounded-xl backdrop-blur-sm border border-slate-200 dark:border-white/5"
                >
                    <MapPin size={18} class="text-fuchsia-400" />
                    <span class="font-medium">Venticano (AV)</span>
                </div>
            </div>

            {#if event.description}
                <p
                    class="text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto"
                >
                    {event.description}
                </p>
            {/if}
        </div>

        <!-- Stats Grid -->
        <div
            class="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto mb-20"
        >
            <div
                class="bg-white/80 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 p-6 rounded-2xl text-center hover:bg-white dark:hover:bg-slate-900/60 transition-colors group shadow-sm dark:shadow-none"
            >
                <div
                    class="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                >
                    <Users size={24} class="text-indigo-400" />
                </div>
                <div class="text-3xl font-black text-slate-900 dark:text-white mb-1">
                    {stats.players}
                </div>
                <div
                    class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
                >
                    Partecipanti
                </div>
            </div>
            <div
                class="bg-white/80 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 p-6 rounded-2xl text-center hover:bg-white dark:hover:bg-slate-900/60 transition-colors group shadow-sm dark:shadow-none"
            >
                <div
                    class="mx-auto w-12 h-12 rounded-2xl bg-fuchsia-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                >
                    <Users size={24} class="text-fuchsia-400" />
                </div>
                <div class="text-3xl font-black text-slate-900 dark:text-white mb-1">
                    {stats.teams}
                </div>
                <div
                    class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
                >
                    Squadre
                </div>
            </div>
            <div
                class="bg-white/80 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 p-6 rounded-2xl text-center hover:bg-white dark:hover:bg-slate-900/60 transition-colors group shadow-sm dark:shadow-none"
            >
                <div
                    class="mx-auto w-12 h-12 rounded-2xl bg-sky-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                >
                    <Flag size={24} class="text-sky-400" />
                </div>
                <div class="text-3xl font-black text-slate-900 dark:text-white mb-1">
                    {stats.factions}
                </div>
                <div
                    class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
                >
                    Fazioni
                </div>
            </div>
            <div
                class="bg-white/80 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 p-6 rounded-2xl text-center hover:bg-white dark:hover:bg-slate-900/60 transition-colors group shadow-sm dark:shadow-none"
            >
                <div
                    class="mx-auto w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                >
                    <UserCheck size={24} class="text-amber-400" />
                </div>
                <div class="text-3xl font-black text-slate-900 dark:text-white mb-1">
                    {stats.staff}
                </div>
                <div
                    class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
                >
                    Staff
                </div>
            </div>
        </div>

        <!-- Faction Leaderboard -->
        <div class="w-full max-w-[95%] mx-auto mb-16">
            <h3
                class="text-xl font-bold text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-3"
            >
                <Flag size={20} /> Classifica Fazioni
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {#each data.factionLeaderboard || [] as faction (faction.id)}
                    <div
                        animate:flip={{ duration: 600, easing: cubicOut }}
                        class="relative overflow-hidden rounded-xl bg-white/90 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-white/10 p-6 flex flex-col justify-between group h-full min-h-[200px] shadow-sm dark:shadow-none"
                    >
                        <div
                            class="absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20"
                            style="background-color: {faction.color}"
                        ></div>
                        <div
                            class="absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20"
                            style="background-color: {faction.color}"
                        ></div>

                        <!-- Header -->
                        <div class="relative z-10 mb-6">
                            <div class="flex items-start justify-between gap-4">
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-2">
                                        {#if faction.rank === 1}
                                            <Trophy
                                                size={16}
                                                class="text-yellow-400"
                                            />
                                        {/if}
                                        <div
                                            class="inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider"
                                            style="background-color: {faction.color}30; color: {faction.color}; border: 1px solid {faction.color}40;"
                                        >
                                            #{faction.rank}
                                        </div>
                                    </div>
                                    <h3
                                        class="font-black text-2xl text-slate-950 dark:text-white leading-tight uppercase italic tracking-tight"
                                    >
                                        {faction.name}
                                    </h3>
                                </div>
                                <div
                                    class="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg border border-white/10 overflow-hidden"
                                    style="background-color: {faction.color}"
                                >
                                    {#if faction.avatarUrl}
                                        <img
                                            src={faction.avatarUrl}
                                            alt={faction.name}
                                            class="w-full h-full object-cover"
                                        />
                                    {:else}
                                        <Flag size={24} />
                                    {/if}
                                </div>
                            </div>
                            <div class="mt-2 text-3xl font-black text-slate-900 dark:text-white/90">
                                {faction.score}
                                <span
                                    class="text-xs font-bold text-slate-400 uppercase tracking-widest align-middle"
                                    >Punti</span
                                >
                            </div>
                        </div>

                        <!-- Mini Leaderboard -->
                        <div
                            class="relative z-10 space-y-2 border-t border-slate-200 dark:border-white/5 pt-4"
                        >
                            <div
                                class="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2"
                            >
                                Top Squadre
                            </div>
                            {#each faction.topTeams || [] as team, i}
                                <div
                                    class="flex items-center justify-between text-sm"
                                >
                                    <div
                                        class="flex items-center gap-2 overflow-hidden"
                                    >
                                        <div
                                            class="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0 border border-slate-300 dark:border-white/5 overflow-hidden"
                                        >
                                            <img
                                                src={getAvatarUrl(
                                                    team.avatarUrl,
                                                    team.name || "Team",
                                                    "team",
                                                )}
                                                alt=""
                                                class="w-full h-full object-cover"
                                            />
                                        </div>
                                        <span
                                            class="font-bold text-slate-600 dark:text-slate-300 truncate"
                                            >{team.name}</span
                                        >
                                    </div>
                                    <span
                                        class="font-mono font-bold text-slate-500 dark:text-slate-400"
                                        >{team.score}</span
                                    >
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Leaderboard Section -->
        <div class="w-full max-w-[95%] mx-auto">
            <div class="flex items-center justify-between mb-8">
                <h2
                    class="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3"
                >
                    <Trophy class="text-yellow-400" />
                    Classifica Live
                </h2>
                <div
                    class="flex items-center gap-2 text-sm text-green-400 bg-green-900/20 px-3 py-1 rounded-full border border-green-500/20 animate-pulse"
                >
                    <span class="relative flex h-2 w-2">
                        <span
                            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
                        ></span>
                        <span
                            class="relative inline-flex rounded-full h-2 w-2 bg-green-500"
                        ></span>
                    </span>
                    Aggiornamento in tempo reale
                </div>
            </div>

            <div
                class="bg-white/90 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg dark:shadow-2xl"
            >
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr
                                class="text-left text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest border-b border-slate-200 dark:border-white/5"
                            >
                                <th class="p-4 pl-6 w-20">Rank</th>
                                <th class="p-4">Team</th>
                                <th class="p-4 hidden sm:table-cell">Fazione</th
                                >
                                <th class="p-4 hidden md:table-cell"
                                    >Fasi completate</th
                                >
                                <th class="p-4 pr-6 text-right">Punti</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200 dark:divide-white/5">
                            {#each leaderboard as row (row.id)}
                                <tr
                                    animate:flip={{
                                        duration: 800,
                                        easing: cubicOut,
                                    }}
                                    class="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group relative"
                                    class:bg-green-500-10={previousRanks[
                                        row.id
                                    ] && previousRanks[row.id] > row.rank}
                                >
                                    <td
                                        class="p-4 pl-6 font-bold text-lg transition-colors duration-500 {row.rank ===
                                        1
                                            ? 'text-yellow-500'
                                            : row.rank === 2
                                              ? 'text-slate-400 dark:text-slate-300'
                                              : row.rank === 3
                                                ? 'text-amber-600'
                                                : 'text-slate-400 dark:text-slate-500'}"
                                    >
                                        <div class="flex items-center gap-2">
                                            #{row.rank}
                                            {#if previousRanks[row.id]}
                                                {#if previousRanks[row.id] > row.rank}
                                                    <ArrowUp
                                                        size={16}
                                                        class="text-green-500 animate-bounce"
                                                    />
                                                {:else if previousRanks[row.id] < row.rank}
                                                    <ArrowDown
                                                        size={16}
                                                        class="text-red-500"
                                                    />
                                                {/if}
                                            {/if}
                                        </div>
                                    </td>
                                    <td class="p-4">
                                        <div class="flex items-center gap-4">
                                            <div
                                                class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 border border-slate-200 dark:border-white/10 overflow-hidden"
                                            >
                                                <img
                                                    src={getAvatarUrl(
                                                        row.avatarUrl,
                                                        row.team || "Team",
                                                        "team",
                                                    )}
                                                    alt=""
                                                    class="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div>
                                                <div
                                                    class="font-bold text-slate-900 dark:text-white group-hover:text-fuchsia-600 dark:group-hover:text-fuchsia-300 transition-colors"
                                                >
                                                    {row.team}
                                                </div>
                                                <div
                                                    class="text-xs text-slate-400 dark:text-slate-500 sm:hidden"
                                                >
                                                    {row.faction}
                                                </div>
                                                {#if row.completedActivities?.length > 0}
                                                    <div class="mt-2 flex max-w-[220px] flex-wrap gap-1 md:hidden">
                                                        {#each row.completedActivities as activity}
                                                            <span
                                                                class="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-emerald-700 dark:text-emerald-300"
                                                            >
                                                                ✓ {activity.name}
                                                            </span>
                                                        {/each}
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="p-4 hidden sm:table-cell">
                                        <span
                                            class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-black border uppercase tracking-wider shadow-sm"
                                            style="background-color: {row.factionColor}20; border-color: {row.factionColor}40; color: {row.factionColor}"
                                        >
                                            {row.faction}
                                        </span>
                                    </td>
                                    <td class="p-4 hidden md:table-cell">
                                        {#if row.completedActivities?.length > 0}
                                            <div class="flex max-w-xl flex-wrap gap-1.5">
                                                {#each row.completedActivities as activity}
                                                    <span
                                                        class="inline-flex items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold leading-tight text-emerald-700 dark:text-emerald-300"
                                                        title={`Completata il ${new Date(activity.completedAt).toLocaleString('it-IT')}`}
                                                    >
                                                        ✓ {activity.name}
                                                    </span>
                                                {/each}
                                            </div>
                                        {:else}
											<span class="text-sm text-slate-400 dark:text-slate-600">—</span>
                                        {/if}
                                    </td>
                                    <td
                                        class="p-4 pr-6 text-right font-mono font-bold text-lg text-slate-900 dark:text-white"
                                    >
                                        {row.score}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
                <div
                    class="p-4 text-center border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs text-slate-400 dark:text-slate-500"
                >
                    Classifica provvisoria. I dati potrebbero subire variazioni
                    dopo la validazione dei giudici.
                </div>
            </div>
        </div>
    </div>
</main>
