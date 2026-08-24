import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { events } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { ensureAdmin } from '$lib/server/auth';
import { readValidatedImage } from '$lib/server/uploads';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const AVATAR_DIR = '/app/uploads/faction_avatars';

async function ensureDir(dir: string) {
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
}

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.role !== 'admin') {
        throw redirect(302, '/dashboard');
    }

    // Fetch all events
    const allEvents = await db.select().from(events).orderBy(events.name);

    return {
        events: allEvents,
        currentUser: locals.user
    };
};

export const actions: Actions = {
    // ========== EVENT ACTIONS ==========

    createEvent: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const name = formData.get('name') as string;
        const slug = formData.get('slug') as string;
        const isActive = formData.get('isActive') === 'true';
        const eventType = formData.get('eventType') as string;
        const classification = formData.get('classification') as string | null;
        const description = formData.get('description') as string | null;
        const startDateStr = formData.get('startDate') as string | null;
        const endDateStr = formData.get('endDate') as string | null;
        const logoFile = formData.get('logo') as File | null;

        if (!name || !slug || !eventType) {
            return fail(400, { error: 'Nome, slug e tipologia obbligatori' });
        }

        // Check slug uniqueness
        const existing = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
        if (existing.length > 0) {
            return fail(400, { error: 'Slug già in uso' });
        }

        const eventId = uuidv7();

        let logoUrl: string | null = null;
        if (logoFile && logoFile.size > 0) {
            const image = await readValidatedImage(logoFile);
            if (!image) {
                return fail(400, { error: 'Logo non valido: sono ammesse solo immagini PNG, JPEG, GIF o WebP (max 5 MB)' });
            }
            // Reuse existing directory helper but point to event logos
            const EVENT_LOGO_DIR = '/app/uploads/event_logos';
            await ensureDir(EVENT_LOGO_DIR);

            const filename = `${eventId}-${Date.now()}.${image.ext}`;
            const filePath = join(EVENT_LOGO_DIR, filename);
            await writeFile(filePath, image.buffer);
            logoUrl = `/api/event_logos/${filename}`;
        }

        await db.insert(events).values({
            id: eventId,
            name,
            slug,
            isActive,
            eventType,
            classification: eventType === 'other' ? classification : null,
            description,
            logoUrl,
            startDate: startDateStr ? new Date(startDateStr) : null,
            endDate: endDateStr ? new Date(endDateStr) : null
        });

        return { success: true };
    },

    updateEvent: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const name = formData.get('name') as string;
        const slug = formData.get('slug') as string;
        const isActive = formData.get('isActive') === 'true';
        const eventType = formData.get('eventType') as string;
        const classification = formData.get('classification') as string | null;
        const description = formData.get('description') as string | null;
        const startDateStr = formData.get('startDate') as string | null;
        const endDateStr = formData.get('endDate') as string | null;
        const logoFile = formData.get('logo') as File | null;

        if (!id || !name || !slug || !eventType) {
            return fail(400, { error: 'Dati incompleti' });
        }

        const [current] = await db.select().from(events).where(eq(events.id, id)).limit(1);
        if (!current) {
            return fail(404, { error: 'Evento non trovato' });
        }

        // Check slug uniqueness (exclude current)
        const existing = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
        if (existing.length > 0 && existing[0].id !== id) {
            return fail(400, { error: 'Slug già in uso' });
        }

        let logoUrl = current.logoUrl;
        if (logoFile && logoFile.size > 0) {
            const image = await readValidatedImage(logoFile);
            if (!image) {
                return fail(400, { error: 'Logo non valido: sono ammesse solo immagini PNG, JPEG, GIF o WebP (max 5 MB)' });
            }
            const EVENT_LOGO_DIR = '/app/uploads/event_logos';
            await ensureDir(EVENT_LOGO_DIR);

            // Delete old logo if exists
            if (logoUrl?.startsWith('/api/event_logos/')) {
                const oldPath = join(EVENT_LOGO_DIR, logoUrl.split('/').pop()!);
                if (existsSync(oldPath)) await unlink(oldPath).catch(() => { });
            }

            const filename = `${id}-${Date.now()}.${image.ext}`;
            const filePath = join(EVENT_LOGO_DIR, filename);
            await writeFile(filePath, image.buffer);
            logoUrl = `/api/event_logos/${filename}`;
        }

        await db
            .update(events)
            .set({
                name,
                slug,
                isActive,
                eventType,
                classification: eventType === 'other' ? classification : null,
                description,
                logoUrl,
                startDate: startDateStr ? new Date(startDateStr) : null,
                endDate: endDateStr ? new Date(endDateStr) : null,
                updatedAt: new Date()
            })
            .where(eq(events.id, id));

        return { success: true };
    },

    deleteEvent: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;

        if (!id) {
            return fail(400, { error: 'ID evento mancante' });
        }

        // Factions, teams and GeoPhase database rows are deleted by cascade.
		// GeoPhase files remain on disk until the explicit full reset.
        await db.delete(events).where(eq(events.id, id));

        return { success: true };
    }
};
