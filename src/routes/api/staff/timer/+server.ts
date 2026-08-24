import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eventTimers } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    // Only staff/admin
    if (locals.user?.role !== 'staff' && locals.user?.role !== 'admin') {
        throw error(403, 'Unauthorized');
    }

    const { eventId, action, macroPhaseId } = await request.json();

    if (!eventId || !action) {
        throw error(400, 'Missing eventId or action');
    }

    // Find current timer for this event/macroPhase
    let timer = await db.query.eventTimers.findFirst({
        where: eq(eventTimers.eventId, eventId)
    });

    const now = Date.now();

    if (!timer) {
        // Create new timer if not exists
        const newTimer = {
            id: uuidv7(),
            eventId,
            macroPhaseId: macroPhaseId || null,
            startTime: action === 'start' ? new Date(now) : null as Date | null,
            accumulatedTime: 0,
            isRunning: action === 'start',
            updatedAt: new Date(now)
        };
        await db.insert(eventTimers).values(newTimer);
        timer = newTimer;
    } else {
        // Update existing timer
        let startTime = timer.startTime;
        let accumulatedTime = timer.accumulatedTime;
        let isRunning = timer.isRunning;

        if (action === 'start' && !isRunning) {
            startTime = new Date(now);
            isRunning = true;
        } else if (action === 'stop' && isRunning) {
            const start = timer.startTime ? new Date(timer.startTime).getTime() : now;
            accumulatedTime += (now - start);
            startTime = null;
            isRunning = false;
        } else if (action === 'reset') {
            startTime = null;
            accumulatedTime = 0;
            isRunning = false;
        }

        const updatedAt = new Date(now);

        await db.update(eventTimers)
            .set({
                startTime,
                accumulatedTime,
                isRunning,
                updatedAt
            })
            .where(eq(eventTimers.id, timer.id));

        // Refetch or manual update for response
        timer = { ...timer, startTime, accumulatedTime, isRunning, updatedAt } as any;
    }

    return json({ timer });
};
