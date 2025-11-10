// wheel.js
// Render a probability-weighted spinning wheel using canvas, based on lunch_wheel_with_golden_poison.json

import initialItems from "./wheel_data_loader.mjs";

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");
const respinsBtn = document.getElementById("respinsBtn");
const shareToSlackBtn = document.getElementById("shareToSlackBtn");
// const testImageUploadBtn = document.getElementById("testImageUploadBtn"); // TEST BUTTON - Commented out
const winnerEl = document.getElementById("winner");
const itemsListEl = document.getElementById("itemsList");
const confettiEl = document.getElementById("confetti");

// Slack webhook URL
const SF_TEAMS_SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/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";
const DEV_SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/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"
const DEBUG = false;
const CHANNEL_TO_USE = DEBUG ? DEV_SLACK_WEBHOOK_URL : SF_TEAMS_SLACK_WEBHOOK_URL;
// Spin history storage
const SPIN_HISTORY_KEY = "lunchWheelSpinHistory";
const USER_NAME_KEY = "lunchWheelUserName";
const USER_ID_KEY = "lunchWheelUserId";
const LEDGER_JSON_FILE = "ledger.json"; // File in the repo to store ledger data
const GITHUB_REPO_OWNER = "alec-octave";
const GITHUB_REPO_NAME = "alec-octave.github.io";
const GITHUB_BRANCH = "main";

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
      winnerEl.style.display = "block"; // Show winner element
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

  // Save spin to history
  saveSpinToHistory(name);

  // Show share button
  shareToSlackBtn.style.display = "inline-block";
  shareToSlackBtn.dataset.winner = name;

  // Update ledger
  updateLunchLedger().catch(console.error);
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

// Generate a unique user ID
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get user ID from localStorage (create if doesn't exist)
function getUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    // Initialize from existing username if available (for backward compatibility)
    const existingName = localStorage.getItem(USER_NAME_KEY);
    if (existingName) {
      // Generate ID based on existing name hash for consistency
      userId = 'user_' + btoa(existingName).replace(/[^a-zA-Z0-9]/g, '').substr(0, 16) + '_' + Date.now();
    } else {
      userId = generateUserId();
    }
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

// Get user name from localStorage
function getUserName() {
  return localStorage.getItem(USER_NAME_KEY) || null;
}

// Save user name to localStorage
function saveUserName(name) {
  if (name && name.trim()) {
    localStorage.setItem(USER_NAME_KEY, name.trim());
    // Ensure user ID exists
    getUserId();
    return true;
  }
  return false;
}

// Initialize name modal (only once)
let nameModalInitialized = false;

function initNameModal() {
  if (nameModalInitialized) return;

  const modal = document.getElementById('nameModal');
  const nameInput = document.getElementById('userNameInput');
  const saveNameBtn = document.getElementById('saveNameBtn');

  if (!modal || !nameInput || !saveNameBtn) {
    setTimeout(initNameModal, 100);
    return;
  }

  nameModalInitialized = true;

  // Save on button click
  saveNameBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
      saveUserName(name);
      modal.style.display = 'none';
    } else {
      alert('Please enter your name');
    }
  });

  // Save on Enter key
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveNameBtn.click();
    }
  });
}

// Show name collection modal
function showNameModal() {
  initNameModal();
  const modal = document.getElementById('nameModal');
  const nameInput = document.getElementById('userNameInput');

  if (modal && nameInput) {
    modal.style.display = 'flex';
    nameInput.value = ''; // Clear input
    nameInput.focus();
  }
}

// Check for user name on page load
function checkUserName() {
  const userName = getUserName();
  if (!userName) {
    showNameModal();
  }
}

// Spin history functions
async function saveSpinToHistory(result) {
  const history = await getSpinHistory();
  const userName = getUserName();
  const userId = getUserId();
  const entry = {
    timestamp: new Date().toISOString(),
    result: result,
    user: userName || 'Unknown',
    userId: userId
  };
  history.push(entry);

  // Save to localStorage as backup
  localStorage.setItem(SPIN_HISTORY_KEY, JSON.stringify(history));

  // Check for GitHub token and prompt if missing
  const githubToken = getGitHubToken();
  if (!githubToken) {
    // Show prompt to add token
    const shouldAdd = confirm(
      "⚠️ No GitHub token found!\n\n" +
      "Your spin has been saved locally, but won't be synced to the shared ledger.\n\n" +
      "Would you like to add your GitHub token now?\n\n" +
      "(You can also add it later in Settings)"
    );
    if (shouldAdd) {
      // Open settings section
      const settingsSection = document.getElementById("settingsSection");
      if (settingsSection) {
        settingsSection.open = true;
        const tokenInput = document.getElementById("githubTokenInput");
        if (tokenInput) {
          tokenInput.focus();
        }
      }
    }
  } else {
    // Try to save to GitHub file
    try {
      await saveToGitHubFile(history);
    } catch (error) {
      console.log("Could not save to GitHub file, using localStorage only:", error);
    }
  }
}

async function getSpinHistory() {
  // Try to load from GitHub file first (public, no auth needed)
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/${GITHUB_BRANCH}/${LEDGER_JSON_FILE}?t=${Date.now()}`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        // Also sync to localStorage
        localStorage.setItem(SPIN_HISTORY_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (error) {
    console.log("Could not load from GitHub file, using localStorage:", error);
  }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(SPIN_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Get GitHub token from localStorage
function getGitHubToken() {
  return localStorage.getItem('githubToken') || null;
}

// Save GitHub token to localStorage
function saveGitHubToken(token) {
  if (token && token.trim()) {
    localStorage.setItem('githubToken', token.trim());
    return true;
  }
  return false;
}

// Clear GitHub token from localStorage
function clearGitHubToken() {
  localStorage.removeItem('githubToken');
}

// Save to GitHub file using GitHub API directly
// Note: Requires a GitHub Personal Access Token (PAT) with repo scope
// Token is stored in localStorage (not in code)
async function saveToGitHubFile(history) {
  const GITHUB_TOKEN = getGitHubToken();

  if (!GITHUB_TOKEN) {
    console.log('No GitHub token configured. Ledger saved to localStorage only.');
    return;
  }

  try {
    // Get current file SHA (required for update)
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${LEDGER_JSON_FILE}`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    let sha = null;
    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      sha = fileData.sha;
    }

    // Encode content to base64
    const content = JSON.stringify(history, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    // Create or update file
    const updateResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${LEDGER_JSON_FILE}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Update ledger.json [skip ci]`,
          content: encodedContent,
          branch: GITHUB_BRANCH,
          ...(sha && { sha }) // Include SHA if updating existing file
        })
      }
    );

    if (updateResponse.ok) {
      console.log('Ledger saved to GitHub successfully');
    } else {
      const error = await updateResponse.text();
      console.error('Failed to save to GitHub:', error);
    }
  } catch (error) {
    console.error('Error saving to GitHub:', error);
  }
}

// Alternative: Use GitHub Gists API (simpler, but still needs auth)
// This could be done with a backend service

// Slack notification
async function sendToSlack(winner, screenshotDataUrl) {
  try {
    // Upload screenshot to Cloudinary
    let imageUrl = null;

    // Convert data URL to blob once
    const blobResponse = await fetch(screenshotDataUrl);
    const blob = await blobResponse.blob();

    // Cloudinary configuration (set these in index.html)
    const CLOUDINARY_CLOUD_NAME = window.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_UPLOAD_PRESET = window.CLOUDINARY_UPLOAD_PRESET || 'ml_default'; // Default preset name

    // Try Cloudinary first (fast, reliable CDN)
    if (CLOUDINARY_CLOUD_NAME) {
      try {
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'lunch-wheel'); // Optional: organize in folder

        const cloudinaryResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: 'POST',
            body: formData
          }
        );

        if (cloudinaryResponse.ok) {
          const cloudinaryData = await cloudinaryResponse.json();
          if (cloudinaryData.secure_url) {
            imageUrl = cloudinaryData.secure_url;
            console.log('✅ Image uploaded to Cloudinary:', imageUrl);
          }
        }
      } catch (cloudinaryError) {
        console.log('Cloudinary upload failed, trying fallback...', cloudinaryError);
      }
    }

    // If Cloudinary failed and no image URL, log error
    if (!imageUrl) {
      console.error('Cloudinary upload failed. Make sure CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET are configured.');
    }

    // Create Slack block message
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🎯 Lunch Wheel Result",
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Winner:*\n${winner}`
          },
          {
            type: "mrkdwn",
            text: `*Time:*\n${new Date().toLocaleString()}`
          },
          {
            type: "mrkdwn",
            text: `*Spun by:*\n${getUserName() || 'Unknown'}`
          }
        ]
      }
    ];

    // Add image if we successfully uploaded it
    if (imageUrl) {
      blocks.push({
        type: "image",
        image_url: imageUrl,
        alt_text: `Lunch wheel result: ${winner}`
      });
    } else {
      console.log('No image URL available, sending text-only message');
    }

    const payload = {
      text: `🎯 Lunch Wheel Result: ${winner}`,
      blocks: blocks
    };

    // Slack webhooks don't support CORS from browsers
    // Use no-cors mode to send the request (we can't read the response, but it will send)
    // Note: no-cors mode doesn't allow custom headers, so we send JSON as plain text
    await fetch(CHANNEL_TO_USE, {
      method: "POST",
      mode: "no-cors", // Bypasses CORS but we can't read response or set custom headers
      body: JSON.stringify(payload)
    });

    // With no-cors, response will always be opaque, so we can't check if it succeeded
    // But the request will be sent. Show success message optimistically.
    alert("✅ Shared to Slack!");
  } catch (error) {
    console.error("Error sending to Slack:", error);
    alert("❌ Failed to share to Slack. Please try again.");
  }
}

// Capture canvas as image (just the wheel, no buttons)
// Optionally draws winner text on the canvas before capturing
function captureWheelScreenshot(winner = null) {
  // Create a temporary canvas with background for the screenshot
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height + 100; // Extra space for winner text
  const tempCtx = tempCanvas.getContext('2d');

  // Draw dark background (matching app theme)
  tempCtx.fillStyle = "#0a0a0a";
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Draw the wheel from the original canvas (centered)
  tempCtx.drawImage(canvas, 0, 0);

  // If winner is provided, draw it below the wheel
  if (winner) {
    const bannerY = canvas.height + 10; // Below the wheel
    const bannerHeight = 80;
    const bannerX = (tempCanvas.width - 400) / 2; // Center the banner

    // Draw a semi-transparent background banner
    tempCtx.fillStyle = "rgba(0, 0, 0, 0.9)";
    tempCtx.fillRect(bannerX, bannerY, 400, bannerHeight);

    // Add a border
    tempCtx.strokeStyle = "rgba(0, 255, 255, 0.6)";
    tempCtx.lineWidth = 2;
    tempCtx.strokeRect(bannerX, bannerY, 400, bannerHeight);

    // Draw "WINNER:" label (uppercase, bold)
    tempCtx.fillStyle = "#00ffff";
    tempCtx.font = "bold 28px Inter, system-ui, sans-serif";
    tempCtx.textAlign = "center";
    tempCtx.textBaseline = "middle";
    tempCtx.fillText("WINNER:", tempCanvas.width / 2, bannerY + 25);

    // Draw winner name (highlighted, larger, uppercase)
    tempCtx.fillStyle = "#ffd54a";
    tempCtx.font = "bold 36px Inter, system-ui, sans-serif";
    tempCtx.fillText(winner.toUpperCase(), tempCanvas.width / 2, bannerY + 60);
  }

  // Capture the temp canvas (includes background and winner text)
  const dataUrl = tempCanvas.toDataURL("image/png");

  return dataUrl;
}

// Share to Slack button handler
shareToSlackBtn.addEventListener("click", async () => {
  const winner = shareToSlackBtn.dataset.winner;
  if (!winner) return;

  shareToSlackBtn.disabled = true;
  shareToSlackBtn.textContent = "Sharing...";

  const screenshot = captureWheelScreenshot(winner);
  await sendToSlack(winner, screenshot);

  shareToSlackBtn.disabled = false;
  shareToSlackBtn.textContent = "Share to Slack";
});

// TEST FUNCTION - Test image upload without sending to Slack
// Comment out when done testing
async function testImageUpload() {
  console.log('🧪 Testing image upload...');
  testImageUploadBtn.disabled = true;
  testImageUploadBtn.textContent = "Testing...";

  try {
    // Use the last winner if available, otherwise pick a random one
    const testWinner = lastWinner || pickWeighted(items);
    console.log('Testing with winner:', testWinner);

    const screenshot = captureWheelScreenshot(testWinner);
    console.log('Screenshot captured, size:', screenshot.length, 'chars');

    // Convert data URL to blob
    const response = await fetch(screenshot);
    const blob = await response.blob();
    console.log('Blob created, size:', blob.size, 'bytes');

    // Try Cloudinary first (if configured)
    let imageUrl = null;
    const CLOUDINARY_CLOUD_NAME = window.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_UPLOAD_PRESET = window.CLOUDINARY_UPLOAD_PRESET || 'ml_default';

    if (CLOUDINARY_CLOUD_NAME) {
      console.log('Uploading to Cloudinary...');
      try {
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'lunch-wheel');

        const cloudinaryResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: 'POST',
            body: formData
          }
        );

        if (cloudinaryResponse.ok) {
          const cloudinaryData = await cloudinaryResponse.json();
          if (cloudinaryData.secure_url) {
            imageUrl = cloudinaryData.secure_url;
            console.log('✅ Image uploaded to Cloudinary:', imageUrl);
          }
        }
      } catch (cloudinaryError) {
        console.log('Cloudinary failed, trying 0x0.st...', cloudinaryError);
      }
    }

    // If Cloudinary failed, log error
    if (!imageUrl) {
      console.error('Cloudinary upload failed. Make sure CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET are configured.');
    }

    if (imageUrl) {

        // Show the image in a new window for testing
        const testWindow = window.open('', '_blank');
        if (testWindow) {
          testWindow.document.write(`
            <html>
              <head><title>Test Image</title></head>
              <body style="margin: 0; padding: 20px; background: #1a1a2e; color: #00ffff; font-family: monospace;">
                <h1>✅ Image Upload Test Successful!</h1>
                <p>Image URL: <a href="${imageUrl}" target="_blank" style="color: #00ffff;">${imageUrl}</a></p>
                <img src="${imageUrl}" alt="Test image" style="max-width: 100%; border: 2px solid #00ffff; margin-top: 20px;">
                <p style="margin-top: 20px;">This is the image that will be sent to Slack.</p>
              </body>
            </html>
          `);
        }

        alert(`✅ Image upload test successful!\n\nImage URL: ${imageUrl}\n\nCheck console for details.`);
    } else {
      console.error('❌ All upload methods failed');
      alert('❌ Upload failed. Check console for details.');
    }
  } catch (error) {
    console.error('❌ Test error:', error);
    alert('❌ Test failed. Check console for details.');
  }

  testImageUploadBtn.disabled = false;
  testImageUploadBtn.textContent = "🧪 Test Image Upload";
}

// TEST BUTTON - Commented out
// if (testImageUploadBtn) {
//   testImageUploadBtn.addEventListener("click", testImageUpload);
// }

// Lunch Ledger functions
let histogramChart = null;
let pieChart = null;
let userHistogramCharts = {};

async function updateLunchLedger() {
  const history = await getSpinHistory();

  // Update table
  updateLedgerTable(history);

  // Update charts
  updateHistogramChart(history);
  updatePieChart(history);
  updateUserHistograms(history);
}

function updateLedgerTable(history) {
  const tableEl = document.getElementById("ledgerTable");
  if (!tableEl) return;

  // Show last 20 entries
  const recent = history.slice(-20).reverse();

  if (recent.length === 0) {
    tableEl.innerHTML = "<p style='color: var(--muted); text-align: center;'>No spins yet</p>";
    return;
  }

  let html = `
    <table class="ledger-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Time</th>
          <th>User</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
  `;

  recent.forEach(entry => {
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();
    const user = entry.user || 'Unknown';
    html += `
      <tr>
        <td>${dateStr}</td>
        <td>${timeStr}</td>
        <td>${escapeHtml(user)}</td>
        <td>${escapeHtml(entry.result)}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  tableEl.innerHTML = html;
}

function updateHistogramChart(history) {
  const canvas = document.getElementById("histogramChart");
  if (!canvas) return;

  // Filter last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recent = history.filter(entry => {
    const date = new Date(entry.timestamp);
    return date >= thirtyDaysAgo;
  });

  // Count occurrences of each winner
  const winnerCounts = {};
  recent.forEach(entry => {
    winnerCounts[entry.result] = (winnerCounts[entry.result] || 0) + 1;
  });

  // Sort by count (descending) and get top results
  const sortedWinners = Object.entries(winnerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20); // Show top 20 winners

  const labels = sortedWinners.map(([winner]) => winner);
  const counts = sortedWinners.map(([, count]) => count);

  // Generate colors for each bar
  const colors = labels.map((_, i) => {
    const hue = Math.round((360 * i) / labels.length);
    return `hsl(${hue}, 80%, 55%)`;
  });

  if (histogramChart) {
    histogramChart.destroy();
  }

  histogramChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Wins",
        data: counts,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('55%)', '70%)')),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.parsed.y} ${context.parsed.y === 1 ? 'win' : 'wins'}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          },
          title: {
            display: true,
            text: 'Number of Wins'
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45
          },
          title: {
            display: true,
            text: 'Restaurant'
          }
        }
      }
    }
  });
}

function updatePieChart(history) {
  const canvas = document.getElementById("pieChart");
  if (!canvas) return;

  // Count occurrences of each result
  const counts = {};
  history.forEach(entry => {
    counts[entry.result] = (counts[entry.result] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const data = Object.values(counts);

  // Generate colors
  const colors = labels.map((_, i) => {
    const hue = Math.round((360 * i) / labels.length);
    return `hsl(${hue}, 80%, 55%)`;
  });

  if (pieChart) {
    pieChart.destroy();
  }

  pieChart = new Chart(canvas, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderColor: "rgba(0, 0, 0, 0.3)",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "right"
        }
      }
    }
  });
}

function updateUserHistograms(history) {
  const container = document.getElementById("userHistograms");
  if (!container) return;

  // Filter last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recent = history.filter(entry => {
    const date = new Date(entry.timestamp);
    return date >= thirtyDaysAgo;
  });

  // Group by user
  const userSpins = {};
  recent.forEach(entry => {
    const userId = entry.userId || entry.user || 'unknown';
    const userName = entry.user || 'Unknown';
    if (!userSpins[userId]) {
      userSpins[userId] = {
        name: userName,
        spins: []
      };
    }
    userSpins[userId].spins.push(entry);
  });

  // Clear existing charts
  Object.values(userHistogramCharts).forEach(chart => {
    if (chart) chart.destroy();
  });
  userHistogramCharts = {};
  container.innerHTML = '';

  // Create histogram for each user
  Object.entries(userSpins).forEach(([userId, userData]) => {
    if (userData.spins.length === 0) return;

    // Group spins by date
    const byDate = {};
    userData.spins.forEach(entry => {
      const date = new Date(entry.timestamp);
      const dateKey = date.toLocaleDateString();
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    });

    // Get last 30 days
    const dates = [];
    const counts = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toLocaleDateString();
      dates.push(dateKey);
      counts.push(byDate[dateKey] || 0);
    }

    // Create chart wrapper
    const chartWrapper = document.createElement('div');
    chartWrapper.className = 'chart-wrapper';
    chartWrapper.style.marginTop = '24px';

    const title = document.createElement('h3');
    title.textContent = `${userData.name} - Last 30 Days`;
    chartWrapper.appendChild(title);

    const canvas = document.createElement('canvas');
    canvas.id = `userHistogram_${userId}`;
    chartWrapper.appendChild(canvas);
    container.appendChild(chartWrapper);

    // Create chart
    const chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: dates,
        datasets: [{
          label: "Spins per day",
          data: counts,
          backgroundColor: "rgba(0, 255, 255, 0.6)",
          borderColor: "rgba(0, 255, 255, 1)",
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        }
      }
    });

    userHistogramCharts[userId] = chart;
  });
}

// Initialize ledger after wheel is drawn
drawWheel(currentRotation);
renderItemsList();
// Initialize user ID (creates one if doesn't exist)
getUserId();
// Initialize name modal
initNameModal();
// Check for user name on startup
checkUserName();
// Load ledger from GitHub file on startup
getSpinHistory().then(() => {
  updateLunchLedger();
});

// Test GitHub token by making an API call
async function testGitHubToken() {
  const token = getGitHubToken();
  if (!token) {
    return { success: false, message: 'No token found. Please add a token first.' };
  }

  try {
    // Test by trying to read the ledger file (requires read access)
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${LEDGER_JSON_FILE}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (response.ok) {
      return { success: true, message: '✅ Token is valid! You can sync spins to the ledger.' };
    } else if (response.status === 404) {
      // File doesn't exist yet, but token works
      return { success: true, message: '✅ Token is valid! (Ledger file will be created on first sync)' };
    } else if (response.status === 401 || response.status === 403) {
      return { success: false, message: '❌ Token is invalid or lacks permissions. Check that it has "repo" scope or "Contents: Write" permission.' };
    } else {
      const errorText = await response.text();
      return { success: false, message: `❌ Error: ${response.status} - ${errorText.substring(0, 100)}` };
    }
  } catch (error) {
    return { success: false, message: `❌ Network error: ${error.message}` };
  }
}

// GitHub token management UI
// Use a function that runs immediately (module scripts run after DOM is ready)
function initTokenManagement() {
  // Name management
  const nameInput = document.getElementById('userNameSettingsInput');
  const saveNameBtn = document.getElementById('saveNameSettingsBtn');
  const nameStatus = document.getElementById('nameStatus');

  if (nameInput && saveNameBtn && nameStatus) {
    // Load existing name
    const existingName = getUserName();
    if (existingName) {
      nameInput.value = existingName;
      nameStatus.textContent = '✅ Name saved';
      nameStatus.style.color = 'var(--green)';
    }

    // Save name
    saveNameBtn.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (name) {
        if (saveUserName(name)) {
          nameStatus.textContent = '✅ Name saved successfully!';
          nameStatus.style.color = 'var(--green)';
        }
      } else {
        nameStatus.textContent = '⚠️ Please enter a name';
        nameStatus.style.color = 'var(--red)';
      }
    });

    // Update status on input
    nameInput.addEventListener('input', () => {
      if (nameInput.value.trim()) {
        nameStatus.textContent = '💾 Click "Save Name" to save';
        nameStatus.style.color = 'var(--neon)';
      }
    });
  }

  // Token management
  const tokenInput = document.getElementById('githubTokenInput');
  const saveTokenBtn = document.getElementById('saveTokenBtn');
  const testTokenBtn = document.getElementById('testTokenBtn');
  const clearTokenBtn = document.getElementById('clearTokenBtn');
  const tokenStatus = document.getElementById('tokenStatus');

  if (!tokenInput || !saveTokenBtn || !testTokenBtn || !clearTokenBtn || !tokenStatus) {
    console.log('Token management UI elements not found, retrying...');
    setTimeout(initTokenManagement, 100);
    return;
  }

  // Load existing token (masked)
  const existingToken = getGitHubToken();
  if (existingToken) {
    tokenInput.value = '••••••••••••••••'; // Masked display
    tokenStatus.textContent = '✅ Token saved (hidden for security)';
    tokenStatus.style.color = 'var(--green)';
  }

  // Save token
  saveTokenBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token && token !== '••••••••••••••••') {
      if (saveGitHubToken(token)) {
        tokenInput.value = '••••••••••••••••'; // Mask after saving
        tokenStatus.textContent = '✅ Token saved successfully!';
        tokenStatus.style.color = 'var(--green)';
      }
    } else {
      tokenStatus.textContent = '⚠️ Please enter a valid token';
      tokenStatus.style.color = 'var(--red)';
    }
  });

  // Test token
  testTokenBtn.addEventListener('click', async () => {
    console.log('Test token button clicked');
    testTokenBtn.disabled = true;
    testTokenBtn.textContent = 'Testing...';
    tokenStatus.textContent = '🔄 Testing token...';
    tokenStatus.style.color = 'var(--neon)';

    try {
      const result = await testGitHubToken();
      console.log('Test result:', result);

      tokenStatus.textContent = result.message;
      tokenStatus.style.color = result.success ? 'var(--green)' : 'var(--red)';
    } catch (error) {
      console.error('Test error:', error);
      tokenStatus.textContent = `❌ Error: ${error.message}`;
      tokenStatus.style.color = 'var(--red)';
    } finally {
      testTokenBtn.disabled = false;
      testTokenBtn.textContent = 'Test Token';
    }
  });

  // Clear token
  clearTokenBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear your GitHub token? Spins won\'t sync to the shared ledger.')) {
      clearGitHubToken();
      tokenInput.value = '';
      tokenStatus.textContent = '🗑️ Token cleared';
      tokenStatus.style.color = 'var(--muted)';
    }
  });

  // Allow pasting/typing new token
  tokenInput.addEventListener('input', () => {
    if (tokenInput.value && tokenInput.value !== '••••••••••••••••') {
      tokenStatus.textContent = '💾 Click "Save Token" to save';
      tokenStatus.style.color = 'var(--neon)';
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTokenManagement);
} else {
  // DOM is already ready
  initTokenManagement();
}


