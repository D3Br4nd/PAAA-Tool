import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { events } from '$lib/server/schema';
import { eq, asc } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw redirect(302, '/dashboard');
	}

	// Try to find the active event
	const [activeEvent] = await db
		.select()
		.from(events)
		.where(eq(events.isActive, true))
		.limit(1);

	if (activeEvent) {
		throw redirect(302, `/dashboard/${activeEvent.slug}/geophase`);
	}

	// Fallback to the first available event
	const [anyEvent] = await db
		.select()
		.from(events)
		.orderBy(asc(events.createdAt))
		.limit(1);

	if (anyEvent) {
		throw redirect(302, `/dashboard/${anyEvent.slug}/geophase`);
	}

	// If no events exist at all, go to events main dashboard
	throw redirect(302, '/dashboard/events');
};
