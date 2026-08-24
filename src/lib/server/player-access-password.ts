import { randomInt } from 'node:crypto';

const LOWERCASE_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const ACCESS_PASSWORD_ALPHABET = `${LOWERCASE_LETTERS}${DIGITS}`;

export function generatePlayerAccessPassword(length = 10): string {
	if (!Number.isSafeInteger(length) || length < 2) {
		throw new RangeError('La password deve contenere almeno 2 caratteri');
	}

	let password = '';
	do {
		password = Array.from(
			{ length },
			() => ACCESS_PASSWORD_ALPHABET[randomInt(ACCESS_PASSWORD_ALPHABET.length)]
		).join('');
	} while (!/[a-z]/.test(password) || !/[0-9]/.test(password));

	return password;
}
