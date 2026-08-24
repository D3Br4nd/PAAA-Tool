import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { users } from '../src/lib/server/schema';
import { uuidv7 } from 'uuidv7';
import * as dotenv from 'dotenv';

dotenv.config();

// Use environment variables directly. 
// If running from host, DATABASE_URL should be set to reachable address.
// If running inside container, the default DATABASE_URL=http://db:8080 works.
const url = process.env.DATABASE_URL || 'http://localhost:8080';
const token = process.env.AUTH_TOKEN;

const client = createClient({ url, authToken: token });
const db = drizzle(client);

async function main() {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
        console.error('Uso: bun run scripts/seed-admin.ts <email> <password>');
        process.exit(1);
    }

    console.log(`Sincronizzazione admin: ${email}...`);

    const hashed = await Bun.password.hash(password);

    try {
        await db
            .insert(users)
            .values({
                id: uuidv7(),
                email: email.toLowerCase(),
                passwordHash: hashed,
                role: 'admin'
            })
            .onConflictDoUpdate({
                target: users.email,
                set: {
                    passwordHash: hashed,
                    updatedAt: new Date()
                }
            })
            .run();
        console.log(`✅ Admin sincronizzato correttamente: ${email}`);
    } catch (e: any) {
        console.error('❌ Errore durante la sincronizzazione dell\'admin:', e.message);
    } finally {
        client.close();
    }
}

main();
