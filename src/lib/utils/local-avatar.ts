const LOCAL_AVATAR_SEED_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidLocalAvatarSeed(seed: string): boolean {
	return LOCAL_AVATAR_SEED_PATTERN.test(seed);
}

export function localAvatarSeedFromValue(value: string, prefix = 'avatar'): string {
	const input = value || 'avatar';
	let hash = 2166136261;

	for (let index = 0; index < input.length; index++) {
		hash ^= input.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return `${prefix}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
