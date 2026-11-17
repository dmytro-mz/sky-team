"""Play a flight in two browsers with random legal clicks (dev smoke test): play.py <scenario>."""

import random
import sys
import time

from _table import open_table
from playwright.sync_api import sync_playwright

scen = sys.argv[1] if len(sys.argv) > 1 else "yul"
with sync_playwright() as p:
    b = p.chromium.launch()
    pilot, copilot, errs = open_table(b, scen)
    shots = 0
    for step in range(400):
        time.sleep(0.12)
        if pilot.locator(".modal .dialog.win, .modal .dialog.lose").count():
            break
        rolled = False
        for pg in (pilot, copilot):
            btn = pg.locator('button[data-act="roll"]:not([disabled])')
            if btn.count():
                btn.click()
                rolled = True
        if rolled:
            continue
        for pg in (pilot, copilot):
            tok = pg.locator("button.die.token")
            dice = pg.locator("button.die.play")
            if tok.count():
                tok.first.click()
            elif dice.count():
                random.choice([dice.nth(i) for i in range(dice.count())]).click()
            else:
                continue
            slots = pg.locator(".slot.hot")
            if slots.count():
                slots.nth(random.randrange(slots.count())).click()
            else:
                pg.keyboard.press("Escape")
        if step == 12 and shots == 0:
            time.sleep(1.2)
            pilot.screenshot(path="shots/mid_" + scen + ".png")
            shots = 1
    time.sleep(2.8)
    pilot.screenshot(path="shots/end.png")
    print("errors:", errs)
    print(pilot.inner_text(".status"))
    b.close()
