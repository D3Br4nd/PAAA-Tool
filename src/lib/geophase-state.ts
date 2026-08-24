export type GeoChallengeType = 'gps' | 'photo' | 'quiz';

export type GeoProgressLike = {
	waypointId: string;
	status: string;
};

export type GeoWaypointLike = {
	id: string;
	challengeType: string;
};

export type GeoHuntLike = {
	id: string;
	factionId: string | null;
};

type DateValue = Date | string | number | null | undefined;

export const GEO_LIMITS = {
	minRadiusMeters: 5,
	maxRadiusMeters: 500,
	minQuizSeconds: 10,
	maxQuizSeconds: 300,
	maxPoints: 9_999,
	maxPositionAgeMs: 30_000,
	maxPositionFutureSkewMs: 5_000
} as const;

export function isGeoWaypointDone(status: string, challengeType?: string | null): boolean {
	if (status === 'completed' || status === 'failed') return true;
	return status === 'photo_submitted' && challengeType === 'photo';
}

export function findCurrentGeoWaypoint<T extends GeoWaypointLike>(
	waypoints: T[],
	progressEntries: GeoProgressLike[]
): { waypoint: T | null; index: number; completedCount: number } {
	const progressByWaypoint = new Map(
		progressEntries.map((progress) => [progress.waypointId, progress])
	);
	let completedCount = 0;

	for (let index = 0; index < waypoints.length; index += 1) {
		const waypoint = waypoints[index];
		const progress = progressByWaypoint.get(waypoint.id);
		if (!progress || !isGeoWaypointDone(progress.status, waypoint.challengeType)) {
			return { waypoint, index, completedCount };
		}
		completedCount += 1;
	}

	return { waypoint: null, index: waypoints.length, completedCount };
}

export function selectActiveGeoHunt<T extends GeoHuntLike>(
	hunts: T[],
	factionId: string | null
): T | null {
	return (
		hunts.find((hunt) => hunt.factionId === factionId && hunt.factionId !== null) ??
		hunts.find((hunt) => hunt.factionId === null) ??
		null
	);
}

export function isGeoHuntDeadlineExpired(deadlineAt: DateValue, now = Date.now()): boolean {
	if (deadlineAt === null || deadlineAt === undefined) return false;
	const deadline = deadlineAt instanceof Date ? deadlineAt.getTime() : new Date(deadlineAt).getTime();
	return Number.isFinite(deadline) && now >= deadline;
}

export function boundedInteger(value: unknown, min: number, max: number): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) return null;
	return value >= min && value <= max ? value : null;
}
