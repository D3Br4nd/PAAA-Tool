import { isValidLocalAvatarSeed, localAvatarSeedFromValue } from './local-avatar';

export const CONSTELLATION_AVATAR_PREFIX = '/api/team_avatars/constellation/';

export function constellationAvatarUrl(seed: string): string {
	if (!isValidLocalAvatarSeed(seed)) {
		throw new Error('Invalid constellation avatar seed');
	}

	return `${CONSTELLATION_AVATAR_PREFIX}${encodeURIComponent(seed)}`;
}

export function constellationAvatarUrlFromValue(value: string): string {
	return constellationAvatarUrl(localAvatarSeedFromValue(value || 'team', 'team'));
}

export function parseConstellationAvatarSeed(url: string | null | undefined): string | null {
	if (!url?.startsWith(CONSTELLATION_AVATAR_PREFIX)) return null;

	const encodedSeed = url.slice(CONSTELLATION_AVATAR_PREFIX.length);
	if (!encodedSeed || encodedSeed.includes('/')) return null;

	try {
		const seed = decodeURIComponent(encodedSeed);
		return isValidLocalAvatarSeed(seed) ? seed : null;
	} catch {
		return null;
	}
}
