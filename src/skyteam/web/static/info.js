// What each part of the cockpit means. Click (or tap) anything on the board to read it.
// `infoFor(key, st)` returns { title, text } — text may use the live game state.

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

const SLOT = {
  axis: ["Axis space", "Mandatory every round: each pilot places one die here. When both are in, the plane tilts toward the side of the higher die by the difference (Pilot left, Co-Pilot right). Equal dice keep the plane where it is."],
  engine: ["Engine space", "Mandatory every round: one die from each pilot. Their sum is your speed. Compare it with the Aerodynamics markers on the speed ring: up to blue you hold position, up to orange you advance 1 space, above orange you advance 2."],
  radio: ["Radio", "A die here removes one airplane that many spaces ahead on the Approach Track, counting the space you are on as 1. The Pilot has one Radio, the Co-Pilot two."],
  gear: ["Landing Gear", "Pilot only, the die must match one of the printed values. Each lowered gear switch moves the blue Aerodynamics marker up by one, so you can fly faster without advancing. All three are needed to land."],
  flaps: ["Flaps", "Co-Pilot only, filled from top to bottom, the die must match the printed values. Each flap moves the orange Aerodynamics marker up by one. All four are needed to land."],
  brake: ["Brakes", "Pilot only, filled in order 2, 4, 6. Each switch moves the red Brake marker further along the brake scale. In the final round your speed must be lower than the Brake marker."],
  conc: ["Concentration", "Any die from either pilot. You gain a Coffee token (at most 3 in the supply)."],
  kerosene: ["Kerosene space", "Either pilot may place any die here: the fuel marker goes down that many spaces. If this space stays empty at the end of a round, you lose 6 kerosene instead."],
  intern: ["Intern space", "Place any die here (it must differ from the next token's value) and take the Intern token nearest your side. You then place that token like a die showing its number, anywhere except Concentration."],
  ice: ["Ice Brakes", "Two dice of the same value must go above and below the scale in the same round, from left to right. Each pair pushes the red marker on. The marker must pass the 5 before you land."],
};

const PARTS = {
  approach: (st) => ["Approach Track", `Your route to ${st.scenario.airport}. The plane is always on the space shown in the panel's window; each advance slides the strip down by one space. Everything printed on the spaces ahead is what you will meet.`],
  space: () => ["Approach space", "One step of your approach. The Engines decide how many spaces you advance each round (0, 1 or 2). You may not leave a space while airplanes are still on it."],
  airport: (st) => ["Airport", `${st.scenario.airport}. You must be here by the start of the final round and must not advance past it: overshooting the airport is a loss. If you reach it early, you hold the pattern here.`],
  start: () => ["Start", "The clouds: where the flight begins at 6000 ft."],
  planes: () => ["Airplanes in your way", "Other traffic on this space. Leaving a space that still has an airplane on it is a collision, and you lose. Clear them with the Radio spaces before you advance."],
  traffic: () => ["Traffic die icon", "At the start of each round while you are on this space, roll the black Traffic die once per cube. A roll of 1 puts a new airplane on your current space, 2 on the next one, and so on (never beyond the airport)."],
  turn: () => ["Turn", "A turn in the approach. When the plane enters this space, the Axis must point at one of the triangles (the filled one is level). Entering with the Axis on a red cross means you leave the corridor and lose."],
  altitude: (st) => ["Altitude Track", `Seven rounds, from 6000 ft down to the final approach; one step per round. The arrow and colour show who places first in that round. You are in round ${st.round} of 7.`],
  final: () => ["Final round", "The last round. You land if, at its end, no airplanes are left, all gear and flaps are out, the plane is level, all Intern tokens are used, and your speed is below the Brake marker."],
  "reroll-track": () => ["Reroll on the altitude track", "When the plane descends to this altitude, a Reroll token joins your supply."],
  rerolls: (st) => ["Reroll tokens", `You have ${st.rerolls}. Spend one before placing a die: both pilots may then reroll any of their unplaced dice. Tokens come from the altitude track.`],
  dial: (st) => ["Axis (attitude)", `The plane's balance, currently ${st.axis === 0 ? "level" : `${Math.abs(st.axis)} mark${Math.abs(st.axis) > 1 ? "s" : ""} to the ${st.axis < 0 ? "Pilot's side" : "Co-Pilot's side"}`}. It tilts by the difference of the two Axis dice. Reaching a red cross (3 marks) means the plane spins out. It must be level at the end of the final round.`],
  speed: (st) => ["Speed ring", `Shows the Engines total. The blue band is "hold position" (2–${st.blue}), amber is "advance 1" (${st.blue + 1}–${st.orange}), red is "advance 2"${st.orange >= 12 ? " (out of reach now)" : ` (${st.orange + 1}+)`}.`],
  "blue-marker": (st) => ["Blue Aerodynamics marker", `At ${st.blue}. An Engines total up to this value keeps you in place. Each Landing Gear moves it up by one.`],
  "orange-marker": (st) => ["Orange Aerodynamics marker", `At ${st.orange}. A total above blue and up to this value advances 1 space; anything higher advances 2. Each Flap moves it up by one.`],
  "engines-total": (st) => ["Engines total", st.speed === null ? "Appears once both Engine dice are placed." : `This round's speed: ${st.speed}.`],
  "brake-scale": (st) => ["Brake marker", `${st.brakeLimit ? `Your speed in the final round must be below ${st.brakeLimit}.` : "No brakes deployed yet: any speed in the final round is too fast."} Each Brake switch moves the marker on.`],
  "ice-scale": (st) => ["Ice Brakes marker", `${st.icePairs} of 4 pairs placed. Each matching pair moves the marker; it has to pass the 5 before landing.`],
  coffee: (st) => ["Coffee", `You have ${st.coffee} of 3. Earned on Concentration spaces. When placing a die you may spend coffee to change its value by 1 per token (no wrap-around from 6 to 1).`],
  switch: () => ["Switch", "Slides over and lights up when the space above it is done for the rest of the flight."],
  "kerosene-track": (st) => ["Kerosene", `${Math.max(0, st.kerosene)} left. If the marker reaches the red cross you have run out of fuel and lose, even during the final round.`],
  "kerosene-burn": () => ["Fuel burn", "If nobody places a die on the Kerosene space this round, you lose 6 kerosene at the end of the round."],
  "leak-track": (st) => ["Kerosene (leaking)", `${Math.max(0, st.kerosene)} left. Each round the loss is the difference between the two Engine dice plus 1. Reaching the red cross is a loss.`],
  leak: () => ["Kerosene space closed", "With the leak module the Kerosene space cannot be used."],
  wind: (st) => ["Wind", `The wind currently adds ${sign(st.windSpeed)} to the Engines total. After the Axis is resolved, the airplane turns one step around the ring per mark the Axis is off centre, toward that side.`],
  "intern-tokens": (st) => ["Intern tokens", `${st.interns.length} left. Taken from the end nearest the pilot who uses an Intern space. All of them must be used before you land.`],
};

export function infoFor(key, st) {
  if (key.startsWith("slot:")) {
    const s = st.slots[key.slice(5)];
    const [title, text] = SLOT[s.kind] || ["Space", ""];
    const who = s.owner === "pilot" ? "Pilot (blue)" : s.owner === "copilot" ? "Co-Pilot (orange)" : "either pilot";
    const state = s.die ? `Holds a ${s.die.value} from the ${s.die.seat === "pilot" ? "Pilot" : "Co-Pilot"}.` : s.on ? "Already done." : s.accepts ? `Accepts ${s.accepts.join(" or ")}.` : "";
    return { title, text, meta: `For ${who}. ${state}`.trim() };
  }
  const f = PARTS[key];
  if (!f) return null;
  const [title, text] = f(st);
  return { title, text };
}
