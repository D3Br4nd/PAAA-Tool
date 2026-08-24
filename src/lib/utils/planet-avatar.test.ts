import { describe, expect, test } from "bun:test";
import {
  isValidPlanetAvatarSeed,
  parsePlanetAvatarSeed,
  planetAvatarUrl,
  planetAvatarUrlFromValue,
} from "./planet-avatar";

describe("planet avatar URLs", () => {
  test("builds and parses a local URL", () => {
    const seed = "0198a_user-2";
    const url = planetAvatarUrl(seed);

    expect(url).toBe("/api/avatars/planets/0198a_user-2");
    expect(parsePlanetAvatarSeed(url)).toBe(seed);
  });

  test("rejects unsafe or malformed seeds", () => {
    expect(isValidPlanetAvatarSeed("../avatar")).toBe(false);
    expect(isValidPlanetAvatarSeed("seed with spaces")).toBe(false);
    expect(parsePlanetAvatarSeed("/api/avatars/planets/a/b")).toBeNull();
    expect(() => planetAvatarUrl("../avatar")).toThrow();
  });

  test("hashes names and emails into private URL-safe fallback seeds", () => {
    const first = planetAvatarUrlFromValue("Mario Rossi <mario@example.it>");
    const second = planetAvatarUrlFromValue("Mario Rossi <mario@example.it>");

    expect(first).toBe(second);
    expect(first).toMatch(/^\/api\/avatars\/planets\/user-[a-f0-9]{8}$/);
    expect(first).not.toContain("Mario");
  });
});
