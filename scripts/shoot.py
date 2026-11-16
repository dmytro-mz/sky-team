"""Drive the game in a headless browser and save screenshots to shots/ (dev helper)."""

import sys
import time

from playwright.sync_api import sync_playwright

URL = "http://localhost:8765"
scen = sys.argv[1] if len(sys.argv) > 1 else "yul"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1700, "height": 1000})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(URL)
    pg.wait_for_selector("text=Create a table")
    pg.screenshot(path="shots/home.png")
    pg.click("text=Play on one device")
    pg.wait_for_selector(".card")
    pg.click(f'.card[data-id="{scen}"]')
    time.sleep(0.4)
    pg.screenshot(path="shots/lobby.png")
    pg.click("text=Take off")
    pg.wait_for_selector(".board")
    time.sleep(0.5)
    pg.screenshot(path="shots/discuss.png")
    pg.click("text=Roll the dice")
    time.sleep(0.6)
    pg.screenshot(path="shots/place.png")
    print("errors:", errs)
    b.close()
