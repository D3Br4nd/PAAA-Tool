import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/lib/server/schema.ts';
import { eq } from 'drizzle-orm';

const client = createClient({
    url: 'file:/home/rocky/paaa-stuff/PAAA-Tool/sqld-data/data.sqld/dbs/default/data',
});

const db = drizzle(client, { schema });

async function main() {
    try {
        const activeEvents = await db.select().from(schema.events).where(eq(schema.events.isActive, true));
        console.log(JSON.stringify(activeEvents, null, 2));
    } catch (err) {
        console.error('Error fetching events:', err);
        // Try listing all events if none are active
        const allEvents = await db.select().from(schema.events);
        console.log('All events:', JSON.stringify(allEvents, null, 2));
    }
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
