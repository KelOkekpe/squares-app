import React from "react";
import { useRoute } from "./hooks/useRoute";
import { useAuth } from "./hooks/useAuth";
import { isSupabaseEnabled } from "./lib/supabase";
import { spacePath, ADMIN_PATH } from "./utils/routes";
import { PlayerLanding } from "./components/landing";
import { AdminApp } from "./components/admin";
import { GameBoard } from "./GameBoard";
import { pageStyle, containerStyle } from "./styles";

function SupabaseRequired() {
  return (
    <div style={pageStyle}>
      <div style={{ ...containerStyle, paddingTop: 120, textAlign: "center" }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 24 }}>Supabase Required</h2>
        <p style={{ color: "#8a8ab0", fontSize: 15 }}>
          Please set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your environment.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { route, navigate } = useRoute();
  const { isLoggedIn } = useAuth();

  if (!isSupabaseEnabled()) return <SupabaseRequired />;

  const enterSpace = (code) => navigate(spacePath(code));
  // Leaving a space returns you to whichever site you came from.
  const exitSpace = () => navigate(isLoggedIn ? ADMIN_PATH : "/");

  if (route.name === "admin") {
    return <AdminApp onOpenSpace={enterSpace} />;
  }

  if (route.name === "space") {
    return <GameBoard spaceCode={route.code} onExit={exitSpace} />;
  }

  return <PlayerLanding onEnterSpace={enterSpace} />;
}
