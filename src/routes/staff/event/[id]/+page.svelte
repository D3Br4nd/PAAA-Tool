<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import {
        Target,
        ChevronRight,
        Trophy,
        ListChecks,
        ArrowRight,
        Timer,
        Play,
        Square,
        Clock,
        MapPin,
        RotateCcw,
        AlertCircle,
        X,
    } from "lucide-svelte";
    import { onMount } from "svelte";
    import { invalidateAll } from "$app/navigation";
    import type { PageData } from "./$types";

    let { data }: { data: any } = $props();

    let pendingCancel = $state<{ id: string; teamName: string; gameName: string } | null>(null);
    let isCancelling = $state(false);

    function promptCancelCompletion(id: string, teamName: string, gameName: string) {
        pendingCancel = { id, teamName, gameName };
    }

    async function executeCancelCompletion() {
        if (!pendingCancel || isCancelling) return;
        isCancelling = true;
        try {
            const res = await fetch(`/api/games/completions/${pendingCancel.id}`, { method: 'DELETE' });
            if (res.ok) {
                pendingCancel = null;
                await invalidateAll();
            }
        } catch (e) {
            console.error('Error cancelling game completion:', e);
        } finally {
            isCancelling = false;
        }
    }

    function getScoringIcon(type: string) {
        switch (type) {
            case "simple":
                return "🧭";
            case "checklist":
                return "🏛️";
            case "attempt_based":
                return "📜";
            case "timed_obstacle":
                return "🛡️";
            default:
                return "🎯";
        }
    }

    function getChallengeIcon(challenge: any) {
        if (challenge.scoringType === "timed_obstacle" && (challenge.config as any)?.mode === "flag_standard") {
            return "🚩";
        }
        return getScoringIcon(challenge.scoringType);
    }

    function getChallengeTypeLabel(challenge: any) {
        if (challenge.scoringType === "timed_obstacle") {
            return (challenge.config as any)?.mode === "flag_standard"
                ? "Lo Stendardo"
                : "Gioco a fasi";
        }
        return typeLabels[challenge.scoringType] || challenge.scoringType;
    }

    const typeLabels: Record<string, string> = {
        simple: "Viaggio",
        checklist: "Costruttore",
        attempt_based: "Sfida",
        time_only: "Tempo",
        timed_obstacle: "Gioco a fasi",
    };

    // Clock Logic
    let currentTime = $state(new Date());
    let clockInterval: any;

    onMount(() => {
        clockInterval = setInterval(() => {
            currentTime = new Date();
        }, 1000);
        return () => clearInterval(clockInterval);
    });

    function formatClockTime(date: Date) {
        return date.toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    }

    function getChallengeDisplayPoints(challenge: any) {
        if (challenge.challengeType === "program") {
            if (challenge.scoringType === "checklist") {
                const config = challenge.config as any;
                return (
                    (challenge.basePoints || 0) +
                    ((config?.checklistItems || 0) * (config?.pointsPerItem || 0))
                );
            }

            if (challenge.scoringType === "attempt_based") {
                const stepsMax = (challenge.steps || []).reduce((total: number, step: any) => {
                    const bestRule = (step.scoringRules || []).reduce(
                        (best: number, rule: any) => Math.max(best, rule.points || 0),
                        0,
                    );
                    return total + bestRule;
                }, 0);
                return (challenge.basePoints || 0) + stepsMax;
            }

            return challenge.basePoints || 0;
        }

        if (challenge.maxPoints != null && challenge.maxPoints > 0) {
            return challenge.maxPoints;
        }

        if (challenge.scoringType === "checklist") {
            const config = challenge.config as any;
            return (
                (challenge.basePoints || 0) +
                ((config?.checklistItems || 0) * (config?.pointsPerItem || 0))
            );
        }

        if (challenge.scoringType === "attempt_based") {
            const stepsMax = (challenge.steps || []).reduce((total: number, step: any) => {
                const bestRule = (step.scoringRules || []).reduce(
                    (best: number, rule: any) => Math.max(best, rule.points || 0),
                    0,
                );
                return total + bestRule;
            }, 0);
            return (challenge.basePoints || 0) + stepsMax;
        }

        return challenge.basePoints || 0;
    }
</script>

<div
    class="min-h-screen bg-white text-zinc-950 p-6 pb-24 font-sans select-none"
>
    <header class="mb-8 flex items-center justify-between">
        <div>
            <h1
                class="text-4xl font-black uppercase tracking-tight text-zinc-950 italic leading-none"
            >
                {data.event.name}
            </h1>
            <p
                class="text-xs font-black text-zinc-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-1"
            >
                <MapPin size={12} />
                {data.event.slug} Dashboard
            </p>
        </div>
        <a
            href="/staff"
            class="text-zinc-400 hover:text-zinc-600 transition-colors"
        >
            <ChevronRight class="rotate-180" size={32} />
        </a>
    </header>

    <!-- Global Clock Card -->
    <div
        class="bg-amber-600 rounded-2xl p-8 text-white shadow-2xl shadow-amber-600/30 mb-10 relative overflow-hidden group"
    >
        <div
            class="absolute -right-10 -top-10 opacity-10 group-hover:rotate-12 transition-transform duration-700"
        >
            <Clock size={200} />
        </div>

        <div class="relative z-10 flex flex-col items-center">
            <span
                class="text-[10px] font-black uppercase tracking-[0.4em] text-amber-200 mb-2"
                >Orologio di Sistema</span
            >
            <div
                class="text-6xl font-black tabular-nums tracking-tighter mb-2 drop-shadow-lg"
            >
                {formatClockTime(currentTime)}
            </div>
            <span
                class="text-[10px] font-bold text-amber-200/60 uppercase tracking-widest"
            >
                {currentTime.toLocaleDateString("it-IT", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                })}
            </span>
        </div>
    </div>

    <!-- Challenges Grouped by Macro-Phase -->
    <div class="space-y-12 mb-12">
        {#each data.event.macroPhases as macroPhase (macroPhase.id)}
            <section class="space-y-6">
                <div class="flex items-center gap-4 px-2">
                    <div class="w-1.5 h-8 bg-amber-500 rounded-full"></div>
                    <h2
                        class="text-2xl font-black uppercase tracking-tight text-zinc-950 italic leading-none"
                    >
                        {macroPhase.name}
                    </h2>
                </div>

                <div class="grid gap-8">
                    {#each macroPhase.phases as phase (phase.id)}
                        <div class="space-y-4">
                            <h3
                                class="px-4 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400"
                            >
                                {phase.name}
                            </h3>
                            <div class="grid gap-4">
                                <!-- Teams in this phase (Filtered by managed factions) -->
                                <!-- Teams in this phase (Filtered by managed factions) - REMOVED AS PER REQUEST -->

                                <!-- Challenges -->
                                <div class="px-4 pb-2">
                                    <span
                                        class="text-[10px] font-black uppercase tracking-widest text-zinc-400"
                                        >Attività</span
                                    >
                                </div>
                                {#each data.challenges.filter((c: any) => c.phaseId === phase.id && c.challengeType !== "game") as challenge}
                                    <a
                                        href="/staff/score?challenge={challenge.id}&eventId={data
                                            .event.id}"
                                        class="group block"
                                    >
                                        <Card.Card
                                            class="p-6 rounded-2xl border-2 border-zinc-100 bg-white hover:border-amber-500 transition-all active:scale-[0.98] shadow-sm hover:shadow-xl hover:shadow-amber-600/5"
                                        >
                                            <div
                                                class="flex items-center justify-between"
                                            >
                                                <div
                                                    class="flex items-center gap-5"
                                                >
                                                    <div
                                                        class="w-20 h-20 rounded-2xl bg-zinc-50 border-2 border-zinc-50 flex items-center justify-center text-4xl group-hover:bg-amber-50 group-hover:border-amber-100 transition-colors shadow-inner overflow-hidden relative"
                                                    >
                                                        <span class="mt-1">
                                                            {getChallengeIcon(challenge)}
                                                        </span>
                                                        {#if data.challengeCompletionStatus[challenge.id]}
                                                            <div
                                                                class="absolute inset-0 bg-green-500/10 flex items-center justify-center backdrop-blur-[1px]"
                                                            >
                                                                <div
                                                                    class="bg-green-500 text-white rounded-full p-1 shadow-lg scale-110"
                                                                >
                                                                    <ArrowRight
                                                                        size={16}
                                                                        class="-rotate-45"
                                                                    />
                                                                </div>
                                                            </div>
                                                        {/if}
                                                    </div>
                                                    <div>
                                                        <div
                                                            class="flex items-center gap-2"
                                                        >
                                                            <h4
                                                                class="font-black text-lg uppercase tracking-tight text-zinc-950 leading-none"
                                                            >
                                                                {challenge.name}
                                                            </h4>
                                                            {#if data.challengeCompletionStatus[challenge.id]}
                                                                <span
                                                                    class="px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-[8px] font-black uppercase tracking-widest"
                                                                    >Completa</span
                                                                >
                                                            {/if}
                                                        </div>
                                                        <div
                                                            class="flex items-center gap-2 mt-2"
                                                        >
                                                            <span
                                                                class="px-2 py-0.5 rounded-lg bg-zinc-100 text-[10px] font-black uppercase tracking-widest text-zinc-500"
                                                            >
                                                                {typeLabels[
                                                                    challenge
                                                                        .scoringType
                                                                ] ||
                                                                    challenge.scoringType}
                                                            </span>
                                                            <span
                                                                class="text-[10px] font-black text-amber-600 uppercase tracking-widest"
                                                            >
                                                                {getChallengeDisplayPoints(challenge)}
                                                                PT MAX
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div
                                                    class="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-amber-600 group-hover:text-white transition-all"
                                                >
                                                    <ArrowRight size={24} />
                                                </div>
                                            </div>
                                        </Card.Card>
                                    </a>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            </section>
        {:else}
            <!-- Fallback if no macro-phases defined -->
            <section class="space-y-6">
                <div class="flex items-center gap-4 px-2">
                    <div class="w-1.5 h-8 bg-zinc-200 rounded-full"></div>
                    <h2
                        class="text-2xl font-black uppercase tracking-tight text-zinc-400 italic"
                    >
                        Tutte le Sfide
                    </h2>
                </div>
                <div class="grid gap-4">
                    {#each data.challenges as challenge}
                        <a
                            href="/staff/score?challenge={challenge.id}&eventId={data
                                .event.id}"
                            class="group block"
                        >
                            <Card.Card
                                class="p-6 rounded-2xl border-2 border-zinc-100 bg-white hover:border-amber-500 transition-all active:scale-[0.98]"
                            >
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-5">
                                        <div
                                            class="w-16 h-16 rounded-xl bg-zinc-50 flex items-center justify-center text-3xl"
                                        >
                                            {getChallengeIcon(challenge)}
                                        </div>
                                        <h4
                                            class="font-black text-lg uppercase tracking-tight text-zinc-950"
                                        >
                                            {challenge.name}
                                        </h4>
                                    </div>
                                    <ArrowRight
                                        size={24}
                                        class="text-zinc-300"
                                    />
                                </div>
                            </Card.Card>
                        </a>
                    {/each}
                </div>
            </section>
        {/each}

        {#if data.challenges.some((c: any) => c.challengeType === "game")}
            <section class="space-y-6">
                <div class="flex items-center gap-4 px-2">
                    <div class="w-1.5 h-8 bg-indigo-500 rounded-full"></div>
                    <h2 class="text-2xl font-black uppercase tracking-tight text-zinc-950 italic leading-none">
                        Giochi
                    </h2>
                </div>
                <div class="grid gap-4">
                    {#each data.challenges.filter((c: any) => c.challengeType === "game") as challenge}
                        {@const completions = (data.gameCompletions || []).filter((gc: any) => gc.gameId === challenge.id)}
                        <div class="space-y-2">
                            <a href="/staff/score?challenge={challenge.id}&eventId={data.event.id}" class="group block">
                                <Card.Card class="p-6 rounded-2xl border-2 border-zinc-100 bg-white hover:border-indigo-500 transition-all active:scale-[0.98] shadow-sm">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-5">
                                            <div class="w-20 h-20 rounded-2xl bg-zinc-50 border-2 border-zinc-50 flex items-center justify-center text-4xl">
                                                {getChallengeIcon(challenge)}
                                            </div>
                                            <div>
                                                <h4 class="font-black text-lg uppercase tracking-tight text-zinc-950 leading-none">{challenge.name}</h4>
                                                <div class="flex items-center gap-2 mt-2">
                                                    <span class="px-2 py-0.5 rounded-lg bg-zinc-100 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                        {getChallengeTypeLabel(challenge)}
                                                    </span>
                                                    <span class="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                                        {getChallengeDisplayPoints(challenge)} PT MAX
                                                    </span>
                                                    {#if completions.length > 0}
                                                        <span class="px-2 py-0.5 rounded-lg bg-indigo-50 text-[10px] font-black uppercase tracking-widest text-indigo-700">
                                                            {completions.length} {completions.length === 1 ? 'squadra' : 'squadre'}
                                                        </span>
                                                    {/if}
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowRight size={24} class="text-zinc-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                                    </div>
                                </Card.Card>
                            </a>

                            {#if completions.length > 0}
                                <div class="bg-zinc-50/90 rounded-2xl border border-zinc-200/80 p-4 space-y-2">
                                    <div class="flex items-center justify-between px-1">
                                        <span class="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                            Squadre registrate ({completions.length})
                                        </span>
                                        <span class="text-[10px] font-bold text-zinc-400">
                                            Annulla per far ripetere il gioco
                                        </span>
                                    </div>
                                    <div class="grid gap-2">
                                        {#each completions as comp}
                                            <div class="bg-white rounded-xl p-3 border border-zinc-200/60 shadow-xs flex items-center justify-between gap-3">
                                                <div class="min-w-0">
                                                    <div class="flex items-center gap-2">
                                                        <span class="font-black text-sm uppercase text-zinc-950 truncate">{comp.teamName}</span>
                                                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded" style="color: {comp.factionColor || '#6366f1'}; background: {comp.factionColor ? comp.factionColor + '15' : '#eef2ff'}">
                                                            {comp.factionName}
                                                        </span>
                                                    </div>
                                                    <div class="text-[11px] font-bold text-zinc-400 mt-0.5">
                                                        {new Date(comp.completedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · <strong class="text-indigo-600 font-black">{comp.totalPoints} pt</strong>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onclick={() => promptCancelCompletion(comp.id, comp.teamName, challenge.name)}
                                                    class="shrink-0 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50/60 hover:bg-red-100 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors active:scale-95 cursor-pointer"
                                                >
                                                    <RotateCcw size={12} />
                                                    Annulla
                                                </button>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            </section>
        {/if}
    </div>

    <!-- Quick Tools Section -->
    <section class="pt-10 border-t-4 border-zinc-100">
        <h2
            class="px-2 mb-6 text-xs font-black uppercase tracking-[0.4em] text-zinc-400"
        >
            Strumenti & Attività
        </h2>

        <div class="grid grid-cols-2 gap-6 mb-12">
            <a
                href="/staff/event/{data.event.id}/ledger"
                class="bg-white border-2 border-zinc-100 rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-amber-500 hover:bg-amber-50/30 active:scale-95 transition-all shadow-sm group"
            >
                <div
                    class="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-inner"
                >
                    <ListChecks size={32} strokeWidth={2.5} />
                </div>
                <span
                    class="font-black uppercase tracking-[0.2em] text-[11px] text-zinc-950"
                    >Registro</span
                >
            </a>

            <a
                href="/staff/event/{data.event.id}/leaderboard"
                class="bg-white border-2 border-zinc-100 rounded-2xl p-8 flex flex-col items-center gap-4 hover:border-amber-600 hover:bg-amber-50/30 active:scale-95 transition-all shadow-sm group"
            >
                <div
                    class="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-amber-600/40 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-inner"
                >
                    <Trophy size={32} strokeWidth={2.5} />
                </div>
                <span
                    class="font-black uppercase tracking-[0.2em] text-[11px] text-zinc-950"
                    >Classifica</span
                >
            </a>
        </div>

        <h2
            class="px-2 mb-6 text-xs font-black uppercase tracking-[0.4em] text-zinc-400"
        >
            Ultimi Punteggi
        </h2>
        <div class="space-y-4">
            {#each data.recentActivity as entry}
                <div
                    class="bg-zinc-50 rounded-xl p-6 flex items-center justify-between border-2 border-transparent hover:border-zinc-200 transition-colors"
                >
                    <div>
                        <div
                            class="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1"
                        >
                            {entry.challengeName}
                        </div>
                        <div
                            class="text-lg font-black uppercase italic text-zinc-950 leading-none"
                        >
                            {entry.teamName}
                        </div>
                        <div
                            class="text-[10px] font-bold text-zinc-400 mt-2 flex items-center gap-1 uppercase"
                        >
                            <Clock size={10} />
                            {new Date(entry.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </div>
                        {#if entry.description}
                            <div class="mt-2 text-xs font-bold text-zinc-500 line-clamp-2">
                                {entry.description}
                            </div>
                        {/if}
                    </div>
                    <div
                        class="text-2xl font-black italic {entry.points > 0
                            ? 'text-green-600'
                            : 'text-red-600'}"
                    >
                        {entry.points > 0 ? "+" : ""}{entry.points}
                    </div>
                </div>
            {:else}
                <div
                    class="bg-zinc-50 rounded-2xl p-12 text-center border-2 border-dashed border-zinc-200"
                >
                    <p class="text-zinc-400 font-bold italic">
                        Nessuna attività recente.
                    </p>
                </div>
            {/each}
        </div>
    </section>

    {#if pendingCancel}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div class="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-zinc-100 space-y-6 animate-in zoom-in-95 duration-200">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border-2 border-red-100">
                        <AlertCircle size={28} />
                    </div>
                    <div>
                        <h3 class="text-xl font-black uppercase italic tracking-tight text-zinc-950">
                            Annulla Gioco
                        </h3>
                        <p class="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                            Permetti di ripetere la prova
                        </p>
                    </div>
                </div>

                <div class="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 space-y-1">
                    <p class="text-sm font-bold text-zinc-700">
                        Vuoi annullare il completamento di <strong class="text-zinc-950 font-black">{pendingCancel.gameName}</strong> per la squadra <strong class="text-zinc-950 font-black">{pendingCancel.teamName}</strong>?
                    </p>
                    <p class="text-xs text-zinc-500 font-medium pt-1">
                        Il completamento verrà eliminato, i punti stornati dalla classifica e la squadra potrà rifare il gioco.
                    </p>
                </div>

                <div class="flex items-center gap-3">
                    <button
                        type="button"
                        disabled={isCancelling}
                        onclick={() => (pendingCancel = null)}
                        class="flex-1 h-14 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-black text-xs uppercase tracking-wider transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        Chiudi
                    </button>
                    <button
                        type="button"
                        disabled={isCancelling}
                        onclick={executeCancelCompletion}
                        class="flex-1 h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider transition-colors active:scale-95 shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {#if isCancelling}
                            <span>Attendere...</span>
                        {:else}
                            <RotateCcw size={16} />
                            <span>Annulla Gioco</span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    :global(body) {
        background-color: white;
    }
</style>
