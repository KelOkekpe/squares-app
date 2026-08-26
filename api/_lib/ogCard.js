/**
 * The link-preview card, as a plain element tree.
 *
 * Kept apart from the handler so it can be rendered to a PNG on disk and
 * actually looked at, rather than only ever existing inside a request.
 *
 * Satori supports a subset of CSS: flex only (no grid, no float), every
 * element with more than one child needs an explicit `display: flex`, and
 * there is no cascade — styles are per-node.
 */
const BRAND = "#138484";
const BRAND_ALT = "#5ce7e7";
const GOLD = "#ffd700";
const INK = "#0a0a1f";
const MUTED = "#9a9ac8";

const el = (type, style, children) => ({ type, props: { style, children } });
const row = (style, children) => el("div", { display: "flex", ...style }, children);
// Images are their own node shape: src is a prop, not a child.
const img = (src, size) => ({ type: "img", props: { src, width: size, height: size } });

/** A single grid square, filled or not. */
function cell(filled, highlight) {
  return el(
    "div",
    {
      display: "flex",
      width: 54,
      height: 54,
      borderRadius: 8,
      background: highlight ? GOLD : filled ? "#272754" : "#191939",
      border: `1px solid ${highlight ? GOLD : "#ffffff24"}`,
    },
    ""
  );
}

/** A miniature board, enough to be recognisable at thumbnail size. */
function miniBoard() {
  const FILLED = new Set([1, 2, 5, 6, 8, 9, 11, 14, 15, 17, 20, 22, 23]);
  return row(
    { flexDirection: "column", gap: 6 },
    [0, 1, 2, 3, 4].map((r) =>
      row(
        { gap: 6 },
        [0, 1, 2, 3, 4].map((c) => cell(FILLED.has(r * 5 + c), r === 2 && c === 3))
      )
    )
  );
}

/** A miniature pick sheet, so a pick'em invite doesn't advertise a grid. */
function miniTicket() {
  const ROWS = [
    ["away", true],
    ["home", true],
    ["away", false],
    ["home", null],
    ["away", null],
  ];
  return row(
    { flexDirection: "column", gap: 10 },
    ROWS.map(([side, result]) =>
      row({ gap: 8, alignItems: "center" }, [
        el(
          "div",
          {
            display: "flex",
            width: 108,
            height: 46,
            borderRadius: 8,
            background:
              side === "away"
                ? result === true
                  ? "#16a34a55"
                  : result === false
                    ? "#dc262655"
                    : `linear-gradient(135deg, ${BRAND}, ${BRAND_ALT})`
                : "#191939",
            border: `1px solid ${side === "away" ? "transparent" : "#ffffff24"}`,
          },
          ""
        ),
        el(
          "div",
          {
            display: "flex",
            width: 108,
            height: 46,
            borderRadius: 8,
            background:
              side === "home"
                ? result === true
                  ? "#16a34a55"
                  : result === false
                    ? "#dc262655"
                    : `linear-gradient(135deg, ${BRAND}, ${BRAND_ALT})`
                : "#191939",
            border: `1px solid ${side === "home" ? "transparent" : "#ffffff24"}`,
          },
          ""
        ),
      ])
    )
  );
}

export function ogCard({ title, subtitle, stat, tag, logos = [], variant = "squares" }) {
  return row(
    {
      width: "100%",
      height: "100%",
      background: `linear-gradient(135deg, ${INK} 0%, #17103a 55%, #241147 100%)`,
      padding: 64,
      alignItems: "center",
      justifyContent: "space-between",
    },
    [
      row({ flexDirection: "column", maxWidth: 640 }, [
        row({ alignItems: "center", gap: 14, marginBottom: 28 }, [
          el(
            "div",
            {
              display: "flex",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${BRAND}, ${BRAND_ALT})`,
            },
            ""
          ),
          el(
            "div",
            { fontSize: 26, fontWeight: 800, color: "#ffffff", letterSpacing: 2 },
            "SQUAREPOOL"
          ),
        ]),

        // Team logos read faster than the team names do at this size.
        logos.length
          ? row(
              { gap: 16, marginBottom: 24, alignItems: "center" },
              logos.map((src) => img(src, 64))
            )
          : row({}, []),

        el(
          "div",
          { fontSize: title.length > 34 ? 54 : 66, fontWeight: 900, color: "#ffffff", lineHeight: 1.05 },
          title
        ),
        el("div", { fontSize: 30, color: MUTED, marginTop: 18 }, subtitle),

        stat
          ? row({ marginTop: 32, alignItems: "center", gap: 12 }, [
              el(
                "div",
                {
                  display: "flex",
                  background: GOLD,
                  color: INK,
                  fontSize: 26,
                  fontWeight: 900,
                  padding: "10px 22px",
                  borderRadius: 999,
                },
                stat
              ),
              tag ? el("div", { fontSize: 24, color: MUTED }, tag) : el("div", {}, ""),
            ])
          : row({}, []),
      ]),

      variant === "pickem" ? miniTicket() : miniBoard(),
    ]
  );
}
