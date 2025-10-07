// wheel.js
// Render a probability-weighted spinning wheel using canvas, based on lunch_wheel_with_golden_poison.json

import initialItems from "./wheel_data_loader.mjs";

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const respinsBtn = document.getElementById("respinsBtn");
const winnerEl = document.getElementById("winner");
const itemsListEl = document.getElementById("itemsList");
const confettiEl = document.getElementById("confetti");

// Drawing constants
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = Math.min(centerX, centerY) - 12;
const ringWidth = 52; // more inner margin for labels

// Derived data: normalize probabilities and compute cumulative angles
let items = loadState() ?? structuredClone(initialItems);
normalizeItems(items);
let baseRotationOffset = 0; // ensures Golden and Poison are opposite

const totalProb = items.reduce((s, it) => s + it.Prob, 0);
const normalized = items.map((it) => ({
  name: it.Name,
  prob: it.Prob / totalProb,
  angle: (it.Prob / totalProb) * Math.PI * 2,
}));

const slices = [];
let acc = 0;
for (const it of normalized) {
  const start = acc;
  const end = acc + it.angle;
  slices.push({ name: it.name, prob: it.prob, start, end });
  acc = end;
}

// Utility: generate pleasing distinct colors across slices
function colorForIndex(i, total) {
  const hue = Math.round((360 * i) / total);
  return `hsl(${hue} 80% 55%)`;
}

function drawWheel(rotation = 0) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(baseRotationOffset + rotation);

  // segments
  slices.forEach((slice, i) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, slice.start, slice.end);
    ctx.closePath();

    // Special styling for Golden and Poison (3D pop without icons)
    if (slice.name === 'Golden') {
      const goldGrad = ctx.createRadialGradient(0, 0, radius*0.15, 0, 0, radius);
      goldGrad.addColorStop(0, '#fff7cc');
      goldGrad.addColorStop(0.5, '#ffd54a');
      goldGrad.addColorStop(1, '#ffb300');
      ctx.fillStyle = goldGrad;
      ctx.fill();
    } else if (slice.name === 'Poison') {
      const darkGrad = ctx.createRadialGradient(0, 0, radius*0.15, 0, 0, radius);
      darkGrad.addColorStop(0, '#200000');
      darkGrad.addColorStop(0.55, '#990000');
      darkGrad.addColorStop(1, '#000000');
      ctx.fillStyle = darkGrad;
      ctx.fill();
    } else {
      // base color for regular slices
      ctx.fillStyle = colorForIndex(i, slices.length);
      ctx.fill();
    }
    
    // slice shading for 3D depth (center lighter, edge darker)
    const shadeGrad = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius);
    shadeGrad.addColorStop(0, "rgba(255,255,255,0.10)");
    shadeGrad.addColorStop(0.5, "rgba(255,255,255,0.02)");
    shadeGrad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = shadeGrad;
    ctx.fill();
    
    // border around slice
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // label on arc midpoint - adjust for larger wheel
    const mid = (slice.start + slice.end) / 2;
    const labelR = radius - ringWidth - 14; // slightly outward relative to previous
    const x = Math.cos(mid) * labelR;
    const y = Math.sin(mid) * labelR;
    ctx.save();
    ctx.fillStyle = slice.name === 'Poison' ? "#ffffff" : "#0b1020";
    ctx.font = "600 13px Inter, system-ui, sans-serif"; // slightly larger on bigger wheel
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(x, y);
    ctx.rotate(mid);
    const text = slice.name;
    wrapFillText(ctx, text, 110, 16); // allow wider labels
    ctx.restore();
  });

  // beveled outer rim for 3D look (thicker)
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  const outerRim = ctx.createRadialGradient(0, 0, radius - 10, 0, 0, radius + 14);
  outerRim.addColorStop(0, "rgba(255,255,255,0.22)");
  outerRim.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.strokeStyle = outerRim;
  ctx.lineWidth = 16;
  ctx.stroke();

  // inner rim
  ctx.beginPath();
  ctx.arc(0, 0, radius - 30, 0, Math.PI * 2);
  const innerRim = ctx.createRadialGradient(0, 0, radius - 60, 0, 0, radius - 18);
  innerRim.addColorStop(0, "rgba(255,255,255,0.20)");
  innerRim.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.strokeStyle = innerRim;
  ctx.lineWidth = 10;
  ctx.stroke();

  // glossy highlight arc
  ctx.beginPath();
  ctx.arc(0, 0, radius - 12, -Math.PI * 0.9, -Math.PI * 0.2);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.stroke();

  // draw pegs along rim at slice boundaries
  drawPegs();

  // center cap with Octave logo
  const centerRadius = 36;
  
  // Outer gradient rings
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, centerRadius);
  gradient.addColorStop(0, "#1a0b2e"); // dark purple center
  gradient.addColorStop(0.3, "#6b46c1"); // purple
  gradient.addColorStop(0.6, "#3b82f6"); // blue
  gradient.addColorStop(0.8, "#06b6d4"); // cyan
  gradient.addColorStop(1, "#8b5cf6"); // light purple
  
  ctx.beginPath();
  ctx.arc(0, 0, centerRadius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Border
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,.3)";
  ctx.stroke();
  
  // Draw the star logo
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  
  // Four-pointed star
  const starSize = 12;
  ctx.beginPath();
  ctx.translate(0, 0);
  
  // Draw star points
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const x1 = Math.cos(angle) * starSize;
    const y1 = Math.sin(angle) * starSize;
    const x2 = Math.cos(angle + Math.PI/4) * (starSize * 0.4);
    const y2 = Math.sin(angle + Math.PI/4) * (starSize * 0.4);
    const x3 = Math.cos(angle + Math.PI/2) * starSize;
    const y3 = Math.sin(angle + Math.PI/2) * starSize;
    
    if (i === 0) {
      ctx.moveTo(x1, y1);
    } else {
      ctx.lineTo(x1, y1);
    }
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.restore();

  ctx.restore();
}

// Pegs parameters
const pegRadius = 6;

function drawPegs(){
  const pegDistance = radius + 8;
  // place pegs at each slice boundary (use slice.end to include final boundary)
  for (let i = 0; i < slices.length; i++) {
    const a = slices[i].end % (Math.PI * 2);
    const x = Math.cos(a) * pegDistance;
    const y = Math.sin(a) * pegDistance;
    const grad = ctx.createRadialGradient(x-2, y-2, 0, x, y, pegRadius*1.4);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.4, "#cccccc");
    grad.addColorStop(1, "#666666");
    ctx.beginPath();
    ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.stroke();
  }
}

// Decorative helpers for Golden/Poison
function drawStarsOnSlice(start, end, count, color){
  const midR = radius * 0.75;
  for (let k=0;k<count;k++){
    const a = start + Math.random()*(end-start);
    const r = midR + (Math.random()-0.5)*20;
    const x = Math.cos(a)*r;
    const y = Math.sin(a)*r;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(a);
    ctx.fillStyle = color;
    starPath(6, 5, 2.5);
    ctx.fill();
    ctx.restore();
  }
}

function starPath(points, outer, inner){
  ctx.beginPath();
  for (let i=0;i<points*2;i++){
    const ang = (i*Math.PI)/points;
    const r = (i%2===0)? outer: inner;
    ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
  }
  ctx.closePath();
}

function drawSkullsOnSlice(start, end, count){
  const midR = radius * 0.7;
  for (let k=0;k<count;k++){
    const a = start + Math.random()*(end-start);
    const r = midR + (Math.random()-0.5)*16;
    const x = Math.cos(a)*r;
    const y = Math.sin(a)*r;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(a);
    ctx.scale(0.9,0.9);
    skullPath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

function skullPath(){
  ctx.beginPath();
  ctx.arc(0,-3,5,Math.PI,0); // cranium
  ctx.lineTo(5,2);
  ctx.arc(3,2,2,0,Math.PI/2);
  ctx.arc(0,2,2,0,Math.PI);
  ctx.arc(-3,2,2,Math.PI/2,Math.PI);
  ctx.lineTo(-5,-3);
  ctx.closePath();
  // eyes
  ctx.moveTo(-2,-2);
  ctx.arc(-2,-2,1.2,0,Math.PI*2);
  ctx.moveTo(2,-2);
  ctx.arc(2,-2,1.2,0,Math.PI*2);
}

function wrapFillText(context, text, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    const tentative = current ? current + " " + w : w;
    if (context.measureText(tentative).width <= maxWidth) {
      current = tentative;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  const totalHeight = (lines.length - 1) * lineHeight;
  let y = -totalHeight / 2;
  for (const line of lines) {
    context.fillText(line, 0, y);
    y += lineHeight;
  }
}

// Weighted pick consistent with server script
function pickWeighted(itemsArr) {
  let sum = 0;
  const cum = itemsArr.map((it) => {
    sum += it.Prob;
    return { name: it.Name, cum: sum };
  });
  const r = Math.random();
  const found = cum.find((x) => x.cum >= r) ?? cum[cum.length - 1];
  return found.name;
}

// Compute angle range for a given name in current slices
function angleForName(name) {
  const s = slices.find((sl) => sl.name === name);
  if (!s) return null;
  return { start: s.start, end: s.end };
}

// Spin state
let currentRotation = 0; // radians
let spinning = false;
let audioCtx = null;
let lastPegBoundary = -1;

function spinToWinner(name) {
  const sector = angleForName(name);
  if (!sector) return;

  // We want the pointer (at canvas up, which is 0 radians in our unrotated frame) to land in the middle of sector
  const mid = (sector.start + sector.end) / 2;

  // target rotation so that mid aligns to -90deg pointer (canvas y-)
  const pointerAngle = -Math.PI / 2; // top
  // required rotation to bring slice.mid to pointerAngle, modulo 2π
  // account for the baseRotationOffset already applied in drawWheel
  let target = pointerAngle - (mid + baseRotationOffset);

  // add multiple full rotations for flair (always positive for clockwise)
  const extraTurns = 3 + Math.floor(Math.random() * 3); // 3-5 turns
  target += extraTurns * Math.PI * 2;

  const start = currentRotation;
  // Always go forward (positive rotation) for clockwise spin
  const delta = target - start;

  const duration = 4500; // ms
  const startTs = performance.now();

  spinning = true;
  spinBtn.disabled = true;
  respinsBtn.disabled = true;

  function tick(now) {
    const t = Math.min(1, (now - startTs) / duration);
    const eased = easeOutCubic(t);
    currentRotation = start + delta * eased;
    drawWheel(currentRotation);
    tickPegSound();
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      spinning = false;
      spinBtn.disabled = false;
      respinsBtn.disabled = false;
      winnerEl.textContent = `Winner: ${name}`;
      triggerWinnerCelebration(name);
      // Normalize rotation to prevent accumulation
      currentRotation = currentRotation % (Math.PI * 2);
    }
  }
  requestAnimationFrame(tick);
}

function shortestAngularDistance(a, b) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function ensureAudio(){
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Play a short click when a peg passes the top pointer
function tickPegSound(){
  ensureAudio();
  const pointerAngle = -Math.PI/2; // top
  // angle of wheel relative to pointer; boundary occurs when (boundaryAngle + rotation) crosses pointerAngle
  for (let i = 0; i < slices.length; i++) {
    const boundary = slices[i].end; // radians in wheel space
    // convert to screen by applying rotation
    const screenAngle = (boundary + currentRotation) % (Math.PI * 2);
    // Is this boundary near the pointer? Allow small epsilon window
    const diff = Math.abs(normalizeAngle(screenAngle) - normalizeAngle(pointerAngle));
    if (diff < 0.02) { // ~1.1 degrees
      if (lastPegBoundary !== i) {
        lastPegBoundary = i;
        playClick();
      }
      return;
    }
  }
}

function normalizeAngle(a){
  return ((a % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
}

function playClick(){
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.09);
}

function triggerWinnerCelebration(name){
  winnerEl.classList.remove("celebrate");
  // force reflow to restart animation
  void winnerEl.offsetWidth;
  winnerEl.classList.add("celebrate");

  // spawn sparkles
  confettiEl.innerHTML = "";
  const colors = ["spark-cyan","spark-pink","spark-yellow","spark-purple"];
  const rect = winnerEl.getBoundingClientRect();
  const centerX = rect.left + rect.width/2;
  const centerY = rect.top + rect.height/2;
  const particleCount = 48;
  for(let i=0;i<particleCount;i++){
    const s = document.createElement("div");
    s.className = `sparkle ${colors[i%colors.length]}`;
    const angle = (i/particleCount)*Math.PI*2;
    const dist = 90 + Math.random()*120;
    const dx = Math.cos(angle)*dist;
    const dy = Math.sin(angle)*dist;
    s.style.setProperty("--dx", dx+"px");
    s.style.setProperty("--dy", dy+"px");
    s.style.left = (centerX - 4) + "px";
    s.style.top = (centerY - 4) + "px";
    s.style.animationDelay = (Math.random()*250) + "ms";
    confettiEl.appendChild(s);
    // auto-remove
    setTimeout(()=>{ s.remove(); }, 1600);
  }
}

function renderItemsList() {
  const hdr = ["Item", "%", "Prob", "Actions"]; 
  const rows = [
    `<div class="hdr">${hdr[0]}</div>`,
    `<div class="hdr">${hdr[1]}</div>`,
    `<div class="hdr">${hdr[2]}</div>`,
    `<div class="hdr">${hdr[3]}</div>`,
  ];
  items.forEach((it, idx) => {
    const pct = (it.Prob * 100).toFixed(2);
    const nameBadge = it.Name === 'Golden' ? ' style="color:#ffd54a;font-weight:900"' : it.Name === 'Poison' ? ' style="color:#ff4d4d;font-weight:900"' : '';
    rows.push(
      `<div class="row"><input data-idx="${idx}" data-field="Name" value="${escapeHtml(it.Name)}"${nameBadge}/></div>`,
      `<div class="row"><input data-idx="${idx}" data-field="Percent" type="number" min="0" step="0.1" value="${pct}"/></div>`,
      `<div class="row"><input data-idx="${idx}" data-field="Prob" type="number" min="0" max="1" step="0.0001" value="${it.Prob.toFixed(4)}"/></div>`,
      `<div class="row"><button data-idx="${idx}" data-action="delete" class="ghost">Delete</button></div>`
    );
  });
  itemsListEl.innerHTML = rows.join("");

  // Bind change handlers
  itemsListEl.querySelectorAll('input').forEach((el) => {
    el.addEventListener('change', onEditorChange);
  });
  itemsListEl.querySelectorAll('button[data-action="delete"]').forEach((el) => {
    el.addEventListener('click', onDeleteItem);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}

// --- Editor state & helpers ---
function normalizeItems(arr){
  const sum = arr.reduce((s, it) => s + (it.Prob ?? 0), 0) || 1;
  arr.forEach((it) => { it.Prob = (it.Prob ?? 0) / sum; });
}

function saveState(){
  localStorage.setItem('wheelItems', JSON.stringify(items));
}
function loadState(){
  try{ return JSON.parse(localStorage.getItem('wheelItems') || 'null'); }catch{ return null; }
}

function onEditorChange(e){
  const input = e.target;
  const idx = Number(input.getAttribute('data-idx'));
  const field = input.getAttribute('data-field');
  if (field === 'Name') {
    items[idx].Name = input.value.trim();
  } else if (field === 'Percent') {
    const newPct = Math.max(0, Number(input.value) || 0) / 100;
    applyWeightChange(idx, newPct);
  } else if (field === 'Prob') {
    const newProb = Math.max(0, Math.min(1, Number(input.value) || 0));
    applyWeightChange(idx, newProb);
  }
  saveState();
  recomputeAndRedraw();
}

function onDeleteItem(e){
  const idx = Number(e.currentTarget.getAttribute('data-idx'));
  items.splice(idx, 1);
  normalizeItems(items);
  saveState();
  recomputeAndRedraw();
}

function applyWeightChange(targetIdx, newProb){
  // Conserve total = 1 by distributing delta among others proportionally
  const total = items.reduce((s, it)=> s + it.Prob, 0);
  const clampedNew = Math.max(0, Math.min(1, newProb));
  const delta = clampedNew - items[targetIdx].Prob;
  if (Math.abs(delta) < 1e-9) return;
  const others = items.filter((_,i)=> i!==targetIdx);
  const otherSum = others.reduce((s,it)=> s+it.Prob, 0) || 1;
  items[targetIdx].Prob = clampedNew;
  others.forEach((it)=>{
    const share = it.Prob / otherSum;
    it.Prob = Math.max(0, it.Prob - delta * share);
  });
  normalizeItems(items);
}

// Add / Reset buttons
document.getElementById('addItemBtn')?.addEventListener('click', ()=>{
  items.push({ Name: 'New Place', Prob: 0.02, Votes: null, Percent: null, Angle_deg: null });
  normalizeItems(items);
  saveState();
  recomputeAndRedraw();
});
document.getElementById('resetWeightsBtn')?.addEventListener('click', ()=>{
  items = structuredClone(initialItems);
  normalizeItems(items);
  saveState();
  recomputeAndRedraw();
});

function recomputeAndRedraw(){
  // Recompute normalized slices
  const total = items.reduce((s, it)=> s + it.Prob, 0) || 1;
  const norm = items.map((it)=> ({ name: it.Name, prob: it.Prob/total, angle: (it.Prob/total)*Math.PI*2 }));
  slices.length = 0;
  let acc2 = 0;
  for(const it of norm){
    const start = acc2;
    const end = acc2 + it.angle;
    slices.push({ name: it.name, prob: it.prob, start, end });
    acc2 = end;
  }
  // Recompute baseRotationOffset to keep Golden and Poison opposite when present
  baseRotationOffset = 0;
  let gMid=null,pMid=null; let a2=0;
  for(const it of norm){
    const start = a2; const end = a2 + it.angle; const mid=(start+end)/2;
    if (it.name==='Golden') gMid=mid; else if (it.name==='Poison') pMid=mid;
    a2=end;
  }
  // Aim to place Golden at 12 o'clock and Poison at 6 relative to the pointer at -PI/2
  if (gMid!=null && pMid!=null){
    // Base offset to bring Golden to top
    const offToTop = normalizeAngle(-Math.PI/2 - gMid);
    // After applying that, where would Poison land?
    const poisonAfter = normalizeAngle(pMid + offToTop);
    // We want poisonAfter to be +PI/2 (6 o'clock relative to pointer-top)
    const correction = normalizeAngle((Math.PI/2) - poisonAfter);
    baseRotationOffset = normalizeAngle(offToTop + correction);
  } else if (gMid!=null) {
    baseRotationOffset = normalizeAngle(-Math.PI/2 - gMid);
  } else if (pMid!=null) {
    // Put poison at 6 o'clock if golden missing
    baseRotationOffset = normalizeAngle(Math.PI/2 - pMid);
  }
  drawWheel(currentRotation);
  renderItemsList();
}

drawWheel(currentRotation);
renderItemsList();

let lastWinner = null;

spinBtn.addEventListener("click", () => {
  if (spinning) return;
  const name = pickWeighted(items);
  lastWinner = name;
  spinToWinner(name);
});

respinsBtn.addEventListener("click", () => {
  if (spinning) return;
  const name = lastWinner ?? pickWeighted(items);
  spinToWinner(name);
});


