// TIPO_COLOR, ELEMENTOS y REACCIONES vienen de reactions.js

// ══ ESTADO LAB ══
let usos = {}, seleccionados = [], armasFabricadas = [];

function reiniciarLab() {
  ELEMENTOS.forEach(e => usos[e.s] = e.u);
  seleccionados = []; armasFabricadas = [];
  renderElementos(); actualizarMesa(); renderResultado(null); renderArmas();
  toast("Laboratorio reiniciado", "#e07b3a");
}

function renderElementos() {
  const grid = document.getElementById('elem-grid');
  grid.innerHTML = '';
  ELEMENTOS.forEach(e => {
    const agotado = usos[e.s] <= 0;
    const btn = document.createElement('button');
    btn.className = 'elem-btn'; btn.disabled = agotado;
    let dots = '';
    for(let i=0;i<e.u;i++) dots += `<div class="uso-d${i>=usos[e.s]?' off':''}"></div>`;
    btn.innerHTML = `<span class="sym">${e.s}</span><span class="nom">${e.n}</span><div class="usos-row">${dots}</div>`;
    btn.title = e.n;
    btn.onclick = () => agregar(e.s);
    grid.appendChild(btn);
  });
}

function agregar(s) {
  if(seleccionados.length >= 3){ toast("Máximo 3 elementos", "#e07b3a"); return; }
  if(usos[s] <= 0){ toast("Sin usos de " + s, "#d04545"); return; }
  seleccionados.push(s); usos[s]--;
  renderElementos(); actualizarMesa(); renderResultado(null);
}

function actualizarMesa() {
  const z = document.getElementById('mesa-zona');
  const b = document.getElementById('btn-comb');
  if(!seleccionados.length){ z.textContent='seleccioná elementos'; z.classList.add('empty'); }
  else{ z.textContent = seleccionados.join(' + '); z.classList.remove('empty'); }
  b.disabled = seleccionados.length < 2;
}

function combinar() {
  if(seleccionados.length < 2) return;
  const clave = [...seleccionados].sort().join('+');
  if(REACCIONES[clave]){
    const r = REACCIONES[clave];
    armasFabricadas.push(r);
    renderResultado(r); renderArmas();
    toast("¡" + r.nombre + " fabricada!", "#4ecf9a");
  } else {
    renderResultado(null, true);
    toast("Sin reacción — elementos gastados", "#d04545");
  }
  seleccionados = []; actualizarMesa();
}

function limpiar() {
  seleccionados.forEach(s => usos[s]++);
  seleccionados = []; renderElementos(); actualizarMesa(); renderResultado(null);
}

function renderResultado(r, fallo=false) {
  const box = document.getElementById('res-box');
  if(!r && !fallo){ box.style.borderColor=''; box.innerHTML='<span class="res-empty">// resultado aparece acá</span>'; return; }
  if(fallo){ box.style.borderColor='#d04545'; box.innerHTML=`<div class="res-nombre" style="color:#d04545">Sin reacción</div><div class="res-efecto" style="color:var(--dim)">Esa combinación no existe todavía</div>`; return; }
  const c = TIPO_COLOR[r.tipo] || '#d8dce8';
  box.style.borderColor = c;
  box.innerHTML = `<div class="res-tipo" style="color:${c}">${r.tipo.toUpperCase()}</div><div class="res-nombre" style="color:${c}">${r.nombre}</div><div class="res-efecto">${r.efecto}</div>`;
}

function renderArmas() {
  const lista = document.getElementById('armas-lista');
  const btn = document.getElementById('btn-dun');
  lista.innerHTML = '';
  armasFabricadas.forEach(a => {
    const c = TIPO_COLOR[a.tipo] || '#d8dce8';
    const d = document.createElement('div'); d.className = 'arma-item';
    d.innerHTML = `<div class="arma-dot" style="background:${c}"></div><span>${a.nombre}</span><span class="arma-tipo">${a.tipo}</span>`;
    lista.appendChild(d);
  });
  btn.disabled = !armasFabricadas.length;
  btn.textContent = armasFabricadas.length ? `→ ENTRAR CON ${armasFabricadas.length} ARMA(S)` : '→ ENTRAR A LA DUNGEON';
}

// ══ DUNGEON ══
const TILE = 32, COLS = 30, ROWS = 18;
const PLAYER_SPEED = 2.5;
const ENEMY_SPEED  = 1.1;
const PLAYER_R = 11;
const ENEMY_R  = 10;
const ATTACK_RANGE   = TILE * 1.3;
const ATTACK_COOLDOWN = 40; // frames entre ataques del enemigo (~0.67s a 60fps)

const TIPOS_TILE = {PARED:0, PISO:1};
let mapa = [];

let canvas, ctx, player, enemies, armaActiva, hp;
let gameLoopId = null;
let keys = {};
let lastAxis = 'h'; // último eje presionado: 'h' horizontal · 'v' vertical

// Devuelve true si un círculo en (x,y) con radio r colisiona con una pared
function solid(x, y, r) {
  for (const [dx, dy] of [[-r,-r],[r,-r],[-r,r],[r,r]]) {
    const tc = Math.floor((x+dx)/TILE), tr = Math.floor((y+dy)/TILE);
    if (tr<0||tr>=ROWS||tc<0||tc>=COLS||mapa[tr][tc]===TIPOS_TILE.PARED) return true;
  }
  return false;
}

function pdist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }

function generarMapa() {
  mapa = Array.from({length:ROWS}, ()=>Array(COLS).fill(TIPOS_TILE.PARED));
  for(let r=2;r<ROWS-2;r++) for(let c=2;c<COLS-2;c++) mapa[r][c]=TIPOS_TILE.PISO;
  for(let i=0;i<40;i++){
    const r=3+Math.floor(Math.random()*(ROWS-6));
    const c=3+Math.floor(Math.random()*(COLS-6));
    mapa[r][c]=TIPOS_TILE.PARED;
  }
}

function spawnEnemigos() {
  enemies = [];
  const tipos = ["Golem","Slime","Sombra","Gólem de hierro","Espectro"];
  for(let i=0;i<6;i++){
    let ex, ey;
    do {
      const c=5+Math.floor(Math.random()*(COLS-10));
      const r=5+Math.floor(Math.random()*(ROWS-10));
      ex=(c+0.5)*TILE; ey=(r+0.5)*TILE;
    } while(solid(ex,ey,ENEMY_R) || pdist(ex,ey,player.x,player.y)<TILE*4);
    enemies.push({x:ex, y:ey, hp:30, maxHp:30, nombre:tipos[Math.floor(Math.random()*tipos.length)], vivo:true, cd:0});
  }
}

function irDungeon() {
  if(!armasFabricadas.length) return;
  irA('dungeon');
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  hp=100; armaActiva=0;
  player={x:5.5*TILE, y:5.5*TILE};
  keys={}; lastAxis='h';
  generarMapa();
  spawnEnemigos();
  renderHud();

  document.onkeydown = e => {
    keys[e.code] = true;
    if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)) lastAxis='h';
    if(['ArrowUp','ArrowDown','KeyW','KeyS'].includes(e.code))   lastAxis='v';
    if(e.code==='Space'||e.code==='KeyQ'){ e.preventDefault(); atacar(); }
    if(e.code==='Digit1') selArma(0);
    if(e.code==='Digit2') selArma(1);
    if(e.code==='Digit3') selArma(2);
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  };
  document.onkeyup = e => { keys[e.code]=false; };

  cancelAnimationFrame(gameLoopId);
  gameLoopId = requestAnimationFrame(gameLoop);
}

function gameLoop() {
  tickPlayer();
  tickEnemigos();
  dibujar();
  renderHud();
  gameLoopId = requestAnimationFrame(gameLoop);
}

function tickPlayer() {
  const h = (keys['ArrowRight']||keys['KeyD']) ? 1 : (keys['ArrowLeft']||keys['KeyA']) ? -1 : 0;
  const v = (keys['ArrowDown'] ||keys['KeyS']) ? 1 : (keys['ArrowUp']  ||keys['KeyW']) ? -1 : 0;

  let mx=0, my=0;
  if(h!==0 && v!==0){
    if(lastAxis==='h') mx=h; else my=v; // sin diagonal: último eje gana
  } else { mx=h; my=v; }

  if(mx){ const nx=player.x+mx*PLAYER_SPEED; if(!solid(nx,player.y,PLAYER_R)) player.x=nx; }
  if(my){ const ny=player.y+my*PLAYER_SPEED; if(!solid(player.x,ny,PLAYER_R)) player.y=ny; }
}

function tickEnemigos() {
  if(!enemies) return;
  enemies.filter(e=>e.vivo).forEach(en => {
    if(en.cd>0){ en.cd--; return; }

    const d = pdist(en.x,en.y,player.x,player.y);

    if(d < PLAYER_R+ENEMY_R+2) {
      const dmg=5+Math.floor(Math.random()*5); hp-=dmg; if(hp<0)hp=0;
      dunMsg(`${en.nombre} te ataca: -${dmg} HP`);
      en.cd = ATTACK_COOLDOWN;
      return;
    }

    // Movimiento sin diagonal: avanzar por el eje con mayor distancia
    const dx=player.x-en.x, dy=player.y-en.y;
    const moveH = Math.abs(dx)>=Math.abs(dy);
    const primary   = moveH ? [Math.sign(dx)*ENEMY_SPEED, 0] : [0, Math.sign(dy)*ENEMY_SPEED];
    const secondary = moveH ? [0, Math.sign(dy)*ENEMY_SPEED] : [Math.sign(dx)*ENEMY_SPEED, 0];

    const noOverlap = (nx,ny) => !enemies.find(e=>e.vivo&&e!==en&&pdist(nx,ny,e.x,e.y)<ENEMY_R*1.8);

    for(const [mx,my] of [primary, secondary]){
      const nx=en.x+mx, ny=en.y+my;
      if(!solid(nx,ny,ENEMY_R) && noOverlap(nx,ny)){ en.x=nx; en.y=ny; break; }
    }
  });
}

function atacar() {
  const arma = armasFabricadas[armaActiva];
  if(!arma) return;
  const cerca = enemies
    .filter(e=>e.vivo && pdist(e.x,e.y,player.x,player.y)<ATTACK_RANGE)
    .sort((a,b)=>pdist(a.x,a.y,player.x,player.y)-pdist(b.x,b.y,player.x,player.y));
  if(!cerca.length){ dunMsg("No hay enemigos cerca"); return; }
  atacarEnemigo(cerca[0]);
}

function selArma(i) {
  if(i < armasFabricadas.length){ armaActiva=i; renderHud(); dunMsg("Arma: "+armasFabricadas[i].nombre); }
}

function atacarEnemigo(en) {
  const arma = armasFabricadas[armaActiva];
  if(!arma) return;
  const base = {Fuego:20,Veneno:12,Acido:18,Frio:10,Control:5,Util:0,Raro:35}[arma.tipo]||10;
  const dmg  = base + Math.floor(Math.random()*8);
  en.hp -= dmg;
  dunMsg(`${arma.nombre} → ${en.nombre}: -${dmg} HP`);
  if(en.hp<=0){
    en.vivo=false;
    dunMsg(`¡${en.nombre} derrotado!`);
    if(enemies.every(e=>!e.vivo)){
      cancelAnimationFrame(gameLoopId);
      setTimeout(()=>dunMsg("¡Todos los enemigos derrotados! ¡Piso completado!"),300);
    }
  }
}

function dibujar() {
  if(!ctx) return;
  ctx.fillStyle='#0b0d13'; ctx.fillRect(0,0,canvas.width,canvas.height);

  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(mapa[r][c]===TIPOS_TILE.PARED){
      ctx.fillStyle='#1a1e2c'; ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
      ctx.strokeStyle='#2a3045'; ctx.lineWidth=.5; ctx.strokeRect(c*TILE,r*TILE,TILE,TILE);
    } else {
      ctx.fillStyle='#12151f'; ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
    }
  }

  enemies.filter(e=>e.vivo).forEach(en=>{
    ctx.fillStyle='#d04545'; ctx.beginPath(); ctx.arc(en.x,en.y,ENEMY_R,0,Math.PI*2); ctx.fill();
    const bw=TILE-4;
    ctx.fillStyle='#3a1515'; ctx.fillRect(en.x-bw/2, en.y-ENEMY_R-7, bw, 4);
    ctx.fillStyle='#d04545'; ctx.fillRect(en.x-bw/2, en.y-ENEMY_R-7, bw*(en.hp/en.maxHp), 4);
  });

  ctx.fillStyle='#4ecf9a'; ctx.beginPath(); ctx.arc(player.x,player.y,PLAYER_R,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#0b0d13'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#0b0d13'; ctx.font='bold 12px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('⚗',player.x,player.y);
}

function renderHud() {
  document.getElementById('hud-hp').textContent = `❤ HP: ${hp}`;
  const ha = document.getElementById('hud-armas');
  ha.innerHTML = armasFabricadas.map((a,i)=>{
    const c = TIPO_COLOR[a.tipo]||'#d8dce8';
    return `<div class="arma-sel${i===armaActiva?' active':''}" style="color:${i===armaActiva?c:'var(--dim)'}" onclick="selArma(${i})">${i===armaActiva?'▶ ':' '}[${i+1}] ${a.nombre}</div>`;
  }).join('');
}

let msgT;
function dunMsg(txt) {
  const el = document.getElementById('dun-msg');
  el.textContent=txt; el.classList.add('show');
  clearTimeout(msgT); msgT=setTimeout(()=>el.classList.remove('show'),2200);
}

// ══ NAVEGACIÓN ══
function irA(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='lab') reiniciarLab();
  if(id!=='dungeon'){
    cancelAnimationFrame(gameLoopId);
    document.onkeydown = null;
    document.onkeyup   = null;
  }
}

let toastT;
function toast(msg, color='#d8dce8') {
  const el=document.getElementById('toast');
  el.textContent=msg; el.style.color=color; el.style.borderColor=color+'55';
  el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),2800);
}

// ══ RECETARIO ══
function abrirRecetario() {
  const body = document.getElementById('modal-body');
  body.innerHTML = Object.entries(REACCIONES).map(([clave, r]) => {
    const c = TIPO_COLOR[r.tipo] || '#d8dce8';
    return `
      <div class="rec-row">
        <span class="rec-clave">${clave.split('+').join(' + ')}</span>
        <span class="rec-nombre" style="color:${c}">${r.nombre}</span>
        <span class="rec-efecto">${r.efecto}</span>
        <span class="rec-tipo-tag" style="color:${c};border-color:${c}55">${r.tipo}</span>
      </div>`;
  }).join('');
  document.getElementById('modal-recetario').classList.add('open');
}

function cerrarRecetario(e) {
  if(!e || e.target === document.getElementById('modal-recetario'))
    document.getElementById('modal-recetario').classList.remove('open');
}

// Init
reiniciarLab();
