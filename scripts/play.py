"""Play a few rounds in the browser with random legal clicks (dev smoke test)."""

import random
import sys
import time

from playwright.sync_api import sync_playwright

scen = sys.argv[1] if len(sys.argv) > 1 else "yul"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1700, "height": 1000})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:8765")
    pg.click("text=Play on one device")
    pg.wait_for_selector(".card")
    pg.click(f'.card[data-id="{scen}"]')
    pg.click("text=Take off")
    pg.wait_for_selector(".board")
    shots = 0
    for step in range(200):
        time.sleep(0.15)
        if pg.locator(".modal .dialog.win, .modal .dialog.lose").count():
            break
        if pg.locator("text=Roll the dice").count():
            pg.click("text=Roll the dice")
            continue
        if pg.locator(".cover button").count():
            pg.click(".cover button")
            continue
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
        if step == 5 and shots == 0:
            pg.screenshot(path="shots/mid_" + scen + ".png")
            shots = 1
    pg.screenshot(path="shots/end.png")
    print("errors:", errs)
    print(pg.inner_text(".status"))
    b.close()
