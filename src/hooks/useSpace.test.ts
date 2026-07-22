import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---------- Mocks ----------

let mockPathname = "/dashboard";
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: any) => any }) =>
    select({ location: { pathname: mockPathname } }),
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

// Configurable state for the mocked supabase client
type State = {
  userId: string | null;
  roles: string[];
  pref: string | null;
  channelHandlers: Array<(payload: any) => void>;
};

const state: State = {
  userId: "user-1",
  roles: ["proveedor"],
  pref: null,
  channelHandlers: [],
};

const upsertSpy = vi.fn();

function makeQuery(rows: any[]) {
  const chain: any = {
    _rows: rows,
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
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

// ---------- Helpers ----------

function resetState(overrides: Partial<State> = {}) {
  state.userId = overrides.userId ?? "user-1";
  state.roles = overrides.roles ?? ["proveedor"];
  state.pref = overrides.pref ?? null;
  state.channelHandlers = [];
  upsertSpy.mockClear();
  toastInfo.mockClear();
  toastError.mockClear();
  toastSuccess.mockClear();
  try {
    localStorage.clear();
  } catch {}
}

async function loadHook() {
  const { useSpace } = await import("./useSpace");
  const res = renderHook(() => useSpace());
  await waitFor(() => expect(res.result.current.loaded).toBe(true));
  return res;
}

beforeEach(() => {
  vi.resetModules();
  mockPathname = "/";
  resetState();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------- Tests ----------

describe("useSpace — mount reconciliation", () => {
  it("initial space is the user's only role when they have just one", async () => {
    resetState({ roles: ["chofer"] });
    const { result } = await loadHook();
    expect(result.current.space).toBe("chofer");
    expect(result.current.canSwitch).toBe(false);
  });

  it("honors a valid saved preference for dual-role users", async () => {
    resetState({ roles: ["proveedor", "chofer"], pref: "chofer" });
    const { result } = await loadHook();
    expect(result.current.space).toBe("chofer");
    expect(result.current.canSwitch).toBe(true);
  });

  it("falls back to an available role when the saved preference is invalid", async () => {
    resetState({ roles: ["proveedor"], pref: "chofer" });
    const { result } = await loadHook();
    expect(result.current.space).toBe("proveedor");
  });

  it("prefers a /chofer deep-link route hint on initial load for dual-role users", async () => {
    resetState({ roles: ["proveedor", "chofer"], pref: "proveedor" });
    mockPathname = "/chofer/mis-viajes";
    const { result } = await loadHook();
    expect(result.current.space).toBe("chofer");
  });
});

describe("useSpace — realtime role changes", () => {
  it("switches automatically when the active role is removed and surfaces autoChange", async () => {
    resetState({ roles: ["proveedor", "chofer"], pref: "proveedor" });
    const { result } = await loadHook();
    expect(result.current.space).toBe("proveedor");

    // Simulate the DB losing the proveedor role and the realtime event firing
    state.roles = ["chofer"];
    await act(async () => {
      state.channelHandlers.forEach((h) => h({}));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.space).toBe("chofer"));
    expect(result.current.autoChange?.kind).toBe("switched");
    expect(result.current.autoChange?.from).toBe("proveedor");
    expect(result.current.autoChange?.to).toBe("chofer");
    expect(result.current.autoChange?.removedRoles).toContain("proveedor");
    expect(toastInfo).toHaveBeenCalled();
  });

  it("keeps the current space and reports 'gained' when a new role is added", async () => {
    resetState({ roles: ["proveedor"], pref: "proveedor" });
    const { result } = await loadHook();

    state.roles = ["proveedor", "chofer"];
    await act(async () => {
      state.channelHandlers.forEach((h) => h({}));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.canSwitch).toBe(true));
    expect(result.current.space).toBe("proveedor");
    expect(result.current.autoChange?.kind).toBe("gained");
    expect(result.current.autoChange?.addedRoles).toContain("chofer");
  });

  it("reports 'lost-all' and shows an error toast when every relevant role is removed", async () => {
    resetState({ roles: ["proveedor"], pref: "proveedor" });
    const { result } = await loadHook();

    state.roles = [];
    await act(async () => {
      state.channelHandlers.forEach((h) => h({}));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.autoChange?.kind).toBe("lost-all"));
    expect(toastError).toHaveBeenCalled();
  });
});

describe("useSpace — setSpace validation", () => {
  it("rejects a switch to a space the user no longer has and does not persist it", async () => {
    resetState({ roles: ["proveedor", "chofer"], pref: "proveedor" });
    const { result } = await loadHook();
    upsertSpy.mockClear();

    // DB now only has proveedor; user tries to switch to chofer
    state.roles = ["proveedor"];

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setSpace("chofer");
    });

    expect(ok).toBe(false);
    expect(result.current.space).toBe("proveedor");
    expect(toastError).toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ active_space: "chofer" }),
    );
  });

  it("persists a valid space change to user_preferences", async () => {
    resetState({ roles: ["proveedor", "chofer"], pref: "proveedor" });
    const { result } = await loadHook();
    upsertSpy.mockClear();

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.setSpace("chofer");
    });

    expect(ok).toBe(true);
    expect(result.current.space).toBe("chofer");
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", active_space: "chofer" }),
    );
  });
});
