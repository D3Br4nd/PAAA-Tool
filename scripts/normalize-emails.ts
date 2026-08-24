/**
 * One-time data repair, safe to re-run on every boot.
 *
 * Login lowercases the submitted address, but users created before the write
 * path normalised emails may hold mixed-case values — those accounts can never
 * log in. This lowercases them in place.
 *
 * Rows whose lowercase form would collide with an existing account are left
 * untouched and reported: merging two accounts is a decision for an operator,
 * not for a boot script.
 */
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();

const db = createClient({
    url: process.env.DATABASE_URL || 'http://db:8080',
    authToken: process.env.DATABASE_AUTH_TOKEN
});

async function normalizeEmails() {
    console.log('Normalizing user emails to lowercase...');

    let rows;
    try {
        rows = await db.execute(
            "SELECT id, email FROM users WHERE email IS NOT NULL AND email <> lower(email)"
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('no such table')) {
            console.log('  ⏭ Skipped (users table not yet created)');
            return;
        }
        throw error;
    }

    if (rows.rows.length === 0) {
        console.log('  ✓ Nothing to normalize');
        return;
    }

    let fixed = 0;
    const collisions: string[] = [];

    for (const row of rows.rows) {
        const id = row.id as string;
        const email = row.email as string;
        const lowered = email.toLowerCase();

        const existing = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1',
            args: [lowered, id]
        });

        if (existing.rows.length > 0) {
            collisions.push(`${email} → ${lowered}`);
            continue;
        }

        await db.execute({
            sql: 'UPDATE users SET email = ? WHERE id = ?',
            args: [lowered, id]
        });
        fixed++;
    }

    console.log(`  ✓ Normalized ${fixed} email(s)`);
    if (collisions.length > 0) {
        console.warn(
            `  ⚠ ${collisions.length} account(s) left untouched — lowercase form already taken, merge manually:`
        );
        for (const c of collisions) console.warn(`      ${c}`);
    }
}

normalizeEmails()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Failed:', err);
        process.exit(1);
    });
