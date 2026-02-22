/* Fishy Home - no build tools, just HTML/CSS/JS for GitHub Pages */

const STORAGE_KEY = "fishy-home-v1";
const canvas = document.getElementById("tank");
const ctx = canvas.getContext("2d");

const ui = {
  addFishBtn: document.getElementById("addFishBtn"),
  feedBtn: document.getElementById("feedBtn"),
  decorSelect: document.getElementById("decorSelect"),
  addDecorBtn: document.getElementById("addDecorBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  resetBtn: document.getElementById("resetBtn"),
  jsonBox: document.getElementById("jsonBox"),
  fishCount: document.getElementById("fishCount"),
  decorCount: document.getElementById("decorCount"),
  modeText: document.getElementById("modeText"),
};

let DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
let W = 0, H = 0;

const MODE = { NORMAL: "NORMAL", FEED: "FEED" };
let mode = MODE.NORMAL;

const state = {
  fish: [],
  decor: [],
  pellets: [],
  bubbles: [],
  lastSaved: 0,
};

function rand(min, max){ return Math.random() * (max - min) + min; }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function dist(ax, ay, bx, by){ return Math.hypot(ax-bx, ay-by); }

function resize(){
  const rect = canvas.getBoundingClientRect();
  W = Math.floor(rect.width);
  H = Math.floor(rect.height);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", () => { DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); resize(); });
resize();

/* Entities */
function makeFish(){
  const colors = [
    { body:"#ffd166", fin:"#ff9f1c" },
    { body:"#a0c4ff", fin:"#5b7fff" },
    { body:"#caffbf", fin:"#57cc99" },
    { body:"#ffadad", fin:"#ff6b6b" },
    { body:"#bdb2ff", fin:"#7c5cff" },
  ];
  const c = colors[Math.floor(rand(0, colors.length))];
  return {
    id: crypto.randomUUID(),
    x: rand(W*0.2, W*0.8),
    y: rand(H*0.25, H*0.75),
    vx: rand(-1.2, 1.2),
    vy: rand(-0.6, 0.6),
    speed: rand(0.7, 1.35),
    size: rand(16, 26),
    hunger: rand(0.55, 0.9), // 0..1
    body: c.body,
    fin: c.fin,
    targetPelletId: null,
    wobble: rand(0, 1000),
  };
}

function makeDecor(type){
  const base = { id: crypto.randomUUID(), type, x: W*0.5, y: H*0.72 };
  if(type==="plant") return { ...base, w: 46, h: 64 };
  if(type==="rock")  return { ...base, w: 60, h: 38 };
  return { ...base, w: 64, h: 46 }; // chest
}

function makePellet(x, y){
  return { id: crypto.randomUUID(), x, y, vy: 0.0, r: 4.5, life: 1.0 };
}

function makeBubble(x, y){
  return { id: crypto.randomUUID(), x, y, vy: -rand(0.2, 0.65), r: rand(2, 6), life: 1.0 };
}

/* Persistence */
function serialize(){
  // keep only minimal
  return JSON.stringify({
    v: 1,
    fish: state.fish.map(f => ({
      id:f.id, x:f.x, y:f.y, vx:f.vx, vy:f.vy, speed:f.speed, size:f.size,
      hunger:f.hunger, body:f.body, fin:f.fin, wobble:f.wobble
    })),
    decor: state.decor.map(d => ({ id:d.id, type:d.type, x:d.x, y:d.y, w:d.w, h:d.h })),
  });
}
function save(){
  try{
    localStorage.setItem(STORAGE_KEY, serialize());
    state.lastSaved = Date.now();
  }catch(e){
    console.warn("save failed", e);
  }
}
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data || data.v !== 1) return false;
    state.fish = (data.fish || []).map(f => ({
      ...f,
      targetPelletId: null,
    }));
    state.decor = (data.decor || []);
    return true;
  }catch(e){
    console.warn("load failed", e);
    return false;
  }
}

/* Initial */
if(!load()){
  // starter
  state.fish.push(makeFish());
  state.fish.push(makeFish());
  const d1 = makeDecor("plant"); d1.x = W*0.25; d1.y = H*0.74;
  const d2 = makeDecor("rock");  d2.x = W*0.65; d2.y = H*0.78;
  state.decor.push(d1, d2);
  save();
}

/* UI */
function setMode(m){
  mode = m;
  ui.modeText.textContent = (mode === MODE.FEED) ? "먹이" : "기본";
  ui.feedBtn.classList.toggle("primary", mode === MODE.FEED);
  canvas.style.cursor = (mode === MODE.FEED) ? "crosshair" : "default";
}
setMode(MODE.NORMAL);

ui.addFishBtn.addEventListener("click", () => {
  if(state.fish.length >= 12) return alert("물고기는 최대 12마리까지만!");
  state.fish.push(makeFish());
  save();
});

ui.feedBtn.addEventListener("click", () => {
  setMode(mode === MODE.FEED ? MODE.NORMAL : MODE.FEED);
});

ui.addDecorBtn.addEventListener("click", () => {
  if(state.decor.length >= 30) return alert("장식은 최대 30개까지만!");
  const t = ui.decorSelect.value;
  const d = makeDecor(t);
  d.x = rand(W*0.2, W*0.8);
  d.y = rand(H*0.65, H*0.85);
  state.decor.push(d);
  save();
});

ui.exportBtn.addEventListener("click", () => {
  ui.jsonBox.value = serialize();
  ui.jsonBox.focus();
  ui.jsonBox.select();
});

ui.importBtn.addEventListener("click", () => {
  const raw = ui.jsonBox.value.trim();
  if(!raw) return alert("JSON이 비어있어!");
  try{
    const data = JSON.parse(raw);
    if(!data || data.v !== 1) throw new Error("버전이 맞지 않음");
    state.fish = (data.fish || []).map(f => ({ ...f, targetPelletId:null }));
    state.decor = (data.decor || []);
    state.pellets = [];
    state.bubbles = [];
    save();
  }catch(e){
    alert("가져오기 실패: " + e.message);
  }
});

ui.resetBtn.addEventListener("click", () => {
  const ok = confirm("정말 리셋할까? (저장된 어항이 초기화됨)");
  if(!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state.fish = [makeFish()];
  state.decor = [makeDecor("plant")];
  state.decor[0].x = W*0.25; state.decor[0].y = H*0.74;
  state.pellets = [];
  state.bubbles = [];
  save();
});

/* Drag decor */
let dragId = null;
let dragOffset = {x:0,y:0};
function getMousePos(evt){
  const r = canvas.getBoundingClientRect();
  return { x: (evt.clientX - r.left), y: (evt.clientY - r.top) };
}
function decorHitTest(x, y){
  // topmost first
  for(let i=state.decor.length-1; i>=0; i--){
    const d = state.decor[i];
    const left = d.x - d.w/2, top = d.y - d.h/2;
    if(x >= left && x <= left + d.w && y >= top && y <= top + d.h){
      return d;
    }
  }
  return null;
}

canvas.addEventListener("mousedown", (evt) => {
  const {x,y} = getMousePos(evt);
  if(mode === MODE.FEED) return;

  const d = decorHitTest(x,y);
  if(d){
    dragId = d.id;
    dragOffset.x = x - d.x;
    dragOffset.y = y - d.y;
  }
});
window.addEventListener("mousemove", (evt) => {
  if(!dragId) return;
  const {x,y} = getMousePos(evt);
  const d = state.decor.find(dd => dd.id === dragId);
  if(!d) return;
  d.x = clamp(x - dragOffset.x, d.w/2, W - d.w/2);
  d.y = clamp(y - dragOffset.y, H*0.50, H - d.h/2);
});
window.addEventListener("mouseup", () => {
  if(dragId){
    dragId = null;
    save();
  }
});

canvas.addEventListener("dblclick", (evt) => {
  const {x,y} = getMousePos(evt);
  const d = decorHitTest(x,y);
  if(d){
    const idx = state.decor.findIndex(dd => dd.id === d.id);
    if(idx >= 0) state.decor.splice(idx,1);
    save();
  }
});

/* Feed click */
canvas.addEventListener("click", (evt) => {
  if(mode !== MODE.FEED) return;
  const {x,y} = getMousePos(evt);
  // drop a few pellets
  for(let i=0;i<5;i++){
    state.pellets.push(makePellet(x + rand(-10,10), y + rand(-8,8)));
  }
});

/* Simulation */
function update(dt){
  // bubbles ambient
  if(Math.random() < 0.06){
    state.bubbles.push(makeBubble(rand(0,W), H - 6));
  }

  // pellets fall + decay
  for(const p of state.pellets){
    p.vy += 18 * dt;
    p.y += p.vy * dt;
    p.life -= 0.06 * dt;
    if(p.y > H*0.86) p.life -= 0.18 * dt; // sink/decay faster
  }
  state.pellets = state.pellets.filter(p => p.life > 0);

  // bubbles rise
  for(const b of state.bubbles){
    b.y += b.vy * (60*dt);
    b.x += Math.sin((b.y + b.r) * 0.06) * 0.2;
    b.life -= 0.12 * dt;
  }
  state.bubbles = state.bubbles.filter(b => b.life > 0 && b.y > -20);

  // fish
  for(const f of state.fish){
    f.wobble += dt * 5;
    // hunger drains
    f.hunger = clamp(f.hunger - (0.012 * dt), 0, 1);

    // choose pellet if hungry
    let target = null;
    if(f.hunger < 0.78 && state.pellets.length){
      // closest pellet
      let best = null, bestD = Infinity;
      for(const p of state.pellets){
        const d = dist(f.x,f.y,p.x,p.y);
        if(d < bestD){ bestD = d; best = p; }
      }
      if(best) target = best;
    }

    const hungerSlow = clamp(0.55 + f.hunger*0.55, 0.55, 1.1);
    const maxV = f.speed * hungerSlow;

    // wander
    let ax = rand(-0.22,0.22);
    let ay = rand(-0.16,0.16);

    // steer to target pellet
    if(target){
      const dx = target.x - f.x;
      const dy = target.y - f.y;
      const len = Math.hypot(dx,dy) || 1;
      ax += (dx/len) * 0.55;
      ay += (dy/len) * 0.55;

      // eat
      if(len < f.size){
        // remove pellet + restore hunger
        const idx = state.pellets.findIndex(pp => pp.id === target.id);
        if(idx >= 0) state.pellets.splice(idx,1);
        f.hunger = clamp(f.hunger + 0.22, 0, 1);
        // happy bubbles
        for(let i=0;i<4;i++) state.bubbles.push(makeBubble(f.x+rand(-6,6), f.y+rand(-6,6)));
      }
    }

    // avoid decor
    for(const d of state.decor){
      const dx = f.x - d.x, dy = f.y - d.y;
      const r = Math.max(d.w, d.h) * 0.55;
      const dd = Math.hypot(dx,dy);
      if(dd < r + f.size*1.1){
        const push = (r + f.size*1.1 - dd) / (r + 1);
        ax += (dx/(dd||1)) * push * 1.2;
        ay += (dy/(dd||1)) * push * 1.2;
      }
    }

    // integrate
    f.vx += ax * (60*dt);
    f.vy += ay * (60*dt);

    // limit speed
    const vlen = Math.hypot(f.vx,f.vy) || 1;
    f.vx = (f.vx / vlen) * Math.min(vlen, maxV);
    f.vy = (f.vy / vlen) * Math.min(vlen, maxV);

    f.x += f.vx * (60*dt);
    f.y += f.vy * (60*dt);

    // bounds (soft bounce)
    if(f.x < f.size){ f.x = f.size; f.vx *= -0.8; }
    if(f.x > W - f.size){ f.x = W - f.size; f.vx *= -0.8; }
    if(f.y < f.size){ f.y = f.size; f.vy *= -0.8; }
    if(f.y > H*0.88){ f.y = H*0.88; f.vy *= -0.8; }
  }

  // autosave every ~3s
  if(Date.now() - state.lastSaved > 3000){
    save();
  }
}

function draw(){
  // water background
  ctx.clearRect(0,0,W,H);

  // gradient water
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0, "rgba(79,209,197,.18)");
  g.addColorStop(0.45, "rgba(79,209,197,.08)");
  g.addColorStop(1, "rgba(0,0,0,.25)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // sand
  ctx.fillStyle = "rgba(255, 215, 140, .12)";
  ctx.fillRect(0, H*0.86, W, H*0.14);

  // decor
  for(const d of state.decor){
    drawDecor(d);
  }

  // pellets
  for(const p of state.pellets){
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // bubbles
  for(const b of state.bubbles){
    ctx.globalAlpha = clamp(b.life, 0, 1) * 0.9;
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // fish
  for(const f of state.fish){
    drawFish(f);
    if(f.hunger < 0.28){
      // hunger icon
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText("…배고픔", f.x - 18, f.y - f.size - 8);
    }
  }
}

function drawDecor(d){
  ctx.save();
  ctx.translate(d.x, d.y);
  if(d.type === "plant"){
    // stems
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = "rgba(87, 204, 153, .85)";
    ctx.lineWidth = 4;
    for(let i=-2;i<=2;i++){
      ctx.beginPath();
      ctx.moveTo(i*6, d.h/2);
      ctx.quadraticCurveTo(i*6 + Math.sin((Date.now()*0.002)+i)*10, 0, i*6, -d.h/2);
      ctx.stroke();
    }
    // base
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,215,140,.18)";
    roundRect(-d.w/2, d.h/2 - 10, d.w, 14, 10);
    ctx.fill();
  }else if(d.type === "rock"){
    ctx.fillStyle = "rgba(255,255,255,.16)";
    roundRect(-d.w/2, -d.h/2, d.w, d.h, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.stroke();
  }else{
    // chest
    ctx.fillStyle = "rgba(255, 209, 102, .18)";
    roundRect(-d.w/2, -d.h/2, d.w, d.h, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 209, 102, .22)";
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,.22)";
    roundRect(-d.w/2 + 8, -8, d.w - 16, 16, 10);
    ctx.fill();
  }
  ctx.restore();
}

function drawFish(f){
  const dir = (f.vx >= 0) ? 1 : -1;
  const wig = Math.sin(f.wobble) * 2.2;

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(dir, 1);

  // shadow
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "rgba(0,0,0,.8)";
  ctx.beginPath();
  ctx.ellipse(0, f.size*0.65, f.size*0.95, f.size*0.35, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // tail
  ctx.fillStyle = f.fin;
  ctx.beginPath();
  ctx.moveTo(-f.size*0.95, 0);
  ctx.lineTo(-f.size*1.55, -f.size*0.55 + wig);
  ctx.lineTo(-f.size*1.45,  f.size*0.55 + wig);
  ctx.closePath();
  ctx.fill();

  // body
  ctx.fillStyle = f.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, f.size*1.2, f.size*0.78, 0, 0, Math.PI*2);
  ctx.fill();

  // fin
  ctx.fillStyle = f.fin;
  ctx.beginPath();
  ctx.ellipse(-f.size*0.15, f.size*0.15, f.size*0.52, f.size*0.28, -0.6, 0, Math.PI*2);
  ctx.fill();

  // eye
  ctx.fillStyle = "rgba(0,0,0,.62)";
  ctx.beginPath();
  ctx.arc(f.size*0.55, -f.size*0.12, 2.3, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.beginPath();
  ctx.arc(f.size*0.62, -f.size*0.18, 1.0, 0, Math.PI*2);
  ctx.fill();

  // mouth
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(f.size*0.78, f.size*0.10, 5, -0.2, 0.8);
  ctx.stroke();

  ctx.restore();
}

function roundRect(x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

/* Loop */
let last = performance.now();
function loop(now){
  const dt = clamp((now - last)/1000, 0, 0.033);
  last = now;

  update(dt);
  draw();

  ui.fishCount.textContent = String(state.fish.length);
  ui.decorCount.textContent = String(state.decor.length);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);