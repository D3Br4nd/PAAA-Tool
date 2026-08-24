import { db } from '$lib/server/db';
import { events, factions, teams, eventDraws } from '$lib/server/schema';
import { error, json } from '@sveltejs/kit';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { uuidv7 } from 'uuidv7';

// GET: Load the latest draw for this event
export const GET: RequestHandler = async ({ params, locals }) => {
    const { slug } = params;

    // Get event
    const [event] = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1);

    if (!event) {
        throw error(404, 'Evento non trovato');
    }

    // Get latest draw
    const [draw] = await db
        .select()
        .from(eventDraws)
        .where(eq(eventDraws.eventId, event.id))
        .orderBy(desc(eventDraws.createdAt))
        .limit(1);

    if (!draw) {
        return json({ draw: null });
    }

    // Non-admins only see already-revealed pairs — prevents peeking at upcoming matchups
    if (locals.user?.role !== 'admin') {
        const revealIndex = draw.revealIndex ?? -1;
        return json({
            draw: {
                ...draw,
                pairs: (draw.pairs as any[]).slice(0, revealIndex + 1)
            }
        });
    }

    return json({ draw });
};

// POST: Create or update a draw
export const POST: RequestHandler = async ({ params, request, locals }) => {
    // Admin check
    if (!locals.user || locals.user.role !== 'admin') {
        throw error(403, 'Non autorizzato');
    }

    const { slug } = params;
    const body = await request.json();
    const { action } = body;

    // Get event
    const [event] = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1);

    if (!event) {
        throw error(404, 'Evento non trovato');
    }

    if (action === 'start') {
        // Start a new draw
        const { pairs, oddTeamId, drawOrder, title } = body;

        // Delete any existing draws for this event
        await db.delete(eventDraws).where(eq(eventDraws.eventId, event.id));

        // Create new draw
        const newDraw = {
            id: uuidv7(),
            eventId: event.id,
            title: title || null,
            pairs: pairs || [],
            oddTeamId: oddTeamId || null,
            pairedTeamId: null,
            declinedTeamIds: [],
            drawOrder: drawOrder || [],
            status: 'revealing',
            revealIndex: -1
        };

        await db.insert(eventDraws).values(newDraw);

        return json({ success: true, draw: newDraw });
    }

    if (action === 'reveal') {
        // Reveal next pair
        const { revealIndex } = body;

        await db.update(eventDraws)
            .set({
                revealIndex,
                updatedAt: new Date()
            })
            .where(eq(eventDraws.eventId, event.id));

        return json({ success: true });
    }

    if (action === 'complete') {
        // Mark draw as complete
        await db.update(eventDraws)
            .set({
                status: 'complete',
                updatedAt: new Date()
            })
            .where(eq(eventDraws.eventId, event.id));

        return json({ success: true });
    }

    if (action === 'accept') {
        // Accept pairing for odd team
        const { pairedTeamId } = body;

        await db.update(eventDraws)
            .set({
                pairedTeamId,
                updatedAt: new Date()
            })
            .where(eq(eventDraws.eventId, event.id));

        return json({ success: true });
    }

    if (action === 'decline') {
        // Decline pairing
        const { teamId } = body;

        // Get current draw
        const [draw] = await db
            .select()
            .from(eventDraws)
            .where(eq(eventDraws.eventId, event.id))
            .limit(1);

        if (draw) {
            const declined = [...(draw.declinedTeamIds || []), teamId];
            await db.update(eventDraws)
                .set({
                    declinedTeamIds: declined,
                    updatedAt: new Date()
                })
                .where(eq(eventDraws.eventId, event.id));
        }

        return json({ success: true });
    }

    if (action === 'reset') {
        // Delete draw
        await db.delete(eventDraws).where(eq(eventDraws.eventId, event.id));
        return json({ success: true });
    }

    if (action === 'updateTitle') {
        // Update title
        const { title } = body;
        await db.update(eventDraws)
            .set({
                title: title || null,
                updatedAt: new Date()
            })
            .where(eq(eventDraws.eventId, event.id));
        return json({ success: true });
    }

    throw error(400, 'Azione non valida');
};
