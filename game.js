// Panda Fortune Deluxe — game engine v5.3.1
// 5x3 slot: balance persistence, free-coin refill, payline visualization,
// win count-up, tiered big-win fanfare, PWA-ready.

// Paytable rebalanced via Monte Carlo simulation (3M spins): RTP ~95.9%, hit rate ~30%
const SYMBOLS = [
  { id: "giant-panda",   file: "assets/symbols/01-giant-panda.webp",   name: "Giant Panda",   weight: 4,  pay: { 3: 59, 4: 247, 5: 1188 } },
  { id: "pink-panda",    file: "assets/symbols/02-pink-panda.webp",    name: "Pink Panda",    weight: 6,  pay: { 3: 35, 4: 119, 5: 495 } },
  { id: "red-lantern",   file: "assets/symbols/03-red-lantern.webp",   name: "Red Lantern",   weight: 9,  pay: { 3: 22, 4: 54,  5: 218 } },
  { id: "golden-teapot", file: "assets/symbols/04-golden-teapot.webp", name: "Golden Teapot", weight: 9,  pay: { 3: 22, 4: 54,  5: 218 } },
  { id: "wild-bamboo",   file: "assets/symbols/05-wild-bamboo.webp",   name: "Bamboo WILD",   weight: 5,  pay: { 3: 69, 4: 277, 5: 1386 }, wild: true },
  { id: "scatter-medal", file: "assets/symbols/06-scatter-medal.webp", name: "Scatter",       weight: 3,  scatterPay: { 3: 5, 4: 22, 5: 109 }, scatter: true },
  { id: "letter-a",      file: "assets/symbols/07-letter-a.webp",      name: "A",             weight: 13, pay: { 3: 11, 4: 28, 5: 109 } },
  { id: "letter-k",      file: "assets/symbols/08-letter-k.webp",      name: "K",             weight: 13, pay: { 3: 11, 4: 28, 5: 109 } },
  { id: "letter-q",      file: "assets/symbols/09-letter-q.webp",      name: "Q",             weight: 14, pay: { 3: 6,  4: 18, 5: 69 } },
  { id: "letter-j",      file: "assets/symbols/10-letter-j.webp",      name: "J",             weight: 14, pay: { 3: 6,  4: 18, 5: 69 } },
];

// 10 paylines defined as row index per reel (0=top,1=mid,2=bottom)
const PAYLINES = [
  [1,1,1,1,1], [0,0,0,0,0], [2,2,2,2,2],
  [0,1,2,1,0], [2,1,0,1,2],
  [0,0,1,2,2], [2,2,1,0,0],
  [1,0,1,2,1], [1,2,1,0,1],
  [0,1,1,1,0],
];

const ROW_COUNT = 3;
const REEL_COUNT = 5;
const CELL_HEIGHT = 112;
const SPIN_STRIP_LEN = 24;
const REEL_STOP_STAGGER = 200;
const SPIN_DURATION = 850;

const BET_STEPS = [1, 2, 5, 10, 20, 50, 100];
const STARTING_BALANCE = 1000;
const PAY_UNIT_DIVISOR = 10;

// v5.3.1: free-coin refill cooldown shortened from 4h to 1h
const REFILL_COOLDOWN_MS = 60 * 60 * 1000;
const REFILL_AMOUNT = STARTING_BALANCE;
const REFILL_THRESHOLD = BET_STEPS[0];
const SAVE_KEY = "pfd_save_v1";

// Big-win tiers: multiplier of bet
const WIN_TIERS = [
  { mult: 100, label: "EPIC WIN", tier: 3 },
  { mult: 50,  label: "MEGA WIN", tier: 2 },
  { mult: 20,  label: "BIG WIN",  tier: 1 },
];

let state = {
  balance: STARTING_BALANCE,
  betIndex: 3,
  spinning: false,
  autospin: false,
  lastGrid: null,
  lastRefill: Date.now(),
};

let refillCheckTimer = null;

function bet() { return BET_STEPS[state.betIndex]; }

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.balance === "number") state.balance = saved.balance;
    if (typeof saved.betIndex === "number") state.betIndex = saved.betIndex;
    if (typeof saved.lastRefill === "number") state.lastRefill = saved.lastRefill;
  } catch (e) { /* ignore corrupt save */ }
}

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      balance: state.balance,
      betIndex: state.betIndex,
      lastRefill: state.lastRefill,
    }));
  } catch (e) { /* storage unavailable — continue without persistence */ }
}

function weightedRandomSymbol() {
  const total = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) {
    if (r < s.weight) return s;
    r -= s.weight;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function buildImg(symbol) {
  const img = document.createElement("img");
  img.src = symbol.file;
  img.alt = symbol.name;
  img.draggable = false;
  return img;
}

function fmt(n) {
  return Math.round(n).toLocaleString("en-US");
}

function updateHud() {
  document.getElementById("balanceVal").textContent = fmt(state.balance);
  document.getElementById("betVal").textContent = fmt(bet());
}

// Animate the WIN counter from its current value up to `target`.
function animateWin(target) {
  const el = document.getElementById("winVal");
  const start = 0;
  const duration = target > bet() * 20 ? 1400 : 650;
  const t0 = performance.now();
  function step(now) {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = fmt(target);
  }
  requestAnimationFrame(step);
}

function setupReels() {
  document.querySelectorAll(".reel").forEach((reelEl) => {
    const strip = reelEl.querySelector(".strip");
    strip.innerHTML = "";
    for (let i = 0; i < ROW_COUNT; i++) {
      strip.appendChild(buildImg(weightedRandomSymbol()));
    }
    strip.style.transition = "none";
    strip.style.transform = "translateY(0px)";
  });
}

function spinReel(reelEl, delay, finalSymbols) {
  return new Promise((resolve) => {
    const strip = reelEl.querySelector(".strip");
    const filler = [];
    for (let i = 0; i < SPIN_STRIP_LEN; i++) filler.push(weightedRandomSymbol());

    strip.style.transition = "none";
    strip.style.transform = "translateY(0px)";
    strip.innerHTML = "";
    strip.appendChild(buildImg(finalSymbols[0]));
    filler.forEach((s) => strip.appendChild(buildImg(s)));
    finalSymbols.forEach((s) => strip.appendChild(buildImg(s)));

    const totalRows = 1 + filler.length + finalSymbols.length;
    const travelDistance = (totalRows - ROW_COUNT) * CELL_HEIGHT;

    setTimeout(() => {
      strip.offsetHeight;
      strip.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.32, 1.02)`;
      strip.style.transform = `translateY(-${travelDistance}px)`;
      setTimeout(() => { SoundFX.reelStop(reelEl.dataset.reel | 0); resolve(); }, SPIN_DURATION);
    }, delay);
  });
}

// Evaluate all paylines + scatters. grid[reel][row] = symbol
// v5 P0 fix: base symbol for a line is now resolved only from the contiguous
// matching run starting at reel 0 (previously could pick a symbol from beyond
// a scatter break, causing wild-only runs to be mispriced as the wrong symbol).
function evaluateSpin(grid, betAmount) {
  const unit = betAmount / PAY_UNIT_DIVISOR;
  let totalWin = 0;
  const winningCells = new Set();
  const lineWins = [];

  for (let li = 0; li < PAYLINES.length; li++) {
    const line = PAYLINES[li];
    const lineSymbols = line.map((row, reel) => grid[reel][row]);
    if (lineSymbols[0].scatter) continue;

    let base = null;
    let matchCount = 0;
    for (let i = 0; i < lineSymbols.length; i++) {
      const s = lineSymbols[i];
      if (s.scatter) break;
      if (s.wild) { matchCount++; continue; }
      if (base === null) { base = s; matchCount++; }
      else if (s.id === base.id) { matchCount++; }
      else break;
    }
    if (base === null) base = lineSymbols[0]; // all-wild run: price as wild

    if (matchCount >= 3 && base.pay && base.pay[matchCount]) {
      const winAmt = base.pay[matchCount] * unit;
      totalWin += winAmt;
      lineWins.push({ line: li + 1, symbol: base, count: matchCount, amount: winAmt });
      for (let i = 0; i < matchCount; i++) {
        winningCells.add(`${i}-${line[i]}`);
      }
    }
  }

  let scatterCount = 0;
  const scatterCells = [];
  for (let reel = 0; reel < REEL_COUNT; reel++) {
    for (let row = 0; row < ROW_COUNT; row++) {
      if (grid[reel][row].scatter) {
        scatterCount++;
        scatterCells.push(`${reel}-${row}`);
      }
    }
  }
  const scatterSym = SYMBOLS.find((s) => s.scatter);
  if (scatterCount >= 3 && scatterSym.scatterPay[Math.min(scatterCount, 5)]) {
    const winAmt = scatterSym.scatterPay[Math.min(scatterCount, 5)] * betAmount;
    totalWin += winAmt;
    lineWins.push({ line: "SCATTER", symbol: scatterSym, count: scatterCount, amount: winAmt });
    scatterCells.forEach((c) => winningCells.add(c));
  }

  return { totalWin, winningCells, lineWins };
}

function clearWinHighlights() {
  document.querySelectorAll(".win-glow").forEach((el) => el.classList.remove("win-glow"));
  clearPaylineOverlay();
}

function highlightCells(winningCells) {
  const reelEls = document.querySelectorAll(".reel");
  winningCells.forEach((key) => {
    const [reel, row] = key.split("-").map(Number);
    const strip = reelEls[reel].querySelector(".strip");
    const img = strip.children[strip.children.length - ROW_COUNT + row];
    if (img) img.classList.add("win-glow");
  });
}

// --- Payline visualization (v5.1 P1) --------------------------------------
function clearPaylineOverlay() {
  const svg = document.getElementById("paylineOverlay");
  if (svg) svg.innerHTML = "";
}

function rowY(row) {
  return row * CELL_HEIGHT + CELL_HEIGHT / 2;
}

function reelX(reel, frameWidth) {
  const colWidth = frameWidth / REEL_COUNT;
  return reel * colWidth + colWidth / 2;
}

function drawPaylines(lineWins) {
  const svg = document.getElementById("paylineOverlay");
  if (!svg) return;
  svg.innerHTML = "";
  const frame = document.querySelector(".reels-frame");
  const w = frame.clientWidth;
  const h = frame.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const numericLines = lineWins.filter((w2) => w2.line !== "SCATTER");
  const colors = ["#ffd54a", "#ff6b6b", "#6bffb8", "#6bc7ff", "#ff9ff3", "#c3ff6b"];

  numericLines.forEach((win, idx) => {
    const rowPattern = PAYLINES[win.line - 1];
    const points = rowPattern.slice(0, win.count).map((row, reel) => {
      return `${reelX(reel, w)},${rowY(row)}`;
    }).join(" ");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("points", points);
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", colors[idx % colors.length]);
    poly.setAttribute("stroke-width", "5");
    poly.setAttribute("stroke-linecap", "round");
    poly.setAttribute("stroke-linejoin", "round");
    poly.setAttribute("opacity", "0.85");
    poly.classList.add("payline-path");
    poly.style.animationDelay = `${idx * 120}ms`;
    svg.appendChild(poly);
  });
}

// --- Big-win tiers ----------------------------------------------------------
function winTierFor(totalWin, betAmount) {
  for (const t of WIN_TIERS) {
    if (totalWin >= betAmount * t.mult) return t;
  }
  return null;
}

function showBigWinBanner(tier) {
  if (!tier) return;
  const banner = document.getElementById("bigWinBanner");
  banner.textContent = tier.label;
  banner.className = `big-win-banner show tier-${tier.tier}`;
  clearTimeout(banner._hideTimer);
  banner._hideTimer = setTimeout(() => {
    banner.classList.remove("show");
  }, 1800);
}

function setMessage(text, isWin) {
  const el = document.getElementById("statusMsg");
  el.textContent = text;
  el.classList.toggle("win-text", !!isWin);
}

function adjustBet(dir) {
  if (state.spinning) return;
  state.betIndex = Math.max(0, Math.min(BET_STEPS.length - 1, state.betIndex + dir));
  updateHud();
  persist();
}

// --- Free coin refill (v5 P0, cooldown updated to 1h in v5.3.1) ------------
function msUntilRefill() {
  return Math.max(0, REFILL_COOLDOWN_MS - (Date.now() - state.lastRefill));
}

function refillEligible() {
  return state.balance < REFILL_THRESHOLD && msUntilRefill() <= 0;
}

function fmtCountdown(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function updateRefillUi() {
  const btn = document.getElementById("refillBtn");
  if (!btn) return;
  if (state.balance >= REFILL_THRESHOLD) {
    btn.classList.remove("visible");
    return;
  }
  btn.classList.add("visible");
  const remaining = msUntilRefill();
  if (remaining <= 0) {
    btn.disabled = false;
    btn.textContent = "🎁 Free Coins";
  } else {
    btn.disabled = true;
    btn.textContent = `Free Coins in ${fmtCountdown(remaining)}`;
  }
}

function claimRefill() {
  if (!refillEligible()) return;
  state.balance += REFILL_AMOUNT;
  state.lastRefill = Date.now();
  updateHud();
  persist();
  updateRefillUi();
  setMessage(`+${fmt(REFILL_AMOUNT)} free coins!`, true);
  SoundFX.win(0);
}

async function spin() {
  if (state.spinning) return;
  const betAmount = bet();
  if (state.balance < betAmount) {
    setMessage("Not enough balance!", false);
    updateRefillUi();
    return;
  }

  state.spinning = true;
  state.balance -= betAmount;
  updateHud();
  document.getElementById("winVal").textContent = "0";
  setMessage("", false);
  clearWinHighlights();
  document.getElementById("spinBtn").disabled = true;

  SoundFX.spinStart();
  const frame = document.querySelector(".reels-frame");
  frame.classList.remove("shake");
  frame.offsetHeight;
  frame.classList.add("shake");

  const reelEls = document.querySelectorAll(".reel");
  const grid = [];

  const spinPromises = Array.from(reelEls).map((reelEl, i) => {
    const finalSymbols = [weightedRandomSymbol(), weightedRandomSymbol(), weightedRandomSymbol()];
    grid.push(finalSymbols);
    return spinReel(reelEl, i * REEL_STOP_STAGGER, finalSymbols);
  });

  await Promise.all(spinPromises);

  const result = evaluateSpin(grid, betAmount);
  state.lastGrid = grid;

  if (result.totalWin > 0) {
    state.balance += result.totalWin;
    let detail;
    if (result.lineWins.length > 3) {
      detail = `${result.lineWins.length} lines`;
    } else {
      detail = result.lineWins.map((w) =>
        w.line === "SCATTER"
          ? `Scatter x${w.count}: +${fmt(w.amount)}`
          : `${w.symbol.name} x${w.count}: +${fmt(w.amount)}`
      ).join(" | ");
    }
    setMessage(`WIN ${fmt(result.totalWin)}! (${detail})`, true);
    highlightCells(result.winningCells);
    drawPaylines(result.lineWins);
    animateWin(result.totalWin);

    const tier = winTierFor(result.totalWin, betAmount);
    if (tier) showBigWinBanner(tier);
    SoundFX.win(tier ? tier.tier : (result.totalWin >= betAmount * 10 ? 1 : 0));
  } else {
    setMessage("No win — spin again!", false);
    document.getElementById("winVal").textContent = "0";
    SoundFX.lose();
  }

  updateHud();
  persist();
  updateRefillUi();
  document.getElementById("spinBtn").disabled = false;
  state.spinning = false;

  if (state.autospin) {
    if (state.balance >= bet()) {
      setTimeout(() => { if (state.autospin) spin(); }, result.totalWin > 0 ? 1400 : 700);
    } else {
      setAutospin(false);
      setMessage("Autospin stopped — balance too low.", false);
    }
  }
}

function setAutospin(on) {
  state.autospin = on;
  const btn = document.getElementById("autoBtn");
  btn.classList.toggle("active", on);
  btn.textContent = on ? "STOP" : "AUTO";
}

function toggleAutospin() {
  SoundFX.click();
  const next = !state.autospin;
  setAutospin(next);
  if (next && !state.spinning) spin();
}

function buildPaytable() {
  const tbl = document.getElementById("paytableBody");
  tbl.innerHTML = "";
  SYMBOLS.forEach((s) => {
    const tr = document.createElement("tr");
    const pays = s.scatter ? s.scatterPay : s.pay;
    const unitNote = s.scatter ? "x total bet" : `x bet/${PAY_UNIT_DIVISOR}`;
    tr.innerHTML = `
      <td><img src="${s.file}" alt="${s.name}"><span>${s.name}</span></td>
      <td>${pays[3] || "-"}</td>
      <td>${pays[4] || "-"}</td>
      <td>${pays[5] || "-"}</td>
      <td class="unit">${unitNote}</td>
    `;
    tbl.appendChild(tr);
  });
}

function togglePaytable() {
  document.getElementById("paytablePanel").classList.toggle("open");
}

// --- Page visibility handling (v5 P2): pause reel/BGM timers while hidden --
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    SoundFX.stopBgm();
  } else {
    if (!SoundFX.isMuted()) SoundFX.startBgm();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  loadSave();
  setupReels();
  buildPaytable();
  updateHud();
  updateRefillUi();

  document.getElementById("spinBtn").addEventListener("click", () => {
    SoundFX.click();
    SoundFX.startBgm();
    spin();
  });
  document.getElementById("autoBtn").addEventListener("click", toggleAutospin);
  document.getElementById("betUp").addEventListener("click", () => { SoundFX.click(); adjustBet(1); });
  document.getElementById("betDown").addEventListener("click", () => { SoundFX.click(); adjustBet(-1); });
  document.getElementById("paytableBtn").addEventListener("click", () => { SoundFX.click(); togglePaytable(); });
  document.getElementById("paytableClose").addEventListener("click", togglePaytable);
  const refillBtn = document.getElementById("refillBtn");
  if (refillBtn) refillBtn.addEventListener("click", () => { SoundFX.click(); claimRefill(); });
  document.getElementById("muteBtn").addEventListener("click", (e) => {
    const m = SoundFX.toggleMute();
    e.target.textContent = m ? "🔇" : "🔊";
    if (m) SoundFX.stopBgm(); else SoundFX.startBgm();
  });

  refillCheckTimer = setInterval(updateRefillUi, 1000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline support best-effort */ });
  }
});
