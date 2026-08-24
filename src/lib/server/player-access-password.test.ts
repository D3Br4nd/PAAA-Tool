import { describe, expect, test } from 'bun:test';
import { generatePlayerAccessPassword } from './player-access-password';

describe('password di accesso dei giocatori', () => {
	test('genera password di 10 caratteri con sole lettere minuscole e numeri', () => {
		for (let index = 0; index < 100; index += 1) {
			const password = generatePlayerAccessPassword();
			expect(password).toMatch(/^[a-z0-9]{10}$/);
			expect(password).toMatch(/[a-z]/);
			expect(password).toMatch(/[0-9]/);
		}
	});
});
