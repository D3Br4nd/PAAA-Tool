/**
 * PAAA-Tool Scoring System
 * Core business logic for calculating scores in the Treasure Hunt game.
 * 
 * Supports:
 * - Attempt-based scoring (Scriba pattern: points decrease with attempts)
 * - Checklist-based scoring (Architetto pattern: base + per-item bonus)
 * - Penalties (negative scores for failures/skips)
 */

import type { StepScoringRule, ChallengeConfig } from './scoring-types';

// ============================================================================
// Attempt-Based Scoring (Scriba Pattern)
// ============================================================================

/**
 * Calculate score for an attempt-based challenge step.
 * 
 * Rules (from Scriba pattern):
 * - Each step has scoring rules mapping attempt number to points
 * - If attempt exceeds all defined rules, penalty is applied
 * 
 * @param rules - Array of {attempt, points} objects defining scoring tiers
 * @param attemptNumber - Which attempt this is (1-indexed)
 * @param penaltyPoints - Negative points applied if all attempts exhausted (should be negative, e.g., -30)
 * @returns The score for this attempt (can be negative)
 * 
 * @example
 * const rules = [
 *   { attempt: 1, points: 20 },
 *   { attempt: 2, points: 10 },
 *   { attempt: 3, points: 0 }
 * ];
 * calculateAttemptScore(rules, 1, -30); // Returns 20
 * calculateAttemptScore(rules, 3, -30); // Returns 0
 * calculateAttemptScore(rules, 4, -30); // Returns -30 (penalty)
 */
export function calculateAttemptScore(
    rules: StepScoringRule[],
    attemptNumber: number,
    penaltyPoints: number
): number {
    if (!rules || rules.length === 0) {
        return penaltyPoints;
    }

    // Sort rules by attempt number to ensure correct lookup
    const sortedRules = [...rules].sort((a, b) => a.attempt - b.attempt);

    // Find matching rule for this attempt
    const matchingRule = sortedRules.find(rule => rule.attempt === attemptNumber);

    if (matchingRule) {
        return matchingRule.points;
    }

    // If attempt number exceeds all defined rules, apply penalty
    const maxAttempt = Math.max(...sortedRules.map(r => r.attempt));
    if (attemptNumber > maxAttempt) {
        return penaltyPoints;
    }

    // If attempt is before first rule (shouldn't happen normally), return 0
    return 0;
}

/**
 * Check if a step was successfully completed (non-penalty score).
 */
export function isStepSuccessful(
    rules: StepScoringRule[],
    attemptNumber: number
): boolean {
    if (!rules || rules.length === 0) {
        return false;
    }

    const maxAttempt = Math.max(...rules.map(r => r.attempt));
    return attemptNumber <= maxAttempt;
}

// ============================================================================
// Checklist-Based Scoring (Architetto Pattern)
// ============================================================================

/**
 * Calculate score for a checklist-based challenge.
 * 
 * Rules (from Architetto pattern):
 * - Base points for acceptable completion
 * - Additional points per item correctly identified/completed
 * 
 * @param basePoints - Base score for acceptable completion (e.g., 50)
 * @param itemsCompleted - Number of items correctly completed (e.g., 0-5)
 * @param pointsPerItem - Points awarded per item (e.g., 10)
 * @param maxItems - Maximum countable items (for validation, optional)
 * @returns Total checklist score (base + items bonus)
 * 
 * @example
 * calculateChecklistScore(50, 5, 10);    // Returns 100 (50 + 5*10)
 * calculateChecklistScore(50, 3, 10);    // Returns 80 (50 + 3*10)
 * calculateChecklistScore(50, 0, 10);    // Returns 50 (base only)
 */
export function calculateChecklistScore(
    basePoints: number,
    itemsCompleted: number,
    pointsPerItem: number,
    maxItems?: number
): number {
    // Ensure non-negative items
    const validItems = Math.max(0, itemsCompleted);

    // Cap items if maxItems is defined
    const cappedItems = maxItems !== undefined
        ? Math.min(validItems, maxItems)
        : validItems;

    return basePoints + (cappedItems * pointsPerItem);
}

// ============================================================================
// Simple Scoring (Cavaliere Pattern)
// ============================================================================

/**
 * Calculate score for a simple completion challenge.
 * Used for challenges with a fixed completion score.
 * 
 * @param basePoints - Points for completion
 * @returns Total score
 * 
 * @example
 * calculateSimpleScore(90); // Returns 90
 */
export function calculateSimpleScore(basePoints: number): number {
    return basePoints;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate maximum possible score for a challenge.
 * Useful for displaying progress bars or validating scores.
 */
export function calculateMaxPossibleScore(
    basePoints: number,
    config?: ChallengeConfig
): number {
    let max = basePoints;

    // Add checklist bonus if configured
    if (config?.checklistItems && config?.pointsPerItem) {
        max += config.checklistItems * config.pointsPerItem;
    }

    return max;
}

/**
 * Sum all score entries for a team (for scoreCache updates).
 */
export function sumScoreEntries(entries: Array<{ points: number }>): number {
    return entries.reduce((sum, entry) => sum + entry.points, 0);
}
