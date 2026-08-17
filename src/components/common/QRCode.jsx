import React, { useMemo } from "react";

/**
 * Generates a deterministic QR-like SVG from a string value.
 * For production, swap this out for a real QR library.
 */
export function QRCode({ value, size = 180, blurred = false }) {
  const modules = useMemo(() => {
    const grid = [];
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) & 0xffffffff;
    }
    const s = 21;
    for (let r = 0; r < s; r++) {
      const row = [];
      for (let c = 0; c < s; c++) {
        const isFinderTL = r < 7 && c < 7;
        const isFinderTR = r < 7 && c >= s - 7;
        const isFinderBL = r >= s - 7 && c < 7;
        if (isFinderTL || isFinderTR || isFinderBL) {
          const rl = isFinderTL ? r : isFinderTR ? r : r - (s - 7);
          const cl = isFinderTL ? c : isFinderTR ? c - (s - 7) : c;
          const isBorder = rl === 0 || rl === 6 || cl === 0 || cl === 6;
          const isInner = rl >= 2 && rl <= 4 && cl >= 2 && cl <= 4;
          row.push(isBorder || isInner ? 1 : 0);
        } else {
          hash = (((hash >>> 16) ^ hash) * 0x45d9f3b) & 0xffffffff;
          row.push((hash >> ((r * c) % 16)) & 1);
        }
      }
      grid.push(row);
    }
    return grid;
  }, [value]);

  const cellSize = size / 21;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          filter: blurred ? "blur(8px)" : "none",
          transition: "filter 0.3s",
          borderRadius: 8,
        }}
      >
        <rect width={size} height={size} fill="white" rx={4} />
        {modules.map((row, r) =>
          row.map((cell, c) =>
            cell ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize + 0.5}
                height={cellSize + 0.5}
                fill="#1a1a2e"
                rx={1}
              />
            ) : null
          )
        )}
      </svg>
      {blurred && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.3)",
            borderRadius: 8,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Submissions Closed
        </div>
      )}
    </div>
  );
}
