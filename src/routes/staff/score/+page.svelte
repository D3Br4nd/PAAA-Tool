<script lang="ts">
    import { enhance } from "$app/forms";
    import { getAvatarUrl } from "$lib/utils/avatar";
    import { initialsAvatarDataUri } from "$lib/utils/initials-avatar";
    import {
        calculateFlagScore,
        resolveFlagScoringConfig,
        type FlagAttackOutcome,
        type FlagScoreRole,
    } from "$lib/flag-scoring";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import {
        Search,
        ChevronLeft,
        Target,
        CheckCircle2,
        AlertCircle,
        Trophy,
        User,
        ListChecks,
        ArrowRight,
        RotateCcw,
    } from "lucide-svelte";
    import { invalidateAll } from "$app/navigation";
    let { data, form } = $props() as { data: any; form: any };

    const challenge = $derived(data.challenge);
    const steps = $derived(data.steps || []);
    const factions = $derived(data.factions || []);
    const teams = $derived(data.teams || []);

    let pendingCancel = $state<{ id: string; teamName: string } | null>(null);
    let isCancelling = $state(false);

    function promptCancel(id: string, teamName: string) {
        pendingCancel = { id, teamName };
    }

    async function executeCancel() {
        if (!pendingCancel || isCancelling) return;
        isCancelling = true;
        try {
            const formData = new FormData();
            formData.append('completionId', pendingCancel.id);
            formData.append('challengeId', challenge.id);
            const res = await fetch('?/cancelScore', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                pendingCancel = null;
                await invalidateAll();
            }
        } catch (e) {
            console.error('Error cancelling completion:', e);
        } finally {
            isCancelling = false;
        }
    }

    let isSubmitting = $state(false);
    let searchTerm = $state("");
    let selectedFactionId = $state("");
    let selectedTeamId = $state("");
    let selectedFaction = $derived(
        factions.find((f: any) => f.id === selectedFactionId),
    );
    let selectedTeam = $derived(
        teams.find((t: any) => t.id === selectedTeamId),
    );

    // Scoring state
    let basePoints = $state(0);
    let itemsCompleted = $state(0); // For checklist
    let stepsData = $state<any[]>([]);
    let isRefused = $state(false);
    let completionTime = $state(
        new Date().toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }),
    );

    // Timed Obstacle state
    let timerMode = $state<"stopwatch" | "manual">("stopwatch");
    let timerRunning = $state(false);
    let timerStartTime = $state(0);
    let elapsedMs = $state(0);
    let manualMinutes = $state<number | string>(0);
    let manualSeconds = $state<number | string>(0);
    let timerInterval: ReturnType<typeof setInterval> | null = null;
    let penaltyCount = $state(0);
    let selectedBonusIndex = $state<number | null>(null); // null = no selection
    let phasedGameScores = $state<number[]>([]);
    let flagCarrierHits = $state(0);
    let flagRole = $state<FlagScoreRole>("stalemate");
    let flagAttackOutcome = $state<FlagAttackOutcome>("band_1");

    // Timer & Manual Time functions
    function syncToManual() {
        const totalSecs = Math.floor(elapsedMs / 1000);
        manualMinutes = Math.floor(totalSecs / 60);
        manualSeconds = totalSecs % 60;
    }

    function updateElapsedFromManual() {
        const mins = Math.max(0, parseInt(String(manualMinutes), 10) || 0);
        const secs = Math.max(0, parseInt(String(manualSeconds), 10) || 0);
        elapsedMs = (mins * 60 + secs) * 1000;
    }

    function setTimerMode(mode: "stopwatch" | "manual") {
        if (mode === "manual") {
            stopTimer();
            syncToManual();
        } else {
            updateElapsedFromManual();
        }
        timerMode = mode;
    }

    function adjustManualSeconds(delta: number) {
        const currentMins = Math.max(0, parseInt(String(manualMinutes), 10) || 0);
        const currentSecs = Math.max(0, parseInt(String(manualSeconds), 10) || 0);
        const totalSecs = Math.max(0, currentMins * 60 + currentSecs + delta);
        manualMinutes = Math.floor(totalSecs / 60);
        manualSeconds = totalSecs % 60;
        updateElapsedFromManual();
    }

    function handleManualInput() {
        updateElapsedFromManual();
    }

    function startTimer() {
        if (timerRunning) return;
        timerRunning = true;
        timerStartTime = Date.now() - elapsedMs;
        timerInterval = setInterval(() => {
            elapsedMs = Date.now() - timerStartTime;
        }, 10);
    }

    function stopTimer() {
        if (!timerRunning) return;
        timerRunning = false;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        syncToManual();
    }

    function resetTimer() {
        stopTimer();
        elapsedMs = 0;
        manualMinutes = 0;
        manualSeconds = 0;
        penaltyCount = 0;
        selectedBonusIndex = null;
        phasedGameScores = getPhasedGameSteps().map(() => 0);
        flagCarrierHits = 0;
        flagRole = "stalemate";
        flagAttackOutcome = "band_1";
    }

    function formatTime(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        const hundredths = Math.floor((ms % 1000) / 10);
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${hundredths.toString().padStart(2, "0")}`;
    }

    function getElapsedSeconds(): number {
        return Math.floor(elapsedMs / 1000);
    }

    function captureElapsedMs(): number {
        if (timerMode === "manual") {
            const mins = Math.max(0, parseInt(String(manualMinutes), 10) || 0);
            const secs = Math.max(0, parseInt(String(manualSeconds), 10) || 0);
            return (mins * 60 + secs) * 1000;
        }
        return timerRunning ? Date.now() - timerStartTime : elapsedMs;
    }

    // Find the matching time bracket for elapsed seconds
    function findTimeBracket(seconds: number): {
        basePoints: number;
        timeBonus: number;
    } {
        const brackets = (challenge?.config as any)?.timeBrackets || [];
        // Brackets are sorted by maxSeconds ascending
        for (const bracket of brackets) {
            if (seconds <= bracket.maxSeconds) {
                return {
                    basePoints: bracket.basePoints,
                    timeBonus: bracket.timeBonus,
                };
            }
        }
        // If exceeded all brackets, use the last one (or 0)
        const last = brackets[brackets.length - 1];
        return last
            ? { basePoints: 0, timeBonus: last.timeBonus }
            : { basePoints: 0, timeBonus: 0 };
    }

    // Calculate timed obstacle score
    const timedObstacleScore = $derived(() => {
        if (challenge?.scoringType !== "timed_obstacle") return 0;
        const config = challenge.config as any;
        if (config?.mode === "phased_game" || config?.mode === "templar_triptych") {
            return getPhasedGameScoreItems().reduce((total, item) => total + item.points, 0);
        }
        if (config?.mode === "flag_standard") {
            return getFlagScoreData().total;
        }
        const seconds = getElapsedSeconds();
        const bracket = findTimeBracket(seconds);
        const timeScore = bracket.basePoints + bracket.timeBonus;
        const penaltyTotal = penaltyCount * (config?.penaltyPerObstacle || 0);
        const bonusPoints =
            selectedBonusIndex !== null
                ? config?.bonusOptions?.options?.[selectedBonusIndex]?.points ||
                  0
                : 0;
        return Math.max(0, timeScore + penaltyTotal + bonusPoints);
    });

    $effect(() => {
        if (challenge) {
            basePoints = challenge.basePoints || 0;
            stepsData = steps.map((s: any) => ({
                stepId: s.id,
                name: s.name,
                attempt: 1,
                points: (s.scoringRules?.[0] as any)?.points || 0,
            }));
            phasedGameScores = getPhasedGameSteps().map(() => 0);
        }
    });

    // Derived calculations
    const checklistScore = $derived(
        challenge.scoringType === "checklist"
            ? (challenge.config as any)?.pointsPerItem * itemsCompleted
            : 0,
    );

    const totalCalculatedScore = $derived(() => {
        if (isRefused) return 0;
        if (challenge.scoringType === "timed_obstacle") {
            return timedObstacleScore();
        }
        let total = basePoints;
        if (challenge.scoringType === "checklist") {
            total += checklistScore;
        } else if (challenge.scoringType === "attempt_based") {
            total =
                stepsData.reduce((acc, s) => acc + s.points, 0) +
                challenge.basePoints;
        }
        return total;
    });

    const canSubmit = $derived(
        !!selectedTeamId && !isSubmitting,
    );

    const filteredTeams = $derived(
        teams
            .filter((t: any) => t.factionId === selectedFactionId)
            .filter((t: any) => !(data.completedTeamIds || []).includes(t.id))
            .filter(
                (t: any) =>
                    searchTerm.length < 1 ||
                    t.name.toLowerCase().includes(searchTerm.toLowerCase()),
            ),
    );

    function selectFaction(id: string) {
        selectedFactionId = id;
        selectedTeamId = "";
        searchTerm = "";
    }

    function selectTeam(id: string) {
        selectedTeamId = id;
        searchTerm = "";
    }

    function updateStepAttempt(index: number, attempt: number) {
        const step = steps[index];
        const rule = (step.scoringRules as any[]).find(
            (r) => r.attempt === attempt,
        );
        stepsData[index].attempt = attempt;
        stepsData[index].points = rule ? rule.points : step.penaltyPoints || 0;
    }

	function hasExplicitFailureRule(step: any): boolean {
		return (step.scoringRules || []).some(
			(rule: any) => Boolean(rule.label) && rule.points === (step.penaltyPoints || 0),
		);
	}

    function getPhasedGameSteps(): Array<{ name: string }> {
        const config = challenge?.config as any;
        if (Array.isArray(config?.phasedGame?.steps) && config.phasedGame.steps.length > 0) {
            return config.phasedGame.steps.map((step: any, index: number) => ({
                name: String(step?.name || "").trim() || `Step ${index + 1}`,
            }));
        }

        // Compatibility with games saved before the generic phased-game model.
        if (config?.mode === "templar_triptych") {
            const legacyCount = [
                config?.triptychSections?.archery,
                config?.triptychSections?.rings,
                config?.triptychSections?.cans,
            ].filter(Boolean).length;
            return Array.from({ length: legacyCount || 3 }, (_, index) => ({
                name: `Step ${index + 1}`,
            }));
        }

        return [];
    }

    function getPhasedGameScoreItems() {
        return getPhasedGameSteps().map((step, index) => ({
            label: step.name,
            points: Math.max(0, Number(phasedGameScores[index]) || 0),
        }));
    }

    function getFlagScoreData() {
        const flagConfig = ((challenge?.config as any)?.flagStandard || {}) as any;
        const carrierHits = Math.min(flagCarrierHits, getFlagCarrierHitLimit());
        const rules = resolveFlagScoringConfig(flagConfig);
        const score = calculateFlagScore({
            role: flagRole,
            attackOutcome: flagAttackOutcome,
            carrierHits,
            ...rules,
        });
        return {
            carrierHits,
            role: flagRole,
            attackOutcome: flagAttackOutcome,
            carrierHitLabel: flagConfig.carrierHitLabel || "Portatore colpito",
            ...rules,
            basePoints: score.basePoints,
            hitPoints: score.hitPoints,
            total: score.total,
        };
    }

    function getFlagCarrierHitLimit() {
        const flagConfig = ((challenge?.config as any)?.flagStandard || {}) as any;
        return resolveFlagScoringConfig(flagConfig).maxCarrierHits;
    }

    function getFlagAttackOutcomeLabel(outcome: FlagAttackOutcome) {
        if (outcome === "spawn") return "Spawn Point raggiunto";
        if (outcome === "band_2") return "Fascia 2 raggiunta";
        return "Fascia 1 raggiunta";
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

    const typeLabels: Record<string, string> = {
        simple: "Viaggio",
        checklist: "Costruttore",
        attempt_based: "Sfida",
        time_only: "Tempo",
        timed_obstacle: "Gioco a fasi",
    };

    const activityLabel = $derived(
        challenge?.config?.mode === "flag_standard"
            ? "Lo Stendardo"
            : typeLabels[challenge.scoringType] || challenge.scoringType,
    );

    const activityIcon = $derived(
        challenge?.config?.mode === "flag_standard"
            ? "🚩"
            : getScoringIcon(challenge.scoringType),
    );
</script>

<div class="flex flex-col min-h-full selection:bg-amber-100">
    <!-- Context Header -->
    <div
        class="bg-white border-b border-zinc-200 p-6 sticky top-20 z-30 shadow-sm"
    >
        <div class="flex items-center gap-6">
            <Button
                variant="ghost"
                size="icon"
                href="/staff/event/{data.eventId}"
                class="h-16 w-16 rounded-2xl shrink-0 hover:bg-zinc-50 border-2 border-zinc-100 shadow-sm"
            >
                <ChevronLeft size={32} />
            </Button>
            <div class="flex items-center gap-5 min-w-0">
                <div
                    class="w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden shadow-inner text-4xl leading-none"
                >
                    <span class="mt-1">
                        {activityIcon}
                    </span>
                </div>
                <div class="min-w-0">
                    <h3
                        class="font-black text-2xl uppercase tracking-tighter truncate text-zinc-950 italic leading-none"
                    >
                        {challenge.name}
                    </h3>
                    <div class="flex items-center gap-3 mt-1.5">
                        <span
                            class="text-[9px] font-black bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full uppercase tracking-widest leading-none"
                        >
                            {activityLabel}
                        </span>
                        <p
                            class="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate"
                        >
                            {challenge.code}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    {#if form?.success}
        <div
            class="p-10 grow flex flex-col items-center justify-center text-center animate-in fade-in zoom-in slide-in-from-bottom-8"
        >
            <div
                class="w-32 h-32 bg-green-500 rounded-xl flex items-center justify-center text-white mb-8 shadow-2xl shadow-green-500/30"
            >
                <CheckCircle2 size={64} />
            </div>
            <h2 class="text-3xl font-black mb-3 uppercase italic text-zinc-950">
                Inviato!
            </h2>
            <p class="text-zinc-500 font-bold text-base mb-10 max-w-[240px]">
                Il punteggio per la squadra è stato registrato correttamente.
            </p>
            <div class="flex flex-col gap-4 w-full max-w-sm">
                <Button
                    onclick={() => {
                        window.location.reload();
                    }}
                    class="h-20 rounded-xl bg-zinc-100 text-zinc-950 font-black uppercase text-sm tracking-widest border-2 border-zinc-200 hover:bg-zinc-200 transition-all active:scale-95"
                >
                    Prossima Squadra
                </Button>
                <Button
                    href="/staff/event/{data.eventId}"
                    class="h-20 rounded-xl bg-amber-600 text-white font-black uppercase text-sm tracking-widest shadow-xl shadow-amber-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                    Torna alla Dashboard
                </Button>
            </div>
        </div>
    {:else}
        <form
            method="POST"
            action="?/submitScore"
            use:enhance={({ formData }) => {
                if (challenge.scoringType === "timed_obstacle") {
                    const submittedElapsedMs = captureElapsedMs();
                    formData.set(
                        "elapsedSeconds",
                        String(Math.floor(submittedElapsedMs / 1000)),
                    );
                    if (timerRunning) {
                        elapsedMs = submittedElapsedMs;
                        stopTimer();
                    }
                }
                isSubmitting = true;
                return async ({ update }) => {
                    await update();
                    isSubmitting = false;
                };
            }}
            class="flex-1 flex flex-col p-6 gap-10 pb-48"
        >
            {#if form?.message}
                <div
                    class="p-4 bg-red-100 border-2 border-red-200 text-red-700 rounded-2xl font-bold animate-in fade-in slide-in-from-top-4"
                >
                    {form.message}
                </div>
            {/if}
            <input type="hidden" name="challengeId" value={challenge.id} />
            <input type="hidden" name="teamId" value={selectedTeamId} />

            <!-- Faction and Team Selection -->
            <div class="space-y-8">
                <div class="space-y-4">
                    <p
                        class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 ml-2"
                    >
                        Fazione
                    </p>

                    {#if selectedFaction}
                        <div
                            class="flex items-center justify-between p-5 bg-amber-600 text-white rounded-xl shadow-2xl shadow-amber-600/20 animate-in slide-in-from-top-4"
                        >
                            <div class="flex items-center gap-4">
                                <div
                                    class="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center overflow-hidden border-2 border-white/10"
                                    style="background-color: {selectedFaction.color || '#d97706'}"
                                >
                                    {#if selectedFaction.avatarUrl}
                                        <img
                                            src={selectedFaction.avatarUrl}
                                            alt=""
                                            class="w-full h-full object-cover"
                                        />
                                    {:else}
                                        <Trophy size={24} class="text-white/80" />
                                    {/if}
                                </div>
                                <span class="font-black text-xl uppercase italic">
                                    {selectedFaction.name}
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onclick={() => selectFaction("")}
                                class="h-11 w-11 text-white hover:bg-white/10 rounded-2xl border border-white/10"
                            >
                                <AlertCircle size={22} />
                            </Button>
                        </div>
                    {:else if factions.length > 0}
                        <div class="grid gap-3">
                            {#each factions as faction}
                                <button
                                    type="button"
                                    onclick={() => selectFaction(faction.id)}
                                    class="w-full p-5 flex items-center gap-4 bg-white border-4 border-zinc-100 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all text-left active:scale-[0.99] shadow-sm"
                                >
                                    <div
                                        class="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 overflow-hidden border-2 border-white shadow-sm"
                                        style="background-color: {faction.color || '#d97706'}"
                                    >
                                        {#if faction.avatarUrl}
                                            <img
                                                src={faction.avatarUrl}
                                                alt=""
                                                class="w-full h-full object-cover"
                                            />
                                        {:else}
                                            <Trophy size={24} />
                                        {/if}
                                    </div>
                                    <span class="font-black text-lg uppercase text-zinc-950">
                                        {faction.name}
                                    </span>
                                    <ChevronLeft
                                        class="rotate-180 ml-auto text-zinc-300"
                                        size={24}
                                    />
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <div
                            class="p-6 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl text-center"
                        >
                            <p class="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                                Nessuna fazione disponibile
                            </p>
                        </div>
                    {/if}
                </div>

                <div class="space-y-4 {selectedFactionId ? '' : 'opacity-40 pointer-events-none'}">
                    <p
                        class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 ml-2"
                    >
                        Squadra
                    </p>
                    {#if selectedTeam}
                        <div
                            class="flex items-center justify-between p-6 bg-zinc-950 text-white rounded-xl shadow-2xl animate-in slide-in-from-top-4"
                        >
                            <div class="flex items-center gap-5">
                                <div
                                    class="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden border-2 border-white/5"
                                >
                                    <img
                                        src={getAvatarUrl(
                                            selectedTeam.avatarUrl,
                                            selectedTeam.id || selectedTeam.name,
                                            "team",
                                        )}
                                        alt=""
                                        onerror={(e) => {
                                            const target =
                                                e.currentTarget as HTMLImageElement;
                                            target.src = initialsAvatarDataUri(selectedTeam.name);
                                        }}
                                        class="w-full h-full object-cover"
                                    />
                                </div>
                                <span
                                    class="font-black text-2xl uppercase italic"
                                    >{selectedTeam.name}</span
                                >
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onclick={() => {
                                    selectedTeamId = "";
                                }}
                                class="h-12 w-12 text-white hover:bg-white/10 rounded-2xl border border-white/10"
                            >
                                <AlertCircle size={24} />
                            </Button>
                        </div>
                    {:else}
                        <div class="relative group">
                            <Search
                                class="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-amber-600 transition-colors"
                                size={28}
                            />
                            <input
                                id="team-search"
                                type="text"
                                bind:value={searchTerm}
                                placeholder={selectedFactionId ? "Cerca squadra..." : "Seleziona prima la fazione"}
                                class="w-full h-20 pl-16 pr-6 bg-white border-4 border-zinc-100 rounded-xl outline-none focus:border-amber-500 transition-all font-black text-lg placeholder:text-zinc-300 shadow-sm"
                            />
                        </div>

                        {#if filteredTeams.length > 0}
                            <div
                                class="bg-white border-2 border-zinc-100 rounded-xl overflow-hidden divide-y divide-zinc-100 shadow-2xl relative z-20"
                            >
                                {#each filteredTeams as team}
                                    <button
                                        type="button"
                                        onclick={() => selectTeam(team.id)}
                                        class="w-full p-6 flex items-center gap-5 hover:bg-zinc-50 transition-colors text-left active:bg-zinc-100"
                                    >
                                        <div
                                            class="w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 shrink-0 overflow-hidden border-2 border-zinc-100"
                                        >
                                            <img
                                                src={getAvatarUrl(
                                                    team.avatarUrl,
                                                    team.id || team.name,
                                                    "team",
                                                )}
                                                alt=""
                                                onerror={(e) => {
                                                    const target =
                                                        e.currentTarget as HTMLImageElement;
                                                    target.src = initialsAvatarDataUri(team.name);
                                                }}
                                                class="w-full h-full object-cover"
                                            />
                                        </div>
                                        <span
                                            class="font-black text-lg uppercase text-zinc-950"
                                            >{team.name}</span
                                        >
                                        <ChevronLeft
                                            class="rotate-180 ml-auto text-zinc-300"
                                            size={24}
                                        />
                                    </button>
                                {/each}
                            </div>
                        {:else if selectedFactionId}
                            <div
                                class="p-6 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl text-center"
                            >
                                <p class="text-sm font-bold text-zinc-400 uppercase tracking-widest">
                                    Nessuna squadra disponibile in questa fazione
                                </p>
                            </div>
                        {/if}
                    {/if}
                </div>

                {#if selectedTeamId}
                    <!-- Completion Time Input -->
                    {#if challenge.scoringType !== "timed_obstacle"}
                        <div class="space-y-4 animate-in slide-in-from-top-4">
                            <p
                                class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 ml-2"
                            >
                                Orario di Completamento
                            </p>
                            <div class="relative">
                                <input
                                    id="completion-time"
                                    type="time"
                                    step="1"
                                    name="completionTime"
                                    bind:value={completionTime}
                                    class="w-full h-20 px-8 bg-white border-4 border-zinc-100 rounded-xl outline-none focus:border-amber-500 transition-all font-black text-2xl text-zinc-950 shadow-sm"
                                />
                            </div>
                        </div>
                    {/if}

                    <!-- Refusal Toggle -->
                    <div class="space-y-4 animate-in slide-in-from-top-4">
                        <p
                            class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 ml-2"
                        >
                            Stato Prova
                        </p>
                        <div class="flex gap-4">
                            <button
                                type="button"
                                onclick={() => (isRefused = false)}
                                class="flex-1 h-16 rounded-2xl font-black uppercase text-sm border-2 transition-all {!isRefused
                                    ? 'bg-zinc-950 text-white border-zinc-950 shadow-lg'
                                    : 'bg-white text-zinc-400 border-zinc-100 hover:bg-zinc-50'}"
                            >
                                In Corso / Completata
                            </button>
                            <button
                                type="button"
                                onclick={() => (isRefused = true)}
                                class="flex-1 h-16 rounded-2xl font-black uppercase text-sm border-2 transition-all {isRefused
                                    ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20'
                                    : 'bg-white text-zinc-400 border-zinc-100 hover:bg-zinc-50'}"
                            >
                                Rifiutata
                            </button>
                        </div>
                        <input
                            type="hidden"
                            name="isRefused"
                            value={isRefused ? "true" : "false"}
                        />
                    </div>
                {/if}
            </div>

            {#if !selectedTeamId && (data.completedTeams || []).length > 0}
                <div class="space-y-4 pt-4 border-t-2 border-zinc-100 animate-in fade-in">
                    <div class="flex items-center justify-between px-1">
                        <div>
                            <p class="text-sm font-black uppercase tracking-[0.2em] text-zinc-950">
                                Squadre già registrate ({data.completedTeams.length})
                            </p>
                            <p class="text-xs font-bold text-zinc-400 mt-0.5">
                                Annulla per permettere alla squadra di ripetere il gioco
                            </p>
                        </div>
                    </div>

                    <div class="grid gap-3">
                        {#each data.completedTeams as comp}
                            <div class="p-4 bg-white border-2 border-zinc-100 rounded-2xl flex items-center justify-between gap-4 shadow-sm hover:border-zinc-200 transition-colors">
                                <div class="flex items-center gap-3.5 min-w-0">
                                    <div
                                        class="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 font-black text-xs shadow-xs"
                                        style="background-color: {comp.factionColor || '#d97706'}"
                                    >
                                        <Trophy size={18} />
                                    </div>
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="font-black text-base uppercase text-zinc-950 truncate">{comp.teamName}</span>
                                            <span
                                                class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                style="color: {comp.factionColor || '#d97706'}; background-color: {comp.factionColor ? comp.factionColor + '15' : '#fef3c7'}"
                                            >
                                                {comp.factionName}
                                            </span>
                                        </div>
                                        <p class="text-[11px] font-bold text-zinc-400 mt-0.5">
                                            {new Date(comp.completedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · <strong class="text-indigo-600 font-black">{comp.totalPoints} pt</strong>
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onclick={() => promptCancel(comp.id, comp.teamName)}
                                    class="shrink-0 px-3.5 py-2 rounded-xl border border-red-200 text-red-700 bg-red-50/60 hover:bg-red-100 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                >
                                    <RotateCcw size={13} />
                                    <span>Annulla</span>
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if selectedTeamId}
                <!-- Scoring Controls -->
                <div
                    class="space-y-12 animate-in fade-in slide-in-from-bottom-8 {isRefused
                        ? 'opacity-30 pointer-events-none grayscale'
                        : ''}"
                >
                    {#if challenge.scoringType === "simple"}
                        <Card.Card
                            class="p-8 rounded-xl border-4 border-zinc-50 bg-white shadow-sm overflow-hidden relative"
                        >
                            <div class="absolute top-0 right-0 p-4 opacity-5">
                                <Target size={120} />
                            </div>
                            <h4
                                class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 mb-8 flex items-center gap-2"
                            >
                                <Trophy size={18} /> Punteggio Base
                            </h4>
                            <div
                                class="flex items-center justify-between gap-6 relative z-10"
                            >
                                <span
                                    class="text-xl font-black uppercase italic text-zinc-950"
                                    >Completamento</span
                                >
                                <div
                                    class="text-5xl font-black text-amber-600 italic leading-none"
                                >
                                    {challenge.basePoints}<span
                                        class="text-lg ml-1 font-bold">PT</span
                                    >
                                </div>
                            </div>
                            <input
                                type="hidden"
                                name="basePoints"
                                value={challenge.basePoints}
                            />
                        </Card.Card>
                    {:else if challenge.scoringType === "checklist"}
                        <Card.Card
                            class="p-8 rounded-xl border-4 border-zinc-50 bg-white shadow-sm space-y-10"
                        >
                            <h4
                                class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2"
                            >
                                <ListChecks size={18} /> Elementi Architettonici
                            </h4>

                            <div class="flex flex-col items-center gap-6">
                                <span
                                    class="text-7xl font-black text-amber-600 italic leading-none"
                                >
                                    {itemsCompleted}
                                    <span
                                        class="text-2xl text-zinc-300 not-italic ml-2"
                                        >/ {(challenge.config as any)
                                            ?.checklistItems}</span
                                    >
                                </span>
                                <div class="flex items-center gap-4 w-full">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onclick={() =>
                                            (itemsCompleted = Math.max(
                                                0,
                                                itemsCompleted - 1,
                                            ))}
                                        class="flex-1 h-20 rounded-xl text-4xl font-black border-4 border-zinc-100 hover:bg-zinc-50 active:bg-zinc-100 shadow-sm"
                                        >-</Button
                                    >
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onclick={() =>
                                            (itemsCompleted = Math.min(
                                                (challenge.config as any)
                                                    ?.checklistItems,
                                                itemsCompleted + 1,
                                            ))}
                                        class="flex-1 h-20 rounded-xl text-4xl font-black border-4 border-zinc-100 hover:bg-zinc-50 active:bg-zinc-100 shadow-sm"
                                        >+</Button
                                    >
                                </div>
                            </div>

                            <div
                                class="pt-8 border-t-2 border-zinc-50 flex justify-between items-center"
                            >
                                <span
                                    class="text-xs font-black uppercase tracking-widest text-zinc-400 leading-none"
                                    >Bonus Parziale:</span
                                >
                                <span
                                    class="text-2xl font-black text-amber-600 italic"
                                    >+{checklistScore}
                                    <span class="text-sm font-bold">PT</span
                                    ></span
                                >
                            </div>

                            <input
                                type="hidden"
                                name="basePoints"
                                value={challenge.basePoints}
                            />
                            <input
                                type="hidden"
                                name="extraPoints"
                                value={checklistScore}
                            />
                            <input
                                type="hidden"
                                name="description"
                                value="Checklist: {itemsCompleted} elementi completati"
                            />
                        </Card.Card>
                    {:else if challenge.scoringType === "attempt_based"}
                        <div class="space-y-6">
                            <h4
                                class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 ml-2"
                            >
                                Step di Prova
                            </h4>
                            {#each steps as step, i}
                                <Card.Card
                                    class="p-8 rounded-xl border-4 border-zinc-50 bg-white shadow-sm space-y-6"
                                >
                                    <div
                                        class="flex items-center justify-between border-b-2 border-zinc-50 pb-4"
                                    >
                                        <h5
                                            class="font-black text-lg uppercase italic text-zinc-950 leading-none truncate max-w-[200px]"
                                        >
                                            {step.name}
                                        </h5>
                                        <div
                                            class="text-2xl font-black {stepsData[
                                                i
                                            ].points > 0
                                                ? 'text-green-600'
                                                : stepsData[i].points < 0
                                                  ? 'text-red-600'
                                                  : 'text-zinc-300'} italic"
                                        >
                                            {stepsData[i].points > 0
                                                ? "+"
                                                : ""}{stepsData[i].points}PT
                                        </div>
                                    </div>

                                    <div
                                        class="grid gap-3"
                                        style="grid-template-columns: repeat({step
                                            .scoringRules.length +
											(hasExplicitFailureRule(step) ? 0 : 1)}, minmax(0, 1fr))"
                                    >
                                        {#each step.scoringRules as rule}
                                            <Button
                                                type="button"
                                                variant={stepsData[i]
                                                    .attempt === rule.attempt
                                                    ? "default"
                                                    : "outline"}
                                                onclick={() =>
                                                    updateStepAttempt(
                                                        i,
                                                        rule.attempt,
                                                    )}
                                                class="rounded-2xl h-16 font-black text-sm flex flex-col items-center justify-center gap-0.5 {stepsData[
                                                    i
                                                ].attempt === rule.attempt
                                                    ? 'bg-zinc-950 text-white shadow-lg'
                                                    : 'border-2 border-zinc-100 hover:bg-zinc-50'}"
                                            >
                                                <span
                                                    class="text-[10px] opacity-60"
											>{rule.label || `T${rule.attempt}`}</span
                                                >
                                                <span class="leading-none"
											>{rule.points > 0 ? "+" : ""}{rule.points}P</span
                                                >
                                            </Button>
                                        {/each}
									{#if !hasExplicitFailureRule(step)}
                                        <Button
                                            type="button"
                                            variant={stepsData[i].attempt === 0
                                                ? "destructive"
                                                : "outline"}
                                            onclick={() =>
                                                updateStepAttempt(i, 0)}
                                            class="rounded-2xl h-16 font-black text-sm flex flex-col items-center justify-center gap-0.5 {stepsData[
                                                i
                                            ].attempt === 0
                                                ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                                                : 'border-2 border-zinc-100 hover:bg-zinc-50'}"
                                        >
                                            <span
                                                class="text-[10px] opacity-60 uppercase"
                                                >Err</span
                                            >
                                            <span class="leading-none"
                                                >{step.penaltyPoints}P</span
                                            >
                                        </Button>
									{/if}
                                    </div>
                                </Card.Card>
                            {/each}
                            <input
                                type="hidden"
                                name="stepsData"
                                value={JSON.stringify(stepsData)}
                            />
                        </div>
                    {:else if challenge.scoringType === "timed_obstacle"}
                        <!-- Timed Obstacle UI -->
                        <div class="space-y-6">
                            <!-- Timer Display (Stopwatch or Manual Entry) -->
                            <Card.Card
                                class="p-5 sm:p-8 rounded-xl border-4 border-zinc-50 bg-white shadow-sm overflow-hidden relative"
                            >
                                <div
                                    class="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="120"
                                        height="120"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                        ><circle
                                            cx="12"
                                            cy="12"
                                            r="10"
                                        /><polyline
                                            points="12 6 12 12 16 14"
                                        /></svg
                                    >
                                </div>

                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                                    <h4
                                        class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2"
                                    >
                                        ⏱️ Tempo Registrato
                                    </h4>
                                    <!-- Mode Switcher -->
                                    <div class="inline-flex self-start sm:self-auto rounded-xl bg-zinc-100 p-1 border-2 border-zinc-200">
                                        <button
                                            type="button"
                                            onclick={() => setTimerMode("stopwatch")}
                                            class="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all {timerMode === 'stopwatch' ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}"
                                        >
                                            ⏱️ Cronometro
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() => setTimerMode("manual")}
                                            class="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all {timerMode === 'manual' ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-950'}"
                                        >
                                            ✏️ Manuale (Min : Sec)
                                        </button>
                                    </div>
                                </div>

                                {#if timerMode === "stopwatch"}
                                    <div class="text-center mb-8">
                                        <div
                                            class="text-6xl font-mono font-black text-zinc-950 tracking-tight {timerRunning
                                                ? 'text-green-600'
                                                : ''}"
                                        >
                                            {formatTime(elapsedMs)}
                                        </div>
                                        {#if (challenge.config as any)?.timeLimitSeconds}
                                            <p
                                                class="text-xs font-bold text-zinc-400 mt-2 uppercase tracking-widest"
                                            >
                                                Limite: {Math.floor(
                                                    (challenge.config as any)
                                                        .timeLimitSeconds / 60,
                                                )}:{(
                                                    (challenge.config as any)
                                                        .timeLimitSeconds % 60
                                                )
                                                    .toString()
                                                    .padStart(2, "0")}
                                            </p>
                                        {/if}
                                    </div>
                                    <div class="grid grid-cols-2 gap-4">
                                        {#if !timerRunning}
                                            <Button
                                                type="button"
                                                onclick={startTimer}
                                                class="h-20 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black uppercase text-lg shadow-xl shadow-green-600/30 active:scale-95 transition-all"
                                            >
                                                ▶️ Avvia
                                            </Button>
                                        {:else}
                                            <Button
                                                type="button"
                                                onclick={stopTimer}
                                                class="h-20 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-lg shadow-xl shadow-red-600/30 active:scale-95 transition-all"
                                            >
                                                ⏹️ Ferma
                                            </Button>
                                        {/if}
                                        <Button
                                            type="button"
                                            onclick={resetTimer}
                                            class="h-20 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black uppercase text-lg border-2 border-zinc-200 active:scale-95 transition-all"
                                        >
                                            🔄 Reset
                                        </Button>
                                    </div>
                                {:else}
                                    <!-- Manual Minutes : Seconds Input -->
                                    <div class="space-y-6">
                                        <div class="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                                            <label class="block rounded-2xl border-4 border-zinc-100 bg-zinc-50 p-4 text-center focus-within:border-amber-400 focus-within:bg-white transition-all cursor-pointer">
                                                <span class="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">
                                                    Minuti
                                                </span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="999"
                                                    step="1"
                                                    inputmode="numeric"
                                                    bind:value={manualMinutes}
                                                    oninput={handleManualInput}
                                                    class="w-full h-16 bg-transparent text-center text-4xl sm:text-5xl font-mono font-black text-zinc-950 outline-none"
                                                    placeholder="0"
                                                />
                                            </label>
                                            <label class="block rounded-2xl border-4 border-zinc-100 bg-zinc-50 p-4 text-center focus-within:border-amber-400 focus-within:bg-white transition-all cursor-pointer">
                                                <span class="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">
                                                    Secondi
                                                </span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="59"
                                                    step="1"
                                                    inputmode="numeric"
                                                    bind:value={manualSeconds}
                                                    oninput={handleManualInput}
                                                    class="w-full h-16 bg-transparent text-center text-4xl sm:text-5xl font-mono font-black text-zinc-950 outline-none"
                                                    placeholder="0"
                                                />
                                            </label>
                                        </div>

                                        <!-- Quick Stepper Buttons -->
                                        <div class="flex flex-wrap items-center justify-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onclick={() => adjustManualSeconds(60)}
                                                class="rounded-xl font-black text-xs h-11 px-3.5 border-2 border-zinc-200 hover:bg-zinc-100 active:scale-95"
                                            >
                                                +1m
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onclick={() => adjustManualSeconds(30)}
                                                class="rounded-xl font-black text-xs h-11 px-3.5 border-2 border-zinc-200 hover:bg-zinc-100 active:scale-95"
                                            >
                                                +30s
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onclick={() => adjustManualSeconds(10)}
                                                class="rounded-xl font-black text-xs h-11 px-3.5 border-2 border-zinc-200 hover:bg-zinc-100 active:scale-95"
                                            >
                                                +10s
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onclick={() => adjustManualSeconds(-10)}
                                                class="rounded-xl font-black text-xs h-11 px-3.5 border-2 border-zinc-200 hover:bg-zinc-100 text-red-600 active:scale-95"
                                            >
                                                -10s
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onclick={() => {
                                                    manualMinutes = 0;
                                                    manualSeconds = 0;
                                                    updateElapsedFromManual();
                                                }}
                                                class="rounded-xl font-black text-xs h-11 px-3.5 border-2 border-zinc-200 text-zinc-500 hover:text-zinc-900 active:scale-95"
                                            >
                                                🔄 Azzera
                                            </Button>
                                        </div>

                                        <div class="flex items-center justify-between rounded-xl bg-amber-50 border-2 border-amber-200 p-4">
                                            <span class="text-xs font-black uppercase tracking-wider text-amber-800">
                                                Tempo Totale:
                                            </span>
                                            <span class="font-mono font-black text-amber-950 text-xl">
                                                {formatTime(elapsedMs)} <span class="text-sm font-bold text-amber-700">({getElapsedSeconds()}s)</span>
                                            </span>
                                        </div>
                                    </div>
                                {/if}

                                <input
                                    type="hidden"
                                    name="elapsedSeconds"
                                    value={getElapsedSeconds()}
                                />
                            </Card.Card>

                            {#if (challenge.config as any)?.mode === "flag_standard"}
                                {@const flagConfig = (challenge.config as any)?.flagStandard || {}}
                                <Card.Card class="p-5 sm:p-8 rounded-xl border-4 border-zinc-50 bg-white shadow-sm space-y-6 overflow-hidden">
                                    <h4 class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                                        🏳️ Lo Stendardo
                                    </h4>

                                    <div class="rounded-2xl border-4 border-zinc-100 p-4 sm:p-5 space-y-4">
                                        <div class="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onclick={() => (flagRole = "attack")}
                                                class="min-h-12 rounded-xl border-2 font-black text-xs uppercase {flagRole === 'attack' ? 'border-amber-500 bg-amber-500 text-white' : 'border-zinc-100 bg-white text-zinc-500'}"
                                            >
                                                Attacca
                                            </button>
                                            <button
                                                type="button"
                                                onclick={() => (flagRole = "defense")}
                                                class="min-h-12 rounded-xl border-2 font-black text-xs uppercase {flagRole === 'defense' ? 'border-sky-600 bg-sky-600 text-white' : 'border-zinc-100 bg-white text-zinc-500'}"
                                            >
                                                Difende
                                            </button>
                                            <button
                                                type="button"
                                                onclick={() => (flagRole = "stalemate")}
                                                class="min-h-12 rounded-xl border-2 font-black text-xs uppercase {flagRole === 'stalemate' ? 'border-violet-600 bg-violet-600 text-white' : 'border-zinc-100 bg-white text-zinc-500'}"
                                            >
                                                Stallo
                                            </button>
                                            <button
                                                type="button"
                                                onclick={() => (flagRole = "disqualified")}
                                                class="min-h-12 rounded-xl border-2 font-black text-xs uppercase {flagRole === 'disqualified' ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-100 bg-white text-zinc-500'}"
                                            >
                                                Squalificata
                                            </button>
                                        </div>
                                    </div>

                                    {#if flagRole === "attack"}
                                        <div class="grid gap-3 md:grid-cols-3">
                                            <button
                                                type="button"
                                                onclick={() => (flagAttackOutcome = "band_1")}
                                                class="min-h-20 rounded-2xl border-4 p-4 font-black transition-all {flagAttackOutcome === 'band_1' ? 'border-amber-500 bg-amber-500 text-white shadow-xl shadow-amber-500/30' : 'border-zinc-100 bg-white text-zinc-700 hover:bg-amber-50'}"
                                            >
                                                <span class="block text-sm uppercase">Fascia 1</span>
                                                <span class="block text-3xl italic">{getFlagScoreData().attackerBand1Points}PT</span>
                                            </button>
                                            <button
                                                type="button"
                                                onclick={() => (flagAttackOutcome = "band_2")}
                                                class="min-h-20 rounded-2xl border-4 p-4 font-black transition-all {flagAttackOutcome === 'band_2' ? 'border-orange-500 bg-orange-500 text-white shadow-xl shadow-orange-500/30' : 'border-zinc-100 bg-white text-zinc-700 hover:bg-orange-50'}"
                                            >
                                                <span class="block text-sm uppercase">Fascia 2</span>
                                                <span class="block text-3xl italic">{getFlagScoreData().attackerBand2Points}PT</span>
                                            </button>
                                            <button
                                                type="button"
                                                onclick={() => (flagAttackOutcome = "spawn")}
                                                class="min-h-20 rounded-2xl border-4 p-4 font-black transition-all {flagAttackOutcome === 'spawn' ? 'border-green-600 bg-green-600 text-white shadow-xl shadow-green-600/30' : 'border-zinc-100 bg-white text-zinc-700 hover:bg-green-50'}"
                                            >
                                                <span class="block text-sm uppercase">Spawn Point</span>
                                                <span class="block text-3xl italic">{getFlagScoreData().attackerSpawnPoints}PT</span>
                                            </button>
                                        </div>
                                        <p class="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
                                            In attacco i colpi non assegnano né sottraggono punti.
                                        </p>
                                    {:else if flagRole === "defense" || flagRole === "stalemate"}
                                        <div class="rounded-2xl border-4 border-zinc-100 p-4 sm:p-5 space-y-4">
                                            <div class="rounded-xl bg-zinc-50 p-3 text-sm font-bold text-zinc-700">
                                                {flagRole === "defense"
                                                    ? "Difesa: contano soltanto i colpi sul portatore avversario."
                                                    : "Stallo: 0 punti base più i colpi sul portatore avversario."}
                                            </div>
                                            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 min-w-0">
                                            <div class="min-w-0">
                                                <p class="text-xs font-black uppercase tracking-widest text-zinc-400">
                                                    {flagConfig.carrierHitLabel || "Portatore avversario colpito"}
                                                </p>
                                                <p class="text-sm font-bold text-zinc-500">
                                                    {getFlagScoreData().pointsPerHit}pt per colpo · max {getFlagCarrierHitLimit()} colpi / {getFlagScoreData().maxHitPoints}pt
                                                </p>
                                            </div>
                                            <div class="flex items-center justify-center gap-3 shrink-0">
                                                <Button type="button" onclick={() => (flagCarrierHits = Math.max(0, flagCarrierHits - 1))} class="h-12 w-12 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200">-</Button>
                                                <span class="w-16 text-center text-4xl font-black text-zinc-950">{flagCarrierHits}</span>
                                                <Button
                                                    type="button"
                                                    onclick={() => (flagCarrierHits = Math.min(getFlagCarrierHitLimit(), flagCarrierHits + 1))}
                                                    disabled={flagCarrierHits >= getFlagCarrierHitLimit()}
                                                    class="h-12 w-12 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                                >+</Button>
                                            </div>
                                            </div>
                                        </div>
                                    {:else}
                                        <div class="rounded-2xl border-4 border-red-100 bg-red-50 p-5 text-center text-red-800">
                                            <p class="font-black uppercase">Squalifica per infrazione</p>
                                            <p class="mt-1 text-sm font-bold">La squadra riceve 0 punti.</p>
                                        </div>
                                    {/if}

                                    <input type="hidden" name="flagScoreData" value={JSON.stringify(getFlagScoreData())} />
                                </Card.Card>

                                <Card.Card class="p-6 rounded-xl border-4 border-amber-100 bg-amber-50 shadow-sm">
                                    <h4 class="text-sm font-black uppercase tracking-[0.2em] text-amber-700 mb-4">
                                        📊 Riepilogo Stendardo
                                    </h4>
                                    {@const flagScore = getFlagScoreData()}
                                    <div class="space-y-2 text-sm font-bold">
                                        {#if flagScore.role === "disqualified"}
                                            <div class="flex justify-between gap-3 text-red-700">
                                                <span>Squalifica per infrazione</span>
                                                <span>0pt</span>
                                            </div>
                                        {:else if flagScore.role === "attack"}
                                            <div class="flex justify-between gap-3 text-zinc-700">
                                                <span>{getFlagAttackOutcomeLabel(flagScore.attackOutcome)}</span>
                                                <span>+{flagScore.basePoints}pt</span>
                                            </div>
                                        {:else}
                                            {#if flagScore.role === "stalemate"}
                                                <div class="flex justify-between gap-3 text-zinc-700">
                                                    <span>Base stallo</span>
                                                    <span>0pt</span>
                                                </div>
                                            {/if}
                                            <div class="flex justify-between gap-3 text-sky-700">
                                                <span>{flagScore.carrierHitLabel} x{flagScore.carrierHits}</span>
                                                <span>+{flagScore.hitPoints}pt</span>
                                            </div>
                                        {/if}
                                        <div class="border-t-2 border-amber-200 pt-2 mt-2 flex justify-between text-lg">
                                            <span class="font-black uppercase text-amber-900">Totale</span>
                                            <span class="font-black text-amber-600 italic">{flagScore.total}pt</span>
                                        </div>
                                    </div>
                                </Card.Card>
                            {:else if (challenge.config as any)?.mode === "phased_game" || (challenge.config as any)?.mode === "templar_triptych"}
                                <Card.Card
                                    class="p-8 rounded-xl border-4 border-zinc-50 bg-white shadow-sm"
                                >
                                    <h4
                                        class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-2"
                                    >
                                        🧩 Step del gioco
                                    </h4>
                                    <div class="grid gap-4 md:grid-cols-2">
                                        {#each getPhasedGameSteps() as step, index}
                                            <label class="rounded-2xl border-4 border-zinc-100 bg-white p-5 text-xs font-black uppercase tracking-widest text-zinc-500">
                                                {step.name}
                                                <span class="mt-1 block text-[10px] font-bold normal-case tracking-normal text-zinc-400">
                                                    Inserisci il punteggio totale dello step
                                                </span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    inputmode="numeric"
                                                    bind:value={phasedGameScores[index]}
                                                    class="mt-3 h-20 w-full rounded-xl border-4 border-zinc-100 bg-zinc-50 px-4 text-center text-4xl font-black text-zinc-950 outline-none focus:border-amber-400"
                                                />
                                            </label>
                                        {/each}
                                    </div>
                                    <input
                                        type="hidden"
                                        name="phaseScores"
                                        value={JSON.stringify(getPhasedGameScoreItems())}
                                    />
                                </Card.Card>

                                <Card.Card
                                    class="p-6 rounded-xl border-4 border-amber-100 bg-amber-50 shadow-sm"
                                >
                                    <h4 class="text-sm font-black uppercase tracking-[0.2em] text-amber-700 mb-4">
                                        📊 Riepilogo Gioco a fasi
                                    </h4>
                                    <div class="space-y-2 text-sm font-bold">
                                        {#each getPhasedGameScoreItems() as phase}
                                            <div class="flex justify-between {phase.points > 0 ? 'text-green-700' : 'text-zinc-400'}">
                                                <span>{phase.label}</span>
                                                <span>{phase.points}pt</span>
                                            </div>
                                        {/each}
                                        {#if getPhasedGameScoreItems().length === 0}
                                            <p class="text-zinc-500">
                                                Nessuno step configurato.
                                            </p>
                                        {/if}
                                        <div class="border-t-2 border-amber-200 pt-2 mt-2 flex justify-between text-lg">
                                            <span class="font-black uppercase text-amber-900">Totale</span>
                                            <span class="font-black text-amber-600 italic">{timedObstacleScore()}pt</span>
                                        </div>
                                    </div>
                                </Card.Card>
                            {:else}

                            <!-- Penalty Counter -->
                            {#if (challenge.config as any)?.penaltyPerObstacle}
                                <Card.Card
                                    class="p-8 rounded-xl border-4 border-zinc-50 bg-white shadow-sm"
                                >
                                    <h4
                                        class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-2"
                                    >
                                        🚧 Ostacoli Caduti
                                        <span
                                            class="text-xs font-bold text-red-500 ml-auto"
                                        >
                                            {(challenge.config as any)
                                                .penaltyPerObstacle}pt/ostacolo
                                        </span>
                                    </h4>
                                    <div
                                        class="flex items-center justify-center gap-6"
                                    >
                                        <Button
                                            type="button"
                                            onclick={() =>
                                                (penaltyCount = Math.max(
                                                    0,
                                                    penaltyCount - 1,
                                                ))}
                                            class="h-20 w-20 rounded-xl text-4xl font-black border-4 border-zinc-100 hover:bg-zinc-50 active:bg-zinc-100 shadow-sm bg-white text-zinc-600"
                                            >-</Button
                                        >
                                        <div class="text-center">
                                            <span
                                                class="text-7xl font-black text-red-600 italic leading-none"
                                            >
                                                {penaltyCount}
                                            </span>
                                            <p
                                                class="text-xs font-bold text-zinc-400 mt-2 uppercase tracking-widest"
                                            >
                                                = {penaltyCount *
                                                    ((challenge.config as any)
                                                        .penaltyPerObstacle ||
                                                        0)}pt
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            onclick={() => penaltyCount++}
                                            class="h-20 w-20 rounded-xl text-4xl font-black border-4 border-zinc-100 hover:bg-zinc-50 active:bg-zinc-100 shadow-sm bg-white text-zinc-600"
                                            >+</Button
                                        >
                                    </div>
                                    <input
                                        type="hidden"
                                        name="penaltyCount"
                                        value={penaltyCount}
                                    />
                                </Card.Card>
                            {/if}

                            <!-- Bonus Options (Quintana) -->
                            {#if (challenge.config as any)?.bonusOptions}
                                <Card.Card
                                    class="p-8 rounded-xl border-4 border-zinc-50 bg-white shadow-sm"
                                >
                                    <h4
                                        class="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-2"
                                    >
                                        🎯 {(challenge.config as any)
                                            .bonusOptions.name || "Bonus"}
                                    </h4>
                                    <div
                                        class="grid gap-3"
                                        style="grid-template-columns: repeat({(
                                            challenge.config as any
                                        ).bonusOptions.options
                                            .length}, minmax(0, 1fr))"
                                    >
                                        {#each (challenge.config as any).bonusOptions.options as opt, i}
                                            <button
                                                type="button"
                                                onclick={() =>
                                                    (selectedBonusIndex =
                                                        selectedBonusIndex === i
                                                            ? null
                                                            : i)}
                                                class="flex flex-col items-center justify-center p-4 h-24 rounded-2xl border-2 transition-all font-black text-sm {selectedBonusIndex ===
                                                i
                                                    ? opt.points > 0
                                                        ? 'border-green-500 bg-green-600 text-white shadow-xl shadow-green-600/40 scale-105'
                                                        : opt.points < 0
                                                          ? 'border-red-500 bg-red-600 text-white shadow-xl shadow-red-600/40 scale-105'
                                                          : 'border-zinc-500 bg-zinc-600 text-white shadow-xl scale-105'
                                                    : 'border-zinc-100 text-zinc-500 hover:bg-zinc-50'}"
                                            >
                                                <span
                                                    class="text-lg leading-none mb-1"
                                                    >{opt.label}</span
                                                >
                                                <span
                                                    class="text-xs opacity-80 {selectedBonusIndex ===
                                                    i
                                                        ? 'text-current'
                                                        : opt.points > 0
                                                          ? 'text-green-600'
                                                          : opt.points < 0
                                                            ? 'text-red-600'
                                                            : 'text-zinc-400'}"
                                                >
                                                    {opt.points > 0
                                                        ? "+"
                                                        : ""}{opt.points}pt
                                                </span>
                                            </button>
                                        {/each}
                                    </div>
                                    <input
                                        type="hidden"
                                        name="bonusPoints"
                                        value={selectedBonusIndex !== null
                                            ? (challenge.config as any)
                                                  .bonusOptions.options[
                                                  selectedBonusIndex
                                              ].points
                                            : 0}
                                    />
                                </Card.Card>
                            {/if}

                            <!-- Score Breakdown -->
                            <Card.Card
                                class="p-6 rounded-xl border-4 border-amber-100 bg-amber-50 shadow-sm"
                            >
                                <h4
                                    class="text-sm font-black uppercase tracking-[0.2em] text-amber-700 mb-4"
                                >
                                    📊 Riepilogo Punteggio
                                </h4>
                                <div class="space-y-2 text-sm font-bold">
                                    <div
                                        class="flex justify-between text-zinc-600"
                                    >
                                        <span
                                            >Tempo ({formatTime(
                                                elapsedMs,
                                            )})</span
                                        >
                                        <span class="text-amber-700"
                                            >{findTimeBracket(
                                                getElapsedSeconds(),
                                            ).basePoints +
                                                findTimeBracket(
                                                    getElapsedSeconds(),
                                                ).timeBonus}pt</span
                                        >
                                    </div>
                                    {#if (challenge.config as any)?.penaltyPerObstacle && penaltyCount > 0}
                                        <div
                                            class="flex justify-between text-red-600"
                                        >
                                            <span
                                                >Penalità ({penaltyCount} ostacoli)</span
                                            >
                                            <span
                                                >{penaltyCount *
                                                    ((challenge.config as any)
                                                        .penaltyPerObstacle ||
                                                        0)}pt</span
                                            >
                                        </div>
                                    {/if}
                                    {#if selectedBonusIndex !== null}
                                        {@const bonusOpt = (
                                            challenge.config as any
                                        ).bonusOptions?.options[
                                            selectedBonusIndex
                                        ]}
                                        <div
                                            class="flex justify-between {bonusOpt?.points >
                                            0
                                                ? 'text-green-600'
                                                : 'text-red-600'}"
                                        >
                                            <span>{bonusOpt?.label}</span>
                                            <span
                                                >{bonusOpt?.points > 0
                                                    ? "+"
                                                    : ""}{bonusOpt?.points}pt</span
                                            >
                                        </div>
                                    {/if}
                                    <div
                                        class="border-t-2 border-amber-200 pt-2 mt-2 flex justify-between text-lg"
                                    >
                                        <span
                                            class="font-black uppercase text-amber-900"
                                            >Totale</span
                                        >
                                        <span
                                            class="font-black text-amber-600 italic"
                                            >{timedObstacleScore()}pt</span
                                        >
                                    </div>
                                </div>
                            </Card.Card>
                            {/if}
                        </div>
                    {/if}

                </div>
            {/if}

            <!-- Submit Button Bar -->
            <div
                class="fixed bottom-0 left-0 right-0 p-6 bg-white/95 backdrop-blur-xl border-t-4 border-zinc-50 z-40 shadow-[0_-20px_40px_rgba(0,0,0,0.05)]"
            >
                <div class="max-w-screen-sm mx-auto flex items-center gap-6">
                    <div class="shrink-0">
                        <span
                            class="text-[10px] font-black uppercase text-zinc-400 block tracking-widest leading-none mb-2"
                            >Totale Calcolato</span
                        >
                        <div
                            class="text-4xl font-black text-amber-600 italic leading-none"
                        >
                            {totalCalculatedScore()}
                            <span
                                class="text-sm font-bold not-italic text-zinc-400"
                                >PT</span
                            >
                        </div>
                    </div>
                    <Button
                        type="submit"
                        disabled={!canSubmit}
                        class="flex-1 h-20 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-base tracking-widest shadow-2xl shadow-amber-600/30 disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {#if isSubmitting}
                            Inviando...
                        {:else}
                            Invia Ora <ArrowRight size={24} />
                        {/if}
                    </Button>
                </div>
            </div>
        </form>
    {/if}

    {#if pendingCancel}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div class="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border-2 border-zinc-100 space-y-6 animate-in zoom-in-95 duration-200">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border-2 border-red-100">
                        <AlertCircle size={28} />
                    </div>
                    <div>
                        <h3 class="text-xl font-black uppercase italic tracking-tight text-zinc-950">
                            Annulla Prova
                        </h3>
                        <p class="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                            Permetti di ripetere il gioco
                        </p>
                    </div>
                </div>

                <div class="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 space-y-1">
                    <p class="text-sm font-bold text-zinc-700">
                        Vuoi annullare il completamento di <strong class="text-zinc-950 font-black">{challenge.name}</strong> per la squadra <strong class="text-zinc-950 font-black">{pendingCancel.teamName}</strong>?
                    </p>
                    <p class="text-xs text-zinc-500 font-medium pt-1">
                        I punti registrati verranno stornati dal totale della squadra, la registrazione rimossa e la squadra tornerà subito selezionabile per un nuovo tentativo.
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
                        onclick={executeCancel}
                        class="flex-1 h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider transition-colors active:scale-95 shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {#if isCancelling}
                            <span>Attendere...</span>
                        {:else}
                            <RotateCcw size={16} />
                            <span>Annulla Prova</span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
