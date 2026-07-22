# E2E · SpaceSwitcher (Playwright)

Estas pruebas verifican que el `SpaceSwitcher` **no parpadee** (no muestre un
espacio intermedio) al navegar entre pestañas del navegador con enlaces
externos, rutas anidadas y navegación *back/forward*.

## Requisitos

- App corriendo en `http://localhost:8080`.
- Usuario autenticado con roles `proveedor` **y** `chofer` (dual-rol).
  En el sandbox de Lovable esto se inyecta automáticamente cuando
  `LOVABLE_BROWSER_AUTH_STATUS=injected`; el script `space-switcher.spec.py`
  restaura la sesión antes de navegar.

## Cómo se detecta el parpadeo

El script observa el `data-testid="active-space-badge"` (renderizado por
`ActiveSpaceBadge`) y toma un snapshot en cada `MutationObserver` durante
cada transición. Un test falla si el badge pasa por un valor distinto al
esperado o si "vuelve" al valor anterior en medio de una navegación.

## Ejecución

```bash
python3 tests/e2e/space-switcher.spec.py
```

Los screenshots se guardan en `tests/e2e/screenshots/`.
