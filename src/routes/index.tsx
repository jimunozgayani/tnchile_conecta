import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, Building2, HardHat, ShieldCheck } from "lucide-react";
import logoFull from "@/assets/tn-chile-full.png";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  component: Landing,
});

const PORTALS = [
  {
    icon: Truck,
    title: "Proveedores",
    desc: "Flota, choferes, tarifas y documentos.",
    cta: "Acceder",
    to: "/login" as const,
    secondary: { label: "Solo por invitación", to: "/register" as const },
  },
  {
    icon: Building2,
    title: "Clientes",
    desc: "Solicita cotizaciones y coordina tus envíos.",
    cta: "Ingresar",
    to: "/login" as const,
    secondary: { label: "Crear cuenta", to: "/register-cliente" as const },
  },
  {
    icon: HardHat,
    title: "Choferes",
    desc: "Consulta tus asignaciones y cargas del día.",
    cta: "Ingresar",
    to: "/login" as const,
    secondary: { label: "Crear cuenta", to: "/register-chofer" as const },
  },
  {
    icon: ShieldCheck,
    title: "Equipo TN Chile",
    desc: "Administración y operaciones internas.",
    cta: "Ingresar",
    to: "/login" as const,
    secondary: null,
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-soft via-background to-primary-soft">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <Link to="/login" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <img src={logoFull} alt="TN Chile" className="mx-auto mb-6 h-24 w-auto" />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">TN Chile</h1>
          <p className="mt-4 text-xl md:text-2xl font-medium text-primary">"La logística la hacemos juntos."</p>
          <p className="mt-6 max-w-2xl mx-auto text-base md:text-lg text-muted-foreground">
            Elige tu portal para continuar.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PORTALS.map(({ icon: Icon, title, desc, cta, to, secondary }) => (
            <div key={title} className="flex flex-col rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-soft">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{desc}</p>
              <Link to={to} className="mt-4 rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary-dark">
                {cta}
              </Link>
              {secondary && (
                <Link to={secondary.to} className="mt-2 text-center text-xs text-primary hover:underline">
                  {secondary.label}
                </Link>
              )}
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
