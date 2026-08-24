import { isValidLocalAvatarSeed, localAvatarSeedFromValue } from "./local-avatar";

export const PLANET_AVATAR_PREFIX = "/api/avatars/planets/";

export function isValidPlanetAvatarSeed(seed: string): boolean {
  return isValidLocalAvatarSeed(seed);
}

export function planetAvatarUrl(seed: string): string {
  if (!isValidPlanetAvatarSeed(seed)) {
    throw new Error("Invalid planet avatar seed");
  }

  return `${PLANET_AVATAR_PREFIX}${encodeURIComponent(seed)}`;
}

export function planetAvatarUrlFromValue(value: string): string {
  return planetAvatarUrl(localAvatarSeedFromValue(value || "user", "user"));
}

export function parsePlanetAvatarSeed(
  url: string | null | undefined,
): string | null {
  if (!url?.startsWith(PLANET_AVATAR_PREFIX)) return null;

  const encodedSeed = url.slice(PLANET_AVATAR_PREFIX.length);
  if (!encodedSeed || encodedSeed.includes("/")) return null;

  try {
    const seed = decodeURIComponent(encodedSeed);
    return isValidPlanetAvatarSeed(seed) ? seed : null;
  } catch {
    return null;
  }
}
