// The cockpit, drawn as one SVG from the game state: a machined control panel with backlit Pilot (blue) and
// Co-Pilot (orange) spaces and LED switches, an attitude indicator ringed by the speed gauge, and the two strips
// (Approach and Altitude) that slide under the panel's screen window.
//
// Animation: when `ui.prev` holds the previous game state, every moving part is rendered at its old position with a
// `data-tw` target; app.js flips it to the target after the first paint, so CSS transitions do the tweening.
// One-shot effects (dice dropping in, airplanes flying off, coffee popping) are CSS keyframe classes.
import {
  COLORS, airport, cloud, coffeeIcon, cube, dieSVG, icon, landingPlane, moduleChip, planeToken, rerollIcon,
  starBadge, PLANE_PATH,
} from "./art.js";

const STEP = 25; // degrees of dial per Axis mark
const CX = 620; // centre line of the panel
const PANEL = { x: 180, y: 600, w: 880, h: 950 };
const DIAL = { x: CX, y: 872, r: 146 };
const WIN_Y = 610; // top of the screen window where the current space shows
const CELL = 64;
const STRIP = { appX: 305, altX: 685, w: 250, hh: 70 };
const FONT = `font-family="Barlow Condensed, Barlow, sans-serif"`;
const EASE = "cubic-bezier(.55,0,.25,1)";

const txt = (x, y, s, size = 18, fill = "#c8d4e0", anchor = "middle", extra = "") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" ${FONT} font-weight="700" font-size="${size}" letter-spacing="1" fill="${fill}" ${extra}>${s}</text>`;
/** Engraved label: dark letters with a light lower edge, as if cut into the panel. */
const lbl = (x, y, s, anchor = "middle", size = 15) =>
  txt(x, y + 1.2, s, size, "#ffffff", anchor, `opacity=".75" letter-spacing="2.5"`) + txt(x, y, s, size, "#4b5f74", anchor, `letter-spacing="2.5"`);
const rad = (deg) => (deg * Math.PI) / 180;
const polar = (cx, cy, r, deg) => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];
const arcPath = (cx, cy, rr, a0, a1) => {
  const [x0, y0] = polar(cx, cy, rr, a0), [x1, y1] = polar(cx, cy, rr, a1);
  return `M${x0},${y0} A${rr},${rr} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${x1},${y1}`;
};

/** Attributes of an element that tweens its CSS transform from the previous state to the current one. */
function tw(from, to, dur = 0.9, delay = 0) {
  const t = `transition:transform ${dur}s ${EASE} ${delay}s`;
  return from == null || from === to ? `style="transform:${to}"` : `style="transform:${from};${t}" data-tw="${to}"`;
}

function defs() {
  return `<defs>
  <linearGradient id="panelG" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#e9eef2"/><stop offset=".55" stop-color="#d3dbe2"/><stop offset="1" stop-color="#bcc7d1"/></linearGradient>
  <linearGradient id="bayG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3ced8"/><stop offset="1" stop-color="#d0d9e1"/></linearGradient>
  <linearGradient id="well" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d4956"/><stop offset=".5" stop-color="#5b6875"/><stop offset="1" stop-color="#a3b0bc"/></linearGradient>
  <radialGradient id="pP" cx=".5" cy=".28" r=".85"><stop offset="0" stop-color="#6fa6ff"/><stop offset=".55" stop-color="#2f66dc"/><stop offset="1" stop-color="#173f9f"/></radialGradient>
  <radialGradient id="pC" cx=".5" cy=".28" r=".85"><stop offset="0" stop-color="#ffc370"/><stop offset=".55" stop-color="#f3841d"/><stop offset="1" stop-color="#bf5306"/></radialGradient>
  <linearGradient id="pA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4b82ee"/><stop offset=".499" stop-color="#2556c6"/><stop offset=".501" stop-color="#f58a1f"/><stop offset="1" stop-color="#c95a08"/></linearGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="frame" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b333d"/><stop offset=".08" stop-color="#4a5562"/><stop offset=".5" stop-color="#363f4a"/><stop offset=".92" stop-color="#4a5562"/><stop offset="1" stop-color="#2b333d"/></linearGradient>
  <linearGradient id="cellG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1830"/><stop offset=".65" stop-color="#0f2547"/><stop offset="1" stop-color="#16345f"/></linearGradient>
  <linearGradient id="lcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1219"/><stop offset="1" stop-color="#1c2531"/></linearGradient>
  <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f9fb"/><stop offset=".45" stop-color="#9aa6b2"/><stop offset=".55" stop-color="#7d8995"/><stop offset="1" stop-color="#d8dee4"/></linearGradient>
  <radialGradient id="knob" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#c4ccd4"/><stop offset="1" stop-color="#7c8893"/></radialGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f5fb8"/><stop offset=".75" stop-color="#3f9fe6"/><stop offset="1" stop-color="#8fd0f5"/></linearGradient>
  <linearGradient id="earth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6634"/><stop offset="1" stop-color="#4a2d14"/></linearGradient>
  <radialGradient id="glass" cx=".32" cy=".18" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".4" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="vignette" cx=".5" cy=".5" r=".5"><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
  <linearGradient id="tok" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9d3dd"/></linearGradient>
  <linearGradient id="fuel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset=".55" stop-color="#f5a524"/><stop offset="1" stop-color="#e2492d"/></linearGradient>
  <linearGradient id="cream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf6e8"/><stop offset="1" stop-color="#e6dcc2"/></linearGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch" seed="4"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .25  0 0 0 0 .3  0 0 0 .09 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <filter id="inner" x="-10%" y="-10%" width="120%" height="120%"><feFlood flood-color="#06121f" flood-opacity=".55"/><feComposite in2="SourceAlpha" operator="out"/><feOffset dy="2.5"/><feGaussianBlur stdDeviation="2.4"/><feComposite in2="SourceAlpha" operator="in" result="s"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="s"/></feMerge></filter>
  <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="bloom" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#0a1522" flood-opacity=".45"/></filter>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0a1522" flood-opacity=".4"/></filter>
  <clipPath id="disc"><circle r="${DIAL.r}"/></clipPath>
  <clipPath id="winclip"><rect x="-200" y="-600" width="1800" height="${WIN_Y + CELL + 600 + 4}"/></clipPath>
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

// ------------------------------------------------------------------ panel parts
const GLYPH = { radio: "radio", axis_pilot: "axis", axis_copilot: "axis", engine_pilot: "engine", engine_copilot: "engine" };

/** A recessed bay that groups controls. */
const bay = (x, y, w, h, r = 18) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#bayG)" filter="url(#inner)"/>` +
  `<path d="M${x + r},${y + h + 0.8} H${x + w - r}" stroke="#fff" stroke-opacity=".7" stroke-width="1.6"/>`;

const screw = (x, y, a = 30) => `<g transform="translate(${x} ${y})"><circle r="7.5" fill="#8d9aa6"/><circle r="6.5" fill="url(#knob)"/><path d="M-4,0 H4" stroke="#58636e" stroke-width="1.8" transform="rotate(${a})"/></g>`;

/** One space of the Control Panel: a backlit square in a machined well, with its die when occupied. */
function slot(st, ui, sid, cx, cy, o = {}) {
  const s = st.slots[sid];
  const P = ui.prev;
  const size = o.size || 86, half = size / 2, r = size * 0.2;
  const fill = s.owner === "pilot" ? "pP" : s.owner === "copilot" ? "pC" : "pA";
  const hot = legal(st, ui, sid);
  let b = `<rect x="${cx - half - 6}" y="${cy - half - 6}" width="${size + 12}" height="${size + 12}" rx="${r + 5}" fill="url(#well)"/>`;
  b += `<rect x="${cx - half}" y="${cy - half}" width="${size}" height="${size}" rx="${r}" fill="url(#${fill})" filter="url(#inner)" ${s.die ? `opacity=".8"` : ""}/>`;
  b += `<rect x="${cx - half + 3}" y="${cy - half + 3}" width="${size - 6}" height="${size * 0.45}" rx="${r * 0.8}" fill="url(#gloss)"/>`;
  b += `<rect x="${cx - half + 0.5}" y="${cy - half + 0.5}" width="${size - 1}" height="${size - 1}" rx="${r}" fill="none" stroke="#fff" stroke-opacity=".28"/>`;
  if (hot) b += `<rect x="${cx - half}" y="${cy - half}" width="${size}" height="${size}" rx="${r}" fill="#fff" class="hotfill"/>`;
  if (!s.die) {
    const glyph = GLYPH[sid] || (s.kind === "radio" ? "radio" : null);
    const ink = `stroke="#0b2457" stroke-opacity=".25" stroke-width="1" paint-order="stroke"`;
    if (s.accepts) b += txt(cx, cy + size * 0.15, s.accepts.join("·"), size * (s.accepts.length > 2 ? 0.3 : 0.42), "#f4f8ff", "middle", `font-weight="800" ${ink}`);
    else if (glyph) b += icon(glyph, cx, cy, size / 50, "#fff", 0.9);
    else if (o.label) b += txt(cx, cy + size * 0.14, o.label, size * 0.36, "#fff", "middle", `opacity=".85"`);
  } else {
    const d = s.die;
    const fresh = P && !P.slots[sid]?.die;
    b += `<g class="${fresh ? "drop" : ""}"><g transform="translate(${cx} ${cy})">${dieSVG(d.value, d.seat === "pilot" ? "pilot" : "copilot", size * 0.78)}</g></g>`;
    if (d.coffee) b += `<g transform="translate(${cx + half - 4} ${cy - half + 4})">${coffeeIcon(0, 0, 0.5)}</g>`;
  }
  if (hot) b += `<rect class="pulse" x="${cx - half - 7}" y="${cy - half - 7}" width="${size + 14}" height="${size + 14}" rx="${r + 6}" fill="none" stroke="#fff" stroke-width="4" filter="url(#glow)"/>`;
  return `<g class="slot${hot ? " hot" : ""}${s.die ? " full" : ""}" data-slot="${sid}" ${hot ? `style="cursor:pointer"` : ""}>${b}<rect x="${cx - half - 7}" y="${cy - half - 7}" width="${size + 14}" height="${size + 14}" fill="transparent"/></g>`;
}

/** The switch under a space: an LED and a slide knob that moves across once the space is done. */
function toggle(x, y, on, was, color = "#3fe07a") {
  const off = color === "#3fe07a" ? "#173a26" : "#3d1716";
  let g = `<rect x="${x - 42}" y="${y - 13}" width="84" height="26" rx="13" fill="url(#well)"/>`;
  g += `<rect x="${x - 40}" y="${y - 11}" width="80" height="22" rx="11" fill="#1d252e" filter="url(#inner)"/>`;
  g += `<circle cx="${x - 26}" cy="${y}" r="6.5" fill="${on ? color : off}"/>`;
  if (on) g += `<circle cx="${x - 26}" cy="${y}" r="9" fill="${color}" filter="url(#bloom)" class="${was === false ? "ledon" : ""}"/><circle cx="${x - 28}" cy="${y - 2}" r="2.2" fill="#fff" opacity=".8"/>`;
  g += `<path d="M${x - 10},${y} H${x + 30}" stroke="#0b0f14" stroke-width="3" stroke-linecap="round"/>`;
  const kx = (v) => `translate(${v ? 22 : 0}px,0px)`;
  g += `<g ${tw(was == null ? null : kx(was), kx(on), 0.5, 0.15)}><g transform="translate(${x - 4} ${y})" filter="url(#soft)"><rect x="-11" y="-9" width="22" height="18" rx="5" fill="url(#knob)" stroke="#6c7884"/>
    <path d="M-4,-4 V4 M0,-4 V4 M4,-4 V4" stroke="#7f8b96" stroke-width="1.4"/></g></g>`;
  return g;
}

// ------------------------------------------------------------------ strips
const LEVEL = COLORS.lvl;

function turnTab(cx, y, allowed) {
  let g = `<g filter="url(#soft)"><rect x="${cx - 62}" y="${y}" width="124" height="34" rx="9" fill="url(#cream)" stroke="#a89c7c" stroke-width="1.2"/></g>`;
  for (let k = -2; k <= 2; k++) {
    const x = cx + k * 22, yy = y + 17 + Math.abs(k) * 1.5, rot = k * 18;
    if (allowed.includes(k)) {
      g += `<g transform="translate(${x} ${yy}) rotate(${rot})"><path d="M-7,-6 L7,-6 L0,8Z" fill="${k === 0 ? "#151a22" : "#fbf6e8"}" stroke="#151a22" stroke-width="1.8" stroke-linejoin="round"/></g>`;
    } else {
      g += `<g transform="translate(${x} ${yy}) rotate(${rot})" stroke="#d3212a" stroke-width="3.2" stroke-linecap="round"><path d="M-5,-5 L5,5 M5,-5 L-5,5"/></g>`;
    }
  }
  return g;
}

function cubeTab(cx, y, n) {
  const w = 18 + n * 26;
  let g = `<g filter="url(#soft)"><rect x="${cx - w / 2}" y="${y}" width="${w}" height="32" rx="8" fill="url(#cream)" stroke="#a89c7c" stroke-width="1.2"/></g>`;
  for (let i = 0; i < n; i++) g += cube(cx + (i - (n - 1) / 2) * 26, y + 16, 0.92);
  return g;
}

function header(x, y, w, h, color, code, name, mods, stars) {
  let g = `<path d="M${x},${y + h} V${y + 16} Q${x},${y} ${x + 16},${y} H${x + w - 16} Q${x + w},${y} ${x + w},${y + 16} V${y + h}Z" fill="${color}"/>`;
  g += `<path d="M${x},${y + h} V${y + 16} Q${x},${y} ${x + 16},${y} H${x + w - 16} Q${x + w},${y} ${x + w},${y + 16} V${y + h}Z" fill="url(#gloss)" opacity=".6"/>`;
  g += `<path d="M${x + 6},${y + h - 2} H${x + w - 6}" stroke="#000" stroke-opacity=".25" stroke-width="3"/>`;
  g += txt(x + 16, y + 34, code, 36, "#fff", "start", `font-weight="800" letter-spacing="2"`) + txt(x + 16, y + 58, name, 17, "#fff", "start", `opacity=".92" font-weight="600"`);
  let cx = x + w - 22;
  if (stars) { g += starBadge(stars, cx, y + 27, 0.8); cx -= 34; }
  [...mods].reverse().forEach((m) => { g += moduleChip(m, cx, y + 27, 0.8, "#fff", color === LEVEL.black ? "#1c1d20" : "#3b4f7a"); cx -= 31; });
  return g;
}

/** A strip, drawn with its first cell at y=0, slid so that `row` sits in the screen window. */
function strip(x, w, hh, rows, row, prevRow, inner) {
  const y = (r) => `translate(0px,${WIN_Y - r * CELL}px)`;
  const body = `<rect x="${x}" y="${-hh}" width="${w}" height="${hh + rows * CELL + 8}" rx="16" fill="url(#frame)"/>
    <rect x="${x + 1.5}" y="${-hh + 1.5}" width="${w - 3}" height="${hh + rows * CELL + 5}" rx="15" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.5"/>${inner}`;
  return `<g clip-path="url(#winclip)"><g ${tw(prevRow == null ? null : y(prevRow), y(row), 1.1)}><g filter="url(#shadow)">${body}</g></g></g>`;
}

function cellBox(x, y, w) {
  return `<rect x="${x + 11}" y="${y + 5}" width="${w - 22}" height="${CELL - 10}" rx="9" fill="url(#cellG)" stroke="#050b16" stroke-width="2"/>
    <path d="M${x + 20},${y + 6.5} H${x + w - 20}" stroke="#7fa8ea" stroke-opacity=".28" stroke-width="1.5"/>`;
}

/** The Approach Track strip: the airport at the top, the clouds (start) at the bottom. */
function approach(st, ui) {
  const sc = st.scenario, n = sc.length, P = ui.prev;
  const x = STRIP.appX, w = STRIP.w, hh = STRIP.hh;
  let g = header(x, -hh, w, hh, LEVEL[sc.level], sc.code, sc.airport, sc.modules.map((m) => m.key), sc.abilities);
  for (let r = 0; r < n; r++) {
    const i = n - 1 - r, y = r * CELL, mid = x + w / 2, cy = y + CELL / 2;
    g += cellBox(x, y, w);
    if (i === n - 1) g += airport(mid + 14, cy - 2, 0.6);
    if (i === 0) g += cloud(mid - 44, cy + 2, 0.5) + cloud(mid + 4, cy - 4, 0.72) + cloud(mid + 56, cy + 4, 0.3);
    const tr = sc.traffic[i] || 0;
    if (tr) g += cubeTab(mid, y + CELL - 36, tr);
    const turn = sc.turns[i];
    if (turn) g += turnTab(mid, y - 11, turn);
    const cnt = st.planes[i] || 0, before = P ? P.planes[i] || 0 : cnt;
    const at = (k) => {
      const col = Math.floor(k / 3), row = k % 3, rows = Math.min(3, Math.max(cnt, before) - col * 3);
      return [x + 36 + col * 27, cy + (row - (rows - 1) / 2) * 17];
    };
    for (let k = 0; k < Math.max(cnt, before); k++) {
      const [px, py] = at(k);
      const cls = k >= cnt ? "flyaway" : k >= before ? "flyin" : "";
      const delay = cls ? `style="animation-delay:${(k - Math.min(cnt, before)) * 0.18}s"` : "";
      g += `<g class="${cls}" ${delay}>${planeToken(px, py, 0.4, 45, 0.9)}</g>`;
    }
  }
  const row = n - 1 - st.position, prevRow = P ? n - 1 - P.position : null;
  return strip(x, w, hh, n, row, prevRow, g);
}

/** The Altitude Track strip: the final approach at the top, 6000 ft (round 1) at the bottom. */
function altitude(st, ui) {
  const sc = st.scenario, P = ui.prev, x = STRIP.altX, w = STRIP.w, hh = 46, rows = 7;
  const dark = sc.level === "red" || sc.level === "black";
  const c1 = dark ? LEVEL.red : LEVEL.green, c2 = dark ? LEVEL.black : LEVEL.yellow;
  let g = `<rect x="${x + 58}" y="${-hh + 9}" width="${w - 116}" height="13" rx="6.5" fill="${c1}"/><rect x="${x + 58}" y="${-hh + 26}" width="${w - 116}" height="13" rx="6.5" fill="${c2}"/>`;
  for (let r = 0; r < rows; r++) {
    const round = 7 - r, y = r * CELL, cy = y + CELL / 2;
    const left = round % 2 === 1; // odd rounds: the Pilot (left, blue) plays first
    const accent = left ? "#4c92ff" : "#ffad2e";
    g += cellBox(x, y, w);
    g += `<rect x="${left ? x + 11 : x + w - 17}" y="${y + 5}" width="6" height="${CELL - 10}" rx="3" fill="${accent}"/>`;
    const ax = left ? x + 29 : x + w - 29;
    g += `<path d="${left ? `M${ax - 4},${cy} l11,-7 v14Z` : `M${ax + 4},${cy} l-11,-7 v14Z`}" fill="${accent}"/>`;
    if (round === 7) g += landingPlane(x + w / 2, cy + 2, 0.74);
    else g += `<text x="${x + w / 2 - 6}" y="${cy + 11}" text-anchor="middle" ${FONT} font-weight="700" font-size="32" letter-spacing="3" fill="#eaf2ff">${(7 - round) * 1000}<tspan font-size="15" fill="#8fb2e6" dx="3">FT</tspan></text>`;
    if (sc.rerolls.includes(round)) {
      const taken = round <= st.round && !(P && round > P.round);
      g += `<g class="${P && round <= st.round && round > P.round ? "vanish" : ""}">${rerollIcon(x + w - 46, cy, 0.6, !taken && round > st.round)}</g>`;
    }
  }
  return strip(x, w, hh, rows, 7 - st.round, P ? 7 - P.round : null, g);
}

/** The screen window of the panel: a bezel around the current space of each strip. */
function windowBezel(x, w, color) {
  return `<rect x="${x - 6}" y="${WIN_Y - 4}" width="${w + 12}" height="${CELL + 12}" rx="16" fill="none" stroke="url(#bezel)" stroke-width="7"/>
    <rect x="${x + 7}" y="${WIN_Y + 3}" width="${w - 14}" height="${CELL - 6}" rx="11" fill="none" stroke="${color}" stroke-width="3" filter="url(#glow)" class="screen"/>`;
}

// ------------------------------------------------------------------ dial, speed gauge, brakes
function dial(st, ui) {
  const { x, y, r } = DIAL;
  const P = ui.prev;
  const rot = (a) => `rotate(${a * STEP}deg)`;
  let g = `<circle cx="${x}" cy="${y}" r="${r + 44}" fill="url(#well)" opacity=".9"/>`;
  g += `<circle cx="${x}" cy="${y}" r="${r + 36}" fill="url(#bezel)"/><circle cx="${x}" cy="${y}" r="${r + 29}" fill="#151a21"/>`;
  // bank scale: permitted triangles and the red crosses at 3 marks
  for (let k = -3; k <= 3; k++) {
    for (const d of [-0.5, 0.5]) {
      if (Math.abs(k + d) > 3) continue;
      const [a0, b0] = polar(x, y, r + 4, (k + d) * STEP), [a1, b1] = polar(x, y, r + 11, (k + d) * STEP);
      g += `<path d="M${a0},${b0} L${a1},${b1}" stroke="#6f7c89" stroke-width="2"/>`;
    }
    const [tx, ty] = polar(x, y, r + 15, k * STEP);
    if (Math.abs(k) === 3) g += `<g transform="translate(${tx} ${ty})" stroke="#ff4335" stroke-width="5" stroke-linecap="round"><path d="M-7,-7 L7,7 M7,-7 L-7,7"/></g>`;
    else g += `<g transform="translate(${tx} ${ty}) rotate(${k * STEP})"><path d="M-8,-7 L8,-7 L0,8Z" fill="${k === 0 ? "#ffb020" : "#eef2f6"}" stroke="#0b0e12" stroke-width="1.4" stroke-linejoin="round"/></g>`;
  }
  // the rolling horizon
  g += `<g transform="translate(${x} ${y})"><g ${tw(P ? rot(P.axis) : null, rot(st.axis), 1.2)}>
    <g clip-path="url(#disc)"><rect x="${-r - 40}" y="${-r - 40}" width="${2 * r + 80}" height="${r + 40}" fill="url(#sky)"/><rect x="${-r - 40}" y="0" width="${2 * r + 80}" height="${r + 40}" fill="url(#earth)"/>
      <path d="M${-r - 40},0 H${r + 40}" stroke="#fff" stroke-width="3"/>
      <path d="M-46,-40 H46 M-22,-20 H22 M-46,40 H46 M-22,20 H22 M-30,-60 H30 M-30,60 H30" stroke="#fff" stroke-opacity=".8" stroke-width="2.4"/>
      ${txt(-60, -34, "10", 13, "#fff", "end", `opacity=".8"`)}${txt(60, -34, "10", 13, "#fff", "start", `opacity=".8"`)}
      ${txt(-60, 46, "10", 13, "#fff", "end", `opacity=".8"`)}${txt(60, 46, "10", 13, "#fff", "start", `opacity=".8"`)}</g>
    <path d="M-8,${-r + 20} L8,${-r + 20} L0,${-r + 4}Z" fill="#ffb020" stroke="#2a1700" stroke-width="1.4"/></g></g>`;
  // fixed aircraft symbol, glass and rim shadow
  g += `<g transform="translate(${x} ${y})">
    <circle r="${r}" fill="url(#vignette)"/>
    <path d="M-98,0 H-36 L-22,16 M98,0 H36 L22,16" fill="none" stroke="#101317" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-98,0 H-36 L-22,16 M98,0 H36 L22,16" fill="none" stroke="#ffb020" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle r="7" fill="#ffb020" stroke="#101317" stroke-width="3"/>
    <circle r="${r}" fill="url(#glass)"/>
    <path d="${arcPath(0, 0, r - 8, -60, 10)}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/></g>`;
  return g;
}

const gaugeAngle = (n) => 250 - (n - 2) * 14;

function gauge(st, ui) {
  const { x, y } = DIAL, R = 208, P = ui.prev;
  let g = `<path d="${arcPath(x, y, R, 258, 102)}" fill="none" stroke="url(#bezel)" stroke-width="52" stroke-linecap="round"/>`;
  g += `<path d="${arcPath(x, y, R, 258, 102)}" fill="none" stroke="#161b22" stroke-width="44" stroke-linecap="round"/>`;
  // advance zones: hold (blue), 1 space (amber), 2 spaces (red)
  const zone = (from, to, color) => {
    if (to < from) return "";
    return `<path d="${arcPath(x, y, R - 17, gaugeAngle(from) + 6.5, gaugeAngle(to) - 6.5)}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;
  };
  g += zone(2, st.blue, "#3b82f6") + zone(st.blue + 1, st.orange, "#f59e0b") + zone(st.orange + 1, 12, "#ef4444");
  for (let n = 2; n <= 12; n++) {
    const a = gaugeAngle(n), [px, py] = polar(x, y, R + 3, a);
    const on = st.speed === n;
    g += `<g transform="translate(${px} ${py}) rotate(${a - 180})">${on ? `<rect x="-17" y="-17" width="34" height="32" rx="7" fill="#ffb020" filter="url(#glow)"/>` : ""}<text y="9" text-anchor="middle" ${FONT} font-weight="700" font-size="25" fill="${on ? "#1a1205" : "#e9eef3"}">${n}</text></g>`;
  }
  const marker = (after, before, color, dark) => {
    const a = (v) => `rotate(${(gaugeAngle(v) + gaugeAngle(v + 1)) / 2}deg)`;
    return `<g transform="translate(${x} ${y})"><g ${tw(before == null ? null : a(before), a(after), 1, 0.2)}><g transform="translate(0 ${-(R + 32)})" filter="url(#soft)">
      <path d="M-11,-16 H11 L13,4 L0,22 L-13,4Z" fill="${color}" stroke="${dark}" stroke-width="2.2" stroke-linejoin="round"/><path d="M-7,-12 H7 L8,0 H-8Z" fill="#fff" opacity=".28"/></g></g></g>`;
  };
  g += marker(st.blue, P?.blue, "#2f6fe6", "#0b2a77") + marker(st.orange, P?.orange, "#f58a1f", "#8f3d05");
  return g;
}

function brakeScale(st, ui) {
  const P = ui.prev, xs = (i) => CX + (i - 4) * 66, y = 1270;
  let g = `<rect x="${CX - 178}" y="${y - 20}" width="356" height="40" rx="12" fill="url(#lcd)" stroke="#8a98a6" stroke-width="2"/>`;
  for (let i = 2; i <= 6; i++) g += txt(xs(i), y + 9, i, 26, "#e9eef3", "middle", `font-weight="800"`);
  const pos = (lim) => {
    const after = lim ? lim - 1 : 1;
    return `translate(${after <= 1 ? xs(2) - 33 : (xs(after) + xs(after + 1)) / 2}px,0px)`;
  };
  g += `<g ${tw(P ? pos(P.brakeLimit) : null, pos(st.brakeLimit), 0.9, 0.2)}><g transform="translate(0 ${y - 32})" filter="url(#soft)"><path d="M-11,-6 H11 V8 L0,22 L-11,8Z" fill="#e0342b" stroke="#6b0f0a" stroke-width="2.2" stroke-linejoin="round"/></g></g>`;
  return g;
}

// ------------------------------------------------------------------ the panel
function panel(st, ui) {
  const ice = st.scenario.modules.some((m) => m.key === "ice");
  const P = ui.prev;
  const was = (sid) => (P ? !!P.slots[sid]?.on : null);
  let g = `<g filter="url(#shadow)"><rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="34" fill="url(#panelG)"/></g>`;
  g += `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="34" fill="#fff" filter="url(#grain)"/>`;
  g += `<rect x="${PANEL.x + 1.5}" y="${PANEL.y + 1.5}" width="${PANEL.w - 3}" height="${PANEL.h - 3}" rx="33" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2"/>`;
  g += `<rect x="${PANEL.x}" y="${PANEL.y}" width="${PANEL.w}" height="${PANEL.h}" rx="34" fill="none" stroke="#7d8c9a" stroke-width="2.5"/>`;
  g += [[PANEL.x + 20, PANEL.y + 20, 20], [PANEL.x + PANEL.w - 20, PANEL.y + 20, 75], [PANEL.x + 20, PANEL.y + PANEL.h - 20, 120], [PANEL.x + PANEL.w - 20, PANEL.y + PANEL.h - 20, 160]].map(([a, b, c]) => screw(a, b, c)).join("");
  // channels the strips slide in
  for (const sx of [STRIP.appX, STRIP.altX]) g += `<rect x="${sx - 10}" y="${PANEL.y + 3}" width="${STRIP.w + 20}" height="${WIN_Y + CELL + 14 - PANEL.y}" rx="14" fill="#9fadba" filter="url(#inner)"/>`;
  // bays
  g += bay(190, 712, 100, 642) + bay(950, 618, 100, 864) + bay(398, 1104, 444, 318) + bay(204, 1432, 230, 108) + bay(500, 1432, 352, 108);
  g += dial(st, ui) + gauge(st, ui);
  g += slot(st, ui, "axis_pilot", 392, 800) + slot(st, ui, "axis_copilot", 848, 800) + lbl(392, 870, "AXIS") + lbl(848, 870, "AXIS");
  // engines and the speed readout
  g += slot(st, ui, "engine_pilot", 474, 1170, { size: 90 }) + slot(st, ui, "engine_copilot", 766, 1170, { size: 90 });
  g += lbl(CX, 1138, "ENGINES");
  g += `<rect x="${CX - 46}" y="1150" width="92" height="44" rx="10" fill="url(#lcd)" stroke="#8a98a6" stroke-width="2"/>`;
  g += st.speed === null ? txt(CX, 1182, "– –", 26, "#4d5b6b", "middle", `font-weight="800"`) : txt(CX, 1183, st.speed, 32, "#ffb020", "middle", `font-weight="800" filter="url(#glow)"`);
  // left column: rerolls, radio, landing gear
  g += `<rect x="186" y="618" width="110" height="70" rx="14" fill="url(#lcd)" stroke="url(#bezel)" stroke-width="4"/>`;
  for (let i = 0; i < 3; i++) {
    const have = i < st.rerolls, had = P ? i < P.rerolls : have;
    g += `<g class="${have && !had ? "pop" : !have && had ? "vanish" : ""}">${rerollIcon(209 + i * 32, 653, 0.6, have || had)}</g>`;
  }
  g += lbl(241, 706, "REROLL", "middle", 13);
  g += slot(st, ui, "radio_pilot", 240, 778) + lbl(240, 848, "RADIO");
  g += lbl(240, 900, "GEAR");
  for (let i = 0; i < 3; i++) {
    const y = 960 + i * 136;
    g += slot(st, ui, `gear_${i}`, 240, y) + toggle(240, y + 62, st.slots[`gear_${i}`].on, was(`gear_${i}`));
  }
  // right column: radios and flaps
  g += slot(st, ui, "radio_copilot_1", 1000, 668) + slot(st, ui, "radio_copilot_2", 1000, 772) + lbl(1000, 842, "RADIO");
  g += lbl(1000, 900, "FLAPS");
  for (let i = 0; i < 4; i++) {
    const y = 960 + i * 128;
    g += slot(st, ui, `flaps_${i}`, 1000, y, { size: 80 }) + toggle(1000, y + 58, st.slots[`flaps_${i}`].on, was(`flaps_${i}`));
  }
  // brakes
  g += lbl(CX, 1236, ice ? "ICE BRAKES" : "BRAKES");
  if (ice) g += iceBoard(st, ui);
  else {
    g += brakeScale(st, ui);
    for (let i = 0; i < 3; i++) {
      const x = CX + (i - 1) * 132;
      g += slot(st, ui, `brake_${i}`, x, 1346, { size: 78 }) + toggle(x, 1406, st.slots[`brake_${i}`].on, was(`brake_${i}`), "#ff4a3d");
    }
  }
  // coffee and concentration
  g += lbl(319, 1452, "COFFEE", "middle", 13) + lbl(676, 1452, "CONCENTRATION", "middle", 13);
  for (let i = 0; i < 3; i++) {
    const x = 253 + i * 66, have = i < st.coffee, had = P ? i < P.coffee : have;
    g += `<circle cx="${x}" cy="1500" r="25" fill="url(#well)"/><circle cx="${x}" cy="1500" r="21" fill="#26323f" filter="url(#inner)"/>`;
    if (have) g += `<g class="${had ? "" : "pop"}">${coffeeIcon(x, 1496, 0.9)}</g>`;
    else if (had) g += `<g class="vanish">${coffeeIcon(x, 1496, 0.9)}</g>`;
    else g += icon("coffee", x, 1500, 0.95, "#5f7387", 0.8);
  }
  for (let i = 0; i < 3; i++) g += slot(st, ui, `conc_${i}`, 562 + i * 114, 1500, { size: 66 });
  return g;
}

function iceBoard(st, ui) {
  const xs = [CX - 156, CX - 52, CX + 52, CX + 156];
  let g = `<rect x="${CX - 212}" y="1250" width="424" height="38" rx="10" fill="url(#lcd)" stroke="#8a98a6" stroke-width="2"/>`;
  [2, 3, 4, 5].forEach((v, i) => { g += txt(xs[i], 1278, v, 24, "#e9eef3", "middle", `font-weight="800"`); });
  const after = st.icePairs + 1;
  const mx = after <= 1 ? xs[0] - 46 : after >= 5 ? xs[3] + 46 : (xs[after - 2] + xs[after - 1]) / 2;
  const P = ui.prev;
  const pmx = P ? (() => { const a = P.icePairs + 1; return a <= 1 ? xs[0] - 46 : a >= 5 ? xs[3] + 46 : (xs[a - 2] + xs[a - 1]) / 2; })() : null;
  g += `<g ${tw(pmx == null ? null : `translate(${pmx}px,0px)`, `translate(${mx}px,0px)`)}><path d="M-10,1246 h20 v10 l-10,12 l-10,-12Z" fill="#e0342b" stroke="#6b0f0a" stroke-width="2"/></g>`;
  xs.forEach((x, i) => {
    g += slot(st, ui, `ice_pilot_${i}`, x, 1330, { size: 58 }) + slot(st, ui, `ice_copilot_${i}`, x, 1400, { size: 58 });
  });
  return g;
}

// ------------------------------------------------------------------ modules
function modulePanel(x, y, w, h) {
  return `<g filter="url(#shadow)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="url(#panelG)"/></g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#fff" filter="url(#grain)"/>
    <rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="21" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="none" stroke="#7d8c9a" stroke-width="2.5"/>`;
}

function kerosene(st, ui) {
  const sc = st.scenario, leak = sc.modules.some((m) => m.key === "leak"), P = ui.prev;
  const top = 714, step = 36.4, tubeX = 70, tubeW = 40;
  const yv = (k) => top + (20 - k) * step;
  const level = (k) => `translate(0px,${(20 - Math.max(0, Math.min(20, k))) * step}px)`;
  let g = modulePanel(10, 590, 150, 960);
  g += lbl(85, 616, leak ? "LEAK" : "KEROSENE", "middle", 14);
  g += `<clipPath id="tube"><rect x="${tubeX}" y="${top - 10}" width="${tubeW}" height="${20 * step + 24}" rx="12"/></clipPath>`;
  g += `<rect x="${tubeX - 5}" y="${top - 15}" width="${tubeW + 10}" height="${20 * step + 34}" rx="16" fill="url(#well)"/>`;
  g += `<rect x="${tubeX}" y="${top - 10}" width="${tubeW}" height="${20 * step + 24}" rx="12" fill="#141a22"/>`;
  g += `<g clip-path="url(#tube)"><g ${tw(P ? level(P.kerosene) : null, level(st.kerosene), 1.2)}><rect x="${tubeX}" y="${top}" width="${tubeW}" height="${20 * step + 400}" fill="url(#fuel)"/>
    <path d="M${tubeX},${top} H${tubeX + tubeW}" stroke="#fff6c2" stroke-width="3"/></g></g>`;
  g += `<rect x="${tubeX + 5}" y="${top - 6}" width="8" height="${20 * step + 16}" rx="4" fill="#fff" opacity=".18"/>`;
  for (let k = 20; k >= 1; k--) g += txt(56, yv(k) + 5, k, 14, "#4b5f74", "end", `font-weight="700"`) + `<path d="M${tubeX},${yv(k)} h10" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
  g += `<g transform="translate(90 ${yv(0) + 6})" stroke="#ff4335" stroke-width="5" stroke-linecap="round"><path d="M-8,-8 L8,8 M8,-8 L-8,8"/></g>`;
  g += `<g ${tw(P ? level(P.kerosene) : null, level(st.kerosene), 1.2)}><g transform="translate(130 ${top})" filter="url(#soft)"><path d="M-14,0 L-4,-12 H22 V12 H-4Z" fill="#f4f7fa" stroke="#7b8896" stroke-width="2"/>${txt(10, 7, Math.max(0, st.kerosene), 18, "#1d2b3d", "middle", `font-weight="800"`)}</g></g>`;
  if (leak) g += `<rect x="52" y="630" width="66" height="66" rx="14" fill="#1b2230" stroke="#ff4335" stroke-width="3"/><g transform="translate(85 663)" stroke="#ff4335" stroke-width="9" stroke-linecap="round"><path d="M-15,-15 L15,15 M15,-15 L-15,15"/></g>`;
  else g += slot(st, ui, "kerosene", 76, 666, { size: 62 }) + `<rect x="114" y="646" width="38" height="22" rx="7" fill="#e0342b"/>` + txt(133, 663, "−6", 16, "#fff", "middle", `font-weight="800"`);
  return g;
}

function windRing(st, ui) {
  const cx = 1158, cy = 772, R = 62, n = st.windRing.length, P = ui.prev;
  let g = modulePanel(1074, 610, 170, 310) + lbl(cx, 640, "WIND", "middle", 14);
  g += `<circle cx="${cx}" cy="${cy}" r="${R + 20}" fill="url(#bezel)"/><circle cx="${cx}" cy="${cy}" r="${R + 15}" fill="#161b22"/><circle cx="${cx}" cy="${cy}" r="${R - 17}" fill="#203d78" stroke="#0b1530" stroke-width="2"/>`;
  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i, [px, py] = polar(cx, cy, R, a), on = i === st.wind, v = st.windRing[i];
    const col = v > 0 ? "#ff8a7a" : v < 0 ? "#8fd0ff" : "#e9eef3";
    g += `<g transform="translate(${px} ${py}) rotate(${a})">${on ? `<rect x="-11" y="-11" width="22" height="22" rx="6" fill="#ffb020" filter="url(#glow)"/>` : ""}<text y="5" text-anchor="middle" ${FONT} font-weight="800" font-size="13" fill="${on ? "#1a1205" : col}">${v > 0 ? "+" : ""}${v}</text></g>`;
  }
  const a = (i) => `rotate(${(360 / n) * i}deg)`;
  let from = P ? P.wind : null;
  if (from !== null && from > st.wind) from -= n; // keep turning clockwise across the start
  g += `<g transform="translate(${cx} ${cy})"><g ${tw(from == null ? null : a(from), a(st.wind), 1.3)}><g transform="scale(.66)" filter="url(#soft)"><path d="${PLANE_PATH}" fill="url(#tok)" stroke="#7d8b9a" stroke-width="1.5"/></g></g></g>`;
  g += txt(cx, 898, `${st.windSpeed > 0 ? "+" : ""}${st.windSpeed} ENGINES`, 17, "#1d3a6a", "middle", `font-weight="800"`);
  return g;
}

function internBoard(st, ui) {
  const y = 1612, left = st.internLeft || 0, rem = st.interns.length, P = ui.prev;
  const pLeft = P ? P.internLeft || 0 : left, pRem = P ? P.interns.length : rem;
  let g = modulePanel(180, 1568, 880, 86) + lbl(620, 1592, "INTERN", "middle", 12);
  g += slot(st, ui, "intern_pilot", 244, y, { size: 60 }) + slot(st, ui, "intern_copilot", 996, y, { size: 60 });
  for (let i = 0; i < 6; i++) {
    const x = 354 + i * 102, v = st.interns[i - left];
    const has = i >= left && i < left + rem, had = i >= pLeft && i < pLeft + pRem;
    g += `<g transform="translate(${x} ${y + 4})"><rect x="-27" y="-25" width="54" height="54" rx="10" fill="url(#well)"/><rect x="-24" y="-22" width="48" height="48" rx="8" fill="#1d6b37" filter="url(#inner)"/>
      <path d="M-11,2 l7,8 l15,-17" fill="none" stroke="#bdf5cf" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/></g>`;
    if (has) g += `<g transform="translate(${x} ${y + 4})" filter="url(#soft)"><rect x="-24" y="-22" width="48" height="48" rx="9" fill="url(#cream)" stroke="#2f9a48" stroke-width="3"/>${txt(0, 15, v, 34, "#1b3d73", "middle", `font-weight="800"`)}</g>`;
    else if (had) g += `<g class="vanish"><g transform="translate(${x} ${y + 4})"><rect x="-24" y="-22" width="48" height="48" rx="9" fill="url(#cream)" stroke="#2f9a48" stroke-width="3"/></g></g>`;
  }
  return g;
}

/** The whole cockpit. `ui.prev` (the previous game state, or null) drives the animations. */
export function boardSVG(st, ui) {
  const keys = st.scenario.modules.map((m) => m.key);
  const fuel = keys.includes("kerosene") || keys.includes("leak");
  const wind = keys.includes("wind"), intern = keys.includes("intern");
  const x0 = fuel ? 0 : 168, x1 = wind ? 1256 : 1078, y1 = intern ? 1666 : 1564;
  const top = Math.min(WIN_Y - (st.scenario.length - 1) * CELL - STRIP.hh, WIN_Y - 6 * CELL - 46) - 16;
  const fate = st.result ? (st.result.won ? "won" : "lost") : "";
  return `<svg viewBox="${x0} ${top} ${x1 - x0} ${y1 - top}" class="board ${fate}" xmlns="http://www.w3.org/2000/svg">${defs()}
    ${panel(st, ui)}${altitude(st, ui)}${approach(st, ui)}${windowBezel(STRIP.appX, STRIP.w, "#ffc93a")}${windowBezel(STRIP.altX, STRIP.w, "#ffc93a")}
    ${fuel ? kerosene(st, ui) : ""}${wind ? windRing(st, ui) : ""}${intern ? internBoard(st, ui) : ""}</svg>`;
}

export { dieSVG, legal };
