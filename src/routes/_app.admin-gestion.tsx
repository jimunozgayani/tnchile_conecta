import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, RotateCcw, Search, ShieldAlert, Trash2, UserCog } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { requireAdmin } from "@/lib/require-admin";
import { SkeletonRows } from "@/components/SkeletonBlocks";
import { ENTIDAD_LABEL, type AdminEntidad, type AdminFila } from "@/lib/admin-super";
import {
  listarAdminEntidad,
  eliminarAdminEntidad,
  restaurarAdminEntidad,
  reasignarCarga,
  reasignarOperacion,
  listarStaffAsignable,
} from "@/lib/admin-super.functions";

export const Route = createFileRoute("/_app/admin-gestion")({
  head: () =>
    pageHead(
      "/admin-gestion",
      "Gestión total · TN Chile Conecta",
      "Panel de administración plenipotenciaria: elimina, restaura y reasigna usuarios, proveedores, clientes, choferes, cargas y operaciones.",
    ),
  ssr: false,
  beforeLoad: requireAdmin,
  component: AdminGestionPage,
});

const TABS: AdminEntidad[] = ["usuario", "proveedor", "cliente", "chofer", "carga", "operacion"];

function AdminGestionPage() {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<AdminEntidad>("usuario");
  const [q, setQ] = useState("");
  const [incluirEliminados, setIncluirEliminados] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const listar = useServerFn(listarAdminEntidad);
  const eliminar = useServerFn(eliminarAdminEntidad);
  const restaurar = useServerFn(restaurarAdminEntidad);
  const reCarga = useServerFn(reasignarCarga);
  const reOperacion = useServerFn(reasignarOperacion);
  const staffFn = useServerFn(listarStaffAsignable);

  const { data: filas, isLoading } = useQuery({
    queryKey: ["admin-gestion", tipo, incluirEliminados],
    queryFn: () => listar({ data: { tipo, incluirEliminados } }),
  });

  const { data: staff } = useQuery({ queryKey: ["admin-staff"], queryFn: () => staffFn({}) });

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return filas ?? [];
    return (filas ?? []).filter((f) =>
      [f.titulo, f.subtitulo, f.detalle].some((v) => (v ?? "").toLowerCase().includes(needle)),
    );
  }, [filas, q]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["admin-gestion"] });
  }

  async function borrar(fila: AdminFila, modo: "logico" | "definitivo") {
    const aviso =
      modo === "definitivo"
        ? `Vas a BORRAR DEFINITIVAMENTE "${fila.titulo}". Esta acción no se puede deshacer. ¿Continuar?`
        : `¿Eliminar "${fila.titulo}"? Quedará oculto en toda la app y podrás restaurarlo.`;
    if (!confirm(aviso)) return;
    setBusy(fila.id);
    try {
      const r = await eliminar({ data: { tipo, id: fila.id, modo } });
      toast.success(r.mensaje);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setBusy(null);
    }
  }

  async function reactivar(fila: AdminFila) {
    setBusy(fila.id);
    try {
      const r = await restaurar({ data: { tipo, id: fila.id } });
      toast.success(r.mensaje);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo restaurar.");
    } finally {
      setBusy(null);
    }
  }

  async function reasignar(fila: AdminFila, userId: string) {
    setBusy(fila.id);
    try {
      if (tipo === "carga") {
        await reCarga({ data: { cotizacion_id: fila.id, user_id: userId || null } });
      } else {
        if (!userId) return;
        await reOperacion({ data: { operacion_id: fila.id, user_id: userId } });
      }
      toast.success("Reasignado correctamente.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reasignar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <ShieldAlert className="h-6 w-6 text-primary" />
          Gestión total
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control absoluto de administración: eliminar, restaurar y reasignar cualquier registro.
          Todas las acciones quedan registradas en auditoría.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tipo === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-primary-soft hover:text-primary-dark"
            }`}
          >
            {ENTIDAD_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={incluirEliminados}
            onChange={(e) => setIncluirEliminados(e.target.checked)}
          />
          Mostrar eliminados
        </label>
      </div>

      {tipo === "usuario" && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Desactivar una cuenta revoca todos sus roles y le quita el acceso. El borrado definitivo
            elimina la cuenta de autenticación y no se puede deshacer. Los roles se administran en{" "}
            <strong>Usuarios y roles</strong>.
          </span>
        </div>
      )}

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : visibles.length === 0 ? (
        <p className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Sin registros.
        </p>
      ) : (
        <ul className="space-y-2">
          {visibles.map((fila) => (
            <li
              key={fila.id}
              className={`rounded-lg border p-3 ${
                fila.eliminado ? "border-dashed border-destructive/40 bg-destructive/5" : "border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {fila.titulo}
                    {fila.eliminado && (
                      <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        eliminado
                      </span>
                    )}
                  </p>
                  {fila.subtitulo && (
                    <p className="truncate text-xs text-muted-foreground">{fila.subtitulo}</p>
                  )}
                  {fila.detalle && (
                    <p className="truncate text-[11px] text-muted-foreground/80">{fila.detalle}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(tipo === "carga" || tipo === "operacion") && !fila.eliminado && (
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <UserCog className="h-3.5 w-3.5" />
                      <select
                        defaultValue={(fila.extra["asignado_a"] as string) ?? ""}
                        onChange={(e) => void reasignar(fila, e.target.value)}
                        disabled={busy === fila.id}
                        className="rounded-md border border-input bg-background px-2 py-1 text-[11px]"
                      >
                        <option value="">
                          {tipo === "carga" ? "Sin responsable" : "Reasignar a…"}
                        </option>
                        {(staff ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.email}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {fila.eliminado ? (
                    <button
                      onClick={() => void reactivar(fila)}
                      disabled={busy === fila.id}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                    </button>
                  ) : (
                    <button
                      onClick={() => void borrar(fila, "logico")}
                      disabled={busy === fila.id}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {tipo === "usuario" ? "Desactivar" : "Eliminar"}
                    </button>
                  )}

                  <button
                    onClick={() => void borrar(fila, "definitivo")}
                    disabled={busy === fila.id}
                    className="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Borrar definitivo
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
