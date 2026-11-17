import { boardSVG, legal } from "./board.js";
import { infoFor } from "./info.js";
import { COLORS, dieHidden, dieSVG, PLANE_PATH, coffeeIcon, moduleChip, rerollIcon, starBadge } from "./art.js";

const $app = document.getElementById("app");
const $overlay = document.getElementById("overlay");
const $toasts = document.getElementById("toasts");

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const token = store.get("st-token") || (() => {
  const t = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, "0")).join("");
  store.set("st-token", t);
  return t;
})();

const S = {
  config: null, ws: null, code: null, snap: null, error: null,
  ui: { sel: null, delta: 0, rr: null, rulesOpen: false, leaveOpen: false, prev: null, fresh: null },
  clock: 0,
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cap = (s) => (s === "pilot" ? "Pilot" : "Co-Pilot");

function toast(msg, bad = true) {
  const d = document.createElement("div");
  d.className = "toast" + (bad ? " bad" : "");
  d.textContent = msg;
  $toasts.append(d);
  setTimeout(() => d.remove(), 3200);
}

// ------------------------------------------------------------------ network
function connect(code) {
  S.code = code;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/${code}`);
  S.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ token, name: store.get("st-name", "") }));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "state") onState(m);
    else if (m.type === "error") toast(m.message);
    else if (m.type === "fatal") { S.error = m.message; S.snap = null; render(); }
  };
  ws.onclose = () => { if (S.ws === ws && S.code) setTimeout(() => S.code && connect(S.code), 1500); };
}
const send = (m) => S.ws && S.ws.readyState === 1 && S.ws.send(JSON.stringify(m));
const act = (seat, action) => send({ type: "act", seat, action });

function onState(m) {
  const prev = S.snap;
  S.snap = m;
  S.clock = m.now - Date.now();
  const g = m.game;
  if (g) {
    const p = prev?.game;
    // animate from the previous state only within the same flight
    S.ui.prev = p && p.scenario.id === g.scenario.id && g.round >= p.round && !(p.result && !g.result) ? p : null;
    const old = new Set(p ? ["pilot", "copilot"].flatMap((s) => p.dice[s].map((d) => `${s}:${d.id}`)) : []);
    S.ui.fresh = new Set(["pilot", "copilot"].flatMap((s) => g.dice[s].map((d) => `${s}:${d.id}`)).filter((k) => !old.has(k)));
    if (!p || p.round !== g.round || prev.status !== m.status) S.ui.sel = null;
    if (S.ui.sel && !selStillValid(g)) S.ui.sel = null;
    if (!g.reroll) S.ui.rr = null;
  } else S.ui.sel = null;
  render();
}

function selStillValid(g) {
  const s = S.ui.sel;
  if (s.token) return !!g.pendingToken;
  return g.dice[s.seat]?.some((d) => d.id === s.id);
}

// ------------------------------------------------------------------ home
function homeView() {
  const done = Object.values(S.config.progress).filter((p) => p.wins > 0).length;
  const total = S.config.scenarios.length;
  return `<div class="home">
    <div class="hero">
      <svg viewBox="-60 -50 120 100" class="logo"><path d="${PLANE_PATH}" transform="scale(1.7)" fill="#fff"/></svg>
      <h1>SKY TEAM</h1>
      <p class="tag">Two pilots. One landing. No talking about your dice.</p>
      <div class="home-actions">
        <button class="btn primary big" data-act="create">Create a table</button>
      </div>
      <form class="join" data-form="join"><input name="code" maxlength="5" placeholder="TABLE CODE" autocomplete="off"><button class="btn">Join</button></form>
      <div class="home-progress"><b>${done}</b> of ${total} landings completed on this machine</div>
      ${S.error ? `<div class="err">${esc(S.error)}</div>` : ""}
    </div>
  </div>`;
}

// ------------------------------------------------------------------ lobby
function levelRank(l) { return ["green", "yellow", "red", "black"].indexOf(l); }

function lobbyView(m) {
  const sc = S.config.scenarios.find((s) => s.id === m.scenario);
  const prog = m.progress;
  const host = m.isHost;
  const groups = ["green", "yellow", "red", "black"].map((lvl) => {
    const cards = S.config.scenarios.filter((s) => s.level === lvl).map((s) => {
      const p = prog[s.id];
      const chips = s.modules.map((x) => `<svg viewBox="-16 -16 32 32" class="chip" title="${esc(x.name)}">${moduleChip(x.key, 0, 0, 1, "#2a4f9e", "#fff")}</svg>`).join("");
      const star = s.abilities ? `<svg viewBox="-17 -17 34 34" class="chip" title="${s.abilities} Special Ability card${s.abilities > 1 ? "s" : ""}">${starBadge(s.abilities, 0, 0, 1).replace(/fill="#fff"/g, 'fill="#2a4f9e"').replace('stroke="#fff"', 'stroke="#2a4f9e"').replace('fill="#1c2f55"', 'fill="#fff"')}</svg>` : "";
      return `<button class="card ${s.level} ${s.id === m.scenario ? "sel" : ""}" data-act="scenario" data-id="${s.id}" ${host ? "" : "disabled"}>
        <span class="hd"><i class="ring ${p?.wins ? "done" : ""}">${p?.wins ? "✓" : ""}</i><b>${s.code}</b><span>${esc(s.airport)}</span></span>
        <span class="bd"><span class="city">${esc(s.city)}</span><span class="chips">${chips}${star}</span></span></button>`;
    }).join("");
    return `<section><h3 class="lvl ${lvl}">${esc(S.config.levels[lvl])}</h3><div class="cards">${cards}</div></section>`;
  }).join("");
  const seat = (s) => {
    const o = m.seats[s];
    const mine = m.seats[s] && m.mySeats.includes(s);
    return `<div class="seat ${s}"><b>${cap(s)}</b><span>${o ? esc(o.name) + (o.online ? "" : " (away)") : "empty"}</span>
      ${mine ? `<button class="btn small" data-act="leave">Leave</button>` : o ? "" : `<button class="btn small primary" data-act="claim" data-seat="${s}">Sit here</button>`}</div>`;
  };
  const link = `${S.config.public_url || S.config.lan_url || location.origin}/r/${m.room}`;
  const ready = m.seats.pilot && m.seats.copilot;
  const done = Object.values(prog).filter((p) => p.wins > 0).length;
  return `<div class="lobby">
    <header class="top"><b class="brand">SKY TEAM</b><span class="muted">Table ${m.room}</span><span class="grow"></span><span class="muted">${done} / ${S.config.scenarios.length} landed</span><button class="btn small" data-act="rules">Rules</button><button class="btn small ghost" data-act="home">Leave table</button></header>
    <div class="lobby-body">
      <div class="scenarios">${groups}</div>
      <aside class="detail">
        <div class="boarding ${sc.level}">
          <div class="bp-top"><span class="lvlname">${esc(sc.levelName)}</span><span class="bp-code">${sc.code}</span></div>
          <h2>${esc(sc.airport)}</h2><div class="muted">${esc(sc.city)}</div>
          <p>${esc(sc.story)}</p>
          <ul class="facts">
            <li><b>Approach</b> ${sc.length} spaces · ${Object.values(sc.planes).reduce((a, b) => a + b, 0)} airplanes${Object.keys(sc.traffic).length ? " · traffic die" : ""}${Object.keys(sc.turns).length ? " · turns" : ""}</li>
            <li><b>Reroll tokens</b> ${sc.rerolls.length} on the altitude track (${sc.rerolls.map((r) => (7 - r) * 1000 + " ft").join(" and ")})</li>
            ${sc.modules.map((x) => `<li><b>${esc(x.name)}</b> ${esc(x.text)}</li>`).join("")}
          </ul>
          ${sc.abilities ? `<div class="abpick"><b>Special Ability cards</b> <span class="muted">choose up to ${sc.abilities}${m.abilities.length < sc.abilities ? "; the rest are drawn at random" : ""}</span>
            <div class="abgrid">${Object.entries(m.abilityCatalog).map(([k, v]) => `<button class="abbtn ${m.abilities.includes(k) ? "on" : ""}" data-act="ability" data-key="${k}" ${host ? "" : "disabled"}><b>${esc(v.name)}</b><span>${esc(v.text)}</span></button>`).join("")}</div></div>` : ""}
          ${prog[sc.id]?.wins ? `<div class="record">✓ Landed ${prog[sc.id].wins}× · ${prog[sc.id].attempts} flights</div>` : prog[sc.id] ? `<div class="record lost">${prog[sc.id].attempts} attempts so far</div>` : ""}
        </div>
        <div class="seats">${seat("pilot")}${seat("copilot")}</div>
        <div class="invite"><input readonly value="${esc(link)}" onclick="this.select()"><button class="btn small" data-act="copy" data-link="${esc(link)}">Copy link</button></div>
        ${inviteNote()}
        <button class="btn primary big wide" data-act="start" ${host && ready ? "" : "disabled"}>${host ? (ready ? "Take off" : "Both seats need a pilot") : "Waiting for the host"}</button>
      </aside>
    </div></div>`;
}

function inviteNote() {
  const host = location.hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  if (S.config.public_url || host.endsWith("trycloudflare.com")) return `<p class="note">Anyone with this link can join from anywhere.</p>`;
  if (local && !S.config.lan_url) return `<p class="note">This link only works on this computer. Restart with <code>uv run skyteam serve --tunnel</code> to invite a friend over the internet.</p>`;
  return `<p class="note">Works on the same Wi-Fi. For a friend elsewhere, restart with <code>uv run skyteam serve --tunnel</code>.</p>`;
}

// ------------------------------------------------------------------ game
const COMM_ON = `<svg viewBox="0 0 40 36" class="comm"><path d="M4 4h32a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H18l-9 8v-8H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="#3fd06a"/><path d="M10 12h20M10 18h14" stroke="#0b2415" stroke-width="3" stroke-linecap="round"/></svg>`;
const COMM_OFF = `<svg viewBox="0 0 40 36" class="comm"><path d="M4 4h32a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H18l-9 8v-8H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="#59323a"/><path d="M10 12h20M10 18h14" stroke="#2a141a" stroke-width="3" stroke-linecap="round"/><path d="M5 31 35 3" stroke="#ff5a4a" stroke-width="4.5" stroke-linecap="round"/></svg>`;

const viewSeats = (m) => m.mySeats;

function dieEl(d, seat, g, m) {
  const mine = viewSeats(m).includes(seat);
  const t = seat === "pilot" ? "pilot" : "copilot";
  const roll = S.ui.fresh?.has(`${seat}:${d.id}`) ? ` rolling" style="animation-delay:${(d.id % 4) * 0.09}s` : "";
  if (d.hidden) return `<div class="die${roll}"><svg viewBox="-34 -34 68 68">${dieHidden(t, 56)}</svg></div>`;
  const sel = S.ui.sel && !S.ui.sel.token && S.ui.sel.id === d.id;
  const inRr = S.ui.rr && S.ui.rr[seat]?.has(d.id);
  const val = sel ? d.value + S.ui.delta : d.value;
  const playable = mine && g.phase === "place" && !g.pendingToken && (g.turn === seat || d.wild);
  const cls = ["die", sel ? "sel" : "", playable ? "play" : "", inRr ? "rr" : "", d.wild ? "wild" : ""].join(" ") + roll;
  return `<button class="${cls}" data-act="die" data-id="${d.id}" data-seat="${seat}" ${mine ? "" : "disabled"}>
    <svg viewBox="-34 -34 68 68">${dieSVG(val, t, 56)}</svg>${d.wild ? `<span class="star">★</span>` : ""}${sel && S.ui.delta ? `<span class="mod">${S.ui.delta > 0 ? "+" : ""}${S.ui.delta}</span>` : ""}</button>`;
}

function trayView(seat, m, g) {
  const mine = viewSeats(m).includes(seat);
  const dice = g.dice[seat];
  const pend = g.pendingToken && g.pendingToken.seat === seat && g.pendingToken.value;
  let body = dice.map((d) => dieEl(d, seat, g, m)).join("");
  if (pend) {
    const sel = S.ui.sel?.token;
    body += `<button class="die token play ${sel ? "sel" : ""}" data-act="token" data-seat="${seat}"><svg viewBox="-34 -34 68 68">${dieSVG(pend, seat === "pilot" ? "pilot" : "copilot", 56)}</svg><span class="star">Intern</span></button>`;
  }
  const active = g.phase === "place" && !g.result && (g.pendingToken ? g.pendingToken.seat === seat : g.turn === seat);
  const note = g.phase === "discuss" ? (g.ready[seat] ? "ready" : "") : active ? "your turn" : "";
  return `<div class="tray ${seat} ${active ? "active" : ""}"><div class="tray-head"><b>${cap(seat)}</b>${mine ? `<span class="you">you</span>` : ""}<span class="state">${note}</span></div>
    <div class="dice">${body || `<span class="muted">${g.phase === "place" ? "all dice placed" : "dice appear after the roll"}</span>`}</div></div>`;
}

function statusLine(m, g) {
  const seats = viewSeats(m);
  if (g.result) return g.result.won ? "Touchdown!" : "Mission failed";
  if (g.phase === "discuss") {
    const waiting = seats.every((s) => g.ready[s]);
    return waiting ? "Waiting for your partner…" : "Agree on a plan. You may discuss strategy, but never reveal dice values.";
  }
  if (g.reroll) return "Reroll: each pilot chooses the dice to roll again.";
  if (g.swap) return `Working Together: ${cap(g.swap.seat)} offers a die — the other pilot must answer.`;
  if (g.pendingToken) return `${cap(g.pendingToken.seat)}: place the Intern token (${g.pendingToken.value || "?"}) anywhere but Concentration.`;
  const mineTurn = seats.includes(g.turn);
  return mineTurn ? `${cap(g.turn)}: pick a die, then a glowing space.` : `${cap(g.turn)} is placing a die…`;
}

function toolbar(m, g) {
  if (g.result) return "";
  const seats = viewSeats(m);
  let b = "";
  if (g.phase === "discuss") {
    const all = seats.every((s) => g.ready[s]);
    b += `<button class="btn primary big" data-act="roll" ${all ? "disabled" : ""}>Roll the dice</button>`;
    return b;
  }
  if (g.reroll) {
    const seat = S.ui.rrSeat && seats.includes(S.ui.rrSeat) ? S.ui.rrSeat : seats.find((s) => !g.reroll.picked[s]);
    if (!seat) return `<span class="muted">Waiting for your partner…</span><button class="btn" data-act="rr-cancel">Cancel</button>`;
    S.ui.rrSeat = seat;
    return `<span>${cap(seat)}: tap the dice to reroll</span><button class="btn primary" data-act="rr-confirm">Confirm</button><button class="btn" data-act="rr-cancel">Cancel</button>`;
  }
  if (g.swap) {
    const answerer = seats.find((s) => s !== g.swap.seat);
    b += answerer ? `<span>Tap one of your dice to swap with ${cap(g.swap.seat)}'s chosen die</span>` : `<span class="muted">Waiting for your partner…</span>`;
    if (seats.includes(g.swap.seat)) b += `<button class="btn" data-act="swap-cancel">Cancel</button>`;
    return b;
  }
  const sel = S.ui.sel;
  if (sel && !sel.token) {
    const max = g.coffee;
    if (max) {
      b += `<span class="coffee-tool">${"☕"} <button class="btn small" data-act="delta" data-d="-1" ${S.ui.delta <= -max || sel.value + S.ui.delta <= 1 ? "disabled" : ""}>−1</button><b>${S.ui.delta ? (S.ui.delta > 0 ? "+" : "") + S.ui.delta : "±"}</b><button class="btn small" data-act="delta" data-d="1" ${S.ui.delta >= max || sel.value + S.ui.delta >= 6 ? "disabled" : ""}>+1</button></span>`;
    }
    const has = (k) => g.abilities.some((a) => a.key === k);
    if (has("adaptation") && !g.used[`game:adapt:${sel.seat}`]) b += `<button class="btn small" data-act="adapt">Adaptation: flip die</button>`;
    const placedAny = Object.values(g.slots).some((s) => s.die);
    if (has("anticipation") && sel.seat === g.first && !placedAny && !g.used[`anticipation:${sel.seat}`]) b += `<button class="btn small" data-act="anticipate">Anticipation: reroll die</button>`;
  }
  if (g.abilities.some((a) => a.key === "working_together") && !g.used.wt && sel && !sel.token) b += `<button class="btn small" data-act="swap-offer">Working Together: swap…</button>`;
  if (g.rerolls > 0) b += `<button class="btn small" data-act="rr-open"><svg viewBox="-20 -20 40 40" width="18" height="18">${rerollIcon(0, 0, 0.9)}</svg> Reroll (${g.rerolls})</button>`;
  return (b || `<span class="muted">${g.coffee ? "Select a die to use coffee on it." : ""}</span>`) + `<span class="hint">Click anything on the board to see what it means.</span>`;
}

function infoPanel(m, g) {
  const sc = g.scenario;
  const abil = g.abilities.map((a) => `<div class="ab-card"><b>★ ${esc(a.name)}</b><span>${esc(a.text)}</span></div>`).join("");
  const mods = sc.modules.map((x) => `<div class="mod-card"><b>${esc(x.name)}</b><span>${esc(x.text)}</span></div>`).join("");
  const log = g.log.slice(-14).map((l) => `<li class="${l.kind} ${l.seat || ""}">${esc(l.text)}</li>`).join("");
  return `<div class="info">${abil ? `<h4>Special abilities</h4>${abil}` : ""}${mods ? `<h4>Modules</h4>${mods}` : ""}<h4>Flight log</h4><ul class="log">${log}</ul></div>`;
}

function timerHTML(g) {
  if (!g.deadline || g.phase !== "place") return "";
  const left = Math.max(0, Math.ceil((g.deadline - (Date.now() + S.clock)) / 1000));
  return `<span class="timer ${left <= 10 ? "low" : ""}" id="timer">⏱ ${left}s</span>`;
}

function gameView(m) {
  const g = m.game;
  const sc = g.scenario;
  const comm = g.communication;
  return `<div class="game">
    <header class="top">
      <b class="brand">SKY TEAM</b>
      <span class="route ${sc.level}">${sc.code} · ${esc(sc.airport)} <i>${esc(sc.levelName)}</i></span>
      <span class="grow"></span>
      <span class="commbox ${comm ? "on" : "off"}" title="${comm ? "You may talk about strategy, never about dice values" : "Silence: no talking while dice are placed"}">${comm ? COMM_ON : COMM_OFF}<span>${comm ? "You may talk" : "No talking"}</span></span>
      ${timerHTML(g)}
      <button class="btn small" data-act="rules">Rules</button>
      <button class="btn small ghost" data-act="leave-menu">Leave</button>
    </header>
    <div class="status ${g.result ? (g.result.won ? "win" : "lose") : ""}">${esc(statusLine(m, g))}</div>
    <div class="stage">
      <aside class="side left">${trayView("pilot", m, g)}<div class="tools">${toolbar(m, g)}</div></aside>
      <div class="boardwrap" id="boardwrap">${boardSVG(g, S.ui)}</div>
      <aside class="side right">${trayView("copilot", m, g)}${infoPanel(m, g)}</aside>
    </div>
  </div>`;
}

/** A small animated scene for the end of a flight: a touchdown on the runway, or a plane spiralling down. */
function finaleScene(won) {
  const plane = `<path d="${PLANE_PATH}" fill="#f4f7fa" stroke="#7d8b9a" stroke-width="1.5"/>`;
  if (won) return `<svg viewBox="0 0 360 150" class="finale">
    <defs><linearGradient id="fsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb46b"/><stop offset=".6" stop-color="#ffd9a1"/><stop offset="1" stop-color="#f6efe0"/></linearGradient></defs>
    <rect width="360" height="150" rx="14" fill="url(#fsky)"/>
    <path d="M0,118 H360 V150 H0Z" fill="#3c4a3a"/><path d="M40,124 L320,124 L350,146 L10,146Z" fill="#30343a"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${70 + i * 40}" y="133" width="22" height="3" fill="#fff" opacity=".85"/>`).join("")}
    <g class="touchdown"><g transform="rotate(90) scale(.9)">${plane}</g></g>
    <g class="sparkles">${[0, 1, 2].map((i) => `<circle cx="${210 + i * 18}" cy="122" r="${5 - i}" fill="#fff" opacity=".7"/>`).join("")}</g></svg>`;
  return `<svg viewBox="0 0 360 150" class="finale">
    <rect width="360" height="150" rx="14" fill="#2a3346"/><path d="M0,126 H360 V150 H0Z" fill="#1d2430"/>
    <g class="smoke">${[0, 1, 2, 3].map((i) => `<circle cx="${110 + i * 26}" cy="${40 + i * 14}" r="${10 + i * 3}" fill="#8592a6" opacity="${0.4 - i * 0.07}"/>`).join("")}</g>
    <g class="spiral"><g transform="rotate(135) scale(.9)">${plane}</g></g></svg>`;
}

function resultOverlay(m) {
  const g = m.game;
  if (!g?.result) return "";
  const won = g.result.won;
  const next = S.config.scenarios.find((s) => s.id === m.scenario);
  return `<div class="modal"><div class="dialog ${won ? "win" : "lose"}">
    ${finaleScene(won)}
    <h2>${won ? "Touchdown!" : "Mission failed"}</h2>
    <p>${esc(g.result.reason)}</p>
    ${won ? `<p class="muted">${esc(next.code)} · ${esc(next.airport)} is now marked as landed.</p>` : ""}
    <div class="row">${m.isHost || m.mySeats.length ? `<button class="btn primary" data-act="again">Fly again</button><button class="btn" data-act="lobby">Choose another scenario</button>` : `<span class="muted">The host decides what comes next.</span>`}
    <button class="btn ghost" data-act="close-result">Look at the cockpit</button></div></div></div>`;
}

const RULES = `<h2>How to land</h2>
<p>You have <b>7 rounds</b> (6000 ft down to the final approach). Each round: talk strategy, both pilots roll <b>4 dice</b> in secret, then you take turns placing one die on a free space of your colour. The first player alternates every round (the arrow on the Altitude Track). Never talk about dice values.</p>
<ul>
<li><b>Axis</b> (mandatory, one die each): the dial turns toward the higher die by the difference. Reaching the red <b>✕</b> (3 marks) is a spin and you lose. It must be level (0) at the end of the final round.</li>
<li><b>Engines</b> (mandatory, one die each): the sum is compared with the Aerodynamics markers. Up to the blue marker: hold. Up to the orange marker: advance 1 space. Above orange: advance 2. Each Landing Gear moves blue up, each Flap moves orange up.</li>
<li>Leaving a space that still has Airplane tokens is a <b>collision</b>; advancing from the airport is an <b>overshoot</b>. Turn tabs: when entering a space the Axis must be on a triangle, not a red ✕.</li>
<li><b>Radio</b>: removes an Airplane that many spaces ahead (1 = your current space). The Pilot has one Radio space, the Co-Pilot two.</li>
<li><b>Landing Gear</b> (Pilot: 1·2, 3·4, 5·6, any order) and <b>Flaps</b> (Co-Pilot: 1·2, 2·3, 4·5, 5·6, in order) must all be out to land.</li>
<li><b>Brakes</b> (Pilot: 2, 4, 6 in order). In the <b>final round</b> the Engines total must be lower than the red marker.</li>
<li><b>Concentration</b>: any die earns a Coffee token (max 3). A Coffee changes a die by ±1 (1–6, no wrap) as it is placed. <b>Reroll tokens</b> let both players reroll any of their unplaced dice, once.</li>
<li>After round 6 you must be over the airport, otherwise you crash. If you arrive early, hold the pattern. At the end of the final round you win when no Airplanes remain, gear and flaps are out, the plane is level and your speed is below the Brakes.</li></ul>`;

// ------------------------------------------------------------------ render
function render() {
  if (!S.config) return;
  const m = S.snap;
  if (!S.code || (!m && !S.error)) $app.innerHTML = homeView();
  else if (!m) $app.innerHTML = homeView();
  else if (m.status === "lobby") $app.innerHTML = lobbyView(m);
  else {
    $app.innerHTML = gameView(m);
    S.ui.prev = null; // a re-render without a new state does not replay the animations
    S.ui.fresh = null;
    const tweens = $app.querySelectorAll("[data-tw]");
    if (tweens.length) requestAnimationFrame(() => requestAnimationFrame(() => tweens.forEach((el) => { el.style.transform = el.dataset.tw; })));
    const log = $app.querySelector(".log");
    if (log) log.scrollTop = log.scrollHeight;
  }
  $overlay.innerHTML = S.ui.leaveOpen && m?.game ? leaveDialog(m) : S.ui.rulesOpen ? `<div class="modal" data-act="rules-close"><div class="dialog rules">${RULES}<button class="btn primary" data-act="rules-close">Got it</button></div></div>`
    : m?.game?.result && !S.ui.hideResult ? resultOverlay(m) : "";
}

setInterval(() => {
  const t = document.getElementById("timer");
  const g = S.snap?.game;
  if (t && g?.deadline) {
    const left = Math.max(0, Math.ceil((g.deadline - (Date.now() + S.clock)) / 1000));
    t.textContent = `⏱ ${left}s`;
    t.classList.toggle("low", left <= 10);
  }
}, 250);

function leaveDialog(m) {
  const g = m.game, seated = m.mySeats.length > 0;
  const lobby = seated || m.isHost
    ? `<button class="btn primary" data-act="lobby">Back to the lobby</button>`
    : "";
  return `<div class="modal" data-act="leave-close"><div class="dialog leave">
    <h2>Leave the cockpit?</h2>
    <p>${g.result ? "The flight is over." : "<b>Back to the lobby</b> calls this flight off for both pilots; you stay at the table and can pick another scenario."}</p>
    <div class="row">${lobby}<button class="btn" data-act="home">Leave the table</button><button class="btn ghost" data-act="leave-close">Stay</button></div></div></div>`;
}

// ------------------------------------------------------------------ explanations
let $info = null;
function showInfo(key, ev) {
  const inf = infoFor(key, S.snap.game);
  if (!inf) return;
  hideInfo();
  $info = document.createElement("div");
  $info.id = "info";
  $info.innerHTML = `<b>${esc(inf.title)}</b><p>${esc(inf.text)}</p>${inf.meta ? `<p class="meta">${esc(inf.meta)}</p>` : ""}`;
  document.body.append($info);
  const w = $info.offsetWidth, h = $info.offsetHeight, pad = 10;
  let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + w > innerWidth - pad) x = Math.max(pad, ev.clientX - w - 14);
  if (y + h > innerHeight - pad) y = Math.max(pad, ev.clientY - h - 14);
  $info.style.left = `${x}px`;
  $info.style.top = `${y}px`;
}
function hideInfo() { $info?.remove(); $info = null; }

// ------------------------------------------------------------------ events
function selectDie(seat, id) {
  const g = S.snap.game;
  const d = g.dice[seat].find((x) => x.id === id);
  if (!d) return;
  if (S.ui.rr && g.reroll) {
    const set = (S.ui.rr[seat] ||= new Set());
    set.has(id) ? set.delete(id) : set.add(id);
    return render();
  }
  if (g.swap) {
    if (g.swap.seat !== seat) act(seat, { t: "swap_answer", die: id });
    return;
  }
  S.ui.sel = S.ui.sel && S.ui.sel.id === id ? null : { id, seat, value: d.value, wild: d.wild };
  S.ui.delta = 0;
  render();
}

document.addEventListener("click", async (e) => {
  const slot = e.target.closest("[data-slot]");
  const m = S.snap;
  if (!e.target.closest("#info")) hideInfo();
  if (slot && m?.game && S.ui.sel && legal(m.game, S.ui, slot.dataset.slot)) {
    const sel = S.ui.sel;
    if (sel.token) act(sel.seat, { t: "token", slot: slot.dataset.slot });
    else act(sel.seat, { t: "place", die: sel.id, slot: slot.dataset.slot, coffee: S.ui.delta });
    S.ui.sel = null;
    S.ui.delta = 0;
    return;
  }
  const part = m?.game && e.target.closest("svg.board") && (slot || e.target.closest("[data-info]"));
  if (part) {
    if (slot && S.ui.sel && !m.game.slots[slot.dataset.slot].die) toast("That die can't go there.");
    return showInfo(slot ? `slot:${slot.dataset.slot}` : part.dataset.info, e);
  }
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const a = t.dataset.act;
  const g = m?.game;
  switch (a) {
    case "create": {
      const r = await (await fetch("/api/rooms", { method: "POST" })).json();
      history.pushState(null, "", `/r/${r.room}`);
      connect(r.room);
      break;
    }
    case "home": S.ui.leaveOpen = false; S.code = null; S.snap = null; S.ws?.close(); history.pushState(null, "", "/"); await refreshConfig(); render(); break;
    case "ability": {
      const have = new Set(m.abilities), k = t.dataset.key, max = m.game ? 0 : S.config.scenarios.find((x) => x.id === m.scenario).abilities;
      if (have.has(k)) have.delete(k);
      else { have.add(k); while (have.size > max) have.delete(have.values().next().value); }
      send({ type: "abilities", keys: [...have] });
      break;
    }
    case "scenario": send({ type: "scenario", id: t.dataset.id }); break;
    case "claim": send({ type: "claim", seat: t.dataset.seat }); break;
    case "leave": send({ type: "leave" }); break;
    case "start": case "again": S.ui.hideResult = false; if (a === "again") { send({ type: "lobby" }); } send({ type: "start" }); break;
    case "lobby": S.ui.leaveOpen = false; send({ type: "lobby" }); break;
    case "leave-menu": S.ui.leaveOpen = true; render(); break;
    case "leave-close": if (e.target === t || t.classList.contains("btn")) { S.ui.leaveOpen = false; render(); } break;
    case "copy": navigator.clipboard?.writeText(t.dataset.link); toast("Link copied", false); break;
    case "rules": S.ui.rulesOpen = true; render(); break;
    case "rules-close": if (e.target === t || t.classList.contains("btn")) { S.ui.rulesOpen = false; render(); } break;
    case "close-result": S.ui.hideResult = true; render(); break;
    case "roll": for (const s of viewSeats(m)) act(s, { t: "ready" }); break;
    case "die": selectDie(t.dataset.seat, Number(t.dataset.id)); break;
    case "token": S.ui.sel = { token: true, seat: t.dataset.seat, value: g.pendingToken.value }; S.ui.delta = 0; render(); break;
    case "delta": S.ui.delta += Number(t.dataset.d); render(); break;
    case "adapt": act(S.ui.sel.seat, { t: "adapt", die: S.ui.sel.id }); S.ui.sel = null; break;
    case "anticipate": act(S.ui.sel.seat, { t: "anticipate", die: S.ui.sel.id }); S.ui.sel = null; break;
    case "swap-offer": act(S.ui.sel.seat, { t: "swap_offer", die: S.ui.sel.id }); S.ui.sel = null; break;
    case "swap-cancel": act(g.swap.seat, { t: "swap_cancel" }); break;
    case "rr-open": act(viewSeats(m)[0], { t: "reroll_open" }); S.ui.rr = {}; S.ui.rrSeat = null; S.ui.sel = null; break;
    case "rr-cancel": act(viewSeats(m)[0], { t: "reroll_cancel" }); S.ui.rr = null; break;
    case "rr-confirm": {
      const seat = S.ui.rrSeat;
      act(seat, { t: "reroll_pick", dice: [...(S.ui.rr?.[seat] || [])] });
      S.ui.rrSeat = null;
      break;
    }
  }
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.dataset.form === "join") {
    const code = new FormData(e.target).get("code").toString().trim().toUpperCase();
    if (code) { history.pushState(null, "", `/r/${code}`); connect(code); }
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { hideInfo(); S.ui.sel = null; S.ui.rulesOpen = false; S.ui.leaveOpen = false; render(); }
});

async function refreshConfig() {
  S.config = await (await fetch("/api/config")).json();
}

(async function init() {
  await refreshConfig();
  const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{5})/);
  if (m) connect(m[1].toUpperCase());
  render();
  window.addEventListener("popstate", () => location.reload());
})();
