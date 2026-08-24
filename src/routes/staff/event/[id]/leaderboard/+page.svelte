<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import {
        ChevronLeft,
        Trophy,
        Users,
        Medal,
        TrendingUp,
        User,
    } from "lucide-svelte";

    let { data } = $props();

    let viewMode = $state("teams"); // 'teams' or 'factions'
</script>

<div class="p-6 space-y-8 pb-32">
    <div class="flex items-center gap-6">
        <Button
            variant="ghost"
            size="icon"
            href="/staff/event/{data.eventId}"
            class="h-14 w-14 rounded-2xl shrink-0 hover:bg-zinc-50 border-2 border-zinc-100"
        >
            <ChevronLeft size={28} />
        </Button>
        <div class="min-w-0">
            <h2
                class="text-3xl font-black tracking-tight text-zinc-950 uppercase italic leading-none"
            >
                Classifica
            </h2>
            <p
                class="text-sm font-black text-zinc-400 uppercase tracking-widest mt-1"
            >
                Situazione Live
            </p>
        </div>
    </div>

    <div class="flex gap-2 p-1 bg-zinc-100 rounded-2xl">
        <button
            onclick={() => (viewMode = "teams")}
            class="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all {viewMode ===
            'teams'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-600'}"
        >
            Squadre
        </button>
        <button
            onclick={() => (viewMode = "factions")}
            class="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all {viewMode ===
            'factions'
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-600'}"
        >
            Fazioni
        </button>
    </div>

    {#if viewMode === "teams"}
        <div class="space-y-4">
            {#each data.teams as team, i}
                <div
                    class="bg-white rounded-xl border-2 border-zinc-100 p-6 flex items-center justify-between shadow-sm relative overflow-hidden"
                >
                    {#if i < 3}
                        <div
                            class="absolute top-0 right-0 w-16 h-16 opacity-5 -mr-4 -mt-4"
                        >
                            <Medal size={64} />
                        </div>
                    {/if}

                    <div class="flex items-center gap-5">
                        <div
                            class="w-12 h-12 rounded-xl font-black text-xl flex items-center justify-center {i ===
                            0
                                ? 'bg-amber-100 text-amber-700'
                                : i === 1
                                  ? 'bg-slate-100 text-slate-700'
                                  : i === 2
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-zinc-50 text-zinc-400'}"
                        >
                            {i + 1}°
                        </div>
                        <div>
                            <h4
                                class="font-black text-lg uppercase text-zinc-950 leading-none"
                            >
                                {team.name}
                            </h4>
                            <div class="flex items-center gap-2 mt-1">
                                <div
                                    class="w-2 h-2 rounded-full"
                                    style="background-color: {team.factionColor ||
                                        '#ccc'}"
                                ></div>
                                <span
                                    class="text-[10px] font-black uppercase text-zinc-400 tracking-widest"
                                    >{team.factionName || "Senza Fazione"}</span
                                >
                            </div>
                        </div>
                    </div>

                    <div class="text-3xl font-black italic text-amber-600">
                        {team.score}<span class="text-sm ml-0.5">PT</span>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <div class="space-y-4">
            {#each data.factionTotals as faction, i}
                <Card.Card
                    class="p-8 rounded-2xl border-4 border-zinc-50 bg-white shadow-sm overflow-hidden relative"
                >
                    <div class="absolute top-0 right-0 p-4 opacity-5">
                        <TrendingUp size={120} />
                    </div>

                    <div class="flex items-center justify-between mb-8">
                        <div class="flex items-center gap-4">
                            <div
                                class="w-4 h-12 rounded-full"
                                style="background-color: {faction.color}"
                            ></div>
                            <h3
                                class="text-2xl font-black uppercase italic text-zinc-950"
                            >
                                {faction.name}
                            </h3>
                        </div>
                        <div
                            class="w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center font-black text-xl text-zinc-400"
                        >
                            #{i + 1}
                        </div>
                    </div>

                    <div class="flex items-end justify-between relative z-10">
                        <div class="flex flex-col">
                            <span
                                class="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em] mb-1"
                                >Punteggio Totale</span
                            >
                            <div
                                class="text-5xl font-black text-amber-600 italic leading-none"
                            >
                                {faction.totalPoints}
                                <span class="text-lg ml-1 font-bold">PT</span>
                            </div>
                        </div>
                        <div class="text-zinc-300">
                            <Users size={32} />
                        </div>
                    </div>
                </Card.Card>
            {/each}
        </div>
    {/if}
</div>
