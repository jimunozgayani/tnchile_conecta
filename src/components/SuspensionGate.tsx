import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert } from "lucide-react";

export function SuspensionGate({ children }: { children: React.ReactNode }) {
  const [suspended, setSuspended] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (mounted) setSuspended(false); return; }
      const { data } = await supabase
        .from("supplier_invitations")
        .select("status")
        .or(`user_id.eq.${user.id},email.eq.${user.email?.toLowerCase()}`)
        .maybeSingle();
      if (mounted) setSuspended(data?.status === "suspended");
    };
    check();
    const id = window.setInterval(check, 60_000);
    return () => { mounted = false; window.clearInterval(id); };
  }, []);

  if (suspended) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-14 w-14 text-destructive" />
          <h1 className="mt-4 text-2xl font-bold">Cuenta suspendida</h1>
          <p className="mt-3 text-muted-foreground">
            Tu cuenta está suspendida. Contacta a TN Chile:{" "}
            <a className="font-medium text-primary underline" href="mailto:contacto@tnchile.cl">
              contacto@tnchile.cl
            </a>
          </p>
          <button
            onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/login"))}
            className="mt-6 rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
