import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users, teams } from '../src/lib/server/schema';
import { uuidv7 } from 'uuidv7';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL || 'http://localhost:8080';
const token = process.env.AUTH_TOKEN;

const client = createClient({ url, authToken: token });
const db = drizzle(client);

async function main() {
    const teamName = process.argv[2];
    const joinCode = process.argv[3];

    if (!teamName || !joinCode) {
        console.error('Uso: bun run scripts/seed-team.ts <NomeTeam> <Codice>');
        process.exit(1);
    }

    try {
        const teamId = uuidv7();
        await db.insert(teams).values({
            id: teamId,
            name: teamName,
            joinCode: joinCode.toUpperCase(),
            color: '#3b82f6',
            scoreCache: 0
        }).run();

        await db.insert(users).values({
            id: uuidv7(),
            role: 'player',
            teamId: teamId
        }).run();

        console.log(`✅ Team e Utente Giocatore creati: ${teamName} (${joinCode.toUpperCase()})`);
    } catch (e: any) {
        console.error('❌ Errore:', e.message);
    } finally {
        client.close();
    }
}

main();
