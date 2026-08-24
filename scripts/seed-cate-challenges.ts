/**
 * Seed script for CaTE 2026 Phase 1 Challenges
 * 
 * Based on: Definizione-Punteggi-Fase-1-CaTE-2026.md
 * 
 * Usage:
 *   bun run scripts/seed-cate-challenges.ts [eventId]
 * 
 * If eventId is not provided, creates a new "CaTE 2026" event.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { events, challenges, challengeSteps } from '../src/lib/server/schema';
import type { ChallengeConfig, StepScoringRule } from '../src/lib/server/schema';
import { uuidv7 } from 'uuidv7';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL || 'http://localhost:8080';
const token = process.env.AUTH_TOKEN;

const client = createClient({ url, authToken: token });
const db = drizzle(client);

// ============================================================================
// CaTE 2026 Phase 1 Scoring Configuration
// ============================================================================

/**
 * Path del Cavaliere (L'Esploratore)
 * - Base: 90 points on target validation
 * - Max theoretical: 90 points
 */
const CAVALIERE_CONFIG: ChallengeConfig = {};

/**
 * Path dell'Architetto (Il Costruttore)
 * - Base: 50 points (diorama acceptable)
 * - Checklist: 5 architectural elements, 10 points each (max 50)
 * - Max theoretical: 100 points
 */
const ARCHITETTO_CONFIG: ChallengeConfig = {
    checklistItems: 5,
    pointsPerItem: 10
};

/**
 * Path dello Scriba (L'Amministratore)
 * - Completion base: 100 points
 * - 3 steps with attempt-based scoring
 * - Max theoretical: 140 points
 */
const SCRIBA_CONFIG: ChallengeConfig = {};

// Step 1 & 3 scoring rules (same pattern)
const ATTEMPT_SCORING_RULES: StepScoringRule[] = [
    { attempt: 1, points: 20 },
    { attempt: 2, points: 10 },
    { attempt: 3, points: 0 }
];

// ============================================================================
// Seed Functions
// ============================================================================

async function getOrCreateEvent(eventId?: string): Promise<string> {
    if (eventId) {
        // Verify event exists
        const existing = await db.select().from(events).where(eq(events.id, eventId)).get();
        if (existing) {
            console.log(`📋 Using existing event: ${existing.name}`);
            return eventId;
        }
        console.warn(`⚠️  Event ${eventId} not found, creating new one...`);
    }

    // Create new CaTE 2026 event
    const newEventId = uuidv7();
    await db.insert(events).values({
        id: newEventId,
        name: 'CaTE 2026 - Caccia al Tesoro Evolution',
        slug: 'cate-2026',
        isActive: false,
        eventType: 'cate',
        description: 'Caccia al Tesoro Evolution 2026 - Fase 1'
    }).run();

    console.log(`✅ Created new event: CaTE 2026 (${newEventId})`);
    return newEventId;
}

async function seedCavaliere(eventId: string): Promise<string> {
    const challengeId = uuidv7();

    await db.insert(challenges).values({
        id: challengeId,
        eventId,
        code: 'CAVALIERE',
        name: 'Path del Cavaliere',
        description: 'L\'Esploratore - Focus sulla rapidità di movimento e precisione nell\'individuazione dei monumenti.',
        scoringType: 'simple',
        basePoints: 90,
        maxPoints: 90,
        hasRankingBonus: false,
        sortOrder: 1,
        challengeType: 'program',
        config: CAVALIERE_CONFIG
    }).run();

    console.log(`  🐎 Cavaliere challenge seeded (base: 90pt, max: 140pt)`);
    return challengeId;
}

async function seedArchitetto(eventId: string): Promise<string> {
    const challengeId = uuidv7();

    await db.insert(challenges).values({
        id: challengeId,
        eventId,
        code: 'ARCHITETTO',
        name: 'Path dell\'Architetto',
        description: 'Il Costruttore - Focus sulla capacità di analisi del testo e abilità manuale nella riproduzione.',
        scoringType: 'checklist',
        basePoints: 50,
        maxPoints: 100,
        hasRankingBonus: false,
        sortOrder: 2,
        challengeType: 'program',
        config: ARCHITETTO_CONFIG
    }).run();

    console.log(`  🏰 Architetto challenge seeded (base: 50pt, +10×5 elements, max: 150pt)`);
    return challengeId;
}

async function seedScriba(eventId: string): Promise<string> {
    const challengeId = uuidv7();

    // Main challenge
    await db.insert(challenges).values({
        id: challengeId,
        eventId,
        code: 'SCRIBA',
        name: 'Path dello Scriba',
        description: 'L\'Amministratore - Focus sulla logica, cultura e gestione della pressione.',
        scoringType: 'attempt_based',
        basePoints: 100,  // Completion base
        maxPoints: 140,
        hasRankingBonus: false,
        sortOrder: 3,
        challengeType: 'program',
        config: SCRIBA_CONFIG
    }).run();

    // Step 1: Enigma del Santo
    const step1Id = uuidv7();
    await db.insert(challengeSteps).values({
        id: step1Id,
        challengeId,
        code: 'ENIGMA',
        name: 'Enigma del Santo',
        stepOrder: 1,
        scoringRules: ATTEMPT_SCORING_RULES,
        penaltyPoints: -30,
        isBlocking: false
    }).run();

    // Step 2: Il Mosaico/Puzzle (blocking step, no bonus, only penalty)
    const step2Id = uuidv7();
    await db.insert(challengeSteps).values({
        id: step2Id,
        challengeId,
        code: 'MOSAICO',
        name: 'Il Mosaico/Puzzle',
        stepOrder: 2,
        scoringRules: [{ attempt: 1, points: 0 }],  // Correct = 0 (blocking test)
        penaltyPoints: -30,
        isBlocking: true  // Must complete to proceed
    }).run();

    // Step 3: Il Custode/Parola d'Ordine
    const step3Id = uuidv7();
    await db.insert(challengeSteps).values({
        id: step3Id,
        challengeId,
        code: 'CUSTODE',
        name: 'Il Custode/Parola d\'Ordine',
        stepOrder: 3,
        scoringRules: ATTEMPT_SCORING_RULES,
        penaltyPoints: -30,
        isBlocking: false
    }).run();

    console.log(`  🖋️ Scriba challenge seeded with 3 steps (base: 100pt, max: 190pt)`);
    console.log(`     └─ Step 1: Enigma (+20/+10/0/-30)`);
    console.log(`     └─ Step 2: Mosaico (blocking, 0/-30)`);
    console.log(`     └─ Step 3: Custode (+20/+10/0/-30)`);

    return challengeId;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const eventId = process.argv[2];

    console.log('🎮 Seeding CaTE 2026 Phase 1 Challenges...\n');

    try {
        const targetEventId = await getOrCreateEvent(eventId);

        console.log('\n📝 Seeding challenges:');
        await seedCavaliere(targetEventId);
        await seedArchitetto(targetEventId);
        await seedScriba(targetEventId);

        console.log('\n✅ All CaTE 2026 Phase 1 challenges seeded successfully!');
        console.log(`   Event ID: ${targetEventId}`);
        console.log('\n📊 Summary:');
        console.log('   - Path del Cavaliere: simple scoring (90pt + ranking)');
        console.log('   - Path dell\'Architetto: checklist scoring (50pt + 5×10pt + ranking)');
        console.log('   - Path dello Scriba: attempt-based (100pt + steps ±bonuses + ranking)');

    } catch (e: any) {
        console.error('\n❌ Error seeding challenges:', e.message);
        process.exit(1);
    } finally {
        client.close();
    }
}

main();
