import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8h
const WARN_BEFORE_MS = 10 * 60 * 1000; // 10 min before expiry
const ACTIVITY_KEY = "tn_last_activity";

function now() { return Date.now(); }
function readLastActivity(): number {
  const v = Number(localStorage.getItem(ACTIVITY_KEY));
  return Number.isFinite(v) && v > 0 ? v : now();
}
function writeLastActivity(t: number) { localStorage.setItem(ACTIVITY_KEY, String(t)); }

export function SessionExpiryWarning() {
  const navigate = useNavigate();
  const [showWarn, setShowWarn] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARN_BEFORE_MS / 1000);
  const tickRef = useRef<number | null>(null);

  // Track activity
  useEffect(() => {
    const bump = () => writeLastActivity(now());
    writeLastActivity(now());
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  // Poll for warn / expiry
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setShowWarn(false); return; }
      const last = readLastActivity();
      const elapsed = now() - last;
      const remaining = SESSION_DURATION_MS - elapsed;
      if (remaining <= 0) {
        await supabase.auth.signOut();
        setShowWarn(false);
        navigate({ to: "/login" });
        return;
      }
      if (remaining <= WARN_BEFORE_MS) {
        setSecondsLeft(Math.max(1, Math.round(remaining / 1000)));
        setShowWarn(true);
      } else {
        setShowWarn(false);
      }
    };
    check();
    const id = window.setInterval(check, 30 * 1000);
    tickRef.current = id;
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [navigate]);

  if (!showWarn) return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-bold text-primary-dark">Sesión por expirar</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu sesión expirará en 10 minutos. ¿Deseas continuar?
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Tiempo restante: {mm}:{ss}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            className="rounded-md border px-4 py-2 text-sm">Cerrar sesión</button>
          <button
            onClick={() => { writeLastActivity(now()); setShowWarn(false); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
            Continuar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
