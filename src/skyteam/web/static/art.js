// Hand-drawn SVG pieces: dice, airplanes, icons and scenery. Everything is returned as an SVG string.

export const COLORS = {
  pilot: "#2f80e0", pilotDark: "#164a8f", pilotLight: "#8cc2ff",
  copilot: "#f39a21", copilotDark: "#a85a06", copilotLight: "#ffd08a",
  any: "#aeb8c4", red: "#d93a2e", green: "#3fd06a", ink: "#0c141d",
};

const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** A die centred on (0,0) with side `s`. `tone` is "pilot", "copilot" or "traffic" (the white-and-red die). */
export function dieSVG(value, tone, s = 56, extra = "") {
  const body = tone === "pilot" ? ["#4a97ee", "#1b5fb8", "#0e3a73"] : tone === "copilot" ? ["#ffb445", "#e07e0c", "#8a4a05"]
    : ["#f6f6f2", "#d9d9d2", "#8a8a80"];
  const pip = tone === "traffic" ? "#c8281e" : "#ffffff";
  const r = s * 0.18, h = s / 2, k = s * 0.24, pr = s * 0.075;
  const id = `g${tone}${s}`;
  let out = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${body[0]}"/><stop offset="1" stop-color="${body[1]}"/></linearGradient></defs>`;
  out += `<rect x="${-h}" y="${-h + 3}" width="${s}" height="${s}" rx="${r}" fill="${body[2]}"/>`;
  out += `<rect x="${-h}" y="${-h}" width="${s}" height="${s}" rx="${r}" fill="url(#${id})" stroke="${body[2]}" stroke-width="1.5"/>`;
  out += `<rect x="${-h + 3}" y="${-h + 3}" width="${s - 6}" height="${s * 0.38}" rx="${r * 0.7}" fill="#fff" opacity="0.16"/>`;
  for (const [px, py] of PIPS[value] || []) out += `<circle cx="${px * k}" cy="${py * k}" r="${pr}" fill="${pip}"/>`;
  return out + extra;
}

export function dieHidden(tone, s = 56) {
  const c = tone === "pilot" ? ["#2467b8", "#0e3a73"] : ["#d9800f", "#8a4a05"];
  const h = s / 2;
  return `<rect x="${-h}" y="${-h + 3}" width="${s}" height="${s}" rx="${s * 0.18}" fill="${c[1]}"/>
    <rect x="${-h}" y="${-h}" width="${s}" height="${s}" rx="${s * 0.18}" fill="${c[0]}" stroke="${c[1]}" stroke-width="1.5"/>
    <text y="${s * 0.17}" text-anchor="middle" font-size="${s * 0.5}" font-weight="800" fill="#fff" opacity="0.55" font-family="Barlow Condensed">?</text>`;
}

/** Top view of an airplane pointing up, centred, ~44 wide. */
export const PLANE_PATH = "M0,-22 C3.5,-22 4.5,-15 4.5,-8 L24,7 L24,12 L4.5,6 L3.5,16 L10,21 L10,25 L0,23 L-10,25 L-10,21 L-3.5,16 L-4.5,6 L-24,12 L-24,7 L-4.5,-8 C-4.5,-15 -3.5,-22 0,-22Z";

export function planeToken(x, y, scale = 1, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">
    <circle r="27" fill="#c8281e" stroke="#7d130c" stroke-width="2.5"/><circle r="27" fill="none" stroke="#ff7b6e" stroke-width="1" opacity=".5" transform="scale(.82)"/>
    <path d="${PLANE_PATH}" fill="#fff" transform="scale(.85)"/></g>`;
}

export function planeFront(color = "#eef2f6") {
  return `<g>
    <path d="M-132,2 L-26,-9 L26,-9 L132,2 L132,12 L26,6 L-26,6 L-132,12Z" fill="${color}" stroke="#7c8a99" stroke-width="2"/>
    <path d="M-132,2 L-118,0 L-118,12 L-132,12Z" fill="#2f80e0"/><path d="M132,2 L118,0 L118,12 L132,12Z" fill="#f39a21"/>
    <ellipse cx="0" cy="0" rx="25" ry="34" fill="${color}" stroke="#7c8a99" stroke-width="2"/>
    <path d="M-15,-14 Q0,-30 15,-14 L12,-4 L-12,-4Z" fill="#2b4a6a"/>
    <path d="M0,-34 L0,-60 L9,-60 L22,-44 L0,-34" fill="${color}" stroke="#7c8a99" stroke-width="2" opacity="0"/>
    <circle cx="-60" cy="12" r="9" fill="#9aa7b4" stroke="#5c6978" stroke-width="2"/><circle cx="60" cy="12" r="9" fill="#9aa7b4" stroke="#5c6978" stroke-width="2"/>
    <path d="M-32,30 L-45,36 L-45,41 L-20,38Z M32,30 L45,36 L45,41 L20,38Z" fill="${color}" stroke="#7c8a99" stroke-width="1.5"/>
  </g>`;
}

export const cloud = (x, y, s = 1, o = 0.9) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}" fill="#fff">
  <ellipse cx="0" cy="6" rx="26" ry="9"/><circle cx="-10" cy="-2" r="11"/><circle cx="6" cy="-6" r="14"/><circle cx="19" cy="1" r="9"/></g>`;

export const coffeeIcon = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-13,-9 H11 V8 Q11,17 2,17 H-4 Q-13,17 -13,8Z" fill="#f4f1ea" stroke="#5b4636" stroke-width="2"/>
  <path d="M11,-4 H15 Q20,-4 20,2 Q20,8 14,8 H11" fill="none" stroke="#5b4636" stroke-width="2.5"/>
  <path d="M-11,-7 H9 V-2 H-11Z" fill="#6b3f24"/>
  <path d="M-6,-14 q3,-4 0,-8 M2,-14 q3,-4 0,-8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".8"/></g>`;

export const rerollIcon = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <circle r="19" fill="#e8ecf2" stroke="#59687a" stroke-width="2.5"/>
  <path d="M-9,-3 A10,10 0 0 1 8,-7" fill="none" stroke="#1d3b5c" stroke-width="3" stroke-linecap="round"/><path d="M9,-13 L9,-5 L1,-5" fill="none" stroke="#1d3b5c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M9,3 A10,10 0 0 1 -8,7" fill="none" stroke="#1d3b5c" stroke-width="3" stroke-linecap="round"/><path d="M-9,13 L-9,5 L-1,5" fill="none" stroke="#1d3b5c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`;

export const runway = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-12,18 L-6,-22 L6,-22 L12,18Z" fill="#454d57" stroke="#1e242b" stroke-width="2"/>
  <path d="M0,-18 v6 M0,-8 v6 M0,2 v6 M0,12 v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`;

export const trafficIcon = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${dieSVG(5, "traffic", 22)}</g>`;

export const lamp = (x, y, on, r = 7, color = COLORS.green) =>
  `<circle cx="${x}" cy="${y}" r="${r + 2}" fill="#0a0f14"/><circle cx="${x}" cy="${y}" r="${r}" fill="${on ? color : "#26313c"}" ${on ? `filter="url(#glow)"` : ""}/>
   <circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.3}" fill="#fff" opacity="${on ? 0.55 : 0.1}"/>`;

export const screw = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#1a232d" stroke="#3b4856" stroke-width="1"/><path d="M${x - 3},${y - 3} L${x + 3},${y + 3}" stroke="#4d5c6c" stroke-width="1.3"/>`;

const ICONS = {
  radio: `<path d="M-9,4 V-3 a9,9 0 0 1 18,0 V4" fill="none" stroke="#fff" stroke-width="2.6"/><rect x="-12" y="0" width="6" height="10" rx="2.5" fill="#fff"/><rect x="6" y="0" width="6" height="10" rx="2.5" fill="#fff"/><path d="M-9,10 q0,6 7,6" fill="none" stroke="#fff" stroke-width="2.2"/>`,
  gear: `<circle r="9" fill="#fff"/><circle r="4" fill="#1a232d"/><path d="M0,-14 V-9 M0,14 V9 M-14,0 H-9 M14,0 H9" stroke="#fff" stroke-width="3"/>`,
  flaps: `<path d="M-14,-4 H8 L14,0 L8,4 H-14Z M-14,6 H4 L9,9 L4,12 H-14Z" fill="#fff"/>`,
  brake: `<rect x="-11" y="-11" width="22" height="22" rx="4" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M-5,-5 L5,5 M5,-5 L-5,5" stroke="#fff" stroke-width="2.6"/>`,
  coffee: `<path d="M-9,-6 H7 V6 Q7,12 1,12 H-3 Q-9,12 -9,6Z M7,-3 H10 Q13,-3 13,1 Q13,5 9,5 H7" fill="none" stroke="#fff" stroke-width="2.4"/>`,
};
export const icon = (name, x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${ICONS[name] || ""}</g>`;

/** Sky + ground painting for the approach window, by scenario theme. */
export const THEMES = {
  day: ["#4aa3ff", "#bfe3ff", "#6b8f4e"], snow: ["#6aa8dc", "#e8f2fa", "#e9eef2"], dusk: ["#3a3f8f", "#f0a070", "#3b4a45"],
  sea: ["#3d8fe0", "#cfe9ff", "#2f6fa6"], forest: ["#3e86c9", "#c3e0f2", "#2f6b3f"], fog: ["#8e9aa5", "#d2d8dd", "#69747c"],
  mountain: ["#5a8fc2", "#d6e6f2", "#7a6a55"], storm: ["#2c3550", "#6b7592", "#2b3b3a"], blizzard: ["#97a6b5", "#e9eef3", "#d6dde4"],
};
