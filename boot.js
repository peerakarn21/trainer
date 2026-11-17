// Trainer — login gate + Firebase adapter (โหลดก่อน app.js)
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DOMAIN = '@trainer.app';
const toEmail = u => u.trim().toLowerCase() + DOMAIN;
const validUser = u => /^[a-z0-9._-]{3,30}$/.test(u.trim().toLowerCase());
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

function showGate(html){ gate.hidden = false; gate.innerHTML = `<div class="gatecard"><div class="brand" style="font-size:22px;margin-bottom:12px">Trainer</div>${html}</div>`; }

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
const step = t => { const m = $('#gMsg'); if (m) m.innerHTML = msgHTML(t); else showGate(`<p class="tiny">${esc(t)}</p>`); };
async function startInner(user){
  const uid = user.uid;
  let member = null, isAdmin = false, program = null;
  step('กำลังตรวจสิทธิ์บัญชี…');
  const adm = await withTimeout(fs.doc('meta/admin').get(), 15000, 'เชื่อมต่อฐานข้อมูลไม่ได้ (หมดเวลา) — ตรวจอินเทอร์เน็ตแล้วกดลองใหม่');
  isAdmin = adm.exists && adm.data().uid === uid;
  const m = await withTimeout(fs.doc('members/'+uid).get(), 15000, 'โหลดข้อมูลสมาชิกไม่ได้ (หมดเวลา)'); member = m.exists ? m.data() : null;
  if (!member && !isAdmin){
    showGate(`<p>บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน — ติดต่อผู้ดูแล</p><button id="gOut">ออกจากระบบ</button>`);
    $('#gOut').onclick = () => auth.signOut(); return;
  }
  step('กำลังโหลดโปรแกรม…');
  try { const p = await withTimeout(fs.doc(`users/${uid}/program/days`).get(), 15000, 'program'); if (p.exists) program = p.data(); } catch(e){ if (e?.code==='timeout') throw {message:'โหลดโปรแกรมไม่ได้ (หมดเวลา) — กดลองใหม่'}; }
  try { const sref = fs.doc(`users/${uid}/settings/main`);
    if (!(await sref.get()).exists){ const d = new Date(), mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay()+6)%7));
      const iso = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;
      await sref.set({oneRM:{}, tm:{}, tmPct:.9, cycle:1, cycleStart:iso, rampExtra:[0,1,2,0], targets:null}); } } catch(e){}
  started = true; gate.hidden = true; gate.innerHTML = '';
  window.__PROGRAM = program;
  window.__ACCOUNT = {uid, username: member?.username || user.email.replace(DOMAIN,''), isAdmin};
  const base = fs.collection('users').doc(uid);
  const ref = p => p.split('/').reduce((r, seg, i) => i%2===0 ? r.collection(seg) : r.doc(seg), base);
  const db = {doc: ref, collection: ref};
  window.claude = {use: async k => k==='db' ? db : k==='user' ? {canEdit: async () => true} : null};
  const s = document.createElement('script'); s.src = 'app.js?v=' + (window.APP_VER||1);
  s.onload = () => accountUI(user, isAdmin);
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
  $('#aOut').onclick = () => auth.signOut();
  $('#aChP').onclick = async () => {
    const p = $('#aNewP').value; if (p.length < 6){ $('#aMsg').textContent = 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว'; return; }
    try { await user.updatePassword(p); $('#aMsg').textContent = 'เปลี่ยนรหัสผ่านแล้ว ✓'; $('#aNewP').value=''; }
    catch(e){ $('#aMsg').textContent = e?.code==='auth/requires-recent-login' ? 'ออกจากระบบแล้วเข้าใหม่ก่อน แล้วค่อยเปลี่ยน' : errTxt(e); }
  };
  if (!isAdmin) return;
  const ad = document.createElement('div'); ad.className = 'card';
  const defProg = JSON.stringify({days: window.__PROGRAM?.days || window.__DEFAULT_DAYS}, null, 1);
  ad.innerHTML = `<h2>ผู้ดูแล: บัญชีผู้ใช้</h2><div id="adList" class="tiny">กำลังโหลด…</div>
    <h3>สร้างบัญชีใหม่</h3>
    <div class="row"><div><label>ชื่อผู้ใช้</label><input id="adU" autocapitalize="none"></div><div><label>รหัสผ่านเริ่มต้น</label><input id="adP" type="text"></div></div>
    <div class="grid3" style="margin-top:8px"><div><label>เบนช์ 1RM</label><input id="adRb" type="number" step="2.5"></div><div><label>สควอท 1RM</label><input id="adRs" type="number" step="2.5"></div><div><label>เดดลิฟต์ 1RM</label><input id="adRd" type="number" step="2.5"></div></div>
    <label style="margin-top:8px">โปรแกรม</label><select id="adTpl"><option value="">โปรแกรมของฉัน (ค่าเริ่มต้น)</option></select>
    <label style="margin-top:8px">โปรแกรม (JSON)</label><textarea id="adProg" rows="6" style="width:100%;font-family:monospace;font-size:12px">${esc(defProg)}</textarea>
    <div class="row" style="margin-top:8px;align-items:center"><button class="primary" id="adGo" style="flex:0 0 auto">สร้างบัญชี</button><span id="adMsg" class="tiny" style="flex:1"></span></div>`;
  card.after(ad);
  const loadList = async () => {
    try { const q = await fs.collection('members').get();
      $('#adList').innerHTML = q.docs.map(d => `• ${esc(d.data().username)}${d.data().admin?' (แอดมิน)':''} <span style="opacity:.6">สร้าง ${esc((d.data().createdAt||'').slice(0,10))}</span>`).join('<br>') || 'ยังไม่มี';
    } catch(e){ $('#adList').textContent = 'โหลดรายชื่อไม่ได้: ' + errTxt(e); }
  };
  loadList();
  const tpls = {};
  fs.collection(`users/${acc.uid}/templates`).get().then(q => {
    q.docs.forEach(d => { tpls[d.id] = d.data(); const o = document.createElement('option'); o.value = d.id; o.textContent = d.data().name || d.id; $('#adTpl').appendChild(o); });
  }).catch(() => {});
  $('#adTpl').onchange = () => {
    const t = tpls[$('#adTpl').value];
    $('#adProg').value = t ? JSON.stringify({days: t.days, extra: t.extra || undefined}, null, 1) : defProg;
    if (t?.username && !$('#adU').value) $('#adU').value = t.username;
  };
  $('#adGo').onclick = async () => {
    const u = $('#adU').value.trim().toLowerCase(), p = $('#adP').value;
    if (!validUser(u)){ $('#adMsg').textContent = 'ชื่อผู้ใช้ใช้ได้เฉพาะ a–z 0–9 . _ - ยาว 3–30 ตัว'; return; }
    if (p.length < 6){ $('#adMsg').textContent = 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว'; return; }
    let prog; try { prog = JSON.parse($('#adProg').value); if (!prog.days) throw 0; } catch(e){ $('#adMsg').textContent = 'JSON โปรแกรมไม่ถูกต้อง (ต้องมี "days")'; return; }
    $('#adGo').disabled = true; $('#adMsg').textContent = 'กำลังสร้าง…';
    const tmp = firebase.apps.find(a => a.name==='adm') || firebase.initializeApp(window.FB_CONFIG, 'adm');
    try {
      const cred = await tmp.auth().createUserWithEmailAndPassword(toEmail(u), p); const nu = cred.user.uid; await tmp.auth().signOut();
      const now = new Date().toISOString(), rm = {bench:+$('#adRb').value||null, squat:+$('#adRs').value||null, deadlift:+$('#adRd').value||null};
      const tm = {}; Object.entries(rm).forEach(([k,v]) => { if (v) tm[k] = Math.floor(v*.9/2.5)*2.5; });
      const d = new Date(), mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay()+6)%7));
      const iso = x => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
      await fs.doc('members/'+nu).set({username:u, createdAt:now});
      await fs.doc(`users/${nu}/program/days`).set(prog);
      await fs.doc(`users/${nu}/settings/main`).set({oneRM:rm, tm, tmPct:.9, cycle:1, cycleStart:iso(mon), rampExtra:[0,1,2,0], targets:null});
      $('#adMsg').textContent = `สร้างบัญชี ${u} แล้ว ✓`; $('#adU').value=''; $('#adP').value=''; loadList();
    } catch(e){ $('#adMsg').textContent = errTxt(e); }
    finally { $('#adGo').disabled = false; }
  };
}
})();
