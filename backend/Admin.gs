/** Admin API: faqat autentifikatsiyadan keyin (handleAdmin_ orqali) */

// Tahrirlanadigan sheet'lar. Tur: s<N> — matn (maks N), n — butun son, b — ha/yo'q, r — reyting 1..5, ref — Courses ID
const ADMIN_SHEETS = {
  Courses: { prefix: 'c', fields: { name: 's80', description: 's500', order: 'n', active: 'b' }, required: ['name'] },
  Groups: { prefix: 'g', fields: { course_id: 'ref', name: 's60', description: 's300', schedule: 's100', order: 'n', active: 'b' }, required: ['course_id', 'name'] },
  Teachers: { prefix: 't', fields: { full_name: 's100', position: 's120', bio: 's1500', photo_url: 's300', order: 'n', active: 'b' }, required: ['full_name'] },
  Formats: { prefix: 'f', fields: { name: 's60', description: 's300', order: 'n', active: 'b' }, required: ['name'] },
  Advantages: { prefix: 'a', fields: { title: 's100', text: 's300', order: 'n', active: 'b' }, required: ['title'] },
  Testimonials: { prefix: 'r', fields: { name: 's80', result: 's120', text: 's500', order: 'n', active: 'b' }, required: ['name', 'text'] },
  FAQ: { prefix: 'q', fields: { question: 's200', answer: 's1000', order: 'n', active: 'b' }, required: ['question', 'answer'] },
  HeroCards: { prefix: 'h', fields: { title: 's80', course_id: 'ref', order: 'n', active: 'b' }, required: ['title', 'course_id'] },
  Reviews: { prefix: 'v', fields: { name: 's60', rating: 'r', text: 's500', approved: 'b' }, required: ['name', 'text'], noCreate: true },
};
const SETTINGS_KEYS = { academyName: 80, heroTitle: 200, heroText: 500, phones: 300, telegram: 40, address: 200, workingHours: 100, mapUrl: 500, instagram: 300, facebook: 300, youtube: 300, stats: 0 };
const URL_KEYS = ['mapUrl', 'instagram', 'facebook', 'youtube'];

function handleAdmin_(b) {
  if (b.action === 'adminLogin') return adminLogin_(b);
  const me = authenticate_(b.token);
  switch (b.action) {
    case 'adminMe': return { admin: { id: me.id, login: me.login } };
    case 'adminListSheet': return adminListSheet_(b.sheet);
    case 'adminUpsert': return adminUpsert_(b);
    case 'adminDelete': return adminDelete_(b);
    case 'adminReorder': return adminReorder_(b);
    case 'adminApplications': return adminApplications_();
    case 'adminGetSettings': return adminGetSettings_();
    case 'adminSaveSettings': return adminSaveSettings_(b);
    case 'adminGetTelegram': return adminGetTelegram_();
    case 'adminSaveTelegram': return adminSaveTelegram_(b);
    case 'adminTestTelegram': return sendTelegram_('✅ <b>ApexEdu</b>: test xabari (admin panel)');
    case 'adminIntegration': return adminIntegration_();
    case 'adminEnsureSchema': setup(); return adminIntegration_();
    case 'adminInit': return adminInit_(me);
    case 'adminWarm': warmCache(); return { ok: true };
    case 'adminClearCache': clearAdminListCaches_(); warmCache(); return { ok: true };
    case 'adminUploadPhoto': return adminUploadPhoto_(b);
    case 'adminListAdmins': return adminListAdmins_();
    case 'adminCreateAdmin': return adminCreateAdmin_(b);
    case 'adminUpdateAdmin': return adminUpdateAdmin_(b, me);
    case 'adminDeleteAdmin': return adminDeleteAdmin_(b, me);
    case 'adminChangePassword': return adminChangePassword_(b, me);
    default: throw new ValidationError('not_found');
  }
}

// ---------- Umumiy qator amallari ----------
function updateRowById_(name, id, patch) {
  const sh = ss_().getSheetByName(name);
  const data = sh.getDataRange().getValues();
  const head = data[0];
  const i = data.findIndex((r, n) => n > 0 && String(r[0]) === String(id));
  if (i < 0) throw new ValidationError('not_found');
  const row = data[i].slice();
  head.forEach((h, c) => { if (Object.prototype.hasOwnProperty.call(patch, h)) row[c] = patch[h]; });
  sh.getRange(i + 1, 1, 1, head.length).setValues([row]);
  return i;
}
function deleteRowById_(name, id) {
  const sh = ss_().getSheetByName(name);
  const data = sh.getDataRange().getValues();
  const i = data.findIndex((r, n) => n > 0 && String(r[0]) === String(id));
  if (i < 0) throw new ValidationError('not_found');
  sh.deleteRow(i + 1);
}
function cfgOf_(sheet) {
  const cfg = ADMIN_SHEETS[sheet];
  if (!cfg) throw new ValidationError('invalid_sheet');
  return cfg;
}
function typedValue_(type, v) {
  if (type === 'n' || type === 'r') return Number(v) || 0;
  if (type === 'b') return isTrue_(v);
  return String(v == null ? '' : v);
}
function parseField_(type, v, key) {
  if (type === 'n') { const n = parseInt(v, 10); if (isNaN(n)) throw new ValidationError('invalid_' + key); return n; }
  if (type === 'b') return v === true || String(v).toLowerCase() === 'true';
  if (type === 'r') { const n = parseInt(v, 10); if (!(n >= 1 && n <= 5)) throw new ValidationError('invalid_' + key); return n; }
  if (type === 'ref') {
    const id = str_(v, 40);
    if (!readRows_('Courses').some(r => String(r.id) === id)) throw new ValidationError('invalid_ref');
    return id;
  }
  return str_(v, Number(type.slice(1)));
}

// ---------- Kontent CRUD ----------
// Tezlik: ro'yxatlar serverda keshlanadi; yozuvlar (va Sheets'da qo'lda tahrir — onEdit) keshni tozalaydi
function clearAdminListCaches_() {
  CacheService.getScriptCache().removeAll(Object.keys(ADMIN_SHEETS).map(s => 'al_' + s));
}
// Yozuvdan keyin: faqat kesh tozalanadi (tez). Sayt keshini qayta qurishni frontend fonda so'raydi (adminWarm).
function invalidate_(sheet) {
  CacheService.getScriptCache().remove('al_' + sheet);
  clearPublicCache_();
}

function adminListSheet_(sheet) {
  const cfg = cfgOf_(sheet);
  const cache = CacheService.getScriptCache();
  const key = 'al_' + sheet;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const rows = readRows_(sheet).map(r => {
    const o = { id: String(r.id) };
    Object.keys(cfg.fields).forEach(k => { o[k] = typedValue_(cfg.fields[k], r[k]); });
    if (sheet === 'Reviews') o.created_at = String(r.created_at);
    return o;
  });
  if (cfg.fields.order) rows.sort((a, b) => a.order - b.order);
  else rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  try { cache.put(key, JSON.stringify(rows), 21600); } catch (e) { /* kesh to'lsa — e'tibor bermaymiz */ }
  return rows;
}

// Boshlang'ich yuklash: bitta so'rovda hamma narsa (har sahifa alohida so'rov yubormasligi uchun)
function adminInit_(me) {
  const sheets = {};
  Object.keys(ADMIN_SHEETS).forEach(n => { sheets[n] = adminListSheet_(n); });
  return {
    admin: { id: me.id, login: me.login },
    sheets: sheets,
    settings: adminGetSettings_(),
    telegram: adminGetTelegram_(),
    admins: adminListAdmins_(),
  };
}

function adminUpsert_(b) {
  const cfg = cfgOf_(b.sheet);
  const row = b.row || {};
  const vals = {};
  Object.keys(cfg.fields).forEach(k => { if (row[k] !== undefined) vals[k] = parseField_(cfg.fields[k], row[k], k); });
  const id = withLock_(() => {
    const sh = ss_().getSheetByName(b.sheet);
    const data = sh.getDataRange().getValues();
    const head = data[0];
    if (row.id) {
      cfg.required.forEach(k => { if (k in vals && vals[k] === '') throw new ValidationError('required_' + k); });
      updateRowById_(b.sheet, row.id, vals);
      return String(row.id);
    }
    if (cfg.noCreate) throw new ValidationError('not_allowed');
    cfg.required.forEach(k => { if (vals[k] === undefined || vals[k] === '') throw new ValidationError('required_' + k); });
    const newId = cfg.prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const maxOrder = data.slice(1).reduce((m, r) => Math.max(m, Number(r[head.indexOf('order')]) || 0), 0);
    const out = head.map(h => {
      if (h === 'id') return newId;
      if (vals[h] !== undefined) return vals[h];
      if (h === 'order') return maxOrder + 1;
      if (h === 'active') return true;
      return '';
    });
    sh.appendRow(out);
    return newId;
  });
  invalidate_(b.sheet);
  return { id: id };
}

function adminDelete_(b) {
  cfgOf_(b.sheet);
  if (b.sheet === 'Courses') {
    const used = readRows_('Groups').some(r => String(r.course_id) === String(b.id)) || readRows_('HeroCards').some(r => String(r.course_id) === String(b.id));
    if (used) throw new ValidationError('in_use');
  }
  withLock_(() => deleteRowById_(b.sheet, b.id));
  invalidate_(b.sheet);
  return { ok: true };
}

function adminReorder_(b) {
  const cfg = cfgOf_(b.sheet);
  if (!cfg.fields.order) throw new ValidationError('not_allowed');
  const ids = (b.ids || []).map(String);
  withLock_(() => {
    const sh = ss_().getSheetByName(b.sheet);
    const data = sh.getDataRange().getValues();
    const oc = data[0].indexOf('order');
    for (let i = 1; i < data.length; i++) {
      const pos = ids.indexOf(String(data[i][0]));
      if (pos >= 0) data[i][oc] = pos + 1;
    }
    if (data.length > 1) sh.getRange(2, 1, data.length - 1, data[0].length).setValues(data.slice(1));
  });
  invalidate_(b.sheet);
  return { ok: true };
}

// ---------- Arizalar ----------
// Ixcham format: {cols, rows:[[...]]} (kalit nomlari takrorlanmaydi), faqat oxirgi 5000 ta, yangisi birinchi
function adminApplications_() {
  const cols = SCHEMA.Applications;
  const sh = ss_().getSheetByName('Applications');
  const last = sh.getLastRow();
  if (last < 2) return { cols: cols, rows: [] };
  const start = Math.max(2, last - 4999);
  const vals = sh.getRange(start, 1, last - start + 1, cols.length).getValues();
  const rows = vals.filter(r => String(r[0]) !== '').map(r => r.map(v => String(v == null ? '' : v)));
  return { cols: cols, rows: rows.reverse() };
}

// ---------- Umumiy sozlamalar ----------
function adminGetSettings_() {
  const out = {};
  Object.keys(SETTINGS_KEYS).forEach(k => { out[k] = ''; });
  readRows_('Settings').forEach(r => { const k = String(r.key); if (k in SETTINGS_KEYS) out[k] = String(r.value == null ? '' : r.value); });
  let stats = [];
  try { stats = JSON.parse(out.stats || '[]'); } catch (e) { stats = []; }
  out.stats = stats;
  return out;
}

function adminSaveSettings_(b) {
  const v = b.values || {};
  const toWrite = {};
  Object.keys(v).forEach(k => {
    if (!(k in SETTINGS_KEYS)) return;
    let val;
    if (k === 'stats') {
      if (!Array.isArray(v.stats) || v.stats.length > 6) throw new ValidationError('invalid_stats');
      val = JSON.stringify(v.stats.map(s => ({ value: str_(s.value, 20), label: str_(s.label, 40) })).filter(s => s.value || s.label));
    } else if (k === 'phones') {
      val = String(v[k] || '').split(/[\n,;]+/).map(x => str_(x, 30)).filter(Boolean).join('\n');
    } else if (k === 'telegram') {
      val = str_(v[k], 40).replace(/^@/, '');
      if (val && !/^[A-Za-z0-9_]{3,32}$/.test(val)) throw new ValidationError('invalid_telegram');
    } else {
      val = str_(v[k], SETTINGS_KEYS[k]);
      if (URL_KEYS.indexOf(k) >= 0 && val && !/^https?:\/\//i.test(val)) throw new ValidationError('invalid_url');
    }
    toWrite[k] = val;
  });
  withLock_(() => {
    const sh = ss_().getSheetByName('Settings');
    const data = sh.getDataRange().getValues();
    Object.keys(toWrite).forEach(k => {
      const i = data.findIndex((r, n) => n > 0 && String(r[0]) === k);
      if (i < 0) sh.appendRow([k, toWrite[k]]);
      else sh.getRange(i + 1, 2).setValue(toWrite[k]);
    });
  });
  clearPublicCache_(); // sayt keshini frontend alohida (fonda) yangilaydi: adminWarm
  return { saved: Object.keys(toWrite) };
}

// ---------- Telegram sozlamalari (token hech qachon qaytarilmaydi) ----------
function adminGetTelegram_() {
  const c = telegramConfig_();
  return { enabled: c.enabled, tokenSet: !!c.token, chatIds: c.chatIds };
}
function adminSaveTelegram_(b) {
  const p = PropertiesService.getScriptProperties();
  if (b.enabled !== undefined) p.setProperty('TELEGRAM_ENABLED', b.enabled === true || b.enabled === 'true' ? 'true' : 'false');
  if (b.botToken) { // DIQQAT: "token" — admin sessiya tokeni, shuning uchun bot tokeni "botToken" deb nomlanadi
    const t = str_(b.botToken, 100);
    if (!/^\d{6,12}:[\w-]{30,}$/.test(t)) throw new ValidationError('invalid_token');
    p.setProperty('TELEGRAM_BOT_TOKEN', t);
  }
  if (b.chatIds !== undefined) {
    const ids = String(b.chatIds).split(/[\s,;]+/).filter(Boolean);
    if (ids.length > 20) throw new ValidationError('too_many_ids');
    ids.forEach(id => { if (!/^-?\d{4,20}$/.test(id) && !/^@\w{5,}$/.test(id)) throw new ValidationError('invalid_chat_id'); });
    p.setProperty('TELEGRAM_CHAT_IDS', ids.join(','));
  }
  return adminGetTelegram_();
}

// ---------- Integratsiya ma'lumoti ----------
function adminIntegration_() {
  const ss = ss_();
  const counts = {};
  Object.keys(SCHEMA).forEach(n => {
    const sh = ss.getSheetByName(n);
    counts[n] = sh ? Math.max(sh.getLastRow() - 1, 0) : null;
  });
  let webAppUrl = '';
  try { webAppUrl = ScriptApp.getService().getUrl() || ''; } catch (e) { webAppUrl = ''; }
  return {
    spreadsheetName: ss.getName(), spreadsheetUrl: ss.getUrl(), webAppUrl: webAppUrl, counts: counts,
    missing: Object.keys(counts).filter(k => counts[k] === null),
  };
}

// ---------- Rasm yuklash (Google Drive) ----------
function photoFolder_() {
  const p = PropertiesService.getScriptProperties();
  const saved = p.getProperty('DRIVE_FOLDER_ID');
  if (saved) { try { return DriveApp.getFolderById(saved); } catch (e) { /* o'chirilgan bo'lsa — qayta yaratiladi */ } }
  const f = DriveApp.createFolder('ApexEdu-teachers');
  p.setProperty('DRIVE_FOLDER_ID', f.getId());
  return f;
}
function adminUploadPhoto_(b) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[String(b.mime)];
  if (!ext) throw new ValidationError('invalid_file');
  const bytes = Utilities.base64Decode(String(b.data || ''));
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new ValidationError('file_too_large');
  const blob = Utilities.newBlob(bytes, String(b.mime), 'teacher-' + Date.now() + '.' + ext);
  const file = photoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: file.getId() };
}
