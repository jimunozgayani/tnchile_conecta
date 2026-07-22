import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/register-chofer")({
  head: () => pageHead(
    "/register-chofer",
    "Acceso solo por invitación · Choferes TN Chile",
    "El acceso de choferes al portal TN Chile es únicamente por invitación de tu proveedor o de TN Chile.",
  ),
  component: RegisterChoferPage,
});

function RegisterChoferPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft to-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-lg">
        <div className="mb-6 flex justify-center">
          <Logo variant="full" className="h-20 w-auto" />
        </div>
        <h1 className="text-2xl font-bold text-primary-dark">Acceso solo por invitación</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          El acceso de choferes es solo por invitación de tu proveedor o de TN Chile.
          Si no tienes un link de invitación, contacta a tu empresa transportista.
        </p>
        <p className="mt-2 text-xs italic text-primary-dark">
          La logística la hacemos juntos.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/login"
            className="rounded-md bg-primary px-6 py-2.5 font-medium text-primary-foreground hover:bg-primary-dark"
          >
            Ya tengo cuenta, iniciar sesión
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
