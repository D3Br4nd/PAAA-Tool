import { expect, test } from 'bun:test';

const nativeDialogCall = /(?<![\w$.])(?:window\.)?(?:alert|confirm|prompt)\s*\(/g;

test('le pagine non usano popup nativi del browser', async () => {
	const violations: string[] = [];
	const files = new Bun.Glob('src/**/*.{svelte,ts,js}');

	for await (const path of files.scan('.')) {
		const source = await Bun.file(path).text();
		const lines = source.split('\n');

		for (const [index, line] of lines.entries()) {
			nativeDialogCall.lastIndex = 0;
			if (nativeDialogCall.test(line)) violations.push(`${path}:${index + 1}`);
		}
	}

	expect(violations).toEqual([]);
});
