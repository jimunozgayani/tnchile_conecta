import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-docs-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { token?: string; operacion_id?: string };
        const { generarDocumentosSeguro } = await import("@/lib/documentos-operacion.server");
        const r = await generarDocumentosSeguro(String(body.operacion_id));
        return Response.json(r);
      },
    },
  },
});
