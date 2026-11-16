"""Two browser contexts join one table and play a round (dev smoke test)."""

import time

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    a = b.new_context(viewport={"width": 1700, "height": 1000}).new_page()
    c = b.new_context(viewport={"width": 1700, "height": 1000}).new_page()
    errs = []
    for pg in (a, c):
        pg.on("pageerror", lambda e: errs.append(str(e)))
    a.goto("http://localhost:8765")
    a.click("text=Create a table")
    a.wait_for_selector(".card")
    url = a.url
    c.goto(url)
    c.wait_for_selector(".card")
    a.click('.card[data-id="lhr"]')
    a.click('button[data-seat="pilot"]')
    c.click('button[data-seat="copilot"]')
    time.sleep(0.4)
    a.click("text=Take off")
    a.wait_for_selector(".board")
    c.wait_for_selector(".board")
    a.click("text=Roll the dice")
    time.sleep(0.3)
    c.click("text=Roll the dice")
    time.sleep(0.6)
    print(
        "pilot sees dice:",
        a.locator(".tray.pilot button.die").count(),
        "copilot dice buttons:",
        a.locator(".tray.copilot button.die").count(),
    )
    print(
        "copilot page sees:", c.locator(".tray.copilot button.die").count(), c.locator(".tray.pilot button.die").count()
    )
    a.locator(".tray.pilot button.die").first.click()
    a.locator(".slot.hot").first.click()
    time.sleep(0.5)
    print("status A:", a.inner_text(".status"), "| status C:", c.inner_text(".status"))
    c.screenshot(path="shots/copilot_view.png")
    print("errors", errs)
    b.close()
