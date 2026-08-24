import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/lib/server/schema.ts';
import { uuidv7 } from 'uuidv7';

const client = createClient({
    url: process.env.DATABASE_URL || 'http://db:8080',
    authToken: process.env.AUTH_TOKEN,
});

const db = drizzle(client, { schema });

const MALE_NAMES = ['Alessandro', 'Andrea', 'Marco', 'Francesco', 'Luca', 'Giuseppe', 'Antonio', 'Roberto', 'Stefano', 'Giovanni'];
const female_NAMES = ['Maria', 'Giulia', 'Chiara', 'Francesca', 'Federica', 'Silvia', 'Elena', 'Laura', 'Anna', 'Valentina'];
const SURNAMES = ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco'];

function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

async function main() {
    console.log('Fetching teams...');
    const allTeams = await db.select().from(schema.teams);
    console.log(`Found ${allTeams.length} teams.`);

    for (const team of allTeams) {
        console.log(`Populating players for team: ${team.name}`);
        for (let i = 0; i < 3; i++) {
            const isMale = Math.random() > 0.5;
            const name = isMale ? getRandomElement(MALE_NAMES) : getRandomElement(female_NAMES);
            const surname = getRandomElement(SURNAMES);
            const fullName = `${name} ${surname}`;
            const email = `${name.toLowerCase()}.${surname.toLowerCase()}${Math.floor(Math.random() * 100)}@plv.it`;
            const playerId = uuidv7();

            await db.insert(schema.users).values({
                id: playerId,
                name: fullName,
                email: email,
                role: 'player',
                teamId: team.id
            });
            console.log(`  Created player: ${fullName} (${email})`);
        }
    }

    console.log('Player population complete!');
    process.exit(0);
}

main().catch((err) => {
    console.error('Player population failed:', err);
    process.exit(1);
});
