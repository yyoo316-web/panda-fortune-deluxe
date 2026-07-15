// Panda Fortune Deluxe — reel spin engine (v1)
// Basic 5-reel x 3-row slot with weighted random stops and a single center payline check.

const SYMBOLS = [
  { id: "giant-panda",   file: "assets/symbols/01-giant-panda.png",   name: "자이언트 판다",   weight: 3  },
  { id: "red-panda",     file: "assets/symbols/02-red-panda.png",     name: "레드 판다",       weight: 5  },
  { id: "red-lantern",   file: "assets/symbols/03-red-lantern.png",   name: "홍등",            weight: 8  },
  { id: "golden-teapot", file: "assets/symbols/04-golden-teapot.png", name: "황금 찻주전자",   weight: 8  },
  { id: "wild-bamboo",   file: "assets/symbols/05-wild-bamboo.png",   name: "대나무 (Wild)",   weight: 6  },
  { id: "scatter-medal", file: "assets/symbols/06-scatter-medal.png", name: "스캐터 메달",     weight: 2  },
  { id: "letter-a",      file: "assets/symbols/07-letter-a.png",      name: "A",               weight: 14 },
  { id: "letter-k",      file: "assets/symbols/08-letter-k.png",      name: "K",               weight: 14 },
  { id: "letter-q",      file: "assets/symbols/09-letter-q.png",      name: "Q",               weight: 16 },
  { id: "letter-j",      file: "assets/symbols/10-letter-j.png",      name: "J",               weight: 16 },
];

const REEL_COUNT = 5;
const ROW_COUNT = 3;
const CELL_HEIGHT = 100; // px, must match .strip img height in style.css
const SPIN_STRIP_LEN = 24; // number of filler symbols scrolled through before landing
const REEL_STOP_STAGGER = 220; // ms between each reel stopping, left to right
const SPIN_DURATION = 900; // ms transition duration per reel

let spinning = false;

function weightedRandomSymbol() {
  const total = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) {
    if (r < s.weight) return s;
    r -= s.weight;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function buildImg(symbol) {
  const img = document.createElement("img");
  img.src = symbol.file;
  img.alt = symbol.name;
  img.draggable = false;
  return img;
}

function setupReels() {
  document.querySelectorAll(".reel").forEach((reelEl) => {
    const strip = reelEl.querySelector(".strip");
    strip.innerHTML = "";
    // initial resting frame: fill 3 rows with random symbols, no transform
    for (let i = 0; i < ROW_COUNT; i++) {
      strip.appendChild(buildImg(randomSymbol()));
    }
    strip.style.transition = "none";
    strip.style.transform = "translateY(0px)";
  });
}

function spinReel(reelEl, delay, finalSymbols) {
  return new Promise((resolve) => {
    const strip = reelEl.querySelector(".strip");

    // build filler symbols (spin blur content) + final 3 landing symbols appended at the end
    const filler = [];
    for (let i = 0; i < SPIN_STRIP_LEN; i++) filler.push(weightedRandomSymbol());

    // reset strip: current resting frame stays at top, then filler + final symbols appended below
    strip.style.transition = "none";
    strip.style.transform = "translateY(0px)";
    strip.innerHTML = "";
    strip.appendChild(buildImg(finalSymbols[0])); // placeholder so reel isn't empty pre-spin
    filler.forEach((s) => strip.appendChild(buildImg(s)));
    finalSymbols.forEach((s) => strip.appendChild(buildImg(s)));

    const totalRows = 1 + filler.length + finalSymbols.length;
    const travelDistance = (totalRows - ROW_COUNT) * CELL_HEIGHT;

    setTimeout(() => {
      // force reflow so the transition applies cleanly
      // eslint-disable-next-line no-unused-expressions
      strip.offsetHeight;
      strip.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.32, 1.02)`;
      strip.style.transform = `translateY(-${travelDistance}px)`;

      setTimeout(resolve, SPIN_DURATION);
    }, delay);
  });
}

function checkWin(centerRow) {
  // simple left-to-right match check on the center payline
  let matchCount = 1;
  for (let i = 1; i < centerRow.length; i++) {
    if (centerRow[i].id === centerRow[0].id) matchCount++;
    else break;
  }
  return matchCount >= 3 ? { symbol: centerRow[0], count: matchCount } : null;
}

async function spin() {
  if (spinning) return;
  spinning = true;

  const spinBtn = document.getElementById("spinBtn");
  const statusMsg = document.getElementById("statusMsg");
  spinBtn.disabled = true;
  statusMsg.textContent = "";

  const reelEls = document.querySelectorAll(".reel");
  const results = []; // [reelIndex] -> [top, center, bottom]

  const spinPromises = Array.from(reelEls).map((reelEl, i) => {
    const finalSymbols = [randomSymbol(), weightedRandomSymbol(), randomSymbol()];
    results.push(finalSymbols);
    return spinReel(reelEl, i * REEL_STOP_STAGGER, finalSymbols);
  });

  await Promise.all(spinPromises);

  const centerRow = results.map((r) => r[1]);
  const win = checkWin(centerRow);

  if (win) {
    statusMsg.textContent = `${win.symbol.name} ${win.count}연속 매치! 🎉`;
  } else {
    statusMsg.textContent = "다시 스핀해보세요";
  }

  spinBtn.disabled = false;
  spinning = false;
}

document.addEventListener("DOMContentLoaded", () => {
  setupReels();
  document.getElementById("spinBtn").addEventListener("click", spin);
});
