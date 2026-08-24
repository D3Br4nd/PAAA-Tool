import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/lib/server/schema.ts';
import { uuidv7 } from 'uuidv7';

const client = createClient({
    url: process.env.DATABASE_URL || 'http://db:8080',
    authToken: process.env.AUTH_TOKEN,
});

const db = drizzle(client, { schema });

const EVENT_ID = '019bebe5-79d0-733b-9773-c0956a4d5fd9';

const DATA = [
    {
        name: 'Provincia Hierosolymitana',
        color: '#DAA520',
        teams: [
            'Tempio di Salomone (Gerusalemme)',
            'San Giovanni d\'Acri',
            'Castel Pellegrino (Atlit)',
            'Safed',
            'Tortosa'
        ]
    },
    {
        name: 'Provincia Franciae',
        color: '#002395',
        teams: [
            'Parigi (Le Temple)',
            'Provins',
            'Payns',
            'Sainte-Eulalie-de-Cernon',
            'Chinon'
        ]
    },
    {
        name: 'Provincia Yspanie',
        color: '#C60B1E',
        teams: [
            'Tomar',
            'Miravet',
            'Peñíscola',
            'Monzón',
            'Ponferrada'
        ]
    },
    {
        name: 'Provincia Apuliae et Siciliae',
        color: '#008C45',
        teams: [
            'Barletta',
            'San Giovanni di Foggia',
            'Troia',
            'Benevento (San Modesto)',
            'Matera'
        ]
    }
];

function generateJoinCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function main() {
    console.log('Starting population for Event ID:', EVENT_ID);
    console.log('Target URL:', process.env.DATABASE_URL || 'http://db:8080');

    for (const factionData of DATA) {
        const factionId = uuidv7();
        console.log(`Creating Faction: ${factionData.name} (${factionId})`);

        await db.insert(schema.factions).values({
            id: factionId,
            eventId: EVENT_ID,
            name: factionData.name,
            color: factionData.color,
            factionType: 'Provincia'
        });

        for (const teamName of factionData.teams) {
            const teamId = uuidv7();
            const joinCode = generateJoinCode();
            console.log(`  Creating Team: ${teamName} (${teamId}) - Join Code: ${joinCode}`);

            await db.insert(schema.teams).values({
                id: teamId,
                name: teamName,
                joinCode: joinCode,
                factionId: factionId,
                color: factionData.color,
                scoreCache: 0
            });
        }
    }

    console.log('Population complete!');
    process.exit(0);
}

main().catch((err) => {
    console.error('Population failed:', err);
    process.exit(1);
});
