// The cockpit: one big SVG redrawn from the game state. Positions are in a 1600 x 900 space.
import {
  COLORS, THEMES, cloud, coffeeIcon, dieSVG, icon, lamp, planeFront, planeToken, rerollIcon, runway, screw, trafficIcon,
  PLANE_PATH,
} from "./art.js";

const W = 1600, H = 980;
const SPIN = 3, STEP = 22;
const tone = (seat) => (seat === "pilot" ? "pilot" : "copilot");
const el = (s) => s;

function defs(theme) {
  const t = THEMES[theme] || THEMES.day;
  return `<defs>
  <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d3b4a"/><stop offset="1" stop-color="#17202a"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t[0]}"/><stop offset="1" stop-color="${t[1]}"/></linearGradient>
  <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b6b7c"/><stop offset="1" stop-color="#1c2631"/></linearGradient>
  <linearGradient id="dialface" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b86d6"/><stop offset="0.62" stop-color="#9fd3f5"/><stop offset="0.62" stop-color="#6d5b43"/><stop offset="1" stop-color="#3f3426"/></linearGradient>
  <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".5"/></filter>
  <clipPath id="appclip"><rect x="24" y="24" width="528" height="240" rx="18"/></clipPath>
  </defs>`;
}

const txt = (x, y, s, size = 18, fill = "#c8d4e0", anchor = "middle", extra = "") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="${size}" letter-spacing="1.2" fill="${fill}" ${extra}>${s}</text>`;

/** Is the selected die/token allowed on this slot (client-side mirror of the engine, for highlighting)? */
function legal(st, ui, sid) {
  const sel = ui.sel;
  if (!sel || st.result) return false;
  const s = st.slots[sid];
  if (!s || s.die || s.on) return false;
  if (sel.token && (s.kind === "conc" || s.kind === "intern")) return false;
  if (s.owner !== "any" && s.owner !== sel.seat && !sel.wild) return false;
  const v = sel.value;
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

function slot(st, ui, sid, cx, cy, o = {}) {
  const s = st.slots[sid];
  const size = o.size || 84;
  const half = size / 2;
  const col = COLORS[s.owner === "any" ? "any" : s.owner];
  const hot = legal(st, ui, sid);
  let body = "";
  body += `<rect x="${cx - half}" y="${cy - half + 4}" width="${size}" height="${size}" rx="16" fill="#0b1118"/>`;
  body += `<rect x="${cx - half}" y="${cy - half}" width="${size}" height="${size}" rx="16" fill="${col}" fill-opacity="${s.die ? 0.18 : 0.28}" stroke="${col}" stroke-width="3.5"/>`;
  body += `<rect x="${cx - half + 7}" y="${cy - half + 7}" width="${size - 14}" height="${size - 14}" rx="10" fill="#0a1017" fill-opacity=".62" stroke="#000" stroke-opacity=".6"/>`;
  if (s.on && !s.die) {
    body += `<path d="M${cx - 16},${cy + 2} l11,12 l21,-26" fill="none" stroke="#3fd06a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>`;
  } else if (!s.die) {
    if (o.label) body += txt(cx, cy + 10, o.label, size * 0.42, "#fff", "middle", `opacity=".5"`);
    else if (s.accepts) body += txt(cx, cy + 9, s.accepts.join("·"), size * 0.34, col, "middle", `opacity=".95"`);
    if (o.glyph) body += icon(o.glyph, cx, cy - 2, 1.1).replace("<g ", `<g opacity=".55" `);
  } else {
    const d = s.die;
    body += `<g transform="translate(${cx} ${cy})">${dieSVG(d.value, d.seat === "pilot" ? "pilot" : "copilot", size * 0.7)}</g>`;
    if (d.coffee) body += `<g transform="translate(${cx + half - 8} ${cy - half + 8})">${coffeeIcon(0, 0, 0.55)}</g>`;
  }
  if (hot) body += `<rect class="pulse" x="${cx - half - 4}" y="${cy - half - 4}" width="${size + 8}" height="${size + 8}" rx="19" fill="none" stroke="#fff" stroke-width="4"/>`;
  const cls = `slot${hot ? " hot" : ""}${s.die ? " full" : ""}`;
  return `<g class="${cls}" data-slot="${sid}" ${hot ? `style="cursor:pointer"` : ""}>${body}<rect x="${cx - half - 4}" y="${cy - half - 4}" width="${size + 8}" height="${size + 8}" fill="transparent"/></g>`;
}

// ------------------------------------------------------------------ approach window
function approach(st) {
  const sc = st.scenario, n = sc.length;
  const t = THEMES[sc.theme] || THEMES.day;
  let g = `<g clip-path="url(#appclip)"><rect x="24" y="24" width="528" height="240" fill="url(#sky)"/>`;
  g += cloud(90, 70, 1.3, 0.85) + cloud(300, 52, 1, 0.7) + cloud(470, 84, 1.2, 0.8);
  if (sc.theme === "storm" || sc.theme === "blizzard") for (let i = 0; i < 26; i++) g += `<path d="M${40 + ((i * 53) % 500)},${40 + ((i * 37) % 120)} l-5,16" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`;
  g += `<path d="M24,215 Q120,185 220,205 T400,195 T552,210 V264 H24Z" fill="${t[2]}"/><path d="M24,232 Q150,214 300,228 T552,226 V264 H24Z" fill="#000" opacity=".22"/>`;
  g += `</g><rect x="24" y="24" width="528" height="240" rx="18" fill="none" stroke="url(#bezel)" stroke-width="9"/>`;
  const x0 = 78, x1 = 498;
  const px = (i) => x0 + (i * (x1 - x0)) / (n - 1);
  const py = (i) => 168 + Math.sin((i / (n - 1)) * Math.PI) * -6;
  for (let i = 0; i < n - 1; i++) g += `<line x1="${px(i)}" y1="${py(i)}" x2="${px(i + 1)}" y2="${py(i + 1)}" stroke="#fff" stroke-width="5" stroke-dasharray="3 9" stroke-linecap="round" opacity=".85"/>`;
  for (let i = 0; i < n; i++) {
    const x = px(i), y = py(i), here = i === st.position, past = i < st.position;
    g += `<circle cx="${x}" cy="${y}" r="${i === n - 1 ? 27 : 20}" fill="${here ? "#fff7c2" : "#ffffff"}" fill-opacity="${past ? 0.35 : 0.92}" stroke="${here ? "#ffb703" : "#34506b"}" stroke-width="${here ? 5 : 3}"/>`;
    if (i === n - 1) g += runway(x, y + 1, 0.95);
    else if (i === 0 && !past && !here) g += cloud(x, y + 2, 0.45, 1);
    else g += txt(x, y + 7, i + 1, 20, past ? "#6f8296" : "#25384b");
    if (here) g += `<g transform="translate(${x} ${y - 4}) scale(.62)" filter="url(#shadow)"><path d="${PLANE_PATH}" fill="#1d4f91" stroke="#fff" stroke-width="3"/></g>`;
    const planes = st.planes[i] || 0;
    for (let k = 0; k < planes; k++) g += planeToken(x + (k - (planes - 1) / 2) * 22, y - 48 - k * 3, 0.62, 180);
    const ti = sc.traffic[i] || 0;
    for (let k = 0; k < ti; k++) g += trafficIcon(x + (k - (ti - 1) / 2) * 24, y + 38, 0.95);
    const turn = sc.turns[i];
    if (turn) {
      for (let a = -2; a <= 2; a++) g += `<circle cx="${x + a * 9}" cy="${y + (ti ? 62 : 40)}" r="3.8" fill="${turn.includes(a) ? "#3fd06a" : "#8a1f19"}" stroke="#0b1118" stroke-width="1"/>`;
    }
  }
  g += `<rect x="36" y="32" width="150" height="26" rx="8" fill="#0d1722" fill-opacity=".72"/>` + txt(111, 51, "APPROACH TRACK", 16, "#9fd3f5");
  g += `<rect x="36" y="236" width="${n > 0 ? 292 : 0}" height="22" rx="8" fill="#0d1722" fill-opacity=".72"/>` + txt(182, 252, `${sc.code} · ${sc.airport.toUpperCase()}`, 15, "#fff");
  return g;
}

// ------------------------------------------------------------------ altitude window
function altitude(st) {
  const x0 = 1048, w = 528;
  let g = `<rect x="${x0}" y="24" width="${w}" height="240" rx="18" fill="#10202f" stroke="url(#bezel)" stroke-width="9"/>`;
  g += txt(x0 + 118, 52, "ALTITUDE", 16, "#9fd3f5") + txt(x0 + w - 24, 52, `ROUND ${st.round} / 7`, 18, "#fff", "end");
  const cw = (w - 40) / 7;
  for (let i = 0; i < 7; i++) {
    const r = i + 1, x = x0 + 20 + i * cw, cur = r === st.round, past = r < st.round;
    g += `<rect x="${x + 2}" y="70" width="${cw - 4}" height="86" rx="10" fill="${cur ? "#e8f3ff" : "#1d3045"}" fill-opacity="${past ? 0.35 : 1}" stroke="${cur ? "#ffb703" : "#34506b"}" stroke-width="${cur ? 4 : 2}"/>`;
    if (r === 7) g += `<g transform="translate(${x + cw / 2} 108) scale(.8)"><path d="${PLANE_PATH}" fill="${cur ? "#1d4f91" : "#c8d4e0"}"/></g>` + txt(x + cw / 2, 146, "FINAL", 14, cur ? "#1d3045" : "#9fd3f5");
    else g += txt(x + cw / 2, 112, 7 - r, 34, cur ? "#10202f" : "#c8d4e0") + txt(x + cw / 2, 138, "×1000 FT", 12, cur ? "#3b536b" : "#7e93a8");
    if (st.scenario.rerolls.includes(r)) {
      const got = r <= st.round;
      g += `<g opacity="${got ? 0.28 : 1}">${rerollIcon(x + cw / 2, 184, 0.8)}</g>`;
    }
    if (cur) {
      const left = st.first === "pilot";
      g += `<path d="${left ? `M${x + 8},62 l10,-12 l10,12Z` : `M${x + cw - 8},62 l-10,-12 l-10,12Z`}" fill="${left ? COLORS.pilot : COLORS.copilot}"/>`;
    }
  }
  g += txt(x0 + 24, 228, "REROLL", 15, "#9fd3f5", "start");
  for (let i = 0; i < 3; i++) g += `<g opacity="${i < st.rerolls ? 1 : 0.22}">${rerollIcon(x0 + 110 + i * 46, 222, 0.75)}</g>`;
  const first = st.first;
  g += `<rect x="${x0 + 290}" y="206" width="220" height="38" rx="10" fill="#0a1017" stroke="${COLORS[first]}" stroke-width="2.5"/>`;
  g += txt(x0 + 400, 232, `${first === "pilot" ? "PILOT" : "CO-PILOT"} PLACES FIRST`, 18, first === "pilot" ? COLORS.pilotLight : COLORS.copilotLight);
  return g;
}

// ------------------------------------------------------------------ axis dial
function axis(st, ui) {
  const cx = 800, cy = 252, R = 190;
  const pt = (deg, r) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)];
  const arc = (a0, a1, r) => {
    const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
    return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`;
  };
  let g = `<path d="M${cx - R - 12},${cy} A${R + 12},${R + 12} 0 0 1 ${cx + R + 12},${cy}Z" fill="url(#bezel)"/>`;
  g += `<path d="M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}Z" fill="#14212e"/>`;
  g += `<path d="M${cx - R + 14},${cy} A${R - 14},${R - 14} 0 0 1 ${cx + R - 14},${cy}Z" fill="url(#dialface)"/>`;
  // spin zones
  for (const sign of [-1, 1]) {
    const a = sign * (SPIN * STEP - STEP / 2), b = sign * 90;
    const [x0, y0] = pt(a, R - 14), [x1, y1] = pt(b, R - 14), [x2, y2] = pt(a, 60), [x3, y3] = pt(b, 60);
    g += `<path d="M${x2},${y2} L${x0},${y0} A${R - 14},${R - 14} 0 0 ${sign > 0 ? 1 : 0} ${x1},${y1} L${x3},${y3}Z" fill="#c9302a" fill-opacity=".72"/>`;
    const [xx, yy] = pt(sign * SPIN * STEP, 150);
    g += `<g transform="translate(${xx} ${yy})" stroke="#fff" stroke-width="7" stroke-linecap="round"><path d="M-10,-10 L10,10 M10,-10 L-10,10"/></g>`;
  }
  for (let k = -2; k <= 2; k++) {
    const [x0, y0] = pt(k * STEP, R - 18), [x1, y1] = pt(k * STEP, R - 40);
    g += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#fff" stroke-width="${k === 0 ? 6 : 4}" stroke-linecap="round"/>`;
  }
  g += `<path d="M${cx - 12},${cy - R - 2} L${cx + 12},${cy - R - 2} L${cx},${cy - R + 20}Z" fill="#0a1017" stroke="#fff" stroke-width="2"/>`;
  g += `<g transform="translate(${cx} ${cy - 78})" filter="url(#shadow)"><g class="axisplane" data-deg="${st.axis * STEP}" style="transform:rotate(${(ui.fromAxis ?? st.axis) * STEP}deg);transition:transform .6s cubic-bezier(.3,1.5,.5,1)">${planeFront()}</g></g>`;
  const [ax, ay] = pt(st.axis * STEP, R - 4);
  g += `<g transform="translate(${ax} ${ay}) rotate(${st.axis * STEP + 180})"><path d="M-11,-2 L11,-2 L0,24Z" fill="#ffd23f" stroke="#7a5a00" stroke-width="2.5"/></g>`;
  g += `<rect x="${cx - 70}" y="${cy - 6}" width="140" height="30" rx="8" fill="#0a1017"/>` + txt(cx, cy + 15, `AXIS ${st.axis > 0 ? "+" : ""}${st.axis}`, 20, st.axis === 0 ? "#3fd06a" : Math.abs(st.axis) >= 2 ? "#ff7b6e" : "#ffd23f");
  return g;
}

// ------------------------------------------------------------------ speed gauge
function gauge(st) {
  const x0 = 560, w = 480 / 11, y = 452, h = 44;
  let g = `<rect x="${x0 - 14}" y="${y - 34}" width="508" height="${h + 82}" rx="14" fill="#101a24" stroke="#3b4856" stroke-width="2"/>`;
  g += txt(x0 + 4, y - 14, "SPEED", 15, "#9fd3f5", "start") + txt(x0 + 480, y - 14, st.final ? "FINAL: STAY BELOW THE BRAKES" : "AERODYNAMICS", 15, "#9fd3f5", "end");
  const cx = (n) => x0 + (n - 2) * w;
  for (let n = 2; n <= 12; n++) {
    const zone = st.final ? "#27313c" : n <= st.blue ? "#27313c" : n <= st.orange ? "#2f4d38" : "#5a3a24";
    const on = st.speed === n;
    g += `<rect x="${cx(n)}" y="${y}" width="${w - 2}" height="${h}" rx="6" fill="${on ? "#ffffff" : zone}" stroke="${on ? "#ffd23f" : "#445566"}" stroke-width="${on ? 4 : 1.5}"/>`;
    g += txt(cx(n) + w / 2 - 1, y + 30, n, 25, on ? "#10202f" : "#e8eef5");
  }
  if (!st.final) {
    g += txt(cx(2) + (st.blue - 1) * w / 2, y + h + 22, "HOLD", 14, "#9fb0c0");
    g += txt(cx(st.blue + 1) + ((st.orange - st.blue) * w) / 2 - 1, y + h + 22, "ADVANCE 1", 14, "#7ad39a");
    g += txt(cx(st.orange + 1) + ((12 - st.orange) * w) / 2 - 1, y + h + 22, "+2", 14, "#ffb067");
  }
  const mark = (xm, color, up) => `<g><line x1="${xm}" y1="${y - 6}" x2="${xm}" y2="${y + h + 6}" stroke="${color}" stroke-width="5"/>
    <path d="${up ? `M${xm - 11},${y + h + 18} L${xm + 11},${y + h + 18} L${xm},${y + h + 3}Z` : `M${xm - 11},${y - 20} L${xm + 11},${y - 20} L${xm},${y - 3}Z`}" fill="${color}" stroke="#000" stroke-opacity=".5"/></g>`;
  if (!st.final) g += mark(x0 + (st.blue - 1) * w - 1, COLORS.pilot, false) + mark(x0 + (st.orange - 1) * w - 1, COLORS.copilot, false);
  const bx = st.brakeLimit ? x0 + (st.brakeLimit - 2) * w - 1 : x0 - 7;
  g += mark(bx, COLORS.red, true);
  return g;
}

// ------------------------------------------------------------------ side panels
function zone(x, y, w, h, color, label) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-opacity=".5" stroke-width="3"/>` +
    txt(x + 26, y + 34, label, 20, color, "start");
}

function pilotZone(st, ui) {
  let g = zone(24, 290, 528, 670, COLORS.pilot, "PILOT");
  g += txt(130, 322, "RADIO", 15, "#9fd3f5") + icon("radio", 130, 342, 0.9);
  g += slot(st, ui, "radio_pilot", 130, 408, { glyph: "radio" });
  g += txt(406, 330, "Land the plane level, with", 17, "#6f87a0", "middle") + txt(406, 352, "gear down, flaps out,", 17, "#6f87a0", "middle") + txt(406, 374, "and the sky clear of traffic.", 17, "#6f87a0", "middle");
  g += `<g transform="translate(0 30)">` + txt(46, 478, "LANDING GEAR", 17, "#9fd3f5", "start");
  for (let i = 0; i < 3; i++) {
    const x = 100 + i * 130;
    g += lamp(x, 508, st.gear > i ? true : false, 9) + slot(st, ui, `gear_${i}`, x, 572, { glyph: null });
  }
  g += `</g><g transform="translate(0 70)">`;
  if (st.scenario.modules.some((m) => m.key === "ice")) g += iceBoard(st, ui);
  else {
    g += txt(46, 652, "BRAKES", 17, "#9fd3f5", "start") + txt(150, 652, "in order · only matter on the final round", 13, "#6f87a0", "start");
    for (let i = 0; i < 3; i++) {
      const x = 100 + i * 130;
      g += lamp(x, 682, st.brakes > i, 9, COLORS.red) + slot(st, ui, `brake_${i}`, x, 746);
    }
    g += txt(288, 840, "IN THE FINAL ROUND THE ENGINES MUST STAY BELOW THE RED MARKER", 14, "#6f87a0", "middle");
  }
  g += `</g>`;
  return g;
}

function iceBoard(st, ui) {
  let g = txt(46, 652, "ICE BRAKES", 17, "#9fd3f5", "start") + txt(176, 652, "two equal dice, same round", 13, "#6f87a0", "start");
  g += `<rect x="52" y="728" width="430" height="14" rx="7" fill="#26313c"/>`;
  for (let i = 0; i < 4; i++) {
    const x = 100 + i * 108;
    g += slot(st, ui, `ice_pilot_${i}`, x, 700, { size: 72 }) + slot(st, ui, `ice_copilot_${i}`, x, 786, { size: 72 });
    g += lamp(x, 743, st.icePairs > i, 8, COLORS.red);
  }
  return g;
}

function copilotZone(st, ui) {
  let g = zone(1048, 290, 528, 670, COLORS.copilot, "CO-PILOT");
  g += txt(1200, 322, "RADIO", 15, "#ffd08a") + icon("radio", 1200, 342, 0.9);
  g += slot(st, ui, "radio_copilot_1", 1160, 408, { glyph: "radio" }) + slot(st, ui, "radio_copilot_2", 1260, 408, { glyph: "radio" });
  g += txt(1480, 340, "Radio dice clear", 17, "#a58559") + txt(1480, 362, "an airplane that many", 17, "#a58559") + txt(1480, 384, "spaces ahead (1 = here).", 17, "#a58559");
  g += `<g transform="translate(0 30)">` + txt(1072, 478, "FLAPS", 17, "#ffd08a", "start") + txt(1150, 478, "in order, top to bottom of the board", 13, "#a58559", "start");
  for (let i = 0; i < 4; i++) {
    const x = 1110 + i * 118;
    g += lamp(x, 508, st.flaps > i, 9, COLORS.copilot) + slot(st, ui, `flaps_${i}`, x, 572);
  }
  g += `</g><g transform="translate(0 50)">` + txt(1072, 662, "WINNING A LANDING", 17, "#ffd08a", "start");
  const checks = [
    [st.planes.every((p) => !p), "No airplanes left on the approach"],
    [st.gear >= 3 && st.flaps >= 4, "Landing gear down, flaps fully out"],
    [st.axis === 0, "Plane perfectly level"],
    [st.final ? (st.speed !== null && st.speed < st.brakeLimit) : false, "Engines below the Brakes (final round)"],
  ];
  checks.forEach(([ok, label], i) => {
    g += `<circle cx="1086" cy="${698 + i * 38}" r="11" fill="${ok ? COLORS.green : "#26313c"}" stroke="#0a1017" stroke-width="2"/>` + txt(1112, 704 + i * 38, label, 17, ok ? "#e8f3e8" : "#a58559", "start");
  });
  return g + `</g>`;
}

// ------------------------------------------------------------------ centre
function centre(st, ui) {
  let g = "";
  g += slot(st, ui, "axis_pilot", 690, 350, { size: 78 }) + slot(st, ui, "axis_copilot", 910, 350, { size: 78 });
  g += txt(800, 346, "AXIS", 24, "#fff") + txt(800, 370, "higher die tips it", 14, "#8aa0b5");
  g += gauge(st);
  g += `<g transform="translate(0 64)">`;
  g += slot(st, ui, "engine_pilot", 690, 530, { size: 92 }) + slot(st, ui, "engine_copilot", 910, 530, { size: 92 });
  g += txt(800, 512, "ENGINES", 22, "#fff");
  const tot = st.speed;
  g += `<rect x="758" y="526" width="84" height="40" rx="10" fill="#0a1017" stroke="#3b4856" stroke-width="2"/>` + txt(800, 556, tot === null ? "SUM" : tot, 24, tot === null ? "#5c6b7a" : "#ffd23f");
  // concentration + coffee
  g += txt(560, 622, "CONCENTRATION", 15, "#9fd3f5", "start") + icon("coffee", 700, 617, 0.55);
  for (let i = 0; i < 3; i++) g += slot(st, ui, `conc_${i}`, 604 + i * 92, 674, { size: 74 });
  g += txt(880, 622, "COFFEE", 15, "#9fd3f5", "start");
  for (let i = 0; i < 3; i++) g += `<circle cx="${902 + i * 58}" cy="674" r="25" fill="#0a1017" stroke="#3b4856" stroke-width="3"/>` + (i < st.coffee ? coffeeIcon(902 + i * 58, 676, 0.95) : "");
  g += `</g><g transform="translate(0 68)">${modules(st, ui)}</g>`;
  return g;
}

function modules(st, ui) {
  const keys = st.scenario.modules.map((m) => m.key);
  const list = [];
  if (keys.includes("kerosene") || keys.includes("leak")) list.push("fuel");
  if (keys.includes("intern")) list.push("intern");
  if (keys.includes("wind")) list.push("wind");
  let g = "";
  list.forEach((m, i) => {
    const x = i === 0 ? 560 : 800 + 6, w = 232;
    g += `<rect x="${x}" y="732" width="${w}" height="148" rx="16" fill="#101a24" stroke="#3b4856" stroke-width="2"/>`;
    if (m === "fuel") g += fuel(st, ui, x);
    if (m === "intern") g += intern(st, ui, x);
    if (m === "wind") g += wind(st, x);
  });
  if (list.length < 2) {
    const x = list.length ? 806 : 560, w = list.length ? 232 : 480;
    g += `<rect x="${x}" y="732" width="${w}" height="148" rx="16" fill="#101a24" stroke="#3b4856" stroke-width="2"/>` + planeBadge(st, x + w / 2, list.length ? 28 : 44);
  }
  return g;
}

function planeBadge(st, x = 800, size = 44) {
  return `<g opacity=".9"><text x="${x}" y="800" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="${size}" letter-spacing="${size / 4.4}" fill="#2b3a4a">SKY TEAM</text>` +
    txt(x, 836, size > 30 ? "TWO PILOTS · ONE LANDING · NO TALKING" : "NO TALKING", 15, "#43556a") + `</g>`;
}

function fuel(st, ui, x) {
  const sc = st.scenario, leak = sc.modules.some((m) => m.key === "leak");
  const pct = Math.max(0, Math.min(1, st.kerosene / sc.kerosene));
  let g = txt(x + 18, 760, leak ? "KEROSENE LEAK" : "KEROSENE", 15, "#9fd3f5", "start");
  g += `<rect x="${x + 18}" y="772" width="196" height="20" rx="10" fill="#0a1017" stroke="#3b4856"/>`;
  g += `<rect x="${x + 20}" y="774" width="${Math.max(0, 192 * pct)}" height="16" rx="8" fill="${pct > 0.5 ? "#3fd06a" : pct > 0.25 ? "#ffd23f" : "#ff5a4a"}"/>`;
  g += txt(x + 214, 760, Math.max(0, st.kerosene), 22, "#fff", "end");
  if (leak) g += txt(x + 116, 836, "−(difference + 1) per Engines", 14, "#8aa0b5") + txt(x + 116, 856, "check", 14, "#8aa0b5");
  else {
    g += slot(st, ui, "kerosene", x + 66, 838, { size: 70, glyph: null, label: "−" });
    g += txt(x + 170, 826, "NO DIE: −6", 15, "#ff9b8f") + txt(x + 170, 846, "AT ROUND END", 15, "#ff9b8f");
  }
  return g;
}

function intern(st, ui, x) {
  let g = txt(x + 18, 760, "INTERN", 15, "#9fd3f5", "start");
  g += slot(st, ui, "intern_pilot", x + 40, 828, { size: 64, label: "?" });
  g += slot(st, ui, "intern_copilot", x + 192, 828, { size: 64, label: "?" });
  st.interns.forEach((v, i) => {
    const tx = x + 116 + (i - (st.interns.length - 1) / 2) * 42;
    g += `<g transform="translate(${tx} 828)"><rect x="-17" y="-17" width="34" height="34" rx="7" fill="#f3efe4" stroke="#8a7a55" stroke-width="2"/>` + txt(0, 8, v, 24, "#25384b") + `</g>`;
  });
  if (!st.interns.length) g += txt(x + 116, 834, "TRAINED ✓", 16, "#3fd06a");
  return g;
}

function wind(st, x) {
  const cx = x + 78, cy = 826, r = 52;
  let g = txt(x + 18, 760, "WIND", 15, "#9fd3f5", "start");
  const n = st.windRing.length;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI, px = cx + r * Math.sin(a), py = cy - r * Math.cos(a);
    const on = i === st.wind;
    g += `<circle cx="${px}" cy="${py}" r="13" fill="${on ? "#ffd23f" : "#1d3045"}" stroke="#3b4856" stroke-width="2"/>` + txt(px, py + 6, (st.windRing[i] > 0 ? "+" : "") + st.windRing[i], 15, on ? "#10202f" : "#9fb0c0");
  }
  const a = (st.wind / n) * 2 * Math.PI;
  g += `<g transform="translate(${cx} ${cy}) rotate(${(a * 180) / Math.PI})"><path d="${PLANE_PATH}" transform="scale(.62)" fill="#2f80e0" stroke="#fff" stroke-width="2.5"/></g>`;
  g += txt(x + 178, 806, "ENGINES", 14, "#8aa0b5") + txt(x + 178, 840, (st.windSpeed > 0 ? "+" : "") + st.windSpeed, 34, st.windSpeed > 0 ? "#ffb067" : st.windSpeed < 0 ? "#7ad39a" : "#fff");
  return g;
}

export function boardSVG(st, ui) {
  const bolts = [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14], [W / 2, 276], [540, 290], [1060, 290]].map(([x, y]) => screw(x, y)).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="board" xmlns="http://www.w3.org/2000/svg">${defs(st.scenario.theme)}
    <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="30" fill="url(#panel)" stroke="#0a0f14" stroke-width="4"/>
    ${bolts}${approach(st)}${altitude(st)}${axis(st, ui)}${pilotZone(st, ui)}${copilotZone(st, ui)}${centre(st, ui)}</svg>`;
}

export { dieSVG, legal };
