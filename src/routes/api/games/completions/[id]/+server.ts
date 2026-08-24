import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { games, teamGameCompletions } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { ensureStaff } from '$lib/server/auth';
import { assertStaffCanAccessTeam } from '$lib/server/staff-access';
import { cancelGameCompletion } from '$lib/server/cancel-game-completion';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	ensureStaff(locals);

	const [completion] = await db
		.select()
		.from(teamGameCompletions)
		.where(eq(teamGameCompletions.id, params.id))
		.limit(1);

	if (!completion) return new Response(null, { status: 204 });

	const [game] = await db
		.select({ id: games.id, eventId: games.eventId })
		.from(games)
		.where(eq(games.id, completion.gameId))
		.limit(1);

	await assertStaffCanAccessTeam(locals, completion.teamId, game?.eventId);

	await cancelGameCompletion(params.id);

	return new Response(null, { status: 204 });
};
