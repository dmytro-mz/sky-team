"""Shared dev helper: two browser contexts (Pilot and Co-Pilot) sit at one table and take off."""

import time

URL = "http://localhost:8765"


def open_table(browser, scenario: str, viewport=None, scale: int = 1):
    viewport = viewport or {"width": 1700, "height": 1000}
    pages = [browser.new_context(viewport=viewport, device_scale_factor=scale).new_page() for _ in range(2)]
    errs: list[str] = []
    for pg in pages:
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pilot, copilot = pages
    pilot.goto(URL)
    pilot.click("text=Create a table")
    pilot.wait_for_selector(".card")
    copilot.goto(pilot.url)
    copilot.wait_for_selector(".card")
    pilot.click(f'.card[data-id="{scenario}"]')
    pilot.click('button[data-seat="pilot"]')
    copilot.click('button[data-seat="copilot"]')
    time.sleep(0.3)
    pilot.click("text=Take off")
    for pg in pages:
        pg.wait_for_selector(".board")
    return pilot, copilot, errs
