import { isGeoWaypointDone, selectActiveGeoHunt } from './geophase-state';

type DateValue = Date | string | number | null | undefined;

export type PhaseOneTeamInput = {
    id: string;
    name: string;
    factionId: string;
    factionName: string;
    factionColor?: string | null;
};

export type PhaseOneChallengeInput = {
    id: string;
    code: string;
};

export type PhaseOneCompletionInput = {
    teamId: string;
    challengeId: string;
    completedAt: DateValue;
	totalPoints?: number;
};

export type PhaseOneHuntInput = {
    id: string;
    factionId: string | null;
};

export type PhaseOneWaypointInput = {
    id: string;
    huntId: string;
    challengeType: string;
};

export type PhaseOneGeoProgressInput = {
    teamId: string;
    huntId: string;
    waypointId: string;
    status: string;
    completedAt: DateValue;
    updatedAt: DateValue;
};

export type PhaseOnePathStatus = {
    completed: boolean;
    completedCount: number;
    requiredCount: number;
    completedAt: number | null;
};

export type PhaseOneTimeRow = {
    teamId: string;
    teamName: string;
    factionId: string;
    factionName: string;
    factionColor: string | null;
    completed: boolean;
    completedAt: number | null;
    rank: number | null;
    extraPoints: number;
    paths: {
        cavaliere: PhaseOnePathStatus;
        architetto: PhaseOnePathStatus;
        scriba: PhaseOnePathStatus;
    };
};

function timestamp(value: DateValue): number | null {
    if (value === null || value === undefined) return null;
    const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

function latest(values: Array<number | null>): number | null {
    const valid = values.filter((value): value is number => value !== null);
    return valid.length > 0 ? Math.max(...valid) : null;
}

function programPathStatus(
    teamId: string,
    requiredIds: string[],
    completions: PhaseOneCompletionInput[],
	requirePositiveScore = false
): PhaseOnePathStatus {
    const completionByChallenge = new Map(
        completions
            .filter((completion) => completion.teamId === teamId)
			.filter((completion) =>
				!requirePositiveScore || completion.totalPoints === undefined || completion.totalPoints > 0
			)
            .map((completion) => [completion.challengeId, completion])
    );
    const completed = requiredIds
        .map((id) => completionByChallenge.get(id))
        .filter((value): value is PhaseOneCompletionInput => Boolean(value));
    const isComplete = requiredIds.length > 0 && completed.length === requiredIds.length;

    return {
        completed: isComplete,
        completedCount: completed.length,
        requiredCount: requiredIds.length,
        completedAt: isComplete
            ? latest(completed.map((completion) => timestamp(completion.completedAt)))
            : null
    };
}

export function buildPhaseOneTimeRows(input: {
    teams: PhaseOneTeamInput[];
    challenges: PhaseOneChallengeInput[];
    completions: PhaseOneCompletionInput[];
    hunts: PhaseOneHuntInput[];
    waypoints: PhaseOneWaypointInput[];
    geoProgress: PhaseOneGeoProgressInput[];
    extraPointsByTeam?: Map<string, number>;
}): PhaseOneTimeRow[] {
    const scribaIds = input.challenges
        .filter((challenge) => challenge.code.trim().toUpperCase() === 'SCRIBA')
        .map((challenge) => challenge.id);
    const architettoIds = input.challenges
        .filter((challenge) => challenge.code.trim().toUpperCase() === 'ARCHITETTO')
        .map((challenge) => challenge.id);

    const rows = input.teams.map((team): PhaseOneTimeRow => {
        const hunt = selectActiveGeoHunt(input.hunts, team.factionId);
        const huntWaypoints = hunt
            ? input.waypoints.filter((waypoint) => waypoint.huntId === hunt.id)
            : [];
        const progressByWaypoint = new Map(
            input.geoProgress
                .filter((progress) => progress.teamId === team.id && progress.huntId === hunt?.id)
                .map((progress) => [progress.waypointId, progress])
        );
        const finishedGeoProgress = huntWaypoints
            .map((waypoint) => ({
                waypoint,
                progress: progressByWaypoint.get(waypoint.id)
            }))
            .filter(({ waypoint, progress }) =>
                Boolean(progress && isGeoWaypointDone(progress.status, waypoint.challengeType))
            );
        const cavaliereCompleted = huntWaypoints.length > 0
            && finishedGeoProgress.length === huntWaypoints.length;
        const cavaliere: PhaseOnePathStatus = {
            completed: cavaliereCompleted,
            completedCount: finishedGeoProgress.length,
            requiredCount: huntWaypoints.length,
            completedAt: cavaliereCompleted
                ? latest(finishedGeoProgress.map(({ progress }) =>
                    timestamp(progress?.completedAt) ?? timestamp(progress?.updatedAt)
                ))
                : null
        };
        const architetto = programPathStatus(team.id, architettoIds, input.completions, true);
        const scriba = programPathStatus(team.id, scribaIds, input.completions);
        const completed = cavaliere.completed && architetto.completed && scriba.completed;

        return {
            teamId: team.id,
            teamName: team.name,
            factionId: team.factionId,
            factionName: team.factionName,
            factionColor: team.factionColor || null,
            completed,
            completedAt: completed
                ? latest([cavaliere.completedAt, architetto.completedAt, scriba.completedAt])
                : null,
            rank: null,
            extraPoints: input.extraPointsByTeam?.get(team.id) || 0,
            paths: { cavaliere, architetto, scriba }
        };
    });

    for (const factionId of new Set(rows.map((row) => row.factionId))) {
        const completedRows = rows
            .filter((row) => row.factionId === factionId && row.completed)
            .sort((a, b) =>
                (a.completedAt || Number.POSITIVE_INFINITY)
                - (b.completedAt || Number.POSITIVE_INFINITY)
                || a.teamName.localeCompare(b.teamName, 'it')
            );
        completedRows.forEach((row, index) => {
            row.rank = index + 1;
        });
    }

    return rows.sort((a, b) =>
        a.factionName.localeCompare(b.factionName, 'it')
        || (a.rank || Number.POSITIVE_INFINITY) - (b.rank || Number.POSITIVE_INFINITY)
        || a.teamName.localeCompare(b.teamName, 'it')
    );
}
