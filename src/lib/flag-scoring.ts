export type FlagScoreRole = 'attack' | 'defense' | 'stalemate' | 'disqualified';
export type FlagAttackOutcome = 'band_1' | 'band_2' | 'spawn';

export const FLAG_SCORING_VERSION = 'bands_v3' as const;

export const FLAG_SCORING_DEFAULTS = {
    pointsPerHit: 10,
    maxCarrierHits: 7,
    maxHitPoints: 70,
    attackerBand1Points: 50,
    attackerBand2Points: 100,
    attackerSpawnPoints: 150
} as const;

export type FlagScoringConfig = {
    scoringVersion?: string;
    pointsPerHit?: number;
    maxCarrierHits?: number;
    maxHitPoints?: number;
    attackerBand1Points?: number;
    attackerBand2Points?: number;
    attackerSpawnPoints?: number;
    // Compatibility fields saved by the previous scoring model.
    defenderHitPoints?: number;
    pointsPerCarrierHit?: number;
};

export type FlagScoreInput = {
    role: FlagScoreRole;
    attackOutcome?: FlagAttackOutcome;
    carrierHits?: number;
    pointsPerHit?: number;
    maxCarrierHits?: number;
    maxHitPoints?: number;
    attackerBand1Points?: number;
    attackerBand2Points?: number;
    attackerSpawnPoints?: number;
};

function boundedInteger(value: unknown, fallback: number) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

export function resolveFlagScoringConfig(config: FlagScoringConfig = {}) {
    const isCurrentVersion = config.scoringVersion === FLAG_SCORING_VERSION;

    return {
        scoringVersion: FLAG_SCORING_VERSION,
        pointsPerHit: boundedInteger(
            config.pointsPerHit ?? config.defenderHitPoints ?? config.pointsPerCarrierHit,
            FLAG_SCORING_DEFAULTS.pointsPerHit
        ),
        // Old configurations are intentionally upgraded to the current official
        // rules instead of retaining the previous five-hit/100-point bases.
        maxCarrierHits: isCurrentVersion
            ? Math.max(1, boundedInteger(config.maxCarrierHits, FLAG_SCORING_DEFAULTS.maxCarrierHits))
            : FLAG_SCORING_DEFAULTS.maxCarrierHits,
        maxHitPoints: isCurrentVersion
            ? boundedInteger(config.maxHitPoints, FLAG_SCORING_DEFAULTS.maxHitPoints)
            : FLAG_SCORING_DEFAULTS.maxHitPoints,
        attackerBand1Points: isCurrentVersion
            ? boundedInteger(config.attackerBand1Points, FLAG_SCORING_DEFAULTS.attackerBand1Points)
            : FLAG_SCORING_DEFAULTS.attackerBand1Points,
        attackerBand2Points: isCurrentVersion
            ? boundedInteger(config.attackerBand2Points, FLAG_SCORING_DEFAULTS.attackerBand2Points)
            : FLAG_SCORING_DEFAULTS.attackerBand2Points,
        attackerSpawnPoints: isCurrentVersion
            ? boundedInteger(config.attackerSpawnPoints, FLAG_SCORING_DEFAULTS.attackerSpawnPoints)
            : FLAG_SCORING_DEFAULTS.attackerSpawnPoints
    };
}

export function calculateFlagScore(input: FlagScoreInput) {
    const pointsPerHit = boundedInteger(input.pointsPerHit, FLAG_SCORING_DEFAULTS.pointsPerHit);
    const maxCarrierHits = Math.max(1, boundedInteger(input.maxCarrierHits, FLAG_SCORING_DEFAULTS.maxCarrierHits));
    const maxHitPoints = boundedInteger(input.maxHitPoints, FLAG_SCORING_DEFAULTS.maxHitPoints);
    const carrierHits = Math.min(boundedInteger(input.carrierHits, 0), maxCarrierHits);
    const attackerBand1Points = boundedInteger(input.attackerBand1Points, FLAG_SCORING_DEFAULTS.attackerBand1Points);
    const attackerBand2Points = boundedInteger(input.attackerBand2Points, FLAG_SCORING_DEFAULTS.attackerBand2Points);
    const attackerSpawnPoints = boundedInteger(input.attackerSpawnPoints, FLAG_SCORING_DEFAULTS.attackerSpawnPoints);
    const hitPoints = Math.min(maxHitPoints, carrierHits * pointsPerHit);

    if (input.role === 'disqualified') {
        return { basePoints: 0, hitPoints: 0, total: 0 };
    }

    if (input.role === 'attack') {
        const basePoints = input.attackOutcome === 'spawn'
            ? attackerSpawnPoints
            : input.attackOutcome === 'band_2'
                ? attackerBand2Points
                : attackerBand1Points;
        return { basePoints, hitPoints: 0, total: basePoints };
    }

    return {
        basePoints: 0,
        hitPoints,
        total: hitPoints
    };
}
