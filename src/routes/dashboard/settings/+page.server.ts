import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
    clearGeoPhasePhotos,
    resetDatabase,
    seedDummyData
} from '$lib/server/maintenance';
import { ensureAdmin } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { events } from '$lib/server/schema';
import { asc, eq } from 'drizzle-orm';
import { resetEventScores } from '$lib/server/reset-event-scores';

export const load: PageServerLoad = async ({ locals }) => {
    ensureAdmin(locals);

    return {
        events: await db
            .select({
                id: events.id,
                name: events.name,
                slug: events.slug,
                isActive: events.isActive
            })
            .from(events)
            .orderBy(asc(events.name))
    };
};

export const actions: Actions = {
    resetEventScores: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const eventId = formData.get('eventId') as string;

        if (!eventId) {
            return fail(400, { error: 'Seleziona un evento da resettare.' });
        }

        const [event] = await db
            .select({ id: events.id, name: events.name })
            .from(events)
            .where(eq(events.id, eventId))
            .limit(1);

        if (!event) {
            return fail(404, { error: 'Evento non trovato.' });
        }

        try {
            await resetEventScores(event.id);
            return {
                success: true,
                message: `Punteggi e progressi di ${event.name} resettati con successo.`
            };
        } catch (e: any) {
            return fail(500, { error: e.message || 'Errore durante il reset dei punteggi.' });
        }
    },
    resetData: async ({ locals }) => {
        ensureAdmin(locals);
        try {
            await resetDatabase();
            return { success: true, message: 'Database resettato con successo.' };
        } catch (e: any) {
            return fail(500, { error: e.message || 'Errore durante il reset del database.' });
        }
    },
    reseedDummy: async ({ locals }) => {
        ensureAdmin(locals);
        try {
            // First clean, then seed
            await resetDatabase();
            await seedDummyData();
            return { success: true, message: 'Dati demo CaTE 2026 e GeoPhase caricati con successo.' };
        } catch (e: any) {
            return fail(500, { error: e.message || 'Errore durante il caricamento dei dati demo.' });
        }
    },
    clearGeoPhotos: async ({ locals }) => {
        ensureAdmin(locals);
        try {
            const { removedReferences } = await clearGeoPhasePhotos();
            return {
                success: true,
                message: `Storage GeoPhase pulito. Rimossi ${removedReferences} riferiment${removedReferences === 1 ? 'o' : 'i'} fotografici.`
            };
        } catch (e: any) {
            return fail(500, { error: e.message || 'Errore durante la cancellazione delle foto GeoPhase.' });
        }
    },
    clearBrowserCache: async ({ locals, setHeaders }) => {
        ensureAdmin(locals);
        setHeaders({ 'Clear-Site-Data': '"cache"' });
        return {
            success: true,
            message: 'Richiesta di pulizia della cache inviata al browser.'
        };
    }
};
