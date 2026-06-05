import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "tn-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-50 flex items-center gap-3 rounded-xl border bg-card p-3 shadow-lg md:hidden">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Download className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">Instalar app</p>
        <p className="text-xs text-muted-foreground">Accede más rápido desde tu pantalla.</p>
      </div>
      <button onClick={install} className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
        Instalar
      </button>
      <button onClick={dismiss} aria-label="Cerrar" className="text-muted-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}
