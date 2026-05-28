import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, Users, FileText } from "lucide-react";
import logoFull from "@/assets/tn-chile-full.png";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-soft via-background to-primary-soft">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium hover:text-primary">Ingresar</Link>
            <Link to="/register" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
          <img src={logoFull} alt="TN Chile" className="mx-auto mb-6 h-24 w-auto" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-foreground">Portal de Proveedores</h1>
          <p className="mt-4 text-2xl font-medium text-primary">"La logística la hacemos juntos."</p>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
            Gestiona tu flota, choferes, tarifas y documentación en un solo lugar.
            Mantén tu información al día y trabaja con TN Chile de forma simple.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link to="/register" className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary-dark shadow-md">
              Crear cuenta de proveedor
            </Link>
            <Link to="/login" className="rounded-md border border-primary px-6 py-3 font-medium text-primary hover:bg-primary-soft">
              Ya tengo cuenta
            </Link>
          </div>
        </div>

        <div className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            { icon: Truck, title: "Camiones", desc: "Patentes, SOAP, revisión técnica y permisos al día." },
            { icon: Users, title: "Choferes", desc: "Licencias y carnets con alertas de vencimiento." },
            { icon: FileText, title: "Tarifas", desc: "Rutas entre las 16 capitales regionales de Chile." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border bg-card p-6 shadow-sm">
              <Icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t bg-card/60 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TN Chile · La logística la hacemos juntos.
      </footer>
    </div>
  );
}
