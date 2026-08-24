import { Avatar, Style } from '@dicebear/core';
import definition from '@dicebear/styles/constellation.json' with { type: 'json' };

const constellationStyle = new Style(definition);

export function constellationAvatarSvg(seed: string): string {
	return new Avatar(constellationStyle, {
		seed,
		size: 256
	}).toString();
}
