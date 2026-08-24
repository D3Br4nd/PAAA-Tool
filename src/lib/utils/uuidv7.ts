/**
 * UUIDv7 (time-ordered) generator.
 *
 * - Spec: https://www.rfc-editor.org/rfc/rfc9562.html
 * - Uses epoch milliseconds for ordering.
 * - Includes a 12-bit per-process monotonic counter for same-ms calls.
 *
 * Works in both browser and Node (Node >= 19 exposes Web Crypto as `globalThis.crypto`).
 */
let lastMs = 0;
let seq12 = 0;

function getRandomValues(bytes: Uint8Array) {
	const c = globalThis.crypto;
	if (!c?.getRandomValues) {
		throw new Error('crypto.getRandomValues is not available in this environment.');
	}
	c.getRandomValues(bytes);
	return bytes;
}

function toHex(bytes: Uint8Array) {
	let out = '';
	for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
	return out;
}

export function uuidv7(nowMs: number = Date.now()): string {
	// 16 bytes total
	const b = new Uint8Array(16);

	// 48-bit big-endian unix epoch ms
	const t = BigInt(nowMs);
	b[0] = Number((t >> 40n) & 0xffn);
	b[1] = Number((t >> 32n) & 0xffn);
	b[2] = Number((t >> 24n) & 0xffn);
	b[3] = Number((t >> 16n) & 0xffn);
	b[4] = Number((t >> 8n) & 0xffn);
	b[5] = Number(t & 0xffn);

	// random bytes for the remaining 10 bytes
	getRandomValues(b.subarray(6));

	// 12-bit monotonic sequence for same-ms generation
	if (nowMs === lastMs) {
		seq12 = (seq12 + 1) & 0x0fff;
	} else {
		lastMs = nowMs;
		seq12 = ((b[6] << 8) | b[7]) & 0x0fff;
	}

	// Byte 6: version 7 in high nibble, seq high 4 bits in low nibble
	b[6] = 0x70 | ((seq12 >> 8) & 0x0f);
	// Byte 7: seq low 8 bits
	b[7] = seq12 & 0xff;

	// Variant (RFC 4122): 10xxxxxx
	b[8] = (b[8] & 0x3f) | 0x80;

	const hex = toHex(b);
	// 8-4-4-4-12
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}


