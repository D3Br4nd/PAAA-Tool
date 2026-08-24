<script lang="ts">
    import { page } from "$app/stores";
    import { ChevronRight } from "lucide-svelte";

    let { children, data } = $props();
    const event = $derived(data.event);
    const activeTab = $derived($page.url.searchParams.get("tab") || "overview");
    const isGeoPhase = $derived($page.url.pathname.endsWith("/geophase"));
</script>

<div
    class="flex flex-col h-full overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/50"
>
    <!-- Event Sub-Header / Breadcrumbs -->
    <div
        class="bg-white dark:bg-zinc-900 border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm"
    >
        <div
            class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400"
        >
            <a
                href="/dashboard"
                class="hover:text-zinc-900 dark:hover:text-white transition-colors"
                >Dashboard</a
            >
            <ChevronRight size={14} />
            <a
                href="/dashboard/events"
                class="hover:text-zinc-900 dark:hover:text-white transition-colors"
                >Eventi</a
            >
            <ChevronRight size={14} />
            <span class="font-bold text-zinc-900 dark:text-white"
                >{event.name}</span
            >
        </div>

        <div class="flex items-center gap-3">
            {#if event.isActive}
                <span
                    class="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-lg uppercase"
                >
                    Attivo
                </span>
            {/if}
            <span
                class="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg text-zinc-500 dark:text-zinc-400 font-bold uppercase"
            >
                {event.eventType === "other"
                    ? event.classification
                    : event.eventType}
            </span>
        </div>
    </div>

    <nav
        class="bg-white/95 dark:bg-zinc-900/95 border-b px-6 py-2 overflow-x-auto"
        aria-label="Sezioni evento"
    >
        <div class="flex items-center gap-2 min-w-max">
            <a
                href="/dashboard/{event.slug}"
                class="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors {activeTab === 'overview' && !isGeoPhase ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}"
            >
                Panoramica
            </a>
            <a
                href="/dashboard/{event.slug}?tab=factions"
                class="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors {activeTab === 'factions' && !isGeoPhase ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}"
            >
                Fazioni
            </a>
            <a
                href="/dashboard/{event.slug}?tab=program"
                class="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors {activeTab === 'program' && !isGeoPhase ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}"
            >
                Programma
            </a>
            <a
                href="/dashboard/{event.slug}?tab=times"
                class="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors {activeTab === 'times' && !isGeoPhase ? 'bg-violet-600 text-white' : 'text-violet-700 hover:text-violet-900 hover:bg-violet-100 dark:text-violet-300 dark:hover:text-violet-100 dark:hover:bg-violet-950/60'}"
            >
                Classifiche tempi
            </a>
            <a
                href="/dashboard/{event.slug}?tab=challenges"
                class="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors {activeTab === 'challenges' && !isGeoPhase ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}"
            >
                Giochi
            </a>
            <a
                href="/dashboard/{event.slug}/geophase"
                class="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors {isGeoPhase ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}"
            >
                GeoPhase
            </a>
            <a
                href="/dashboard/{event.slug}?tab=codex"
                class="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors {activeTab === 'codex' && !isGeoPhase ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}"
            >
                Codex
            </a>
            <a
                href="/dashboard/{event.slug}?tab=scores"
                class="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors {activeTab === 'scores' && !isGeoPhase ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'}"
            >
                Punteggi
            </a>
            <a
                href="/dashboard/{event.slug}?tab=phase3"
                class="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors {activeTab === 'phase3' && !isGeoPhase ? 'bg-cyan-600 text-white' : 'text-cyan-700 hover:text-cyan-900 hover:bg-cyan-100 dark:text-cyan-300 dark:hover:text-cyan-100 dark:hover:bg-cyan-950/60'}"
            >
                Fase 3
            </a>
            <a
                href="/dashboard/{event.slug}?tab=phase4"
                class="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors {activeTab === 'phase4' && !isGeoPhase ? 'bg-yellow-500 text-zinc-950' : 'text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 dark:text-yellow-300 dark:hover:text-yellow-100 dark:hover:bg-yellow-950/60'}"
            >
                Fase 4
            </a>
        </div>
    </nav>

    <!-- Main Content Layout -->
    <div class="flex-1 flex overflow-hidden">
        <!-- Optional Side Nav for the event if we want one -->
        <!-- For now, we'll just use a main area -->

        <main class="flex-1 overflow-y-auto w-full">
            {@render children()}
        </main>
    </div>
</div>
