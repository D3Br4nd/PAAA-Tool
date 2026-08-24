type DateValue = Date | string | number | null | undefined;

export type GameTimeInput = {
    gameId: string;
    gameName: string;
    teamId: string;
    teamName: string;
    factionId: string;
    factionName: string;
    factionColor?: string | null;
    completedAt: DateValue;
    elapsedSeconds: unknown;
    totalPoints: number;
};

export type GameTimeRow = GameTimeInput & {
    completedAt: number;
    elapsedSeconds: number;
    rank: number;
    extraPoints: number;
    factionColor: string | null;
};

function timestamp(value: DateValue): number | null {
    if (value === null || value === undefined) return null;
    const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

export function buildGameTimeRanking(
    rows: GameTimeInput[],
    extraPointsByEntry = new Map<string, number>()
): GameTimeRow[] {
    const validRows = rows.flatMap((row) => {
        if (row.elapsedSeconds === null || row.elapsedSeconds === undefined || row.elapsedSeconds === '') {
            return [];
        }
        const elapsedSeconds = Number(row.elapsedSeconds);
        const completedAt = timestamp(row.completedAt);
        if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || completedAt === null) return [];

        return [{
            ...row,
            elapsedSeconds: Math.floor(elapsedSeconds),
            completedAt,
            factionColor: row.factionColor || null,
            rank: 0,
            extraPoints: extraPointsByEntry.get(`${row.gameId}:${row.teamId}`) || 0
        }];
    });

    for (const factionId of new Set(validRows.map((row) => row.factionId))) {
        const factionRows = validRows
            .filter((row) => row.factionId === factionId)
            .sort((a, b) =>
                a.elapsedSeconds - b.elapsedSeconds
                || a.completedAt - b.completedAt
                || a.teamName.localeCompare(b.teamName, 'it')
            );
        factionRows.forEach((row, index) => {
            row.rank = index + 1;
        });
    }

    return validRows.sort((a, b) =>
        a.factionName.localeCompare(b.factionName, 'it')
        || a.rank - b.rank
        || a.teamName.localeCompare(b.teamName, 'it')
    );
}
