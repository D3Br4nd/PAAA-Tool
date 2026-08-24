import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { planetAvatarSvg } from "$lib/server/planet-avatar";
import { isValidPlanetAvatarSeed } from "$lib/utils/planet-avatar";

export const GET: RequestHandler = ({ params }) => {
  if (!isValidPlanetAvatarSeed(params.seed)) {
    throw error(400, "Invalid avatar seed");
  }

  return new Response(planetAvatarSvg(params.seed), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
