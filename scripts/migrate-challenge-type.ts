import { createClient } from '@libsql/client';

const client = createClient({
    url: process.env.DATABASE_URL || 'http://db:8080',
    authToken: process.env.AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN
});

async function migrate() {
    // Check current columns
    const info = await client.execute('PRAGMA table_info(challenges)');
    const cols = info.rows.map((r: any) => r[1]);
    console.log('Current columns:', cols);

    if (!cols.includes('challenge_type')) {
        console.log('Adding challenge_type column...');
        await client.execute(`ALTER TABLE challenges ADD COLUMN challenge_type TEXT NOT NULL DEFAULT 'program'`);
        console.log('✅ Column challenge_type added with default = program');
        
        // If any challenges exist with phaseId=null that were created as games (e.g. GIOSTRA), update them
        // For now all existing data is programs (Scriba/Architetto/Cavaliere seeded without phaseId by old seed)
        // They stay as 'program' (the default) - correct behaviour
        const count = await client.execute(`SELECT COUNT(*) as n FROM challenges WHERE challenge_type = 'program'`);
        console.log('Challenges marked as program:', (count.rows[0] as any).n);
    } else {
        console.log('ℹ️  Column already exists, skipping');
    }

    client.close();
}

migrate().catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
});
