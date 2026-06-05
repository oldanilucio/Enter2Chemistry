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
const PLAYER_SPEED    = 2.5;
const ENEMY_SPEED     = 1.1;
const PLAYER_R        = 16;
const ENEMY_R         = 10;
const PROJ_SPEED      = 5;
const PROJ_R          = 5;
const ATTACK_COOLDOWN = 40;
const FLASH_FRAMES    = 120;

// Grilla de habitaciones
const ROOM_COLS = 5, ROOM_ROWS = 3;

// Posiciones de puertas (tiles centrales, 2 tiles de ancho/alto)
const DOOR_DEF = {
  N: { wallR:0,  cols:[14,15] },
  S: { wallR:17, cols:[14,15] },
  E: { wallC:29, rows:[8,9]  },
  W: { wallC:0,  rows:[8,9]  },
};

const TIPOS_TILE = {PARED:0, PISO:1, PUERTA:2};
let mapa = [];

let canvas, ctx, player, enemies, projectiles, armaActiva, hp;
let playerFlash = 0;
let gameLoopId  = null;
let keys = {};
let lastAxis = 'h';

// Sistema de habitaciones
let roomGrid = [];
let curRoom  = null;
let transitionCooldown = 0; // frames de gracia tras cambiar de sala

const PROJ_COLOR = {Fuego:"#e07b3a",Veneno:"#4ecf9a",Acido:"#d04545",Frio:"#7ab8e8",Control:"#6a7280",Raro:"#9b6cd8"};

// ── Sprites del jugador ──
const SPRITE_SIZE = 96; // tamaño de dibujo en canvas
const PLAYER_SPRITES = {};
const SPRITE_MAP = {S:'S',SE:'SE',E:'E',NE:'NE',N:'N',NW:'NW',W:'W',SW:'SW'};
let spritesReady = false;

function preloadSprites() {
  let loaded = 0;
  for (const dir of Object.keys(SPRITE_MAP)) {
    const img = new Image();
    img.src = `sprites/player_${dir}.png`;
    img.onload = () => { if(++loaded === 8) spritesReady = true; };
    PLAYER_SPRITES[dir] = img;
  }
}

function getFacingDir() {
  const up    = keys['KeyW'] || keys['ArrowUp'];
  const down  = keys['KeyS'] || keys['ArrowDown'];
  const left  = keys['KeyA'] || keys['ArrowLeft'];
  const right = keys['KeyD'] || keys['ArrowRight'];
  if(up   && right) return 'NE';
  if(up   && left)  return 'NW';
  if(down && right) return 'SE';
  if(down && left)  return 'SW';
  if(up)    return 'N';
  if(down)  return 'S';
  if(right) return 'E';
  if(left)  return 'W';
  return null; // sin tecla: mantener última dirección
}

const WEAPON_STATUS = {
  Fuego:   { type:'burn',     seconds:3, dps:8,  label:'🔥 Quemando'   },
  Veneno:  { type:'poison',   seconds:5, dps:4,  label:'☠ Envenenado'  },
  Acido:   { type:'corrode',  seconds:3,         label:'⚗ Corroído'    },
  Frio:    { type:'freeze',   seconds:2,         label:'❄ Congelado'   },
  Control: { type:'slow',     seconds:3,         label:'🌀 Ralentizado' },
  Raro:    { type:'paralyze', seconds:3,         label:'⚡ Paralizado'  },
};
const STATUS_COLOR = {burn:'#e07b3a',poison:'#4ecf9a',corrode:'#d04545',freeze:'#7ab8e8',slow:'#6a7280',paralyze:'#9b6cd8'};

// ── Colisión ──
function solid(x, y, r) {
  for (const [dx,dy] of [[-r,-r],[r,-r],[-r,r],[r,r]]) {
    const tc=Math.floor((x+dx)/TILE), tr=Math.floor((y+dy)/TILE);
    if(tr<0||tr>=ROWS||tc<0||tc>=COLS) return true;
    if(mapa[tr][tc]===TIPOS_TILE.PARED) return true;
  }
  return false;
}

function pdist(ax,ay,bx,by){ return Math.hypot(ax-bx,ay-by); }

// ── Generación de la grilla de habitaciones (árbol de expansión aleatoria) ──
function generateRoomGrid() {
  roomGrid = Array.from({length:ROOM_ROWS},(_,gy)=>
    Array.from({length:ROOM_COLS},(_,gx)=>({
      gx, gy, doors:{N:false,S:false,E:false,W:false},
      visited:false, cleared:false, isStart:false, enemies:null
    }))
  );
  const OPP = {N:'S',S:'N',E:'W',W:'E'};
  const DIRS = [{d:'N',dx:0,dy:-1},{d:'S',dx:0,dy:1},{d:'E',dx:1,dy:0},{d:'W',dx:-1,dy:0}];
  const seen = new Set(['2,1']);
  const frontier = [{gx:2,gy:1}];
  while(frontier.length){
    const i=Math.floor(Math.random()*frontier.length);
    const {gx,gy}=frontier[i];
    const candidates=DIRS
      .map(({d,dx,dy})=>({d,ngx:gx+dx,ngy:gy+dy,opp:OPP[d]}))
      .filter(({ngx,ngy})=>ngx>=0&&ngx<ROOM_COLS&&ngy>=0&&ngy<ROOM_ROWS&&!seen.has(`${ngx},${ngy}`));
    if(candidates.length){
      const next=candidates[Math.floor(Math.random()*candidates.length)];
      roomGrid[gy][gx].doors[next.d]=true;
      roomGrid[next.ngy][next.ngx].doors[next.opp]=true;
      seen.add(`${next.ngx},${next.ngy}`);
      frontier.push({gx:next.ngx,gy:next.ngy});
    } else { frontier.splice(i,1); }
  }
  const sr=roomGrid[1][2];
  sr.isStart=true; sr.cleared=true; sr.visited=true; sr.enemies=[];
  return sr;
}

// ── Construir mapa de tiles para la habitación actual ──
function buildMapa(room) {
  mapa=Array.from({length:ROWS},()=>Array(COLS).fill(TIPOS_TILE.PARED));
  for(let r=1;r<ROWS-1;r++) for(let c=1;c<COLS-1;c++) mapa[r][c]=TIPOS_TILE.PISO;
  // Abrir puertas
  if(room.doors.N){ mapa[0][14]=TIPOS_TILE.PUERTA; mapa[0][15]=TIPOS_TILE.PUERTA; }
  if(room.doors.S){ mapa[17][14]=TIPOS_TILE.PUERTA; mapa[17][15]=TIPOS_TILE.PUERTA; }
  if(room.doors.E){ mapa[8][29]=TIPOS_TILE.PUERTA; mapa[9][29]=TIPOS_TILE.PUERTA; }
  if(room.doors.W){ mapa[8][0]=TIPOS_TILE.PUERTA; mapa[9][0]=TIPOS_TILE.PUERTA; }
  // Obstáculos internos (no en la sala de inicio)
  if(!room.isStart){
    for(let i=0;i<25;i++){
      const r=3+Math.floor(Math.random()*(ROWS-6));
      const c=4+Math.floor(Math.random()*(COLS-8));
      if(mapa[r][c]===TIPOS_TILE.PUERTA) continue;
      mapa[r][c]=TIPOS_TILE.PARED;
    }
  }
}

// ── Generar enemigos para una habitación no visitada ──
function generateRoomEnemies(room) {
  const tipos=["Golem","Slime","Sombra","Gólem de hierro","Espectro"];
  const diff=Math.abs(room.gx-2)+Math.abs(room.gy-1);
  const count=Math.min(3+diff,7);
  const result=[];
  for(let i=0;i<count;i++){
    let ex,ey,tries=0;
    do{
      const c=4+Math.floor(Math.random()*(COLS-8));
      const r=4+Math.floor(Math.random()*(ROWS-8));
      ex=(c+0.5)*TILE; ey=(r+0.5)*TILE; tries++;
    } while(tries<100&&(solid(ex,ey,ENEMY_R)||pdist(ex,ey,player.x,player.y)<TILE*4));
    result.push({x:ex,y:ey,hp:30+diff*5,maxHp:30+diff*5,
      nombre:tipos[Math.floor(Math.random()*tipos.length)],vivo:true,cd:0,status:null,dmgTick:0});
  }
  return result;
}

// ── Cargar habitación y situar al jugador ──
function loadRoom(room, fromDir) {
  curRoom=room;
  room.visited=true;
  buildMapa(room);
  projectiles=[];
  // Posición de entrada según dirección de llegada
  const cx=14.5*TILE, cy=8.5*TILE;
  if(!fromDir)        { player.x=cx;              player.y=cy;              }
  else if(fromDir==='N'){ player.x=cx;              player.y=2.5*TILE;        }
  else if(fromDir==='S'){ player.x=cx;              player.y=(ROWS-2.5)*TILE; }
  else if(fromDir==='E'){ player.x=(COLS-2.5)*TILE; player.y=cy;              }
  else if(fromDir==='W'){ player.x=2.5*TILE;         player.y=cy;              }
  // Generar enemigos en primera visita
  if(!room.isStart && room.enemies===null){
    room.enemies=generateRoomEnemies(room);
  }
  enemies=room.enemies || [];
}

// ── Detectar si el jugador salió por una puerta ──
// Trigger cuando el centro del jugador entra en la fila/columna del borde (tile 0 o tile max)
function checkDoorTransition() {
  if(!curRoom || transitionCooldown>0) return;
  const cx=player.x, cy=player.y;
  // Alineación con la apertura de la puerta (±1 tile de margen extra)
  const inH = cx > 12*TILE && cx < 18*TILE;
  const inV  = cy > 6*TILE  && cy < 12*TILE;
  if(curRoom.doors.N && inH && cy < TILE)         { transition('N'); return; }
  if(curRoom.doors.S && inH && cy > (ROWS-1)*TILE) { transition('S'); return; }
  if(curRoom.doors.E && inV && cx > (COLS-1)*TILE) { transition('E'); return; }
  if(curRoom.doors.W && inV && cx < TILE)           { transition('W'); return; }
}

function transition(dir) {
  const OPP={N:'S',S:'N',E:'W',W:'E'};
  const {gx,gy}=curRoom;
  const next={N:roomGrid[gy-1]?.[gx],S:roomGrid[gy+1]?.[gx],
               E:roomGrid[gy]?.[gx+1],W:roomGrid[gy]?.[gx-1]}[dir];
  if(!next) return;
  loadRoom(next, OPP[dir]);
  transitionCooldown = 40; // ~0.7s de gracia para no re-triggerear
  renderHud();
  dunMsg(`Sala (${next.gx+1},${next.gy+1}) — ${next.cleared?'despejada':'¡cuidado!'}`);
}

// ── Minimap en canvas del HUD ──
let mmCtx = null;
function renderMinimap() {
  if(!roomGrid.length) return;
  if(!mmCtx){
    const mc=document.getElementById('minimap-canvas');
    if(!mc) return;
    mmCtx=mc.getContext('2d');
  }
  const RW=10, RH=7, GAP=2;
  mmCtx.clearRect(0,0,96,48);
  for(let gy=0;gy<ROOM_ROWS;gy++) for(let gx=0;gx<ROOM_COLS;gx++){
    const room=roomGrid[gy][gx];
    const x=gx*(RW+GAP), y=gy*(RH+GAP);
    if(!room.visited){
      // Habitación no descubierta: silueta tenue si es adyacente a una visitada
      const adj=[roomGrid[gy-1]?.[gx],roomGrid[gy+1]?.[gx],roomGrid[gy]?.[gx-1],roomGrid[gy]?.[gx+1]];
      if(adj.some(r=>r?.visited)){
        mmCtx.fillStyle='#1a1e2c'; mmCtx.fillRect(x,y,RW,RH);
      }
      continue;
    }
    // Fondo de sala
    mmCtx.fillStyle = room===curRoom ? '#4ecf9a' : room.cleared ? '#2a3a50' : '#4a2020';
    mmCtx.fillRect(x,y,RW,RH);
    // Pasillos
    mmCtx.fillStyle='#3a4060';
    if(room.doors.E && gx<ROOM_COLS-1) mmCtx.fillRect(x+RW, y+Math.floor(RH/2)-1, GAP, 2);
    if(room.doors.S && gy<ROOM_ROWS-1) mmCtx.fillRect(x+Math.floor(RW/2)-1, y+RH, 2, GAP);
    // Punto jugador
    if(room===curRoom){
      mmCtx.fillStyle='#0b0d13';
      mmCtx.fillRect(x+Math.floor(RW/2)-1, y+Math.floor(RH/2)-1, 3, 3);
    }
  }
}

// ── Entrada a dungeon ──
function irDungeon() {
  if(!armasFabricadas.length) return;
  irA('dungeon');
  canvas=document.getElementById('game-canvas');
  ctx=canvas.getContext('2d');
  hp=100; armaActiva=0; projectiles=[]; playerFlash=0;
  player={x:14.5*TILE, y:8.5*TILE, facing:'S'};
  keys={}; lastAxis='h';
  preloadSprites();

  const startRoom=generateRoomGrid();
  loadRoom(startRoom, null);
  renderHud();

  document.onkeydown=e=>{
    keys[e.code]=true;
    if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)) lastAxis='h';
    if(['ArrowUp','ArrowDown','KeyW','KeyS'].includes(e.code))    lastAxis='v';
    if(e.code==='KeyE'){e.preventDefault();usarArma();}
    if(e.code==='Digit1') selArma(0);
    if(e.code==='Digit2') selArma(1);
    if(e.code==='Digit3') selArma(2);
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  };
  document.onkeyup=e=>{keys[e.code]=false;};

  cancelAnimationFrame(gameLoopId);
  gameLoopId=requestAnimationFrame(gameLoop);
}

function gameLoop() {
  if(transitionCooldown>0) transitionCooldown--;
  tickPlayer();
  tickEnemigos();
  tickProjectiles();
  if(playerFlash>0) playerFlash--;
  dibujar();
  renderHud();
  renderMinimap();
  gameLoopId=requestAnimationFrame(gameLoop);
}

function tickPlayer() {
  const h=(keys['ArrowRight']||keys['KeyD'])?1:(keys['ArrowLeft']||keys['KeyA'])?-1:0;
  const v=(keys['ArrowDown'] ||keys['KeyS'])?1:(keys['ArrowUp']  ||keys['KeyW'])?-1:0;
  let mx=0, my=0;
  if(h!==0&&v!==0){ if(lastAxis==='h') mx=h; else my=v; }
  else { mx=h; my=v; }
  if(mx){ const nx=player.x+mx*PLAYER_SPEED; if(!solid(nx,player.y,PLAYER_R)) player.x=nx; }
  if(my){ const ny=player.y+my*PLAYER_SPEED; if(!solid(player.x,ny,PLAYER_R)) player.y=ny; }
  const dir = getFacingDir();
  if(dir) player.facing = dir;
  checkDoorTransition();
}

function tickEnemigos() {
  if(!enemies) return;
  const noOverlap=(nx,ny,self)=>!enemies.find(e=>e.vivo&&e!==self&&pdist(nx,ny,e.x,e.y)<ENEMY_R*1.8);
  enemies.filter(e=>e.vivo).forEach(en=>{
    // Tick de estado
    if(en.status){
      en.status.framesLeft--;
      if(en.status.dps){
        en.dmgTick++;
        if(en.dmgTick>=60){
          en.dmgTick=0; en.hp-=en.status.dps;
          if(en.hp<=0){
            en.vivo=false;
            dunMsg(`${en.nombre} murió por ${en.status.label}!`);
            checkRoomCleared(); return;
          }
        }
      }
      if(en.status.framesLeft<=0){en.status=null;en.dmgTick=0;}
    }
    if(en.cd>0) en.cd--;
    const paralizado=en.status?.type==='paralyze'||en.status?.type==='freeze';
    if(paralizado) return;
    const d=pdist(en.x,en.y,player.x,player.y);
    if(d<PLAYER_R+ENEMY_R+2&&en.cd===0){
      const dmg=5+Math.floor(Math.random()*5); hp-=dmg; if(hp<0)hp=0;
      dunMsg(`${en.nombre} te ataca: -${dmg} HP`);
      en.cd=ATTACK_COOLDOWN; return;
    }
    const speed=en.status?.type==='slow'?ENEMY_SPEED*0.4:ENEMY_SPEED;
    const dx=player.x-en.x,dy=player.y-en.y,len=Math.hypot(dx,dy);
    const mx=(dx/len)*speed, my=(dy/len)*speed;
    if(!solid(en.x+mx,en.y+my,ENEMY_R)&&noOverlap(en.x+mx,en.y+my,en)){en.x+=mx;en.y+=my;}
    else if(!solid(en.x+mx,en.y,ENEMY_R)&&noOverlap(en.x+mx,en.y,en)){en.x+=mx;}
    else if(!solid(en.x,en.y+my,ENEMY_R)&&noOverlap(en.x,en.y+my,en)){en.y+=my;}
  });
}

function checkRoomCleared() {
  if(!curRoom||curRoom.cleared) return;
  if(enemies.every(e=>!e.vivo)){
    curRoom.cleared=true;
    dunMsg('¡Habitación despejada! Las puertas están abiertas.');
  }
}

function usarArma() {
  const arma=armasFabricadas[armaActiva];
  if(!arma){dunMsg("Sin arma seleccionada");return;}
  if(arma.tipo==='Util'){
    const cura={Agua:20,'Agua pura':40,Sal:10}[arma.nombre]??15;
    hp=Math.min(100,hp+cura); playerFlash=FLASH_FRAMES;
    dunMsg(`${arma.nombre}: +${cura} HP`);
  } else {
    const target=enemies.filter(e=>e.vivo)
      .sort((a,b)=>pdist(a.x,a.y,player.x,player.y)-pdist(b.x,b.y,player.x,player.y))[0];
    if(!target){dunMsg("No hay enemigos");return;}
    const dx=target.x-player.x,dy=target.y-player.y,len=Math.hypot(dx,dy);
    projectiles.push({x:player.x,y:player.y,vx:(dx/len)*PROJ_SPEED,vy:(dy/len)*PROJ_SPEED,arma,life:180});
    dunMsg(`${arma.nombre} lanzada!`);
  }
}

function tickProjectiles() {
  projectiles=projectiles.filter(p=>{
    p.x+=p.vx; p.y+=p.vy; p.life--;
    if(p.life<=0||solid(p.x,p.y,PROJ_R)) return false;
    const hit=enemies.find(e=>e.vivo&&pdist(e.x,e.y,p.x,p.y)<ENEMY_R+PROJ_R);
    if(hit){
      const base={Fuego:20,Veneno:12,Acido:18,Frio:10,Control:5,Raro:35}[p.arma.tipo]||10;
      const multi=hit.status?.type==='corrode'?1.5:1;
      const dmg=Math.round((base+Math.floor(Math.random()*8))*multi);
      hit.hp-=dmg;
      dunMsg(`${p.arma.nombre} → ${hit.nombre}: -${dmg} HP`);
      const ws=WEAPON_STATUS[p.arma.tipo];
      if(ws){ hit.status={type:ws.type,framesLeft:Math.round(ws.seconds*60),dps:ws.dps||0,label:ws.label}; hit.dmgTick=0; }
      if(hit.hp<=0){ hit.vivo=false; dunMsg(`¡${hit.nombre} derrotado!`); checkRoomCleared(); }
      return false;
    }
    return true;
  });
}

function selArma(i) {
  if(i<armasFabricadas.length){armaActiva=i;renderHud();dunMsg("Arma: "+armasFabricadas[i].nombre);}
}

function dibujar() {
  if(!ctx) return;
  ctx.fillStyle='#0b0d13'; ctx.fillRect(0,0,canvas.width,canvas.height);

  // Tiles
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const t=mapa[r][c];
    if(t===TIPOS_TILE.PARED){
      ctx.fillStyle='#1a1e2c'; ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
      ctx.strokeStyle='#2a3045'; ctx.lineWidth=.5; ctx.strokeRect(c*TILE,r*TILE,TILE,TILE);
    } else if(t===TIPOS_TILE.PUERTA){
      ctx.fillStyle='#1a3d2e'; ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
      // Marco de puerta
      ctx.strokeStyle='#4ecf9a'; ctx.lineWidth=1;
      ctx.strokeRect(c*TILE+1,r*TILE+1,TILE-2,TILE-2);
    } else {
      ctx.fillStyle='#12151f'; ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
    }
  }

  // Proyectiles
  projectiles.forEach(p=>{
    const col=PROJ_COLOR[p.arma.tipo]||'#d8dce8';
    ctx.fillStyle=col; ctx.shadowColor=col; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(p.x,p.y,PROJ_R,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  });

  // Enemigos
  enemies.filter(e=>e.vivo).forEach(en=>{
    if(en.status){
      const sc=STATUS_COLOR[en.status.type]||'#fff';
      const pulse=0.5+0.5*Math.sin(Date.now()/180);
      ctx.strokeStyle=sc; ctx.lineWidth=2+pulse*2; ctx.globalAlpha=0.5+pulse*0.4;
      ctx.beginPath(); ctx.arc(en.x,en.y,ENEMY_R+4,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1; ctx.lineWidth=1;
    }
    ctx.fillStyle='#d04545'; ctx.beginPath(); ctx.arc(en.x,en.y,ENEMY_R,0,Math.PI*2); ctx.fill();
    const bw=TILE-4;
    ctx.fillStyle='#3a1515'; ctx.fillRect(en.x-bw/2,en.y-ENEMY_R-7,bw,4);
    ctx.fillStyle='#d04545'; ctx.fillRect(en.x-bw/2,en.y-ENEMY_R-7,bw*(en.hp/en.maxHp),4);
    if(en.status){
      ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#d8dce8';
      ctx.fillText(en.status.label.split(' ')[0],en.x,en.y-ENEMY_R-14);
    }
  });

  // Jugador
  if(playerFlash>0){
    // Flash de curación: tinte azul sobre el sprite
    ctx.save();
    ctx.globalAlpha=0.45;
    ctx.fillStyle='#4a9fe0';
    ctx.beginPath(); ctx.arc(player.x,player.y,PLAYER_R+4,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  const spr = PLAYER_SPRITES[player.facing||'S'];
  if(spritesReady && spr?.complete && spr.naturalWidth>0){
    ctx.drawImage(spr,
      player.x - SPRITE_SIZE/2,
      player.y - SPRITE_SIZE/2,
      SPRITE_SIZE, SPRITE_SIZE);
  } else {
    // Fallback: círculo mientras cargan los sprites
    const pColor=playerFlash>0?'#4a9fe0':'#4ecf9a';
    ctx.fillStyle=pColor; ctx.beginPath(); ctx.arc(player.x,player.y,PLAYER_R,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#0b0d13'; ctx.lineWidth=2; ctx.stroke();
  }

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
