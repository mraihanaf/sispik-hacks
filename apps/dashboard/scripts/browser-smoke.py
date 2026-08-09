"""Authenticated browser smoke test for the operations workflow.

Requires DASHBOARD_SESSION_TOKEN from a local Better Auth session.
"""
import os
import base64
import hashlib
import hmac
from playwright.sync_api import sync_playwright


def main():
    token = os.environ["DASHBOARD_SESSION_TOKEN"]
    signature = base64.b64encode(hmac.new(os.environ["BETTER_AUTH_SECRET"].encode(), token.encode(), hashlib.sha256).digest()).decode()
    failures, console_errors, map_responses = [], [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.set_default_timeout(8000)
        page.set_default_navigation_timeout(8000)
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("response", lambda response: map_responses.append((response.status, response.url)) if "tile.openstreetmap.org" in response.url else None)
        page.context.add_cookies([{"name": "better-auth.session_token", "value": f"{token}.{signature}", "url": "http://localhost:3000"}])
        page.goto("http://localhost:3000/dashboard", wait_until="domcontentloaded")
        page.get_by_role("heading", name="Operations").wait_for(timeout=15000)
        assert page.get_by_role("heading", name="Operations").is_visible(), f"Unexpected page {page.url}: {page.locator('body').inner_text()}"
        print("overview loaded", flush=True)
        assert page.get_by_role("navigation", name="Operations navigation").is_visible()
        assert page.get_by_text("Live operations map").is_visible()

        # Ensure the guarded demo seed can provision planner prerequisites.
        page.get_by_role("button", name="Reset seed").click()
        page.wait_for_timeout(700)
        print("demo seed requested", flush=True)
        page.goto("http://localhost:3000/dashboard/routes", wait_until="domcontentloaded")
        try:
            page.get_by_text("Plan a collection route", exact=True).wait_for(timeout=15000)
        except Exception as error:
            raise AssertionError(f"Planner did not render at {page.url}: {page.locator('body').inner_text()}") from error
        assert page.get_by_text("Plan a collection route", exact=True).is_visible()
        print("planner loaded", flush=True)
        selects = page.locator("select")
        selects.nth(0).select_option(index=1)
        selects.nth(1).select_option(index=2)
        selects.nth(2).select_option(index=1)
        page.locator('input[type="checkbox"]').first.check()
        page.get_by_role("button", name="Optimize").click()
        page.get_by_text("ordered stops").wait_for()
        print("route optimized", flush=True)
        page.get_by_role("button", name="Create route").click()
        page.goto("http://localhost:3000/dashboard", wait_until="domcontentloaded")
        page.get_by_role("button", name="TRK-001 · DRAFT · 1 stops").last.click()
        page.locator('[aria-label="Operations map"][data-selected-route]').wait_for()
        page.locator('[aria-label="site: TPS-001"]').wait_for()
        page.locator('[aria-label="facility: DEP-001"]').wait_for()
        page.wait_for_timeout(700)
        page.screenshot(path="/tmp/dashboard-route-map.png", full_page=True)
        assert page.locator('[aria-label="Operations map"]').get_attribute("data-selected-route")
        page.goto("http://localhost:3000/dashboard/routes", wait_until="domcontentloaded")
        page.get_by_text("Plan a collection route", exact=True).wait_for(timeout=15000)
        page.get_by_role("button", name="Assign").last.click()
        page.get_by_role("button", name="Start").last.click()
        page.get_by_role("button", name="Complete TPS-001").last.click()
        page.get_by_role("button", name="Complete route").last.click()
        print("route completed", flush=True)

        page.goto("http://localhost:3000/dashboard", wait_until="domcontentloaded")
        page.get_by_role("button", name="Trigger deviation").click()
        page.wait_for_timeout(500)

        # Dedicated detail and incident pages must render after authenticated navigation.
        for route, heading in [("sites", "Sites"), ("fleet", "Fleet"), ("alerts", "Alerts"), ("anomalies", "Anomalies")]:
            page.goto(f"http://localhost:3000/dashboard/{route}", wait_until="domcontentloaded")
            title = page.locator('[data-slot="card-title"]', has_text=heading).first
            title.wait_for(timeout=15000)
            assert title.is_visible()
            assert page.get_by_text("Map focus").is_visible()
            page.locator(".maplibregl-canvas").wait_for(timeout=15000)
            if route == "sites":
                page.get_by_role("button", name="TPS-001 · NORMAL").click()
                page.get_by_text("Prediction: unavailable (no authoritative prediction data).").wait_for()
            if route == "fleet":
                page.get_by_role("button", name="TRK-001 · AVAILABLE").click()
                page.get_by_text("Load:").wait_for()
            if route == "anomalies":
                page.get_by_role("button", name="Resolve").first.click()
        page.wait_for_timeout(3000)
        page.screenshot(path="/tmp/dashboard-smoke.png", full_page=True)
        browser.close()
    unexpected = [error for error in console_errors if "favicon" not in error.lower()]
    assert not unexpected, f"Browser console errors: {unexpected}"
    assert any(status == 200 for status, _url in map_responses), f"No OpenStreetMap raster tiles: {map_responses}"
    print("browser smoke passed")


if __name__ == "__main__":
    main()
