/* ========= CONFIG ========= */
// Pega aquí tu Client ID de Google (ver instrucciones). Si está vacío, el botón de Google funciona en modo demo.
const GOOGLE_CLIENT_ID = '';

/* ========= DATOS ========= */
const Z = {
  diamond: { n: 'Diamont', cap: 100, p: 350000, c: '#7fd6ff' },
  gold:    { n: 'Gold',    cap: 250, p: 220000, c: '#f2c14e' },
  silver:  { n: 'Silver',  cap: 250, p: 150000, c: '#c9d1d9' }
};
let S = { tickets: [], staff: [], prices: {}, adminPass: 'admin123' }, U = null, ST = null, AD = false, tab = 'res', scanner = null;
try {
  const d = JSON.parse(localStorage.getItem('ss26')); if (d) S = d;
  const u = JSON.parse(sessionStorage.getItem('ss26u')); if (u) U = u;
} catch (e) {}

if (!S.users) S.users = [];
const save = () => { try { localStorage.setItem('ss26', JSON.stringify(S)); sessionStorage.setItem('ss26u', JSON.stringify(U)); } catch (e) {} };
const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pr = k => S.prices[k] || Z[k].p;
const money = n => '$' + n.toLocaleString('es-CO') + ' COP';
const sold = k => S.tickets.filter(t => t.zone === k).length;
const code = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
function stopScan() { if (scanner) { try { scanner.stop().catch(() => {}); } catch (e) {} scanner = null; } }

/* ========= RUTAS ========= */
function route() {
  stopScan();
  const h = location.hash;
  if (h === '#/admin' || h === '#/scan') {
    $('#nav').innerHTML = '<a class="tab" href="#/">← Inicio</a>';
  } else {
    $('#nav').innerHTML =
      `<a class="tab ${h !== '#/entradas' ? 'on' : ''}" href="#/">Inicio</a>` +
      `<a class="tab ${h === '#/entradas' ? 'on' : ''}" href="#/entradas">Mis entradas</a>` +
      (U ? `<button class="s" onclick="logout()">Salir (${esc(U.name.split(' ')[0])})</button>`
        : '<button class="s" onclick="loginModal(\'in\')">Iniciar sesión</button><button onclick="loginModal(\'up\')">Registrarse</button>');
  }
  if (h === '#/admin') admin();
  else if (h === '#/scan') scan();
  else if (h === '#/entradas') misEntradas();
  else home();
  window.scrollTo(0, 0);
}

/* ========= INICIO: banner + zonas ========= */
function home() {
  let h = `<section class="banner">
    <p>31 de diciembre · Concierto &amp; Cena Show</p>
    <h1>San Silvestre<br>frente al mar</h1>
    <p>🎤 Cris y Ronie</p>
    <p>📍 Frente al mar, Bocagrande</p>
    <a class="btn big" href="#zonas" onclick="event.preventDefault();$('#zonas').scrollIntoView({behavior:'smooth'})">Elegir mi zona ↓</a>
  </section>
  <section class="wrap" id="zonas"><h2>Elige tu zona</h2><div class="grid">`;
  for (const k in Z) {
    const z = Z[k], s = sold(k), l = z.cap - s;
    h += `<div class="card" style="--c:${z.c}"><h3>${z.n}</h3>
      <div class="price">${money(pr(k))}</div>
      <div class="bar"><i style="width:${s / z.cap * 100}%"></i></div>
      <p class="note">${l > 0 ? l + ' de ' + z.cap + ' cupos disponibles' : 'AGOTADO'}</p>
      <div class="row"><select id="q${k}">${[1, 2, 3, 4, 5, 6].map(n => `<option>${n}</option>`).join('')}</select>
      <button ${l < 1 ? 'disabled' : ''} onclick="buy('${k}')">Comprar</button></div></div>`;
  }
  h += `</div>${U ? '' : '<p class="note">Inicia sesión con Google para comprar.</p>'}
  <p class="note" style="margin-top:36px"><a href="#/admin">Panel admin</a> · <a href="#/scan">Acceso staff</a></p></section>`;
  $('#app').innerHTML = h;
}

/* ========= MIS ENTRADAS (pestaña aparte) ========= */
function misEntradas() {
  let h = '<div class="wrap page"><h2>Mis entradas</h2>';
  if (!U) {
    h += '<div class="card"><p>Inicia sesión para ver tus entradas.</p><button onclick="loginModal(\'in\')">Iniciar sesión</button> <button class="s" onclick="loginModal(\'up\')">Registrarse</button></div>';
  } else {
    const m = S.tickets.filter(t => t.email === U.email);
    if (!m.length) h += '<div class="card"><p>Aún no has comprado entradas.</p><a class="btn" href="#/">Comprar ahora</a></div>';
    else {
      h += '<div class="grid">' + m.map(t => `<div class="tk"><b>${Z[t.zone].n}</b> · San Silvestre 31 dic
        <div class="qr" id="qr${t.id}"></div><small>${t.id}</small><br><b>${t.used ? '✅ USADA' : 'Válida'}</b></div>`).join('') + '</div>';
      h += `<p class="note">Presenta el QR en la entrada. También se envía a ${esc(U.email)}.</p>`;
    }
  }
  $('#app').innerHTML = h + '</div>';
  if (U) S.tickets.filter(t => t.email === U.email).forEach(t => new QRCode($('#qr' + t.id), { text: t.id, width: 150, height: 150 }));
}

/* ========= REGISTRO / LOGIN ========= */
async function hash(t) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join(''); }
  catch (e) { return btoa(unescape(encodeURIComponent(t))); }
}
function loginModal(mode) {
  mode = mode || 'in';
  const old = $('#lm'); if (old) old.remove();
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'lm';
  m.onclick = e => { if (e.target === m) m.remove(); };
  const up = mode === 'up';
  m.innerHTML = `<div>
    <div class="authtabs"><button class="${up ? 's' : ''}" onclick="loginModal('in')">Iniciar sesión</button><button class="${up ? '' : 's'}" onclick="loginModal('up')">Registrarse</button></div>
    ${up ? `<input id="rn" placeholder="Nombre" autocomplete="given-name"><input id="ra" placeholder="Apellido" autocomplete="family-name">
      <input id="re" type="email" placeholder="Correo" autocomplete="email"><input id="rc" type="tel" placeholder="Celular" autocomplete="tel">
      <input id="rp" type="password" placeholder="Contraseña (mín. 6 caracteres)" autocomplete="new-password">
      <button style="width:100%;margin-top:8px" onclick="doRegister()">Crear cuenta</button>`
    : `<input id="le" type="email" placeholder="Correo" autocomplete="email"><input id="lp" type="password" placeholder="Contraseña" autocomplete="current-password">
      <button style="width:100%;margin-top:8px" onclick="doLogin()">Iniciar sesión</button>`}
    <div class="sep"><span>o</span></div>
    <div id="gbtn" style="display:flex;justify-content:center"></div>
    <p class="note" style="text-align:center">${up ? 'Al registrarte aceptas los términos del evento.' : ''}</p>
  </div>`;
  document.body.appendChild(m);
  googleButton(up ? 'signup_with' : 'signin_with');
}
async function doRegister() {
  const n = $('#rn').value.trim(), a = $('#ra').value.trim(), e = $('#re').value.trim().toLowerCase(), c = $('#rc').value.trim(), p = $('#rp').value;
  if (!n || !a || !e.includes('@') || c.replace(/\D/g, '').length < 7 || p.length < 6) return alert('Completa todos los campos (contraseña mínimo 6 caracteres)');
  if (S.users.some(u => u.email === e)) return alert('Ese correo ya está registrado. Inicia sesión.');
  S.users.push({ name: n, last: a, email: e, phone: c, pw: await hash(p) });
  U = { name: n + ' ' + a, email: e }; save(); $('#lm').remove(); route();
}
async function doLogin() {
  const e = $('#le').value.trim().toLowerCase(), p = $('#lp').value;
  const u = S.users.find(x => x.email === e);
  if (!u || !u.pw || u.pw !== await hash(p)) return alert('Correo o contraseña incorrectos');
  U = { name: u.name + ' ' + (u.last || ''), email: u.email }; save(); $('#lm').remove(); route();
}
function googleButton(text) {
  const box = $('#gbtn'); if (!box) return;
  if (GOOGLE_CLIENT_ID && window.google && google.accounts) {
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogle });
    google.accounts.id.renderButton(box, { theme: 'filled_blue', size: 'large', text: text, shape: 'pill', width: 300, locale: 'es' });
  } else {
    box.innerHTML = '<button class="g" style="width:100%" onclick="googleDemo()">🔵 Inicia con Google</button>';
  }
}
function onGoogle(r) {
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(r.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))));
    const e = p.email.toLowerCase();
    if (!S.users.some(u => u.email === e)) S.users.push({ name: p.given_name || p.name, last: p.family_name || '', email: e, phone: '', google: true });
    U = { name: p.name || e, email: e }; save(); const m = $('#lm'); if (m) m.remove(); route();
  } catch (err) { alert('No se pudo iniciar con Google'); }
}
function googleDemo() {
  const e = prompt('MODO DEMO (falta el Client ID de Google).\nEscribe tu correo de Google:'); if (!e || !e.includes('@')) return;
  const n = e.split('@')[0];
  if (!S.users.some(u => u.email === e.toLowerCase())) S.users.push({ name: n, last: '', email: e.toLowerCase(), phone: '', google: true });
  U = { name: n, email: e.toLowerCase() }; save(); $('#lm').remove(); route();
}
function logout() { U = null; save(); route(); }

/* ========= COMPRA (pago simulado) ========= */
function buy(k) {
  if (!U) return loginModal('in');
  const q = +$('#q' + k).value, l = Z[k].cap - sold(k);
  if (q > l) return alert('Solo quedan ' + l + ' cupos');
  if (!confirm(`Pagar ${money(q * pr(k))} por ${q} entrada(s) ${Z[k].n}? (pago simulado)`)) return;
  for (let i = 0; i < q; i++) {
    let c; do { c = code(); } while (S.tickets.some(t => t.id === c));
    S.tickets.push({ id: c, zone: k, name: U.name, email: U.email, used: false, at: Date.now() });
  }
  save(); alert('¡Compra exitosa! Mira tus QR en "Mis entradas".'); location.hash = '#/entradas';
}

/* ========= ADMIN ========= */
function admin() {
  if (!AD) {
    $('#app').innerHTML = '<div class="wrap page"><h2>Panel admin</h2><div class="card"><input id="ap" type="password" placeholder="Contraseña (demo: admin123)"><button onclick="if($(\'#ap\').value===S.adminPass){AD=true;admin()}else alert(\'Incorrecta\')">Entrar</button></div></div>';
    return;
  }
  const T = (id, l) => `<button class="${tab === id ? '' : 's'}" onclick="tab='${id}';admin()">${l}</button>`;
  let h = `<div class="wrap page"><h2>Panel admin</h2><div class="tabs">${T('res', 'Resumen')}${T('stf', 'Staff de entrada')}${T('tks', 'Entradas')}</div>`;
  if (tab === 'res') {
    h += '<div class="tbl"><table><tr><th>Zona</th><th>Precio</th><th>Vendidas</th><th>Ingresaron</th></tr>';
    for (const k in Z) h += `<tr><td>${Z[k].n}</td><td><input type="number" value="${pr(k)}" onchange="S.prices['${k}']=+this.value;save()"></td><td>${sold(k)}/${Z[k].cap}</td><td>${S.tickets.filter(t => t.zone === k && t.used).length}</td></tr>`;
    h += '</table></div>';
  }
  if (tab === 'stf') {
    h += '<div class="card"><h3>Crear perfil de escáner</h3><div class="row"><input id="su" placeholder="Usuario"><input id="sp" placeholder="PIN"><button onclick="addStaff()">Crear</button></div></div><div class="tbl"><table><tr><th>Usuario</th><th>PIN</th><th></th></tr>' +
      S.staff.map((s, i) => `<tr><td>${esc(s.u)}</td><td>${esc(s.p)}</td><td><button class="s" onclick="S.staff.splice(${i},1);save();admin()">Quitar</button></td></tr>`).join('') +
      '</table></div><p class="note">El staff entra desde <a href="#/scan">Acceso staff</a>.</p>';
  }
  if (tab === 'tks') {
    h += '<div class="tbl"><table><tr><th>Código</th><th>Zona</th><th>Comprador</th><th>Estado</th></tr>' +
      S.tickets.map(t => `<tr><td>${t.id}</td><td>${Z[t.zone].n}</td><td>${esc(t.name)}<br><small>${esc(t.email)}</small></td><td>${t.used ? 'Usada' : 'Libre'}</td></tr>`).join('') + '</table></div>';
  }
  $('#app').innerHTML = h + '</div>';
}
function addStaff() {
  const u = $('#su').value.trim(), p = $('#sp').value.trim();
  if (!u || !p) return;
  if (S.staff.some(s => s.u === u)) return alert('Ya existe');
  S.staff.push({ u, p }); save(); admin();
}

/* ========= ESCÁNER STAFF ========= */
function scan() {
  if (!ST) {
    $('#app').innerHTML = '<div class="wrap page"><h2>Acceso staff</h2><div class="card"><input id="u" placeholder="Usuario"><input id="p" type="password" placeholder="PIN"><button onclick="const s=S.staff.find(x=>x.u===$(\'#u\').value.trim()&&x.p===$(\'#p\').value.trim());if(s){ST=s;scan()}else alert(\'Datos incorrectos\')">Entrar</button></div></div>';
    return;
  }
  $('#app').innerHTML = `<div class="wrap page"><h2>Escáner · ${esc(ST.u)}</h2><div id="reader" style="max-width:420px;margin:auto"></div><div id="out"></div><div class="row"><input id="man" placeholder="O escribe el código"><button onclick="check($('#man').value)">Validar</button></div></div>`;
  try {
    scanner = new Html5Qrcode('reader');
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 }, t => check(t))
      .catch(() => { $('#reader').innerHTML = '<p class="note">No se pudo abrir la cámara; usa el código manual.</p>'; });
  } catch (e) {}
}
let last = '', lt = 0;
function check(c) {
  c = String(c).trim().toUpperCase();
  if (c === last && Date.now() - lt < 2500) return;
  last = c; lt = Date.now();
  try { const d = JSON.parse(localStorage.getItem('ss26')); if (d) S = d; } catch (e) {}
  const t = S.tickets.find(x => x.id === c); let m, cl;
  if (!t) { m = '❌ NO VÁLIDA'; cl = 'er'; }
  else if (t.used) { m = `⛔ YA USADA<br><small>${new Date(t.usedAt).toLocaleString('es-CO')}</small>`; cl = 'er'; }
  else { t.used = true; t.usedAt = Date.now(); t.by = ST.u; save(); m = `✅ ENTRADA OK<br>${Z[t.zone].n} · ${esc(t.name)}`; cl = 'ok'; }
  $('#out').innerHTML = `<div class="res ${cl}">${m}</div>`;
}

addEventListener('hashchange', route);
route();