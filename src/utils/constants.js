export const GRID_SIZE = 10;
export const DEFAULT_PRICE = 10;
export const ADMIN_PASSWORD = "admin123";
export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

export const STORAGE_KEYS = (space, poolId) => ({
  board: `fb-${space}-${poolId}-board`,
  admin: `fb-${space}-${poolId}-admin`,
  participants: `fb-${space}-${poolId}-participants`,
  pending: `fb-${space}-${poolId}-pending`,
  scores: `fb-${space}-${poolId}-scores`,
  headers: `fb-${space}-${poolId}-headers`,
  slate: `fb-${space}-${poolId}-slate`,
  picks: `fb-${space}-${poolId}-picks`,
});

export const SPACE_META_KEY = (space) => `fb-${space}-meta`;
export const SPACES_REGISTRY_KEY = "fb-squares-spaces";

// Legacy keys for backward compatibility
export const ROOM_META_KEY = SPACE_META_KEY;
export const ROOMS_REGISTRY_KEY = SPACES_REGISTRY_KEY;

export const DEFAULT_POOL_ENTRY = (name) => ({
  id: `p${Date.now()}`,
  name: name || "Pool 1",
  createdAt: Date.now(),
  archived: false,
});

// Legacy name for backward compatibility
export const DEFAULT_BOARD_ENTRY = DEFAULT_POOL_ENTRY;

/**
 * Team banner colours a board starts with.
 *
 * Plain white on black: a board is usually printed or screenshotted, and the
 * admin sets their own team colours from here. These were three separate
 * copies of the same four hexes — constants, the grid and the colour picker —
 * which is why the picker could disagree with the board.
 */
export const DEFAULT_TEAM_COLORS = { bg: "#ffffff", color: "#000000" };

export const DEFAULT_CONFIG = {
  pricePerSquare: DEFAULT_PRICE,
  // Free text shown to players on the payment step, e.g. "Venmo @kel-okekpe".
  // Squares are only assigned once an admin confirms the money arrived.
  paymentInstructions: "",
  // Handles used to build prefilled deep links into the organiser's own
  // payment apps. The platform never processes these payments.
  paymentHandles: { venmo: "", cashapp: "", paypal: "", zelle: "" },
  teamX: "Seattle Seahawks",
  teamY: "New England Patriots",
  submissionsDisabled: false,
  teamXBg: DEFAULT_TEAM_COLORS.bg,
  teamXColor: DEFAULT_TEAM_COLORS.color,
  teamYBg: DEFAULT_TEAM_COLORS.bg,
  teamYColor: DEFAULT_TEAM_COLORS.color,
  totalPot: 0,
  quarterlyPayout: 0,
};
