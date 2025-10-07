console.log("[boot] starting picker.mjs");
// picker.mjs
import fs from "node:fs";

// Load the JSON file that has Name and Prob columns (sum ≈ 1.0)
const data = JSON.parse(
  fs.readFileSync("./lunch_wheel_with_golden_poison.json", "utf8")
);

// Weighted pick using cumulative probability
function pickWeighted(items) {
  let s = 0;
  const cum = items.map((it) => {
    s += it.Prob;
    return { name: it.Name, cum: s };
  });

  const r = Math.random();
  const found = cum.find((x) => x.cum >= r) ?? cum[cum.length - 1];
  return found.name;
}

// One spin:
const winner = pickWeighted(data);
console.log("🎯 Winner:", winner);