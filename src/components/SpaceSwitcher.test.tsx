import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SpaceSwitcher } from "./SpaceSwitcher";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useRouterState: () => "",
}));

// Radix Tooltip needs pointer/ResizeObserver polyfills in jsdom.
beforeEach(() => {
  navigateMock.mockReset();
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function renderSwitcher(opts?: { space?: "proveedor" | "chofer"; roles?: string[]; setSpace?: any }) {
  const setSpace = opts?.setSpace ?? vi.fn().mockResolvedValue(true);
  const utils = render(
    <SpaceSwitcher
      space={opts?.space ?? "proveedor"}
      setSpace={setSpace}
      roles={opts?.roles ?? ["proveedor"]}
    />,
  );
  return { ...utils, setSpace };
}

describe("SpaceSwitcher accessibility — disabled options", () => {
  it("marca la opción sin rol con aria-disabled='true' y disabled", () => {
    renderSwitcher({ roles: ["proveedor"] });
    const chofer = screen.getByRole("radio", { name: /no disponible/i });
    expect(chofer.getAttribute("aria-disabled")).toBe("true");
    expect((chofer as HTMLButtonElement).disabled).toBe(true);
  });

  it("excluye del orden de tabulación las opciones deshabilitadas (tabIndex = -1)", () => {
    renderSwitcher({ roles: ["proveedor"] });
    const chofer = screen.getByRole("radio", { name: /no disponible/i });
    const proveedor = screen.getByRole("radio", { name: /espacio activo/i });
    expect(chofer.getAttribute("tabindex")).toBe("-1");
    expect(proveedor.getAttribute("tabindex")).toBe("0");
  });


  it("click sobre opción deshabilitada no navega ni cambia el espacio", () => {
    const { setSpace } = renderSwitcher({ roles: ["proveedor"] });
    const chofer = screen.getByRole("radio", { name: /no disponible/i });
    fireEvent.click(chofer);
    expect(setSpace).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("las flechas del teclado saltan las opciones deshabilitadas", async () => {
    const setSpace = vi.fn().mockResolvedValue(true);
    renderSwitcher({ space: "proveedor", roles: ["proveedor"], setSpace });
    const group = screen.getByRole("radiogroup");
    await act(async () => {
      fireEvent.keyDown(group, { key: "ArrowRight" });
    });
    // solo "proveedor" está habilitado → no debe cambiar a "chofer"
    expect(setSpace).not.toHaveBeenCalledWith("chofer");
    expect(navigateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "/chofer" }),
    );
  });

  it("End/Home no aterrizan sobre opciones deshabilitadas", async () => {
    const setSpace = vi.fn().mockResolvedValue(true);
    renderSwitcher({ space: "proveedor", roles: ["proveedor"], setSpace });
    const group = screen.getByRole("radiogroup");
    await act(async () => {
      fireEvent.keyDown(group, { key: "End" });
    });
    expect(setSpace).not.toHaveBeenCalledWith("chofer");
  });

  it("cuando ambos roles están, las flechas sí navegan entre opciones habilitadas", async () => {
    const setSpace = vi.fn().mockResolvedValue(true);
    renderSwitcher({ space: "proveedor", roles: ["proveedor", "chofer"], setSpace });
    const group = screen.getByRole("radiogroup");
    await act(async () => {
      fireEvent.keyDown(group, { key: "ArrowRight" });
    });
    expect(setSpace).toHaveBeenCalledWith("chofer");
  });

  it("expone el motivo del bloqueo vía aria-label y contenido de tooltip accesible", async () => {
    renderSwitcher({ roles: ["proveedor"] });
    const chofer = screen.getByRole("radio", { name: /no disponible/i });
    expect(chofer.getAttribute("aria-label")).toMatch(
      /no disponible para tu cuenta/i,
    );

    // Radix Tooltip: hover/focus abre el content con role="tooltip".
    await act(async () => {
      fireEvent.focus(chofer);
      fireEvent.pointerEnter(chofer);
    });
    const tips = await screen.findAllByText(/Tu cuenta no tiene el rol/i);
    expect(tips.length).toBeGreaterThan(0);
  });
});
