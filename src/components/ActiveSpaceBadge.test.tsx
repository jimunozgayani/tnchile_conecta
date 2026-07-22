import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { ActiveSpaceBadge } from "./ActiveSpaceBadge";

beforeEach(() => {
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe("ActiveSpaceBadge — accessibility", () => {
  it("expone role='status' con aria-live='polite' para lectores de pantalla", () => {
    render(<ActiveSpaceBadge view="proveedor" />);
    const badge = screen.getByTestId("active-space-badge");
    expect(badge.getAttribute("role")).toBe("status");
    expect(badge.getAttribute("aria-live")).toBe("polite");
  });

  it("aria-label describe el espacio activo con etiqueta completa", () => {
    render(<ActiveSpaceBadge view="chofer" />);
    const badge = screen.getByTestId("active-space-badge");
    expect(badge.getAttribute("aria-label")).toBe("Espacio activo: Espacio Choferes");
    expect(badge.textContent).toBe("Espacio Choferes");
  });

  it.each([
    ["admin", "Administración"],
    ["cliente", "Portal Cliente"],
    ["chofer", "Espacio Choferes"],
    ["proveedor", "Portal Proveedor"],
  ] as const)("renderiza etiqueta correcta para view=%s", (view, expected) => {
    render(<ActiveSpaceBadge view={view} />);
    expect(screen.getByTestId("active-space-badge").textContent).toBe(expected);
  });

  it("es alcanzable por teclado (tabIndex=0) y muestra tooltip accesible al enfocar", async () => {
    render(<ActiveSpaceBadge view="proveedor" canSwitch />);
    const badge = screen.getByTestId("active-space-badge");
    expect(badge.getAttribute("tabindex")).toBe("0");
    await act(async () => {
      fireEvent.focus(badge);
      fireEvent.pointerEnter(badge);
    });
    const tips = await screen.findAllByText(/Usa el selector para cambiar sin cerrar sesión/i);
    expect(tips.length).toBeGreaterThan(0);
  });

  it("aria-label refleja el cambio de espacio activo al re-renderizar (evita quedarse desactualizado)", () => {
    const { rerender } = render(<ActiveSpaceBadge view="proveedor" />);
    expect(screen.getByTestId("active-space-badge").getAttribute("aria-label")).toBe(
      "Espacio activo: Portal Proveedor",
    );
    rerender(<ActiveSpaceBadge view="chofer" />);
    expect(screen.getByTestId("active-space-badge").getAttribute("aria-label")).toBe(
      "Espacio activo: Espacio Choferes",
    );
  });
});
