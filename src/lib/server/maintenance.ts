import { db, libsqlClient } from './db';
import * as schema from './schema';
import { sql, eq, isNotNull } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { generateUniqueJoinCode } from './join-code';
import { DEMO_GEO_HUNTS } from './demo-geophase';
import { ensureGeoPhaseSchema } from './geophase-schema';
import { constellationAvatarUrl } from '$lib/utils/constellation-avatar';
import { removeAllGeoPhotos } from './geophase-photos';

const RESET_PRESERVED_TABLES = new Set([
    'users',
    'config'
]);

function quoteIdentifier(identifier: string) {
    return `"${identifier.replaceAll('"', '""')}"`;
}

async function getResettableTables() {
    const result = await libsqlClient.execute(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '__drizzle_%'
        ORDER BY name
    `);

    return result.rows
        .map((row: any) => String(row.name ?? row[0]))
        .filter((name) => !RESET_PRESERVED_TABLES.has(name));
}

/**
 * Resets the database by clearing all dynamic event data.
 * Keeps 'admin' and 'staff' users unless they are tied to specific factions/teams (if any).
 */
export async function resetDatabase() {
    try {
        console.log('🔄 Avvio reset database...');

        const tables = await getResettableTables();

        // Generic future-proof reset: disable FK checks and clear every app table
        // except the small set we intentionally preserve.
        await libsqlClient.execute('PRAGMA foreign_keys = OFF');
        try {
            for (const table of tables) {
                await libsqlClient.execute(`DELETE FROM ${quoteIdentifier(table)}`);
            }

            // Keep admin/staff accounts, remove player accounts and detach any team link.
            await db.delete(schema.users).where(eq(schema.users.role, 'player')).run();
            await db.update(schema.users).set({ teamId: null }).run();
			await removeAllGeoPhotos();
        } finally {
            await libsqlClient.execute('PRAGMA foreign_keys = ON');
        }

        console.log('✅ Database resettato con successo.');
        return { success: true, clearedTables: tables };
    } catch (error) {
        console.error('❌ Errore durante il reset del database:', error);
        throw error;
    }
}

/** Removes every GeoPhase photo while preserving completed scores and results. */
export async function clearGeoPhasePhotos() {
    await ensureGeoPhaseSchema();

    const photoRows = await db
        .select({ id: schema.teamGeoProgress.id })
        .from(schema.teamGeoProgress)
        .where(isNotNull(schema.teamGeoProgress.photoPath));

    // Files are privacy-sensitive. Delete them even if the subsequent database
    // update fails; retrying the action will then repair any stale references.
    await removeAllGeoPhotos();

    await db
        .update(schema.teamGeoProgress)
        .set({
            photoPath: null,
            // A pending submission without its file must become uploadable again.
            status: sql`CASE WHEN status = 'photo_submitted' THEN 'challenge_active' ELSE status END`,
            updatedAt: new Date()
        })
        .where(isNotNull(schema.teamGeoProgress.photoPath));

    return { removedReferences: photoRows.length };
}

/**
 * Seeds the database with dummy data for testing.
 * Recreates CaTE 2026 event structure, factions, and teams.
 */
export async function seedDummyData() {
    try {
        console.log('🌱 Avvio seeding dati dummy...');
        await ensureGeoPhaseSchema();

        // 1. Ensure we have an active event
        const eventId = '019bebe5-79d0-733b-9773-c0956a4d5fd9'; // Standard ID used in scripts

        // Check if event exists
        const existingEvent = await db.query.events.findFirst({
            where: eq(schema.events.id, eventId)
        });

        if (!existingEvent) {
            await db.insert(schema.events).values({
                id: eventId,
                name: 'CaTE 2026 - I Cavalieri di Alabastro',
                slug: 'cate-2026',
                isActive: true,
                eventType: 'cate',
                startDate: new Date('2026-08-23T00:00:00+02:00'),
                endDate: new Date('2026-08-23T23:59:59+02:00'),
                createdAt: new Date(),
                updatedAt: new Date()
            }).run();
        }

        // CaTE 2026 — I Cavalieri di Alabastro.
        // 4 Macro-Precettorie (Province), 5 squadre ciascuna, ognuna intitolata a
        // una precettoria templare storica.
        const FACTIONS_DATA = [
            {
                name: 'Precettoria d\'Oltremare',
                description: 'Gran Maestro: Amalia — Terrasanta',
                color: '#DAA520',
                teams: [
                    { name: 'Tempio di Salomone (Gerusalemme)', description: 'L\'Origine e sede fondativa.' },
                    { name: 'San Giovanni d\'Acri (Israele)', description: 'L\'ultimo baluardo in Terra Santa (1291).' },
                    { name: 'Castel Pellegrino (Atlit)', description: 'La grande fortezza inespugnabile.' },
                    { name: 'Tortosa (Siria)', description: 'Cattedrale-fortezza dedicata alla Vergine.' },
                    { name: 'Safed (Galilea)', description: 'Castello strategico in Galilea.' }
                ]
            },
            {
                name: 'Precettoria di Francia',
                description: 'Gran Maestro: Ottavia',
                color: '#002395',
                teams: [
                    { name: 'Parigi (Enclos du Temple)', description: 'Sede centrale europea e Tesoro Reale.' },
                    { name: 'Provins (Champagne)', description: 'Snodo commerciale delle Fiere di Champagne.' },
                    { name: 'Payns (Aube)', description: 'Luogo natale del fondatore Ugo di Payns.' },
                    { name: 'Sainte-Eulalie-de-Cernon (Larzac)', description: 'Dominio fortificato agro-pastorale.' },
                    { name: 'Chinon (Indre-et-Loire)', description: 'Prigione reale e luogo del celebre manoscritto.' }
                ]
            },
            {
                name: 'Precettoria d\'Iberia',
                description: 'Gran Maestro: Tiziana — Spagna e Portogallo',
                color: '#C60B1E',
                teams: [
                    { name: 'Tomar (Portogallo)', description: 'Sede portoghese e Convento di Cristo.' },
                    { name: 'Miravet (Catalogna)', description: 'Fortezza sul fiume Ebro.' },
                    { name: 'Peñíscola (Valencia)', description: 'Castello sul mare, tra le ultime opere dell\'Ordine.' },
                    { name: 'Monzón (Aragona)', description: 'Luogo di educazione di re Giacomo I d\'Aragona.' },
                    { name: 'Ponferrada (León)', description: 'Fortezza a protezione del Cammino di Santiago.' }
                ]
            },
            {
                name: 'Precettoria d\'Italia',
                description: 'Gran Maestro: Giovanna — Apulia et Sicilia',
                color: '#008C45',
                teams: [
                    { name: 'Barletta (Puglia)', description: 'Residenza del Maestro Provinciale di Apulia e Sicilia.' },
                    { name: 'San Giovanni di Foggia (Capitanata)', description: 'Centro delle masserie cerealicole templari.' },
                    { name: 'Troia (Puglia / Via Traiana)', description: 'Presidio lungo la Via Traiana.' },
                    { name: 'Benevento (San Modesto)', description: 'Nodo papale e precettoria di riferimento per il territorio.' },
                    { name: 'Matera (Basilicata)', description: 'Insediamento e possedimento in terra lucana.' }
                ]
            }
        ];

        const ITALIAN_NAMES = [
            'Mario', 'Luigi', 'Francesca', 'Giulia', 'Alessandro', 'Lorenzo', 'Marco', 'Elena',
            'Pietro', 'Sofia', 'Leonardo', 'Beatrice', 'Matteo', 'Alice', 'Davide', 'Chiara',
            'Antonio', 'Emanuela', 'Federico', 'Martina', 'Gabriele', 'Sara', 'Riccardo', 'Anna'
        ];
        const ITALIAN_SURNAMES = [
            'Rossi', 'Bianchi', 'Ferrari', 'Esposito', 'Romano', 'Gallo', 'Costa', 'Fontana',
            'Moretti', 'Mancini', 'Ricci', 'Bruno', 'Mazza', 'Rizzo', 'Conti', 'Marin',
            'Greco', 'Barbieri', 'Lombardi', 'Giordano', 'Cassano', 'Colombo', 'Russo', 'Longo'
        ];

        function getRandomItalianName() {
            const name = ITALIAN_NAMES[Math.floor(Math.random() * ITALIAN_NAMES.length)];
            const surname = ITALIAN_SURNAMES[Math.floor(Math.random() * ITALIAN_SURNAMES.length)];
            return `${name} ${surname}`;
        }

        for (const fData of FACTIONS_DATA) {
            const factionId = uuidv7();
            await db.insert(schema.factions).values({
                id: factionId,
                eventId: eventId,
                name: fData.name,
                description: fData.description,
                color: fData.color,
                // Etichetta generica di proposito: i nomi sono specifici della
                // CaTE 2026, il tipo resta riusabile per le edizioni future.
                factionType: 'Fazione'
            }).run();

            for (const team of fData.teams) {
                const teamId = uuidv7();
                const joinCode = await generateUniqueJoinCode();

                await db.insert(schema.teams).values({
                    id: teamId,
                    name: team.name,
                    description: team.description,
                    joinCode: joinCode,
                    factionId: factionId,
                    avatarUrl: constellationAvatarUrl(teamId),
                    color: fData.color,
                    scoreCache: 0
                }).run();

                // Create 3 players for each team
                for (let i = 1; i <= 3; i++) {
                    await db.insert(schema.users).values({
                        id: uuidv7(),
                        name: getRandomItalianName(),
                        role: 'player',
                        teamId: teamId
                    }).run();
                }
            }

            const geoHunt = DEMO_GEO_HUNTS.find((hunt) => hunt.factionName === fData.name);
            if (!geoHunt) {
                throw new Error(`Configurazione GeoPhase demo mancante per ${fData.name}`);
            }

            const huntId = uuidv7();
            const now = new Date();
            await db.insert(schema.geoHunts).values({
                id: huntId,
                eventId,
                factionId,
                name: geoHunt.name,
                description: geoHunt.description,
                challengeDisclaimerText: geoHunt.challengeDisclaimerText,
                // Coordinates are deliberately placeholders. An admin must
                // complete and verify them before activating each hunt.
                isActive: false,
                createdAt: now,
                updatedAt: now
            }).run();

            await db.insert(schema.geoWaypoints).values(
                geoHunt.waypoints.map((waypoint, sortOrder) => ({
                    id: uuidv7(),
                    huntId,
                    adminName: waypoint.adminName,
                    name: waypoint.name,
                    lat: '0',
                    lng: '0',
                    radiusMeters: waypoint.radiusMeters,
                    sortOrder,
                    challengeType: waypoint.challengeType,
                    enigmaText: waypoint.enigmaText,
                    quizQuestion: waypoint.quizQuestion,
                    quizOptions: waypoint.quizOptions ? JSON.stringify(waypoint.quizOptions) : null,
                    quizAnswer: waypoint.quizAnswer,
                    quizTimeLimitSeconds: waypoint.quizTimeLimitSeconds,
                    challengeDisclaimerText: waypoint.challengeDisclaimerText,
                    pointsOnArrival: waypoint.pointsOnArrival,
                    pointsOnSuccess: waypoint.pointsOnSuccess,
                    createdAt: now,
                    updatedAt: now
                }))
            ).run();
        }

        console.log('✅ Seeding completato con successo.');
        return { success: true };
    } catch (error) {
        console.error('❌ Errore durante il seeding dei dati:', error);
        throw error;
    }
}
