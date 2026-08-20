import React from "react";
import { decor } from "../../styles";

export function BackgroundDecor() {
  return (
    <>
      <div
        style={{
          position: "fixed",
          top: -200,
          right: -200,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: decor.one,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: -300,
          left: -100,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: decor.two,
          pointerEvents: "none",
        }}
      />
    </>
  );
}
