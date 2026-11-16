"""Screenshot just the cockpit at 2x for a scenario (dev helper): board_shot.py <scenario> [rounds-to-play]."""

import sys
import time

from playwright.sync_api import sync_playwright

scen = sys.argv[1] if len(sys.argv) > 1 else "yul"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1500, "height": 1000}, device_scale_factor=2)
    pg.goto("http://localhost:8765")
    pg.click("text=Play on one device")
    pg.wait_for_selector(".card")
    pg.click(f'.card[data-id="{scen}"]')
    pg.click("text=Take off")
    pg.wait_for_selector(".board")
    time.sleep(0.6)
    pg.locator("svg.board").screenshot(path=f"shots/board_{scen}.png")
    b.close()
