export function normalizeJoinCode(value: string) {
	return value.trim().replace(/\s+/g, '').toUpperCase();
}

export function isValidManualJoinCode(value: string) {
	return /^[A-Z0-9]{6,16}$/.test(value);
}
