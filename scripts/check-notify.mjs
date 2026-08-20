// Approval notification: the coordinates a player is told must be the squares
// they actually hold. Getting this wrong means telling someone they won when
// they didn't, so it's checked against the board rather than trusted.
import { placeParticipant, getInitialBoard, generateHeaders } from "../src/utils/boardLogic.js";
import {
  cellsToCoordinates,
  formatCoordinates,
  buildApprovalMessage,
  buildMailtoLink,
} from "../src/utils/notify.js";

let failed = 0;
const check = (l, c) => {
  console.log((c ? "PASS  " : "FAIL  ") + l);
  if (!c) failed++;
};

const headers = generateHeaders();
let board = getInitialBoard();

const { board: b1, placed, cells } = placeParticipant(board, "Joe Q. Okekpe", 3);
check("placeParticipant reports one cell per square placed", placed === 3 && cells.length === 3);
check(
  "every reported cell actually holds that name",
  cells.every(([r, c]) => b1[r][c] === "Joe Q. Okekpe")
);
check("reported cells are unique", new Set(cells.map(String)).size === cells.length);

const coords = cellsToCoordinates(cells, headers);
check("one coordinate per cell", coords.length === cells.length);
// The coordinate must be the header digits at that row/col — this is the bit
// a player reads off the grid to know whether they won.
check(
  "coordinates match the board headers exactly",
  cells.every(([r, c], i) => coords[i].x === headers.x[c] && coords[i].y === headers.y[r])
);
check(
  "all coordinates are digits 0-9",
  coords.every((c) => c.x >= 0 && c.x <= 9 && c.y >= 0 && c.y <= 9)
);

// A second player must not be told the first player's squares
const { board: b2, cells: cells2 } = placeParticipant(b1, "Ann Smith", 2);
check(
  "second player gets different cells",
  !cells2.some(([r, c]) => cells.some(([r2, c2]) => r === r2 && c === c2))
);
check(
  "first player's squares are untouched",
  cells.every(([r, c]) => b2[r][c] === "Joe Q. Okekpe")
);

// Over-request clamps rather than overflowing
const full = placeParticipant(getInitialBoard(), "Greedy", 150);
check("over-request clamps to 100", full.placed === 100 && full.cells.length === 100);

const config = { teamX: "Seahawks", teamY: "Patriots" };
const lines = formatCoordinates(coords, config);
check(
  "formatted lines name both teams",
  lines.every((l) => l.includes("Seahawks") && l.includes("Patriots"))
);

const msg = buildApprovalMessage({
  entry: { firstName: "Joe", name: "Joe Q. Okekpe", email: "joe@example.com" },
  coords,
  config,
  poolName: "Week 5",
  spaceCode: "scriberfam",
});
check("subject states the square count", msg.subject.includes("3 squares"));
check("body greets by first name", msg.body.startsWith("Hi Joe,"));
check("body links to the space by fragment", msg.body.includes("/#scriberfam"));
check(
  "body lists every square",
  coords.every((_, i) => msg.body.includes(lines[i]))
);

const link = buildMailtoLink(msg, "joe@example.com");
check("mailto targets the player", link.startsWith("mailto:joe%40example.com?"));
check("mailto encodes spaces, not plus signs", !link.includes("+") || !/body=[^&]*\+/.test(link));

// Missing headers must degrade, not throw
check("missing headers yields no coordinates", cellsToCoordinates(cells, null).length === 0);

console.log(failed === 0 ? "\nAll notify cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
