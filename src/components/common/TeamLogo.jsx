import React, { useState } from "react";
import { teamLogoUrl } from "../../utils";

/**
 * A team's logo, or nothing at all.
 *
 * The CDN is outside this app, so the image can fail for reasons that have
 * nothing to do with the pick — a renamed team, a relocation, an offline CDN.
 * On error it removes itself and the row falls back to the abbreviation it
 * already shows, rather than leaving a broken-image glyph next to someone's
 * pick.
 */
export function TeamLogo({ team, size = 18 }) {
  const [failed, setFailed] = useState(false);
  const src = teamLogoUrl(team);
  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, display: "block" }}
    />
  );
}
