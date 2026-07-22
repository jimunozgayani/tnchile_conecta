import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SpaceChangeBanner } from "./SpaceChangeBanner";
import type { SpaceAutoChange } from "@/hooks/useSpace";

function make(change: Partial<SpaceAutoChange> & Pick<SpaceAutoChange, "kind">): SpaceAutoChange {
  return {
    from: null,
    to: null,
    addedRoles: [],
    removedRoles: [],
    at: Date.now(),
    ...change,
  } as SpaceAutoChange;
}

describe("SpaceChangeBanner", () => {
  it("no renderiza nada cuando change es null", () => {
    const { container } = render(<SpaceChangeBanner change={null} onDismiss={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("switched: muestra headline de cambio de vista con role=status", () => {
    render(
      <SpaceChangeBanner
        change={make({
          kind: "switched",
          from: "proveedor",
          to: "chofer",
          removedRoles: ["proveedor"],
        })}
        onDismiss={() => {}}
      />
    );
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/Cambiamos tu vista a Espacio Choferes/i);
    expect(banner).toHaveTextContent(/Ya no tienes acceso a Portal Proveedor/i);
  });

  it("gained: muestra headline de nuevos roles con role=status", () => {
    render(
      <SpaceChangeBanner
        change={make({
          kind: "gained",
          from: "proveedor",
          to: "proveedor",
          addedRoles: ["chofer"],
        })}
        onDismiss={() => {}}
      />
    );
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/Se actualizaron los roles/i);
    expect(banner).toHaveTextContent(/nuevos espacios/i);
  });

  it("lost-all: muestra alerta con role=alert y aria-live assertive", () => {
    render(
      <SpaceChangeBanner
        change={make({
          kind: "lost-all",
          from: "proveedor",
          to: null,
          removedRoles: ["proveedor", "chofer"],
        })}
        onDismiss={() => {}}
      />
    );
    const banner = screen.getByRole("alert");
    expect(banner).toHaveAttribute("aria-live", "assertive");
    expect(banner).toHaveTextContent(/Perdiste el acceso/i);
  });

  it("Ver detalles abre el diálogo con los roles agregados y removidos", () => {
    render(
      <SpaceChangeBanner
        change={make({
          kind: "switched",
          from: "proveedor",
          to: "chofer",
          addedRoles: ["chofer"],
          removedRoles: ["proveedor"],
        })}
        onDismiss={() => {}}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /ver detalles/i }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/¿Qué cambió en tu cuenta\?/i)).toBeTruthy();
    expect(within(dialog).getByText(/Portal Proveedor → Espacio Choferes/i)).toBeTruthy();
    expect(within(dialog).getByText(/Roles removidos/i)).toBeTruthy();
    expect(within(dialog).getByText(/Roles agregados/i)).toBeTruthy();
  });

  it("Cerrar del banner llama a onDismiss sin abrir el diálogo", () => {
    const onDismiss = vi.fn();
    render(
      <SpaceChangeBanner
        change={make({ kind: "switched", from: "proveedor", to: "chofer" })}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cerrar aviso/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Entendido en el diálogo lo cierra y llama a onDismiss", async () => {
    const onDismiss = vi.fn();
    render(
      <SpaceChangeBanner
        change={make({ kind: "gained", from: "proveedor", to: "proveedor", addedRoles: ["chofer"] })}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /ver detalles/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /entendido/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    // Radix removes the dialog from the tree on close
    await screen.findByRole("status"); // banner still there
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
