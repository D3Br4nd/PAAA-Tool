import { Avatar, Style } from "@dicebear/core";
import definition from "@dicebear/styles/planets.json" with { type: "json" };

const planetsStyle = new Style(definition);

export function planetAvatarSvg(seed: string): string {
  return new Avatar(planetsStyle, {
    seed,
    size: 256,
  }).toString();
}
