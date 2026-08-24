<script lang="ts">
    import { enhance } from "$app/forms";
    import { page } from "$app/stores";
    import {
        Flag,
        Plus,
        Settings,
        Users,
        Shield,
        ListChecks,
        Target,
        Pencil,
        Trash2,
        Clock,
        MessageSquare,
        Trophy,
        Compass,
        Folder,
        Layers,
        ChevronRight,
        ChevronDown,
        ChevronUp,
        Eye,
        EyeOff,
        Lock,
        Shuffle,
        Swords,
        RotateCcw,
    } from "lucide-svelte";
    import * as Card from "$lib/components/ui/card";
    import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
    import { Button } from "$lib/components/ui/button";
    import { getAvatarUrl } from "$lib/utils/avatar";
    import { resolveFlagScoringConfig } from "$lib/flag-scoring";
    import QRCode from "qrcode";

    let { data, form }: { data: any; form: any } = $props();
    const event = $derived(data.event);
    const activeTab = $derived($page.url.searchParams.get("tab") || "overview");
    const factions = $derived(data.factions || []);
    const codexPuzzles = $derived(data.codexPuzzles || []);
    const codexDecodeLogs = $derived(data.codexDecodeLogs || []);
    const programCompletions = $derived(data.programCompletions || []);
    const phaseOneTimeRows = $derived(data.phaseOneTimeRows || []);
    const triptychTimeRows = $derived(data.triptychTimeRows || []);
    const gameCompletions = $derived(data.gameCompletions || []);
    const phaseThreeRows = $derived(data.phaseThreeRows || []);
    const phaseFourRows = $derived(data.phaseFourRows || []);

    const macroPhases = $derived(data.macroPhases || []);
    const phases = $derived(macroPhases.flatMap((mp: any) => mp.phases || []));
    const challenges = $derived(data.challenges || []);

    // Compute stats
    const stats = $derived([
        {
            label: "Fazioni",
            value: factions.length.toString(),
            icon: Flag,
            color: "text-indigo-600",
        },
        {
            label: "Squadre",
            value: factions
                .reduce((acc: number, f: any) => acc + f.teamCount, 0)
                .toString(),
            icon: Shield,
            color: "text-blue-600",
        },
        {
            label: "Partecipanti",
            value: data.stats?.participantCount.toString() || "0",
            icon: Users,
            color: "text-green-600",
        },
        {
            label: "Fasi",
            value: (data.stats?.phaseCount || 0).toString(),
            icon: ListChecks,
            color: "text-amber-600",
        },
    ]);

    // ========== STATE MANAGEMENT ==========

    // -- Factions --
    let showFactionDialog = $state(false);
    let editingFaction = $state<(typeof data.factions)[0] | null>(null);
    let showDeleteFactionDialog = $state(false);
    let factionToDelete = $state<(typeof data.factions)[0] | null>(null);
    let factionColor = $state("#6366f1");
    let factionDescription = $state("");
    let factionType = $state("");
    let avatarPreview = $state<string | null>(null);
    let avatarFile = $state<File | null>(null);
    let selectedTeamIds = $state<string[]>([]);

    // -- Macro Phases --
    let showMacroPhaseDialog = $state(false);
    let editingMacroPhase = $state<any>(null);
    let macroPhaseName = $state("");
    let showDeleteMacroPhaseDialog = $state(false);
    let macroPhaseToDelete = $state<any>(null);

    // -- Phases --
    let showPhaseDialog = $state(false);
    let editingPhase = $state<any>(null);
    let phaseName = $state("");
    let selectedMacroPhaseId = $state("");
    let showDeletePhaseDialog = $state(false);
    let phaseToDelete = $state<any>(null);

    // -- Challenges --
    let showChallengeDialog = $state(false);
    let editingChallenge = $state<any>(null);
    let showDeleteChallengeDialog = $state(false);
    let challengeToDelete = $state<any>(null);

    let editingPhaseThreeId = $state<string | null>(null);
    let editingPhaseThreeTeamName = $state<string>("");
    let phaseThreeFactionId = $state("");
    let phaseThreeTeamId = $state("");
    let phaseThreeScore = $state(0);

    let editingPhaseFourId = $state<string | null>(null);
    let editingPhaseFourTeamName = $state<string>("");
    let phaseFourFactionId = $state("");
    let phaseFourTeamId = $state("");
    let phaseFourPercent = $state(0);

    let challengeName = $state("");
    let challengeCode = $state("");
    let challengeDescription = $state("");
    let scoringType = $state<
        "checklist" | "attempt_based" | "timed_obstacle" | "simple"
    >("attempt_based");
    let basePoints = $state(0);
    let maxPoints = $state(0);
    let checklistItems = $state(5);
    let pointsPerItem = $state(10);
    let selectedPhaseId = $state<string | null>(null);
    let gameMode = $state<"phased_game" | "flag_standard">("phased_game");

    // Timed Obstacle config state
    let timeLimitSeconds = $state(300); // 5 minutes default
    let timerMinutes = $state(5);
    let penaltyPerObstacle = $state(-5);
    let bonusName = $state("Quintana");
    let bonusOptions = $state([
        { label: "Giro ✓", points: 30 },
        { label: "No Giro ✗", points: -30 },
        { label: "Salta", points: 0 },
    ]);
    let timeBrackets = $state([
        { maxSeconds: 60, basePoints: 100, timeBonus: 70 },
        { maxSeconds: 120, basePoints: 100, timeBonus: 40 },
        { maxSeconds: 180, basePoints: 100, timeBonus: 0 },
        { maxSeconds: 240, basePoints: 0, timeBonus: 0 },
        { maxSeconds: 300, basePoints: 0, timeBonus: -40 },
        { maxSeconds: 9999, basePoints: 0, timeBonus: -70 },
    ]);
    let phasedGameSteps = $state([
        { name: "Step 1" },
        { name: "Step 2" },
        { name: "Step 3" },
    ]);
    let flagTimerMinutes = $state(3);
    let carrierHitLabel = $state("Portatore colpito");
    let flagPointsPerHit = $state(10);
    let maxCarrierHits = $state(7);
    let maxHitPoints = $state(70);
    let attackerBand1Points = $state(50);
    let attackerBand2Points = $state(100);
    let attackerSpawnPoints = $state(150);

    let challengeSteps = $state<
        Array<{
            code: string;
            name: string;
            scoringRules: Array<{ attempt: number; points: number; label?: string }>;
            penaltyPoints: number;
            isBlocking: boolean;
        }>
    >([]);

    // -- Codex Janara --
    let showCodexDialog = $state(false);
    let codexText = $state("");
    let codexKeyword = $state("");
    let codexFactionId = $state("");
    let codexPoints = $state(0);
    let showDeleteCodexDialog = $state(false);
    let codexToDelete = $state<any>(null);
    let editingCodex = $state<any>(null);
    let puzzleQrCodes = $state<Record<string, string>>({});
    let copiedPuzzleId = $state<string | null>(null);
    let showResetConfirmation = $state(false);
    let resetConfirmation = $state<{
        title: string;
        message: string;
        confirmLabel: string;
        action: () => Promise<void>;
    } | null>(null);

    $effect(() => {
        // Full UUIDs avoid collisions between UUIDv7 puzzles created together.
        if (event?.slug && codexPuzzles.length > 0) {
            codexPuzzles.forEach(async (puzzle: any) => {
                if (!puzzleQrCodes[puzzle.id]) {
                    const url = `${window.location.origin}/${event.slug}/codex-janara/${puzzle.id}`;
                    QRCode.toDataURL(
                        url,
                        { width: 400, margin: 1 },
                        (err, url) => {
                            if (!err) puzzleQrCodes[puzzle.id] = url;
                        },
                    );
                }
            });
        }
    });

    function openCreateCodexDialog() {
        editingCodex = null;
        codexText = "";
        codexKeyword = "";
        codexFactionId = "";
        codexPoints = 0;
        showCodexDialog = true;
    }

    function openEditCodexDialog(p: any) {
        editingCodex = p;
        codexText = p.plaintext || "";
        codexKeyword = p.keyword || "";
        codexFactionId = p.factionId;
        codexPoints = p.pointsOnDecode || 0;
        showCodexDialog = true;
    }

    function closeCodexDialog() {
        showCodexDialog = false;
    }

    function triggerDeleteCodex(p: any) {
        codexToDelete = p;
        showDeleteCodexDialog = true;
    }

    function openResetConfirmation(options: NonNullable<typeof resetConfirmation>) {
        resetConfirmation = options;
        showResetConfirmation = true;
    }

    function runResetConfirmation() {
        const action = resetConfirmation?.action;
        resetConfirmation = null;
        if (action) void action();
    }

    function cancelResetConfirmation() {
        resetConfirmation = null;
    }

    function resetCodexDecode(logId: string) {
        openResetConfirmation({
            title: "Riabilita decodifica",
            message: "Riabilitare questa decodifica e stornare i punti associati?",
            confirmLabel: "Riabilita",
            action: async () => {
                const res = await fetch(`/api/codex/decode-log/${logId}`, { method: "DELETE" });
                if (res.ok) location.reload();
            },
        });
    }

    function resetProgramCompletion(id: string) {
        openResetConfirmation({
            title: "Ripristina attività",
            message: "Ripristinare questa attività e stornare i punti associati?",
            confirmLabel: "Ripristina",
            action: async () => {
                const res = await fetch(`/api/program/completions/${id}`, { method: "DELETE" });
                if (res.ok) location.reload();
            },
        });
    }

    function resetGameCompletion(id: string, teamName?: string, gameName?: string) {
        openResetConfirmation({
            title: "Annulla gioco squadra",
            message: `Sei sicuro di voler annullare il completamento di "${gameName || 'questo gioco'}" per la squadra "${teamName || 'selezionata'}"? Il completamento verrà eliminato, i punti stornati e la squadra potrà rifare il gioco.`,
            confirmLabel: "Annulla gioco",
            action: async () => {
                const res = await fetch(`/api/games/completions/${id}`, { method: "DELETE" });
                if (res.ok) location.reload();
            },
        });
    }

    function closeDeleteCodexDialog() {
        showDeleteCodexDialog = false;
        codexToDelete = null;
    }

    // ========== FACTION FUNCTIONS ==========

    function openCreateFactionDialog() {
        editingFaction = null;
        selectedTeamIds = [];
        factionColor = "#6366f1";
        factionDescription = "";
        factionType = "";
        avatarPreview = null;
        avatarFile = null;
        showFactionDialog = true;
    }

    function openEditFactionDialog(faction: any) {
        editingFaction = faction;
        selectedTeamIds = faction.teams.map((t: any) => t.id);
        factionColor = faction.color || "#6366f1";
        factionDescription = faction.description || "";
        factionType = faction.factionType || "";
        avatarPreview = faction.avatarUrl;
        avatarFile = null;
        showFactionDialog = true;
    }

    function closeFactionDialog() {
        showFactionDialog = false;
        editingFaction = null;
    }

    function triggerDeleteFaction(faction: any) {
        factionToDelete = faction;
        showDeleteFactionDialog = true;
    }

    function closeDeleteFactionDialog() {
        showDeleteFactionDialog = false;
        factionToDelete = null;
    }

    function handleAvatarChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            avatarFile = input.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                avatarPreview = e.target?.result as string;
            };
            reader.readAsDataURL(avatarFile);
        }
    }

    function toggleTeam(id: string) {
        if (selectedTeamIds.includes(id)) {
            selectedTeamIds = selectedTeamIds.filter((i) => i !== id);
        } else {
            selectedTeamIds = [...selectedTeamIds, id];
        }
    }

    // ========== MACRO PHASE FUNCTIONS ==========

    function openCreateMacroPhaseDialog() {
        editingMacroPhase = null;
        macroPhaseName = "";
        showMacroPhaseDialog = true;
    }

    function openEditMacroPhaseDialog(mp: any) {
        editingMacroPhase = mp;
        macroPhaseName = mp.name;
        showMacroPhaseDialog = true;
    }

    function closeMacroPhaseDialog() {
        showMacroPhaseDialog = false;
        editingMacroPhase = null;
        macroPhaseName = "";
    }

    function triggerDeleteMacroPhase(mp: any) {
        macroPhaseToDelete = mp;
        showDeleteMacroPhaseDialog = true;
    }

    function closeDeleteMacroPhaseDialog() {
        showDeleteMacroPhaseDialog = false;
        macroPhaseToDelete = null;
    }

    // ========== PHASE FUNCTIONS ==========

    function openCreatePhaseDialog(macroId: string) {
        selectedMacroPhaseId = macroId;
        editingPhase = null;
        phaseName = "";
        showPhaseDialog = true;
    }

    function openEditPhaseDialog(phase: any) {
        editingPhase = phase;
        phaseName = phase.name;
        showPhaseDialog = true;
    }

    function closePhaseDialog() {
        showPhaseDialog = false;
        editingPhase = null;
        phaseName = "";
    }

    function triggerDeletePhase(p: any) {
        phaseToDelete = p;
        showDeletePhaseDialog = true;
    }

    function closeDeletePhaseDialog() {
        showDeletePhaseDialog = false;
        phaseToDelete = null;
    }

    // ========== CHALLENGE FUNCTIONS ==========

    function openCreateChallengeDialog(phaseId: string | null = null) {
        editingChallenge = null;
        const nextChallengeType =
            phaseId !== null || activeTab === "program" ? "program" : "game";
        challengeName = "";
        challengeCode = nextChallengeType === "game" ? "GIOCO_FASI" : "";
        challengeDescription = nextChallengeType === "game"
            ? "Gioco composto da più step, ciascuno con un punteggio totale inserito dallo staff."
            : "";
        scoringType = nextChallengeType === "game" ? "timed_obstacle" : "attempt_based";
        basePoints = 0;
        maxPoints = 0;
        checklistItems = 5;
        pointsPerItem = 10;
        challengeSteps = [];
        timerMinutes = 5;
        flagTimerMinutes = 3;
        gameMode = "phased_game";
        phasedGameSteps = [
            { name: "Step 1" },
            { name: "Step 2" },
            { name: "Step 3" },
        ];
        carrierHitLabel = "Portatore colpito";
        flagPointsPerHit = 10;
        maxCarrierHits = 7;
        maxHitPoints = 70;
        attackerBand1Points = 50;
        attackerBand2Points = 100;
        attackerSpawnPoints = 150;
        selectedPhaseId = phaseId;
        // Determine type by context: if phaseId provided or on program tab -> program; else -> game
        dialogChallengeType = nextChallengeType;
        showChallengeDialog = true;
    }

    function openEditChallengeDialog(challenge: any) {
        editingChallenge = challenge;
        challengeName = challenge.name;
        challengeCode = challenge.code;
        challengeDescription = challenge.description || "";
        scoringType = challenge.scoringType as any;
        basePoints = challenge.basePoints;
        maxPoints = challenge.challengeType === "program"
            ? getProgramChallengeMaxPoints(challenge)
            : challenge.maxPoints || 0;
        selectedPhaseId = challenge.phaseId || null;
        checklistItems = (challenge.config as any)?.checklistItems || 5;
        pointsPerItem = (challenge.config as any)?.pointsPerItem || 10;
        // Set dialog type from the DB field
        dialogChallengeType = challenge.challengeType === 'game' ? 'game' : 'program';

        // Load timed_obstacle config
        if (challenge.scoringType === "timed_obstacle") {
            timeLimitSeconds =
                (challenge.config as any)?.timeLimitSeconds || 300;
            timerMinutes = Math.max(1, Math.round(timeLimitSeconds / 60));
            penaltyPerObstacle =
                (challenge.config as any)?.penaltyPerObstacle || -5;
            bonusName =
                (challenge.config as any)?.bonusOptions?.name || "Quintana";
            const config = challenge.config as any;
            const legacySections = config?.triptychSections;
            gameMode = config?.mode === "flag_standard" ? "flag_standard" : "phased_game";
            phasedGameSteps = config?.phasedGame?.steps?.length
                ? config.phasedGame.steps.map((step: any, index: number) => ({
                    name: String(step?.name || "").trim() || `Step ${index + 1}`,
                }))
                : legacySections
                    ? [legacySections.archery, legacySections.rings, legacySections.cans]
                        .filter(Boolean)
                        .map((_: any, index: number) => ({ name: `Step ${index + 1}` }))
                    : [{ name: "Step 1" }, { name: "Step 2" }, { name: "Step 3" }];
            const flagConfig = (challenge.config as any)?.flagStandard;
            const flagRules = resolveFlagScoringConfig(flagConfig);
            flagTimerMinutes = Math.max(1, Math.round(timeLimitSeconds / 60));
            carrierHitLabel = flagConfig?.carrierHitLabel || "Portatore colpito";
            flagPointsPerHit = flagRules.pointsPerHit;
            maxCarrierHits = flagRules.maxCarrierHits;
            maxHitPoints = flagRules.maxHitPoints;
            attackerBand1Points = flagRules.attackerBand1Points;
            attackerBand2Points = flagRules.attackerBand2Points;
            attackerSpawnPoints = flagRules.attackerSpawnPoints;
        }

        challengeSteps =
            challenge.steps?.map((s: any) => ({
                code: s.code,
                name: s.name,
                scoringRules: s.scoringRules || [],
                penaltyPoints: s.penaltyPoints || 0,
                isBlocking: s.isBlocking || false,
            })) || [];
        showChallengeDialog = true;
    }

    function closeChallengeDialog() {
        showChallengeDialog = false;
        editingChallenge = null;
    }

    function triggerDeleteChallenge(c: any) {
        challengeToDelete = c;
        showDeleteChallengeDialog = true;
    }

    function closeDeleteChallengeDialog() {
        showDeleteChallengeDialog = false;
        challengeToDelete = null;
    }

    function addStep() {
        challengeSteps = [
            ...challengeSteps,
            {
                code: `STEP_${challengeSteps.length + 1}`,
                name: `Step ${challengeSteps.length + 1}`,
                scoringRules: [
                    { attempt: 1, points: 20 },
                    { attempt: 2, points: 10 },
                    { attempt: 3, points: 0 },
                ],
                penaltyPoints: -30,
                isBlocking: false,
            },
        ];
    }

    function setScoringType(
        type: "checklist" | "attempt_based" | "timed_obstacle" | "simple",
    ) {
        scoringType = type;

        // If it's a new challenge (not editing), apply defaults
        if (!editingChallenge) {
            if (type === "attempt_based") {
                onProgramCodeChange("SCRIBA");
            } else if (type === "checklist") {
                onProgramCodeChange("ARCHITETTO");
            } else if (type === "timed_obstacle") {
                basePoints = 0;
                maxPoints = 0;
                challengeSteps = [];
                timerMinutes = 5;
                flagTimerMinutes = 3;
                gameMode = "phased_game";
                phasedGameSteps = [
                    { name: "Step 1" },
                    { name: "Step 2" },
                    { name: "Step 3" },
                ];
                carrierHitLabel = "Portatore colpito";
                flagPointsPerHit = 10;
                maxCarrierHits = 7;
                maxHitPoints = 70;
                attackerBand1Points = 50;
                attackerBand2Points = 100;
                attackerSpawnPoints = 150;
            }
        }
    }

    function setGameMode(mode: "phased_game" | "flag_standard") {
        gameMode = mode;
        if (!editingChallenge) {
            if (mode === "flag_standard") {
                challengeName = "Lo Stendardo";
                challengeCode = "STENDARDO";
                challengeDescription = "Scontro con stendardo: attacco, difesa, stallo e squalifica con colpi al portatore avversario.";
                maxPoints = 150;
            } else {
                challengeName = "";
                challengeCode = "GIOCO_FASI";
                challengeDescription = "Gioco composto da più step, ciascuno con un punteggio totale inserito dallo staff.";
                maxPoints = 0;
            }
        }
    }

    function addPhasedGameStep() {
        phasedGameSteps = [
            ...phasedGameSteps,
            { name: `Step ${phasedGameSteps.length + 1}` },
        ];
    }

    function removePhasedGameStep(index: number) {
        if (phasedGameSteps.length <= 1) return;
        phasedGameSteps = phasedGameSteps.filter((_, stepIndex) => stepIndex !== index);
    }

    function applyTentativiTemplate(template: "tentativo" | "t2_semplice" | "nessun_preset") {
        basePoints = 100;
        if (template === "tentativo") {
            maxPoints = 150; // 100 base + 50 max attempt
            challengeSteps = [
                {
                    code: "T1",
                    name: "Modello Tentativo",
                    scoringRules: [
                        { attempt: 1, points: 50 },
                        { attempt: 2, points: 30 },
                        { attempt: 3, points: 10 },
                    ],
                    penaltyPoints: -30,
                    isBlocking: true,
                },
            ];
        } else if (template === "nessun_preset") {
            maxPoints = 100;
            challengeSteps = [
                {
                    code: "COMPLETA",
                    name: "Nessun Preset",
                    scoringRules: [{ attempt: 1, points: 0 }],
                    penaltyPoints: 0,
                    isBlocking: true,
                },
            ];
        } else if (template === "t2_semplice") {
            maxPoints = 130;
            challengeSteps = [
                {
                    code: "T2",
                    name: "Modello T2 Semplice",
                    scoringRules: [{ attempt: 1, points: 30 }],
                    penaltyPoints: -50,
                    isBlocking: true,
                },
            ];
        }
    }

    function removeStep(index: number) {
        challengeSteps = challengeSteps.filter((_, i) => i !== index);
    }

    function getScoringTypeBadge(type: string) {
        const map: any = {
            simple: { label: "Semplice", color: "bg-green-100 text-green-700" },
            checklist: {
                label: "Checklist",
                color: "bg-blue-100 text-blue-700",
            },
            attempt_based: {
                label: "Tentativi",
                color: "bg-purple-100 text-purple-700",
            },
        };
        return map[type] || { label: type, color: "bg-gray-100 text-gray-700" };
    }

    function getChallengeBadge(challenge: any) {
        if (challenge.scoringType === "timed_obstacle") {
            if ((challenge.config as any)?.mode === "flag_standard") {
                return { label: "Lo Stendardo", color: "bg-red-100 text-red-700" };
            }
            return { label: "Gioco a fasi", color: "bg-amber-100 text-amber-700" };
        }
        return getScoringTypeBadge(challenge.scoringType);
    }

    function getGameCompletionRows(gameId: string) {
        return gameCompletions
            .filter((completion: any) => completion.gameId === gameId)
            .slice()
            .sort((a: any, b: any) => {
                const pointsDifference = (b.totalPoints || 0) - (a.totalPoints || 0);
                if (pointsDifference !== 0) return pointsDifference;
                const aTime = a.elapsedSeconds ?? Number.POSITIVE_INFINITY;
                const bTime = b.elapsedSeconds ?? Number.POSITIVE_INFINITY;
                return aTime - bTime;
            });
    }

    function formatGameDuration(value: unknown) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) {
            return "Non registrato";
        }
        const totalSeconds = Math.max(0, Math.floor(Number(value)));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return hours > 0
            ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
            : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    function getLastPhaseOnePath(row: any) {
        return [
            { label: "Cavaliere", completedAt: row.paths?.cavaliere?.completedAt },
            { label: "Architetto", completedAt: row.paths?.architetto?.completedAt },
            { label: "Scriba", completedAt: row.paths?.scriba?.completedAt },
        ].sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0))[0]?.label || "—";
    }

    const programCodes = ["SCRIBA", "ARCHITETTO"]; // Programma: Cavaliere is managed by GeoPhase

    // challengeType is set when opening the dialog: 'program' for ?tab=program, 'game' for ?tab=challenges
    let dialogChallengeType = $state<'program' | 'game'>('program');

    const isProgramMode = $derived(
        editingChallenge 
            ? (editingChallenge.challengeType === 'program')
            : dialogChallengeType === 'program'
    );

    const isReservedCodeError = $derived(
        !isProgramMode && programCodes.includes(challengeCode.trim().toUpperCase())
    );

    const availableScoringTypes = $derived(
        isProgramMode
            ? ["attempt_based", "checklist"]
            : ["timed_obstacle"],
    );

    function getScoringTypeLabel(type: string) {
        return type === "checklist"
              ? "Costruttore"
              : type === "attempt_based"
                ? "Sfida"
              : type === "timed_obstacle"
                  ? "Gioco di Fase 2"
                  : type;
    }

    function getProgramChallengesForPhase(phaseId: string) {
        return challenges.filter(
            (c: any) =>
                c.phaseId === phaseId &&
                c.challengeType === 'program',
        );
    }

    function getChallengeDisplayPoints(challenge: any) {
        if (challenge.challengeType === "program") {
            return getProgramChallengeMaxPoints(challenge);
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

    function getProgramChallengeMaxPoints(challenge: any) {
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

    function getGameChallengesForPhase(phaseId: string) {
        return challenges.filter(
            (c: any) =>
                c.phaseId === phaseId &&
                c.challengeType === 'game',
        );
    }

    const unassignedChallenges = $derived(
        challenges.filter(
            (c: any) =>
                !c.phaseId && c.challengeType === 'game',
        ),
    );

    const eventGames = $derived(
        challenges.filter((c: any) => c.challengeType === 'game')
    );

    const phaseThreeAvailableTeams = $derived.by(() => {
        const faction = factions.find((f: any) => f.id === phaseThreeFactionId);
        const usedTeamIds = new Set(
            phaseThreeRows
                .filter((row: any) => row.teamId !== phaseThreeTeamId && row.id !== editingPhaseThreeId)
                .map((row: any) => row.teamId),
        );
        return (faction?.teams || []).filter((team: any) => !usedTeamIds.has(team.id));
    });

    function resetPhaseThreeForm() {
        editingPhaseThreeId = null;
        editingPhaseThreeTeamName = "";
        phaseThreeFactionId = "";
        phaseThreeTeamId = "";
        phaseThreeScore = 0;
    }

    function editPhaseThreeRow(row: any) {
        editingPhaseThreeId = row.id;
        editingPhaseThreeTeamName = row.teamName || "";
        phaseThreeFactionId = row.factionId;
        phaseThreeTeamId = row.teamId;
        phaseThreeScore = row.score ?? 0;

        if (typeof document !== "undefined") {
            const formEl = document.getElementById("phase3-form-card");
            if (formEl) {
                formEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }

    const phaseFourAvailableTeams = $derived.by(() => {
        const faction = factions.find((f: any) => f.id === phaseFourFactionId);
        const usedTeamIds = new Set(
            phaseFourRows
                .filter((row: any) => row.teamId !== phaseFourTeamId && row.id !== editingPhaseFourId)
                .map((row: any) => row.teamId),
        );
        return (faction?.teams || []).filter((team: any) => !usedTeamIds.has(team.id));
    });

    function resetPhaseFourForm() {
        editingPhaseFourId = null;
        editingPhaseFourTeamName = "";
        phaseFourFactionId = "";
        phaseFourTeamId = "";
        phaseFourPercent = 0;
    }

    function editPhaseFourRow(row: any) {
        editingPhaseFourId = row.id;
        editingPhaseFourTeamName = row.teamName || "";
        phaseFourFactionId = row.factionId;
        phaseFourTeamId = row.teamId;
        phaseFourPercent = row.percent ?? 0;

        if (typeof document !== "undefined") {
            const formEl = document.getElementById("phase4-form-card");
            if (formEl) {
                formEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }

    function onProgramCodeChange(code: string) {
        challengeCode = code;
        if (code === "ARCHITETTO") {
            challengeName = "Path dell'Architetto";
            challengeDescription = "Il Costruttore - Focus sulla capacità di analisi del testo e abilità manuale nella riproduzione.";
            scoringType = "checklist";
            basePoints = 50;
            maxPoints = 100;
            checklistItems = 5;
            pointsPerItem = 10;
            challengeSteps = [];
        } else if (code === "SCRIBA") {
            challengeName = "Path dello Scriba";
            challengeDescription = "L'Amministratore - Focus sulla logica, cultura e gestione della pressione.";
            scoringType = "attempt_based";
            basePoints = 100;
            maxPoints = 140;
            challengeSteps = [
                {
                    code: "ENIGMA",
                    name: "Enigma del Santo",
                    scoringRules: [
                        { attempt: 1, points: 20 },
                        { attempt: 2, points: 10 },
                        { attempt: 3, points: 0 },
                    ],
                    penaltyPoints: -30,
                    isBlocking: false,
                },
                {
                    code: "MOSAICO",
                    name: "Il Mosaico/Puzzle",
                    scoringRules: [{ attempt: 1, points: 0 }],
                    penaltyPoints: -30,
                    isBlocking: true,
                },
                {
                    code: "CUSTODE",
                    name: "Il Custode/Parola d'Ordine",
                    scoringRules: [
                        { attempt: 1, points: 20 },
                        { attempt: 2, points: 10 },
                        { attempt: 3, points: 0 },
                    ],
                    penaltyPoints: -30,
                    isBlocking: false,
                },
            ];
        }
    }

    function getChallengesForPhase(phaseId: string) {
        return challenges.filter((c: any) => c.phaseId === phaseId);
    }

    const presetColors = [
        "#ef4444",
        "#f97316",
        "#eab308",
        "#22c55e",
        "#14b8a6",
        "#06b6d4",
        "#3b82f6",
        "#6366f1",
        "#8b5cf6",
        "#a855f7",
        "#ec4899",
        "#f43f5e",
    ];
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
</script>

<div class="p-6 lg:p-12 w-full space-y-12 pb-40">
    <!-- Header -->
    <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-100 dark:border-zinc-800"
    >
        <div class="flex items-center gap-4">
            <div
                class="bg-indigo-600/10 p-3 rounded-2xl border border-indigo-600/20"
            >
                {#if event.logoUrl}
                    <img
                        src={event.logoUrl}
                        alt=""
                        onerror={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.style.display = "none";
                            if (target.parentElement) {
                                target.parentElement.innerHTML =
                                    '<div class="w-8 h-8 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-compass text-indigo-600"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg></div>';
                            }
                        }}
                        class="w-8 h-8 object-contain"
                    />
                {:else}
                    <Compass size={32} class="text-indigo-600" />
                {/if}
            </div>
            <div>
                <h1
                    class="text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase"
                >
                    {event.name}
                </h1>
                <p
                    class="text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-2"
                >
                    <span
                        class="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black uppercase text-zinc-600"
                    >
                        {event.eventType === "other"
                            ? event.classification
                            : event.eventType}
                    </span>
                    Dashboard di Gestione
                </p>
            </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <Button
                variant="outline"
                href="/{event.slug}"
                target="_blank"
                rel="noreferrer"
                class="h-12 px-6 rounded-2xl font-bold"
                ><Eye size={20} class="mr-2" /> Vedi Pubblico</Button
            >
            <Button
                variant="outline"
                href="/{event.slug}/sorteggio"
                target="_blank"
                rel="noreferrer"
                class="h-12 px-6 rounded-2xl font-bold bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-100"
                ><Shuffle size={20} class="mr-2" /> Sorteggio</Button
            >
            <Button
                variant="outline"
                href="/dashboard/events?edit={event.slug}"
                class="h-12 px-6 rounded-2xl font-bold"
                ><Settings size={20} class="mr-2" /> Impostazioni</Button
            >
        </div>
    </div>

    <!-- TAB CONTENT SECTIONS -->
    {#if activeTab === "overview"}
        <!-- Quick Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-300">
            {#each stats as stat}
                <Card.Card
                    class="p-8 rounded-2xl shadow-sm border-2 bg-card border-border hover:border-zinc-300 transition-all group"
                >
                    <div class="flex flex-col items-center text-center">
                        <div
                            class="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform {stat.color}"
                        >
                            <stat.icon size={28} />
                        </div>
                        <p
                            class="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1"
                        >
                            {stat.label}
                        </p>
                        <p class="text-3xl font-black text-foreground">
                            {stat.value}
                        </p>
                    </div>
                </Card.Card>
            {/each}
        </div>

        <section
            class="space-y-3 animate-in fade-in duration-500"
            aria-labelledby="public-pages-title"
        >
            <div class="flex items-center gap-3">
                <Eye size={20} class="text-zinc-500" />
                <h2
                    id="public-pages-title"
                    class="text-lg font-black uppercase text-foreground"
                >
                    Pagine pubbliche
                </h2>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Button
                    variant="outline"
                    href="/{event.slug}"
                    target="_blank"
                    rel="noreferrer"
                    class="h-12 justify-start rounded-xl font-bold"
                >
                    <Eye size={18} class="mr-2 text-zinc-500" /> Overview pubblica
                </Button>
                <Button
                    variant="outline"
                    href="/{event.slug}/fase-3"
                    target="_blank"
                    rel="noreferrer"
                    class="h-12 justify-start rounded-xl font-bold border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-300 dark:hover:bg-cyan-950/50"
                >
                    <Swords size={18} class="mr-2" /> Tabellone Fase 3
                </Button>
                <Button
                    variant="outline"
                    href="/{event.slug}/fase-4"
                    target="_blank"
                    rel="noreferrer"
                    class="h-12 justify-start rounded-xl font-bold border-yellow-200 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-950/50"
                >
                    <Trophy size={18} class="mr-2" /> Tabellone Fase 4
                </Button>
                <Button
                    variant="outline"
                    href="/{event.slug}/sorteggio"
                    target="_blank"
                    rel="noreferrer"
                    class="h-12 justify-start rounded-xl font-bold border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50 dark:border-fuchsia-800 dark:text-fuchsia-300 dark:hover:bg-fuchsia-950/50"
                >
                    <Shuffle size={18} class="mr-2" /> Sorteggio pubblico
                </Button>
            </div>
        </section>

        <!-- Premium Welcome / Modular Navigation Shortcuts Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <Card.Card class="rounded-2xl border-2 border-border shadow-sm p-6 hover:shadow-md transition-all flex flex-col justify-between bg-card">
                <div>
                    <div class="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-4">
                        <Flag size={24} />
                    </div>
                    <h3 class="text-lg font-black uppercase text-foreground">Fazioni</h3>
                    <p class="text-xs text-muted-foreground mt-2 leading-relaxed">
                        Gestisci le fazioni in gara, assegna amministratori, modifica i colori tematici e monitora l'associazione delle squadre e partecipanti.
                    </p>
                </div>
                <Button variant="outline" href="?tab=factions" class="mt-6 rounded-xl font-bold text-xs uppercase h-10 w-full">Gestisci Fazioni</Button>
            </Card.Card>

            <Card.Card class="rounded-2xl border-2 border-border shadow-sm p-6 hover:shadow-md transition-all flex flex-col justify-between bg-card">
                <div>
                    <div class="w-12 h-12 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-4">
                        <Layers size={24} />
                    </div>
                    <h3 class="text-lg font-black uppercase text-foreground">Programma</h3>
                    <p class="text-xs text-muted-foreground mt-2 leading-relaxed">
                        Struttura l'evento definendo le Macro-Fasi temporali e le singole Fasi attive in cui si organizzano le competizioni e le sfide di squadra.
                    </p>
                </div>
                <Button variant="outline" href="?tab=program" class="mt-6 rounded-xl font-bold text-xs uppercase h-10 w-full">Gestisci Programma</Button>
            </Card.Card>

            <Card.Card class="rounded-2xl border-2 border-violet-950/10 dark:border-violet-950/30 bg-violet-50/10 dark:bg-violet-900/10 p-6 flex flex-col justify-between">
                <div>
                    <div class="w-12 h-12 bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200 rounded-2xl flex items-center justify-center mb-4">
                        <Clock size={24} />
                    </div>
                    <h3 class="text-lg font-black uppercase text-violet-800 dark:text-violet-400">Classifiche tempi</h3>
                    <p class="text-xs text-violet-700/80 dark:text-violet-300/80 mt-2 leading-relaxed">
                        Controlla la consegna finale della Fase 1 per fazione e assegna i relativi punti extra.
                    </p>
                </div>
                <Button variant="outline" href="?tab=times" class="mt-6 rounded-xl font-bold text-xs uppercase h-10 w-full border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/50">Apri classifiche</Button>
            </Card.Card>

            <Card.Card class="rounded-2xl border-2 border-border shadow-sm p-6 hover:shadow-md transition-all flex flex-col justify-between bg-card">
                <div>
                    <div class="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-4">
                        <Target size={24} />
                    </div>
                    <h3 class="text-lg font-black uppercase text-foreground">Giochi (Sfide)</h3>
                    <p class="text-xs text-muted-foreground mt-2 leading-relaxed">
                        Configura i giochi a punti dell'evento: percorsi a ostacoli a tempo, checklist di obiettivi, sfide a tentativi o formule di calcolo semplici.
                    </p>
                </div>
                <Button variant="outline" href="?tab=challenges" class="mt-6 rounded-xl font-bold text-xs uppercase h-10 w-full">Gestisci Giochi</Button>
            </Card.Card>

            <Card.Card class="rounded-2xl border-2 border-emerald-950/10 dark:border-emerald-950/30 bg-emerald-50/10 dark:bg-emerald-900/10 p-6 flex flex-col justify-between">
                <div>
                    <div class="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-2xl flex items-center justify-center mb-4">
                        <Lock size={24} />
                    </div>
                    <h3 class="text-lg font-black uppercase text-emerald-800 dark:text-emerald-400">Codex Janara</h3>
                    <p class="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-2 leading-relaxed">
                        Pannello enigmi crittografati: imposta testi segreti per ciascuna fazione, genera i QR code di decodifica e traccia i log in tempo reale.
                    </p>
                </div>
                <Button variant="outline" href="?tab=codex" class="mt-6 rounded-xl font-bold text-xs uppercase h-10 w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50">Apri Codex</Button>
            </Card.Card>

            <Card.Card class="rounded-2xl border-2 border-blue-950/10 dark:border-blue-950/30 bg-blue-50/10 dark:bg-blue-900/10 p-6 flex flex-col justify-between">
                <div>
                    <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-2xl flex items-center justify-center mb-4">
                        <Compass size={24} />
                    </div>
                    <h3 class="text-lg font-black uppercase text-blue-800 dark:text-blue-400">GeoPhase</h3>
                    <p class="text-xs text-blue-700/80 dark:text-blue-300/80 mt-2 leading-relaxed">
                        Gioco geolocalizzato: configura waypoint geografici, definisci i raggi di tolleranza GPS e associa enigmi sbloccabili all'arrivo.
                    </p>
                </div>
                <Button variant="outline" href={`/dashboard/${event.slug}/geophase`} class="mt-6 rounded-xl font-bold text-xs uppercase h-10 w-full border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/50">Configura GeoPhase</Button>
            </Card.Card>

            <Card.Card class="rounded-2xl border-2 border-red-950/10 dark:border-red-950/30 bg-red-50/10 dark:bg-red-900/10 p-6 flex flex-col justify-between">
                <div>
                    <div class="w-12 h-12 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-2xl flex items-center justify-center mb-4">
                        <Trophy size={24} />
                    </div>
                    <h3 class="text-lg font-black uppercase text-red-800 dark:text-red-400">Impostazione Punti</h3>
                    <p class="text-xs text-red-700/80 dark:text-red-300/80 mt-2 leading-relaxed">
                        Riscrivi il punteggio totale corretto delle squadre e registra il motivo nello storico dell'evento.
                    </p>
                </div>
                <Button variant="outline" href="?tab=scores" class="mt-6 rounded-xl font-bold text-xs uppercase h-10 w-full border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50">Imposta Punteggi</Button>
            </Card.Card>

            <Card.Card class="rounded-2xl border-2 border-cyan-950/10 dark:border-cyan-950/30 bg-cyan-50/10 dark:bg-cyan-900/10 p-6 flex flex-col justify-between">
                <div>
                    <div class="w-12 h-12 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded-2xl flex items-center justify-center mb-4">
                        <Swords size={24} />
                    </div>
                    <h3 class="text-lg font-black uppercase text-cyan-800 dark:text-cyan-400">Tabellone Fase 3</h3>
                    <p class="text-xs text-cyan-700/80 dark:text-cyan-300/80 mt-2 leading-relaxed">
                        Inserisci manualmente il punteggio ottenuto da ogni squadra e gestisci la classifica della fase 3.
                    </p>
                </div>
                <Button variant="outline" href="?tab=phase3" class="mt-6 rounded-xl font-bold text-xs uppercase h-10 w-full border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-300 dark:hover:bg-cyan-950/50">Gestisci Fase 3</Button>
            </Card.Card>

            <Card.Card class="rounded-2xl border-2 border-yellow-950/10 dark:border-yellow-950/30 bg-yellow-50/10 dark:bg-yellow-900/10 p-6 flex flex-col justify-between">
                <div>
                    <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-2xl flex items-center justify-center mb-4">
                        <Trophy size={24} />
                    </div>
                    <h3 class="text-lg font-black uppercase text-yellow-800 dark:text-yellow-400">Tabellone Fase 4</h3>
                    <p class="text-xs text-yellow-700/80 dark:text-yellow-300/80 mt-2 leading-relaxed">
                        Gestisci le squadre arrivate alla fase finale e aggiorna la percentuale di completamento verso il tesoro.
                    </p>
                </div>
                <Button variant="outline" href="?tab=phase4" class="mt-6 rounded-xl font-bold text-xs uppercase h-10 w-full border-yellow-200 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-950/50">Gestisci Fase 4</Button>
            </Card.Card>
        </div>

        <!-- Full Width: Recent Activity -->
        <div class="space-y-6 animate-in fade-in duration-500">
            <div class="flex items-center gap-3">
                <Clock size={24} class="text-zinc-400" />
                <h2 class="text-2xl font-black text-foreground">
                    Attività Recente
                </h2>
            </div>
            <Card.Card
                class="rounded-2xl border-2 border-border shadow-sm p-6 bg-card"
            >
                {#if data.recentActivity?.length > 0}
                    <div class="space-y-1">
                        {#each data.recentActivity as activity}
                            <div
                                class="flex items-center gap-4 p-4 hover:bg-muted/50 rounded-xl transition-all"
                            >
                                <div
                                    class="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-indigo-500 shrink-0"
                                >
                                    {#if activity.type === "message_sent"}<MessageSquare
                                            size={18}
                                        />
                                    {:else if activity.type === "score_update"}<Trophy
                                            size={18}
                                        />
                                    {:else if activity.type.includes("faction")}<Flag
                                            size={18}
                                        />
                                    {:else if activity.type.includes("phase")}<Layers
                                            size={18}
                                        />
                                    {:else if activity.type.includes("challenge")}<ListChecks
                                            size={18}
                                        />
                                    {:else}<Clock size={18} />{/if}
                                </div>
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-foreground">
                                        {activity.content}
                                    </p>
                                    <p
                                        class="text-[10px] font-bold text-muted-foreground uppercase opacity-50 mt-0.5"
                                    >
                                        {new Date(
                                            activity.timestamp,
                                        ).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div
                        class="h-24 flex items-center justify-center text-zinc-400 italic text-sm"
                    >
                        Nessuna attività registrata
                    </div>
                {/if}
            </Card.Card>
        </div>

    {:else if activeTab === "times"}
        <div class="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto w-full">
            <div class="flex items-center gap-3">
                <Clock size={26} class="text-violet-600" />
                <div>
                    <h2 class="text-2xl font-black text-foreground">Classifiche tempi</h2>
                    <p class="text-xs text-zinc-500 font-medium mt-1">
                        Tempi ufficiali e assegnazione dei punti extra, separati per fazione.
                    </p>
                </div>
            </div>

            {#if form?.phaseOneBonusError || form?.triptychBonusError}
                <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                    {form.phaseOneBonusError || form.triptychBonusError}
                </div>
            {:else if form?.phaseOneBonusMessage || form?.triptychBonusMessage}
                <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                    {form.phaseOneBonusMessage || form.triptychBonusMessage}
                </div>
            {/if}

            <div id="phase-one-times" class="scroll-mt-28">
                <p class="text-[10px] font-black uppercase tracking-[0.25em] text-violet-500">Fase 1</p>
                <h3 class="mt-1 text-xl font-black text-zinc-900 dark:text-white">Completamento dei tre Path</h3>
                <p class="mt-1 text-xs font-medium text-zinc-500">Cavaliere, Architetto e tutti gli step dello Scriba.</p>
            </div>

            <Card.Card class="rounded-2xl border-2 border-violet-100 bg-violet-50/50 p-6 dark:border-violet-900 dark:bg-violet-950/20">
                <div class="grid gap-4 md:grid-cols-3">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest text-violet-500">Rilevazione automatica</p>
                        <p class="mt-2 text-sm font-bold text-violet-950 dark:text-violet-100">
                            La consegna finale coincide con l’ultimo completamento fra i tre percorsi.
                        </p>
                    </div>
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest text-violet-500">Ordine classifica</p>
                        <p class="mt-2 text-sm font-bold text-violet-950 dark:text-violet-100">
                            Le squadre sono ordinate per ora di consegna separatamente dentro ogni fazione.
                        </p>
                    </div>
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest text-violet-500">Punti extra</p>
                        <p class="mt-2 text-sm font-bold text-violet-950 dark:text-violet-100">
                            Il valore salvato viene aggiunto al punteggio totale e rimane tracciato nel registro.
                        </p>
                    </div>
                </div>
            </Card.Card>

            <div class="space-y-8">
                {#each factions as faction}
                    {@const factionRows = phaseOneTimeRows.filter((row: any) => row.factionId === faction.id)}
                    {@const completedRows = factionRows.filter((row: any) => row.completed)}
                    {@const pendingRows = factionRows.filter((row: any) => !row.completed)}
                    <section class="overflow-hidden rounded-3xl border-2 border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div class="flex flex-col gap-3 border-b border-zinc-100 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                            <div class="flex items-center gap-3">
                                <div class="h-10 w-2 rounded-full" style="background: {faction.color || '#7c3aed'}"></div>
                                <div>
                                    <h3 class="font-black uppercase tracking-wider text-zinc-900 dark:text-white">{faction.name}</h3>
                                    <p class="text-xs font-bold text-zinc-400">
                                        {completedRows.length} completate · {pendingRows.length} in attesa
                                    </p>
                                </div>
                            </div>
                        </div>

                        {#if completedRows.length > 0}
                            <div class="overflow-x-auto">
                                <table class="w-full min-w-[900px] text-left">
                                    <thead class="bg-zinc-50 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:bg-zinc-800/60">
                                        <tr>
                                            <th class="px-5 py-3">Pos.</th>
                                            <th class="px-5 py-3">Squadra</th>
                                            <th class="px-5 py-3">Consegna finale</th>
                                            <th class="px-5 py-3">Percorsi completati</th>
                                            <th class="px-5 py-3">Punti extra</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {#each completedRows as row}
                                            <tr class="align-middle">
                                                <td class="px-5 py-5">
                                                    <span class="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-violet-100 px-3 text-lg font-black text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                                        #{row.rank}
                                                    </span>
                                                </td>
                                                <td class="px-5 py-5">
                                                    <p class="font-black text-zinc-950 dark:text-white">{row.teamName}</p>
                                                    <p class="mt-1 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                                                        Ultimo: {getLastPhaseOnePath(row)}
                                                    </p>
                                                </td>
                                                <td class="px-5 py-5">
                                                    <p class="text-xl font-black tabular-nums text-violet-700 dark:text-violet-300">
                                                        {new Date(row.completedAt).toLocaleTimeString("it-IT")}
                                                    </p>
                                                    <p class="mt-1 text-xs font-bold text-zinc-400">
                                                        {new Date(row.completedAt).toLocaleDateString("it-IT")}
                                                    </p>
                                                </td>
                                                <td class="px-5 py-5">
                                                    <div class="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                                                        <span class="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-700">✓ Cavaliere</span>
                                                        <span class="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-700">✓ Architetto</span>
                                                        <span class="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-700">✓ Scriba</span>
                                                    </div>
                                                </td>
                                                <td class="px-5 py-5">
                                                    <form method="POST" action="?/setPhaseOneTimeBonus" use:enhance class="flex items-center gap-2">
                                                        <input type="hidden" name="teamId" value={row.teamId} />
                                                        <input
                                                            type="number"
                                                            name="extraPoints"
                                                            min="0"
                                                            max="9999"
                                                            step="1"
                                                            value={row.extraPoints}
                                                            aria-label="Punti extra per {row.teamName}"
                                                            class="h-11 w-24 rounded-xl border-2 border-violet-100 bg-white px-3 text-center font-black text-violet-800 outline-none focus:border-violet-500 dark:border-violet-900 dark:bg-zinc-950 dark:text-violet-200"
                                                        />
                                                        <Button type="submit" class="h-11 rounded-xl bg-violet-600 px-4 font-black text-white hover:bg-violet-700">
                                                            Salva
                                                        </Button>
                                                    </form>
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        {:else}
                            <div class="p-8 text-center text-sm font-bold text-zinc-400">
                                Nessuna squadra ha ancora completato tutti e tre i percorsi.
                            </div>
                        {/if}

                        {#if pendingRows.length > 0}
                            <details class="border-t border-zinc-100 p-5 dark:border-zinc-800">
                                <summary class="cursor-pointer text-xs font-black uppercase tracking-wider text-zinc-500">
                                    Mostra squadre in attesa ({pendingRows.length})
                                </summary>
                                <div class="mt-4 grid gap-3 md:grid-cols-2">
                                    {#each pendingRows as row}
                                        <div class="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
                                            <p class="font-black text-zinc-900 dark:text-white">{row.teamName}</p>
                                            <div class="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase">
                                                <span class="rounded-lg px-2 py-2 {row.paths.cavaliere.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700'}">
                                                    Cavaliere {row.paths.cavaliere.completedCount}/{row.paths.cavaliere.requiredCount}
                                                </span>
                                                <span class="rounded-lg px-2 py-2 {row.paths.architetto.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700'}">
                                                    Architetto {row.paths.architetto.completedCount}/{row.paths.architetto.requiredCount}
                                                </span>
                                                <span class="rounded-lg px-2 py-2 {row.paths.scriba.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700'}">
                                                    Scriba {row.paths.scriba.completedCount}/{row.paths.scriba.requiredCount}
                                                </span>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </details>
                        {/if}
                    </section>
                {/each}
            </div>

            <div id="triptych-times" class="scroll-mt-28 border-t-2 border-zinc-100 pt-8 dark:border-zinc-800">
                <p class="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500">Gioco a tempo</p>
                <h3 class="mt-1 text-xl font-black text-zinc-900 dark:text-white">Il Trittico del Templare</h3>
                <p class="mt-1 text-xs font-medium text-zinc-500">
                    Classifica basata sul tempo effettivo registrato dalla PWA quando il giudice invia il punteggio.
                </p>
            </div>

            <Card.Card class="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-6 dark:border-amber-900 dark:bg-amber-950/20">
                <div class="grid gap-4 md:grid-cols-3">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest text-amber-600">Ordine</p>
                        <p class="mt-2 text-sm font-bold text-amber-950 dark:text-amber-100">Vince il tempo più basso all’interno della propria fazione.</p>
                    </div>
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest text-amber-600">Registrazione</p>
                        <p class="mt-2 text-sm font-bold text-amber-950 dark:text-amber-100">Il tempo si ferma automaticamente al momento dell’invio.</p>
                    </div>
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-widest text-amber-600">Punti extra</p>
                        <p class="mt-2 text-sm font-bold text-amber-950 dark:text-amber-100">Il bonus viene aggiunto al totale e resta tracciato nel registro.</p>
                    </div>
                </div>
            </Card.Card>

            <div class="space-y-8">
                {#each factions as faction}
                    {@const factionRows = triptychTimeRows.filter((row: any) => row.factionId === faction.id)}
                    <section class="overflow-hidden rounded-3xl border-2 border-zinc-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <div class="flex items-center gap-3 border-b border-zinc-100 p-5 dark:border-zinc-800">
                            <div class="h-10 w-2 rounded-full" style="background: {faction.color || '#d97706'}"></div>
                            <div>
                                <h4 class="font-black uppercase tracking-wider text-zinc-900 dark:text-white">{faction.name}</h4>
                                <p class="text-xs font-bold text-zinc-400">{factionRows.length} tempi registrati</p>
                            </div>
                        </div>

                        {#if factionRows.length > 0}
                            <div class="overflow-x-auto">
                                <table class="w-full min-w-[850px] text-left">
                                    <thead class="bg-zinc-50 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:bg-zinc-800/60">
                                        <tr>
                                            <th class="px-5 py-3">Pos.</th>
                                            <th class="px-5 py-3">Squadra</th>
                                            <th class="px-5 py-3">Tempo</th>
                                            <th class="px-5 py-3">Punteggio gioco</th>
                                            <th class="px-5 py-3">Registrato</th>
                                            <th class="px-5 py-3">Punti extra</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {#each factionRows as row}
                                            <tr>
                                                <td class="px-5 py-5">
                                                    <span class="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-amber-100 px-3 text-lg font-black text-amber-700 dark:bg-amber-950 dark:text-amber-300">#{row.rank}</span>
                                                </td>
                                                <td class="px-5 py-5 font-black text-zinc-950 dark:text-white">{row.teamName}</td>
                                                <td class="px-5 py-5 text-2xl font-black tabular-nums text-amber-600">{formatGameDuration(row.elapsedSeconds)}</td>
                                                <td class="px-5 py-5 text-sm font-black text-zinc-700 dark:text-zinc-200">{row.totalPoints} pt</td>
                                                <td class="px-5 py-5">
                                                    <p class="text-sm font-black text-zinc-700 dark:text-zinc-200">{new Date(row.completedAt).toLocaleTimeString("it-IT")}</p>
                                                    <p class="mt-1 text-xs font-bold text-zinc-400">{new Date(row.completedAt).toLocaleDateString("it-IT")}</p>
                                                </td>
                                                <td class="px-5 py-5">
                                                    <form method="POST" action="?/setTriptychTimeBonus" use:enhance class="flex items-center gap-2">
                                                        <input type="hidden" name="teamId" value={row.teamId} />
                                                        <input type="hidden" name="gameId" value={row.gameId} />
                                                        <input
                                                            type="number"
                                                            name="extraPoints"
                                                            min="0"
                                                            max="9999"
                                                            step="1"
                                                            value={row.extraPoints}
                                                            aria-label="Punti extra Trittico per {row.teamName}"
                                                            class="h-11 w-24 rounded-xl border-2 border-amber-100 bg-white px-3 text-center font-black text-amber-800 outline-none focus:border-amber-500 dark:border-amber-900 dark:bg-zinc-950 dark:text-amber-200"
                                                        />
                                                        <Button type="submit" class="h-11 rounded-xl bg-amber-500 px-4 font-black text-zinc-950 hover:bg-amber-600">Salva</Button>
                                                    </form>
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        {:else}
                            <div class="p-8 text-center text-sm font-bold text-zinc-400">Nessun tempo Trittico ancora registrato per questa fazione.</div>
                        {/if}
                    </section>
                {/each}
            </div>
        </div>

    {:else if activeTab === "phase3"}
        <div class="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto w-full">
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div class="flex items-center gap-3">
                    <Swords size={24} class="text-cyan-600" />
                    <div>
                        <h2 class="text-2xl font-black text-foreground">Tabellone Fase 3</h2>
                        <p class="text-xs text-zinc-500 font-medium mt-1">
                            Inserisci o aggiorna manualmente il punteggio ottenuto da ciascuna squadra.
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    href="/{event.slug}/fase-3"
                    target="_blank"
                    rel="noreferrer"
                    class="h-11 rounded-xl font-black text-xs uppercase border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-300 dark:hover:bg-cyan-950/50"
                >
                    <Eye size={18} class="mr-2" /> Apri Tabellone Pubblico
                </Button>
            </div>

            {#if form?.error}
                <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                    {form.error}
                </div>
            {/if}

            <Card.Card id="phase3-form-card" class="rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 {editingPhaseThreeId ? 'ring-2 ring-cyan-500 shadow-md' : ''}">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 flex items-center gap-2">
                        {#if editingPhaseThreeId}
                            <Pencil size={16} /> Modifica Punteggio: <span class="text-zinc-950 dark:text-white italic">{editingPhaseThreeTeamName}</span>
                        {:else}
                            <Plus size={16} /> Assegna Punteggio Fase 3
                        {/if}
                    </h3>
                    {#if editingPhaseThreeId}
                        <button
                            type="button"
                            onclick={resetPhaseThreeForm}
                            class="text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                        >
                            ✕ Annulla Modifica
                        </button>
                    {/if}
                </div>
                <form
                    method="POST"
                    action="?/upsertPhaseThreeScore"
                    use:enhance={() => {
                        return async ({ update, result }) => {
                            await update({ reset: false, invalidateAll: true });
                            if (result.type === "success") {
                                resetPhaseThreeForm();
                            }
                        };
                    }}
                    class="grid grid-cols-1 lg:grid-cols-[1fr_1fr_220px_auto] gap-4 lg:items-end"
                >
                    <div class="space-y-2">
                        <label for="phase3-faction" class="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Fazione
                        </label>
                        <select
                            id="phase3-faction"
                            bind:value={phaseThreeFactionId}
                            onchange={() => {
                                if (!editingPhaseThreeId) {
                                    phaseThreeTeamId = "";
                                }
                            }}
                            class="h-12 w-full rounded-xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-sm font-bold outline-none focus:border-cyan-400 disabled:opacity-60"
                            required
                            disabled={!!editingPhaseThreeId}
                        >
                            <option value="">Seleziona fazione</option>
                            {#each factions as faction (faction.id)}
                                <option value={faction.id}>{faction.name}</option>
                            {/each}
                        </select>
                    </div>

                    <div class="space-y-2">
                        <label for="phase3-team" class="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Squadra
                        </label>
                        <select
                            id="phase3-team"
                            name="teamId"
                            bind:value={phaseThreeTeamId}
                            class="h-12 w-full rounded-xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-sm font-bold outline-none focus:border-cyan-400 disabled:opacity-60"
                            required
                            disabled={!phaseThreeFactionId || !!editingPhaseThreeId}
                        >
                            <option value="">{phaseThreeFactionId ? "Seleziona squadra" : "Prima scegli una fazione"}</option>
                            {#each phaseThreeAvailableTeams as team (team.id)}
                                <option value={team.id}>{team.name}</option>
                            {/each}
                            {#if phaseThreeTeamId && !phaseThreeAvailableTeams.some((t: any) => t.id === phaseThreeTeamId)}
                                <option value={phaseThreeTeamId}>{editingPhaseThreeTeamName || "Squadra selezionata"}</option>
                            {/if}
                        </select>
                        {#if editingPhaseThreeId}
                            <input type="hidden" name="teamId" value={phaseThreeTeamId} />
                        {/if}
                    </div>

                    <div class="space-y-2">
                        <label for="phase3-score" class="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Punteggio
                        </label>
                        <input
                            id="phase3-score"
                            name="score"
                            type="number"
                            min="0"
                            step="1"
                            bind:value={phaseThreeScore}
                            class="h-12 w-full rounded-xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-sm font-black outline-none focus:border-cyan-400"
                            required
                        />
                    </div>

                    <div class="flex gap-2">
                        <Button type="submit" class="h-12 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs uppercase px-6" disabled={!phaseThreeTeamId}>
                            {editingPhaseThreeId ? "Aggiorna" : "Salva"}
                        </Button>
                        {#if phaseThreeTeamId || editingPhaseThreeId}
                            <Button type="button" variant="outline" onclick={resetPhaseThreeForm} class="h-12 rounded-xl font-black text-xs uppercase">
                                Annulla
                            </Button>
                        {/if}
                    </div>
                </form>
            </Card.Card>

            <Card.Card class="rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                <div class="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
                    <div>
                        <h3 class="text-lg font-black text-zinc-900 dark:text-white">
                            Squadre in Fase 3
                        </h3>
                        <p class="text-xs text-zinc-500 font-medium mt-1">
                            La classifica pubblica è ordinata dal punteggio più alto.
                        </p>
                    </div>
                    <span class="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        {phaseThreeRows.length} squadre
                    </span>
                </div>

                {#if phaseThreeRows.length > 0}
                    <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {#each phaseThreeRows as row (row.id)}
                            <div class="p-5 grid grid-cols-1 lg:grid-cols-[1fr_220px_auto] gap-4 lg:items-center">
                                <div class="min-w-0">
                                    <div class="flex items-center gap-3">
                                        <div class="w-3 h-10 rounded-full" style="background: {row.factionColor || '#0891b2'}"></div>
                                        <div class="min-w-0">
                                            <p class="font-black text-zinc-900 dark:text-white truncate">{row.teamName}</p>
                                            <p class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                                {row.factionName}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div class="lg:text-right">
                                    <span class="text-3xl font-black tabular-nums text-cyan-600">{row.score}</span>
                                    <span class="ml-1 text-xs font-black uppercase text-zinc-400">pt</span>
                                </div>
                                <div class="flex items-center gap-2 lg:justify-end">
                                    <Button type="button" variant="outline" onclick={() => editPhaseThreeRow(row)} class="h-10 rounded-xl font-black text-xs uppercase">
                                        <Pencil size={16} class="mr-2" /> Modifica
                                    </Button>
                                    <form
                                        method="POST"
                                        action="?/deletePhaseThreeScore"
                                        use:enhance={() => {
                                            return async ({ update }) => {
                                                await update({ reset: false, invalidateAll: true });
                                            };
                                        }}
                                    >
                                        <input type="hidden" name="id" value={row.id} />
                                        <Button type="submit" variant="destructive" class="h-10 rounded-xl font-black text-xs uppercase">
                                            <Trash2 size={16} />
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="p-10 text-center text-sm text-zinc-400 italic">
                        Nessuna squadra inserita nel tabellone Fase 3.
                    </div>
                {/if}
            </Card.Card>
        </div>

    {:else if activeTab === "phase4"}
        <div class="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto w-full">
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div class="flex items-center gap-3">
                    <Trophy size={24} class="text-yellow-600" />
                    <div>
                        <h2 class="text-2xl font-black text-foreground">Tabellone Fase 4</h2>
                        <p class="text-xs text-zinc-500 font-medium mt-1">
                            Inserisci le squadre arrivate alla fase finale e aggiorna la percentuale di avanzamento.
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    href="/{event.slug}/fase-4"
                    target="_blank"
                    rel="noreferrer"
                    class="h-11 rounded-xl font-black text-xs uppercase border-yellow-200 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-950/50"
                >
                    <Eye size={18} class="mr-2" /> Apri Tabellone Pubblico
                </Button>
            </div>

            {#if form?.error}
                <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                    {form.error}
                </div>
            {/if}

            <Card.Card id="phase4-form-card" class="rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 {editingPhaseFourId ? 'ring-2 ring-yellow-500 shadow-md' : ''}">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-sm font-black uppercase tracking-widest text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                        {#if editingPhaseFourId}
                            <Pencil size={16} /> Modifica Avanzamento: <span class="text-zinc-950 dark:text-white italic">{editingPhaseFourTeamName}</span>
                        {:else}
                            <Plus size={16} /> Registra Squadra Fase 4
                        {/if}
                    </h3>
                    {#if editingPhaseFourId}
                        <button
                            type="button"
                            onclick={resetPhaseFourForm}
                            class="text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                        >
                            ✕ Annulla Modifica
                        </button>
                    {/if}
                </div>
                <form
                    method="POST"
                    action="?/upsertPhaseFourProgress"
                    use:enhance={() => {
                        return async ({ update, result }) => {
                            await update({ reset: false, invalidateAll: true });
                            if (result.type === "success") {
                                resetPhaseFourForm();
                            }
                        };
                    }}
                    class="grid grid-cols-1 lg:grid-cols-[1fr_1fr_220px_auto] gap-4 lg:items-end"
                >
                    <input type="hidden" name="percent" value={phaseFourPercent} />
                    <div class="space-y-2">
                        <label for="phase4-faction" class="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Fazione
                        </label>
                        <select
                            id="phase4-faction"
                            bind:value={phaseFourFactionId}
                            onchange={() => {
                                if (!editingPhaseFourId) {
                                    phaseFourTeamId = "";
                                }
                            }}
                            class="h-12 w-full rounded-xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-sm font-bold outline-none focus:border-yellow-400 disabled:opacity-60"
                            required
                            disabled={!!editingPhaseFourId}
                        >
                            <option value="">Seleziona fazione</option>
                            {#each factions as faction (faction.id)}
                                <option value={faction.id}>{faction.name}</option>
                            {/each}
                        </select>
                    </div>

                    <div class="space-y-2">
                        <label for="phase4-team" class="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Squadra
                        </label>
                        <select
                            id="phase4-team"
                            name="teamId"
                            bind:value={phaseFourTeamId}
                            class="h-12 w-full rounded-xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-sm font-bold outline-none focus:border-yellow-400 disabled:opacity-60"
                            required
                            disabled={!phaseFourFactionId || !!editingPhaseFourId}
                        >
                            <option value="">{phaseFourFactionId ? "Seleziona squadra" : "Prima scegli una fazione"}</option>
                            {#each phaseFourAvailableTeams as team (team.id)}
                                <option value={team.id}>{team.name}</option>
                            {/each}
                            {#if phaseFourTeamId && !phaseFourAvailableTeams.some((t: any) => t.id === phaseFourTeamId)}
                                <option value={phaseFourTeamId}>{editingPhaseFourTeamName || "Squadra selezionata"}</option>
                            {/if}
                        </select>
                        {#if editingPhaseFourId}
                            <input type="hidden" name="teamId" value={phaseFourTeamId} />
                        {/if}
                    </div>

                    <div class="space-y-2">
                        <div class="flex items-center justify-between gap-3">
                            <label for="phase4-percent" class="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                Completamento
                            </label>
                            <span class="text-lg font-black tabular-nums text-yellow-600">{phaseFourPercent}%</span>
                        </div>
                        <div class="grid grid-cols-[1fr_72px] gap-3 items-center">
                            <input
                                id="phase4-percent"
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                bind:value={phaseFourPercent}
                                class="w-full accent-yellow-500"
                            />
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                bind:value={phaseFourPercent}
                                class="h-12 rounded-xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-sm font-black outline-none focus:border-yellow-400"
                            />
                        </div>
                    </div>

                    <div class="flex gap-2">
                        <Button type="submit" class="h-12 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-zinc-950 font-black text-xs uppercase px-6" disabled={!phaseFourTeamId}>
                            {editingPhaseFourId ? "Aggiorna" : "Salva"}
                        </Button>
                        {#if phaseFourTeamId || editingPhaseFourId}
                            <Button type="button" variant="outline" onclick={resetPhaseFourForm} class="h-12 rounded-xl font-black text-xs uppercase">
                                Annulla
                            </Button>
                        {/if}
                    </div>
                </form>
            </Card.Card>

            <Card.Card class="rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                <div class="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
                    <div>
                        <h3 class="text-lg font-black text-zinc-900 dark:text-white">
                            Squadre in Fase 4
                        </h3>
                        <p class="text-xs text-zinc-500 font-medium mt-1">
                            Il 100% indica che la squadra ha trovato il tesoro.
                        </p>
                    </div>
                    <span class="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        {phaseFourRows.length} squadre
                    </span>
                </div>

                {#if phaseFourRows.length > 0}
                    <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {#each phaseFourRows as row (row.id)}
                            <div class="p-5 grid grid-cols-1 lg:grid-cols-[1fr_260px_auto] gap-4 lg:items-center">
                                <div class="min-w-0">
                                    <div class="flex items-center gap-3">
                                        <div class="w-3 h-10 rounded-full" style="background: {row.factionColor || '#eab308'}"></div>
                                        <div class="min-w-0">
                                            <p class="font-black text-zinc-900 dark:text-white truncate">{row.teamName}</p>
                                            <p class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                                {row.factionName}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div class="space-y-2">
                                    <div class="flex items-center justify-between text-xs font-black text-zinc-500">
                                        <span>Avanzamento</span>
                                        <span class="text-yellow-600">{row.percent}%</span>
                                    </div>
                                    <div class="h-3 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                        <div
                                            class="h-full rounded-full bg-linear-to-r from-yellow-400 via-amber-500 to-orange-500 transition-all duration-700"
                                            style="width: {row.percent}%"
                                        ></div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 lg:justify-end">
                                    <Button type="button" variant="outline" onclick={() => editPhaseFourRow(row)} class="h-10 rounded-xl font-black text-xs uppercase">
                                        <Pencil size={16} class="mr-2" /> Modifica
                                    </Button>
                                    <form
                                        method="POST"
                                        action="?/deletePhaseFourProgress"
                                        use:enhance={() => {
                                            return async ({ update }) => {
                                                await update({ reset: false, invalidateAll: true });
                                            };
                                        }}
                                    >
                                        <input type="hidden" name="id" value={row.id} />
                                        <Button type="submit" variant="destructive" class="h-10 rounded-xl font-black text-xs uppercase">
                                            <Trash2 size={16} />
                                        </Button>
                                    </form>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="p-10 text-center text-sm text-zinc-400 italic">
                        Nessuna squadra inserita nel tabellone Fase 4.
                    </div>
                {/if}
            </Card.Card>
        </div>

    {:else if activeTab === "scores"}
        <div class="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto w-full">
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div class="flex items-center gap-3">
                    <Trophy size={24} class="text-red-600" />
                    <div>
                        <h2 class="text-2xl font-black text-foreground">Impostazione Punteggi</h2>
                        <p class="text-xs text-zinc-500 font-medium mt-1">
							Il campo imposta il totale assoluto, non aggiunge punti. Per il bonus preiscrizione, prima della gara e con totale a zero, inserisci direttamente il valore del bonus. La variazione viene registrata nel ledger.
                        </p>
                    </div>
                </div>
            </div>

            {#if form?.error}
                <div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                    {form.error}
                </div>
            {/if}

            <div class="space-y-6">
                {#each factions as faction (faction.id)}
                    <Card.Card class="rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                        <div class="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-2 h-8 rounded-full" style="background: {faction.color || '#6366f1'}"></div>
                                <h3 class="font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                    {faction.name}
                                </h3>
                            </div>
                            <span class="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                {faction.teams?.length || 0} squadre
                            </span>
                        </div>

                        {#if faction.teams?.length > 0}
                            <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {#each faction.teams as team (team.id)}
                                    <form
                                        method="POST"
                                        action="?/setTeamScore"
                                        use:enhance={() => {
                                            return async ({ update }) => {
                                                await update({ reset: true, invalidateAll: true });
                                            };
                                        }}
                                        class="p-4 grid grid-cols-1 lg:grid-cols-[1fr_120px_160px_1.5fr_auto] gap-3 lg:items-center"
                                    >
                                        <input type="hidden" name="teamId" value={team.id} />
                                        <div class="min-w-0">
                                            <p class="font-black text-zinc-900 dark:text-white truncate">
                                                {team.name}
                                            </p>
                                            <p class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                                Totale corrente
                                            </p>
                                        </div>
                                        <div class="text-2xl font-black text-zinc-950 dark:text-white tabular-nums">
                                            {team.scoreCache || 0}<span class="text-xs ml-1 text-zinc-400">PT</span>
                                        </div>
                                        <input
                                            type="number"
                                            name="score"
                                            value={team.scoreCache || 0}
                                            step="1"
                                            aria-label="Nuovo punteggio totale per {team.name}"
                                            class="h-11 rounded-xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 font-black outline-none focus:border-red-400"
                                            required
                                        />
                                        <input
                                            type="text"
                                            name="reason"
											placeholder="Es: Bonus preiscrizione entro il 7 agosto 2026"
                                            class="h-11 rounded-xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 text-sm font-bold outline-none focus:border-red-400"
                                        />
                                        <Button type="submit" class="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase">
                                            Salva
                                        </Button>
                                    </form>
                                {/each}
                            </div>
                        {:else}
                            <div class="p-6 text-center text-sm text-zinc-400 italic">
                                Nessuna squadra in questa fazione
                            </div>
                        {/if}
                    </Card.Card>
                {/each}
            </div>

            <Card.Card class="rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                <div class="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
                    <div>
                        <h3 class="text-lg font-black text-zinc-900 dark:text-white">
                            Registro Correzioni
                        </h3>
                        <p class="text-xs text-zinc-500 font-medium mt-1">
                            Ultime correzioni manuali registrate per questo evento.
                        </p>
                    </div>
                    <span class="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        {data.scoreCorrections?.length || 0} righe
                    </span>
                </div>

                {#if data.scoreCorrections?.length > 0}
                    <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {#each data.scoreCorrections as correction}
                            <div class="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div class="min-w-0 space-y-1">
                                    <p class="text-sm font-bold text-zinc-900 dark:text-white leading-relaxed">
                                        {#if correction.metadata?.mode === "absolute_score"}
                                            Punteggio della squadra <span class="font-black">{correction.teamName}</span>
                                            impostato a
                                            <span class="text-blue-600">{correction.metadata.targetScore} punti</span>
                                        {:else}
                                            <span class={correction.points > 0 ? "text-green-600" : "text-red-600"}>
                                                {correction.points > 0 ? "Assegnati" : "Sottratti"}
                                                {Math.abs(correction.points)} punti
                                            </span>
                                            alla squadra <span class="font-black">{correction.teamName}</span>
                                        {/if}
                                        della fazione
                                        <span class="font-black" style="color: {correction.factionColor || '#6366f1'}">
                                            {correction.factionName}
                                        </span>
                                    </p>
                                    <p class="text-xs text-zinc-500">
                                        Motivo: {correction.description || "Correzione manuale punteggio"}
                                    </p>
                                </div>
                                <div class="lg:text-right shrink-0">
                                    <p class="text-xs font-black text-zinc-700 dark:text-zinc-200">
                                        {new Date(correction.createdAt).toLocaleString("it-IT")}
                                    </p>
                                    <p class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                                        {correction.judgeName || correction.judgeEmail || "Admin"}
                                    </p>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="p-10 text-center text-sm text-zinc-400 italic">
                        Nessuna correzione manuale registrata.
                    </div>
                {/if}
            </Card.Card>
        </div>

    {:else if activeTab === "factions"}
        <!-- Factions Section (Full Width) -->
        <div class="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto w-full">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <Flag size={24} class="text-indigo-600" />
                    <h2 class="text-2xl font-black text-foreground">Fazioni</h2>
                </div>
                <Button
                    onclick={openCreateFactionDialog}
                    class="h-11 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                    <Plus size={20} class="mr-2" /> Nuova Fazione
                </Button>
            </div>

            {#if factions.length > 0}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {#each factions as faction (faction.id)}
                        <Card.Card
                            class="overflow-hidden flex flex-col shadow-sm hover:shadow-2xl transition-all duration-300 rounded-2xl group border-2 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                        >
                            <div
                                class="p-8 border-b relative"
                                style="background: linear-gradient(135deg, {faction.color}10, transparent)"
                            >
                                <div
                                    class="flex items-start justify-between gap-6"
                                >
                                    <div
                                        class="flex items-center gap-6 min-w-0"
                                    >
                                        <div
                                            class="shrink-0 w-20 h-20 rounded-xl flex items-center justify-center text-white font-bold text-3xl shadow-xl border-4 border-white overflow-hidden transition-transform group-hover:scale-105"
                                            style="background: {faction.color}"
                                        >
                                            {#if faction.avatarUrl}<img
                                                    src={getAvatarUrl(
                                                        faction.avatarUrl,
                                                        faction.name,
                                                        "faction",
                                                    )}
                                                    alt=""
                                                    class="w-full h-full object-cover"
                                                />{:else}<span
                                                    >{faction.icon || "?"}</span
                                                >{/if}
                                        </div>
                                        <div class="min-w-0">
                                            <h3
                                                class="text-3xl font-black truncate text-zinc-950 dark:text-zinc-50 px-1"
                                            >
                                                {faction.name}
                                            </h3>
                                            {#if faction.factionType}
                                                <span
                                                    class="inline-block mt-2 px-3 py-1 text-[10px] font-black uppercase rounded-xl tracking-wider"
                                                    style="background: {faction.color}20; color: {faction.color}"
                                                    >{faction.factionType}</span
                                                >
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onclick={() =>
                                                openEditFactionDialog(faction)}
                                            class="h-10 w-10 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-100"
                                            ><Pencil size={18} /></Button
                                        >
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onclick={() =>
                                                triggerDeleteFaction(faction)}
                                            class="h-10 w-10 rounded-2xl bg-red-50 hover:bg-red-100 text-red-500 border border-red-100"
                                            ><Trash2 size={18} /></Button
                                        >
                                    </div>
                                </div>
                            </div>

                            <div class="p-8 space-y-8 flex-1 bg-card">
                                <!-- Description -->
                                {#if faction.description}
                                    <div class="space-y-2">
                                        <span
                                            class="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1"
                                            >Descrizione</span
                                        >
                                        <p
                                            class="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed italic line-clamp-3"
                                        >
                                            "{faction.description}"
                                        </p>
                                    </div>
                                {/if}

                                <div>
                                    <!-- Teams -->
                                    <div class="space-y-3">
                                        <div
                                            class="flex items-center justify-between ml-1"
                                        >
                                            <span
                                                class="text-[10px] font-black uppercase text-zinc-400 tracking-widest"
                                                >Squadre ({faction.teamCount})</span
                                            >
                                        </div>
                                        <div class="space-y-2">
                                            {#each faction.teams as team}
                                                <div
                                                    class="group/team px-4 py-3 rounded-2xl border-2 flex items-center justify-between shadow-sm transition-all hover:translate-x-1"
                                                    style="border-color: {team.color}20; background: {team.color}05"
                                                >
                                                    <div
                                                        class="flex items-center gap-3"
                                                    >
                                                        <div
                                                            class="w-8 h-8 rounded-full border bg-white flex items-center justify-center overflow-hidden shrink-0"
                                                            style="border-color: {team.color}"
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
                                                        <span
                                                            class="text-xs font-black text-zinc-800 dark:text-zinc-200 tracking-tight"
                                                            >{team.name}</span
                                                        >
                                                    </div>
                                                    <div
                                                        class="flex items-center gap-2"
                                                    >
                                                        <span
                                                            class="text-[10px] font-bold text-zinc-400 tabular-nums"
                                                            >CODICE: {team.joinCode}</span
                                                        >
                                                    </div>
                                                </div>
                                            {:else}
                                                <div
                                                    class="py-10 text-center rounded-xl border-2 border-dashed border-zinc-100 dark:border-zinc-800"
                                                >
                                                    <span
                                                        class="text-xs text-zinc-400 font-medium italic"
                                                        >Nessuna squadra
                                                        associata</span
                                                    >
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card.Card>
                    {/each}
                </div>
            {:else}
                <div
                    class="text-center py-20 bg-zinc-50 dark:bg-zinc-900/50 border-3 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl"
                >
                    <div
                        class="w-20 h-20 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-6"
                    >
                        <Flag size={40} class="text-indigo-600" />
                    </div>
                    <h3 class="text-2xl font-black mb-2">Nessuna Fazione</h3>
                    <p class="text-zinc-500 max-w-sm mx-auto mb-8">
                        Aggiungi la prima fazione per iniziare.
                    </p>
                    <Button
                        onclick={openCreateFactionDialog}
                        class="h-12 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                        >Crea Fazione</Button
                    >
                </div>
            {/if}
        </div>

    {:else if activeTab === "program"}
        <!-- Programma (Phase Structure) Section (Full Width) -->
        <div class="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto w-full">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-center gap-3">
                    <Layers size={24} class="text-amber-600" />
                    <h2 class="text-2xl font-black text-foreground">
                        Programma Evento
                    </h2>
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button
                        href="?tab=times#phase-one-times"
                        class="h-11 rounded-2xl bg-violet-600 px-4 font-bold text-white hover:bg-violet-700"
                    >
                        <Clock size={16} class="mr-2" /> Classifica tempi Fase 1
                    </Button>
                    <Button
                        onclick={openCreateMacroPhaseDialog}
                        variant="outline"
                        class="h-11 rounded-2xl border-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                    >
                        <Plus size={16} class="mr-2" /> Macro-Fase
                    </Button>
                </div>
            </div>

            <div class="space-y-6 w-full">
                {#each macroPhases as mp (mp.id)}
                    <div
                        class="rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 shadow-sm transition-colors w-full"
                    >
                        <div
                            class="p-6 bg-zinc-50 dark:bg-zinc-800/50 border-b-4 border-amber-400 flex items-center justify-between group"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-1.5 h-6 bg-amber-500 rounded-full"
                                ></div>
                                <h3
                                    class="font-black text-lg uppercase tracking-tight text-zinc-900 dark:text-zinc-50"
                                >
                                    {mp.name}
                                </h3>
                            </div>
                            <div
                                class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Button
                                    onclick={() =>
                                        openEditMacroPhaseDialog(mp)}
                                    variant="ghost"
                                    size="icon"
                                    class="h-8 w-8 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600"
                                    ><Pencil size={14} /></Button
                                >
                                <Button
                                    onclick={() =>
                                        openCreatePhaseDialog(mp.id)}
                                    size="sm"
                                    class="h-8 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-amber-600 hover:border-amber-200 font-bold text-[10px] uppercase shadow-sm"
                                >
                                    <Plus size={12} class="mr-1" /> Fase
                                </Button>
                                <Button
                                    onclick={() =>
                                        triggerDeleteMacroPhase(mp)}
                                    variant="ghost"
                                    size="icon"
                                    class="h-8 w-8 hover:bg-red-50 hover:text-red-500 rounded-lg"
                                    ><Trash2 size={14} /></Button
                                >
                            </div>
                        </div>

                        <div class="p-6 space-y-4 bg-card">
                            {#if mp.phases.length > 0}
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {#each mp.phases as phase (phase.id)}
                                        {@const phaseChallenges =
                                            getProgramChallengesForPhase(phase.id)}
                                        <div
                                            class="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"
                                        >
                                            <div
                                                class="px-5 py-4 bg-zinc-100/50 dark:bg-zinc-800/80 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-700 group/phase"
                                            >
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <div
                                                        class="w-2 h-2 rounded-full {phase.status ===
                                                        'active'
                                                            ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                                                            : 'bg-zinc-300'}"
                                                    ></div>
                                                    <span
                                                        class="font-black text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100"
                                                        >{phase.name}</span
                                                    >
                                                    <span
                                                        class="text-[9px] font-black bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-md text-zinc-500 dark:text-zinc-400 uppercase tracking-widest"
                                                        >{phaseChallenges.length}
                                                        Attività</span
                                                    >
                                                </div>
                                                <div
                                                    class="flex items-center gap-1 opacity-0 group-hover/phase:opacity-100 transition-opacity"
                                                >
                                                    <Button
                                                        onclick={() =>
                                                            openEditPhaseDialog(
                                                                phase,
                                                            )}
                                                        size="icon"
                                                        variant="ghost"
                                                        class="h-7 w-7 rounded-lg hover:bg-zinc-100 hover:text-zinc-600"
                                                        ><Pencil
                                                            size={14}
                                                        /></Button
                                                    >
                                                    <Button
                                                        onclick={() =>
                                                            openCreateChallengeDialog(
                                                                phase.id,
                                                            )}
                                                        size="icon"
                                                        variant="ghost"
                                                        class="h-7 w-7 rounded-lg hover:bg-amber-50 hover:dark:bg-amber-500/10 hover:text-amber-600 shadow-sm border border-transparent dark:border-zinc-800"
                                                        ><Plus
                                                            size={14}
                                                        /></Button
                                                    >
                                                    <Button
                                                        onclick={() =>
                                                            triggerDeletePhase(
                                                                phase,
                                                            )}
                                                        size="icon"
                                                        variant="ghost"
                                                        class="h-7 w-7 rounded-lg hover:bg-red-50 hover:text-red-500"
                                                        ><Trash2
                                                            size={14}
                                                        /></Button
                                                    >
                                                </div>
                                            </div>

                                            <div class="p-2 space-y-1 bg-card">
                                                {#each phaseChallenges as challenge}
                                                    {@const badge =
                                                        getScoringTypeBadge(
                                                            challenge.scoringType,
                                                        )}
                                                    <div
                                                        class="group/c flex items-center justify-between p-2 rounded-xl hover:bg-zinc-50 hover:dark:bg-zinc-800 transition-all active:scale-[0.98]"
                                                    >
                                                        <div
                                                            class="flex items-center gap-3"
                                                        >
                                                            <div
                                                                class="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-2xl border border-zinc-100 dark:border-zinc-700 overflow-hidden shrink-0"
                                                            >
                                                                <span
                                                                    class="mt-0.5"
                                                                >
                                                                    {getScoringIcon(
                                                                        challenge.scoringType,
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <div
                                                                    class="font-black text-xs uppercase tracking-tight text-zinc-800 dark:text-zinc-50"
                                                                >
                                                                    {challenge.name}
                                                                </div>
                                                                <div
                                                                    class="flex gap-1 mt-0.5"
                                                                >
                                                                    <span
                                                                        class="text-[9px] font-bold px-1.5 py-0.5 rounded {badge.color}"
                                                                        >{badge.label}</span
                                                                    >
                                                                    <span
                                                                        class="text-[9px] font-medium text-zinc-400"
                                                                        >{getChallengeDisplayPoints(challenge)}pt max</span
                                                                    >
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div
                                                            class="opacity-0 group-hover/c:opacity-100 flex gap-1"
                                                        >
                                                            <Button
                                                                onclick={() =>
                                                                    openEditChallengeDialog(
                                                                        challenge,
                                                                    )}
                                                                size="icon"
                                                                variant="ghost"
                                                                class="h-7 w-7 rounded-lg"
                                                                ><Pencil
                                                                    size={12}
                                                                /></Button
                                                            >
                                                            <Button
                                                                onclick={() =>
                                                                    triggerDeleteChallenge(
                                                                        challenge,
                                                                    )}
                                                                size="icon"
                                                                variant="ghost"
                                                                class="h-7 w-7 rounded-lg hover:bg-red-50 hover:text-red-500"
                                                                ><Trash2
                                                                    size={12}
                                                                /></Button
                                                            >
                                                            <div
                                                                class="flex flex-col gap-0.5 ml-1"
                                                            >
                                                                <form
                                                                    method="POST"
                                                                    action="?/reorderChallenge"
                                                                    use:enhance
                                                                >
                                                                    <input
                                                                        type="hidden"
                                                                        name="id"
                                                                        value={challenge.id}
                                                                    />
                                                                    <input
                                                                        type="hidden"
                                                                        name="direction"
                                                                        value="up"
                                                                    />
                                                                    <button
                                                                        type="submit"
                                                                        class="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-indigo-600"
                                                                        aria-label="Sposta su"
                                                                    >
                                                                        <ChevronUp
                                                                            size={12}
                                                                        />
                                                                    </button>
                                                                </form>
                                                                <form
                                                                    method="POST"
                                                                    action="?/reorderChallenge"
                                                                    use:enhance
                                                                >
                                                                    <input
                                                                        type="hidden"
                                                                        name="id"
                                                                        value={challenge.id}
                                                                    />
                                                                    <input
                                                                        type="hidden"
                                                                        name="direction"
                                                                        value="down"
                                                                    />
                                                                    <button
                                                                        type="submit"
                                                                        class="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-400 hover:text-indigo-600"
                                                                        aria-label="Sposta giù"
                                                                    >
                                                                        <ChevronDown
                                                                            size={12}
                                                                        />
                                                                    </button>
                                                                </form>
                                                            </div>
                                                        </div>
                                                    </div>
                                                {/each}
                                                {#if phaseChallenges.length === 0}
                                                    <div
                                                        class="p-4 text-center text-[10px] text-zinc-400 italic"
                                                    >
                                                        Nessuna attività in
                                                        questa fase
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <div
                                    class="text-center py-6 text-zinc-400 text-xs italic"
                                >
                                    Nessuna fase definita
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}

                {#if macroPhases.length === 0}
                    <div
                        class="text-center py-12 bg-zinc-50 dark:bg-zinc-900/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl w-full"
                    >
                        <Folder
                            size={32}
                            class="text-zinc-300 mx-auto mb-3"
                        />
                        <p class="text-zinc-400 text-sm font-bold">
                            Nessuna Macro-Fase
                        </p>
                        <Button
                            onclick={openCreateMacroPhaseDialog}
                            variant="link"
                            class="text-amber-600">Crea la prima</Button
                        >
                    </div>
                {/if}
            </div>

            {#if programCompletions.length > 0}
                <Card.Card class="rounded-2xl border-2 border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-5">
                    <div>
                        <h3 class="text-lg font-black text-zinc-900 dark:text-white">
                            Attività completate dalle squadre
                        </h3>
                        <p class="text-xs text-zinc-500 font-medium">
                            Controlla i completamenti per fazione e ripristina un'attività se è stata validata per errore.
                        </p>
                    </div>
                    <div class="space-y-5">
                        {#each factions as faction}
                            {@const factionRows = programCompletions.filter((row: any) => row.factionId === faction.id)}
                            {#if factionRows.length > 0}
                                <div class="space-y-2">
                                    <div class="flex items-center gap-2">
                                        <div class="w-2 h-6 rounded-full" style="background: {faction.color || '#6366f1'}"></div>
                                        <h4 class="font-black text-sm uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
                                            {faction.name}
                                        </h4>
                                    </div>
                                    <div class="grid gap-2">
                                        {#each factionRows as row}
                                            <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                <div>
                                                    <p class="font-black text-zinc-900 dark:text-white">
                                                        {row.teamName}
                                                    </p>
                                                    <p class="text-sm font-bold text-zinc-600 dark:text-zinc-300">
                                                        {row.challengeName}
                                                    </p>
                                                    <p class="text-xs text-zinc-500 mt-1">
                                                        {new Date(row.completedAt).toLocaleString("it-IT")} · {row.totalPoints} pt
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onclick={() => resetProgramCompletion(row.id)}
                                                    class="rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                                                >
                                                    Ripristina
                                                </Button>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        {/each}
                    </div>
                </Card.Card>
            {/if}
        </div>

    {:else if activeTab === "challenges"}
        <!-- Giochi (Challenges) Tab Section -->
        <div class="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto w-full">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-center gap-3">
                    <Target size={24} class="text-indigo-600" />
                    <h2 class="text-2xl font-black text-foreground">Giochi dell'Evento</h2>
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button
                        href="?tab=times#triptych-times"
                        class="h-11 rounded-2xl bg-amber-600 px-4 font-bold text-white hover:bg-amber-700"
                    >
                        <Clock size={16} class="mr-2" /> Classifica tempi Trittico
                    </Button>
                    <Button
                        onclick={() => openCreateChallengeDialog(null)}
                        class="h-11 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    >
                        <Plus size={20} class="mr-2" /> Nuovo Gioco
                    </Button>
                </div>
            </div>

            <!-- List of all games in a beautiful grid -->
            {#if eventGames.length > 0}
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {#each eventGames as challenge}
                        <Card.Card class="rounded-2xl border-2 border-border shadow-sm p-6 bg-card flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group">
                            <div>
                                <div class="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center border text-xl shrink-0">
                                            {getChallengeIcon(challenge)}
                                        </div>
                                        <div class="min-w-0">
                                            <span class="font-bold text-sm text-foreground truncate block">{challenge.name}</span>
                                            <span class="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mt-0.5">Codice: {challenge.code}</span>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                        <Button
                                            onclick={() => openEditChallengeDialog(challenge)}
                                            size="icon"
                                            variant="ghost"
                                            class="h-8 w-8 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg"
                                        >
                                            <Pencil size={14} />
                                        </Button>
                                        <Button
                                            onclick={() => triggerDeleteChallenge(challenge)}
                                            size="icon"
                                            variant="ghost"
                                            class="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>
                                <div class="py-4 text-xs text-muted-foreground leading-relaxed">
                                    {challenge.description || "Nessuna descrizione specificata per questo gioco."}
                                </div>
                            </div>
                            <div class="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                <span class="text-[10px] font-bold px-2 py-1 rounded {getChallengeBadge(challenge).color}">
                                    {getChallengeBadge(challenge).label}
                                </span>
                                <span class="text-xs font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                                    Punti Base: {challenge.basePoints}pt
                                </span>
                            </div>
                        </Card.Card>
                    {/each}
                </div>

                <Card.Card class="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm">
                    <div class="border-b border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
                        <div class="flex items-center gap-3">
                            <Trophy size={22} class="text-amber-600" />
                            <div>
                                <h3 class="text-lg font-black text-foreground">
                                    Recap squadre, step e tempi
                                </h3>
                                <p class="mt-1 text-xs font-bold text-zinc-500">
                                    Il tempo è quello acquisito nel momento esatto in cui lo staff invia il punteggio.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {#each eventGames as game}
                            {@const completionRows = getGameCompletionRows(game.id)}
                            <section class="p-5 sm:p-6">
                                <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h4 class="font-black text-foreground">{game.name}</h4>
                                        <p class="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                            {completionRows.length} {completionRows.length === 1 ? "squadra registrata" : "squadre registrate"}
                                        </p>
                                    </div>
                                    <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                        {completionRows.reduce((sum: number, row: any) => sum + (row.totalPoints || 0), 0)} pt assegnati
                                    </span>
                                </div>

                                {#if completionRows.length > 0}
                                    <div class="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                                        <table class="w-full min-w-[820px] text-left text-sm">
                                            <thead class="bg-zinc-50 text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:bg-zinc-900/70">
                                                <tr>
                                                    <th class="px-4 py-3">Squadra</th>
                                                    <th class="px-4 py-3">Punti per step</th>
                                                    <th class="px-4 py-3 text-center">Totale</th>
                                                    <th class="px-4 py-3 text-center">Tempo</th>
                                                    <th class="px-4 py-3">Invio</th>
                                                    <th class="px-4 py-3 text-right">Azioni</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                {#each completionRows as row, index}
                                                    <tr class="align-top">
                                                        <td class="px-4 py-4">
                                                            <div class="flex items-center gap-3">
                                                                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                                                    {index + 1}
                                                                </span>
                                                                <div>
                                                                    <p class="font-black text-foreground">{row.teamName}</p>
                                                                    <p class="mt-0.5 text-[11px] font-bold" style="color: {row.factionColor || '#71717a'}">
                                                                        {row.factionName}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td class="px-4 py-4">
                                                            <div class="flex max-w-xl flex-wrap gap-2">
                                                                {#each row.breakdown || [] as step}
                                                                    <span class="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                                                                        {step.label}: <strong>{Number(step.points) > 0 ? "+" : ""}{Number(step.points) || 0} pt</strong>
                                                                    </span>
                                                                {/each}
                                                                {#if !(row.breakdown || []).length}
                                                                    <span class="text-xs font-bold text-zinc-400">Nessun dettaglio disponibile</span>
                                                                {/if}
                                                            </div>
                                                        </td>
                                                        <td class="px-4 py-4 text-center">
                                                            <span class="text-xl font-black text-indigo-600 dark:text-indigo-400">
                                                                {row.totalPoints} pt
                                                            </span>
                                                        </td>
                                                        <td class="px-4 py-4 text-center">
                                                            <span class="font-mono text-lg font-black {row.elapsedSeconds === null ? 'text-zinc-400' : 'text-emerald-600 dark:text-emerald-400'}">
                                                                {formatGameDuration(row.elapsedSeconds)}
                                                            </span>
                                                        </td>
                                                        <td class="px-4 py-4">
                                                            <p class="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                                                                {new Date(row.submittedAt).toLocaleString("it-IT")}
                                                            </p>
                                                            {#if row.judgeName}
                                                                <p class="mt-1 text-[10px] font-bold text-zinc-400">
                                                                    Giudice: {row.judgeName}
                                                                </p>
                                                            {/if}
                                                        </td>
                                                        <td class="px-4 py-4 text-right">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onclick={() => resetGameCompletion(row.id, row.teamName, game.name)}
                                                                class="rounded-xl border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40 text-xs font-bold"
                                                            >
                                                                <RotateCcw size={13} class="mr-1.5" />
                                                                Annulla
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                {/each}
                                            </tbody>
                                        </table>
                                    </div>
                                {:else}
                                    <div class="rounded-2xl border-2 border-dashed border-zinc-200 p-6 text-center text-xs font-bold text-zinc-400 dark:border-zinc-800">
                                        Nessun punteggio ancora inviato per questo gioco.
                                    </div>
                                {/if}
                            </section>
                        {/each}
                    </div>
                </Card.Card>
            {:else}
                <div class="h-64 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center p-8 bg-zinc-50/30 dark:bg-zinc-900/10">
                    <Target size={40} class="text-zinc-300 dark:text-zinc-700 mb-3" />
                    <p class="text-sm font-bold text-muted-foreground">Nessun Gioco Configurato</p>
                    <p class="text-xs text-zinc-400 mt-1 max-w-xs">Aggiungi il tuo primo gioco a punti (es: la giostra) cliccando sul pulsante in alto.</p>
                    <Button
                        onclick={() => openCreateChallengeDialog(null)}
                        variant="outline"
                        class="mt-4 rounded-xl font-bold text-xs uppercase"
                    >
                        Nuovo Gioco
                    </Button>
                </div>
            {/if}
        </div>

    {:else if activeTab === "codex"}
        <!-- Codex Janara Section (Full Width) -->
        <div class="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto w-full">
            <Card.Card
                class="rounded-2xl border-2 border-emerald-900/10 dark:border-emerald-900/30 bg-emerald-50/10 dark:bg-emerald-900/10 overflow-hidden w-full"
            >
                <div
                    class="p-6 bg-emerald-900 text-white flex items-center justify-between"
                >
                    <div class="flex items-center gap-3">
                        <div
                            class="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="lucide lucide-scroll-text"
                            ><path
                                    d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"
                                /><path d="M19 17V5a2 2 0 0 0-2-2H4" /></svg
                            >
                        </div>
                        <div>
                            <h3
                                class="font-black text-lg uppercase tracking-tight"
                            >
                                Codex Janara
                            </h3>
                            <p class="text-emerald-200 text-xs font-medium">
                                Enigmi Crittografati dell'Evento
                            </p>
                        </div>
                    </div>
                    <Button
                        onclick={openCreateCodexDialog}
                        class="bg-white text-emerald-900 hover:bg-emerald-50 border border-transparent font-bold rounded-xl h-10 text-xs uppercase"
                    >
                        <Plus size={16} class="mr-2" /> Nuovo Enigma
                    </Button>
                </div>

                <div class="p-6 space-y-6 bg-card">
                    <!-- Puzzle List with Individual QRs -->
                    <div class="space-y-4">
                        <h4
                            class="text-xs font-black uppercase text-zinc-400 tracking-widest ml-1"
                        >
                            Enigmi Attivi
                        </h4>
                        {#if codexPuzzles.length > 0}
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {#each codexPuzzles as puzzle}
                                    {@const faction = factions.find(
                                        (f: any) => f.id === puzzle.factionId,
                                    )}
                                    <div
                                        class="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm space-y-4"
                                    >
                                        <div
                                            class="flex items-center justify-between"
                                        >
                                            <div
                                                class="flex items-center gap-3"
                                            >
                                                <div
                                                    class="w-2.5 h-8 rounded-full"
                                                    style="background-color: {faction?.color ||
                                                        '#ccc'}"
                                                ></div>
                                                <div>
                                                    <p
                                                        class="font-bold text-sm text-zinc-800 dark:text-zinc-200"
                                                    >
                                                        {faction?.name ||
                                                            "Sconosciuta"}
                                                    </p>
                                                    <p
                                                        class="text-[10px] text-zinc-400 font-mono truncate max-w-[120px]"
                                                    >
                                                        ID: {puzzle.id.substring(
                                                            0,
                                                            8,
                                                        )}
                                                    </p>
                                                    {#if puzzle.plaintext}
                                                        <p
                                                            class="text-[10px] text-zinc-600 dark:text-zinc-400 italic mt-1 font-bold line-clamp-1"
                                                        >
                                                            "{puzzle.plaintext}"
                                                        </p>
                                                    {:else}
                                                        <p
                                                            class="text-[10px] text-zinc-300 italic mt-1"
                                                        >
                                                            (Testo non memorizzato)
                                                        </p>
                                                    {/if}
                                                    <p
                                                        class="text-[10px] font-black text-emerald-700 dark:text-emerald-400 mt-1 uppercase tracking-wider"
                                                    >
                                                        {puzzle.pointsOnDecode || 0} pt alla decodifica
                                                    </p>
                                                </div>
                                            </div>
                                            <div
                                                class="flex items-center gap-1"
                                            >
                                                <Button
                                                    onclick={() =>
                                                        openEditCodexDialog(
                                                            puzzle,
                                                        )}
                                                    size="icon"
                                                    variant="ghost"
                                                    class="h-8 w-8 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                                <Button
                                                    onclick={() =>
                                                        triggerDeleteCodex(
                                                            puzzle,
                                                        )}
                                                    size="icon"
                                                    variant="ghost"
                                                    class="h-8 w-8 text-red-500 hover:bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </div>

                                        <!-- QR Code for this specific puzzle -->
                                        <div
                                            class="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-100/50 dark:border-zinc-800"
                                        >
                                            <div
                                                class="w-20 h-20 bg-white dark:bg-zinc-900 rounded-lg border-2 border-zinc-900 dark:border-zinc-100 p-1 shrink-0 overflow-hidden"
                                            >
                                                {#if puzzleQrCodes[puzzle.id]}
                                                    <img
                                                        src={puzzleQrCodes[
                                                            puzzle.id
                                                        ]}
                                                        alt="Puzzle QR"
                                                        class="w-full h-full object-contain"
                                                    />
                                                {:else}
                                                    <div
                                                        class="w-full h-full flex items-center justify-center text-[8px] text-zinc-300"
                                                    >
                                                        ...
                                                    </div>
                                                {/if}
                                            </div>
                                            <div class="flex-1 space-y-2">
                                                <p
                                                    class="text-[10px] font-bold text-zinc-500 leading-tight"
                                                >
                                                    Scansiona o condividi questo codice per accedere all'enigma diretto.
                                                </p>
                                                <div
                                                    class="grid grid-cols-2 gap-2"
                                                >
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        class="h-7 text-[10px] font-bold rounded-lg px-2"
                                                        href="/{event.slug}/codex-janara/{puzzle.id}"
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        Apri
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        class="h-7 text-[10px] font-bold rounded-lg px-2"
                                                        onclick={() => {
                                                            const url = `${window.location.origin}/${event.slug}/codex-janara/${puzzle.id}`;
                                                            navigator.clipboard.writeText(
                                                                url,
                                                            );
                                                            copiedPuzzleId =
                                                                puzzle.id;
                                                            setTimeout(() => {
                                                                if (
                                                                    copiedPuzzleId ===
                                                                    puzzle.id
                                                                )
                                                                    copiedPuzzleId =
                                                                        null;
                                                            }, 2000);
                                                        }}
                                                    >
                                                        {copiedPuzzleId ===
                                                        puzzle.id
                                                            ? "Copiato!"
                                                            : "Copia link"}
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        class="h-7 text-[10px] font-bold rounded-lg px-2 col-span-2 bg-zinc-900 text-white hover:bg-zinc-800"
                                                        onclick={() => {
                                                            const link =
                                                                document.createElement(
                                                                    "a",
                                                                );
                                                            link.download = `codex-janara-${faction?.name || "enigma"}.png`;
                                                            link.href =
                                                                puzzleQrCodes[
                                                                    puzzle.id
                                                                ];
                                                            link.click();
                                                        }}
                                                    >
                                                        Scarica QR
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div
                                class="text-center py-10 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800"
                            >
                                <div
                                    class="w-12 h-12 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3"
                                >
                                    <Lock size={20} class="text-zinc-300" />
                                </div>
                                <p class="text-zinc-400 text-xs italic">
                                    Nessun enigma creato
                                </p>
                            </div>
                        {/if}
                    </div>

                    <!-- Decoded Codex Log -->
                    {#if codexDecodeLogs.length > 0}
                        <div
                            class="mt-6 pt-6 border-t border-emerald-100 dark:border-emerald-800/30 space-y-3"
                        >
                            <h4
                                class="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-widest ml-1 flex items-center gap-2"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                ><rect
                                        width="18"
                                        height="11"
                                        x="3"
                                        y="11"
                                        rx="2"
                                        ry="2"
                                    /><path
                                        d="M7 11V7a5 5 0 0 1 10 0v4"
                                    /></svg
                                >
                                Enigmi Decodificati
                            </h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {#each codexDecodeLogs as log}
                                    <div
                                        class="flex items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-3 shadow-sm"
                                    >
                                        <div
                                            class="flex items-center gap-3 min-w-0"
                                        >
                                            <div
                                                class="w-2 h-6 rounded-full"
                                                style="background: {log.factionColor ||
                                                    '#10b981'}"
                                            ></div>
                                            <span
                                                class="font-bold text-sm text-emerald-900 dark:text-emerald-100"
                                            >
                                                {log.teamName || log.factionName}
                                            </span>
                                            <span class="text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                                                +{log.pointsAwarded || 0} pt
                                            </span>
                                        </div>
                                        <div class="flex items-center gap-2 shrink-0">
                                            <span
                                                class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide"
                                            >
                                                {new Date(
                                                    log.decodedAt,
                                                ).toLocaleString("it-IT", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onclick={() => resetCodexDecode(log.logId)}
                                                class="h-7 rounded-lg text-[10px] border-red-200 text-red-700 hover:bg-red-50"
                                            >
                                                Riabilita
                                            </Button>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            </Card.Card>
        </div>
    {/if}
</div>

<!-- MODULE: Codex Janara Dialogs -->
{#if showCodexDialog}
    <div
        class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <button
            type="button"
            class="absolute inset-0 w-full h-full cursor-default focus:outline-none"
            onclick={closeCodexDialog}
            aria-label="Chiudi"
        ></button>
        <Card.Card
            class="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto p-6 rounded-xl bg-white dark:bg-zinc-900 shadow-2xl relative z-10"
        >
            <h3 class="text-xl font-black mb-4">
                {editingCodex ? "Modifica Enigma" : "Nuovo Enigma Codex"}
            </h3>
            <p class="text-sm text-zinc-500 mb-6">
                {editingCodex
                    ? "Aggiorna il messaggio cifrato. Nota: dovrai re-inserire testo e chiave."
                    : "Crea un messaggio cifrato per una fazione. Dovranno scoprire la parola chiave per leggerlo."}
            </p>
            <form
                method="POST"
                action={editingCodex
                    ? "?/updateCodexPuzzle"
                    : "?/createCodexPuzzle"}
                use:enhance={() => {
                    return async ({ update }) => {
                        await update();
                        closeCodexDialog();
                    };
                }}
            >
                {#if editingCodex}
                    <input type="hidden" name="id" value={editingCodex.id} />
                {/if}
                <div class="space-y-4">
                    <div class="space-y-2">
                        <label class="block">
                            <span
                                class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                                >Fazione</span
                            >
                            <select
                                name="factionId"
                                bind:value={codexFactionId}
                                class="w-full mt-2 p-4 rounded-xl border-2 border-zinc-100 bg-zinc-50 font-bold outline-none focus:border-indigo-500 appearance-none"
                                required
                            >
                                <option value="">-- Seleziona Fazione --</option
                                >
                                {#each factions as f}
                                    <option value={f.id}>{f.name}</option>
                                {/each}
                            </select>
                        </label>
                    </div>

                    <div class="space-y-2">
                        <label class="block">
                            <span
                                class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                                >Messaggio da Cifrare</span
                            >
                            <textarea
                                name="text"
                                bind:value={codexText}
                                rows="3"
                                class="w-full mt-2 p-4 rounded-xl border-2 border-zinc-100 bg-zinc-50 font-bold outline-none focus:border-indigo-500"
                                placeholder="Il tesoro è sotto la quercia..."
                                required
                            ></textarea>
                        </label>
                    </div>

                    <div class="space-y-2">
                        <label class="block">
                            <span
                                class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                                >Parola Chiave (Decryption Key)</span
                            >
                            <input
                                type="text"
                                name="keyword"
                                bind:value={codexKeyword}
                                class="w-full mt-2 p-4 rounded-xl border-2 border-zinc-100 bg-zinc-50 font-bold outline-none focus:border-indigo-500"
                                placeholder="es. SECRET123"
                                required
                            />
                        </label>
                    </div>
                    <div class="space-y-2">
                        <label class="block">
                            <span
                                class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                                >Punti alla decodifica</span
                            >
                            <input
                                type="number"
                                name="pointsOnDecode"
                                bind:value={codexPoints}
                                min="0"
                                class="w-full mt-2 p-4 rounded-xl border-2 border-zinc-100 bg-zinc-50 font-bold outline-none focus:border-indigo-500"
                            />
                        </label>
                    </div>
                </div>

                <div class="flex gap-3 mt-8">
                    <Button
                        type="button"
                        variant="outline"
                        onclick={closeCodexDialog}
                        class="flex-1 rounded-xl font-bold h-12">Annulla</Button
                    >
                    <Button
                        type="submit"
                        class="flex-1 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-12 shadow-lg shadow-emerald-200"
                    >
                        {editingCodex ? "Salva Modifiche" : "Crea Enigma"}
                    </Button>
                </div>
            </form>
        </Card.Card>
    </div>
{/if}

<ConfirmDialog
    bind:show={showResetConfirmation}
    title={resetConfirmation?.title ?? "Conferma operazione"}
    message={resetConfirmation?.message ?? "Sei sicuro di voler procedere?"}
    confirmLabel={resetConfirmation?.confirmLabel ?? "Conferma"}
    type="warning"
    onConfirm={runResetConfirmation}
    onCancel={cancelResetConfirmation}
/>

{#if showDeleteCodexDialog}
    <div
        class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <button
            type="button"
            class="absolute inset-0 w-full h-full cursor-default focus:outline-none"
            onclick={closeDeleteCodexDialog}
            aria-label="Chiudi"
        ></button>
        <Card.Card
            class="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto p-6 rounded-xl bg-white dark:bg-zinc-900 shadow-2xl space-y-4 relative z-10"
        >
            <h3 class="text-xl font-black text-red-600">Elimina Enigma?</h3>
            <p class="text-zinc-500">Questa operazione è irreversibile.</p>
            <form
                method="POST"
                action="?/deleteCodexPuzzle"
                use:enhance={() => {
                    return async ({ update }) => {
                        await update();
                        closeDeleteCodexDialog();
                    };
                }}
            >
                <input type="hidden" name="id" value={codexToDelete?.id} />
                <div class="flex gap-3 mt-6">
                    <Button
                        type="button"
                        variant="outline"
                        onclick={closeDeleteCodexDialog}
                        class="flex-1 rounded-xl font-bold h-12">Annulla</Button
                    >
                    <Button
                        type="submit"
                        variant="destructive"
                        class="flex-1 rounded-xl font-bold h-12">Elimina</Button
                    >
                </div>
            </form>
        </Card.Card>
    </div>
{/if}

<!-- DIALOGS -->

<!-- Macro Phase Dialog -->
{#if showMacroPhaseDialog}
    <div
        class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <button
            type="button"
            class="absolute inset-0 w-full h-full cursor-default focus:outline-none"
            onclick={closeMacroPhaseDialog}
            aria-label="Chiudi"
        ></button>
        <Card.Card
            class="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto p-6 rounded-xl bg-white dark:bg-zinc-900 shadow-2xl relative z-10"
        >
            <h3 class="text-xl font-black mb-4">
                {editingMacroPhase ? "Modifica Macro-Fase" : "Nuova Macro-Fase"}
            </h3>
            <form
                method="POST"
                action={editingMacroPhase
                    ? "?/updateMacroPhase"
                    : "?/createMacroPhase"}
                use:enhance={() => {
                    return async ({ update }) => {
                        await update();
                        closeMacroPhaseDialog();
                    };
                }}
            >
                {#if editingMacroPhase}
                    <input
                        type="hidden"
                        name="id"
                        value={editingMacroPhase.id}
                    />
                {/if}
                <input
                    type="text"
                    name="name"
                    bind:value={macroPhaseName}
                    placeholder="Nome (es. Giorno 1)"
                    class="w-full p-4 rounded-xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-bold mb-6 outline-none focus:border-indigo-500"
                    required
                    aria-label="Nome Macro-Fase"
                />
                <div class="flex gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onclick={closeMacroPhaseDialog}
                        class="flex-1 rounded-xl font-bold h-12">Annulla</Button
                    >
                    <Button
                        type="submit"
                        class="flex-1 rounded-xl font-bold bg-indigo-600 text-white h-12"
                    >
                        {editingMacroPhase ? "Salva" : "Crea"}
                    </Button>
                </div>
            </form>
        </Card.Card>
    </div>
{/if}

<!-- Phase Dialog -->
{#if showPhaseDialog}
    <div
        class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <button
            type="button"
            class="absolute inset-0 w-full h-full cursor-default focus:outline-none"
            onclick={closePhaseDialog}
            aria-label="Chiudi"
        ></button>
        <Card.Card
            class="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto p-6 rounded-xl bg-white dark:bg-zinc-900 shadow-2xl relative z-10"
        >
            <h3 class="text-xl font-black mb-4">
                {editingPhase ? "Modifica Fase" : "Nuova Fase"}
            </h3>
            <form
                method="POST"
                action={editingPhase ? "?/updatePhase" : "?/createPhase"}
                use:enhance={() => {
                    return async ({ update }) => {
                        await update();
                        closePhaseDialog();
                    };
                }}
            >
                {#if editingPhase}
                    <input type="hidden" name="id" value={editingPhase.id} />
                {:else}
                    <input
                        type="hidden"
                        name="macroPhaseId"
                        value={selectedMacroPhaseId}
                    />
                {/if}
                <input
                    type="text"
                    name="name"
                    bind:value={phaseName}
                    placeholder="Nome (es. Percorso A)"
                    class="w-full p-4 rounded-xl border-2 border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 font-bold mb-6 outline-none focus:border-indigo-500"
                    required
                    aria-label="Nome Fase"
                />
                <div class="flex gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onclick={closePhaseDialog}
                        class="flex-1 rounded-xl font-bold h-12">Annulla</Button
                    >
                    <Button
                        type="submit"
                        class="flex-1 rounded-xl font-bold bg-indigo-600 text-white h-12"
                    >
                        {editingPhase ? "Salva" : "Crea"}
                    </Button>
                </div>
            </form>
        </Card.Card>
    </div>
{/if}

<!-- Deletion Dialogs -->
{#if showDeleteMacroPhaseDialog}
    <div
        class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <button
            type="button"
            class="absolute inset-0 w-full h-full cursor-default focus:outline-none"
            onclick={closeDeleteMacroPhaseDialog}
            aria-label="Chiudi"
        ></button>
        <Card.Card
            class="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto p-6 rounded-xl bg-white dark:bg-zinc-900 shadow-2xl space-y-4 relative z-10"
        >
            <h3 class="text-xl font-black text-red-600">Elimina Macro-Fase?</h3>
            <p class="text-zinc-500">
                Eliminando <strong>{macroPhaseToDelete?.name}</strong> eliminerai
                anche tutte le fasi contenute.
            </p>
            <form
                method="POST"
                action="?/deleteMacroPhase"
                use:enhance={() => {
                    return async ({ update }) => {
                        await update();
                        closeDeleteMacroPhaseDialog();
                    };
                }}
            >
                <input type="hidden" name="id" value={macroPhaseToDelete?.id} />
                <div class="flex gap-3 mt-6">
                    <Button
                        type="button"
                        variant="outline"
                        onclick={closeDeleteMacroPhaseDialog}
                        class="flex-1 rounded-xl font-bold h-12">Annulla</Button
                    >
                    <Button
                        type="submit"
                        variant="destructive"
                        class="flex-1 rounded-xl font-bold h-12">Elimina</Button
                    >
                </div>
            </form>
        </Card.Card>
    </div>
{/if}

{#if showDeletePhaseDialog}
    <div
        class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <button
            type="button"
            class="absolute inset-0 w-full h-full cursor-default focus:outline-none"
            onclick={closeDeletePhaseDialog}
            aria-label="Chiudi"
        ></button>
        <Card.Card
            class="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto p-6 rounded-xl bg-white dark:bg-zinc-900 shadow-2xl space-y-4 relative z-10"
        >
            <h3 class="text-xl font-black text-red-600">Elimina Fase?</h3>
            <p class="text-zinc-500">
                Eliminando <strong>{phaseToDelete?.name}</strong> le attività associate
                diventeranno "Non Assegnate".
            </p>
            <form
                method="POST"
                action="?/deletePhase"
                use:enhance={() => {
                    return async ({ update }) => {
                        await update();
                        closeDeletePhaseDialog();
                    };
                }}
            >
                <input type="hidden" name="id" value={phaseToDelete?.id} />
                <div class="flex gap-3 mt-6">
                    <Button
                        type="button"
                        variant="outline"
                        onclick={closeDeletePhaseDialog}
                        class="flex-1 rounded-xl font-bold h-12">Annulla</Button
                    >
                    <Button
                        type="submit"
                        variant="destructive"
                        class="flex-1 rounded-xl font-bold h-12">Elimina</Button
                    >
                </div>
            </form>
        </Card.Card>
    </div>
{/if}

<!-- Challenge Dialog (Updated with Phase Selection) -->
{#if showChallengeDialog}
    <div
        class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <button
            type="button"
            class="absolute inset-0 w-full h-full cursor-default focus:outline-none"
            onclick={closeChallengeDialog}
            aria-label="Chiudi"
        ></button>
        <Card.Card
            class="w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:p-8 rounded-xl bg-white dark:bg-zinc-900 shadow-2xl my-auto relative z-10"
        >
            <h3 class="text-2xl font-black mb-6">
                {#if isProgramMode}
                    {editingChallenge ? "Modifica" : "Aggiungi"} Programma della Fase
                {:else}
                    {editingChallenge ? "Modifica" : "Nuovo"} Gioco dell'Evento
                {/if}
            </h3>
            <form
                method="POST"
                action={editingChallenge
                    ? "?/updateChallenge"
                    : "?/createChallenge"}
                use:enhance={() => {
                    return async ({ result, update }) => {
                        await update({ reset: false, invalidateAll: true });
                        if (result.type === "success") {
                            closeChallengeDialog();
                        }
                    };
                }}
                class="space-y-6"
            >
                {#if editingChallenge}<input
                        type="hidden"
                        name="id"
                        value={editingChallenge.id}
                    />{/if}
                <!-- Always submit the challenge type so the server knows if this is a program or a game -->
                <input type="hidden" name="challengeType" value={isProgramMode ? 'program' : 'game'} />

                {#if form?.error}
                    <div
                        class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
                    >
                        {form.error}
                    </div>
                {/if}

                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label
                            class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                        >
                            Codice
                            {#if isProgramMode}
                                {#if editingChallenge}
                                    <div class="w-full mt-2 p-4 rounded-2xl bg-zinc-100 border-2 border-zinc-200 font-black text-zinc-500 uppercase">
                                        {challengeCode}
                                    </div>
                                    <input type="hidden" name="code" value={challengeCode} />
                                {:else}
                                    <select
                                        name="code"
                                        value={challengeCode}
                                        onchange={(e) => onProgramCodeChange(e.currentTarget.value)}
                                        class="w-full mt-2 p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-100 font-bold outline-none focus:border-indigo-500 appearance-none"
                                        required
                                    >
                                        <option value="" disabled>-- Seleziona --</option>
                                        <option value="SCRIBA">SCRIBA (Amministratore)</option>
                                        <option value="ARCHITETTO">ARCHITETTO (Costruttore)</option>
                                    </select>
                                {/if}
                            {:else}
                                <input
                                    type="text"
                                    name="code"
                                    bind:value={challengeCode}
                                    class="w-full mt-2 p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-100 font-bold outline-none focus:border-indigo-500 uppercase"
                                    placeholder="Es: GIOCO_FASI"
                                    required
                                    disabled={!!editingChallenge}
                                />
                                {#if editingChallenge}
                                    <input type="hidden" name="code" value={challengeCode} />
                                {/if}
                                {#if isReservedCodeError}
                                    <p class="text-xs text-red-500 font-bold mt-1 leading-relaxed">
                                        I codici SCRIBA e ARCHITETTO sono riservati per i programmi della fase.
                                    </p>
                                {/if}
                            {/if}
                        </label>
                    </div>
                    <div class="space-y-2">
                        <label
                            class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                        >
                            Nome
                            <input
                                type="text"
                                name="name"
                                bind:value={challengeName}
                                class="w-full mt-2 p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-100 font-bold outline-none focus:border-indigo-500"
                                placeholder={isProgramMode
                                    ? "Nome Attività/Programma"
                                    : gameMode === "phased_game"
                                        ? "Gioco a fasi"
                                        : "Nome del gioco"}
                                required
                            />
                        </label>
                    </div>
                </div>

                <!-- Phase Selection -->
                {#if isProgramMode}
                    <div class="space-y-2">
                        <label
                            class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                        >
                            Fase di Appartenenza
                            <select
                                name="phaseId"
                                bind:value={selectedPhaseId}
                                class="w-full mt-2 p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-100 font-bold outline-none focus:border-indigo-500 appearance-none"
                                required
                            >
                                <option value="" disabled>-- Seleziona una Fase --</option>
                                {#each macroPhases as mp}
                                    <optgroup label={mp.name}>
                                        {#each mp.phases as p}
                                            <option value={p.id}>{p.name}</option>
                                        {/each}
                                    </optgroup>
                                {/each}
                            </select>
                        </label>
                    </div>
                {:else}
                    <input type="hidden" name="phaseId" value="" />
                {/if}

                 <div class="space-y-2">
                    <span
                        class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                        id="scoring-type-label">Tipo Punteggio</span
                    >
                    <div
                        class="grid grid-cols-2 gap-3"
                        role="radiogroup"
                        aria-labelledby="scoring-type-label"
                    >
                        {#each availableScoringTypes as type}
                            <button
                                type="button"
                                onclick={() => setScoringType(type as any)}
                                role="radio"
                                aria-checked={scoringType === type}
                                class="p-3 rounded-xl border-2 font-bold text-sm capitalize transition-all {scoringType ===
                                type
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                    : 'border-zinc-100 text-zinc-500 hover:border-zinc-300'}"
                            >
                                {getScoringTypeLabel(type)}
                            </button>
                        {/each}
                    </div>

                    {#if scoringType === "attempt_based"}
                        <div
                            class="mt-4 p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3"
                        >
                            <span
                                class="text-[10px] font-black uppercase text-purple-400 tracking-widest block"
                                >Seleziona Modello Preset</span
                            >
                            <div class="grid gap-2 sm:grid-cols-3">
                                <button
                                    type="button"
                                    onclick={() =>
                                        applyTentativiTemplate("tentativo")}
                                    class="py-2 px-3 rounded-xl border-2 font-black text-xs transition-all {challengeSteps[0]
                                        ?.name === 'Modello Tentativo'
                                        ? 'border-purple-600 bg-white text-purple-700'
                                        : 'border-white bg-white/50 text-purple-400 hover:border-purple-200'}"
                                >
                                    Modello Tentativo
                                </button>
                                <button
                                    type="button"
                                    onclick={() =>
                                        applyTentativiTemplate("t2_semplice")}
                                    class="py-2 px-3 rounded-xl border-2 font-black text-xs transition-all {challengeSteps[0]
                                        ?.name === 'Modello T2 Semplice'
                                        ? 'border-purple-600 bg-white text-purple-700'
                                        : 'border-white bg-white/50 text-purple-400 hover:border-purple-200'}"
                                >
                                    Modello T2 Semplice
                                </button>
                                <button
                                    type="button"
                                    onclick={() =>
                                        applyTentativiTemplate("nessun_preset")}
                                    class="py-2 px-3 rounded-xl border-2 font-black text-xs transition-all {challengeSteps[0]
                                        ?.name === 'Nessun Preset'
                                        ? 'border-purple-600 bg-white text-purple-700'
                                        : 'border-white bg-white/50 text-purple-400 hover:border-purple-200'}"
                                >
                                    Nessun Preset
                                </button>
                            </div>
                        </div>
                    {/if}
                    <input
                        type="hidden"
                        name="scoringType"
                        value={scoringType}
                    />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label
                            class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                        >
                            Punti Base
                            <input
                                type="number"
                                name="basePoints"
                                bind:value={basePoints}
                                class="w-full mt-2 p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-100 font-bold outline-none focus:border-indigo-500"
                            />
                        </label>
                    </div>
                    <div class="space-y-2">
                        <label
                            class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                        >
                            Punti Max (Opzionale)
                            <input
                                type="number"
                                name="maxPoints"
                                bind:value={maxPoints}
                                class="w-full mt-2 p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-100 font-bold outline-none focus:border-indigo-500"
                            />
                        </label>
                    </div>
                </div>

                <!-- Specific Configs -->
                {#if scoringType === "checklist"}
                    <div
                        class="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4"
                    >
                        <h4 class="font-bold text-blue-900 text-sm">
                            Configurazione Checklist
                        </h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label
                                    class="text-[10px] font-bold uppercase text-blue-400"
                                >
                                    Elementi Totali
                                    <input
                                        type="number"
                                        name="checklistItems"
                                        bind:value={checklistItems}
                                        class="w-full mt-1 p-2 bg-white dark:bg-zinc-800 rounded-lg border border-blue-200 dark:border-blue-900 font-bold"
                                    />
                                </label>
                            </div>
                            <div>
                                <label
                                    class="text-[10px] font-bold uppercase text-blue-400"
                                >
                                    Punti per Elemento
                                    <input
                                        type="number"
                                        name="pointsPerItem"
                                        bind:value={pointsPerItem}
                                        class="w-full mt-1 p-2 bg-white dark:bg-zinc-800 rounded-lg border border-blue-200 dark:border-blue-900 font-bold"
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                {/if}

                {#if scoringType === "attempt_based" && challengeSteps.length > 0}
                    <div
                        class="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-4"
                    >
                        <div class="flex items-center justify-between">
                            <h4 class="font-bold text-purple-900 text-sm">
                                Configurazione Punteggi Tentativi
                            </h4>
                            <span
                                class="text-[10px] font-black bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full uppercase tracking-tighter"
                            >
                                {challengeSteps[0].name}
                            </span>
                        </div>

                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {#each challengeSteps[0].scoringRules as rule, i}
                                <div>
                                    <label
                                        class="text-[10px] font-bold uppercase text-purple-400"
                                    >
                                        {rule.attempt}° Tentativo
                                        <input
                                            type="number"
                                            bind:value={
                                                challengeSteps[0].scoringRules[
                                                    i
                                                ].points
                                            }
                                            class="w-full mt-1 p-2 bg-white dark:bg-zinc-800 rounded-lg border border-purple-200 dark:border-purple-900 font-bold"
                                        />
                                    </label>
                                </div>
                            {/each}
                            <div>
                                <label
                                    class="text-[10px] font-bold uppercase text-red-400"
                                >
                                    Penalità (Errati)
                                    <input
                                        type="number"
                                        bind:value={
                                            challengeSteps[0].penaltyPoints
                                        }
                                        class="w-full mt-1 p-2 bg-white dark:bg-zinc-800 rounded-lg border border-red-200 dark:border-red-900 font-bold text-red-600 dark:text-red-400"
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                {/if}

                {#if scoringType === "timed_obstacle"}
                    <div
                        class="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-4"
                    >
                        <div class="space-y-2">
                            <span class="text-[10px] font-bold uppercase text-amber-500">
                                Seleziona Gioco
                            </span>
                            <div class="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onclick={() => setGameMode("phased_game")}
                                    class="p-4 rounded-xl border-2 text-left transition-all {gameMode === 'phased_game' ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-amber-100 bg-white text-amber-600'}"
                                >
                                    <span class="block font-black text-sm">Gioco a fasi</span>
                                    <span class="block mt-1 text-[10px] font-bold opacity-70">Step configurabili con punteggio totale</span>
                                </button>
                                <button
                                    type="button"
                                    onclick={() => setGameMode("flag_standard")}
                                    class="p-4 rounded-xl border-2 text-left transition-all {gameMode === 'flag_standard' ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-amber-100 bg-white text-amber-600'}"
                                >
                                    <span class="block font-black text-sm">Lo Stendardo</span>
                                    <span class="block mt-1 text-[10px] font-bold opacity-70">Attacco, difesa, stallo e squalifica</span>
                                </button>
                            </div>
                            <input type="hidden" name="gameMode" value={gameMode} />
                        </div>

                        {#if gameMode === "phased_game"}
                        <h4
                            class="font-bold text-amber-900 text-sm flex items-center gap-2"
                        >
                            🧩 Configurazione Gioco a fasi
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label
                                    class="text-[10px] font-bold uppercase text-amber-500"
                                >
                                    Durata Timer Staff (minuti)
                                    <input
                                        type="number"
                                        name="timerMinutes"
                                        min="1"
                                        bind:value={timerMinutes}
                                        class="w-full mt-1 p-2 bg-white rounded-lg border border-amber-200 font-bold"
                                    />
                                </label>
                            </div>
                            <div>
                                <label
                                    class="text-[10px] font-bold uppercase text-amber-500"
                                >
                                    Punteggio Massimo
                                    <input
                                        type="number"
                                        bind:value={maxPoints}
                                        class="w-full mt-1 p-2 bg-white rounded-lg border border-amber-200 font-bold"
                                    />
                                </label>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <p class="text-xs font-black uppercase tracking-widest text-amber-700">
                                        Step del gioco
                                    </p>
                                    <p class="mt-1 text-[10px] font-bold text-amber-600">
                                        Per ogni step lo staff inserirà soltanto il punteggio totale.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onclick={addPhasedGameStep}
                                    class="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600"
                                >
                                    + Aggiungi step
                                </button>
                            </div>

                            {#each phasedGameSteps as step, index}
                                <div class="flex items-end gap-3 rounded-2xl border border-amber-100 bg-white p-4">
                                    <label class="min-w-0 flex-1 text-[10px] font-bold uppercase text-amber-500">
                                        Nome Step {index + 1}
                                        <input
                                            type="text"
                                            bind:value={phasedGameSteps[index].name}
                                            placeholder="Step {index + 1}"
                                            class="w-full mt-1 p-3 bg-white rounded-lg border border-amber-200 font-bold text-zinc-900"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onclick={() => removePhasedGameStep(index)}
                                        disabled={phasedGameSteps.length <= 1}
                                        class="rounded-xl border border-red-200 px-3 py-3 text-xs font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label="Rimuovi Step {index + 1}"
                                    >
                                        Rimuovi
                                    </button>
                                </div>
                            {/each}
                        </div>
                        <input
                            type="hidden"
                            name="phasedGameSteps"
                            value={JSON.stringify(phasedGameSteps)}
                        />
                        {:else}
                            <h4 class="font-bold text-amber-900 text-sm flex items-center gap-2">
                                🏳️ Configurazione Lo Stendardo
                            </h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label class="text-[10px] font-bold uppercase text-amber-500">
                                    Durata Timer Staff (minuti)
                                    <input type="number" name="flagTimerMinutes" min="1" bind:value={flagTimerMinutes} class="w-full mt-1 p-2 bg-white rounded-lg border border-amber-200 font-bold" />
                                </label>
                                <label class="text-[10px] font-bold uppercase text-amber-500">
                                    Punti per colpo in difesa/stallo
                                    <input type="number" name="flagPointsPerHit" min="0" bind:value={flagPointsPerHit} class="w-full mt-1 p-2 bg-white rounded-lg border border-amber-200 font-bold" />
                                </label>
                                <label class="text-[10px] font-bold uppercase text-amber-500">
                                    Numero massimo colpi
                                    <input type="number" name="maxCarrierHits" min="1" bind:value={maxCarrierHits} class="w-full mt-1 p-2 bg-white rounded-lg border border-amber-200 font-bold" />
                                </label>
                                <label class="text-[10px] font-bold uppercase text-amber-500">
                                    Punteggio massimo da colpi
                                    <input type="number" name="maxHitPoints" min="0" bind:value={maxHitPoints} class="w-full mt-1 p-2 bg-white rounded-lg border border-amber-200 font-bold" />
                                </label>
                            </div>
                            <label class="text-[10px] font-bold uppercase text-amber-500">
                                Etichetta contatore colpi
                                <input type="text" name="carrierHitLabel" bind:value={carrierHitLabel} class="w-full mt-1 p-2 bg-white rounded-lg border border-amber-200 font-bold" />
                            </label>
                            <div class="rounded-xl border border-amber-100 bg-white p-3 space-y-3">
                                    <p class="text-[10px] font-black uppercase tracking-widest text-amber-600">Attacca</p>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <label class="block text-[10px] font-bold uppercase text-amber-500">
                                        Fascia 1
                                        <input type="number" name="attackerBand1Points" min="0" bind:value={attackerBand1Points} class="w-full mt-1 p-2 bg-white rounded-lg border border-amber-200 font-bold" />
                                    </label>
                                    <label class="block text-[10px] font-bold uppercase text-amber-500">
                                        Fascia 2
                                        <input type="number" name="attackerBand2Points" min="0" bind:value={attackerBand2Points} class="w-full mt-1 p-2 bg-white rounded-lg border border-amber-200 font-bold" />
                                    </label>
                                    <label class="block text-[10px] font-bold uppercase text-amber-500">
                                        Spawn Point
                                        <input type="number" name="attackerSpawnPoints" min="0" bind:value={attackerSpawnPoints} class="w-full mt-1 p-2 bg-white rounded-lg border border-amber-200 font-bold" />
                                    </label>
                                </div>
                            </div>
                            <p class="text-[10px] text-amber-600">
                                Attacco: migliore fascia raggiunta, senza detrazioni (50/100/150 punti). Difesa: solo colpi al portatore, fino a 70 punti. Stallo: 0 punti base più i colpi, fino a 70 punti. La squalifica vale 0.
                            </p>
                        {/if}
                    </div>
                {/if}

                <input
                    type="hidden"
                    name="steps"
                    value={JSON.stringify(challengeSteps)}
                />

                <Button
                    type="submit"
                    class="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-lg shadow-xl shadow-indigo-200"
                >
                    {editingChallenge ? "Salva Modifiche" : "Crea Attività"}
                </Button>
            </form>
        </Card.Card>
    </div>
{/if}

<!-- Faction Dialog (Existing) -->
{#if showFactionDialog}
    <div
        class="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <button
            type="button"
            class="absolute inset-0 w-full h-full cursor-default focus:outline-none"
            onclick={closeFactionDialog}
            aria-label="Chiudi"
        ></button>
        <Card.Card
            class="w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto p-6 sm:p-8 rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl relative z-10"
        >
            <h3 class="text-2xl font-black mb-8">
                {editingFaction ? "Modifica" : "Nuova"} Fazione
            </h3>
            <form
                method="POST"
                action={editingFaction ? "?/updateFaction" : "?/createFaction"}
                use:enhance={() => {
                    return async ({ update }) => {
                        await update();
                        closeFactionDialog();
                    };
                }}
                enctype="multipart/form-data"
                class="space-y-8"
            >
                {#if editingFaction}<input
                        type="hidden"
                        name="id"
                        value={editingFaction.id}
                    />{/if}
                <div class="flex gap-8">
                    <div class="shrink-0 group relative">
                        <div
                            class="w-24 h-24 rounded-xl flex items-center justify-center text-white text-3xl font-bold shadow-xl overflow-hidden border-4 border-white ring-4 ring-zinc-50"
                            style="background-color: {factionColor}"
                        >
                            {#if avatarPreview}
                                <img
                                    src={avatarPreview}
                                    alt="Preview"
                                    class="w-full h-full object-cover"
                                />
                            {:else}
                                <Flag size={40} />
                            {/if}
                        </div>
                        <label
                            class="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl font-bold text-xs"
                        >
                            Cambia
                            <input
                                type="file"
                                name="avatar"
                                accept="image/*"
                                class="hidden"
                                onchange={handleAvatarChange}
                            />
                        </label>
                    </div>
                    <div class="grow space-y-4">
                        <div class="space-y-2">
                            <label
                                class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                            >
                                Nome
                                <input
                                    type="text"
                                    name="name"
                                    value={editingFaction?.name}
                                    class="w-full mt-2 p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-100 font-bold outline-none focus:border-indigo-500 text-lg"
                                    placeholder="Nome Fazione"
                                    required
                                />
                            </label>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <label
                                    class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                                >
                                    Tipo Fazione
                                    <input
                                        type="text"
                                        name="factionType"
                                        bind:value={factionType}
                                        class="w-full mt-2 p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-100 font-bold outline-none focus:border-indigo-500"
                                        placeholder="es. Precettoria"
                                    />
                                </label>
                            </div>
                            <div class="space-y-2">
                                <label
                                    class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                                >
                                    Colore
                                    <div class="flex flex-wrap gap-2 mt-2">
                                        {#each presetColors as color}
                                            <button
                                                type="button"
                                                class="w-8 h-8 rounded-xl border-2 transition-transform hover:scale-110 {factionColor ===
                                                color
                                                    ? 'border-zinc-900 scale-110 shadow-lg'
                                                    : 'border-transparent'}"
                                                style="background-color: {color}"
                                                onclick={() =>
                                                    (factionColor = color)}
                                                aria-label="Seleziona colore {color}"
                                            ></button>
                                        {/each}
                                        <input
                                            type="color"
                                            name="color"
                                            bind:value={factionColor}
                                            class="w-8 h-8 rounded-xl overflow-hidden cursor-pointer border-none p-0"
                                            title="Scegli un colore personalizzato"
                                        />
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="space-y-2">
                    <label
                        class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                    >
                        Descrizione
                        <textarea
                            name="description"
                            bind:value={factionDescription}
                            class="w-full mt-2 p-4 rounded-2xl bg-zinc-50 border-2 border-zinc-100 font-bold outline-none focus:border-indigo-500 h-24 resize-none"
                            placeholder="Descrizione della fazione..."
                        ></textarea>
                    </label>
                </div>

                <!-- Teams Selection -->
                <div class="space-y-3">
                    <span
                        class="text-xs font-black uppercase tracking-widest text-zinc-400 ml-1"
                        id="teams-label">Squadre Assegnate</span
                    >
                    <div
                        class="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-zinc-50 rounded-2xl border-2 border-zinc-100"
                        role="group"
                        aria-labelledby="teams-label"
                    >
                        {#each data.allTeams as team}
                            <label
                                class="flex items-center gap-3 p-2 rounded-xl hover:bg-white transition-colors cursor-pointer border border-transparent {selectedTeamIds.includes(
                                    team.id,
                                )
                                    ? 'bg-white border-indigo-200 shadow-sm'
                                    : ''}"
                            >
                                <input
                                    type="checkbox"
                                    name="teamIds"
                                    value={team.id}
                                    checked={selectedTeamIds.includes(team.id)}
                                    onchange={() => toggleTeam(team.id)}
                                    class="rounded text-indigo-600 focus:ring-indigo-600"
                                />
                                <div
                                    class="w-3 h-3 rounded-full shadow-sm border border-black/10"
                                    style="background-color: {team.color}"
                                ></div>
                                <span class="text-sm font-bold truncate"
                                    >{team.name}</span
                                >
                            </label>
                        {/each}
                    </div>
                </div>

                <Button
                    type="submit"
                    class="w-full h-16 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-lg shadow-xl shadow-indigo-200"
                >
                    {editingFaction ? "Salva Modifiche" : "Crea Fazione"}
                </Button>
            </form>
        </Card.Card>
    </div>
{/if}

<!-- Delete Faction Dialog -->
{#if showDeleteFactionDialog}
    <div
        class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <button
            type="button"
            class="absolute inset-0 w-full h-full cursor-default focus:outline-none"
            onclick={closeDeleteFactionDialog}
            aria-label="Chiudi"
        ></button>
        <Card.Card
            class="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto p-6 rounded-xl bg-white dark:bg-zinc-900 shadow-2xl space-y-4 relative z-10"
        >
            <h3 class="text-xl font-black text-red-600">Elimina Fazione?</h3>
            <p class="text-zinc-500">
                Sei sicuro di voler eliminare la fazione <strong
                    >{factionToDelete?.name}</strong
                >? Le squadre associate diventeranno indipendenti.
            </p>
            <form
                method="POST"
                action="?/deleteFaction"
                use:enhance={() => {
                    return async ({ update }) => {
                        await update();
                        closeDeleteFactionDialog();
                    };
                }}
            >
                <input type="hidden" name="id" value={factionToDelete?.id} />
                <div class="flex gap-3 mt-6">
                    <Button
                        type="button"
                        variant="outline"
                        onclick={closeDeleteFactionDialog}
                        class="flex-1 rounded-xl font-bold h-12">Annulla</Button
                    >
                    <Button
                        type="submit"
                        variant="destructive"
                        class="flex-1 rounded-xl font-bold h-12">Elimina</Button
                    >
                </div>
            </form>
        </Card.Card>
    </div>
{/if}

<!-- Delete Challenge Dialog -->
{#if showDeleteChallengeDialog}
    <div
        class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
    >
        <button
            type="button"
            class="absolute inset-0 w-full h-full cursor-default focus:outline-none"
            onclick={closeDeleteChallengeDialog}
            aria-label="Chiudi"
        ></button>
        <Card.Card
            class="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto p-6 rounded-xl bg-white dark:bg-zinc-900 shadow-2xl space-y-4 relative z-10"
        >
            <h3 class="text-xl font-black text-red-600">Elimina Attività?</h3>
            <p class="text-zinc-500">
                Sei sicuro di voler eliminare l'attività <strong
                    >{challengeToDelete?.name}</strong
                >? Questa operazione non può essere annullata.
            </p>
            <form
                method="POST"
                action="?/deleteChallenge"
                use:enhance={() => {
                    return async ({ update }) => {
                        await update();
                        closeDeleteChallengeDialog();
                    };
                }}
            >
                <input type="hidden" name="id" value={challengeToDelete?.id} />
                <div class="flex gap-3 mt-6">
                    <Button
                        type="button"
                        variant="outline"
                        onclick={closeDeleteChallengeDialog}
                        class="flex-1 rounded-xl font-bold h-12">Annulla</Button
                    >
                    <Button
                        type="submit"
                        variant="destructive"
                        class="flex-1 rounded-xl font-bold h-12">Elimina</Button
                    >
                </div>
            </form>
        </Card.Card>
    </div>
{/if}
