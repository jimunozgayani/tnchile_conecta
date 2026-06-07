import { useEffect, useState } from "react";

export function Footer() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastY = window.scrollY;
    const onScroll = () => {
      if (window.innerWidth >= 768) { setHidden(false); return; }
      const y = window.scrollY;
      const goingDown = y > lastY && y > 40;
      setHidden(goingDown);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <footer
      className={`border-t bg-card/80 text-muted-foreground transition-transform duration-300 ${
        hidden ? "translate-y-full md:translate-y-0" : "translate-y-0"
      }`}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-4 text-center text-xs md:flex-row md:justify-between md:gap-3 md:text-sm">
        <span>© 2025 TN Chile</span>
        <span className="italic">La logística la hacemos juntos.</span>
        <a href="mailto:contacto@tnchile.cl" className="hover:text-primary">contacto@tnchile.cl</a>
      </div>
    </footer>
  );
}
