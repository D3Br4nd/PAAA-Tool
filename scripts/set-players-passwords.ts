import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users } from '../src/lib/server/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

// Force localhost if the env var points to the internal docker hostname 'db'
// and we are running this script from the host machine.
const envUrl = process.env.DATABASE_URL || 'http://localhost:8080';
const url = envUrl.replace('http://db:8080', 'http://127.0.0.1:8080');

console.log(`🔌 Connessione a: ${url}`);
const token = process.env.AUTH_TOKEN;
const client = createClient({ url, authToken: token });
const db = drizzle(client);

async function main() {
    const newPassword = process.argv[2];

    if (!newPassword) {
        console.error('Uso: bun run scripts/set-players-passwords.ts <NuovaPassword>');
        process.exit(1);
    }

    console.log(`Impostazione password per tutti i giocatori...`);

    try {
        const hashed = await Bun.password.hash(newPassword);

        // Update all users with role 'player'
        const result = await db
            .update(users)
            .set({
                passwordHash: hashed,
                updatedAt: new Date()
            })
            .where(eq(users.role, 'player'))
            .run();

        console.log(`✅ Password aggiornata per ${result.rowsAffected} giocatori.`);
    } catch (e: any) {
        console.error('❌ Errore durante l\'aggiornamento delle password:', e.message);
    } finally {
        client.close();
    }
}

main();
