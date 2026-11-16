// The Control Panel of the box, drawn as one SVG from the game state: silver-blue panel, blue (Pilot) and orange
// (Co-Pilot) spaces with switches, the attitude dial with its speed gauge, and the two sliding strips (Approach
// Track and Altitude Track) with their navy screens, cream tabs and airplane tokens.
import {
  COLORS, airport, cloud, coffeeIcon, cube, dieSVG, icon, landingPlane, moduleChip, planeToken, rerollIcon, screw,
  starBadge, PLANE_PATH,
} from "./art.js";

const STEP = 25; // degrees of dial per Axis mark
const CX = 620; // centre line of the panel
const PANEL = { x: 180, y: 600, w: 880, h: 950 };
const DIAL = { x: CX, y: 872, r: 150 };
const WIN_Y = 610; // top of the little screen where the current space shows
const CELL = 64;

const txt = (x, y, s, size = 18, fill = "#c8d4e0", anchor = "middle", extra = "") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Barlow Condensed, Barlow, sans-serif" font-weight="700" font-size="${size}" letter-spacing="1" fill="${fill}" ${extra}>${s}</text>`;
const rad = (deg) => (deg * Math.PI) / 180;
const polar = (cx, cy, r, deg) => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];

function defs() {
  return `<defs>
  <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7e2ea"/><stop offset="1" stop-color="#b3c4d1"/></linearGradient>
  <linearGradient id="gPilot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b83ee"/><stop offset="1" stop-color="#1b43b3"/></linearGradient>
  <linearGradient id="gCopilot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffae48"/><stop offset="1" stop-color="#e8650b"/></linearGradient>
  <linearGradient id="gAny" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3c74e3"/><stop offset=".45" stop-color="#7a82c0"/><stop offset=".55" stop-color="#d9894a"/><stop offset="1" stop-color="#f58a1f"/></linearGradient>
  <linearGradient id="navy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1730"/><stop offset=".7" stop-color="#0e2347"/><stop offset="1" stop-color="#12376a"/></linearGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9ea4aa"/><stop offset=".5" stop-color="#c3c7cb"/><stop offset="1" stop-color="#9ea4aa"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f8fe0"/><stop offset="1" stop-color="#8fd2f6"/></linearGradient>
  <linearGradient id="earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9824a"/><stop offset="1" stop-color="#6b4424"/></linearGradient>
  <linearGradient id="fuel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23a"/><stop offset=".5" stop-color="#f29a1c"/><stop offset="1" stop-color="#d93a2a"/></linearGradient>
  <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".45"/></filter>
  <clipPath id="disc"><circle r="${DIAL.r}"/></clipPath>
  <clipPath id="winclip"><rect x="-200" y="-400" width="1800" height="${WIN_Y + CELL + 400 + 3}"/></clipPath>
  </defs>`;
}

/** Is the selected die/token allowed on this slot (client-side mirror of the engine, for highlighting)? */
function legal(st, ui, sid) {
  const sel = ui.sel;
  if (!sel || st.result) return false;
  const s = st.slots[sid];
  if (!s || s.die || s.on) return false;
  if (sel.token && (s.kind === "conc" || s.kind === "intern")) return false;
  if (s.owner !== "any" && s.owner !== sel.seat && !sel.wild) return false;
  const v = sel.value + (sel.token ? 0 : ui.delta || 0);
  if (s.accepts && !s.accepts.includes(v)) return false;
  const order = Number(sid.split("_").pop());
  if (s.kind === "flaps" && [...Array(order).keys()].some((i) => !st.slots[`flaps_${i}`].on)) return false;
  if (s.kind === "brake" && [...Array(order).keys()].some((i) => !st.slots[`brake_${i}`].on)) return false;
  if (s.kind === "ice" && st.icePairs !== order) return false;
  if (s.kind === "intern") {
    if (!st.interns.length) return false;
    const next = sel.seat === "pilot" ? st.interns[0] : st.interns[st.interns.length - 1];
    if (v === next) return false;
  }
  return true;
}

const GLYPH = { radio: "radio", axis_pilot: "axis", axis_copilot: "axis", engine_pilot: "engine", engine_copilot: "engine" };

/** One space of the Control Panel: a blue / orange / two-tone square, with its die when occupied. */
function slot(st, ui, sid, cx, cy, o = {}) {
  const s = st.slots[sid];
  const size = o.size || 88, half = size / 2;
  const fill = s.owner === "pilot" ? "gPilot" : s.owner === "copilot" ? "gCopilot" : "gAny";
  const hot = legal(st, ui, sid);
  let b = `<rect x="${cx - half}" y="${cy - half + 4}" width="${size}" height="${size}" rx="${size * 0.17}" fill="#42566a" opacity=".55"/>`;
  b += `<rect x="${cx - half}" y="${cy - half}" width="${size}" height="${size}" rx="${size * 0.17}" fill="url(#${fill})" stroke="#10285f" stroke-opacity=".55" stroke-width="2"/>`;
  b += `<rect x="${cx - half + 5}" y="${cy - half + 5}" width="${size - 10}" height="${size - 10}" rx="${size * 0.12}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`;
  b += `<rect x="${cx - half + 4}" y="${cy - half + 4}" width="${size - 8}" height="${size * 0.4}" rx="${size * 0.12}" fill="#fff" opacity=".13"/>`;
  if (!s.die) {
    const glyph = GLYPH[sid] || (s.kind === "radio" ? "radio" : null);
    if (s.accepts) b += txt(cx, cy + size * 0.14, s.accepts.join("/"), size * 0.4, "#dbe8ff", "middle", `opacity=".8" stroke="#0b2a7a" stroke-opacity=".35" stroke-width=".8"`);
    else if (glyph) b += icon(glyph, cx, cy, size / 52, "#fff", 0.72);
    else if (o.label) b += txt(cx, cy + size * 0.14, o.label, size * 0.36, "#fff", "middle", `opacity=".75"`);
  } else {
    const d = s.die;
    const tone = d.seat === "pilot" ? "pilot" : "copilot";
    b += `<g transform="translate(${cx} ${cy})" filter="url(#shadow)">${dieSVG(d.value, tone, size * 0.8)}</g>`;
    if (d.coffee) b += `<g transform="translate(${cx + half - 6} ${cy - half + 6})">${coffeeIcon(0, 0, 0.5)}</g>`;
  }
  if (hot) b += `<rect class="pulse" x="${cx - half - 5}" y="${cy - half - 5}" width="${size + 10}" height="${size + 10}" rx="${size * 0.2}" fill="none" stroke="#fff" stroke-width="5"/>`;
  return `<g class="slot${hot ? " hot" : ""}${s.die ? " full" : ""}" data-slot="${sid}" ${hot ? `style="cursor:pointer"` : ""}>${b}<rect x="${cx - half - 5}" y="${cy - half - 5}" width="${size + 10}" height="${size + 10}" fill="transparent"/></g>`;
}

/** The little sliding switch beside a space: it covers the green light until the space has been used. */
function toggle(x, y, on, color = "#3fd06a") {
  const cap = on ? x + 22 : x - 22;
  return `<rect x="${x - 40}" y="${y - 14}" width="80" height="28" rx="9" fill="#7d8e9d" stroke="#5a6b7a" stroke-width="1.5"/>
    <circle cx="${x - 22}" cy="${y}" r="8" fill="${on ? color : "#31483c"}" ${on ? `filter="url(#glow)"` : ""}/>
    <rect x="${cap - 17}" y="${y - 11}" width="34" height="22" rx="6" fill="#eef3f7" stroke="#95a5b3" stroke-width="1.5" style="transition:all .4s"/>
    ${[0, 1, 2].map((r) => [0, 1].map((c) => `<circle cx="${cap - 5 + c * 10}" cy="${y - 6 + r * 6}" r="1.6" fill="#8b9bab"/>`).join("")).join("")}`;
}

// ------------------------------------------------------------------ strips
const LEVEL = COLORS.lvl;

function stripFrame(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="url(#silver)" stroke="#6f767d" stroke-width="2"/>`;
}

function turnTab(cx, y, allowed) {
  let g = `<rect x="${cx - 60}" y="${y}" width="120" height="36" rx="9" fill="#f4eedd" stroke="#b9ae92" stroke-width="1.5"/>`;
  for (let k = -2; k <= 2; k++) {
    const x = cx + k * 21, yy = y + 18 + Math.abs(k) * 2 + (Math.abs(k) === 2 ? 2 : 0), rot = k * 20;
    if (allowed.includes(k)) {
      g += `<g transform="translate(${x} ${yy}) rotate(${rot})"><path d="M-7,-6 L7,-6 L0,8Z" fill="${k === 0 ? "#111" : "#f4eedd"}" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/></g>`;
    } else {
      g += `<g transform="translate(${x} ${yy}) rotate(${rot})" stroke="#d3212a" stroke-width="3.2" stroke-linecap="round"><path d="M-5,-5 L5,5 M5,-5 L-5,5"/></g>`;
    }
  }
  return g;
}

function cubeTab(cx, y, n) {
  const w = 18 + n * 26;
  let g = `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="34" rx="7" fill="#f4eedd" stroke="#b9ae92" stroke-width="1.5"/>`;
  for (let i = 0; i < n; i++) g += cube(cx + (i - (n - 1) / 2) * 26, y + 17, 0.95);
  return g;
}

function header(x, y, w, h, color, code, name, mods, stars) {
  let g = `<path d="M${x},${y + h} V${y + 16} Q${x},${y} ${x + 16},${y} H${x + w - 16} Q${x + w},${y} ${x + w},${y + 16} V${y + h}Z" fill="${color}"/>`;
  g += `<path d="M${x},${y + h - 3} H${x + w}" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`;
  g += txt(x + 16, y + 32, code, 34, "#fff", "start") + txt(x + 16, y + 57, name, 19, "#fff", "start", `opacity=".95"`);
  let cx = x + w - 22;
  if (stars) { g += starBadge(stars, cx, y + 26, 0.8); cx -= 34; }
  [...mods].reverse().forEach((m) => { g += moduleChip(m, cx, y + 26, 0.8, "#fff", color === LEVEL.black ? "#1c1d20" : "#3b4f7a"); cx -= 31; });
  return g;
}

const STRIP = { appX: 305, altX: 685, w: 250, hh: 70 };

/** Slide a strip so that `row` sits in the screen; what lies above sticks out, what is behind it is hidden. */
function strip(inner, x, rows, row, hh) {
  const y0 = WIN_Y - row * CELL;
  const top = y0 - hh;
  return { top, svg: `<g clip-path="url(#winclip)">${stripFrame(x, top, STRIP.w, hh + rows * CELL + 6)}${inner(y0, top)}</g>` };
}

/** The Approach Track strip. Its cells run from the airport (top) to the clouds (bottom, where you start). */
function approach(st) {
  const sc = st.scenario, n = sc.length;
  const x = STRIP.appX, w = STRIP.w, hh = STRIP.hh;
  return strip((y0, top) => {
    let g = header(x, top, w, hh, LEVEL[sc.level], sc.code, sc.airport, sc.modules.map((m) => m.key), sc.abilities);
    for (let r = 0; r < n; r++) {
      const i = n - 1 - r, y = y0 + r * CELL;
      const here = i === st.position;
      g += `<rect x="${x + 12}" y="${y + 5}" width="${w - 24}" height="${CELL - 10}" rx="9" fill="url(#navy)" stroke="#05101f" stroke-width="2"/>`;
      g += `<rect x="${x + 6}" y="${y + CELL - 2}" width="${w - 12}" height="2" fill="#e8d9c9" opacity=".6"/>`;
      const mid = x + w / 2, cy = y + CELL / 2;
      if (i === n - 1) g += airport(mid + 14, cy - 2, 0.6);
      if (i === 0) g += cloud(mid - 44, cy + 2, 0.5) + cloud(mid + 4, cy - 4, 0.72) + cloud(mid + 56, cy + 4, 0.3);
      const tr = sc.traffic[i] || 0;
      if (tr) g += cubeTab(mid, y + CELL - 38, tr);
      const turn = sc.turns[i];
      if (turn) g += turnTab(mid, y - 12, turn);
      const cnt = st.planes[i] || 0;
      for (let k = 0; k < cnt; k++) {
        const col = Math.floor(k / 3), row = k % 3, rows = Math.min(3, cnt - col * 3);
        g += planeToken(x + 33 + col * 26, cy + (row - (rows - 1) / 2) * 18, 0.4, 45, 0.9);
      }
      if (here) g += `<rect x="${x + 8}" y="${y + 1}" width="${w - 16}" height="${CELL - 2}" rx="12" fill="none" stroke="#ffd23a" stroke-width="4.5" filter="url(#glow)"/>`;
    }
    return g;
  }, x, n, n - 1 - st.position, hh);
}

/** The Altitude Track strip: the aeroplane at the top, 1000 ft ... 6000 ft below; 6000 ft is round 1. */
function altitude(st) {
  const sc = st.scenario, x = STRIP.altX, w = STRIP.w, hh = 46, rows = 7;
  const dark = sc.level === "red" || sc.level === "black";
  return strip((y0, top) => {
    const c1 = dark ? LEVEL.red : LEVEL.green, c2 = dark ? LEVEL.black : LEVEL.yellow;
    let g = `<rect x="${x + 60}" y="${top + 9}" width="${w - 120}" height="14" rx="7" fill="${c1}"/><rect x="${x + 60}" y="${top + 27}" width="${w - 120}" height="14" rx="7" fill="${c2}"/>`;
    for (let r = 0; r < rows; r++) {
      const round = 7 - r, y = y0 + r * CELL; // the top cell is the final round
      const left = round % 2 === 1; // odd rounds: the Pilot (left, blue) plays first
      const frame = left ? "#3b9bff" : "#ffb21e";
      g += `<rect x="${x + 12}" y="${y + 5}" width="${w - 24}" height="${CELL - 10}" rx="10" fill="url(#navy)" stroke="${frame}" stroke-width="3.2"/>`;
      g += `<path d="M${x + 26},${y + 22} h${w - 52} M${x + 26},${y + CELL - 22} h${w - 52}" stroke="#7aa9e0" stroke-opacity=".18" stroke-width="2"/>`;
      const ax = left ? x + 27 : x + w - 27;
      g += `<path d="${left ? `M${ax - 3},${y + 17} l10,-6 v12Z` : `M${ax + 3},${y + 17} l-10,-6 v12Z`}" fill="${frame}"/>`;
      if (round === 7) g += landingPlane(x + w / 2, y + CELL / 2 + 2, 0.78);
      else g += `<text x="${x + w / 2 - 8}" y="${y + CELL / 2 + 11}" text-anchor="middle" font-family="Barlow, Arial" font-weight="800" font-size="31" letter-spacing="3" fill="#eef4ff">${(7 - round) * 1000}</text>`;
      if (sc.rerolls.includes(round)) g += rerollIcon(x + w - 42, y + CELL / 2, 0.62, round > st.round);
      if (round === st.round) g += `<rect x="${x + 8}" y="${y + 1}" width="${w - 16}" height="${CELL - 2}" rx="13" fill="none" stroke="#ffd23a" stroke-width="4.5" filter="url(#glow)"/>`;
    }
    return g;
  }, x, rows, 7 - st.round, hh);
}

// ------------------------------------------------------------------ dial, speed gauge, brakes
function dial(st, ui) {
  const { x, y, r } = DIAL;
  let g = `<circle cx="${x}" cy="${y}" r="${r + 30}" fill="#9db0bf" opacity=".5"/>`;
  g += `<g transform="translate(${x} ${y})"><g class="axisplane" data-deg="${st.axis * STEP}" style="transform:rotate(${(ui.fromAxis ?? st.axis) * STEP}deg);transition:transform .7s cubic-bezier(.3,1.4,.5,1)">
    <g clip-path="url(#disc)"><rect x="${-r}" y="${-r}" width="${2 * r}" height="${r}" fill="url(#sky)"/><rect x="${-r}" y="0" width="${2 * r}" height="${r}" fill="url(#earth)"/>
      <path d="M${-r},0 H${r}" stroke="#fff" stroke-width="3"/>
      <path d="M-42,-42 H42 M-28,-76 H28 M-42,42 H42 M-28,76 H28" stroke="#fff" stroke-opacity=".75" stroke-width="2.4"/>
      <path d="M0,-40 V-30 M0,40 V30" stroke="#fff" stroke-opacity=".6" stroke-width="2"/></g>
    <path d="M-136,4 L-18,-3 L18,-3 L136,4 L136,10 L16,5 L-16,5 L-136,10Z" fill="#f4f7fa" stroke="#7b8896" stroke-width="1.4"/>
    <ellipse cx="0" cy="2" rx="12" ry="16" fill="#f4f7fa" stroke="#7b8896" stroke-width="1.4"/>
    <path d="M-5,-12 L0,-26 L5,-12Z" fill="#f4f7fa" stroke="#7b8896" stroke-width="1.2"/>
    <path d="M-7,${-r + 22} L7,${-r + 22} L0,${-r + 6}Z" fill="#fff" stroke="#9aa6b2" stroke-width="1.5" transform="rotate(0)"/>
    <circle r="8" fill="#e8eef3" stroke="#7b8896" stroke-width="1.5"/></g></g>`;
  // fixed bezel with the marks
  const ring = (a0, a1, r0, r1) => {
    const [x0, y0] = polar(x, y, r1, a0), [x1, y1] = polar(x, y, r1, a1), [x2, y2] = polar(x, y, r0, a1), [x3, y3] = polar(x, y, r0, a0);
    return `M${x0},${y0} A${r1},${r1} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 0 ${x3},${y3}Z`;
  };
  g += `<path d="${ring(0, 360, r, r + 12)}" fill="#1a1d22"/>`;
  g += `<path d="${ring(-96, 96, r, r + 30)}" fill="#202429" stroke="#0a0c0f" stroke-width="2"/>`;
  for (const k of [-2, -1, 0, 1, 2]) {
    const [tx, ty] = polar(x, y, r + 8, k * STEP);
    g += `<g transform="translate(${tx} ${ty}) rotate(${k * STEP + 180})"><path d="M-7,-6 L7,-6 L0,8Z" transform="rotate(180)" fill="${k === 0 ? "#0a0a0a" : "#f1f3f5"}" stroke="${k === 0 ? "#f1f3f5" : "#0a0a0a"}" stroke-width="1.6" stroke-linejoin="round"/></g>`;
  }
  for (const k of [-3, 3]) {
    const [tx, ty] = polar(x, y, r + 19, k * STEP);
    g += `<g transform="translate(${tx} ${ty})" stroke="#e8352d" stroke-width="5" stroke-linecap="round"><path d="M-7,-7 L7,7 M7,-7 L-7,7"/></g>`;
  }
  return g;
}

const gaugeAngle = (n) => 250 - (n - 2) * 14;

function gauge(st) {
  const { x, y } = DIAL, R = 200;
  const arc = (a0, a1, rr) => {
    const [x0, y0] = polar(x, y, rr, a0), [x1, y1] = polar(x, y, rr, a1);
    return `M${x0},${y0} A${rr},${rr} 0 0 0 ${x1},${y1}`;
  };
  let g = `<path d="${arc(260, 100, R)}" fill="none" stroke="#1c2230" stroke-width="46" stroke-linecap="round"/><path d="${arc(260, 100, R)}" fill="none" stroke="#2b3447" stroke-width="40" stroke-linecap="round"/>`;
  for (let n = 2; n <= 12; n++) {
    const a = gaugeAngle(n), [px, py] = polar(x, y, R, a);
    const on = st.speed === n;
    g += `<g transform="translate(${px} ${py}) rotate(${a - 180})">${on ? `<rect x="-17" y="-19" width="34" height="36" rx="8" fill="#ffd23a" opacity=".95"/>` : ""}<text y="9" text-anchor="middle" font-family="Barlow, Arial" font-weight="800" font-size="24" fill="${on ? "#1a1a1a" : "#f4f7fa"}">${n}</text></g>`;
  }
  const marker = (after, color, dark) => {
    const a = (gaugeAngle(after) + gaugeAngle(after + 1)) / 2, [px, py] = polar(x, y, R + 30, a);
    return `<g transform="translate(${px} ${py}) rotate(${a - 180})" filter="url(#shadow)"><path d="M-9,-14 H9 L12,6 L0,24 L-12,6Z" fill="${color}" stroke="${dark}" stroke-width="2.2" stroke-linejoin="round"/><path d="M0,-8 V14" stroke="#fff" stroke-opacity=".6" stroke-width="2"/></g>`;
  };
  g += marker(st.blue, "#2d6be0", "#0b2a77") + marker(st.orange, "#f58a1f", "#8f3d05");
  return g;
}

function brakeArc(st, ice) {
  const xs = (i) => CX + (i - 4) * (ice ? 0 : 70);
  if (ice) return "";
  let g = "";
  for (let i = 2; i <= 6; i++) {
    const px = xs(i), py = 1274 - (i - 4) * (i - 4) * 6;
    g += `<rect x="${px - 22}" y="${py - 20}" width="44" height="40" rx="8" fill="#242c3c"/>` + txt(px, py + 9, i, 26, "#f4f7fa", "middle", `font-family="Barlow, Arial" font-weight="800"`);
  }
  const after = st.brakeLimit ? st.brakeLimit - 1 : 1;
  const bx = after <= 1 ? xs(2) - 38 : (xs(after) + xs(after + 1)) / 2;
  const by = 1274 - ((after <= 1 ? 2 : after + 0.5) - 4) ** 2 * 6;
  g += `<g transform="translate(${bx} ${by - 30})" filter="url(#shadow)"><path d="M-10,-4 H10 V10 L0,24 L-10,10Z" fill="#d9322a" stroke="#6b0f0a" stroke-width="2.2" stroke-linejoin="round"/></g>`;
  return g;
}

// ------------------------------------------------------------------ the panel
function panel(st, ui) {
  const ice = st.scenario.modules.some((m) => m.key === "ice");
  let g = `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="34" fill="url(#panel)" stroke="#8da0b0" stroke-width="5" filter="url(#shadow)"/>`;
  g += `<rect x="${PANEL.x + 12}" y="${PANEL.y + 12}" width="${PANEL.w - 24}" height="${PANEL.h - 24}" rx="26" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>`;
  g += [[PANEL.x + 22, PANEL.y + 22], [PANEL.x + PANEL.w - 22, PANEL.y + 22], [PANEL.x + 22, PANEL.y + PANEL.h - 22], [PANEL.x + PANEL.w - 22, PANEL.y + PANEL.h - 22]].map(([a, b]) => screw(a, b)).join("");
  const lbl = (x, y, s, anchor = "middle") => txt(x, y, s, 15, "#5f7a95", anchor);
  // dial with axis spaces
  g += dial(st, ui) + gauge(st);
  g += slot(st, ui, "axis_pilot", 392, 800) + slot(st, ui, "axis_copilot", 848, 800) + lbl(392, 868, "AXIS") + lbl(848, 868, "AXIS");
  // engines
  g += slot(st, ui, "engine_pilot", 470, 1162, { size: 94 }) + slot(st, ui, "engine_copilot", 770, 1162, { size: 94 });
  g += lbl(CX, 1136, "ENGINES");
  g += `<rect x="${CX - 42}" y="1146" width="84" height="38" rx="9" fill="#1f2735"/>` + txt(CX, 1174, st.speed === null ? "–" : st.speed, 26, st.speed === null ? "#6b7a90" : "#ffd23a", "middle", `font-family="Barlow, Arial" font-weight="800"`);
  // left column: reroll, radio, landing gear
  g += `<rect x="182" y="620" width="116" height="74" rx="14" fill="url(#navy)" stroke="#6e8196" stroke-width="3"/>`;
  for (let i = 0; i < 3; i++) g += rerollIcon(212 + i * 38, 657, 0.56, i < st.rerolls);
  g += lbl(240, 712, "REROLL");
  g += slot(st, ui, "radio_pilot", 240, 790) + lbl(240, 862, "RADIO");
  for (let i = 0; i < 3; i++) {
    const y = 970 + i * 142;
    g += slot(st, ui, `gear_${i}`, 240, y) + toggle(240, y + 66, st.slots[`gear_${i}`].on);
  }
  g += lbl(240, 912, "LANDING GEAR");
  // right column: radio and flaps
  g += slot(st, ui, "radio_copilot_1", 1000, 668) + slot(st, ui, "radio_copilot_2", 1000, 772) + lbl(1000, 846, "RADIO");
  for (let i = 0; i < 4; i++) {
    const y = 970 + i * 140;
    g += slot(st, ui, `flaps_${i}`, 1000, y) + toggle(1000, y + 64, st.slots[`flaps_${i}`].on);
  }
  g += lbl(1000, 912, "FLAPS");
  // brakes
  g += lbl(CX, ice ? 1229 : 1236, ice ? "ICE BRAKES" : "BRAKES");
  if (ice) g += iceBoard(st, ui);
  else {
    g += brakeArc(st, false);
    for (let i = 0; i < 3; i++) {
      const x = CX + (i - 1) * 130;
      g += slot(st, ui, `brake_${i}`, x, 1352, { size: 82 }) + toggle(x, 1412, st.slots[`brake_${i}`].on, "#e8352d");
    }
  }
  // concentration + coffee
  g += lbl(330, 1456, "COFFEE") + lbl(675, 1456, "CONCENTRATION");
  for (let i = 0; i < 3; i++) {
    const x = 268 + i * 66;
    g += `<circle cx="${x}" cy="1496" r="26" fill="#27384c" stroke="#8da0b0" stroke-width="3"/>` + (i < st.coffee ? coffeeIcon(x, 1492, 0.95) : icon("coffee", x, 1496, 1, "#6d8197", 0.7));
  }
  for (let i = 0; i < 3; i++) g += slot(st, ui, `conc_${i}`, 560 + i * 115, 1496, { size: 82 });
  return g;
}

function iceBoard(st, ui) {
  const xs = [CX - 150, CX - 50, CX + 50, CX + 150];
  let g = `<rect x="${CX - 218}" y="1240" width="436" height="198" rx="14" fill="#c4d0d9" stroke="#7d8e9c" stroke-width="3"/>`;
  g += `<rect x="${CX - 205}" y="1329" width="410" height="30" rx="6" fill="#171b22"/>`;
  [2, 3, 4, 5].forEach((v, i) => { g += txt(xs[i], 1351, v, 22, "#f4f7fa", "middle", `font-family="Barlow, Arial" font-weight="800"`); });
  for (let i = 0; i < 3; i++) g += `<path d="M${(xs[i] + xs[i + 1]) / 2 - 7},1344 l14,0 M${(xs[i] + xs[i + 1]) / 2},1337 v14" stroke="#9fc4ee" stroke-width="2" opacity=".8"/>`;
  const after = st.icePairs + 1;
  const mx = after <= 1 ? xs[0] - 44 : after >= 5 ? xs[3] + 44 : (xs[after - 2] + xs[after - 1]) / 2;
  g += `<path d="M${mx - 9},1334 h18 v10 l-9,12 l-9,-12Z" transform="translate(0 -4)" fill="#d9322a" stroke="#6b0f0a" stroke-width="2"/>`;
  xs.forEach((x, i) => {
    g += slot(st, ui, `ice_pilot_${i}`, x, 1282, { size: 64 }) + slot(st, ui, `ice_copilot_${i}`, x, 1400, { size: 64 });
  });
  return g;
}

// ------------------------------------------------------------------ modules
function kerosene(st, ui) {
  const sc = st.scenario, leak = sc.modules.some((m) => m.key === "leak");
  const x = 62, top = 706, step = 36.6;
  const yv = (k) => top + (20 - k) * step;
  let g = `<rect x="10" y="590" width="150" height="960" rx="22" fill="url(#panel)" stroke="#8da0b0" stroke-width="5" filter="url(#shadow)"/>`;
  g += `<rect x="62" y="${top - 14}" width="52" height="${(20) * step + 34}" rx="10" fill="url(#fuel)" stroke="#6a4a10" stroke-width="3"/>`;
  for (let k = 20; k >= 1; k--) g += txt(50, yv(k) + 5, k, 14, "#4d6178", "end") + `<path d="M62,${yv(k)} h12" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>`;
  g += `<g transform="translate(88 ${yv(0) + 4})" stroke="#2a0a08" stroke-width="5" stroke-linecap="round"><path d="M-9,-9 L9,9 M9,-9 L-9,9"/></g>`;
  const ky = yv(Math.max(0, Math.min(20, st.kerosene)));
  g += `<g transform="translate(88 ${ky})" filter="url(#shadow)"><path d="M-26,-12 H30 V12 H-26 L-38,0Z" fill="#eef2f5" stroke="#7b8896" stroke-width="2.5"/><text x="-2" y="7" text-anchor="middle" font-family="Barlow, Arial" font-weight="800" font-size="18" fill="#1d2b3d">${Math.max(0, st.kerosene)}</text></g>`;
  g += txt(85, 612, leak ? "LEAK" : "KEROSENE", 14, "#5f7a95");
  if (leak) g += `<rect x="50" y="622" width="70" height="70" rx="12" fill="#1b2230" stroke="#e8352d" stroke-width="3"/><g transform="translate(85 657)" stroke="#e8352d" stroke-width="9" stroke-linecap="round"><path d="M-16,-16 L16,16 M16,-16 L-16,16"/></g>`;
  else g += slot(st, ui, "kerosene", 85, 657, { size: 72 }) + `<rect x="108" y="618" width="42" height="22" rx="6" fill="#e8352d"/>` + txt(129, 635, "−6", 16, "#fff");
  return g;
}

function windRing(st) {
  const cx = 1158, cy = 760, R = 62, n = st.windRing.length;
  let g = `<rect x="1074" y="610" width="170" height="300" rx="22" fill="url(#panel)" stroke="#8da0b0" stroke-width="5" filter="url(#shadow)"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${R + 17}" fill="#7e97a6"/><circle cx="${cx}" cy="${cy}" r="${R - 19}" fill="#2a58b8"/>`;
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i, [px, py] = polar(cx, cy, R, a), on = i === st.wind, v = st.windRing[i];
    g += `<g transform="translate(${px} ${py}) rotate(${a})">${on ? `<rect x="-10" y="-11" width="20" height="22" rx="5" fill="#ffd23a"/>` : ""}<text y="5" text-anchor="middle" font-family="Barlow, Arial" font-weight="800" font-size="12" fill="${on ? "#1a1a1a" : "#f4f7fa"}">${v > 0 ? "+" : ""}${v}</text></g>`;
  }
  g += `<g transform="translate(${cx} ${cy}) rotate(${(360 / n) * st.wind}) scale(.8)" filter="url(#shadow)"><path d="${PLANE_PATH}" fill="#f4f7fa" stroke="#8a97a6" stroke-width="1.5"/></g>`;
  g += txt(cx, 640, "WIND", 15, "#5f7a95") + txt(cx, 892, `${st.windSpeed > 0 ? "+" : ""}${st.windSpeed} ENGINES`, 17, "#1d3a6a");
  return g;
}

function internBoard(st, ui) {
  const y = 1612, left = st.internLeft || 0, rem = st.interns.length;
  let g = `<rect x="180" y="1568" width="880" height="86" rx="18" fill="url(#panel)" stroke="#8da0b0" stroke-width="5" filter="url(#shadow)"/>`;
  g += slot(st, ui, "intern_pilot", 244, y, { size: 66 }) + slot(st, ui, "intern_copilot", 996, y, { size: 66 });
  for (let i = 0; i < 6; i++) {
    const x = 354 + i * 102, v = st.interns[i - left];
    const has = i >= left && i < left + rem;
    if (has) {
      g += `<g transform="translate(${x} ${y})"><path d="M-12,-34 L0,-18 L12,-34Z" fill="#2f9a48"/><rect x="-26" y="-24" width="52" height="52" rx="9" fill="#f4eedd" stroke="#2f9a48" stroke-width="4"/><text y="15" text-anchor="middle" font-family="Barlow, Arial" font-weight="800" font-size="36" fill="#1b3d73">${v}</text></g>`;
    } else g += `<g transform="translate(${x} ${y})"><rect x="-26" y="-24" width="52" height="52" rx="9" fill="#1d7a3a"/><path d="M-12,2 l8,9 l16,-19" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  return g;
}

export function boardSVG(st, ui) {
  const keys = st.scenario.modules.map((m) => m.key);
  const fuel = keys.includes("kerosene") || keys.includes("leak");
  const wind = keys.includes("wind"), intern = keys.includes("intern");
  const x0 = fuel ? 0 : 168, x1 = wind ? 1256 : 1078, y1 = intern ? 1666 : 1564;
  const top = Math.min(WIN_Y - (st.scenario.length - 1) * CELL - STRIP.hh, WIN_Y - 6 * CELL - 46) - 16;
  return `<svg viewBox="${x0} ${top} ${x1 - x0} ${y1 - top}" class="board" xmlns="http://www.w3.org/2000/svg">${defs()}
    ${panel(st, ui)}${altitude(st).svg}${approach(st).svg}${fuel ? kerosene(st, ui) : ""}${wind ? windRing(st) : ""}${intern ? internBoard(st, ui) : ""}</svg>`;
}

export { dieSVG, legal };
