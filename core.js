/* Shared engine for every packet page (records, validation display, attachments, PDF download, help, privacy). */
window.PacketApp = function (cfg) {
  const VERSION = window.APP_VERSION;
  const DB_KEY = 'cdcConsumers.v1';
  const ALL_KEYS = [DB_KEY, 'cdcPacketRecords.v1', 'cdcEmpPacketRecords.v1', 'cdcAppRecords.v1', 'cdcPPRecords.v1']; // consumer database + every packet's saved records
  const PARTICIPANT_FIELDS = ['p_first', 'p_mi', 'p_last', 'p_id', 'p_dob', 'p_street', 'p_city', 'p_state', 'p_zip', 'rep_name', 'p_ein', 'has_rep', 'r_first', 'r_mi', 'r_last', 'r_phone', 'r_cell', 'r_email', 'p_phone'];
  const KEY = cfg.KEY;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const form = $('#f');
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  let store = { records: [], current: null }, att = {}, touched = new Set(), showAll = false, lastAp = {};
  $('#ver').textContent = VERSION;

  $$('.yn').forEach(el => { const n = el.dataset.name; el.innerHTML = `<label><input type="radio" name="${n}" value="Yes">Yes</label><label><input type="radio" name="${n}" value="No">No</label>`; });

  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2400); }
  function load() { try { store = JSON.parse(localStorage.getItem(KEY)) || store; } catch (e) {} }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  const uid = () => Math.random().toString(36).slice(2, 10);
  const cur = () => store.records.find(r => r.id === store.current);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function readForm() {
    const d = {};
    form.querySelectorAll('input,select,textarea').forEach(el => {
      if (!el.name || el.type === 'file') return;
      if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; else if (!(el.name in d)) d[el.name] = ''; }
      else if (el.type === 'checkbox') d[el.name] = el.checked;
      else d[el.name] = el.value;
    });
    return d;
  }
  function writeForm(d) {
    touched = new Set(); showAll = false;
    form.querySelectorAll('input,select,textarea').forEach(el => {
      if (!el.name || el.type === 'file') return;
      const v = d[el.name];
      if (el.type === 'radio') el.checked = (v === el.value);
      else if (el.type === 'checkbox') el.checked = !!v;
      else { el.value = v == null ? '' : v; if (el.tagName === 'SELECT' && el.selectedIndex < 0) el.selectedIndex = 0; }
    });
    refresh();
  }
  function newRecord(base) {
    const r = { id: uid(), data: Object.assign({}, cfg.DEFAULTS, { form_date: today(), sign_date: today() }, base || {}) };
    store.records.unshift(r); store.current = r.id; persist(); writeForm(r.data); renderRecs();
  }
  function renderRecs() {
    const el = $('#recList');
    if (!store.records.length) { el.innerHTML = '<div class="file">No records yet.</div>'; return; }
    el.innerHTML = store.records.map(r => {
      const d = r.data, p = [d.p_first, d.p_last].filter(Boolean).join(' ') || '—';
      return `<div class="rec ${r.id === store.current ? 'on' : ''}" data-id="${r.id}"><div>${esc(cfg.recTitle(d))}<small>Participant: ${esc(p)}</small></div></div>`;
    }).join('');
    el.querySelectorAll('.rec').forEach(x => x.onclick = () => { store.current = x.dataset.id; persist(); writeForm(cur().data); renderRecs(); });
  }

  /* Consumers from the Consumer Database first, then participants typed in other packets */
  function participants() {
    const seen = new Map(), list = [];
    ALL_KEYS.forEach(k => { try { (JSON.parse(localStorage.getItem(k)) || { records: [] }).records.forEach(r => {
      const d = r.data || {}; if (!d.p_first && !d.p_last) return;
      if (k === KEY && r.id === store.current) return;
      const id = `${(d.p_first || '').trim()}|${(d.p_last || '').trim()}`.toLowerCase();
      if (seen.has(id)) return; seen.set(id, 1); list.push({ d, db: k === DB_KEY });
    }); } catch (e) {} });
    return list;
  }
  function applyConsumer(d, db) {
    const now = readForm();
    if (db) {
      // same field names mean the same thing in every section: copy everything the consumer profile has
      Object.keys(now).forEach(k => { if (k.startsWith('tbl_')) return; if (k in d && d[k] !== '' && d[k] != null) now[k] = d[k]; });
      if (cfg.fromConsumer) Object.assign(now, cfg.fromConsumer(d, now));
    } else PARTICIPANT_FIELDS.forEach(k => { if (k in now && d[k] != null) now[k] = d[k]; });
    writeForm(now);
  }
  function renderPicker() {
    const sel = $('#pPick'); if (!sel) return;
    const list = participants(), dbn = list.filter(x => x.db).length;
    sel.innerHTML = '<option value="">— Fill from the Consumer Database or a saved participant —</option>' +
      (dbn ? '<optgroup label="Consumer Database">' + list.map((x, i) => x.db ? `<option value="${i}">📇 ${esc([x.d.p_first, x.d.p_last].filter(Boolean).join(' '))}${x.d.p_id ? ' · CDC+ ' + esc(x.d.p_id) : ''}</option>` : '').join('') + '</optgroup>' : '') +
      (list.length > dbn ? '<optgroup label="Typed in other sections">' + list.map((x, i) => !x.db ? `<option value="${i}">${esc([x.d.p_first, x.d.p_last].filter(Boolean).join(' '))}${x.d.p_id ? ' · CDC+ ' + esc(x.d.p_id) : ''}</option>` : '').join('') + '</optgroup>' : '');
    sel.closest('.pick').classList.toggle('hide', !list.length);
    sel.onchange = () => {
      const x = list[+sel.value]; if (!x) return;
      applyConsumer(x.d, x.db); sel.value = '';
      toast(x.db ? 'Filled from the Consumer Database' : 'Participant details filled in');
    };
  }
  window.CDCApp = { participants, applyConsumer, currentId: () => store.current, refresh: () => refresh() };

  function refresh() {
    const d = readForm();
    cfg.onRefresh && cfg.onRefresh(d, { $, $$ });
    const ap = cfg.filler.applicability(d);
    const prev = new Set($$('#docList input:checked').map(x => x.value));
    const first = !$('#docList').children.length;
    const off = a => a.startsWith('not');
    const isOpt = a => a.startsWith('only') || a.startsWith('optional');
    $('#docList').innerHTML = cfg.filler.DOCS.map(x => {
      const a = ap[x.key], cls = a.startsWith('required') ? 'b-req' : off(a) ? 'b-no' : 'b-opt';
      const was = lastAp[x.key] || '';
      let on = first ? !(off(a) || isOpt(a)) : (prev.has(x.key) || (a.startsWith('required') && !prev.size));
      if (a.startsWith('required') && !was.startsWith('required')) on = true;   // just became required → tick it
      if (!a.startsWith('required') && was.startsWith('required') && isOpt(a)) on = false;
      return `<label class="doc"><input type="checkbox" value="${x.key}" ${on && !off(a) ? 'checked' : ''} ${off(a) ? 'disabled' : ''}><span class="t"><b>${x.title}</b><span class="badge ${cls}">${a}</span></span><button class="sm one" data-k="${x.key}" type="button" ${off(a) ? 'disabled' : ''}>PDF</button></label>`;
    }).join('');
    lastAp = ap;
    $$('#docList .one').forEach(b => b.onclick = e => { e.preventDefault(); genOne(b.dataset.k); });
    const { out, bad } = cfg.issues(d, att);
    form.querySelectorAll('[name]').forEach(el => el.classList.toggle('invalid', bad.has(el.name) && (showAll || touched.has(el.name))));
    const hard = out.filter(x => !x.startsWith('Reminder'));
    $('#issues').innerHTML = out.length ? `<div class="issues ${hard.length ? '' : 'ok'}">${hard.length ? `<b>${hard.length} item(s) to complete</b>` : '<b>All required data entered</b>'}<ul>${out.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : `<div class="issues ok"><b>✓ Everything complete — ready to generate.</b></div>`;
    const done = cfg.REQ.filter(k => String(d[k] || '').trim()).length;
    const pct = hard.length ? Math.min(99, Math.round(100 * done / cfg.REQ.length)) : 100;
    $('#progBar').style.width = pct + '%'; $('#progTxt').textContent = pct + '% complete';
    const r = cur(); if (r) { r.data = d; persist(); }
    clearTimeout(refresh._r); refresh._r = setTimeout(renderRecs, 300);
  }
  form.addEventListener('focusout', e => { if (e.target.name) { touched.add(e.target.name); refresh(); } });
  form.addEventListener('input', refresh); form.addEventListener('change', refresh);
  form.querySelectorAll('[data-digits]').forEach(el => el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, '').slice(0, +el.dataset.digits || 99); }));
  form.querySelectorAll('[data-upper]').forEach(el => el.addEventListener('blur', () => { el.value = el.value.toUpperCase(); refresh(); }));
  cfg.setup && cfg.setup(form, { $, $$, refresh });

  async function readFile(inp, key) {
    const f = inp.files[0]; if (!f) { delete att[key]; $('#' + inp.id + '_n').textContent = ''; refresh(); return; }
    const nm = f.name.toLowerCase();
    att[key] = { bytes: new Uint8Array(await f.arrayBuffer()), type: f.type || (nm.endsWith('.pdf') ? 'application/pdf' : nm.endsWith('.png') ? 'image/png' : 'image/jpeg'), name: f.name };
    $('#' + inp.id + '_n').textContent = '✓ ' + f.name; refresh();
  }
  $$('input[type=file][data-att]').forEach(el => el.onchange = () => readFile(el, el.dataset.att));

  const b64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const TPL = {}; for (const k in window.TEMPLATES_B64) TPL[k] = b64(window.TEMPLATES_B64[k]);
  const clean = s => String(s || '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  const fname = (d, suffix) => cfg.makeFileName ? cfg.makeFileName(d, suffix) : `${clean(cfg.fileName(d)) || 'Packet'}_${clean(d.p_last)}_${suffix}.pdf`;
  function save(bytes, name) {
    const url = URL.createObjectURL(new Blob([bytes], { type: cfg.mime || 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function confirmIssues() {
    showAll = true; refresh();
    const hard = cfg.issues(readForm(), att).out.filter(x => !x.startsWith('Reminder'));
    if (hard.length) toast(`${hard.length} item(s) still blank — generating anyway; review before signing.`);
  }
  async function genOne(k) {
    try {
      confirmIssues(); const d = readForm();
      const doc = await cfg.filler.buildOne(window.PDFLib, k, TPL, d, false);
      save(await doc.save(), fname(d, cfg.filler.DOCS.find(x => x.key === k).file));
    } catch (e) { console.error(e); toast('Error: ' + e.message); }
  }
  if ($('#btnEach')) $('#btnEach').onclick = async () => { const ks = $$('#docList input:checked').map(x => x.value); if (!ks.length) return toast('Select at least one document'); for (const k of ks) { await genOne(k); await new Promise(r => setTimeout(r, 350)); } };
  if ($('#btnPacket')) $('#btnPacket').onclick = async () => {
    try {
      const ks = $$('#docList input:checked').map(x => x.value); if (!ks.length) return toast('Select at least one document');
      confirmIssues(); const d = readForm();
      const p = await cfg.filler.buildPacket(window.PDFLib, TPL, d, ks, att);
      save(await p.save(), fname(d, cfg.packetSuffix)); toast('Packet created');
    } catch (e) { console.error(e); toast('Error: ' + e.message); }
  };

  $('#btnNew').onclick = () => newRecord();
  $('#btnDup').onclick = () => { const d = readForm(), keep = {}; PARTICIPANT_FIELDS.forEach(k => { if (k in d) keep[k] = d[k]; }); newRecord(keep); toast(cfg.dupMsg); };
  $('#btnDel').onclick = () => {
    const b = $('#btnDel'), r = cur(); if (!r) return;
    if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Confirm delete'; setTimeout(() => { delete b.dataset.arm; b.textContent = 'Delete'; }, 3000); return; }
    cfg.onDelete && cfg.onDelete(r);
    store.records = store.records.filter(x => x !== r); delete b.dataset.arm; b.textContent = 'Delete';
    if (!store.records.length) newRecord(); else { store.current = store.records[0].id; persist(); writeForm(cur().data); renderRecs(); }
  };
  $('#btnExport').onclick = async () => {
    const all = {}; ALL_KEYS.forEach(k => { try { all[k] = JSON.parse(localStorage.getItem(k)); } catch (e) {} });
    const docs = window.CDCDocs ? await CDCDocs.exportAll() : [];
    const url = URL.createObjectURL(new Blob([JSON.stringify({ app: 'cdc-packet-builder', version: VERSION, stores: all, documents: docs }, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `cdc-backup-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast(`Backup saved${docs.length ? ` (with ${docs.length} document${docs.length > 1 ? 's' : ''})` : ''} — keep it somewhere safe, it contains private data`);
  };
  $('#imp').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const s = JSON.parse(await f.text());
      // New backups hold both packets; older backups held only vendor records
      const stores = s.stores || { 'cdcPacketRecords.v1': s };
      let n = 0;
      Object.entries(stores).forEach(([k, st]) => {
        if (!ALL_KEYS.includes(k) || !st || !st.records) return;
        let tgt; try { tgt = JSON.parse(localStorage.getItem(k)) || { records: [], current: null }; } catch (x) { tgt = { records: [], current: null }; }
        st.records.forEach(r => { if (!tgt.records.find(x => x.id === r.id)) { tgt.records.push(r); n++; } });
        if (k === KEY) store = tgt; else try { localStorage.setItem(k, JSON.stringify(tgt)); } catch (x) {}
      });
      if (!cur() && store.records[0]) store.current = store.records[0].id;
      if (s.documents && window.CDCDocs) n += await CDCDocs.importAll(s.documents);
      persist(); if (cur()) writeForm(cur().data); renderRecs(); renderPicker(); cfg.onImport && cfg.onImport(); toast(`Imported ${n} item(s)`);
    } catch (err) { toast('Could not read that file'); }
    e.target.value = '';
  };

  $('#mapTable').innerHTML = '<table class="map"><tr>' + cfg.mapHead.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>' + cfg.mapRows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</table>';
  $('#showMap').onclick = () => $('#mapModal').classList.remove('hide');

  const help = $('#helpModal');
  $('#btnHelp').onclick = () => help.classList.remove('hide');
  $('#helpOk').onclick = () => { help.classList.add('hide'); try { localStorage.setItem(KEY + '.welcomed', '1'); } catch (e) {} };
  $('#btnWipe').onclick = () => {
    const b = $('#btnWipe');
    if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Tap again to erase everything'; setTimeout(() => { delete b.dataset.arm; b.textContent = 'Erase all data on this device'; }, 4000); return; }
    try { ALL_KEYS.forEach(k => localStorage.removeItem(k)); } catch (e) {}
    if (window.CDCDocs) CDCDocs.wipe();
    store = { records: [], current: null }; att = {};
    $$('input[type=file][data-att]').forEach(el => { el.value = ''; $('#' + el.id + '_n').textContent = ''; });
    delete b.dataset.arm; b.textContent = 'Erase all data on this device'; newRecord(); renderPicker(); toast('All saved data (consumers, documents and every packet) erased from this device');
  };
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#btnInstall').classList.remove('hide'); });
  $('#btnInstall').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#btnInstall').classList.add('hide'); };
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  try { if (!localStorage.getItem(KEY + '.welcomed')) help.classList.remove('hide'); } catch (e) { help.classList.remove('hide'); }

  load();
  if (!store.records.length) newRecord(); else { if (!cur()) store.current = store.records[0].id; writeForm(cur().data); renderRecs(); }
  renderPicker();
  // Opened from the Consumer Database's "Use this profile" button: start a new record filled from that consumer
  try {
    const cid = sessionStorage.getItem('cdcUseConsumer');
    if (cid && KEY !== DB_KEY) {
      sessionStorage.removeItem('cdcUseConsumer');
      const c = ((JSON.parse(localStorage.getItem(DB_KEY)) || { records: [] }).records || []).find(r => r.id === cid);
      if (c) { help.classList.add('hide'); newRecord(); applyConsumer(c.data, true); toast(`Filled from the Consumer Database: ${[c.data.p_first, c.data.p_last].filter(Boolean).join(' ')}`); }
    }
  } catch (e) {}
};
