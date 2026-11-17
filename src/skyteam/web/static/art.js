// Hand-drawn SVG pieces modelled on the physical Sky Team box: numbered dice, silver-framed navy strips,
// cream tabs, white airplane tokens and the module icons. Everything is returned as an SVG string.

export const COLORS = {
  pilot: "#2b66d9", pilotDark: "#12338a", pilotLight: "#8db8ff",
  copilot: "#f58a1f", copilotDark: "#a14606", copilotLight: "#ffc58a",
  any: "#aeb8c4", red: "#d9322a", green: "#3fd06a", ink: "#0c141d",
  navy: "#0d1d3a", navy2: "#16335f", silver: "#b6bcc2", cream: "#f2ecda",
  lvl: { green: "#a4b92f", yellow: "#f2a91a", red: "#d8322b", black: "#1c1d20" },
};

const DIE = {
  pilot: ["#6ea2ff", "#2c62dc", "#163c98", "#0d2766"],
  copilot: ["#ffc277", "#f5871d", "#c45a07", "#7a3604"],
  traffic: ["#5a5d66", "#26282e", "#121317", "#000"],
};
const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

let uid = 0;
/** A die centred on (0,0) with side `s`: a bevelled resin cube with drilled white pips. */
export function dieSVG(value, tone, s = 56, extra = "") {
  const c = DIE[tone] || DIE.pilot;
  const id = `d${++uid}`;
  const h = s / 2, r = s * 0.22, o = s * 0.25, pr = s * 0.088;
  let out = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>
    <radialGradient id="${id}f" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".6" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
  out += `<rect x="${-h + 1}" y="${-h + 3.5}" width="${s - 2}" height="${s - 1}" rx="${r}" fill="#000" opacity=".35"/>`;
  out += `<rect x="${-h}" y="${-h}" width="${s}" height="${s}" rx="${r}" fill="url(#${id})" stroke="${c[3]}" stroke-opacity=".7" stroke-width="1.2"/>`;
  out += `<rect x="${-h + s * 0.08}" y="${-h + s * 0.07}" width="${s * 0.84}" height="${s * 0.84}" rx="${r * 0.75}" fill="url(#${id}f)"/>`;
  out += `<path d="M${-h + r},${-h + 1.2} H${h - r}" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" stroke-linecap="round"/>`;
  for (const [px, py] of PIPS[value] || []) {
    out += `<circle cx="${px * o}" cy="${py * o - 0.6}" r="${pr}" fill="${c[3]}" opacity=".55"/><circle cx="${px * o}" cy="${py * o + 0.4}" r="${pr * 0.92}" fill="#fbfdff"/>`;
  }
  return out + extra;
}

export function dieHidden(tone, s = 56) {
  const c = DIE[tone] || DIE.pilot;
  const h = s / 2, r = s * 0.22;
  return `<rect x="${-h + 1}" y="${-h + 3.5}" width="${s - 2}" height="${s - 1}" rx="${r}" fill="#000" opacity=".3"/>
    <rect x="${-h}" y="${-h}" width="${s}" height="${s}" rx="${r}" fill="${c[2]}" stroke="${c[3]}" stroke-width="1.2"/>
    <rect x="${-h + s * 0.12}" y="${-h + s * 0.12}" width="${s * 0.76}" height="${s * 0.76}" rx="${r * 0.7}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.5" stroke-dasharray="3 4"/>
    <text y="${s * 0.17}" text-anchor="middle" font-size="${s * 0.5}" font-weight="800" fill="#fff" opacity=".35" font-family="Barlow">?</text>`;
}

/** Top view of an airplane pointing up, centred, ~48 wide. */
export const PLANE_PATH = "M0,-22 C3.5,-22 4.5,-15 4.5,-8 L24,7 L24,12 L4.5,6 L3.5,16 L10,21 L10,25 L0,23 L-10,25 L-10,21 L-3.5,16 L-4.5,6 L-24,12 L-24,7 L-4.5,-8 C-4.5,-15 -3.5,-22 0,-22Z";

/** An airplane token: a white resin plane with a soft shadow (the board defines the #tok gradient). */
export function planeToken(x, y, scale = 1, rot = 0, sw = 1.4) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">
    <path d="${PLANE_PATH}" fill="#020814" opacity=".5" transform="translate(3 4)"/>
    <path d="${PLANE_PATH}" fill="url(#tok)" stroke="#7d8b9a" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="M0,-17 V15" stroke="#fff" stroke-opacity=".8" stroke-width="2"/><path d="M-3,-14 h6" stroke="#5b86b8" stroke-width="2.2" stroke-linecap="round"/></g>`;
}

/** The small printed airplane icon on a strip (nose up and to the right). */
export const planeIcon = (x, y, s = 1, fill = "#e9edf1") =>
  `<g transform="translate(${x} ${y}) rotate(45) scale(${0.42 * s})"><path d="${PLANE_PATH}" fill="${fill}"/></g>`;

export function planeFront() {
  const color = "#eef2f6";
  return `<g>
    <path d="M-132,2 L-26,-9 L26,-9 L132,2 L132,12 L26,6 L-26,6 L-132,12Z" fill="${color}" stroke="#7c8a99" stroke-width="2"/>
    <ellipse cx="0" cy="0" rx="25" ry="34" fill="${color}" stroke="#7c8a99" stroke-width="2"/>
    <path d="M-15,-14 Q0,-30 15,-14 L12,-4 L-12,-4Z" fill="#2b4a6a"/></g>`;
}

export const cloud = (x, y, s = 1, o = 0.95, fill = "#fff") => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}" fill="${fill}">
  <ellipse cx="0" cy="6" rx="26" ry="9"/><circle cx="-10" cy="-2" r="11"/><circle cx="6" cy="-6" r="14"/><circle cx="19" cy="1" r="9"/></g>`;

/** Coffee token: a white cup. */
export const coffeeIcon = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <ellipse cx="0" cy="17" rx="17" ry="5" fill="#000" opacity=".25"/>
  <path d="M-13,-9 H11 V8 Q11,17 2,17 H-4 Q-13,17 -13,8Z" fill="#f7f4ec" stroke="#a79e8a" stroke-width="2"/>
  <path d="M11,-4 H15 Q20,-4 20,2 Q20,8 14,8 H11" fill="none" stroke="#a79e8a" stroke-width="3"/>
  <path d="M-11,-7 H9 V-2 H-11Z" fill="#7b4a2b"/></g>`;

/** Reroll token / altitude-track icon: a disc with three dice. */
const miniCube = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0,-6 L5.5,-3 V3 L0,6 L-5.5,3 V-3Z" fill="#dfe8f3" stroke="#10213b" stroke-width="1"/><path d="M0,0 L5.5,-3 M0,0 L-5.5,-3 M0,0 V6" stroke="#10213b" stroke-width="1" fill="none"/></g>`;
export const rerollIcon = (x, y, s = 1, token = false) => `<g transform="translate(${x} ${y}) scale(${s})">
  <circle r="19" fill="${token ? "#e9eef5" : "#0c1a33"}" stroke="${token ? "#7f8fa6" : "#9fb2cc"}" stroke-width="2.5"/>
  ${token ? "" : `<circle r="15" fill="none" stroke="#3a5a8e" stroke-width="1.2" stroke-dasharray="3 3"/>`}
  ${miniCube(0, -7, 0.95)}${miniCube(-7, 5, 0.95)}${miniCube(7, 5, 0.95)}</g>`;

/** The airport: control tower and terminal. */
export const airport = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#f4efe0" stroke="none">
  <rect x="-44" y="-4" width="5" height="34"/><rect x="-50" y="-16" width="17" height="6" rx="1.5"/><rect x="-47" y="-10" width="11" height="8"/>
  <rect x="-34" y="2" width="82" height="28"/><rect x="-34" y="-2" width="86" height="5"/>
  <g fill="#0f2142">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${-30 + i * 11.2}" y="8" width="8.4" height="6.5"/><rect x="${-30 + i * 11.2}" y="18" width="8.4" height="6.5"/>`).join("")}</g>
  <rect x="-60" y="30" width="116" height="2.4"/></g>`;

/** Isometric traffic cube. */
export const cube = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0,-11 L10,-5.5 V6 L0,11.5 L-10,6 V-5.5Z" fill="#14161a" stroke="#14161a" stroke-width="1.2" stroke-linejoin="round"/><path d="M-10,-5.5 L0,0 L10,-5.5 M0,0 V11.5" stroke="#f2ecda" stroke-width="1.6" fill="none"/></g>`;

export const runway = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-12,18 L-6,-22 L6,-22 L12,18Z" fill="#454d57" stroke="#1e242b" stroke-width="2"/>
  <path d="M0,-18 v6 M0,-8 v6 M0,2 v6 M0,12 v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`;

export const trafficIcon = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${dieSVG("", "traffic", 22)}</g>`;

/** The airliner on the final altitude space (side view, nose down and to the left). */
export const landingPlane = (x, y, s = 1) => `<g transform="translate(${x} ${y}) rotate(8) scale(${s})" fill="none" stroke="#e9f1fb" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M-46,4 C-46,-6 -30,-10 -6,-9 L28,-9 C38,-9 46,-5 46,0 C46,5 38,8 28,8 L-30,8 C-40,8 -46,8 -46,4Z" fill="#101f3f"/>
  <path d="M-4,-9 L24,-32 L32,-32 L24,-9M-2,8 L20,24 L28,24 L16,8" fill="#101f3f"/>
  <path d="M36,-9 L44,-24 L50,-24 L48,-9" fill="#101f3f"/>
  <circle cx="-20" cy="20" r="4" fill="#e9f1fb"/><circle cx="-4" cy="20" r="4" fill="#e9f1fb"/><path d="M-20,8 V16 M-4,8 V16"/></g>`;

// Module glyphs, drawn dark on a cream square (24 x 24 box centred on 0,0).
const GLYPH = {
  kerosene: `<path d="M-10,-6 H3 V5 H-10Z M3,-3 H7 L10,1 V5 H3Z" fill="currentColor"/><circle cx="-6" cy="7" r="2.6" fill="currentColor"/><circle cx="6" cy="7" r="2.6" fill="currentColor"/>`,
  intern: `<rect x="-7" y="-10" width="14" height="19" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="0" cy="-3" r="3" fill="currentColor"/><path d="M-4.5,5 Q0,-1 4.5,5Z" fill="currentColor"/><path d="M-3,-12 L0,-9 L3,-12" fill="none" stroke="currentColor" stroke-width="2"/>`,
  realtime: `<circle cx="0" cy="2" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M0,2 V-3 M0,2 L4,4 M-3,-9 H3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
  wind: `<path d="M-9,-10 V11" stroke="currentColor" stroke-width="2.2"/><path d="M-9,-9 H9 V-1 H-9Z" fill="currentColor"/><path d="M-3,-9 V-1 M3,-9 V-1" stroke="#f2ecda" stroke-width="1.8"/>`,
  leak: `<rect x="-10" y="-9" width="20" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M0,-6 C-4,0 -5,2 -5,4 a5,5 0 0 0 10,0 C5,2 4,0 0,-6Z" fill="currentColor"/>`,
  ice: `<path d="M0,-10 V10 M-8.7,-5 L8.7,5 M-8.7,5 L8.7,-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M-3,-8 L0,-5 L3,-8 M-3,8 L0,5 L3,8" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
};
export function moduleChip(key, x, y, s = 1, bg = "#f2ecda", fg = "#1b3d73") {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-15" y="-15" width="30" height="30" rx="6" fill="${bg}"/><g style="color:${fg}" transform="scale(.95)">${GLYPH[key] || ""}</g></g>`;
}
export const starBadge = (n, x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0,-16 L4.6,-5.4 L16,-4.4 L7.4,3.2 L10,14.5 L0,8.6 L-10,14.5 L-7.4,3.2 L-16,-4.4 L-4.6,-5.4Z" fill="#fff" stroke="#fff" stroke-linejoin="round"/><text y="5" text-anchor="middle" font-family="Barlow, Arial" font-weight="800" font-size="14" fill="#1c2f55">${n}</text></g>`;

export const lamp = (x, y, on, r = 7, color = COLORS.green) =>
  `<circle cx="${x}" cy="${y}" r="${r + 2}" fill="#5e6e7c"/><circle cx="${x}" cy="${y}" r="${r}" fill="${on ? color : "#2a3a34"}" ${on ? `filter="url(#glow)"` : ""}/>
   <circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.3}" fill="#fff" opacity="${on ? 0.6 : 0.1}"/>`;

export const screw = (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="#9fb0bf" stroke="#6f8294" stroke-width="1.5"/><path d="M${x - 3.5},${y - 3.5} L${x + 3.5},${y + 3.5}" stroke="#5f7284" stroke-width="1.5"/>`;

const ICONS = {
  radio: `<path d="M-10,4 V-3 a10,10 0 0 1 20,0 V4" fill="none" stroke="currentColor" stroke-width="2.8"/><rect x="-13" y="0" width="6.5" height="11" rx="2.8" fill="currentColor"/><rect x="6.5" y="0" width="6.5" height="11" rx="2.8" fill="currentColor"/><path d="M-10,11 q0,6 8,6" fill="none" stroke="currentColor" stroke-width="2.4"/>`,
  axis: `<path d="M-14,2 H14 M0,-6 V10 M-4,10 H4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="0" cy="-2" r="6" fill="none" stroke="currentColor" stroke-width="2.6"/>`,
  engine: `<circle r="12" fill="none" stroke="currentColor" stroke-width="2.6"/><circle r="3" fill="currentColor"/><path d="M0,-3 L4,-11 M3,0 L11,3 M0,3 L-4,11 M-3,0 L-11,-3" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`,
  coffee: `<path d="M-9,-6 H7 V6 Q7,12 1,12 H-3 Q-9,12 -9,6Z M7,-3 H10 Q13,-3 13,1 Q13,5 9,5 H7" fill="none" stroke="currentColor" stroke-width="2.4"/>`,
};
export const icon = (name, x, y, s = 1, color = "#fff", op = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})" style="color:${color}" opacity="${op}">${ICONS[name] || ""}</g>`;

/** Sky + ground painting for the lobby cards, by scenario theme. */
export const THEMES = {
  day: ["#4aa3ff", "#bfe3ff", "#6b8f4e"], snow: ["#6aa8dc", "#e8f2fa", "#e9eef2"], dusk: ["#3a3f8f", "#f0a070", "#3b4a45"],
  sea: ["#3d8fe0", "#cfe9ff", "#2f6fa6"], forest: ["#3e86c9", "#c3e0f2", "#2f6b3f"], fog: ["#8e9aa5", "#d2d8dd", "#69747c"],
  mountain: ["#5a8fc2", "#d6e6f2", "#7a6a55"], storm: ["#2c3550", "#6b7592", "#2b3b3a"], blizzard: ["#97a6b5", "#e9eef3", "#d6dde4"],
};
