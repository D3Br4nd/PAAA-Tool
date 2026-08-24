export const scoringTypes = ['simple', 'attempt_based', 'checklist', 'time_only', 'timed_obstacle'] as const;
export type ScoringType = (typeof scoringTypes)[number];

// `ranking_bonus` remains readable for historical ledger entries, but new scores never create it.
export const scoreEventTypes = ['base', 'attempt_bonus', 'checklist_item', 'ranking_bonus', 'penalty', 'adjustment', 'time_bonus', 'obstacle_penalty', 'special_bonus'] as const;
export type ScoreEventType = (typeof scoreEventTypes)[number];

export type StepScoringRule = {
    attempt: number;
    points: number;
	label?: string;
};

// Time bracket for timed_obstacle challenges
export type TimeBracket = {
    maxSeconds: number;    // Upper bound in seconds (e.g., 60, 120, 180)
    basePoints: number;    // Base points for this bracket (e.g., 100 or 0)
    timeBonus: number;     // Bonus/malus for this bracket (e.g., +70, +40, 0, -40, -70)
};

// Bonus option for special scoring (e.g., Quintana)
export type BonusOption = {
    label: string;         // e.g., "Giro Completo ✓"
    points: number;        // e.g., 30 or -30
};

export type ChallengeConfig = {
    // For checklist type
    checklistItems?: number;         // For Architetto: number of elements (e.g., 5)
    pointsPerItem?: number;          // Points per checklist item (e.g., 10)
    // For timed_obstacle type
    timeLimitSeconds?: number;       // Max time in seconds (e.g., 300 for 5 min)
    timeBrackets?: TimeBracket[];    // Array of time brackets with points
    penaltyPerObstacle?: number;     // Penalty points per obstacle hit (e.g., -5)
    bonusOptions?: {
        name: string;                // e.g., "Quintana"
        options: BonusOption[];      // Array of bonus choices
    };
    // Generic game made of a configurable list of phases. Each phase receives
    // one total score from the judge.
    mode?: 'phased_game' | 'templar_triptych' | 'flag_standard';
    phasedGame?: {
        steps: Array<{
            name: string;
        }>;
    };
    flagStandard?: {
        scoringVersion?: 'role_v2' | 'bands_v3';
        carrierHitLabel?: string;
        pointsPerHit?: number;
        attackerBand1Points?: number;
        attackerBand2Points?: number;
        attackerSpawnPoints?: number;
        maxHitPoints?: number;
        maxCarrierHits?: number;
        // Compatibility fields for configurations saved before bands_v3.
        attackerLinePoints?: number;
        attackerDeliveredPoints?: number;
        defenderBasePoints?: number;
        stalemateBasePoints?: number;
        pointsPerCarrierHit?: number;
        defenderHitPoints?: number;
        defenderAdvancedTimeoutBonus?: number;
    };
};
