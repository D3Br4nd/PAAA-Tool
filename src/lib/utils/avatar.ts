import { initialsAvatarDataUri } from './initials-avatar';
import { constellationAvatarUrlFromValue } from './constellation-avatar';
import { planetAvatarUrlFromValue } from './planet-avatar';

/**
 * Generates an avatar URL ensuring the correct style is used.
 * Ignores legacy DiceBear URLs stored in the database. User fallbacks use the
 * local Planets endpoint, team fallbacks use Constellation, and faction
 * fallbacks remain initials.
 */
export function getAvatarUrl(
    storedUrl: string | null | undefined,
    name: string,
    type: "team" | "user" | "faction"
): string {
    // If a custom URL exists and it's NOT a legacy DiceBear URL, use it.
    if (storedUrl && !storedUrl.includes("api.dicebear.com")) {
        return storedUrl;
    }

    if (type === 'user') {
        return planetAvatarUrlFromValue(name || 'user');
    }

    if (type === 'team') {
        return constellationAvatarUrlFromValue(name || 'team');
    }

    return initialsAvatarDataUri(name || 'Faction');
}
