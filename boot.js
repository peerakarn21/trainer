// Trainer — login gate + Firebase adapter (โหลดก่อน app.js)
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DOMAIN = '@trainer.app';
const toEmail = u => u.trim().toLowerCase() + DOMAIN;
const validUser = u => /^[a-z0-9._-]{3,30}$/.test(u.trim().toLowerCase());
try { document.documentElement.style.background = ''; } catch(e){}
firebase.initializeApp(window.FB_CONFIG);
const auth = firebase.auth(), fs = firebase.firestore();
// มือถือบางเครือข่าย/บางเบราว์เซอร์ต่อ Firestore แบบปกติไม่ได้ → ให้สลับไปโหมด long-polling เองอัตโนมัติ
try { fs.settings({experimentalAutoDetectLongPolling: true, merge: true}); } catch(e){}
try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{}); } catch(e){}
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({code:'timeout', message: what}), ms))]);
const gate = $('#authGate');
const msgHTML = (t, err) => `<div class="tiny" style="margin-top:8px;${err?'color:var(--danger,#c62828)':''}">${esc(t)}</div>`;
const errTxt = e => ({ 'auth/invalid-credential':'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'auth/wrong-password':'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'auth/user-not-found':'ไม่พบชื่อผู้ใช้นี้',
  'auth/email-already-in-use':'ชื่อผู้ใช้นี้มีคนใช้แล้ว', 'auth/weak-password':'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว', 'auth/too-many-requests':'ลองผิดหลายครั้ง รอสักครู่แล้วลองใหม่',
  'auth/network-request-failed':'เชื่อมต่ออินเทอร์เน็ตไม่ได้', 'permission-denied':'ไม่มีสิทธิ์' }[e?.code] || (e?.message || 'เกิดข้อผิดพลาด'));

const THEMES = {'':'ม่วงเข้ม (เดิม)', stone:'หินเทา-ม่วงพลัม', lavender:'ขาว-ม่วงอมเทา', blush:'ชมพู-ขาว', sky:'ฟ้า-ขาว'};
const THEME_META = {'':'#100c15', stone:'#ebe9e4', lavender:'#f3f1f7', blush:'#fdf5f7', sky:'#eef5fb'};
function applyTheme(t){
  t = THEMES[t] ? t : '';
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = THEME_META[t];
  try { t ? localStorage.setItem('trainerTheme', t) : localStorage.removeItem('trainerTheme'); } catch(e){}
}
const stable = v => JSON.stringify(v ?? null, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {}) : x);
function watchProgram(uid, used){
  let base = used === undefined ? null : stable(used);
  try { fs.doc(`users/${uid}/program/days`).onSnapshot(s => {
    if (s.metadata && s.metadata.hasPendingWrites) return;
    const j = stable(s.exists ? s.data() : null);
    if (base === null){ base = j; return; }
    if (j === base || document.getElementById('progUpd')) return;
    const b = document.createElement('div'); b.id = 'progUpd';
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 8px);z-index:60;max-width:92vw;display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:14px;background:var(--surface-1);border:1px solid var(--accent);box-shadow:0 10px 30px -10px #0006;font-size:14px';
    b.innerHTML = '<span>โค้ชอัปเดตโปรแกรมของคุณแล้ว</span><button class="primary" style="flex:0 0 auto;padding:6px 12px">โหลดใหม่</button>';
    b.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(b);
  }, () => {}); } catch(e){}
}
// ---- หน้าโหลด ----
const splash = $('#splash'); let spPct = 8, inStep = false, spShown = 0, spT0 = performance.now(), spLast = spT0, spDone = null;
// แถบโหลดวิ่งต่อเนื่อง: ระหว่างรอแต่ละขั้นจะค่อย ๆ ไหลไปข้างหน้าเอง ไม่หยุดนิ่งที่เลขเดิม
const spGoal = now => spPct >= 100 ? 100 : spPct + (97 - spPct) * (1 - Math.exp(-(now - spT0) / 7000));
function splashPct(p){ const now = performance.now(); spPct = Math.min(100, Math.max(spGoal(now), p)); spT0 = now; }
(function spLoop(now){
  if (!splash || !splash.isConnected) return;
  now = now || performance.now(); const dt = Math.min(.25, (now - spLast) / 1000); spLast = now;
  const g = spGoal(now); spShown += (g - spShown) * (1 - Math.exp(-dt * (g >= 100 ? 9 : 4))); if (g - spShown < .15) spShown = g;
  const b = $('#spBar'), n = $('#spPct'); if (b) b.style.width = spShown.toFixed(2) + '%'; if (n) n.textContent = Math.floor(spShown + .01);
  if (spShown >= 100 && spDone){ const f = spDone; spDone = null; f(); }
  requestAnimationFrame(spLoop);
})();
// ล็อกหน้าโหลด: เลื่อน/ซูม/กดค้างไม่ได้ กดได้อย่างเดียวคือปุ่ม START
const spBlock = e => { if (splash && splash.isConnected && !splash.dataset.out) e.preventDefault(); };
if (splash){ document.documentElement.classList.add('sp-lock');
  ['touchmove','wheel','gesturestart','gesturechange','gestureend','dblclick','contextmenu','selectstart','dragstart'].forEach(ev => document.addEventListener(ev, spBlock, {passive:false, capture:true}));
  document.addEventListener('keydown', e => { if (splash.isConnected && !splash.dataset.out && e.target === document.body && [' ','ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key)) e.preventDefault(); }, true); }
function splashOut(minMs){ if (!splash || splash.dataset.out) return; splash.dataset.out = 1; setTimeout(() => { splash.classList.add('out'); document.documentElement.classList.remove('sp-lock'); setTimeout(() => splash.remove(), 900); }, Math.max(0, (minMs||0) - performance.now())); }
splashPct(20);
// โหลดเสร็จ → เปิดแอปครั้งแรกให้กดปุ่ม "เริ่ม" (รีโหลดในรอบเดียวกันไม่ต้องกดซ้ำ)
function splashReady(){
  if (!splash || splash.dataset.out) return;
  splashPct(100);
  let seen = false; try { seen = sessionStorage.getItem('trainerStarted') === '1'; } catch(e){}
  if (seen){ splashOut(900); return; }
  const st = $('#spStatus'), go = $('#spGo'); if (!go) { splashOut(); return; }
  spDone = () => {
    if (st) st.textContent = 'READY'; splash.classList.add('done'); try { navigator.vibrate?.(20); } catch(e){}
    go.onclick = () => { go.classList.add('go'); try { sessionStorage.setItem('trainerStarted','1'); } catch(e){} setTimeout(() => splashOut(), 180); };
  };
}
// เช็คเวอร์ชันใหม่ทุกครั้งที่เปิด (แอปบนหน้าจอโฮมชอบค้างเวอร์ชันเก่า) → เจอใหม่กว่าโหลดใหม่เอง 1 ครั้ง
(async () => { try {
  const h = await fetch('index.html?_=' + Date.now(), {cache:'no-store'}).then(r => r.text());
  const v = (h.match(/APP_VER="(\d+)"/)||[])[1];
  if (v && window.APP_VER && +v > +window.APP_VER && sessionStorage.getItem('trainerUpd') !== v){ sessionStorage.setItem('trainerUpd', v); location.replace(location.pathname + '?v=' + v + location.hash); }
} catch(e){} })();
function showGate(html){ if (!inStep) splashOut(); gate.hidden = false; gate.innerHTML = `<div class="gatecard"><div class="brand" style="font-size:22px;margin-bottom:12px">Trainer</div>${html}</div>`; }

async function loginView(){
  let hasAdmin = true;
  try { hasAdmin = (await fs.doc('meta/admin').get()).exists; } catch(e){}
  if (!hasAdmin) return setupView();
  showGate(`<h2 style="margin:0 0 10px">เข้าสู่ระบบ</h2>
    <label>ชื่อผู้ใช้</label><input id="gU" autocomplete="username" autocapitalize="none">
    <label style="margin-top:8px">รหัสผ่าน</label><input id="gP" type="password" autocomplete="current-password">
    <button class="primary bigbtn" id="gGo" style="margin-top:12px;width:100%">เข้าสู่ระบบ</button><div id="gMsg"></div>
    <p class="tiny" style="margin-top:12px">ยังไม่มีบัญชี? ติดต่อผู้ดูแลเพื่อขอบัญชีพร้อมโปรแกรม</p>`);
  const go = async () => {
    const u = $('#gU').value, p = $('#gP').value;
    if (!validUser(u) || !p){ $('#gMsg').innerHTML = msgHTML('กรอกชื่อผู้ใช้และรหัสผ่าน', true); return; }
    $('#gGo').disabled = true; $('#gMsg').innerHTML = msgHTML('กำลังเข้าสู่ระบบ…');
    try { await withTimeout(auth.signInWithEmailAndPassword(toEmail(u), p), 20000, 'เชื่อมต่อระบบล็อกอินไม่ได้ (หมดเวลา) — ตรวจอินเทอร์เน็ตแล้วลองใหม่'); $('#gMsg').innerHTML = msgHTML('เข้าสู่ระบบแล้ว กำลังโหลดข้อมูล…'); }
    catch(e){ $('#gMsg').innerHTML = msgHTML(errTxt(e), true); $('#gGo').disabled = false; }
  };
  $('#gGo').onclick = go; $('#gP').onkeydown = e => { if (e.key==='Enter') go(); };
}

function setupView(){
  showGate(`<h2 style="margin:0 0 6px">ตั้งค่าครั้งแรก</h2><p class="tiny" style="margin:0 0 10px">สร้างบัญชีผู้ดูแล (แอดมิน) — ทำได้ครั้งเดียว บัญชีนี้สร้างบัญชีให้คนอื่นได้</p>
    <label>ชื่อผู้ใช้ (a–z, 0–9 . _ - อย่างน้อย 3 ตัว)</label><input id="gU" autocapitalize="none" autocomplete="username">
    <label style="margin-top:8px">รหัสผ่าน (อย่างน้อย 6 ตัว)</label><input id="gP" type="password" autocomplete="new-password">
    <label style="margin-top:8px">ยืนยันรหัสผ่าน</label><input id="gP2" type="password" autocomplete="new-password">
    <button class="primary bigbtn" id="gGo" style="margin-top:12px;width:100%">สร้างบัญชีแอดมิน</button><div id="gMsg"></div>`);
  $('#gGo').onclick = async () => {
    const u = $('#gU').value.trim().toLowerCase(), p = $('#gP').value;
    if (!validUser(u)){ $('#gMsg').innerHTML = msgHTML('ชื่อผู้ใช้ใช้ได้เฉพาะ a–z 0–9 . _ - ยาว 3–30 ตัว', true); return; }
    if (p.length < 6 || p !== $('#gP2').value){ $('#gMsg').innerHTML = msgHTML('รหัสผ่านต้องยาวอย่างน้อย 6 ตัว และพิมพ์ให้ตรงกันทั้งสองช่อง', true); return; }
    $('#gGo').disabled = true; $('#gMsg').innerHTML = msgHTML('กำลังสร้าง…');
    try {
      creating = true;
      const cred = await auth.createUserWithEmailAndPassword(toEmail(u), p);
      const uid = cred.user.uid, now = new Date().toISOString();
      await fs.doc('meta/admin').set({uid, username:u, createdAt:now});
      await fs.doc('members/'+uid).set({username:u, admin:true, createdAt:now});
      creating = false; startFor(cred.user);
    } catch(e){ creating = false; $('#gMsg').innerHTML = msgHTML(errTxt(e), true); $('#gGo').disabled = false; }
  };
}

let started = false, creating = false;
auth.onAuthStateChanged(user => {
  if (!user){ if (started) location.reload(); else if (!creating) loginView(); return; }
  if (!creating) startFor(user);
});
async function startFor(user){
  if (started) return;
  try { await startInner(user); }
  catch(e){
    showGate(`<p style="margin:0 0 8px">เข้าสู่ระบบแล้ว แต่โหลดข้อมูลไม่สำเร็จ</p><div class="tiny" style="margin-bottom:10px">${esc(e?.message || e?.code || 'error')}</div>
      <button class="primary bigbtn" id="gRetry" style="width:100%">ลองใหม่</button><button id="gOut2" style="width:100%;margin-top:8px">ออกจากระบบ</button>`);
    $('#gRetry').onclick = () => location.reload(); $('#gOut2').onclick = () => auth.signOut();
  }
}
const step = t => { splashPct(spPct + 20); inStep = true; try { const m = $('#gMsg'); if (m) m.innerHTML = msgHTML(t); else showGate(`<p class="tiny">${esc(t)}</p>`); } finally { inStep = false; } };
// โหลดข้อมูลตั้งต้นพร้อมกันทีเดียว · ถ้าการเชื่อมต่อค้าง → ตัดแล้วต่อใหม่เองสูงสุด 3 รอบก่อนจะแจ้งว่าโหลดไม่ได้
const kickNet = () => { try { return fs.disableNetwork().then(() => fs.enableNetwork()).catch(() => {}); } catch(e){ return Promise.resolve(); } };
async function fetchBoot(uid){
  for (let n = 0;; n++){
    try {
      const [adm, m, p] = await withTimeout(Promise.all([fs.doc('meta/admin').get(), fs.doc('members/'+uid).get(), fs.doc(`users/${uid}/program/days`).get()]), n ? 12000 : 7000, 'timeout');
      return {isAdmin: adm.exists && adm.data().uid === uid, member: m.exists ? m.data() : null, program: p.exists ? p.data() : null};
    } catch(e){
      const net = e?.code === 'timeout' || e?.code === 'unavailable' || e?.code === 'deadline-exceeded';
      if (!net) throw {message: 'โหลดข้อมูลไม่ได้: ' + errTxt(e) + ' — กดลองใหม่'};
      if (n >= 2) throw {message: 'เชื่อมต่อฐานข้อมูลไม่ได้ — ตรวจอินเทอร์เน็ตแล้วกดลองใหม่'};
      const g = $('#gMsg'); if (g) g.innerHTML = msgHTML('การเชื่อมต่อช้า กำลังลองใหม่…');
      await kickNet();
    }
  }
}
async function startInner(user){
  const uid = user.uid;
  let member = null, isAdmin = false, program = null;
  step('กำลังตรวจสิทธิ์บัญชี…');
  // เคยเข้าแล้ว → ใช้ข้อมูลที่จำไว้ในเครื่องเปิดแอปได้เลยถ้าฐานข้อมูลตอบช้า (ไม่ค้างรอ) แล้วค่อยอัปเดตตามหลัง
  const key = 'trainerBoot:' + uid; let cached = null; try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){}
  const save = d => { try { localStorage.setItem(key, JSON.stringify(d)); } catch(e){} };
  const live = fetchBoot(uid); let data = null, fromCache = false;
  if (cached && (cached.member || cached.isAdmin)){
    data = await Promise.race([live.catch(() => null), new Promise(r => setTimeout(() => r(null), 2500))]);
    if (!data){ data = cached; fromCache = true;
      live.then(d => { save(d); if (!d.member && !d.isAdmin){ try { localStorage.removeItem(key); } catch(e){} location.reload(); } }).catch(() => {}); }
  } else data = await live;
  if (!fromCache) save(data);
  ({member, isAdmin, program} = data);
  if (!member && !isAdmin){
    try { localStorage.removeItem(key); } catch(e){}
    showGate(`<p>บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน — ติดต่อผู้ดูแล</p><button id="gOut">ออกจากระบบ</button>`);
    $('#gOut').onclick = () => auth.signOut(); return;
  }
  step('กำลังโหลดโปรแกรม…');
  // ธีม/ค่าตั้งต้น: ทำตามหลัง ไม่ให้หน้าโหลดต้องรอ
  (async () => { try { const sref = fs.doc(`users/${uid}/settings/main`);
    const sdoc = await sref.get(); applyTheme(sdoc.exists ? sdoc.data().theme : '');
    if (!sdoc.exists) await sref.set({oneRM:{}, tm:{}, tmPct:.9, cycle:1, cycleStart:null, rampExtra:[0,1,2,0], targets:null});   // บัญชีใหม่: ยังไม่เริ่มโปรแกรม จนกว่าจะกด "เริ่มโปรแกรม" เอง
  } catch(e){} })();
  window.__bootProg = fromCache ? [program] : [];
  started = true; gate.hidden = true; gate.innerHTML = '';
  window.__PROGRAM = program;
  window.__ACCOUNT = {uid, username: member?.username || user.email.replace(DOMAIN,''), isAdmin};
  const base = fs.collection('users').doc(uid);
  const ref = p => p.split('/').reduce((r, seg, i) => i%2===0 ? r.collection(seg) : r.doc(seg), base);
  const db = {doc: ref, collection: ref};
  window.claude = {use: async k => k==='db' ? db : k==='user' ? {canEdit: async () => true} : null};
  const s = document.createElement('script'); s.src = 'app.js?v=' + (window.APP_VER||1);
  splashPct(88);
  s.onload = () => { accountUI(user, isAdmin); watchProgram(uid, ...window.__bootProg); splashReady(); };
  s.onerror = () => splashOut();
  document.body.appendChild(s);
}

// ---------- บัญชี / แอดมิน (ในหน้าตั้งค่า) ----------
function accountUI(user, isAdmin){
  const view = $('#v-settings'); if (!view) return;
  const acc = window.__ACCOUNT;
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = `<h2>บัญชี</h2><p style="margin:0 0 8px">ชื่อผู้ใช้: <b>${esc(acc.username)}</b>${isAdmin?' · แอดมิน':''}</p>
    <label>เปลี่ยนรหัสผ่าน (รหัสใหม่ อย่างน้อย 6 ตัว)</label><input id="aNewP" type="password" autocomplete="new-password">
    <div class="row" style="margin-top:8px;align-items:center"><button id="aChP" style="flex:0 0 auto">เปลี่ยนรหัสผ่าน</button><button id="aOut" style="flex:0 0 auto">ออกจากระบบ</button><span id="aMsg" class="tiny" style="flex:1"></span></div>`;
  view.prepend(card);
  const th = document.createElement('div'); th.style.marginTop = '10px';
  th.innerHTML = `<label>ธีมสี</label><select id="aTheme">${Object.entries(THEMES).map(([k,v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>`;
  card.querySelector('.row').before(th);
  $('#aTheme').value = document.documentElement.dataset.theme || '';
  $('#aTheme').onchange = async () => {
    const t = $('#aTheme').value; applyTheme(t);
    try { await fs.doc(`users/${acc.uid}/settings/main`).set({theme: t}, {merge: true}); } catch(e){}
    setTimeout(() => location.reload(), 150);
  };
  $('#aOut').onclick = () => auth.signOut();
  $('#aChP').onclick = async () => {
    const p = $('#aNewP').value; if (p.length < 6){ $('#aMsg').textContent = 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว'; return; }
    try { await user.updatePassword(p); $('#aMsg').textContent = 'เปลี่ยนรหัสผ่านแล้ว ✓'; $('#aNewP').value=''; }
    catch(e){ $('#aMsg').textContent = e?.code==='auth/requires-recent-login' ? 'ออกจากระบบแล้วเข้าใหม่ก่อน แล้วค่อยเปลี่ยน' : errTxt(e); }
  };
  if (!isAdmin) return;
  adminUI(acc, card);
}

// ---------- หน้าแอดมิน: เมนูหลักเป็นแถบยาว แตะเข้าไปค่อยเห็นรายละเอียด ----------
function adminUI(acc, card){
  const entry = document.createElement('button'); entry.className = 'adm-bar adm-entry';
  entry.innerHTML = '<span class="ab-ic">🛠️</span><span class="ab-t"><b>หน้าแอดมิน</b><span>บัญชีผู้ใช้ · สร้างบัญชีใหม่</span></span><span class="ab-chev">›</span>';
  card.after(entry);
  const ov = document.createElement('div'); ov.id = 'admOv'; ov.hidden = true;
  ov.innerHTML = '<div class="adm-head"><button class="adm-back" id="admBack">‹ กลับ</button><b id="admTitle"></b><span style="width:64px"></span></div><div class="adm-body" id="admBody"></div>';
  document.body.appendChild(ov);
  const FV = firebase.firestore.FieldValue, now = () => new Date().toISOString();
  const tpls = {}; const tplReady = fs.collection(`users/${acc.uid}/templates`).get().then(q => q.docs.forEach(d => tpls[d.id] = d.data())).catch(() => {});
  const myProg = () => window.__PROGRAM?.days || window.__DEFAULT_DAYS;
  const stack = [];
  const bar = (ic, title, sub, attr) => `<button class="adm-bar" ${attr}><span class="ab-ic">${ic}</span><span class="ab-t"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</span><span class="ab-chev">›</span></button>`;
  const go = scr => { stack.push(scr); paint(); };
  const back = () => { stack.pop(); if (!stack.length){ ov.hidden = true; document.documentElement.classList.remove('adm-open'); return; } paint(); };
  async function paint(){
    const scr = stack[stack.length-1]; $('#admTitle').textContent = scr.title; $('#admBack').textContent = stack.length > 1 ? '‹ กลับ' : '‹ ปิด';
    const body = $('#admBody'); body.innerHTML = '<p class="tiny" style="text-align:center;padding:30px 0">กำลังโหลด…</p>'; body.scrollTop = 0;
    try { await scr.render(body); } catch(e){ body.innerHTML = `<p class="err">โหลดไม่ได้: ${esc(errTxt(e))}</p>`; }
  }
  $('#admBack').onclick = back;
  entry.onclick = () => { stack.length = 0; ov.hidden = false; document.documentElement.classList.add('adm-open'); go(rootScr); };
  // แตะครั้งแรก = เตรียม · แตะซ้ำภายใน 4 วิ = ทำจริง
  const twoTap = (b, run, out) => { const label = b.innerHTML; let armed = false, tm = null; b.onclick = async () => {
    if (!armed){ armed = true; b.innerHTML = '<b>แตะอีกครั้งเพื่อยืนยัน</b>'; tm = setTimeout(() => { armed = false; b.innerHTML = label; }, 4000); return; }
    clearTimeout(tm); armed = false; b.disabled = true; b.innerHTML = 'กำลังทำ…'; if (out) out.textContent = '';
    try { await run(); b.innerHTML = 'เสร็จแล้ว ✓'; setTimeout(() => { b.disabled = false; b.innerHTML = label; }, 1800); }
    catch(e){ b.disabled = false; b.innerHTML = label; if (out) out.innerHTML = `<span class="err">ไม่สำเร็จ: ${esc(errTxt(e))}</span>`; }
  }; };
  const u531Txt = v => v === true ? 'เล่น 5/3/1' : v === false ? 'ท่าใหญ่แบบธรรมดา' : 'ยังไม่เลือก (ให้ผู้ใช้เลือกเอง)';
  async function loadMembers(){
    const q = await fs.collection('members').get();
    return Promise.all(q.docs.map(async d => {
      const m = d.data(), out = {id:d.id, ...m, mine: d.id === acc.uid, prog:'—', set:{}};
      try { const pd = await fs.doc(`users/${d.id}/program/days`).get(); out.prog = pd.exists ? (pd.data().name || 'โปรแกรมกำหนดเอง') : 'โปรแกรมเริ่มต้น'; } catch(e){}
      try { const sd = await fs.doc(`users/${d.id}/settings/main`).get(); out.set = sd.exists ? sd.data() : {}; } catch(e){}
      return out;
    }));
  }
  const rootScr = {title:'แอดมิน', render: async body => {
    let n = ''; try { n = (await fs.collection('members').get()).docs.length + ' บัญชี'; } catch(e){}
    body.innerHTML = bar('👥', 'บัญชีผู้ใช้', n, 'data-go="members"') + bar('➕', 'สร้างบัญชีใหม่', 'ชื่อผู้ใช้ · รหัสผ่าน · โปรแกรม · 5/3/1', 'data-go="create"');
    body.querySelector('[data-go=members]').onclick = () => go(membersScr);
    body.querySelector('[data-go=create]').onclick = () => go(createScr);
  }};
  const membersScr = {title:'บัญชีผู้ใช้', render: async body => {
    const ms = (await loadMembers()).sort((a,b) => (b.mine - a.mine) || String(a.username).localeCompare(b.username));
    body.innerHTML = ms.map(m => bar(m.mine ? '⭐' : '👤', esc(m.username) + (m.mine ? ' (แอดมิน)' : ''),
      `${esc(m.prog)} · ${u531Txt(m.set.use531)} · ${m.set.cycleStart ? `รอบ ${m.set.cycle||1} เริ่ม ${esc(m.set.cycleStart)}` : 'ยังไม่เริ่มโปรแกรม'}`, `data-mid="${esc(m.id)}"`)).join('') || '<p class="tiny">ยังไม่มีบัญชี</p>';
    body.querySelectorAll('[data-mid]').forEach(b => b.onclick = () => { const m = ms.find(x => x.id === b.dataset.mid); go(memberScr(m)); });
  }};
  const memberScr = m0 => ({title: m0.username, render: async body => {
    await tplReady;
    const uid = m0.id, mine = m0.mine;
    let m = m0; try { m = (await loadMembers()).find(x => x.id === uid) || m0; } catch(e){}
    const s = m.set || {}, opt = (v, cur, label) => `<button class="seg${cur ? ' on' : ''}" data-u5="${v}">${label}</button>`;
    body.innerHTML = `<div class="card">
        <h2 style="margin-bottom:6px">${esc(m.username)}${mine ? ' · แอดมิน' : ''}</h2>
        <div class="adm-kv"><span>สร้างเมื่อ</span><b>${esc((m.createdAt||'').slice(0,10) || '—')}</b></div>
        <div class="adm-kv"><span>สถานะ</span><b>${s.cycleStart ? `รอบที่ ${s.cycle||1} · เริ่ม ${esc(s.cycleStart)}` : 'ยังไม่เริ่มโปรแกรม'}</b></div>
        <div class="adm-kv"><span>โปรแกรม</span><b>${esc(m.prog)}</b></div></div>
      <div class="card"><h3 style="margin-top:0">ท่าใหญ่ 5/3/1</h3>
        <div class="segrow">${opt('1', s.use531 === true, 'เล่น 5/3/1')}${opt('0', s.use531 === false, 'ท่าธรรมดา')}${opt('', s.use531 === undefined, 'ให้ผู้ใช้เลือก')}</div>
        <div class="tiny" id="u5Msg" style="margin-top:6px">ตอนนี้: ${u531Txt(s.use531)}</div></div>
      <div class="card"><h3 style="margin-top:0">เปลี่ยนโปรแกรม</h3>
        <select id="mTpl" style="width:100%"><option value="">— เลือกโปรแกรม —</option><option value="__default">โปรแกรมเริ่มต้น (ชุดเดียวกับแอดมิน)</option>${Object.entries(tpls).map(([k,v]) => `<option value="${esc(k)}">${esc(v.name || k)}</option>`).join('')}</select>
        <button id="mTplGo" style="width:100%;margin-top:8px">ใช้โปรแกรมนี้</button><div class="tiny" id="mTplMsg" style="margin-top:6px"></div></div>
      ${mine ? '' : `<div class="card"><h3 style="margin-top:0">รีเซ็ต</h3>
        <button class="adm-act" id="mCyc"><b>รีเซ็ตรอบ 5/3/1</b><span class="tiny">กลับเป็นรอบ 1 ยังไม่เริ่มโปรแกรม · เก็บ TM/1RM และประวัติที่กรอกไว้</span></button>
        <button class="adm-act danger" id="mWipe"><b>ล้างเป็นบัญชีใหม่</b><span class="tiny">ลบประวัติฝึก อาหาร TM/1RM ผลโค้ช และโปรแกรมที่ตั้งไว้ — กู้คืนไม่ได้ · ชื่อผู้ใช้/รหัสผ่านเหมือนเดิม</span></button>
        <div class="tiny" id="mRes" style="margin-top:6px"></div></div>`}`;
    body.querySelectorAll('[data-u5]').forEach(b => b.onclick = async () => {
      const v = b.dataset.u5; body.querySelectorAll('[data-u5]').forEach(x => x.disabled = true);
      try { await fs.doc(`users/${uid}/settings/main`).set({use531: v === '' ? FV.delete() : v === '1', updatedAt: now()}, {merge:true}); paint(); }
      catch(e){ body.querySelectorAll('[data-u5]').forEach(x => x.disabled = false); $('#u5Msg').innerHTML = `<span class="err">ไม่สำเร็จ: ${esc(errTxt(e))}</span>`; }
    });
    $('#mTplGo').onclick = async () => {
      const k = $('#mTpl').value, b = $('#mTplGo'), out = $('#mTplMsg');
      if (!k){ out.textContent = 'เลือกโปรแกรมก่อน'; return; }
      b.disabled = true; out.textContent = 'กำลังบันทึก…';
      try {
        if (k === '__default') await fs.doc(`users/${uid}/program/days`).delete();
        else { const tp = tpls[k]; await fs.doc(`users/${uid}/program/days`).set({name: tp.name || k, days: tp.days, extra: tp.extra || {}}); }
        out.textContent = 'บันทึกแล้ว ✓'; setTimeout(paint, 700);
      } catch(e){ out.innerHTML = `<span class="err">ไม่สำเร็จ: ${esc(errTxt(e))}</span>`; }
      finally { b.disabled = false; }
    };
    if (mine) return;
    const out = $('#mRes');
    // รีเซ็ตเฉพาะรอบ 5/3/1 → ยังไม่เริ่มโปรแกรม (เก็บ TM/1RM และประวัติที่กรอกไว้)
    twoTap($('#mCyc'), async () => {
      await fs.doc(`users/${uid}/settings/main`).set({cycle:1, cycleStart:null, rampExtra:[0,1,2,0], lag:{}, tmPending:{}, prevTm:FV.delete(), history:[], cycleResetAt:now(), updatedAt:now()}, {merge:true});
      setTimeout(paint, 900);
    }, out);
    // ล้างข้อมูลทั้งหมด (ชื่อผู้ใช้/รหัสผ่านเหมือนเดิม) → บัญชีใหม่ ยังไม่เริ่มโปรแกรม · ใช้โปรแกรมเริ่มต้น · คงค่า 5/3/1 ที่แอดมินเลือกไว้
    twoTap($('#mWipe'), async () => {
      const base = `users/${uid}`;
      for (const c of ['logs','coach','proposals','templates']){
        const q = await fs.collection(`${base}/${c}`).get();
        for (let i = 0; i < q.docs.length; i += 400){ const bt = fs.batch(); q.docs.slice(i, i+400).forEach(d => bt.delete(d.ref)); await bt.commit(); }
      }
      const bt = fs.batch();
      ['foodlib/recent','program/swaps','program/days','summary/current'].forEach(x => bt.delete(fs.doc(`${base}/${x}`)));
      const keep = s.use531 === undefined ? {} : {use531: s.use531};
      bt.set(fs.doc(`${base}/settings/main`), {oneRM:{}, tm:{}, tmPct:.9, cycle:1, cycleStart:null, rampExtra:[0,1,2,0], targets:null, ...keep, wipedAt:now()});
      await bt.commit(); setTimeout(paint, 900);
    }, out);
  }});
  const createScr = {title:'สร้างบัญชีใหม่', render: async body => {
    await tplReady;
    const defProg = JSON.stringify({days: myProg()}, null, 1);
    body.innerHTML = `<div class="card">
      <div class="row"><div><label>ชื่อผู้ใช้</label><input id="adU" autocapitalize="none"></div><div><label>รหัสผ่านเริ่มต้น</label><input id="adP" type="text"></div></div>
      <label style="margin-top:8px">ท่าใหญ่ 5/3/1</label><select id="adU5"><option value="">ให้ผู้ใช้เลือกเองตอนเข้าครั้งแรก</option><option value="1">เล่น 5/3/1</option><option value="0">ไม่เล่น (ท่าใหญ่เป็นท่าธรรมดา)</option></select>
      <div class="grid3" style="margin-top:8px"><div><label>เบนช์ 1RM</label><input id="adRb" type="number" step="2.5"></div><div><label>สควอท 1RM</label><input id="adRs" type="number" step="2.5"></div><div><label>เดดลิฟต์ 1RM</label><input id="adRd" type="number" step="2.5"></div></div>
      <p class="tiny" style="margin:4px 0 0">1RM ใช้เฉพาะคนที่เล่น 5/3/1 — เว้นว่างได้ ให้ผู้ใช้กรอกเองทีหลัง</p>
      <label style="margin-top:8px">โปรแกรม</label><select id="adTpl"><option value="">โปรแกรมเริ่มต้น (ชุดเดียวกับแอดมิน)</option>${Object.entries(tpls).map(([k,v]) => `<option value="${esc(k)}">${esc(v.name || k)}</option>`).join('')}</select>
      <details style="margin-top:8px"><summary class="tiny" style="cursor:pointer">แก้โปรแกรมเอง (JSON)</summary><textarea id="adProg" rows="8" style="width:100%;margin-top:6px;font-family:monospace;font-size:12px">${esc(defProg)}</textarea></details>
      <button class="primary" id="adGo" style="width:100%;margin-top:12px">สร้างบัญชี</button><div id="adMsg" class="tiny" style="margin-top:6px"></div></div>`;
    $('#adTpl').onchange = () => { const t = tpls[$('#adTpl').value]; $('#adProg').value = t ? JSON.stringify({days: t.days, extra: t.extra || undefined}, null, 1) : defProg; if (t?.username && !$('#adU').value) $('#adU').value = t.username; };
    $('#adGo').onclick = async () => {
      const u = $('#adU').value.trim().toLowerCase(), p = $('#adP').value;
      if (!validUser(u)){ $('#adMsg').textContent = 'ชื่อผู้ใช้ใช้ได้เฉพาะ a–z 0–9 . _ - ยาว 3–30 ตัว'; return; }
      if (p.length < 6){ $('#adMsg').textContent = 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว'; return; }
      const raw = $('#adProg').value, k = $('#adTpl').value;
      let prog = null;
      if (k){ const tp = tpls[k]; prog = {name: tp.name || k, days: tp.days, extra: tp.extra || {}}; }
      else if (raw.trim() !== defProg.trim()){ try { prog = JSON.parse(raw); if (!prog.days) throw 0; prog.name = prog.name || 'โปรแกรมกำหนดเอง'; } catch(e){ $('#adMsg').textContent = 'JSON โปรแกรมไม่ถูกต้อง (ต้องมี "days")'; return; } }
      $('#adGo').disabled = true; $('#adMsg').textContent = 'กำลังสร้าง…';
      const tmp = firebase.apps.find(a => a.name==='adm') || firebase.initializeApp(window.FB_CONFIG, 'adm');
      try {
        const cred = await tmp.auth().createUserWithEmailAndPassword(toEmail(u), p); const nu = cred.user.uid; await tmp.auth().signOut();
        const rm = {bench:+$('#adRb').value||null, squat:+$('#adRs').value||null, deadlift:+$('#adRd').value||null};
        const tm = {}; Object.entries(rm).forEach(([k,v]) => { if (v) tm[k] = Math.floor(v*.9/2.5)*2.5; });
        const u5 = $('#adU5').value;
        await fs.doc('members/'+nu).set({username:u, createdAt:now()});
        if (prog) await fs.doc(`users/${nu}/program/days`).set(prog);       // ไม่เลือก = ใช้โปรแกรมเริ่มต้น (อัปเดตตามแอดมิน)
        await fs.doc(`users/${nu}/settings/main`).set({oneRM:rm, tm, tmPct:.9, cycle:1, cycleStart:null, rampExtra:[0,1,2,0], targets:null, ...(u5 ? {use531: u5 === '1'} : {})});
        $('#adMsg').textContent = `สร้างบัญชี ${u} แล้ว ✓`; $('#adU').value = ''; $('#adP').value = '';
      } catch(e){ $('#adMsg').textContent = errTxt(e); }
      finally { $('#adGo').disabled = false; }
    };
  }};
}
})();
