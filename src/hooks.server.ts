import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, teams } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { verifySessionToken } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rate-limit';
import { ensureUserAccountSchema } from '$lib/server/user-account-schema';
import { ensurePlayerPasswordVault } from '$lib/server/player-password-vault';

/**
 * Global ceiling, on top of the tighter per-action limits on login and Codex.
 *
 * Both numbers are far above any plausible human use and far below what a
 * script does, because the failure mode matters: getting this wrong takes the
 * app down during a live event. The GeoPhase client re-POSTs /arrive on every
 * GPS tick while the player stands inside a waypoint radius (~60/min), so the
 * write ceiling has to clear that comfortably.
 */
const MAX_WRITES_PER_MIN = 300;
const MAX_AUTHED_REQUESTS_PER_MIN = 900;

/**
 * Authenticated traffic is keyed by user id, never by IP: at an event a whole
 * venue shares one NAT address, and an IP-keyed limit would lock out everyone
 * at once. Unauthenticated GETs are deliberately not limited here for the same
 * reason — that is the reverse proxy's job.
 */
function rateLimitIdentity(event: Parameters<Handle>[0]['event']) {
	const userId = event.locals.user?.id;
	return userId ? `u:${userId}` : `ip:${event.getClientAddress()}`;
}

function isAssetRequest(pathname: string) {
	return pathname.startsWith('/_app/') || pathname === '/favicon.ico';
}

function checkGlobalRateLimit(event: Parameters<Handle>[0]['event']): Response | null {
	const { pathname } = event.url;
	if (isAssetRequest(pathname)) return null;

	const method = event.request.method;
	const isRead = method === 'GET' || method === 'HEAD';
	const identity = rateLimitIdentity(event);

	if (isRead) {
		// Unauthenticated reads are left to the proxy (see note above).
		if (!event.locals.user) return null;
		const read = checkRateLimit(`req_read_${identity}`, MAX_AUTHED_REQUESTS_PER_MIN, 60_000);
		if (read.success) return null;
		return tooManyRequests(read.resetAt);
	}

	const write = checkRateLimit(`req_write_${identity}`, MAX_WRITES_PER_MIN, 60_000);
	if (write.success) return null;
	return tooManyRequests(write.resetAt);
}

function tooManyRequests(resetAt: number) {
	const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
	return new Response('Troppe richieste. Riprova tra poco.', {
		status: 429,
		headers: {
			'Retry-After': String(retryAfter),
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
}

/**
 * Headers CSP cannot express, applied to every response (not just HTML pages,
 * which is all SvelteKit's own csp config covers).
 */
function applySecurityHeaders(event: Parameters<Handle>[0]['event'], response: Response) {
	response.headers.set('X-Content-Type-Options', 'nosniff');
	// Legacy backstop for browsers that ignore frame-ancestors.
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

	// Only meaningful over TLS, and the app sits behind a reverse proxy that
	// terminates it — so trust the forwarded scheme, falling back to the URL.
	const proto = event.request.headers.get('x-forwarded-proto') ?? event.url.protocol.replace(':', '');
	if (proto === 'https') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
}

async function populateSession(event: Parameters<Handle>[0]['event']) {
	event.locals.user = null;
	event.locals.team = null;
	event.locals.sessionId = null;

	const sessionId = event.cookies.get('session');
	if (!sessionId) return;

	// Verify JWT token
	const claims = await verifySessionToken(sessionId);
	if (!claims) {
		event.cookies.delete('session', { path: '/' });
		return;
	}

	if (claims.teamId) {
		const [team] = await db
			.select()
			.from(teams)
			.where(eq(teams.id, claims.teamId))
			.limit(1);

		if (!team) {
			event.cookies.delete('session', { path: '/' });
			return;
		}

		// A join code authenticates the team itself and can never acquire
		// account-level staff or admin privileges.
		event.locals.user = {
			id: `team:${team.id}`,
			email: null,
			name: team.name,
			avatarUrl: team.avatarUrl,
			role: 'player',
			teamId: team.id,
			authMethod: 'code'
		};
		event.locals.sessionId = claims.sessionId;
		event.locals.team = team;
		return;
	}
	if (!claims.userId) {
		event.cookies.delete('session', { path: '/' });
		return;
	}

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, claims.userId))
		.limit(1);

	if (!user) {
		event.cookies.delete('session', { path: '/' });
		return;
	}

	// authMethod comes from the signed token, never from a client-supplied
	// cookie. Account-only features can therefore distinguish code sessions.
	event.locals.user = {
		id: user.id,
		email: user.email,
		name: user.name,
		avatarUrl: user.avatarUrl,
		role: user.role,
		teamId: user.teamId,
		authMethod: claims.authMethod
	};
	event.locals.sessionId = claims.sessionId;

	// If player, fetch team data
	if (user.role === 'player' && user.teamId) {
		const [team] = await db
			.select()
			.from(teams)
			.where(eq(teams.id, user.teamId))
			.limit(1);

		event.locals.team = team || null;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	await ensureUserAccountSchema();
	await ensurePlayerPasswordVault();
	await populateSession(event);

	// Runs after the session so authenticated traffic is keyed by user id.
	const limited = checkGlobalRateLimit(event);
	if (limited) return applySecurityHeaders(event, limited);

	return applySecurityHeaders(event, await resolve(event));
};
