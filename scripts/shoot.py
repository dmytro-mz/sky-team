"""Drive the game in a headless browser and save screenshots to shots/ (dev helper)."""

import sys
import time

from _table import URL, open_table
from playwright.sync_api import sync_playwright

scen = sys.argv[1] if len(sys.argv) > 1 else "yul"
with sync_playwright() as p:
    b = p.chromium.launch()
    home = b.new_page(viewport={"width": 1700, "height": 1000})
    home.goto(URL)
    home.wait_for_selector("text=Create a table")
    home.screenshot(path="shots/home.png")
    pilot, copilot, errs = open_table(b, scen)
    time.sleep(0.5)
    pilot.screenshot(path="shots/discuss.png")
    pilot.click("text=Roll the dice")
    copilot.click("text=Roll the dice")
    time.sleep(1.2)
    pilot.screenshot(path="shots/place.png")
    print("errors:", errs)
    b.close()
