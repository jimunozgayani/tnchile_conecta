/**
 * End-to-end style integration test for the Space system.
 *
 * Renders a small harness that wires `useSpace` to the real `SpaceSwitcher`
 * and `SpaceChangeBanner` components, and exercises full user flows:
 *
 *   1. User clicks the switcher to change space
 *      → success toast fires
 *      → active space updates
 *      → user_preferences.upsert is called with the new space
 *
 *   2. Realtime `user_roles` change removes the active role
 *      → info toast fires
 *      → SpaceChangeBanner appears with kind="switched"
 *      → active space falls back to the remaining role
 *      → user_preferences.upsert is called with the fallback space
 *
 *   3. Realtime `user_roles` change removes ALL relevant roles
 *      → error toast fires
 *      → SpaceChangeBanner appears with kind="lost-all"
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";

// ---------- Mocks ----------

let mockPathname = "/dashboard";
let mockHash = "";
const navigateMock = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useRouterState: ({ select }: { select: (s: any) => any }) =>
    select({ location: { pathname: mockPathname, hash: mockHash } }),
}));

const toastInfo = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    info: (...a: any[]) => toastInfo(...a),
    error: (...a: any[]) => toastError(...a),
    success: (...a: any[]) => toastSuccess(...a),
  },
}));

type State = {
  userId: string | null;
  roles: string[];
  pref: string | null;
  channelHandlers: Array<(payload: any) => void>;
};

const state: State = {
  userId: "user-1",
  roles: ["proveedor", "chofer"],
  pref: "proveedor",
  channelHandlers: [],
};

const upsertSpy = vi.fn();
const auditInsertSpy = vi.fn();

function makeQuery(rows: any[]) {
  const chain: any = {
    _rows: rows,
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    insert: async (_row: any) => ({ data: null, error: null }),
    then: (res: any) => Promise.resolve({ data: rows, error: null }).then(res),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({
        data: { user: state.userId ? { id: state.userId } : null },
      }),
    },
    from: (table: string) => {
      if (table === "user_roles") {
        return makeQuery(state.roles.map((role) => ({ role })));
      }
      if (table === "user_preferences") {
        return {
          ...makeQuery(state.pref ? [{ active_space: state.pref }] : []),
          upsert: (row: any) => {
            upsertSpy(row);
            state.pref = row.active_space;
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      if (table === "space_audit_log") {
        return {
          ...makeQuery([]),
          insert: (row: any) => {
            auditInsertSpy(row);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return makeQuery([]);
    },
    channel: (_name: string) => {
      const ch: any = {
        on: (_evt: string, _filter: any, handler: (p: any) => void) => {
          state.channelHandlers.push(handler);
          return ch;
        },
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel: () => {},
  },
}));

// Radix Dialog / Tooltip in jsdom
if (!(globalThis as any).ResizeObserver) {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function resetState(overrides: Partial<State> = {}) {
  state.userId = overrides.userId ?? "user-1";
  state.roles = overrides.roles ?? ["proveedor", "chofer"];
  state.pref = overrides.pref ?? "proveedor";
  state.channelHandlers = [];
  upsertSpy.mockClear();
  auditInsertSpy.mockClear();
  navigateMock.mockClear();
  toastInfo.mockClear();
  toastError.mockClear();
  toastSuccess.mockClear();
  try { localStorage.clear(); } catch {}
}

// ---------- Harness ----------

async function importHarness() {
  const { useSpace } = await import("./useSpace");
  const { SpaceSwitcher } = await import("@/components/SpaceSwitcher");
  const { SpaceChangeBanner } = await import("@/components/SpaceChangeBanner");
  function Harness() {
    const { space, setSpace, roles, loaded, autoChange, dismissAutoChange } = useSpace();
    if (!loaded) return <div>loading…</div>;
    return (
      <div>
        <div data-testid="active-space">{space}</div>
        <SpaceChangeBanner change={autoChange} onDismiss={dismissAutoChange} />
        <SpaceSwitcher space={space} setSpace={setSpace} roles={roles} />
      </div>
    );
  }
  return { Harness };
}

async function mount() {
  const { Harness } = await importHarness();
  const utils = render(<Harness />);
  await waitFor(() => expect(utils.getByTestId("active-space")).toBeTruthy());
  return utils;
}

beforeEach(() => {
  vi.resetModules();
  mockPathname = "/dashboard";
  mockHash = "";
  resetState();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------- Tests ----------

describe("E2E · Space switching flow", () => {
  it("user clicks the switcher → success toast, active space updates, user_preferences persists", async () => {
    resetState({ roles: ["proveedor", "chofer"], pref: "proveedor" });
    const { getByTestId, getByRole } = await mount();
    expect(getByTestId("active-space").textContent).toBe("proveedor");

    const upsertsAfterMount = upsertSpy.mock.calls.length;

    const choferBtn = getByRole("radio", { name: /cambiar a espacio choferes/i });
    await act(async () => { fireEvent.click(choferBtn); });

    await waitFor(() => expect(getByTestId("active-space").textContent).toBe("chofer"));
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(String(toastSuccess.mock.calls[0][0])).toMatch(/Espacio Choferes/i);

    // At least one new upsert with the new active_space
    const newUpserts = upsertSpy.mock.calls.slice(upsertsAfterMount);
    expect(newUpserts.length).toBeGreaterThanOrEqual(1);
    expect(newUpserts.at(-1)?.[0]).toMatchObject({
      user_id: "user-1",
      active_space: "chofer",
    });

    // Router navigated to the new space
    expect(navigateMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "/chofer" }),
    );
  });

  it("realtime removes active role → info toast + banner (switched) + fallback persisted", async () => {
    resetState({ roles: ["proveedor", "chofer"], pref: "proveedor" });
    const { getByTestId, findByRole } = await mount();
    expect(getByTestId("active-space").textContent).toBe("proveedor");
    const upsertsAfterMount = upsertSpy.mock.calls.length;

    // Simulate DB losing the proveedor role and realtime firing
    state.roles = ["chofer"];
    await act(async () => {
      state.channelHandlers.forEach((h) => h({}));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(getByTestId("active-space").textContent).toBe("chofer"));

    // Info toast fired for the automatic switch
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(String(toastInfo.mock.calls[0][0])).toMatch(/cambiamos automáticamente/i);

    // Banner surfaced with the "switched" copy
    const banner = await findByRole("status");
    expect(banner.textContent ?? "").toMatch(/cambio de espacio automático/i);

    // Fallback space persisted
    const newUpserts = upsertSpy.mock.calls.slice(upsertsAfterMount);
    expect(newUpserts.at(-1)?.[0]).toMatchObject({
      user_id: "user-1",
      active_space: "chofer",
    });
    expect(state.pref).toBe("chofer");
  });

  it("realtime removes ALL relevant roles → error toast + banner (lost-all)", async () => {
    resetState({ roles: ["proveedor"], pref: "proveedor" });
    const { getByTestId, findByRole } = await mount();
    expect(getByTestId("active-space").textContent).toBe("proveedor");

    state.roles = []; // lost everything
    await act(async () => {
      state.channelHandlers.forEach((h) => h({}));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(String(toastError.mock.calls[0][0])).toMatch(/ya no tienes acceso/i);

    const banner = await findByRole("alert");
    expect(banner.textContent ?? "").toMatch(/sin acceso a espacios operativos/i);
  });

  it("realtime GAINS a new relevant role → banner (gained), active space unchanged, no toast", async () => {
    resetState({ roles: ["proveedor"], pref: "proveedor" });
    const { getByTestId, findByRole } = await mount();
    expect(getByTestId("active-space").textContent).toBe("proveedor");
    const toastCallsBefore =
      toastInfo.mock.calls.length + toastError.mock.calls.length + toastSuccess.mock.calls.length;

    state.roles = ["proveedor", "chofer"];
    await act(async () => {
      state.channelHandlers.forEach((h) => h({}));
      await Promise.resolve();
      await Promise.resolve();
    });

    // Space stays put; the banner announces the new role
    expect(getByTestId("active-space").textContent).toBe("proveedor");
    const banner = await findByRole("status");
    expect(banner.textContent ?? "").toMatch(/nuevo acceso disponible/i);

    // No toast on gained — banner-only surface
    const toastCallsAfter =
      toastInfo.mock.calls.length + toastError.mock.calls.length + toastSuccess.mock.calls.length;
    expect(toastCallsAfter).toBe(toastCallsBefore);
  });
});
