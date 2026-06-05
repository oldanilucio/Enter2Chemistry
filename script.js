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
const PLAYER_SPEED   = 2.5;
const ENEMY_SPEED    = 1.1;
const PLAYER_R       = 11;
const ENEMY_R        = 10;
const PROJ_SPEED     = 5;
const PROJ_R         = 5;
const ATTACK_COOLDOWN = 40;   // frames entre ataques del enemigo
const FLASH_FRAMES    = 120;  // 2 segundos a 60fps

const TIPOS_TILE = {PARED:0, PISO:1};
let mapa = [];

let canvas, ctx, player, enemies, projectiles, armaActiva, hp;
let playerFlash = 0;          // frames restantes de flash de curación
let gameLoopId  = null;
let keys = {};
let lastAxis = 'h';

// Colores de proyectil / estado por tipo
const PROJ_COLOR = {Fuego:"#e07b3a",Veneno:"#4ecf9a",Acido:"#d04545",Frio:"#7ab8e8",Control:"#6a7280",Raro:"#9b6cd8"};

// Efectos de estado aplicados al impactar (duration en segundos → se convierte a frames al aplicar)
const WEAPON_STATUS = {
  Fuego:   { type:'burn',     seconds:3, dps:8,  label:'🔥 Quemando'   },
  Veneno:  { type:'poison',   seconds:5, dps:4,  label:'☠ Envenenado'  },
  Acido:   { type:'corrode',  seconds:3,         label:'⚗ Corroído'    }, // +50% daño recibido
  Frio:    { type:'freeze',   seconds:2,         label:'❄ Congelado'   }, // sin movimiento
  Control: { type:'slow',     seconds:3,         label:'🌀 Ralentizado' }, // mitad de velocidad
  Raro:    { type:'paralyze', seconds:3,         label:'⚡ Paralizado'  }, // sin movimiento ni ataque
};
const STATUS_COLOR = {burn:'#e07b3a',poison:'#4ecf9a',corrode:'#d04545',freeze:'#7ab8e8',slow:'#6a7280',paralyze:'#9b6cd8'};

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
    enemies.push({x:ex, y:ey, hp:30, maxHp:30, nombre:tipos[Math.floor(Math.random()*tipos.length)], vivo:true, cd:0, status:null, dmgTick:0});
  }
}

function irDungeon() {
  if(!armasFabricadas.length) return;
  irA('dungeon');
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  hp=100; armaActiva=0; projectiles=[]; playerFlash=0;
  player={x:5.5*TILE, y:5.5*TILE};
  keys={}; lastAxis='h';
  generarMapa();
  spawnEnemigos();
  renderHud();

  document.onkeydown = e => {
    keys[e.code] = true;
    if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)) lastAxis='h';
    if(['ArrowUp','ArrowDown','KeyW','KeyS'].includes(e.code))   lastAxis='v';
    if(e.code==='KeyE'){ e.preventDefault(); usarArma(); }
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
  tickProjectiles();
  if(playerFlash>0) playerFlash--;
  dibujar();
  renderHud();
  gameLoopId = requestAnimationFrame(gameLoop);
}

function tickPlayer() {
  const h = (keys['ArrowRight']||keys['KeyD']) ? 1 : (keys['ArrowLeft']||keys['KeyA']) ? -1 : 0;
  const v = (keys['ArrowDown'] ||keys['KeyS']) ? 1 : (keys['ArrowUp']  ||keys['KeyW']) ? -1 : 0;

  // Sin diagonal para el jugador: gana el último eje presionado
  let mx=0, my=0;
  if(h!==0 && v!==0){ if(lastAxis==='h') mx=h; else my=v; }
  else { mx=h; my=v; }

  if(mx){ const nx=player.x+mx*PLAYER_SPEED; if(!solid(nx,player.y,PLAYER_R)) player.x=nx; }
  if(my){ const ny=player.y+my*PLAYER_SPEED; if(!solid(player.x,ny,PLAYER_R)) player.y=ny; }
}

function tickEnemigos() {
  if(!enemies) return;
  const noOverlap = (nx,ny,self) => !enemies.find(e=>e.vivo&&e!==self&&pdist(nx,ny,e.x,e.y)<ENEMY_R*1.8);

  enemies.filter(e=>e.vivo).forEach(en => {

    // ── Tick de estado ──
    if(en.status){
      en.status.framesLeft--;

      // Daño por segundo (burn / poison): acumular frames y aplicar cada 60
      if(en.status.dps){
        en.dmgTick++;
        if(en.dmgTick >= 60){
          en.dmgTick = 0;
          en.hp -= en.status.dps;
          if(en.hp<=0){
            en.vivo=false;
            dunMsg(`${en.nombre} murió por ${en.status.label}!`);
            if(enemies.every(e=>!e.vivo)){
              cancelAnimationFrame(gameLoopId);
              setTimeout(()=>dunMsg("¡Todos los enemigos derrotados! ¡Piso completado!"),300);
            }
            return;
          }
        }
      }

      if(en.status.framesLeft <= 0){ en.status=null; en.dmgTick=0; }
    }

    // ── Cooldown de ataque ──
    if(en.cd>0){ en.cd--; }

    // Paralizado o congelado: sin movimiento ni ataque
    const paralizado = en.status?.type==='paralyze' || en.status?.type==='freeze';
    if(paralizado) return;

    const d = pdist(en.x,en.y,player.x,player.y);
    if(d < PLAYER_R+ENEMY_R+2 && en.cd===0) {
      const dmg=5+Math.floor(Math.random()*5); hp-=dmg; if(hp<0)hp=0;
      dunMsg(`${en.nombre} te ataca: -${dmg} HP`);
      en.cd = ATTACK_COOLDOWN;
      return;
    }

    // ── Movimiento diagonal libre ──
    const speed = en.status?.type==='slow' ? ENEMY_SPEED*0.4 : ENEMY_SPEED;
    const dx=player.x-en.x, dy=player.y-en.y;
    const len=Math.hypot(dx,dy);
    const mx=(dx/len)*speed, my=(dy/len)*speed;

    if(!solid(en.x+mx,en.y+my,ENEMY_R) && noOverlap(en.x+mx,en.y+my,en)){
      en.x+=mx; en.y+=my;
    } else if(!solid(en.x+mx,en.y,ENEMY_R) && noOverlap(en.x+mx,en.y,en)){
      en.x+=mx;
    } else if(!solid(en.x,en.y+my,ENEMY_R) && noOverlap(en.x,en.y+my,en)){
      en.y+=my;
    }
  });
}

// ── Usar arma activa con E ──
function usarArma() {
  const arma = armasFabricadas[armaActiva];
  if(!arma){ dunMsg("Sin arma seleccionada"); return; }

  if(arma.tipo === 'Util') {
    const cura = {Agua:20,'Agua pura':40,Sal:10}[arma.nombre] ?? 15;
    hp = Math.min(100, hp+cura);
    playerFlash = FLASH_FRAMES;
    dunMsg(`${arma.nombre}: +${cura} HP`);
  } else {
    // Disparar proyectil hacia el enemigo vivo más cercano
    const target = enemies.filter(e=>e.vivo)
      .sort((a,b)=>pdist(a.x,a.y,player.x,player.y)-pdist(b.x,b.y,player.x,player.y))[0];
    if(!target){ dunMsg("No hay enemigos"); return; }
    const dx=target.x-player.x, dy=target.y-player.y, len=Math.hypot(dx,dy);
    projectiles.push({
      x:player.x, y:player.y,
      vx:(dx/len)*PROJ_SPEED, vy:(dy/len)*PROJ_SPEED,
      arma, life:180
    });
    dunMsg(`${arma.nombre} lanzada!`);
  }
}

function tickProjectiles() {
  projectiles = projectiles.filter(p => {
    p.x+=p.vx; p.y+=p.vy; p.life--;
    if(p.life<=0 || solid(p.x,p.y,PROJ_R)) return false;

    const hit = enemies.find(e=>e.vivo && pdist(e.x,e.y,p.x,p.y)<ENEMY_R+PROJ_R);
    if(hit){
      const base={Fuego:20,Veneno:12,Acido:18,Frio:10,Control:5,Raro:35}[p.arma.tipo]||10;
      const corrodeMulti = hit.status?.type==='corrode' ? 1.5 : 1;
      const dmg=Math.round((base+Math.floor(Math.random()*8))*corrodeMulti);
      hit.hp-=dmg;
      dunMsg(`${p.arma.nombre} → ${hit.nombre}: -${dmg} HP`);

      // Aplicar efecto de estado
      const ws = WEAPON_STATUS[p.arma.tipo];
      if(ws){
        hit.status = { type:ws.type, framesLeft:Math.round(ws.seconds*60), dps:ws.dps||0, label:ws.label };
        hit.dmgTick = 0;
      }

      if(hit.hp<=0){
        hit.vivo=false;
        dunMsg(`¡${hit.nombre} derrotado!`);
        if(enemies.every(e=>!e.vivo)){
          cancelAnimationFrame(gameLoopId);
          setTimeout(()=>dunMsg("¡Todos los enemigos derrotados! ¡Piso completado!"),300);
        }
      }
      return false;
    }
    return true;
  });
}

function selArma(i) {
  if(i < armasFabricadas.length){ armaActiva=i; renderHud(); dunMsg("Arma: "+armasFabricadas[i].nombre); }
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

  // Proyectiles
  projectiles.forEach(p=>{
    const col = PROJ_COLOR[p.arma.tipo]||'#d8dce8';
    ctx.fillStyle=col;
    ctx.shadowColor=col; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(p.x,p.y,PROJ_R,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  });

  // Enemigos
  enemies.filter(e=>e.vivo).forEach(en=>{
    // Anillo de estado
    if(en.status){
      const sc = STATUS_COLOR[en.status.type]||'#fff';
      const pulse = 0.5+0.5*Math.sin(Date.now()/180); // pulso suave
      ctx.strokeStyle=sc; ctx.lineWidth=2+pulse*2;
      ctx.globalAlpha=0.5+pulse*0.4;
      ctx.beginPath(); ctx.arc(en.x,en.y,ENEMY_R+4,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1; ctx.lineWidth=1;
    }
    ctx.fillStyle='#d04545'; ctx.beginPath(); ctx.arc(en.x,en.y,ENEMY_R,0,Math.PI*2); ctx.fill();
    const bw=TILE-4;
    ctx.fillStyle='#3a1515'; ctx.fillRect(en.x-bw/2, en.y-ENEMY_R-7, bw, 4);
    ctx.fillStyle='#d04545'; ctx.fillRect(en.x-bw/2, en.y-ENEMY_R-7, bw*(en.hp/en.maxHp), 4);
    // Icono de estado sobre el enemigo
    if(en.status){
      ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(en.status.label.split(' ')[0], en.x, en.y-ENEMY_R-14);
    }
  });

  // Jugador — color cambia durante flash de curación
  const pColor = playerFlash>0 ? '#4a9fe0' : '#4ecf9a';
  ctx.fillStyle=pColor; ctx.beginPath(); ctx.arc(player.x,player.y,PLAYER_R,0,Math.PI*2); ctx.fill();
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
