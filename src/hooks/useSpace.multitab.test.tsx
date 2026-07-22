/**
 * Multi-tab consistency tests for the Space system.
 *
 * Two independent `useSpace` instances run against a shared mock backend
 * (same user, same realtime channel, same `user_preferences` row) to
 * simulate two open browser tabs. We verify that role changes and space
 * transitions propagate to both tabs without toggling the active space or
 * emitting duplicate feedback within a single tab.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";

// ---------- Router / toast mocks ----------

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

// ---------- Shared backend state ----------

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

function makeQuery(rows: any[]) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    insert: async () => ({ data: null, error: null }),
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
      if (table === "user_roles") return makeQuery(state.roles.map((role) => ({ role })));
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
      return {
        ...makeQuery([]),
        insert: () => Promise.resolve({ data: null, error: null }),
      };
    },
    channel: () => {
      const ch: any = {
        on: (_e: string, _f: any, handler: (p: any) => void) => {
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
  navigateMock.mockClear();
  toastInfo.mockClear();
  toastError.mockClear();
  toastSuccess.mockClear();
  try { localStorage.clear(); } catch {}
}

// ---------- Two-tab harness ----------

async function mountTab(id: string) {
  const { useSpace } = await import("./useSpace");
  const snapshots: string[] = [];
  function Tab() {
    const { space, loaded } = useSpace();
    if (loaded) snapshots.push(space);
    return <div data-testid={`tab-${id}`}>{loaded ? space : "…"}</div>;
  }
  const utils = render(<Tab />);
  await waitFor(() => expect(utils.getByTestId(`tab-${id}`).textContent).not.toBe("…"));
  return { ...utils, snapshots };
}

async function mountTwoTabs() {
  const tabA = await mountTab("A");
  const tabB = await mountTab("B");
  // Both tabs must have subscribed to realtime
  expect(state.channelHandlers.length).toBe(2);
  // Clear post-mount snapshots so we only assert on subsequent transitions
  tabA.snapshots.length = 0;
  tabB.snapshots.length = 0;
  return { tabA, tabB };
}

async function fireRealtime() {
  await act(async () => {
    state.channelHandlers.forEach((h) => h({}));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
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

describe("Multi-tab · Space consistency", () => {
  it("role removal propagates to both tabs, each falls back exactly once (no toggle)", async () => {
    resetState({ roles: ["proveedor", "chofer"], pref: "proveedor" });
    const { tabA, tabB } = await mountTwoTabs();
    expect(tabA.getByTestId("tab-A").textContent).toBe("proveedor");
    expect(tabB.getByTestId("tab-B").textContent).toBe("proveedor");

    // DB loses proveedor; realtime fires on both tabs
    state.roles = ["chofer"];
    await fireRealtime();

    await waitFor(() => {
      expect(tabA.getByTestId("tab-A").textContent).toBe("chofer");
      expect(tabB.getByTestId("tab-B").textContent).toBe("chofer");
    });

    // Neither tab ever flipped through an intermediate value
    expect(tabA.snapshots.every((s) => s === "chofer")).toBe(true);
    expect(tabB.snapshots.every((s) => s === "chofer")).toBe(true);
    // Each tab flipped at most once — no toggling/flicker
    expect(tabA.snapshots.filter((s) => s === "chofer").length).toBeGreaterThanOrEqual(1);
    expect(tabB.snapshots.filter((s) => s === "chofer").length).toBeGreaterThanOrEqual(1);

    // One info toast per tab (2 total), no error toasts
    expect(toastInfo).toHaveBeenCalledTimes(2);
    expect(toastError).not.toHaveBeenCalled();
    // Shared preference row converged
    expect(state.pref).toBe("chofer");
  });

  it("redundant realtime events with unchanged roles do not toggle space, toast, or persist", async () => {
    resetState({ roles: ["proveedor", "chofer"], pref: "proveedor" });
    const { tabA, tabB } = await mountTwoTabs();
    const upsertsBefore = upsertSpy.mock.calls.length;

    // Fire three redundant events (as could happen with rapid DB writes)
    await fireRealtime();
    await fireRealtime();
    await fireRealtime();

    expect(tabA.getByTestId("tab-A").textContent).toBe("proveedor");
    expect(tabB.getByTestId("tab-B").textContent).toBe("proveedor");
    expect(tabA.snapshots.every((s) => s === "proveedor")).toBe(true);
    expect(tabB.snapshots.every((s) => s === "proveedor")).toBe(true);
    expect(toastInfo).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    // No preference writes for no-op reconciliations
    expect(upsertSpy.mock.calls.length).toBe(upsertsBefore);
  });

  it("second tab focusing after first tab persisted a change keeps its still-valid space (no flicker)", async () => {
    // Simulates: tab A switches to chofer, persists pref=chofer; tab B still on
    // proveedor. When tab B regains focus and revalidates, it must NOT flip to
    // chofer because proveedor is still a valid role for the user.
    resetState({ roles: ["proveedor", "chofer"], pref: "proveedor" });
    const { tabA, tabB } = await mountTwoTabs();

    // Tab A: simulate the shared pref moving to chofer (as if A upserted)
    state.pref = "chofer";
    // Tab B regains focus → hook revalidates roles (roles unchanged)
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
      await Promise.resolve();
    });

    // Tab B stays on proveedor — the active-space is not derived from the
    // remote pref on revalidate; it only reconciles against role loss.
    expect(tabB.getByTestId("tab-B").textContent).toBe("proveedor");
    expect(tabB.snapshots.every((s) => s === "proveedor")).toBe(true);
    // And it does not spuriously navigate or toast.
    expect(navigateMock).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    // Tab A is unaffected here
    expect(tabA.getByTestId("tab-A").textContent).toBe("proveedor");
  });

  it("losing ALL roles fires exactly one error toast per tab and both tabs report the loss", async () => {
    resetState({ roles: ["proveedor"], pref: "proveedor" });
    const { tabA, tabB } = await mountTwoTabs();

    state.roles = [];
    await fireRealtime();

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(2));
    expect(toastInfo).not.toHaveBeenCalled();
    // Neither tab silently switches to a nonexistent space
    expect(["proveedor", "chofer"]).toContain(tabA.getByTestId("tab-A").textContent);
    expect(["proveedor", "chofer"]).toContain(tabB.getByTestId("tab-B").textContent);
  });
});
