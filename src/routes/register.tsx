import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft to-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <Logo variant="full" className="h-20 w-auto" />
        </div>
        <h1 className="text-center text-2xl font-bold text-primary-dark">
          Acceso solo por invitación
        </h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          El Portal de Proveedores TN Chile es por invitación. Si necesitas
          una cuenta, contacta a nuestro equipo y te enviaremos una
          invitación por correo.
        </p>

        <a
          href="mailto:contacto@tnchile.cl?subject=Solicitud%20de%20acceso%20Portal%20Proveedores"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-dark"
        >
          <Mail className="h-4 w-4" />
          contacto@tnchile.cl
        </a>

        <p className="mt-6 text-center text-sm">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
