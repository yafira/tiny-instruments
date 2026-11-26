// colors for the previews, per theme
const PAL = {
  light: {
    threads: [
      [214, 120, 165],
      [140, 120, 210],
      [82, 166, 134],
    ],
    chimes: ["#e58fb8", "#9b87df", "#63b89b", "#e58fb8", "#9b87df"],
    bar: "#d9cfe3",
    string: "#8a7ea3",
    ring: [150, 120, 170],
  },
  dark: {
    threads: [
      [255, 186, 216],
      [206, 186, 255],
      [178, 232, 214],
    ],
    chimes: ["#ffbad6", "#cebaff", "#b2e8d6", "#ffbad6", "#cebaff"],
    bar: "#3a3050",
    string: "#6b5f85",
    ring: [200, 200, 200],
  },
};

function theme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

// shared audio, made on the first gesture
let actx = null;
let out = null;

function audio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    out = actx.createGain();
    out.gain.value = 0.3;
    out.connect(actx.destination);
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}

// one soft tone with a slow fade
function tone(freq, type, len) {
  if (!actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + len + 0.1);
}

// fit a canvas to its box at device pixel ratio
function fit(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

// mini harp: six threads, a move across one plucks it

const harpCanvas = document.getElementById("harp-box");
const HARP_NOTES = [196, 261.63, 329.63, 392, 523.25, 659.26];
const threads = HARP_NOTES.map((f, i) => ({
  f,
  x: 0,
  energy: 0,
  phase: 0,
  t: i / (HARP_NOTES.length - 1),
}));
let harpLast = null;

function harpLayout(w) {
  threads.forEach((th) => {
    th.x = w * 0.15 + th.t * w * 0.7;
  });
}

function harpPluck(th, v) {
  th.energy = Math.max(th.energy, v);
  tone(th.f, "sine", 3);
}

function harpMove(e) {
  const rect = harpCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (harpLast !== null) {
    const lo = Math.min(harpLast, x);
    const hi = Math.max(harpLast, x);
    const speed = Math.abs(x - harpLast);
    if (speed > 1) {
      threads.forEach((th) => {
        if (th.x >= lo && th.x <= hi) harpPluck(th, Math.min(1, speed / 30));
      });
    }
  }
  harpLast = x;
}

function harpDraw() {
  const { ctx, w, h } = fit(harpCanvas);
  harpLayout(w);
  ctx.clearRect(0, 0, w, h);
  const top = h * 0.12;
  const bottom = h * 0.88;
  const pal = PAL[theme()].threads;
  threads.forEach((th, i) => {
    const c = pal[i < 2 ? 0 : i < 4 ? 1 : 2];
    const e = th.energy;
    ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.7 + e * 0.3})`;
    ctx.lineWidth = 1 + e * 1.2;
    ctx.beginPath();
    for (let y = top; y <= bottom; y += 4) {
      const u = (y - top) / (bottom - top);
      const off = e * 20 * Math.sin(Math.PI * u) * Math.sin(th.phase);
      if (y === top) ctx.moveTo(th.x + off, y);
      else ctx.lineTo(th.x + off, y);
    }
    ctx.stroke();
    th.phase += 0.14 + e * 0.1;
    th.energy *= 0.97;
    if (th.energy < 0.002) th.energy = 0;
  });
}

// mini chimes: five shapes on a bar, hovering rings them

const chimesCanvas = document.getElementById("chimes-box");
const CHIME_NOTES = [261.63, 329.63, 392, 523.25, 659.26];
const CHIME_SHAPES = ["circle", "flower", "square", "rect", "flower"];
const chimes = CHIME_NOTES.map((f, i) => ({
  f,
  i,
  shape: CHIME_SHAPES[i],
  t: i / (CHIME_NOTES.length - 1),
  flip: 0,
  color: null,
  phase: i * 1.3,
  len: 0.3 + (i % 2) * 0.25,
}));
let chimeHit = -1;

function chimeGeom(w, h) {
  const barY = h * 0.14;
  return chimes.map((c) => {
    const x = w * 0.15 + c.t * w * 0.7;
    const y = barY + h * (0.22 + c.len * 0.4);
    return { x, y };
  });
}

function drawChime(ctx, shape, x, y, size, flip, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === "square") {
    ctx.fillRect(-size / 2, -size / 2, size, size);
  } else if (shape === "rect") {
    ctx.fillRect(-size * 0.1, -size * 0.8, size * 0.2, size * 1.6);
  } else {
    ctx.rotate(flip * Math.PI);
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.25, size * 0.22, size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function chimeAt(x, y, geom) {
  const s = 26;
  return geom.findIndex((g) => Math.hypot(g.x - x, g.y - y) < s);
}

function chimeHover(e) {
  const rect = chimesCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const hit = chimeAt(x, y, chimeGeom(rect.width, rect.height));
  if (hit !== -1 && hit !== chimeHit) ring(hit);
  chimeHit = hit;
}

function ring(i) {
  const c = chimes[i];
  c.flip = 1;
  const r = PAL[theme()].ring;
  c.color = `rgb(${Math.floor(r[0] + Math.random() * 40)}, ${Math.floor(r[1] + Math.random() * 40)}, ${Math.floor(r[2] + Math.random() * 40)})`;
  tone(
    c.f,
    c.shape === "square" ? "square" : c.shape === "rect" ? "sawtooth" : "sine",
    2.5,
  );
  setTimeout(() => {
    c.color = null;
  }, 1200);
}

function chimesDraw() {
  const { ctx, w, h } = fit(chimesCanvas);
  const pal = PAL[theme()];
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = pal.string;
  ctx.fillStyle = pal.bar;
  ctx.fillRect(w * 0.12, h * 0.02, w * 0.76, h * 0.06);
  const geom = chimeGeom(w, h);
  chimes.forEach((c, i) => {
    const g = geom[i];
    const sway = Math.sin(performance.now() / 1200 + c.phase) * 3;
    ctx.beginPath();
    ctx.moveTo(g.x, h * 0.08);
    ctx.lineTo(g.x + sway, g.y);
    ctx.lineWidth = 1;
    ctx.stroke();
    c.flip *= 0.94;
    drawChime(
      ctx,
      c.shape,
      g.x + sway,
      g.y,
      22,
      c.flip,
      c.color || pal.chimes[i],
    );
  });
}

// hover and touch

function wire(canvas, onMove) {
  canvas.addEventListener("pointerdown", (e) => {
    audio();
    onMove(e);
  });
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", () => {
    harpLast = null;
    chimeHit = -1;
  });
}

wire(harpCanvas, harpMove);
wire(chimesCanvas, chimeHover);

function frame() {
  harpDraw();
  chimesDraw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// info panels: the i opens a short description, × closes it
document.querySelectorAll(".item").forEach((item) => {
  const info = item.querySelector(".info");
  const close = item.querySelector(".close");
  const set = (open) => {
    item.classList.toggle("open", open);
    info.setAttribute("aria-expanded", String(open));
  };
  info.addEventListener("click", (e) => {
    e.stopPropagation();
    set(!item.classList.contains("open"));
  });
  close.addEventListener("click", () => set(false));
});

// theme toggle: switches light and dark, and remembers the choice
const toggle = document.getElementById("theme-toggle");

function paintToggle() {
  toggle.textContent = theme() === "dark" ? "light" : "dark";
}

toggle.addEventListener("click", () => {
  const next = theme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("tiny-theme", next);
  } catch (e) {}
  paintToggle();
});

paintToggle();
