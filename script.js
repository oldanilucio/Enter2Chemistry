// ══ DATOS ══
const TIPO_COLOR = {Util:"#4a9fe0",Fuego:"#e07b3a",Veneno:"#4ecf9a",Acido:"#d04545",Frio:"#7ab8e8",Control:"#6a7280",Raro:"#9b6cd8"};

const ELEMENTOS = [
  {s:"H",n:"Hidrógeno",u:4},{s:"He",n:"Helio",u:1},{s:"Li",n:"Litio",u:2},
  {s:"Be",n:"Berilio",u:1},{s:"B",n:"Boro",u:2},{s:"C",n:"Carbono",u:4},
  {s:"N",n:"Nitrógeno",u:3},{s:"O",n:"Oxígeno",u:4},{s:"F",n:"Flúor",u:2},
  {s:"Ne",n:"Neón",u:1},{s:"Na",n:"Sodio",u:2},{s:"Mg",n:"Magnesio",u:2},
  {s:"Al",n:"Aluminio",u:2},{s:"Si",n:"Silicio",u:2},{s:"P",n:"Fósforo",u:2},
  {s:"S",n:"Azufre",u:3},{s:"Cl",n:"Cloro",u:2},{s:"Ar",n:"Argón",u:1},
  {s:"K",n:"Potasio",u:2},{s:"Ca",n:"Calcio",u:2},{s:"Fe",n:"Hierro",u:3},
  {s:"Cu",n:"Cobre",u:2},{s:"Zn",n:"Zinc",u:2},{s:"Br",n:"Bromo",u:2},
  {s:"Ag",n:"Plata",u:1},{s:"I",n:"Yodo",u:2},{s:"Au",n:"Oro",u:1},
  {s:"Hg",n:"Mercurio",u:1},{s:"Pb",n:"Plomo",u:2},{s:"U",n:"Uranio",u:1},
];

const REACCIONES = {
  "H+O":    {nombre:"Agua",            tipo:"Util",    efecto:"+20 HP al usarla"},
  "H+H+O":  {nombre:"Agua pura",       tipo:"Util",    efecto:"+40 HP, cura veneno"},
  "C+H":    {nombre:"Metano",          tipo:"Fuego",   efecto:"Daño 15, ignición 3t"},
  "C+O":    {nombre:"CO₂",             tipo:"Control", efecto:"Sofoca enemigo 2t"},
  "C+C+H":  {nombre:"Acetileno",       tipo:"Fuego",   efecto:"Explosión, daño 30"},
  "H+N":    {nombre:"Amoniaco",        tipo:"Veneno",  efecto:"Envenena 5 turnos"},
  "N+N":    {nombre:"N₂",              tipo:"Frio",    efecto:"Congela 1 turno"},
  "N+O":    {nombre:"Óxido nítrico",   tipo:"Veneno",  efecto:"Daño 10, ralentiza"},
  "H+N+O":  {nombre:"Ácido nítrico",   tipo:"Acido",   efecto:"Disuelve armadura"},
  "H+S":    {nombre:"Ac. sulfhídrico", tipo:"Veneno",  efecto:"Daño 12, aturde 1t"},
  "O+S":    {nombre:"SO₂",             tipo:"Veneno",  efecto:"Daño 8 en área"},
  "Cl+Na":  {nombre:"Sal",             tipo:"Util",    efecto:"Cura 10 HP"},
  "Cl+H":   {nombre:"Ac. clorhídrico", tipo:"Acido",   efecto:"Daño 20, corroe"},
  "Fe+O":   {nombre:"Óxido de hierro", tipo:"Control", efecto:"Enmohece armas enemigas"},
  "Ca+O":   {nombre:"Cal viva",        tipo:"Control", efecto:"Cegador al contacto"},
  "Mg+O":   {nombre:"Óxido magnesio",  tipo:"Fuego",   efecto:"Destello cegador"},
  "K+O":    {nombre:"Óxido potasio",   tipo:"Fuego",   efecto:"Explosión suave"},
  "O+P":    {nombre:"Pentóx. fósforo", tipo:"Veneno",  efecto:"Nube tóxica"},
  "Au+Hg":  {nombre:"Amalgama de oro", tipo:"Raro",    efecto:"Paraliza 3 turnos"},
  "O+U":    {nombre:"Uraninita",       tipo:"Raro",    efecto:"Daño radiactivo 50"},
  "Ag+Cl":  {nombre:"Cloruro plata",   tipo:"Raro",    efecto:"Debilita enemigos"},
};

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
let canvas, ctx, player, enemies, armaActiva, turno, msgTimer, hp;
const TIPOS_TILE = {PARED:0, PISO:1};
let mapa = [];

function generarMapa() {
  mapa = Array.from({length:ROWS}, () => Array(COLS).fill(TIPOS_TILE.PARED));
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
    let c, r;
    do{
      c=5+Math.floor(Math.random()*(COLS-10));
      r=5+Math.floor(Math.random()*(ROWS-10));
    } while(mapa[r][c]!==TIPOS_TILE.PISO || (Math.abs(c-player.c)<3 && Math.abs(r-player.r)<3));
    enemies.push({c,r,hp:30,maxHp:30,nombre:tipos[Math.floor(Math.random()*tipos.length)],vivo:true});
  }
}

function irDungeon() {
  if(!armasFabricadas.length) return;
  irA('dungeon');
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  hp = 100; armaActiva = 0; turno = 0;
  player = {c:5, r:5};
  generarMapa();
  spawnEnemigos();
  renderHud();
  dibujar();
  document.onkeydown = onKey;
}

function onKey(e) {
  const keys = {
    ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',
    KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right',
    KeyQ:'atk',Space:'atk',Digit1:'s1',Digit2:'s2',Digit3:'s3'
  };
  const a = keys[e.code];
  if(!a) return;
  e.preventDefault();
  if(a==='up'||a==='down'||a==='left'||a==='right') mover(a);
  else if(a==='atk') atacar();
  else if(a==='s1') selArma(0);
  else if(a==='s2') selArma(1);
  else if(a==='s3') selArma(2);
}

function mover(dir) {
  let nc=player.c, nr=player.r;
  if(dir==='up') nr--; else if(dir==='down') nr++;
  else if(dir==='left') nc--; else if(dir==='right') nc++;
  if(nr<0||nr>=ROWS||nc<0||nc>=COLS) return;
  if(mapa[nr][nc]===TIPOS_TILE.PARED) return;
  const en = enemies.find(e=>e.c===nc&&e.r===nr&&e.vivo);
  if(en){ atacarEnemigo(en); return; }
  player.c=nc; player.r=nr;
  turnoEnemigos();
  dibujar();
}

function atacar() {
  const adj = enemies.filter(e=>e.vivo&&Math.abs(e.c-player.c)<=1&&Math.abs(e.r-player.r)<=1);
  if(!adj.length){ dunMsg("No hay enemigos cerca"); return; }
  atacarEnemigo(adj[0]);
}

function selArma(i) {
  if(i < armasFabricadas.length){ armaActiva=i; renderHud(); dunMsg("Arma: "+armasFabricadas[i].nombre); }
}

function atacarEnemigo(en) {
  const arma = armasFabricadas[armaActiva];
  if(!arma) return;
  const dmg = calcularDano(arma);
  en.hp -= dmg;
  dunMsg(`${arma.nombre} → ${en.nombre}: -${dmg} HP`);
  if(en.hp<=0){ en.vivo=false; dunMsg(`¡${en.nombre} derrotado!`); }
  turnoEnemigos();
  dibujar(); renderHud();
  if(enemies.every(e=>!e.vivo)) setTimeout(()=>dunMsg("¡Todos los enemigos derrotados! ¡Piso completado!"),300);
}

function calcularDano(arma) {
  const base = {Fuego:20,Veneno:12,Acido:18,Frio:10,Control:5,Util:0,Raro:35}[arma.tipo]||10;
  return base + Math.floor(Math.random()*8);
}

function turnoEnemigos() {
  enemies.filter(e=>e.vivo).forEach(en => {
    const dist = Math.abs(en.c-player.c)+Math.abs(en.r-player.r);
    if(dist===1){
      const dmg=5+Math.floor(Math.random()*5); hp-=dmg; if(hp<0)hp=0;
    } else {
      const dc=Math.sign(player.c-en.c), dr=Math.sign(player.r-en.r);
      const nc=en.c+dc, nr=en.r+dr;
      if(mapa[nr]?.[nc]===TIPOS_TILE.PISO && !enemies.find(e=>e.vivo&&e.c===nc&&e.r===nr)){
        en.c=nc; en.r=nr;
      }
    }
  });
  renderHud();
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
    const x=en.c*TILE, y=en.r*TILE;
    ctx.fillStyle='#d04545'; ctx.beginPath(); ctx.arc(x+TILE/2,y+TILE/2,10,0,Math.PI*2); ctx.fill();
    const pw=(TILE-4)*(en.hp/en.maxHp);
    ctx.fillStyle='#3a1515'; ctx.fillRect(x+2,y+2,TILE-4,4);
    ctx.fillStyle='#d04545'; ctx.fillRect(x+2,y+2,pw,4);
  });
  const px=player.c*TILE, py=player.r*TILE;
  ctx.fillStyle='#4ecf9a'; ctx.beginPath(); ctx.arc(px+TILE/2,py+TILE/2,12,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#0b0d13'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#0b0d13'; ctx.font='bold 12px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('⚗',px+TILE/2,py+TILE/2);
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
}

let toastT;
function toast(msg, color='#d8dce8') {
  const el=document.getElementById('toast');
  el.textContent=msg; el.style.color=color; el.style.borderColor=color+'55';
  el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),2800);
}

// Init
reiniciarLab();
