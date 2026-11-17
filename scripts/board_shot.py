"""Screenshot just the cockpit at 2x for a scenario (dev helper): board_shot.py <scenario>."""

import sys
import time

from _table import open_table
from playwright.sync_api import sync_playwright

scen = sys.argv[1] if len(sys.argv) > 1 else "yul"
with sync_playwright() as p:
    b = p.chromium.launch()
    pilot, _, errs = open_table(b, scen, {"width": 1500, "height": 1000}, scale=2)
    time.sleep(0.6)
    pilot.locator("svg.board").screenshot(path=f"shots/board_{scen}.png")
    print("errors:", errs)
    b.close()
