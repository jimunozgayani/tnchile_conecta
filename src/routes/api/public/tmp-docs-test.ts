import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-docs-test")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const path = new URL(request.url).searchParams.get("path") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.storage
          .from("documentos-operacion")
          .createSignedUrl(path, 600);
        return Response.json({ url: data?.signedUrl ?? null });
      },
    },
  },
});
