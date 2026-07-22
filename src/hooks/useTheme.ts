import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "tn-theme";

function resolve(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function apply(mode: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolve(theme));

  useEffect(() => {
    const r = resolve(theme);
    setResolved(r);
    apply(r);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = mq.matches ? "dark" : "light";
      setResolved(r);
      apply(r);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  return { theme, resolved, setTheme, toggle };
}
