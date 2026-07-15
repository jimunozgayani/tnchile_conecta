import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, MapPin } from "lucide-react";

export type Ciudad = { id: string; nombre: string; region: string };

type Props = {
  value: string | null;
  freeText: string | null;
  onChange: (ciudadId: string | null, freeText: string | null) => void;
  placeholder?: string;
};

/** Autocomplete over public.ciudades_chile with free-text fallback. */
export function CityCombobox({ value, freeText, onChange, placeholder }: Props) {
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [useFree, setUseFree] = useState(!!freeText && !value);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ciudades_chile").select("id, nombre, region").order("nombre");
      setCiudades(data ?? []);
    })();
  }, []);

  const selected = useMemo(() => ciudades.find((c) => c.id === value) || null, [ciudades, value]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ciudades.slice(0, 30);
    return ciudades.filter((c) =>
      c.nombre.toLowerCase().includes(s) || c.region.toLowerCase().includes(s)
    ).slice(0, 30);
  }, [q, ciudades]);

  if (useFree) {
    return (
      <div className="space-y-1">
        <input
          type="text"
          value={freeText ?? ""}
          onChange={(e) => onChange(null, e.target.value || null)}
          placeholder="Escribe ciudad o lugar…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between text-[11px] text-amber-700">
          <span>⚠ Este lugar no se podrá ubicar en el mapa.</span>
          <button type="button" className="underline" onClick={() => { setUseFree(false); onChange(null, null); }}>
            Buscar en lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={open ? q : selected ? `${selected.nombre}` : q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { setQ(""); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder ?? "Buscar ciudad…"}
          className="flex-1 bg-transparent py-2 text-sm outline-none"
        />
        {selected && (
          <button type="button" className="text-xs text-muted-foreground" onClick={() => onChange(null, null)}>
            ×
          </button>
        )}
      </div>
      {selected && !open && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" /> {selected.region}
        </p>
      )}
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {filtered.map((c) => (
            <button
              type="button"
              key={c.id}
              onMouseDown={() => { onChange(c.id, null); setOpen(false); setQ(""); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span>{c.nombre}</span>
              <span className="text-xs text-muted-foreground">{c.region}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              Sin resultados.
            </div>
          )}
          <button
            type="button"
            onMouseDown={() => { setUseFree(true); setOpen(false); onChange(null, ""); }}
            className="w-full border-t px-3 py-2 text-left text-xs font-medium text-primary hover:bg-accent"
          >
            + No está en la lista, escribir manualmente
          </button>
        </div>
      )}
    </div>
  );
}
