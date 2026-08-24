<script lang="ts">
    import {
        MapPin, Plus, Trash2, X, ChevronDown, ChevronUp,
        Camera, HelpCircle, Navigation, Eye, EyeOff,
        Save, Pencil, Target
    } from "lucide-svelte";
    import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
    import { Button } from "$lib/components/ui/button";
    import { browser } from "$app/environment";
    import { parseGeoPoint, parseLatitude, parseLongitude } from "$lib/utils/geo";
    import { parseQuizOptions, parseStoredQuizOptions } from "$lib/utils/quiz-options";

    let { data } = $props();

    // ── Derived current event ──────────────────────────────────────────────
    const event = $derived(data.event);

    // ── Types ──────────────────────────────────────────────────────────────
    type GeoChallengeType = 'gps' | 'photo' | 'quiz';
    type Waypoint = {
        id: string; huntId: string; adminName: string | null; name: string; lat: string; lng: string;
        radiusMeters: number; sortOrder: number;
        challengeType: GeoChallengeType;
        enigmaText: string | null; quizQuestion: string | null;
        quizOptions: string | null;
        quizAnswer: string | null; quizTimeLimitSeconds: number;
        challengeDisclaimerText: string | null;
        pointsOnArrival: number;
        pointsOnSuccess: number;
    };
    type Hunt = {
        id: string; eventId: string; factionId?: string | null; name: string; description: string | null;
        challengeDisclaimerText: string | null;
		deadlineAt: string | number | Date | null;
        isActive: boolean; waypoints: Waypoint[];
    };
    type ProgressRow = {
        id: string; status: string; pointsEarned: number; completedAt: string | number | Date | null;
        photoPath: string | null;
        updatedAt: string | number | Date | null; teamName: string; factionId: string; factionName: string;
        waypointAdminName: string | null; waypointDestination: string;
        waypointId: string; huntId: string; huntName: string;
    };
	type ProgressGroup = {
		factionId: string;
		factionName: string;
		rows: ProgressRow[];
		pendingPhotos: number;
	};

    // ── State ──────────────────────────────────────────────────────────────
    let hunts = $state<Hunt[]>([]);
    const progressRows = $derived(data.progressRows ?? []);
    let resetProgressIds = $state<string[]>([]);
    const visibleProgressRows = $derived(
        progressRows.filter((row: ProgressRow) => !resetProgressIds.includes(row.id)),
    );
    let selectedHunt = $state<Hunt | null>(null);
	const filteredProgressRows = $derived(
		visibleProgressRows.filter((row: ProgressRow) => !selectedHunt || row.huntId === selectedHunt.id)
	);
	const progressGroups = $derived.by((): ProgressGroup[] => {
		const groups = new Map<string, ProgressGroup>();

		for (const faction of data.factions ?? []) {
			groups.set(faction.id, {
				factionId: faction.id,
				factionName: faction.name,
				rows: [],
				pendingPhotos: 0
			});
		}

		for (const row of filteredProgressRows) {
			const group = groups.get(row.factionId) ?? {
				factionId: row.factionId,
				factionName: row.factionName,
				rows: [],
				pendingPhotos: 0
			};
			group.rows.push(row);
			if (row.status === 'photo_submitted') group.pendingPhotos += 1;
			groups.set(row.factionId, group);
		}

		return [...groups.values()].filter((group) => group.rows.length > 0);
	});
    let showHuntDialog = $state(false);
    let showWaypointDialog = $state(false);
    let editingHunt = $state<Hunt | null>(null);
    let editingWaypoint = $state<Waypoint | null>(null);
    let isSubmitting = $state(false);
    let toast = $state<{ msg: string; type: 'ok' | 'err' } | null>(null);
    let showConfirmationDialog = $state(false);
    let pendingConfirmation = $state<{
        title: string;
        message: string;
        confirmLabel: string;
        type: 'warning' | 'danger' | 'info';
        action: () => Promise<void>;
    } | null>(null);

    // Hunt form
    let huntName = $state('');
    let huntDescription = $state('');
    let huntDisclaimer = $state('');
	let huntDeadline = $state('');
    let huntEventId = $state('');
    let huntFactionId = $state('');
    let huntActive = $state(false);

    // Waypoint form
    let wpAdminName = $state('');
    let wpName = $state('');
    let wpLat = $state('');
    let wpLng = $state('');
    let wpRadius = $state(20);
    let wpChallengeType = $state<GeoChallengeType>('gps');
    let wpEnigma = $state('');
    let wpQuizQ = $state('');
	let wpQuizOptions = $state<string[]>(['', '', '']);
    let wpQuizCorrectIndex = $state(0);
    let wpQuizTime = $state(60);
    let wpDisclaimer = $state('');
    let wpPointsArrival = $state(0);
    let wpPoints = $state(100);
	let quizFormValid = $derived(
		wpChallengeType !== 'quiz' ||
			(wpQuizQ.trim().length > 0 &&
				wpQuizOptions.length >= 3 &&
				wpQuizOptions.length <= 5 &&
				wpQuizOptions.every((option) => option.trim().length > 0) &&
				new Set(wpQuizOptions.map((option) => option.trim().toLocaleLowerCase('it'))).size ===
					wpQuizOptions.length &&
				wpQuizCorrectIndex >= 0 &&
				wpQuizCorrectIndex < wpQuizOptions.length)
	);
    const defaultHuntDisclaimer = 'Confermo di essere fisicamente presente sul posto e di voler iniziare la sfida.';

    $effect(() => {
        hunts = data.hunts ?? [];
    });

    // ── Helpers ───────────────────────────────────────────────────────────
    function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
        toast = { msg, type };
        setTimeout(() => (toast = null), 3500);
    }

    function requestConfirmation(options: NonNullable<typeof pendingConfirmation>) {
        pendingConfirmation = options;
        showConfirmationDialog = true;
    }

    function runPendingConfirmation() {
        const action = pendingConfirmation?.action;
        pendingConfirmation = null;
        if (action) void action();
    }

    function cancelPendingConfirmation() {
        pendingConfirmation = null;
    }

    async function fetchHunts() {
        const res = await fetch(`/api/geophase/hunts?eventId=${event.id}`);
        const json = await res.json();
        hunts = json.data ?? [];
        if (selectedHunt) {
            selectedHunt = hunts.find((h) => h.id === selectedHunt!.id) ?? null;
        }
    }

    function resetGeoProgress(row: ProgressRow) {
        const waypointLabel = row.waypointAdminName || row.waypointDestination;
        requestConfirmation({
            title: 'Riabilita GeoPhase',
            message: `Riabilitare "${waypointLabel}" per ${row.teamName}?`,
            confirmLabel: 'Riabilita',
            type: 'warning',
            action: async () => {
                const res = await fetch(`/api/geophase/progress/${row.id}`, { method: 'DELETE' });
                if (!res.ok) {
                    showToast('Errore durante la riabilitazione', 'err');
                    return;
                }
                resetProgressIds = [...resetProgressIds, row.id];
                showToast('GeoPhase riabilitata per la squadra');
            }
        });
    }

    function validateGeoPhoto(row: ProgressRow, action: 'approve' | 'reject') {
        const label = action === 'approve' ? 'approvare' : 'respingere';
        requestConfirmation({
            title: action === 'approve' ? 'Approva foto' : 'Respingi foto',
            message: `Vuoi ${label} la foto di ${row.teamName}?`,
            confirmLabel: action === 'approve' ? 'Approva' : 'Respingi',
            type: action === 'approve' ? 'info' : 'danger',
            action: async () => {
                const res = await fetch(`/api/geophase/progress/${row.id}/validate-photo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action })
                });
                if (!res.ok) {
                    const json = await res.json().catch(() => ({}));
                    showToast(json.message ?? 'Errore validazione foto', 'err');
                    return;
                }
                location.reload();
            }
        });
    }

	function deleteGeoPhoto(row: ProgressRow) {
		requestConfirmation({
			title: 'Cancella foto',
			message: `Cancellare definitivamente la foto di ${row.teamName}? Progressi e punti resteranno invariati.`,
			confirmLabel: 'Cancella foto',
			type: 'danger',
			action: async () => {
				const res = await fetch(`/api/geophase/progress/${row.id}/delete-photo`, {
					method: 'DELETE'
				});
				if (!res.ok) {
					const json = await res.json().catch(() => ({}));
					showToast(json.message ?? 'Errore durante la cancellazione della foto', 'err');
					return;
				}
				location.reload();
			}
		});
	}

    function progressLabel(status: string) {
        return status === 'failed'
            ? 'Saltata'
            : status === 'completed'
              ? 'Completata'
              : status === 'photo_submitted'
                ? 'Foto da validare'
              : status === 'challenge_active'
                ? 'Sfida attiva'
                : status === 'arrived'
                  ? 'Arrivata'
                  : status;
    }

    function geoPhotoUrl(path: string | null) {
        return path ? `/api/geophase/photos/${path}` : '';
    }

	function dateTimeLocalValue(value: string | number | Date | null) {
		if (!value) return '';
		const parsed = new Date(value);
		if (!Number.isFinite(parsed.getTime())) return '';
		const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
		return local.toISOString().slice(0, 16);
	}

	function deadlineLabel(value: string | number | Date | null) {
		if (!value) return null;
		return new Intl.DateTimeFormat('it-IT', {
			dateStyle: 'short',
			timeStyle: 'short'
		}).format(new Date(value));
	}

    function waypointTypeLabel(type: GeoChallengeType) {
        if (type === 'photo') return 'Foto';
        if (type === 'quiz') return 'Quiz';
        return 'GPS';
    }

    // ── Hunt actions ──────────────────────────────────────────────────────
    function openCreateHunt() {
        editingHunt = null;
        huntName = ''; huntDescription = ''; huntDisclaimer = defaultHuntDisclaimer; huntDeadline = ''; huntActive = false;
        huntEventId = event.id;
        huntFactionId = '';
        showHuntDialog = true;
    }

    function openEditHunt(hunt: Hunt) {
        editingHunt = hunt;
        huntName = hunt.name;
        huntDescription = hunt.description ?? '';
        huntDisclaimer = hunt.challengeDisclaimerText ?? defaultHuntDisclaimer;
		huntDeadline = dateTimeLocalValue(hunt.deadlineAt);
        huntEventId = hunt.eventId;
        huntFactionId = hunt.factionId ?? '';
        huntActive = hunt.isActive;
        showHuntDialog = true;
    }

    async function saveHunt() {
        if (!huntName.trim()) return;
        isSubmitting = true;
        try {
            const wasEditing = Boolean(editingHunt);
            const res = await fetch(editingHunt ? `/api/geophase/hunts/${editingHunt.id}` : '/api/geophase/hunts', {
                method: editingHunt ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: huntName,
                    description: huntDescription,
                    challengeDisclaimerText: huntDisclaimer,
					deadlineAt: huntDeadline ? new Date(huntDeadline).toISOString() : null,
                    eventId: huntEventId,
                    factionId: huntFactionId || null,
                    isActive: huntActive
                })
            });
            if (!res.ok) throw new Error((await res.json()).message);
            await fetchHunts();
            showHuntDialog = false;
            editingHunt = null;
            showToast(wasEditing ? 'Caccia aggiornata!' : 'Caccia creata!');
        } catch (e: any) {
            showToast(e.message ?? 'Errore', 'err');
        } finally { isSubmitting = false; }
    }

    async function toggleHuntActive(hunt: Hunt) {
        const res = await fetch(`/api/geophase/hunts/${hunt.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !hunt.isActive })
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            showToast(json.message ?? 'Impossibile modificare la caccia', 'err');
            return;
        }
        await fetchHunts();
    }

    function deleteHunt(hunt: Hunt) {
        requestConfirmation({
            title: 'Elimina caccia',
            message: `Eliminare la caccia "${hunt.name}" e tutti i suoi waypoint?`,
            confirmLabel: 'Elimina caccia',
            type: 'danger',
            action: async () => {
                await fetch(`/api/geophase/hunts/${hunt.id}`, { method: 'DELETE' });
                if (selectedHunt?.id === hunt.id) selectedHunt = null;
                await fetchHunts();
                showToast('Caccia eliminata');
            }
        });
    }

    // ── Waypoint actions ──────────────────────────────────────────────────
    function openCreateWaypoint() {
        editingWaypoint = null;
        wpAdminName = ''; wpName = ''; wpLat = ''; wpLng = ''; wpRadius = 20;
		wpChallengeType = 'gps'; wpEnigma = ''; wpQuizQ = '';
		wpQuizOptions = ['', '', '']; wpQuizCorrectIndex = 0;
		wpQuizTime = 60; wpDisclaimer = '';
        wpPointsArrival = 0; wpPoints = 100;
        showWaypointDialog = true;
    }

    function openEditWaypoint(wp: Waypoint) {
        editingWaypoint = wp;
        wpAdminName = wp.adminName ?? ''; wpName = wp.name; wpLat = wp.lat; wpLng = wp.lng;
        wpRadius = wp.radiusMeters;
        wpChallengeType = wp.challengeType;
		wpEnigma = wp.enigmaText ?? '';
		const storedOptions = parseStoredQuizOptions(wp.quizOptions);
		const legacyQuiz = storedOptions ? null : parseQuizOptions(wp.quizQuestion);
		wpQuizQ = legacyQuiz?.prompt ?? wp.quizQuestion ?? '';
		wpQuizOptions = storedOptions ?? legacyQuiz?.options.map((option) => option.label) ?? ['', '', ''];
		const legacyCorrectIndex = legacyQuiz?.options.findIndex(
			(option) => option.value.toLocaleLowerCase('it') === wp.quizAnswer?.toLocaleLowerCase('it')
		) ?? -1;
		const textCorrectIndex = wpQuizOptions.findIndex(
			(option) => option.toLocaleLowerCase('it') === wp.quizAnswer?.toLocaleLowerCase('it')
		);
		wpQuizCorrectIndex = textCorrectIndex >= 0 ? textCorrectIndex : Math.max(legacyCorrectIndex, 0);
		wpQuizTime = wp.quizTimeLimitSeconds;
        wpDisclaimer = wp.challengeDisclaimerText ?? '';
        wpPointsArrival = wp.pointsOnArrival ?? 0;
        wpPoints = wp.pointsOnSuccess;
        showWaypointDialog = true;
    }

    async function saveWaypoint() {
		if (!selectedHunt || !quizFormValid) return;
        isSubmitting = true;
        const payload = {
            huntId: selectedHunt.id,
            adminName: wpAdminName, name: wpName, lat: wpLat, lng: wpLng,
            radiusMeters: wpRadius,
            sortOrder: editingWaypoint ? editingWaypoint.sortOrder : (selectedHunt.waypoints.length),
            challengeType: wpChallengeType,
            enigmaText: wpEnigma,
            quizQuestion: wpChallengeType === 'quiz' ? wpQuizQ : null,
			quizOptions: wpChallengeType === 'quiz' ? wpQuizOptions : null,
			quizAnswer:
				wpChallengeType === 'quiz' ? wpQuizOptions[wpQuizCorrectIndex] : null,
            quizTimeLimitSeconds: wpQuizTime,
            challengeDisclaimerText: wpDisclaimer || null,
            pointsOnArrival: wpPointsArrival,
            pointsOnSuccess: wpPoints
        };
        try {
            const url = editingWaypoint
                ? `/api/geophase/waypoints/${editingWaypoint.id}`
                : '/api/geophase/waypoints';
            const res = await fetch(url, {
                method: editingWaypoint ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error((await res.json()).message);
            await fetchHunts();
            showWaypointDialog = false;
            showToast(editingWaypoint ? 'Waypoint aggiornato!' : 'Waypoint creato!');
        } catch (e: any) {
            showToast(e.message ?? 'Errore', 'err');
        } finally { isSubmitting = false; }
    }

	function updateQuizOption(index: number, value: string) {
		wpQuizOptions = wpQuizOptions.map((option, optionIndex) =>
			optionIndex === index ? value : option
		);
	}

	function addQuizOption() {
		if (wpQuizOptions.length >= 5) return;
		wpQuizOptions = [...wpQuizOptions, ''];
	}

	function removeQuizOption(index: number) {
		if (wpQuizOptions.length <= 3) return;
		wpQuizOptions = wpQuizOptions.filter((_, optionIndex) => optionIndex !== index);
		if (wpQuizCorrectIndex === index) wpQuizCorrectIndex = 0;
		else if (wpQuizCorrectIndex > index) wpQuizCorrectIndex -= 1;
	}

    function deleteWaypoint(wp: Waypoint) {
        requestConfirmation({
            title: 'Elimina waypoint',
            message: `Eliminare il waypoint "${wp.adminName || wp.name}"?`,
            confirmLabel: 'Elimina waypoint',
            type: 'danger',
            action: async () => {
                await fetch(`/api/geophase/waypoints/${wp.id}`, { method: 'DELETE' });
                await fetchHunts();
                showToast('Waypoint eliminato');
            }
        });
    }

    async function moveWaypoint(wp: Waypoint, dir: -1 | 1) {
        if (!selectedHunt) return;
        const wps = [...selectedHunt.waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
        const idx = wps.findIndex((w) => w.id === wp.id);
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= wps.length) return;

        const res = await fetch('/api/geophase/waypoints/reorder', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstId: wps[idx].id, secondId: wps[swapIdx].id })
        });
        if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            showToast(json.message ?? 'Riordino non riuscito', 'err');
            return;
        }
        await fetchHunts();
    }

    // Use browser geolocation to fill lat/lng fields
    function useMyLocation() {
        if (!browser || !navigator.geolocation) {
            showToast('Geolocalizzazione non disponibile', 'err');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                wpLat = pos.coords.latitude.toFixed(7);
                wpLng = pos.coords.longitude.toFixed(7);
            },
            () => showToast('Impossibile ottenere posizione GPS', 'err'),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    // DMS Coordinate parsing and Google Maps string importing
    function parseDMSString(input: string): { lat: number; lng: number } | null {
        if (!input) return null;
        
        // Match degrees, minutes, seconds, direction (N/S/E/W) with flexible spacing and smart quotes
        const dmsRegex = /(\d+)°\s*(\d+)['’′]\s*(\d+(?:\.\d+)?)(?:"|”|″|'')\s*([NSEWnswe])/gi;
        const matches = [...input.matchAll(dmsRegex)];
        
        if (matches.length === 2) {
            const parseCoord = (match: RegExpMatchArray): { value: number; axis: 'lat' | 'lng' } | null => {
                const deg = parseFloat(match[1]);
                const min = parseFloat(match[2]);
                const sec = parseFloat(match[3]);
                const dir = match[4].toUpperCase();
                const axis = dir === 'N' || dir === 'S' ? 'lat' : 'lng';
                if (min >= 60 || sec >= 60 || deg > (axis === 'lat' ? 90 : 180)) return null;
                
                let decimal = deg + (min / 60) + (sec / 3600);
                if (dir === 'S' || dir === 'W') {
                    decimal = -decimal;
                }
                return { value: decimal, axis };
            };
            
            const first = parseCoord(matches[0]);
            const second = parseCoord(matches[1]);

            if (!first || !second || first.axis === second.axis) return null;
            const lat = first.axis === 'lat' ? first.value : second.value;
            const lng = first.axis === 'lng' ? first.value : second.value;
            return parseGeoPoint(lat, lng);
        }
        
        const decimalRegex = /(-?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d*)?|\.\d+))/;
        const decimalMatch = input.match(decimalRegex);
        if (decimalMatch) {
            return parseGeoPoint(decimalMatch[1], decimalMatch[2]);
        }
        
        return null;
    }

    function parseSingleDMS(input: string, expectedAxis: 'lat' | 'lng'): number | null {
        if (!input) return null;
        const dmsRegex = /(\d+)°\s*(\d+)['’′]\s*(\d+(?:\.\d+)?)(?:"|”|″|'')\s*([NSEWnswe])/i;
        const match = input.match(dmsRegex);
        if (match) {
            const deg = parseFloat(match[1]);
            const min = parseFloat(match[2]);
            const sec = parseFloat(match[3]);
            const dir = match[4].toUpperCase();
            const axis = dir === 'N' || dir === 'S' ? 'lat' : 'lng';
            if (axis !== expectedAxis || min >= 60 || sec >= 60) return null;
            
            let decimal = deg + (min / 60) + (sec / 3600);
            if (dir === 'S' || dir === 'W') {
                decimal = -decimal;
            }
            return expectedAxis === 'lat' ? parseLatitude(decimal) : parseLongitude(decimal);
        }
        return null;
    }

    function handleLatInput(val: string) {
        const parsed = parseDMSString(val);
        if (parsed) {
            wpLat = parsed.lat.toFixed(7);
            wpLng = parsed.lng.toFixed(7);
            showToast('Coordinate importate con successo!');
            return;
        }
        const single = parseSingleDMS(val, 'lat');
        if (single !== null) {
            wpLat = single.toFixed(7);
            showToast('Coordinata DMS convertita in decimale!');
        } else {
            wpLat = val;
        }
    }

    function handleLngInput(val: string) {
        const parsed = parseDMSString(val);
        if (parsed) {
            wpLat = parsed.lat.toFixed(7);
            wpLng = parsed.lng.toFixed(7);
            showToast('Coordinate importate con successo!');
            return;
        }
        const single = parseSingleDMS(val, 'lng');
        if (single !== null) {
            wpLng = single.toFixed(7);
            showToast('Coordinata DMS convertita in decimale!');
        } else {
            wpLng = val;
        }
    }
</script>

<div class="p-6 lg:p-12 w-full">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div class="flex items-center gap-4">
            <div class="bg-emerald-600/10 p-3 rounded-2xl border border-emerald-600/20">
                <Navigation size={32} class="text-emerald-600" />
            </div>
            <div>
                <h1 class="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                    GeoPhase — {event.name}
                </h1>
                <p class="text-zinc-500 dark:text-zinc-400 font-medium">
                    Caccia al tesoro geo-localizzata con sfide
                </p>
            </div>
        </div>
        <Button
            onclick={openCreateHunt}
            class="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
            <Plus size={20} class="mr-2" />
            Nuova Caccia
        </Button>
    </div>

    <!-- Toast -->
    {#if toast}
        <div class="fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-3
            {toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}">
            {toast.msg}
        </div>
    {/if}

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <!-- Left: Hunt List -->
        <div class="xl:col-span-1 space-y-4">
            <h2 class="text-xs font-black uppercase tracking-widest text-zinc-500 px-1">
                Cacce ({hunts.length})
            </h2>

            {#if hunts.length === 0}
                <div class="p-10 border-2 border-dashed border-zinc-200 rounded-xl text-center">
                    <Navigation size={40} class="mx-auto text-zinc-300 mb-3" />
                    <p class="text-zinc-500 text-sm font-medium">Nessuna caccia creata per questo evento</p>
                </div>
            {/if}

            {#each hunts as hunt (hunt.id)}
                <div
                    role="button"
                    tabindex="0"
                    onclick={() => selectedHunt = hunt}
                    onkeydown={(e) => e.key === 'Enter' && (selectedHunt = hunt)}
                    class="w-full text-left p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer
                        {selectedHunt?.id === hunt.id
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-lg shadow-emerald-500/10'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 bg-white dark:bg-zinc-900'}"
                >
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <div>
                            <p class="font-black text-zinc-900 dark:text-white line-clamp-1">{hunt.name}</p>
                            <p class="text-xs text-zinc-500 mt-0.5">
                                {hunt.waypoints.length} waypoint · {event.name}
                            </p>
							{#if deadlineLabel(hunt.deadlineAt)}
								<p class="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-1">
									Deadline: {deadlineLabel(hunt.deadlineAt)}
								</p>
							{/if}
                            {#if hunt.factionId}
                                {@const faction = data.factions.find(f => f.id === hunt.factionId)}
                                {#if faction}
                                    <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                        Fazione: {faction.name}
                                    </span>
                                {/if}
                            {/if}
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button
                                onclick={(e) => { e.stopPropagation(); toggleHuntActive(hunt); }}
                                class="p-1.5 rounded-xl transition-colors
                                    {hunt.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}"
                                title={hunt.isActive ? 'Disattiva' : 'Attiva'}
                            >
                                {#if hunt.isActive}
                                    <Eye size={14} />
                                {:else}
                                    <EyeOff size={14} />
                                {/if}
                            </button>
                            <button
                                onclick={(e) => { e.stopPropagation(); openEditHunt(hunt); }}
                                class="p-1.5 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                title="Modifica"
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                onclick={(e) => { e.stopPropagation(); deleteHunt(hunt); }}
                                class="p-1.5 rounded-xl bg-zinc-100 text-zinc-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                    {#if hunt.isActive}
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            ATTIVA
                        </span>
                    {/if}
                </div>
            {/each}
        </div>

        <!-- Right: Waypoints editor -->
        <div class="xl:col-span-2">
            {#if !selectedHunt}
                <div class="h-full flex items-center justify-center p-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                    <div class="text-center">
                        <Target size={48} class="mx-auto text-zinc-300 mb-4" />
                        <p class="text-zinc-500 font-medium">Seleziona una caccia per gestire i waypoint</p>
                    </div>
                </div>
            {:else}
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <h2 class="text-lg font-black text-zinc-900 dark:text-white">
                            {selectedHunt.name}
                        </h2>
                        <Button
                            onclick={openCreateWaypoint}
                            class="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
                        >
                            <Plus size={16} class="mr-1.5" />
                            Aggiungi Waypoint
                        </Button>
                    </div>

                    {#if selectedHunt.waypoints.length === 0}
                        <div class="p-12 border-2 border-dashed border-zinc-200 rounded-xl text-center">
                            <MapPin size={40} class="mx-auto text-zinc-300 mb-3" />
                            <p class="text-zinc-500 text-sm font-medium">Nessun waypoint. Aggiungi il primo!</p>
                        </div>
                    {/if}

                    {#each [...selectedHunt.waypoints].sort((a, b) => a.sortOrder - b.sortOrder) as wp, i (wp.id)}
                        <div class="p-5 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
                            <div class="flex items-start gap-4">
                                <!-- Order badge -->
                                <div class="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                                    {i + 1}
                                </div>

                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <p class="font-black text-zinc-900 dark:text-white">
                                            {wp.adminName || `Modulo ${i + 1}`}
                                        </p>
                                        <span class="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider
                                            {wp.challengeType === 'gps'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : wp.challengeType === 'photo'
                                                  ? 'bg-blue-100 text-blue-700'
                                                  : 'bg-amber-100 text-amber-700'}">
                                            {#if wp.challengeType === 'gps'}
                                                <Navigation class="inline w-3 h-3 mr-0.5" /> GPS
                                            {:else if wp.challengeType === 'photo'}
                                                <Camera class="inline w-3 h-3 mr-0.5" /> Foto
                                            {:else}
                                                <HelpCircle class="inline w-3 h-3 mr-0.5" /> Quiz
                                            {/if}
                                        </span>
                                    </div>
                                    <p class="text-xs text-zinc-500 font-mono">
                                        {#if wp.challengeType === 'gps'}
                                            {wp.lat}, {wp.lng} · r={wp.radiusMeters}m · arrivo:{wp.pointsOnArrival ?? 0}pt
                                        {:else}
                                            modulo:{wp.pointsOnSuccess}pt
                                        {/if}
                                    </p>
                                    <div class="mt-3 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
                                        <p class="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            Destinazione / indizio
                                        </p>
                                        <p class="mt-1 text-sm text-zinc-700 dark:text-zinc-200 line-clamp-2">
                                            {wp.name}
                                        </p>
                                    </div>
                                    {#if wp.enigmaText}
                                        <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-2 line-clamp-1 italic">
                                            "{wp.enigmaText}"
                                        </p>
                                    {/if}
                                    {#if wp.challengeType === 'quiz' && wp.quizQuestion}
                                        <p class="text-xs text-amber-700 dark:text-amber-400 mt-1 line-clamp-1">
                                            {wp.quizQuestion} ({wp.quizTimeLimitSeconds}s)
                                        </p>
                                    {/if}
                                </div>

                                <!-- Actions -->
                                <div class="flex items-center gap-1 shrink-0">
                                    <button
                                        onclick={() => moveWaypoint(wp, -1)}
                                        disabled={i === 0}
                                        class="p-1.5 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                    <button
                                        onclick={() => moveWaypoint(wp, 1)}
                                        disabled={i === selectedHunt!.waypoints.length - 1}
                                        class="p-1.5 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                    <button
                                        onclick={() => openEditWaypoint(wp)}
                                        class="p-1.5 rounded-xl bg-zinc-100 text-zinc-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        onclick={() => deleteWaypoint(wp)}
                                        class="p-1.5 rounded-xl bg-zinc-100 text-zinc-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}

            {#if visibleProgressRows.length > 0}
                <div class="mt-8 p-5 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4">
                    <div class="flex items-center justify-between gap-4">
                        <div>
                            <h3 class="text-lg font-black text-zinc-900 dark:text-white">
                                Progressi squadre
                            </h3>
                            <p class="text-xs text-zinc-500 font-medium">
								Le foto approvate o respinte restano consultabili e possono essere cancellate senza modificare punti o progressi.
                            </p>
                        </div>
                    </div>

					{#if progressGroups.length > 0}
						<div class="grid grid-cols-1 2xl:grid-cols-2 gap-4 items-start">
							{#each progressGroups as group (group.factionId)}
								<section class="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/40">
									<header class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-blue-50 dark:bg-blue-950/30">
										<div class="min-w-0">
											<p class="text-[10px] font-black uppercase tracking-widest text-blue-500 dark:text-blue-400">Fazione</p>
											<h4 class="font-black text-zinc-900 dark:text-white truncate">{group.factionName}</h4>
										</div>
										<div class="flex flex-wrap items-center justify-end gap-2 text-[10px] font-black uppercase tracking-wider">
											<span class="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-blue-100 dark:border-blue-900">
												{group.rows.length} attività
											</span>
											{#if group.pendingPhotos > 0}
												<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
													<Camera size={12} />
													{group.pendingPhotos} foto da validare
												</span>
											{/if}
										</div>
									</header>

									<div class="p-3 space-y-3">
										{#each group.rows as row (row.id)}
											<div class="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
												<div class="min-w-0 flex-1">
													<div class="flex flex-wrap items-center gap-2 mb-1">
														<span class="font-black text-zinc-900 dark:text-white">{row.teamName}</span>
														<span class="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider {row.status === 'failed' ? 'bg-red-100 text-red-700' : row.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
															{progressLabel(row.status)}
														</span>
													</div>
													<p class="text-sm font-bold text-zinc-700 dark:text-zinc-200 line-clamp-2">
														{row.waypointAdminName || row.waypointDestination}
													</p>
													<p class="text-xs text-zinc-500 mt-1">{row.waypointDestination}</p>
													<p class="text-xs text-zinc-500 mt-1">
														{row.huntName} · punti: {row.pointsEarned ?? 0}
													</p>
													{#if row.photoPath}
														<a
															href={geoPhotoUrl(row.photoPath)}
															target="_blank"
															class="mt-3 inline-flex items-center gap-3 p-2 pr-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 transition-colors"
														>
															<img
																src={geoPhotoUrl(row.photoPath)}
																alt="Foto inviata da {row.teamName}"
																class="w-20 h-14 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700"
															/>
															<span class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
																Apri foto
															</span>
														</a>
													{/if}
												</div>
												<div class="shrink-0 flex flex-col sm:flex-row md:flex-col gap-2">
													{#if row.status === 'photo_submitted'}
														<Button
															onclick={() => validateGeoPhoto(row, 'approve')}
															class="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
														>
															Approva
														</Button>
														<Button
															variant="outline"
															onclick={() => validateGeoPhoto(row, 'reject')}
															class="rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
														>
															Respingi
														</Button>
													{/if}
													{#if row.photoPath && (row.status === 'completed' || row.status === 'failed')}
														<Button
															variant="outline"
															onclick={() => deleteGeoPhoto(row)}
															class="rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
														>
															<Trash2 size={15} class="mr-1.5" />
															Cancella foto
														</Button>
													{/if}
													<Button
														variant="outline"
														onclick={() => resetGeoProgress(row)}
														class="rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-100"
													>
														Riabilita
													</Button>
												</div>
											</div>
										{/each}
									</div>
								</section>
							{/each}
						</div>
					{:else}
						<div class="p-6 text-center text-sm font-bold text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
							Nessun progresso per questa caccia.
						</div>
					{/if}
                </div>
            {/if}
        </div>
    </div>
</div>

<ConfirmDialog
    bind:show={showConfirmationDialog}
    title={pendingConfirmation?.title ?? 'Conferma operazione'}
    message={pendingConfirmation?.message ?? 'Sei sicuro di voler procedere?'}
    confirmLabel={pendingConfirmation?.confirmLabel ?? 'Conferma'}
    type={pendingConfirmation?.type ?? 'warning'}
    onConfirm={runPendingConfirmation}
    onCancel={cancelPendingConfirmation}
/>

<!-- ===== CREATE HUNT DIALOG ===== -->
{#if showHuntDialog}
    <div
        class="fixed inset-0 bg-zinc-950/60 backdrop-blur-md z-50 flex items-start justify-center p-4"
        onclick={(e) => e.target === e.currentTarget && (showHuntDialog = false)}
        onkeydown={(e) => e.key === 'Escape' && (showHuntDialog = false)}
        role="button" aria-label="Chiudi" tabindex="0"
    >
        <div class="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto shadow-2xl animate-in zoom-in-95">
            <div class="flex items-center justify-between p-8 border-b border-zinc-200 dark:border-zinc-800">
                <div class="flex items-center gap-3 text-emerald-600">
                    <Navigation size={22} />
                    <h2 class="text-xl font-black">{editingHunt ? 'Modifica' : 'Nuova'} Caccia GeoPhase</h2>
                </div>
                <Button variant="ghost" size="icon" onclick={() => (showHuntDialog = false)} class="rounded-2xl">
                    <X size={20} />
                </Button>
            </div>
            <div class="p-8 space-y-5">
                <div class="space-y-2">
                    <label for="hunt-name" class="block text-xs font-black uppercase tracking-widest text-zinc-500">Nome *</label>
                    <input id="hunt-name" type="text" bind:value={huntName} placeholder="Es: Caccia al Tesoro 2026"
                        class="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all" />
                </div>
                <div class="space-y-2">
                    <label for="hunt-desc" class="block text-xs font-black uppercase tracking-widest text-zinc-500">Descrizione</label>
                    <textarea id="hunt-desc" bind:value={huntDescription} rows="2" placeholder="Descrizione opzionale..."
                        class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all resize-none"></textarea>
                </div>
                <div class="space-y-2">
                    <label for="hunt-disclaimer" class="block text-xs font-black uppercase tracking-widest text-zinc-500">
                        Warning predefinito
                    </label>
                    <textarea id="hunt-disclaimer" bind:value={huntDisclaimer} rows="4"
                        placeholder={defaultHuntDisclaimer}
                        class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all resize-y text-sm"></textarea>
                    <p class="text-[10px] text-zinc-400">
                        Mostrato prima dell'inizio della sfida quando il waypoint non ha un Warning specifico.
                    </p>
                </div>
                <div class="space-y-2">
                    <span class="block text-xs font-black uppercase tracking-widest text-zinc-500">Evento</span>
                    <div class="w-full h-12 px-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl flex items-center font-bold text-zinc-500 dark:text-zinc-400">
                        {event.name}
                    </div>
                </div>
				<div class="space-y-2">
					<label for="hunt-deadline" class="block text-xs font-black uppercase tracking-widest text-zinc-500">
						Deadline
					</label>
					<input id="hunt-deadline" type="datetime-local" bind:value={huntDeadline}
						class="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all" />
					<p class="text-[10px] text-zinc-400">
						Alla scadenza non saranno accettate nuove azioni; punti e progressi già acquisiti restano invariati.
					</p>
				</div>
                <div class="space-y-2">
                    <label for="hunt-faction" class="block text-xs font-black uppercase tracking-widest text-zinc-500">Fazione (Opzionale)</label>
                    <select id="hunt-faction" bind:value={huntFactionId}
                        class="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all font-bold">
                        <option value="">Tutte le fazioni (Nessuna restrizione)</option>
                        {#each data.factions as faction}
                            <option value={faction.id}>{faction.name}</option>
                        {/each}
                    </select>
                </div>
                <label class="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" bind:checked={huntActive} class="w-5 h-5 rounded-lg border-2 accent-emerald-600" />
                    <span class="font-bold text-sm">Attiva immediatamente</span>
                </label>
                <div class="flex gap-3 pt-2">
                    <Button variant="ghost" onclick={() => (showHuntDialog = false)} class="flex-1 h-12 rounded-2xl">Annulla</Button>
                    <Button onclick={saveHunt} disabled={isSubmitting || !huntName.trim()}
                        class="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">
                        {isSubmitting ? 'Salvataggio...' : editingHunt ? 'Salva' : 'Crea Caccia'}
                    </Button>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- ===== WAYPOINT DIALOG ===== -->
{#if showWaypointDialog}
    <div
        class="fixed inset-0 bg-zinc-950/60 backdrop-blur-md z-50 flex items-start justify-center p-4"
        onclick={(e) => e.target === e.currentTarget && (showWaypointDialog = false)}
        onkeydown={(e) => e.key === 'Escape' && (showWaypointDialog = false)}
        role="button" aria-label="Chiudi" tabindex="0"
    >
        <div class="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95 my-auto">
            <div class="flex items-center justify-between p-8 border-b border-zinc-200 dark:border-zinc-800">
                <div class="flex items-center gap-3 text-emerald-600">
                    <MapPin size={22} />
                    <h2 class="text-xl font-black">{editingWaypoint ? 'Modifica' : 'Nuovo'} Waypoint</h2>
                </div>
                <Button variant="ghost" size="icon" onclick={() => (showWaypointDialog = false)} class="rounded-2xl">
                    <X size={20} />
                </Button>
            </div>
            <div class="p-8 space-y-6">
                <div class="space-y-2">
                    <label for="wp-admin-name" class="block text-xs font-black uppercase tracking-widest text-zinc-500">
                        Nome board / modulo *
                    </label>
                    <input
                        id="wp-admin-name"
                        type="text"
                        bind:value={wpAdminName}
                        maxlength="120"
                        placeholder="Es: Foto del campanile"
                        class="w-full h-12 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all font-bold"
                    />
                    <p class="text-[10px] text-zinc-400 font-medium">
                        Etichetta interna mostrata solo nella dashboard.
                    </p>
                </div>

                <!-- Player destination -->
                <div class="space-y-2">
                    <label for="wp-name" class="block text-xs font-black uppercase tracking-widest text-zinc-500">Destinazione / indizio per i giocatori *</label>
                    <textarea id="wp-name" bind:value={wpName} rows="4" placeholder="Es: quartina o indizio per far capire la destinazione senza nominarla"
                        class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all resize-y leading-relaxed"></textarea>
                    <p class="text-[10px] text-zinc-400 font-medium">
                        Questo testo appare nella PWA giocatore come destinazione. Può essere una quartina o un indizio lungo.
                    </p>
                </div>

                <!-- Module Type -->
                <div class="space-y-3">
                    <p class="text-xs font-black uppercase tracking-widest text-zinc-500">Tipo modulo</p>
                    <div class="grid grid-cols-3 gap-3">
                        <button type="button" onclick={() => wpChallengeType = 'gps'}
                            class="p-4 rounded-2xl border-2 transition-all font-bold text-sm flex flex-col items-center gap-2
                                {wpChallengeType === 'gps' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-zinc-200 hover:border-emerald-300'}">
                            <Navigation size={18} /> GPS
                        </button>
                        <button type="button" onclick={() => wpChallengeType = 'photo'}
                            class="p-4 rounded-2xl border-2 transition-all font-bold text-sm flex flex-col items-center gap-2
                                {wpChallengeType === 'photo' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-zinc-200 hover:border-blue-300'}">
                            <Camera size={18} /> Foto
                        </button>
                        <button type="button" onclick={() => wpChallengeType = 'quiz'}
                            class="p-4 rounded-2xl border-2 transition-all font-bold text-sm flex flex-col items-center gap-2
                                {wpChallengeType === 'quiz' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-zinc-200 hover:border-amber-300'}">
                            <HelpCircle size={18} /> Quiz
                        </button>
                    </div>
                </div>

                <!-- Quick Google Maps Import -->
                {#if wpChallengeType === 'gps'}
                <div class="space-y-2 p-5 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-500/20 rounded-xl">
                    <div class="flex items-center justify-between">
                        <label for="wp-import" class="block text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold">Importa da Google Maps</label>
                        <span class="text-[9px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md uppercase tracking-wider">Nuovo</span>
                    </div>
                    <input id="wp-import" type="text" placeholder="Incolla stringa coordinate (es: 41°00'43.6&quot;N 14°54'13.0&quot;E)"
                        oninput={(e) => {
                            const val = e.currentTarget.value;
                            const parsed = parseDMSString(val);
                            if (parsed) {
                                wpLat = parsed.lat.toFixed(7);
                                wpLng = parsed.lng.toFixed(7);
                                showToast('Coordinate importate con successo!');
                                e.currentTarget.value = ''; // clear input after import
                            }
                        }}
                        class="w-full h-11 px-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none text-sm focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium text-zinc-900 dark:text-white" />
                    <p class="text-[10px] text-zinc-400 font-medium leading-normal">
                        Riconosce automaticamente il formato DMS <span class="font-mono text-zinc-650 dark:text-zinc-350">41°00'43.6"N 14°54'13.0"E</span> o le coordinate decimali separate da virgola.
                    </p>
                </div>

                <!-- Coordinates -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <label for="wp-lat" class="block text-xs font-black uppercase tracking-widest text-zinc-500">Coordinate GPS *</label>
                        <button onclick={useMyLocation}
                            class="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors">
                            <Target size={12} /> Usa mia posizione
                        </button>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <input id="wp-lat" type="text" bind:value={wpLat} 
                            oninput={(e) => handleLatInput(e.currentTarget.value)}
                            placeholder="Latitudine (es: 41.1234567)"
                            class="h-12 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none font-mono text-sm focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                        <input id="wp-lng" type="text" bind:value={wpLng} 
                            oninput={(e) => handleLngInput(e.currentTarget.value)}
                            placeholder="Longitudine (es: 14.1234567)"
                            class="h-12 px-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none font-mono text-sm focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                    </div>
                    <p class="text-[10px] text-zinc-450 dark:text-zinc-400 font-medium">
                        Puoi anche incollare singoli valori DMS (es. <span class="font-mono">41°00'43.6"N</span>) direttamente nelle singole caselle.
                    </p>
                </div>

                <!-- Radius -->
                <div class="space-y-2">
                    <label for="wp-radius" class="block text-xs font-black uppercase tracking-widest text-zinc-500">
                        Raggio arrivo: <span class="text-emerald-600">{wpRadius}m</span>
                    </label>
                    <input id="wp-radius" type="range" min="5" max="200" bind:value={wpRadius}
                        class="w-full accent-emerald-600" />
                </div>
                {/if}

                <!-- Points -->
                <div class="space-y-3 p-5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                    <p class="text-xs font-black uppercase tracking-widest text-zinc-500">Punteggio</p>
                    <div class="grid grid-cols-1 gap-4">
                        {#if wpChallengeType === 'gps'}
                        <div class="space-y-2">
                            <label for="wp-points-arrival" class="block text-xs font-bold text-zinc-500">
                                Punti per l'arrivo
                            </label>
                            <input id="wp-points-arrival" type="number" bind:value={wpPointsArrival} min="0" max="9999"
                                class="w-full h-11 px-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                            <p class="text-[10px] text-zinc-400">Assegnati quando il team raggiunge il luogo</p>
                        </div>
                        {:else}
                        <div class="space-y-2">
                            <label for="wp-points" class="block text-xs font-bold text-zinc-500">
                                Punti modulo {waypointTypeLabel(wpChallengeType)}
                            </label>
                            <input id="wp-points" type="number" bind:value={wpPoints} min="0" max="9999"
                                class="w-full h-11 px-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                            <p class="text-[10px] text-zinc-400">Usati per foto approvata o quiz corretto</p>
                        </div>
                        {/if}
                    </div>
                </div>

                <!-- Enigma Text (shared) -->
                {#if wpChallengeType !== 'gps'}
                <div class="space-y-2">
                    <label for="wp-enigma" class="block text-xs font-black uppercase tracking-widest text-zinc-500">
                        Testo modulo
                    </label>
                    <textarea id="wp-enigma" bind:value={wpEnigma} rows="3"
                        placeholder={wpChallengeType === 'photo'
                            ? 'Es: Trova il simbolo nascosto e fotografalo...'
                            : 'Es: Osserva attentamente il luogo prima di rispondere...'}
                        class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none resize-none focus:ring-2 focus:ring-emerald-500/50 transition-all">
                    </textarea>
                </div>
                {/if}

                <!-- Warning Text -->
                <div class="space-y-2">
                    <label for="wp-disclaimer" class="block text-xs font-black uppercase tracking-widest text-zinc-500">
                        Testo Warning (mostrato prima dell'inizio sfida)
                    </label>
                    <textarea id="wp-disclaimer" bind:value={wpDisclaimer} rows="3"
                        placeholder="Es: Dichiaro di essere fisicamente presente e di non aver ricevuto aiuto esterno..."
                        class="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none resize-none focus:ring-2 focus:ring-amber-500/50 transition-all text-sm">
                    </textarea>
                    <p class="text-[10px] text-zinc-400">Se lasciato vuoto, sarà mostrata solo una conferma generica di presenza.</p>
                </div>

                <!-- Quiz-specific -->
                {#if wpChallengeType === 'quiz'}
                    <div class="space-y-4 p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl animate-in slide-in-from-top-2">
                        <div class="space-y-2">
                            <label for="wp-quiz-q" class="block text-xs font-black uppercase tracking-widest text-amber-700">Domanda *</label>
                            <textarea id="wp-quiz-q" bind:value={wpQuizQ} rows="2" placeholder="Es: Chi fondò il castello nel 1200?"
                                class="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-2xl outline-none resize-none focus:ring-2 focus:ring-amber-500/50 transition-all">
                            </textarea>
                        </div>
						<div class="space-y-3">
							<div class="flex items-center justify-between gap-3">
								<p class="text-xs font-black uppercase tracking-widest text-amber-700">
									Risposte *
								</p>
								{#if wpQuizOptions.length < 5}
									<Button
										type="button"
										variant="outline"
										onclick={addQuizOption}
										class="h-9 px-3 border-amber-300 text-amber-800"
									>
										<Plus size={14} class="mr-1.5" />
										Aggiungi risposta
									</Button>
								{/if}
							</div>
							<div class="space-y-2">
								{#each wpQuizOptions as option, index (index)}
									<div class="flex items-center gap-2">
										<input
											type="radio"
											name="quiz-correct-option"
											checked={wpQuizCorrectIndex === index}
											onchange={() => (wpQuizCorrectIndex = index)}
											aria-label={`Imposta come corretta la risposta ${index + 1}`}
											class="size-4 shrink-0 accent-amber-600"
										/>
										<input
											type="text"
											value={option}
											oninput={(event) => updateQuizOption(index, event.currentTarget.value)}
											placeholder="Scrivi una risposta"
											maxlength="250"
											class="min-w-0 flex-1 h-12 px-4 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
										/>
										{#if wpQuizOptions.length > 3}
											<button
												type="button"
												onclick={() => removeQuizOption(index)}
												aria-label={`Elimina risposta ${index + 1}`}
												title="Elimina risposta"
												class="flex size-10 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-red-100 hover:text-red-600 transition-colors"
											>
												<Trash2 size={16} />
											</button>
										{/if}
									</div>
								{/each}
							</div>
						</div>
                        <div class="space-y-2">
                            <label for="wp-quiz-time" class="block text-xs font-black uppercase tracking-widest text-amber-700">
                                Tempo limite: <span class="text-amber-600">{wpQuizTime}s</span>
                            </label>
                            <input id="wp-quiz-time" type="range" min="10" max="300" step="5" bind:value={wpQuizTime}
                                class="w-full accent-amber-600" />
                        </div>
                    </div>
                {/if}

                <div class="flex gap-3 pt-2">
                    <Button variant="ghost" onclick={() => (showWaypointDialog = false)} class="flex-1 h-12 rounded-2xl">Annulla</Button>
                    <Button onclick={saveWaypoint} disabled={isSubmitting || !wpAdminName.trim() || !wpName.trim() || !quizFormValid || (wpChallengeType === 'gps' && (!wpLat || !wpLng))}
                        class="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">
                        <Save size={16} class="mr-2" />
                        {isSubmitting ? 'Salvataggio...' : editingWaypoint ? 'Aggiorna' : 'Crea Waypoint'}
                    </Button>
                </div>
            </div>
        </div>
    </div>
{/if}
