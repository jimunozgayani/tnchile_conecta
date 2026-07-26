## Objetivo

Dejar **un solo espacio de disponibilidad** en Operaciones: calendario mensual + panel del día + mapa al final, todo en la misma página y con el mapa reflejando exactamente lo que muestra la lista (mismo día, mismos filtros, misma selección).

## Estado actual (verificado)

- `/operaciones-disponibilidad-semana` = calendario mensual + panel del día editable (`MonthCalendar` + `DayDetailPanel`).
- `/operaciones-disponibilidad-mapa` = página aparte, con su propio selector de día y sus propios filtros (estado, modalidad, proveedor), su propia consulta a `disponibilidad_chofer` y su propio mapa Leaflet.
- Enlaces que apuntan a las rutas: dos tarjetas en `/operaciones` y un redirect de admin en `_app.mi-disponibilidad.tsx`.
- El panel del día ya trae los datos de cada chofer, pero su consulta **solo pide `nombre` de ciudad**, no `lat`/`lng`, así que hoy no alcanza para dibujar pines.

## Qué se hará

1. **Una sola ruta**
   - La página unificada queda en `/operaciones-disponibilidad` (nombre limpio, sin "semana" ni "mapa").
   - `/operaciones-disponibilidad-semana` y `/operaciones-disponibilidad-mapa` pasan a redirigir a la nueva ruta, para no romper enlaces guardados.
   - En `/operaciones` queda **una sola tarjeta**: "Disponibilidad". Se actualiza también el redirect de admin en `mi-disponibilidad`.

2. **Datos compartidos**
   - Se agregan `lat`/`lng` de lugar y destino a la consulta del día (`useDayRows`), para que lista y mapa se alimenten de la **misma** consulta. No hay una segunda consulta ni un segundo selector de fecha.

3. **Mapa al final, sincronizado**
   - El mapa se mueve al final de la página, bajo el panel del día.
   - Muestra pines solo de los choferes **visibles en la lista** en ese momento: mismo día seleccionado en el calendario y mismos filtros aplicados (búsqueda por nombre/proveedor y chips de tipo de camión). Si se filtra por "Rampla Plana", el mapa queda con esos pines.
   - Color del pin por estado (verde disponible / rojo no disponible); los "sin confirmar" no se dibujan. Línea punteada origen → destino cuando hay destino.
   - Los filtros de estado, modalidad y proveedor que hoy vivían solo en la página del mapa se suman a la barra de filtros de la lista, para que ambos los compartan.

4. **Selección cruzada**
   - Al hacer clic en una fila de la lista, el mapa centra y abre el popup de ese chofer; la fila queda resaltada.
   - Al hacer clic en un pin, se resalta la fila correspondiente y se hace scroll hasta ella.
   - Debajo del mapa: lista compacta "Sin ubicación en el mapa (N)" con los choferes visibles que no tienen ciudad con coordenadas.

5. **Formulario "Agregar chofer ocasional"** se mantiene tal cual, sobre el mapa.

## Detalles técnicos

- Nuevo archivo `src/routes/_app.operaciones-disponibilidad.tsx` con el contenido de la página actual del calendario, más una sección de mapa al final.
- Los filtros (texto, chips de tipo, estado, modalidad, proveedor) suben desde `DayDetailPanel` al contenedor de la página, que calcula `visibleRows` y lo pasa tanto a la lista como al mapa — una sola fuente de verdad, sin duplicar la lógica de filtrado.
- Nuevo componente `src/components/DisponibilidadMap.tsx`: recibe `rows`, `selectedDriverId` y `onSelectDriver`; reutiliza `pinIcon`, `MapAutoFit`, `MapContainer`/`TileLayer`/`Marker`/`Polyline` del archivo del mapa actual.
- Leaflet sigue montándose solo en cliente (la ruta ya usa `ssr: false` y `beforeLoad: requireAdmin`).
- Las rutas viejas quedan como archivos mínimos con `beforeLoad` que hace `redirect` a la nueva ruta.
- Sin cambios de base de datos.
