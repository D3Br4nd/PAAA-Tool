<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import {
        Navigation, MapPin, Camera, HelpCircle, CheckCircle2,
        XCircle, ChevronLeft, Compass, AlertTriangle,
        Upload, Clock, RotateCcw, BadgeCheck
    } from "lucide-svelte";
    import {
        haversineDistance, getBearing, formatDistance,
        getCompassHeading, isWithinRadius, maxAcceptableGpsAccuracy,
        parseGeoPoint, prepareGeoPhoto, requestOrientationPermission
    } from "$lib/utils/geo";
    import { parseQuizOptions } from "$lib/utils/quiz-options";

    let { data } = $props();

    // ─── Types ───────────────────────────────────────────────────────────────
    type GeoChallengeType = 'gps' | 'photo' | 'quiz';
    type HuntStatus = {
        hunt: { id: string; name: string; description: string | null; challengeDisclaimerText: string | null; deadlineAt: string | null } | null;
		deadlineExpired: boolean;
        currentWaypoint: {
            id: string; name: string; lat: string; lng: string;
            radiusMeters: number; challengeType: GeoChallengeType;
            enigmaText: string | null; quizQuestion: string | null;
			quizOptions: string[] | null;
            quizTimeLimitSeconds: number; pointsOnSuccess: number;
        } | null;
        currentWaypointIndex: number;
        totalWaypoints: number;
        progress: { status: string; challengeStartedAt: string | null } | null;
        completedCount: number;
    };

    type GamePhase =
        | 'loading'      // fetching status
        | 'no_hunt'      // no active hunt
		| 'deadline_expired' // hunt closed by its configured deadline
        | 'navigating'   // showing arrow
        | 'arrived'      // within radius, celebration screen
        | 'disclaimer'   // warning screen before starting the waypoint phase
        | 'photo'        // photo challenge
        | 'quiz'         // quiz challenge
        | 'completed'    // all done
        | 'gps_error';   // GPS unavailable

    // ─── Reactive State ──────────────────────────────────────────────────────
    let phase = $state<GamePhase>('loading');
    let huntStatus = $state<HuntStatus | null>(null);
    let activeWaypointId = $state<string | null>(null);

    // GPS
    let userLat = $state<number | null>(null);
    let userLng = $state<number | null>(null);
    let gpsAccuracy = $state<number | null>(null);
    let gpsPositionTimestamp = $state<number | null>(null);
    let gpsWatchId = $state<number | null>(null);
    let arrivalCheckInFlight = $state(false);

    // Compass heading (0-360, degrees from North)
    let deviceHeading = $state<number | null>(null);
    let rawDeviceHeading = $state<number | null>(null);
    let headingPermissionGranted = $state(false);
    let compassStatus = $state<'idle' | 'needs_permission' | 'active' | 'unavailable'>('idle');
    let compassSmoothingFrame = $state<number | null>(null);

    // Navigation computed
    let targetPoint = $derived(huntStatus?.currentWaypoint
        ? parseGeoPoint(huntStatus.currentWaypoint.lat, huntStatus.currentWaypoint.lng)
        : null);
    let targetLat = $derived(targetPoint?.lat ?? null);
    let targetLng = $derived(targetPoint?.lng ?? null);

    let distanceToTarget = $derived(() => {
        if (userLat === null || userLng === null || targetLat === null || targetLng === null) return null;
        return haversineDistance({ lat: userLat, lng: userLng }, { lat: targetLat!, lng: targetLng! });
    });

    let bearingToTarget = $derived(() => {
        if (userLat === null || userLng === null || targetLat === null || targetLng === null) return 0;
        return getBearing({ lat: userLat, lng: userLng }, { lat: targetLat!, lng: targetLng! });
    });

    // Arrow rotation: bearing relative to device heading
    let arrowRotation = $derived(() => {
        const bearing = bearingToTarget();
        if (deviceHeading === null) return bearing;
        return (bearing - deviceHeading + 360) % 360;
    });

    // Challenge state
    let challengeData = $state<{
        challengeType: GeoChallengeType;
        enigmaText: string | null;
        challengeDisclaimerText: string | null;
        quizQuestion: string | null;
		quizOptions: string[] | null;
        quizTimeLimitSeconds: number | null;
        challengeStartedAt: number | null;
    } | null>(null);

    // Warning
    let isStartingChallenge = $state(false);
    let arrivalPointsEarned = $state(0);

    // Photo
    let photoFile = $state<File | null>(null);
    let photoPreviewUrl = $state<string | null>(null);
    let isUploadingPhoto = $state(false);
    let photoResult = $state<{ success: boolean; pointsEarned?: number } | null>(null);

    // Quiz
    let quizAnswer = $state('');
    let quizTimeLeft = $state(60);
    let quizTimerInterval = $state<ReturnType<typeof setInterval> | null>(null);
    let isSubmittingQuiz = $state(false);
    let quizResult = $state<{ isTimedOut: boolean; isCorrect: boolean; pointsEarned: number; correctAnswer: string | null } | null>(null);
    let legacyQuizOptions = $derived(parseQuizOptions(challengeData?.quizQuestion));
    let quizOptions = $derived(
		challengeData?.quizOptions?.map((option) => ({ answer: option, label: option })) ??
			legacyQuizOptions?.options.map((option) => ({ answer: option.value, label: option.label })) ??
			null
	);
	let quizPrompt = $derived(legacyQuizOptions?.prompt ?? challengeData?.quizQuestion);

    // General
    let isSubmitting = $state(false);
    let errorMsg = $state<string | null>(null);
    let showSkipConfirm = $state(false);
    let skipCountdown = $state(5);
    let skipCountdownInterval = $state<ReturnType<typeof setInterval> | null>(null);
    let geoSessionHeartbeatInterval = $state<ReturnType<typeof setInterval> | null>(null);
    let isSkipping = $state(false);

    function hasPhoto(type: GeoChallengeType | null | undefined) {
        return type === 'photo';
    }

    function hasQuiz(type: GeoChallengeType | null | undefined) {
        return type === 'quiz';
    }

    function firstChallengePhase(type: GeoChallengeType): GamePhase {
        if (hasPhoto(type)) return 'photo';
        if (hasQuiz(type)) return 'quiz';
        return 'navigating';
    }

	function formattedDeadline() {
		const value = huntStatus?.hunt?.deadlineAt;
		if (!value) return null;
		return new Intl.DateTimeFormat('it-IT', {
			dateStyle: 'long',
			timeStyle: 'short'
		}).format(new Date(value));
	}

    const skipLabel = $derived(() => {
        if (phase === 'navigating') return 'ricerca GPS';
        if (phase === 'disclaimer') return 'sfida';
        if (phase === 'photo') return 'foto';
        if (phase === 'quiz') return 'quiz';
        return 'fase';
    });

    // ─── GPS ─────────────────────────────────────────────────────────────────
    function startGPS() {
        if (!browser || !navigator.geolocation) {
            phase = 'gps_error';
            return;
        }
        gpsWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
                gpsAccuracy = pos.coords.accuracy;
                gpsPositionTimestamp = pos.timestamp;
                errorMsg = null;
                // Auto-detect arrival when navigating
                if (phase === 'navigating') {
                    checkArrival();
                }
            },
            (err) => {
                if (err.code === 1) {
                    errorMsg = 'Permesso GPS negato. Abilita la posizione nelle impostazioni del browser.';
                } else {
                    errorMsg = 'Segnale GPS non disponibile. Assicurati di essere all\'aperto.';
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
        );
    }

    // ─── Compass ─────────────────────────────────────────────────────────────
    function normalizeHeading(value: number) {
        return ((value % 360) + 360) % 360;
    }

    function shortestAngleDelta(from: number, to: number) {
        return ((to - from + 540) % 360) - 180;
    }

    function setRawHeading(value: number) {
        if (!Number.isFinite(value)) return;
        rawDeviceHeading = normalizeHeading(value);
        if (deviceHeading === null) {
            deviceHeading = rawDeviceHeading;
        }
    }

    function startCompassSmoothing() {
        if (!browser || compassSmoothingFrame !== null) return;

        const tick = () => {
            if (rawDeviceHeading !== null) {
                if (deviceHeading === null) {
                    deviceHeading = rawDeviceHeading;
                } else {
                    const delta = shortestAngleDelta(deviceHeading, rawDeviceHeading);
                    const next = Math.abs(delta) < 0.4
                        ? rawDeviceHeading
                        : deviceHeading + delta * 0.18;
                    deviceHeading = normalizeHeading(next);
                }
            }
            compassSmoothingFrame = requestAnimationFrame(tick);
        };

        compassSmoothingFrame = requestAnimationFrame(tick);
    }

    function onDeviceOrientation(e: DeviceOrientationEvent) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const webkit = (e as any).webkitCompassHeading;
        if (typeof webkit === 'number' && Number.isFinite(webkit) && webkit >= 0) {
            setRawHeading(webkit);
            compassStatus = 'active';
        } else if (e.absolute && e.alpha !== null && e.beta !== null && e.gamma !== null) {
            setRawHeading(getCompassHeading(e.alpha, e.beta, e.gamma));
            compassStatus = 'active';
        }
    }

    function onAbsoluteDeviceOrientation(e: DeviceOrientationEvent) {
        if (e.alpha === null || e.beta === null || e.gamma === null) return;
        setRawHeading(getCompassHeading(e.alpha, e.beta, e.gamma));
        compassStatus = 'active';
    }

    function addCompassListeners() {
        if (!browser) return;
        window.addEventListener('deviceorientation', onDeviceOrientation, true);
        window.addEventListener('deviceorientationabsolute', onAbsoluteDeviceOrientation as EventListener, true);
        startCompassSmoothing();
    }

    async function enableCompass() {
        const granted = await requestOrientationPermission();
        headingPermissionGranted = granted;
        if (granted && browser) {
            addCompassListeners();
            compassStatus = 'idle';
        } else {
            compassStatus = 'needs_permission';
        }
    }

    function initCompass() {
        if (!browser || typeof DeviceOrientationEvent === 'undefined') {
            compassStatus = 'unavailable';
            return;
        }

        // iOS 13+ requires a direct user gesture, so only show the button.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const DOE = DeviceOrientationEvent as any;
        if (typeof DOE.requestPermission === 'function') {
            compassStatus = 'needs_permission';
            return;
        }

        headingPermissionGranted = true;
        addCompassListeners();
        compassStatus = 'idle';
    }

    function resetWaypointUiState() {
        challengeData = null;
        arrivalPointsEarned = 0;
        errorMsg = null;
        arrivalCheckInFlight = false;
        isStartingChallenge = false;

        if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
        photoFile = null;
        photoPreviewUrl = null;
        photoResult = null;
        isUploadingPhoto = false;

        if (quizTimerInterval) clearInterval(quizTimerInterval);
        quizTimerInterval = null;
        quizAnswer = '';
        quizResult = null;
        quizTimeLeft = 60;
        isSubmittingQuiz = false;

        closeSkipConfirm();

        // A new GPS module must receive a new position sample before arrival.
        gpsAccuracy = null;
        gpsPositionTimestamp = null;
    }

    // ─── Status Polling ───────────────────────────────────────────────────────
    async function fetchStatus() {
        try {
            const res = await fetch('/api/geophase/status');
            if (!res.ok) throw new Error('fetch failed');
            const { data: d } = await res.json();
            const nextWaypointId = d.currentWaypoint?.id ?? null;
            if (nextWaypointId !== activeWaypointId) {
                resetWaypointUiState();
                activeWaypointId = nextWaypointId;
            }
            huntStatus = d;

            if (!d.hunt) { phase = 'no_hunt'; return; }
            if (d.currentWaypointIndex >= d.totalWaypoints) { phase = 'completed'; return; }
			if (d.deadlineExpired) { phase = 'deadline_expired'; return; }

            const progressStatus = d.progress?.status;
            if (!progressStatus && d.currentWaypoint) {
                challengeData = {
                    challengeType: d.currentWaypoint.challengeType,
                    enigmaText: d.currentWaypoint.enigmaText,
                    challengeDisclaimerText: d.currentWaypoint.challengeDisclaimerText ?? null,
                    quizQuestion: d.currentWaypoint.quizQuestion,
					quizOptions: d.currentWaypoint.quizOptions,
                    quizTimeLimitSeconds: d.currentWaypoint.quizTimeLimitSeconds,
                    challengeStartedAt: null
                };
                phase = 'disclaimer';
            } else if (progressStatus === 'challenge_active' && d.currentWaypoint) {
                // Re-open challenge from server state (after page refresh)
                phase = firstChallengePhase(d.currentWaypoint.challengeType);
                if (!challengeData) {
                    challengeData = {
                        challengeType: d.currentWaypoint.challengeType,
                        enigmaText: d.currentWaypoint.enigmaText,
                        challengeDisclaimerText: d.currentWaypoint.challengeDisclaimerText ?? null,
                        quizQuestion: d.currentWaypoint.quizQuestion,
						quizOptions: d.currentWaypoint.quizOptions,
                        quizTimeLimitSeconds: d.currentWaypoint.quizTimeLimitSeconds,
                        challengeStartedAt: d.progress.challengeStartedAt
                            ? new Date(d.progress.challengeStartedAt).getTime()
                            : null
                    };
                    if (hasQuiz(d.currentWaypoint.challengeType)) startQuizTimer();
                }
            } else if (progressStatus === 'arrived' && d.currentWaypoint) {
                // Arrived but disclaimer not yet confirmed (after page refresh)
                challengeData = {
                    challengeType: d.currentWaypoint.challengeType,
                    enigmaText: d.currentWaypoint.enigmaText,
                    challengeDisclaimerText: d.currentWaypoint.challengeDisclaimerText ?? null,
                    quizQuestion: d.currentWaypoint.quizQuestion,
					quizOptions: d.currentWaypoint.quizOptions,
                    quizTimeLimitSeconds: d.currentWaypoint.quizTimeLimitSeconds,
                    challengeStartedAt: null
                };
                phase = 'disclaimer';
            } else {
                phase = 'navigating';
            }
        } catch {
            errorMsg = 'Errore nel recupero dello stato. Riprova.';
            phase = 'navigating';
        }
    }

    async function renewGeoSession() {
        try {
            const res = await fetch('/api/geophase/session', { method: 'POST' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.message ?? 'Sessione GeoPhase non disponibile');
            }
        } catch (cause) {
            errorMsg = cause instanceof Error
                ? cause.message
                : 'Impossibile mantenere attiva la sessione GeoPhase.';
        }
    }

    function releaseGeoSession() {
        if (!browser) return;
        void fetch('/api/geophase/session', { method: 'DELETE', keepalive: true });
    }

    // ─── Arrival check ────────────────────────────────────────────────────────
    async function checkArrival() {
        if (
            arrivalCheckInFlight
            || !huntStatus?.currentWaypoint
            || userLat === null
            || userLng === null
            || gpsAccuracy === null
            || gpsPositionTimestamp === null
            || targetLat === null
            || targetLng === null
        ) return;
        const wp = huntStatus.currentWaypoint;
        const acceptedAccuracy = maxAcceptableGpsAccuracy(wp.radiusMeters);
        if (gpsAccuracy > acceptedAccuracy) {
            errorMsg = `Segnale GPS poco preciso (±${Math.round(gpsAccuracy)}m). Attendi una posizione migliore.`;
            return;
        }
        if (!isWithinRadius(
            { lat: userLat, lng: userLng },
            { lat: targetLat, lng: targetLng },
            wp.radiusMeters + Math.min(10, gpsAccuracy)
        )) return;

        arrivalCheckInFlight = true;
        try {
            const res = await fetch('/api/geophase/arrive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    waypointId: wp.id,
                    lat: userLat,
                    lng: userLng,
                    accuracy: gpsAccuracy,
                    positionTimestamp: gpsPositionTimestamp
                })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message ?? 'Verifica GPS non riuscita');
            if (json.reason === 'low_accuracy' || json.reason === 'stale_position') return;

            if (json.success) {
                challengeData = {
                    challengeType: json.challengeType,
                    enigmaText: json.enigmaText,
                    challengeDisclaimerText: json.challengeDisclaimerText ?? null,
                    quizQuestion: null,
					quizOptions: null,
                    quizTimeLimitSeconds: json.quizTimeLimitSeconds,
                    challengeStartedAt: null
                };
                arrivalPointsEarned = json.pointsOnArrivalEarned ?? 0;
                phase = 'arrived';
                setTimeout(fetchStatus, 2500);
            }
        } catch (cause) {
            errorMsg = cause instanceof Error ? cause.message : 'Verifica GPS non riuscita';
        } finally {
            arrivalCheckInFlight = false;
        }
    }

    // ─── Start Challenge (called after disclaimer confirm) ────────────────────
    function proceedFromWarning() {
        if (challengeData?.challengeType === 'gps') {
            phase = 'navigating';
            return;
        }
        startChallenge();
    }

    async function startChallenge() {
        if (!huntStatus?.currentWaypoint || isStartingChallenge) return;
        isStartingChallenge = true;
        try {
            const res = await fetch('/api/geophase/start-challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ waypointId: huntStatus.currentWaypoint.id })
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message ?? 'Impossibile avviare la sfida');
            }
            if (challengeData) {
                challengeData = {
                    ...challengeData,
                    quizQuestion: json.quizQuestion,
					quizOptions: json.quizOptions,
                    challengeStartedAt: json.challengeStartedAt
                        ? new Date(json.challengeStartedAt).getTime()
                        : Date.now()
                };
            }
            phase = firstChallengePhase(json.challengeType);
            if (hasQuiz(json.challengeType)) startQuizTimer();
        } catch (cause) {
            errorMsg = cause instanceof Error ? cause.message : 'Impossibile avviare la sfida';
        } finally {
            isStartingChallenge = false;
        }
    }

    // ─── Photo ────────────────────────────────────────────────────────────────
    function handlePhotoSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files?.[0]) return;
        const file = input.files[0];
        if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
        photoPreviewUrl = URL.createObjectURL(file);
        photoFile = file;
    }

    async function submitPhoto() {
        if (!photoFile || !huntStatus?.currentWaypoint) return;
        isUploadingPhoto = true;
        try {
            const uploadPhoto = await prepareGeoPhoto(photoFile);
            const form = new FormData();
            form.append('photo', uploadPhoto, photoFile.name || 'photo.jpg');
            form.append('waypointId', huntStatus.currentWaypoint.id);

            const res = await fetch('/api/geophase/submit-photo', { method: 'POST', body: form });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message ?? 'Errore upload foto');
            photoResult = { success: json.success, pointsEarned: json.pointsEarned };
            if (json.success) {
                await new Promise(r => setTimeout(r, 2500));
                await fetchStatus();
            }
        } catch (e: unknown) {
            errorMsg = e instanceof Error ? e.message : 'Errore upload foto';
        } finally {
            isUploadingPhoto = false;
        }
    }

    // ─── Quiz ─────────────────────────────────────────────────────────────────
    function startQuizTimer() {
        if (!challengeData?.quizTimeLimitSeconds) return;
        const startedAt = challengeData.challengeStartedAt ?? Date.now();
        const limitMs = challengeData.quizTimeLimitSeconds * 1000;

        function tick() {
            const elapsed = Date.now() - startedAt;
            const remaining = Math.max(0, Math.ceil((limitMs - elapsed) / 1000));
            quizTimeLeft = remaining;
            if (remaining <= 0) {
                clearInterval(quizTimerInterval!);
                quizTimerInterval = null;
                // Auto-submit empty answer on timeout
                submitQuiz(true);
            }
        }
        tick();
        quizTimerInterval = setInterval(tick, 500);
    }

    function chooseQuizAnswer(answer: string) {
        if (isSubmittingQuiz || quizResult) return;
        quizAnswer = answer;
        void submitQuiz(false, answer);
    }

    async function submitQuiz(timedOut = false, selectedAnswer?: string) {
        if (!huntStatus?.currentWaypoint || isSubmittingQuiz) return;
        isSubmittingQuiz = true;
        if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
        try {
            const res = await fetch('/api/geophase/submit-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    waypointId: huntStatus.currentWaypoint.id,
                    answer: timedOut ? '' : (selectedAnswer ?? quizAnswer)
                })
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message ?? 'Invio risposta non riuscito');
            quizResult = json;

            await new Promise(r => setTimeout(r, 4000));
            await fetchStatus();
            quizResult = null;
            quizAnswer = '';
        } catch (cause) {
            errorMsg = cause instanceof Error ? cause.message : 'Invio risposta non riuscito';
        } finally {
            isSubmittingQuiz = false;
        }
    }

    function openSkipConfirm() {
        if (!huntStatus?.currentWaypoint || isSkipping) return;
        showSkipConfirm = true;
        skipCountdown = 5;
        if (skipCountdownInterval) clearInterval(skipCountdownInterval);
        skipCountdownInterval = setInterval(() => {
            skipCountdown = Math.max(0, skipCountdown - 1);
            if (skipCountdown <= 0 && skipCountdownInterval) {
                clearInterval(skipCountdownInterval);
                skipCountdownInterval = null;
            }
        }, 1000);
    }

    function closeSkipConfirm() {
        showSkipConfirm = false;
        skipCountdown = 5;
        if (skipCountdownInterval) {
            clearInterval(skipCountdownInterval);
            skipCountdownInterval = null;
        }
    }

    async function confirmSkip() {
        if (!huntStatus?.currentWaypoint || skipCountdown > 0 || isSkipping) return;
        isSkipping = true;
        if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
        const skipMode = phase === 'navigating' ? 'navigation' : 'challenge';
        try {
            const res = await fetch('/api/geophase/skip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ waypointId: huntStatus.currentWaypoint.id, mode: skipMode })
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Skip non riuscito');
            closeSkipConfirm();
            if (skipMode === 'navigation') {
                if (json.completed) {
                    await fetchStatus();
                    return;
                }
                challengeData = {
                    challengeType: json.challengeType,
                    enigmaText: json.enigmaText,
                    challengeDisclaimerText: json.challengeDisclaimerText ?? null,
                    quizQuestion: json.quizQuestion,
					quizOptions: json.quizOptions,
                    quizTimeLimitSeconds: json.quizTimeLimitSeconds,
                    challengeStartedAt: json.challengeStartedAt
                        ? new Date(json.challengeStartedAt).getTime()
                        : Date.now()
                };
                arrivalPointsEarned = 0;
                phase = firstChallengePhase(json.challengeType);
                if (hasQuiz(json.challengeType)) startQuizTimer();
                return;
            }
            await fetchStatus();
        } catch (e: unknown) {
            errorMsg = e instanceof Error ? e.message : 'Errore durante lo skip';
        } finally {
            isSkipping = false;
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────
    onMount(async () => {
        await fetchStatus();
        startGPS();
        initCompass();
        geoSessionHeartbeatInterval = setInterval(renewGeoSession, 30_000);
        window.addEventListener('pagehide', releaseGeoSession);
    });

    onDestroy(() => {
        if (gpsWatchId !== null && browser) navigator.geolocation.clearWatch(gpsWatchId);
        if (quizTimerInterval) clearInterval(quizTimerInterval);
        if (skipCountdownInterval) clearInterval(skipCountdownInterval);
        if (geoSessionHeartbeatInterval) clearInterval(geoSessionHeartbeatInterval);
        if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
        if (compassSmoothingFrame !== null && browser) {
            cancelAnimationFrame(compassSmoothingFrame);
            compassSmoothingFrame = null;
        }
        if (browser) {
			window.removeEventListener('pagehide', releaseGeoSession);
			releaseGeoSession();
            window.removeEventListener('deviceorientation', onDeviceOrientation, true);
            window.removeEventListener('deviceorientationabsolute', onAbsoluteDeviceOrientation as EventListener, true);
        }
    });

    // ─── Derived display helpers ──────────────────────────────────────────────
    let distanceText = $derived(() => {
        const d = distanceToTarget();
        return d !== null ? formatDistance(d) : '—';
    });

    let quizTimerPercent = $derived(() => {
        if (!challengeData?.quizTimeLimitSeconds) return 100;
        return Math.round((quizTimeLeft / challengeData.quizTimeLimitSeconds) * 100);
    });

    const defaultDisclaimerText = 'Confermo di essere fisicamente presente sul posto e di voler iniziare la sfida.';
    let currentDisclaimerText = $derived(
        challengeData?.challengeDisclaimerText ||
        huntStatus?.hunt?.challengeDisclaimerText ||
        defaultDisclaimerText,
    );
</script>

<svelte:head>
    <title>GeoPhase — Caccia al Tesoro</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 text-white flex flex-col">
    <!-- Header -->
    <header class="sticky top-0 z-20 flex items-center justify-between px-5 py-4
        bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <a href="/game" class="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={18} />
            <span class="text-sm font-bold">PWA</span>
        </a>
        <div class="flex items-center gap-2">
            <div class="p-1.5 bg-emerald-500/20 rounded-lg">
                <Navigation size={16} class="text-emerald-400" />
            </div>
            <span class="font-black text-sm tracking-tight">
                {huntStatus?.hunt?.name ?? 'GeoPhase'}
            </span>
        </div>
        <div class="text-xs font-bold text-slate-500 tabular-nums">
            {#if huntStatus && huntStatus.totalWaypoints > 0}
                {Math.min(huntStatus.currentWaypointIndex + 1, huntStatus.totalWaypoints)}/{huntStatus.totalWaypoints}
            {:else}
                —
            {/if}
        </div>
    </header>

    <main class="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full">

        <!-- ── LOADING ── -->
        {#if phase === 'loading'}
            <div class="text-center space-y-4 animate-pulse">
                <div class="w-20 h-20 rounded-full bg-white/5 mx-auto flex items-center justify-center">
                    <Navigation size={32} class="text-emerald-400" />
                </div>
                <p class="text-slate-400 font-medium">Caricamento...</p>
            </div>

        <!-- ── NO HUNT ── -->
        {:else if phase === 'no_hunt'}
            <div class="text-center space-y-5">
                <div class="w-24 h-24 rounded-full bg-white/5 mx-auto flex items-center justify-center">
                    <MapPin size={40} class="text-slate-500" />
                </div>
                <div>
                    <h2 class="text-2xl font-black mb-2">Nessuna Caccia Attiva</h2>
                    <p class="text-slate-400 text-sm">Gli organizzatori non hanno ancora avviato una caccia al tesoro. Attendi!</p>
                </div>
            </div>

		<!-- ── DEADLINE EXPIRED ── -->
		{:else if phase === 'deadline_expired'}
			<div class="text-center space-y-5">
				<div class="w-24 h-24 rounded-full bg-amber-500/10 mx-auto flex items-center justify-center">
					<Clock size={40} class="text-amber-400" />
				</div>
				<div>
					<h2 class="text-2xl font-black mb-2">Deadline raggiunta</h2>
					<p class="text-slate-300 text-sm">
						Il Path del Cavaliere si è chiuso{formattedDeadline() ? ` il ${formattedDeadline()}` : ''}.
					</p>
					<p class="text-slate-500 text-sm mt-2">
						I punti e le prove completate prima della scadenza restano acquisiti.
					</p>
				</div>
				<a href="/game"
					class="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 text-white font-black rounded-2xl transition-all">
					Torna alla PWA
				</a>
			</div>

        <!-- ── GPS ERROR ── -->
        {:else if phase === 'gps_error'}
            <div class="text-center space-y-5">
                <div class="w-24 h-24 rounded-full bg-red-500/10 mx-auto flex items-center justify-center">
                    <AlertTriangle size={40} class="text-red-400" />
                </div>
                <div>
                    <h2 class="text-2xl font-black mb-2">GPS Non Disponibile</h2>
                    <p class="text-slate-400 text-sm">Abilita la posizione GPS nelle impostazioni del browser e ricarica la pagina.</p>
                </div>
            </div>

        <!-- ── COMPLETED ── -->
        {:else if phase === 'completed'}
            <div class="text-center space-y-6 animate-in zoom-in-95">
                <div class="w-28 h-28 rounded-full bg-amber-500/20 mx-auto flex items-center justify-center">
                    <BadgeCheck size={52} class="text-amber-400" />
                </div>
                <div>
                    <h2 class="text-3xl font-black mb-2 text-amber-400">Path completato!</h2>
                    <p class="text-slate-300">Avete completato tutte le prove del Path del Cavaliere.</p>
                    <p class="mt-3 text-white font-bold">Presentatevi ora al palco per ricevere dallo staff il badge di fine fase Cavaliere.</p>
                </div>
                <a href="/game"
                    class="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                    Torna alla PWA
                </a>
            </div>

        <!-- ── ARRIVED (celebration) ── -->
        {:else if phase === 'arrived'}
            <div class="text-center space-y-6 animate-in zoom-in-95">
                <div class="w-28 h-28 rounded-full bg-emerald-500/20 mx-auto flex items-center justify-center animate-bounce">
                    <CheckCircle2 size={52} class="text-emerald-400" />
                </div>
                <div>
                    <h2 class="text-3xl font-black mb-2 text-emerald-400">Sei Arrivato!</h2>
                    <p class="text-slate-300 font-medium">{huntStatus?.currentWaypoint?.name}</p>
                    <p class="text-slate-500 text-sm mt-1">Preparati alla sfida...</p>
                </div>
            </div>

        <!-- ── NAVIGATING ── -->
        {:else if phase === 'navigating'}
            <div class="w-full space-y-8">

                <!-- Waypoint name -->
                <div class="text-center">
                    <p class="text-xs font-black uppercase tracking-widest text-emerald-500 mb-1">Destinazione</p>
                    <h2 class="text-xl font-black leading-relaxed whitespace-pre-wrap">{huntStatus?.currentWaypoint?.name ?? '—'}</h2>
                </div>

                <!-- Compass rose and direction arrow -->
                <div class="flex flex-col items-center gap-5">
                    <div class="relative flex h-72 w-72 items-center justify-center" aria-label="Rosa dei venti">
                        <!-- Outer dial -->
                        <div class="absolute inset-4 rounded-full border-2 border-white/10 bg-white/[0.02] shadow-[inset_0_0_40px_rgba(15,23,42,0.8)]"></div>
                        <div class="absolute inset-[2.75rem] rounded-full border border-dashed border-white/10"></div>

                        <!-- Static cardinal labels: the arrow keeps its existing behaviour. -->
                        <div class="pointer-events-none absolute inset-4">
                            <div class="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                                <span class="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-emerald-400 bg-slate-950 text-sm font-black text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.35)]">N</span>
                            </div>
                            <div class="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2">
                                <span class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950 text-xs font-black text-slate-300">E</span>
                            </div>
                            <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                                <span class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950 text-xs font-black text-slate-300">S</span>
                            </div>
                            <div class="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                <span class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950 text-xs font-black text-slate-300">O</span>
                            </div>
                        </div>

                        <!-- Direction arrow -->
                        <div
                            class="relative z-10 flex h-40 w-40 items-center justify-center transition-transform duration-300 ease-out"
                            style="transform: rotate({arrowRotation()}deg)"
                        >
                            <svg viewBox="0 0 100 100" class="h-full w-full drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]">
                                <polygon points="50,8 62,55 50,48 38,55" fill="#34d399" />
                                <polygon points="50,92 62,55 50,48 38,55" fill="#1e3a2f" opacity="0.8" />
                                <circle cx="50" cy="50" r="5" fill="#34d399" />
                            </svg>
                        </div>
                    </div>

                    <!-- Distance stays outside the dial so it never covers South -->
                    <div class="rounded-full bg-emerald-500 px-6 py-2 text-lg font-black text-black shadow-lg shadow-emerald-500/30">
                        {distanceText()}
                    </div>

                </div>

                <!-- GPS info -->
                <div class="space-y-3">
                    {#if errorMsg}
                        <div class="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                            <AlertTriangle size={16} />
                            <span>{errorMsg}</span>
                        </div>
                    {/if}

                    <div class="flex items-center justify-between text-xs text-slate-600 px-1">
                        <span class="flex items-center gap-1.5">
                            <div class="w-1.5 h-1.5 rounded-full {userLat !== null ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}"></div>
                            GPS {userLat !== null ? `±${Math.round(gpsAccuracy ?? 0)}m` : 'ricerca...'}
                        </span>
                        <span class="flex items-center gap-1.5">
                            <Compass size={12} />
                            Bussola {deviceHeading !== null ? `${Math.round(deviceHeading)}°` : compassStatus === 'needs_permission' ? 'da abilitare' : 'N/D'}
                        </span>
                    </div>

                    {#if compassStatus === 'needs_permission'}
                        <button onclick={enableCompass}
                            class="w-full py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-slate-400 hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                            <Compass size={16} />
                            Abilita Bussola
                        </button>
                    {:else if compassStatus === 'unavailable'}
                        <div class="w-full py-2.5 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm font-bold text-amber-300 flex items-center justify-center gap-2">
                            <AlertTriangle size={16} />
                            Bussola non disponibile su questo dispositivo
                        </div>
                    {/if}
                </div>
                <button
                    type="button"
                    onclick={openSkipConfirm}
                    class="w-full py-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 font-black text-xs uppercase tracking-wider hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                >
                    <AlertTriangle size={16} />
                    Salta ricerca GPS
                </button>
            </div>

        <!-- ── DISCLAIMER ── -->
        {:else if phase === 'disclaimer'}
            <div class="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div class="text-center space-y-2">
                    <div class="w-20 h-20 rounded-full bg-emerald-500/20 mx-auto flex items-center justify-center">
                        {#if challengeData?.challengeType === 'gps'}
                            <Navigation size={36} class="text-emerald-400" />
                        {:else if hasQuiz(challengeData?.challengeType)}
                            <HelpCircle size={36} class="text-amber-400" />
                        {:else}
                            <Camera size={36} class="text-blue-400" />
                        {/if}
                    </div>
                    <h2 class="text-2xl font-black">{huntStatus?.currentWaypoint?.name}</h2>
                    <p class="text-emerald-400 font-bold text-sm">
                        {#if challengeData?.challengeType === 'gps'}
                            Ricerca GPS
                        {:else if hasQuiz(challengeData?.challengeType)}
                            Sfida Quiz
                        {:else}
                            Sfida Fotografica
                        {/if}
                    </p>
                    {#if arrivalPointsEarned > 0}
                        <p class="text-xs text-slate-400">+{arrivalPointsEarned} punti per l'arrivo!</p>
                    {/if}
                </div>

                <!-- Warning text -->
                <div class="p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <p class="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">⚠️ Warning</p>
                    <p class="text-slate-200 leading-relaxed text-sm">{currentDisclaimerText}</p>
                </div>

                <!-- Start challenge button -->
                <button
                    onclick={proceedFromWarning}
                    disabled={isStartingChallenge}
                    class="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all
                        {isStartingChallenge
                            ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                            : challengeData?.challengeType === 'gps'
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]'
                                : hasQuiz(challengeData?.challengeType)
                                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]'
                                : 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]'}">
                    {#if isStartingChallenge}
                        <span class="flex items-center justify-center gap-2">
                            <RotateCcw size={16} class="animate-spin" />
                            Avvio...
                        </span>
                    {:else if challengeData?.challengeType === 'gps'}
                        <span class="flex items-center justify-center gap-2">
                            <Navigation size={16} />
                            Procedi
                        </span>
                    {:else if hasQuiz(challengeData?.challengeType)}
                        <span class="flex items-center justify-center gap-2">
                            <HelpCircle size={16} />
                            Inizia Quiz — Il timer parte ora!
                        </span>
                    {:else}
                        <span class="flex items-center justify-center gap-2">
                            <Camera size={16} />
                            Inizia Sfida Fotografica
                        </span>
                    {/if}
                </button>
                <button
                    type="button"
                    onclick={openSkipConfirm}
                    class="w-full py-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 font-black text-xs uppercase tracking-wider hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                >
                    <AlertTriangle size={16} />
                    Salta questa sfida
                </button>
            </div>

        <!-- ── PHOTO CHALLENGE ── -->
        {:else if phase === 'photo'}
            <div class="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <!-- Header -->
                <div class="text-center space-y-1">
                    <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-black uppercase tracking-wider mb-2">
                        <Camera size={12} /> Sfida Fotografica
                    </div>
                    <h2 class="text-xl font-black">{huntStatus?.currentWaypoint?.name}</h2>
                </div>

                <!-- Enigma -->
                {#if challengeData?.enigmaText}
                    <div class="p-5 bg-white/5 border border-white/10 rounded-xl">
                        <p class="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">📜 Enigma</p>
                        <p class="text-slate-200 leading-relaxed">{challengeData.enigmaText}</p>
                    </div>
                {/if}

                <!-- Photo result -->
                {#if photoResult}
                    <div class="text-center p-8 space-y-3 {photoResult.success ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'} border rounded-xl animate-in zoom-in-95">
                        {#if photoResult.success}
                            <CheckCircle2 size={48} class="mx-auto text-emerald-400" />
                            <p class="font-black text-xl text-emerald-400">Foto inviata!</p>
                            <p class="text-slate-400 text-sm">In validazione staff. Proseguite alla prossima tappa.</p>
                        {:else}
                            <XCircle size={48} class="mx-auto text-red-400" />
                            <p class="font-black text-xl text-red-400">Errore invio</p>
                        {/if}
                    </div>
                {:else}
                    <!-- Photo picker -->
                    <div class="space-y-4">
                        <label for="photo-input" class="block">
                            <div class="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-dashed cursor-pointer transition-all
                                {photoPreviewUrl ? 'border-emerald-500/50' : 'border-white/10 hover:border-white/30 bg-white/[0.02]'}">
                                {#if photoPreviewUrl}
                                    <img src={photoPreviewUrl} alt="Preview" class="w-full h-full object-cover" />
                                    <div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <p class="text-white font-bold text-sm">Cambia foto</p>
                                    </div>
                                {:else}
                                    <div class="flex flex-col items-center justify-center h-full gap-3 py-10">
                                        <Camera size={40} class="text-slate-500" />
                                        <p class="text-slate-500 font-medium text-sm">Tocca per scattare / scegliere</p>
                                    </div>
                                {/if}
                            </div>
                        </label>
                        <input id="photo-input" type="file" accept="image/*" capture="environment"
                            onchange={handlePhotoSelect} class="sr-only" />

                        <button
                            onclick={submitPhoto}
                            disabled={!photoFile || isUploadingPhoto}
                            class="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all
                                {!photoFile || isUploadingPhoto
                                    ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                    : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]'}">
                            {#if isUploadingPhoto}
                                <span class="flex items-center justify-center gap-2">
                                    <RotateCcw size={16} class="animate-spin" />
                                    Preparazione e invio...
                                </span>
                            {:else}
                                <span class="flex items-center justify-center gap-2">
                                    <Upload size={16} />
                                    Invia Foto
                                </span>
                            {/if}
                        </button>
                        <button
                            type="button"
                            onclick={openSkipConfirm}
                            class="w-full py-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 font-black text-xs uppercase tracking-wider hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <AlertTriangle size={16} />
                            Salta foto
                        </button>
                    </div>
                {/if}
            </div>

        <!-- ── QUIZ CHALLENGE ── -->
        {:else if phase === 'quiz'}
            <div class="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4">

                <!-- Timer -->
                <div class="space-y-2">
                    <div class="flex items-center justify-between text-sm font-bold">
                        <span class="flex items-center gap-1.5 text-slate-400">
                            <Clock size={14} />
                            Tempo rimanente
                        </span>
                        <span class="tabular-nums font-black text-lg
                            {quizTimeLeft <= 10 ? 'text-red-400 animate-pulse' : quizTimeLeft <= 20 ? 'text-amber-400' : 'text-emerald-400'}">
                            {String(Math.floor(quizTimeLeft / 60)).padStart(2,'0')}:{String(quizTimeLeft % 60).padStart(2,'0')}
                        </span>
                    </div>
                    <!-- Progress bar -->
                    <div class="h-2.5 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-500
                            {quizTimerPercent() > 50 ? 'bg-emerald-500' : quizTimerPercent() > 20 ? 'bg-amber-500' : 'bg-red-500'}"
                            style="width: {quizTimerPercent()}%">
                        </div>
                    </div>
                </div>

                <!-- Header -->
                <div class="text-center space-y-1">
                    <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-full text-xs font-black uppercase tracking-wider">
                        <HelpCircle size={12} /> Prova Finale
                    </div>
                    <h2 class="text-xl font-black mt-2">{huntStatus?.currentWaypoint?.name}</h2>
                </div>

                <!-- Enigma (optional) -->
                {#if challengeData?.enigmaText}
                    <div class="p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <p class="text-slate-300 text-sm leading-relaxed italic">"{challengeData.enigmaText}"</p>
                    </div>
                {/if}

                <!-- Result -->
                {#if quizResult}
                    <div class="text-center p-8 space-y-3 rounded-xl animate-in zoom-in-95
                        {quizResult.isTimedOut ? 'bg-amber-500/10 border-amber-500/20' : quizResult.isCorrect ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'} border">
                        {#if quizResult.isTimedOut}
                            <Clock size={48} class="mx-auto text-amber-400" />
                            <p class="font-black text-xl text-amber-400">Tempo Scaduto!</p>
                            <p class="text-slate-400 text-sm">Risposta: <span class="text-white font-bold">{quizResult.correctAnswer}</span></p>
                        {:else if quizResult.isCorrect}
                            <CheckCircle2 size={48} class="mx-auto text-emerald-400" />
                            <p class="font-black text-xl text-emerald-400">Corretto!</p>
                            <p class="text-slate-400 text-sm">+{quizResult.pointsEarned} punti</p>
                        {:else}
                            <XCircle size={48} class="mx-auto text-red-400" />
                            <p class="font-black text-xl text-red-400">Risposta Errata</p>
                            <p class="text-slate-400 text-sm">Risposta corretta: <span class="text-white font-bold">{quizResult.correctAnswer}</span></p>
                        {/if}
                    </div>
                {:else}
                    <!-- Question & input -->
                    <div class="space-y-4">
                        <div class="p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <p class="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">❓ Domanda</p>
                            <p class="text-white font-medium leading-relaxed whitespace-pre-line">
								{quizPrompt}
                            </p>
                        </div>

                        {#if quizOptions}
                            <div class="space-y-2" role="group" aria-label="Risposte disponibili">
                                {#each quizOptions as option (option.answer)}
                                    <button
                                        type="button"
										onclick={() => chooseQuizAnswer(option.answer)}
                                        disabled={isSubmittingQuiz}
                                        class="w-full min-h-14 px-4 py-3 flex items-center gap-3 rounded-xl border text-left transition-colors
											{quizAnswer === option.answer
                                                ? 'border-amber-400 bg-amber-500/20 text-white'
                                                : 'border-white/10 bg-white/5 text-slate-200 hover:border-amber-500/50 hover:bg-white/10'}"
                                    >
										<span class="font-medium leading-snug">{option.label}</span>
                                    </button>
                                {/each}
                            </div>
                        {:else}
                            <div class="space-y-2">
                                <label for="quiz-answer" class="block text-xs font-black uppercase tracking-widest text-slate-500">
                                    La tua risposta
                                </label>
                                <input
                                    id="quiz-answer"
                                    type="text"
                                    bind:value={quizAnswer}
                                    placeholder="Scrivi qui la risposta..."
                                    disabled={isSubmittingQuiz}
                                    onkeydown={(e) => e.key === 'Enter' && submitQuiz()}
                                    class="w-full h-14 px-5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-600
                                        focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none transition-all text-lg"
                                />
                            </div>

                            <button
                                onclick={() => submitQuiz()}
                                disabled={!quizAnswer.trim() || isSubmittingQuiz}
                                class="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all
                                    {!quizAnswer.trim() || isSubmittingQuiz
                                        ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                                        : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]'}">
                                {isSubmittingQuiz ? 'Invio...' : 'Invia Risposta'}
                            </button>
                        {/if}
                        <button
                            type="button"
                            onclick={openSkipConfirm}
                            class="w-full py-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 font-black text-xs uppercase tracking-wider hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                        >
                            <AlertTriangle size={16} />
                            Salta quiz
                        </button>
                    </div>
                {/if}
            </div>
        {/if}
    </main>

    {#if showSkipConfirm}
        <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-5 flex items-start justify-center">
            <div class="w-full max-w-md max-h-[calc(100dvh-2.5rem)] overflow-y-auto my-auto rounded-3xl bg-slate-900 border border-red-500/30 shadow-2xl">
                <div class="p-6 space-y-5">
                    <div class="w-14 h-14 rounded-2xl bg-red-500/15 text-red-300 flex items-center justify-center">
                        <AlertTriangle size={30} />
                    </div>
                    <div>
                        <h3 class="text-2xl font-black text-white">Saltare questa fase?</h3>
                        <p class="text-sm text-slate-300 mt-2 leading-relaxed">
                            Se salterete questa fase perderete solo i punti ad essa associati, e passerete al prossimo step. Siete sicuri?!
                        </p>
                    </div>
                    <div class="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-200 font-bold">
                        {#if skipCountdown > 0}
                            Conferma disponibile tra {skipCountdown} secondi.
                        {:else}
                            Puoi confermare lo skip.
                        {/if}
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onclick={closeSkipConfirm}
                            disabled={isSkipping}
                            class="py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black uppercase text-xs tracking-wider transition-colors"
                        >
                            Annulla
                        </button>
                        <button
                            type="button"
                            onclick={confirmSkip}
                            disabled={skipCountdown > 0 || isSkipping}
                            class="py-4 rounded-2xl font-black uppercase text-xs tracking-wider transition-colors {skipCountdown > 0 || isSkipping ? 'bg-red-500/10 text-red-900 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white'}"
                        >
                            {isSkipping ? 'Salto...' : 'Conferma Skip'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
