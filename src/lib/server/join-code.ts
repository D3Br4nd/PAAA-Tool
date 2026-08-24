import { randomInt } from 'node:crypto';
import { db } from '$lib/server/db';
import { teams } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
export { normalizeJoinCode } from '$lib/utils/join-code';

/**
 * Join codes are an authentication credential: knowing one logs you into that
 * team. They must therefore come from a CSPRNG, never from Math.random()
 * (V8's PRNG state is recoverable from a handful of observed outputs, which
 * would make every other team's code predictable).
 *
 * Alphabet excludes I/O/0/1 so codes stay unambiguous when read aloud or
 * printed on a card.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function generateJoinCode(length = CODE_LENGTH) {
	let code = '';
	for (let i = 0; i < length; i++) {
		code += ALPHABET[randomInt(ALPHABET.length)];
	}
	return code;
}

/**
 * Generates a code that is not already taken. The unique index on
 * teams.join_code remains the real guard against races; this just avoids
 * surfacing a constraint error for the overwhelmingly common case.
 */
export async function generateUniqueJoinCode(maxAttempts = 10) {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const code = generateJoinCode();
		const [existing] = await db
			.select({ id: teams.id })
			.from(teams)
			.where(eq(teams.joinCode, code))
			.limit(1);
		if (!existing) return code;
	}
	throw new Error('Impossibile generare un codice squadra univoco.');
}
