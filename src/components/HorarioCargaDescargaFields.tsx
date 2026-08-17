/**
 * Ventanas horarias de carga y descarga de una cotización.
 * Se comparte entre la creación ("Nueva cotización"), la edición de la ficha
 * y la edición rápida del operador durante la exploración.
 */
export type HorarioValues = {
  carga_hora_desde: string;
  carga_hora_hasta: string;
  descarga_fecha: string;
  descarga_hora_desde: string;
  descarga_hora_hasta: string;
  descarga_notas: string;
};

export const horarioVacio: HorarioValues = {
  carga_hora_desde: "",
  carga_hora_hasta: "",
  descarga_fecha: "",
  descarga_hora_desde: "",
  descarga_hora_hasta: "",
  descarga_notas: "",
};

/** Postgres devuelve time como "HH:MM:SS"; el input[type=time] usa "HH:MM". */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

const inputCls = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const labelCls = "mb-1 block text-xs font-medium";

export function HorarioCargaDescargaFields({
  value,
  onChange,
  idPrefix,
  className = "",
}: {
  value: HorarioValues;
  onChange: (patch: Partial<HorarioValues>) => void;
  idPrefix: string;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="mb-2 text-sm font-semibold">Horario de carga</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls} htmlFor={`${idPrefix}-carga-desde`}>Hora desde</label>
            <input
              id={`${idPrefix}-carga-desde`}
              type="time"
              value={value.carga_hora_desde}
              onChange={(e) => onChange({ carga_hora_desde: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor={`${idPrefix}-carga-hasta`}>Hora hasta</label>
            <input
              id={`${idPrefix}-carga-hasta`}
              type="time"
              value={value.carga_hora_hasta}
              onChange={(e) => onChange({ carga_hora_hasta: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          La fecha de carga es la fecha de despacho de la cotización.
        </p>
      </div>

      <div className="rounded-md border bg-muted/30 p-3">
        <p className="mb-2 text-sm font-semibold">Horario de descarga</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor={`${idPrefix}-descarga-fecha`}>Fecha</label>
            <input
              id={`${idPrefix}-descarga-fecha`}
              type="date"
              value={value.descarga_fecha}
              onChange={(e) => onChange({ descarga_fecha: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor={`${idPrefix}-descarga-desde`}>Hora desde</label>
            <input
              id={`${idPrefix}-descarga-desde`}
              type="time"
              value={value.descarga_hora_desde}
              onChange={(e) => onChange({ descarga_hora_desde: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor={`${idPrefix}-descarga-hasta`}>Hora hasta</label>
            <input
              id={`${idPrefix}-descarga-hasta`}
              type="time"
              value={value.descarga_hora_hasta}
              onChange={(e) => onChange({ descarga_hora_hasta: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
        <div className="mt-2">
          <label className={labelCls} htmlFor={`${idPrefix}-descarga-notas`}>
            Notas de descarga (opcional)
          </label>
          <textarea
            id={`${idPrefix}-descarga-notas`}
            rows={2}
            value={value.descarga_notas}
            onChange={(e) => onChange({ descarga_notas: e.target.value })}
            placeholder="Ej: destino solo recibe en horario hábil, puede ser el día siguiente"
            className={inputCls}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          La descarga puede ser el mismo día o días posteriores a la carga.
        </p>
      </div>
    </div>
  );
}
