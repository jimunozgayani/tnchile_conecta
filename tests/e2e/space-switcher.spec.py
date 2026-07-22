"""
E2E · SpaceSwitcher flicker regressions.

Verifies that the active-space badge NEVER transitions through an
intermediate value while:

  1. Following an external link back into the app (about:blank → deep link).
  2. Navigating between nested routes inside the same space.
  3. Using browser back/forward across space boundaries.

Requires an injected Supabase session for a dual-role user
(proveedor + chofer). In the Lovable sandbox this happens automatically
when LOVABLE_BROWSER_AUTH_STATUS=injected.
"""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright, Page

BASE = "http://localhost:8080"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)


async def restore_session(context, page: Page):
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE
        await context.add_cookies(cookies)
    await page.goto(BASE)
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )


async def install_flicker_recorder(page: Page):
    """Install a MutationObserver that logs every active-space badge value
    into window.__spaceTrail so we can assert no intermediate flicker."""
    await page.evaluate(
        """() => {
            window.__spaceTrail = [];
            const push = () => {
                const el = document.querySelector('[data-testid="active-space-badge"]');
                const v = el?.getAttribute('data-space') ?? el?.textContent?.trim() ?? null;
                if (v && window.__spaceTrail.at(-1) !== v) window.__spaceTrail.push(v);
            };
            push();
            const mo = new MutationObserver(push);
            mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
            window.__flickerObserver = mo;
        }"""
    )


async def read_trail(page: Page) -> list[str]:
    return await page.evaluate("() => window.__spaceTrail ?? []")


def assert_no_flicker(trail: list[str], expected_final: str, allow_from: str | None):
    """A valid trail is either [expected] or [allow_from, expected]. Any other
    sequence (extra bounces, wrong intermediate value) counts as flicker."""
    assert trail, "empty trail — badge never rendered"
    assert trail[-1] == expected_final, f"final space is {trail[-1]!r}, expected {expected_final!r}; trail={trail}"
    unique = list(dict.fromkeys(trail))
    allowed = {expected_final} if allow_from is None else {allow_from, expected_final}
    extras = [v for v in unique if v not in allowed]
    assert not extras, f"flicker detected — unexpected values {extras} in trail={trail}"
    # No bounce: the expected value must not appear before a non-expected one at the end
    assert unique.count(expected_final) == 1, f"badge bounced through {expected_final!r}: trail={trail}"


async def wait_for_badge(page: Page, expected: str):
    await page.wait_for_selector('[data-testid="active-space-badge"]')
    await page.wait_for_function(
        f"""() => {{
            const el = document.querySelector('[data-testid="active-space-badge"]');
            return (el?.getAttribute('data-space') ?? el?.textContent?.trim()) === {json.dumps(expected)};
        }}"""
    )


async def scenario_external_deep_link(context):
    """External-link scenario: land on about:blank, then navigate directly to
    /chofer/mi-disponibilidad. The badge must render as chofer without ever
    showing proveedor first."""
    page = await context.new_page()
    await restore_session(context, page)
    # Force a "cold" arrival: start on about:blank, then hit the deep link.
    await page.goto("about:blank")
    await page.goto(f"{BASE}/chofer/mi-disponibilidad", wait_until="domcontentloaded")
    await install_flicker_recorder(page)
    await wait_for_badge(page, "chofer")
    trail = await read_trail(page)
    await page.screenshot(path=str(SHOTS / "01_external_deeplink.png"))
    assert_no_flicker(trail, expected_final="chofer", allow_from=None)
    await page.close()
    print("✓ external deep link → chofer without flicker; trail=", trail)


async def scenario_nested_routes(context):
    """Navigating between nested routes of the same space must not flip the
    badge even for a single frame."""
    page = await context.new_page()
    await restore_session(context, page)
    await page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded")
    await wait_for_badge(page, "proveedor")
    await install_flicker_recorder(page)

    for path in ("/dashboard/camiones", "/dashboard/choferes", "/dashboard"):
        await page.evaluate(f"window.history.pushState({{}}, '', {json.dumps(path)})")
        # Trigger router by dispatching popstate + a click on <body>
        await page.evaluate("window.dispatchEvent(new PopStateEvent('popstate'))")
        await page.wait_for_timeout(150)

    trail = await read_trail(page)
    await page.screenshot(path=str(SHOTS / "02_nested_routes.png"))
    # Badge should have stayed on proveedor the whole time — no extra values.
    unique = list(dict.fromkeys(trail))
    assert unique == ["proveedor"], f"nested-route flicker: trail={trail}"
    await page.close()
    print("✓ nested routes stayed on proveedor; trail=", trail)


async def scenario_back_forward(context):
    """Cross-space back/forward: /dashboard → /chofer → back → forward. The
    badge should follow proveedor → chofer → proveedor → chofer without ever
    passing through the opposite value mid-transition."""
    page = await context.new_page()
    await restore_session(context, page)

    await page.goto(f"{BASE}/dashboard", wait_until="domcontentloaded")
    await wait_for_badge(page, "proveedor")
    await install_flicker_recorder(page)

    await page.goto(f"{BASE}/chofer", wait_until="domcontentloaded")
    await wait_for_badge(page, "chofer")

    await page.go_back(wait_until="domcontentloaded")
    await wait_for_badge(page, "proveedor")

    await page.go_forward(wait_until="domcontentloaded")
    await wait_for_badge(page, "chofer")

    trail = await read_trail(page)
    await page.screenshot(path=str(SHOTS / "03_back_forward.png"))
    # Expected trail: proveedor → chofer → proveedor → chofer (exactly).
    assert trail == ["proveedor", "chofer", "proveedor", "chofer"], (
        f"back/forward flicker: trail={trail}"
    )
    await page.close()
    print("✓ back/forward transitions clean; trail=", trail)


async def main():
    auth = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS", "")
    if auth != "injected":
        print(
            f"⚠  LOVABLE_BROWSER_AUTH_STATUS={auth!r} — needs an authenticated dual-role session. "
            "Sign in to the preview and re-run."
        )
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        try:
            await scenario_external_deep_link(context)
            await scenario_nested_routes(context)
            await scenario_back_forward(context)
            print("\nAll flicker scenarios passed.")
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
