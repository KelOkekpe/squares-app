import React from "react";
import { containerStyle } from "../../styles";

export function Footer({ pricePerSquare, filledCount, poolName }) {
  return (
    <footer
      style={{
        padding: "20px 0",
        borderTop: "1px solid #ffffff06",
        textAlign: "center",
        color: "#333",
        fontSize: 12,
      }}
    >
      <div style={containerStyle}>
        GRIDIRON Squares{poolName ? ` · ${poolName}` : ""} · ${pricePerSquare}/square ·{" "}
        {filledCount}/100 filled
      </div>
    </footer>
  );
}
