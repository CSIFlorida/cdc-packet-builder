/* Consumer Database — one profile per consumer, used by every section of the app */
(function () {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = window.PPFill;
  let grid;

  async function renderDocs() {
    const cid = CDCApp.currentId(), box = $('#docListDB'); if (!box) return;
    const list = (await CDCDocs.list(cid)).sort((a, b) => b.added.localeCompare(a.added));
    box.innerHTML = list.length ? '<table class="map"><tr><th>Type</th><th>File</th><th>Added</th><th></th></tr>' + list.map(d =>
      `<tr><td>${esc(d.kind)}${d.read ? (d.read.error ? ' <span class="badge b-opt">not read</span>' : ' <span class="badge b-req">read</span>') : ''}</td><td>${esc(d.name)} <span class="file">(${Math.round(d.size / 1024)} KB)</span></td><td>${esc(d.added.slice(0, 10))}</td>
       <td style="white-space:nowrap">${/pdf/i.test(d.type) ? `<button class="sm" data-read="${d.id}" title="Read the figures from this PDF">Read</button> ` : ''}<button class="sm" data-open="${d.id}">Open</button> <button class="sm" data-save="${d.id}">Download</button> <button class="sm danger" data-rm="${d.id}">Remove</button></td></tr>`).join('') + '</table>'
      : '<div class="file">No documents attached yet.</div>';
  }

  /* ---------- reading documents ---------- */
  let pending = null;
  const pdfjs = () => { const L = window.pdfjsLib; if (L && !L.GlobalWorkerOptions.workerSrc) L.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js'; return L; };
  const form = () => document.getElementById('f');
  const fieldVal = k => { const el = form().querySelector(`[name="${k}"]`); if (!el) return undefined; if (el.type === 'radio') { const c = form().querySelector(`[name="${k}"]:checked`); return c ? c.value : ''; } return el.type === 'checkbox' ? el.checked : el.value; };
  const show = v => v === true ? 'Yes' : v === false ? 'No' : esc(v || '—');
  async function readDoc(rec) {
    if (!/pdf/i.test(rec.type) && !/\.pdf$/i.test(rec.name)) { toastMsg('Only PDFs can be read — images must be typed in'); return; }
    if (!pdfjs()) { toastMsg('The PDF reader could not load'); return; }
    toastMsg('Reading ' + rec.name + '…');
    let r; try { r = await DocReader.read(pdfjs(), rec.bytes.slice(0)); } catch (e) { console.error(e); r = { error: 'Could not read this PDF (' + e.message + ').' }; }
    rec.read = { kind: r.kind || '', at: new Date().toISOString(), error: r.error || '' }; CDCDocs.update(rec);
    if (r.kind && /Other|Budget Authorization|Cost Plan|Statement/.test(rec.kind)) { rec.kind = { baf: 'Budget Authorization Form', costplan: 'Cost Plan', statement: 'CDC+ Monthly Statement', bcw: 'Budget Calculation Worksheet' }[r.kind] || rec.kind; CDCDocs.update(rec); }
    renderDocs();
    if (r.error) { openReview({ label: rec.name, error: r.error }); return; }
    r.rec = rec; openReview(r);
  }
  function openReview(r) {
    pending = r; const m = $('#readModal');
    $('#rdTitle').textContent = r.error ? 'Could not read the document' : `Read from the ${r.label}`;
    if (r.error) { $('#rdBody').innerHTML = `<p>${esc(r.error)}</p>`; $('#rdApply').classList.add('hide'); $('#rdNew').classList.add('hide'); m.classList.remove('hide'); return; }
    const f = r.fields, cur = fieldVal, curName = [cur('p_first'), cur('p_last')].filter(Boolean).join(' '), docName = [f.p_first, f.p_last].filter(Boolean).join(' ');
    const mismatch = curName && docName && curName.toLowerCase() !== docName.toLowerCase();
    let html = (r.info || []).map(i => `<p class="file">${esc(i)}</p>`).join('');
    if (mismatch) html += `<div class="issues" style="margin-bottom:8px"><b>This document is for ${esc(docName)}</b>, but the open profile is ${esc(curName)}. Create a new consumer from it, or apply only the fields you tick.</div>`;
    html += '<table class="map"><tr><th></th><th>Field</th><th>In the profile now</th><th>From the document</th></tr>';
    Object.keys(f).filter(k => k !== 'tbl_cps').forEach(k => {
      const now = cur(k); if (now === undefined) return;
      const same = String(now) === String(f[k]) || (now === true && f[k] === true);
      const tick = !same && !mismatch;
      html += `<tr><td><input type="checkbox" data-f="${k}" ${tick ? 'checked' : ''} ${same ? 'disabled' : ''}></td><td>${esc(DocReader.LABELS[k] || k)}</td><td>${show(now)}</td><td><b>${show(f[k])}</b>${same ? ' <span class="file">(same)</span>' : ''}</td></tr>`;
    });
    if (f.tbl_cps) {
      const n = f.tbl_cps.length; let have = 0; try { have = JSON.parse(cur('tbl_cps') || '[]').length; } catch (e) {}
      html += `<tr><td><input type="checkbox" data-f="tbl_cps" ${mismatch ? '' : 'checked'}></td><td>${esc(DocReader.LABELS.tbl_cps)}</td><td>${have} line(s)</td><td><b>${n} line(s)</b><br>${f.tbl_cps.map(x => `<span class="file">• ${esc(x.svc)} — ${esc(x.units)} ${esc(x.unit)} / ${esc(x.months)} mo · $${esc(x.amount)}${/TERMINATED/.test(x.note) ? ' · terminated' : ''}</span>`).join('<br>')}</td></tr>`;
    }
    html += '</table>' + (f.tbl_cps ? '<p class="hint" style="margin-top:8px">Unit types for Cost Plan lines are worked out from the notes (hours, quarter hours, trips) — check them in the Cost Plan table after applying.</p>' : '');
    $('#rdBody').innerHTML = html; $('#rdApply').classList.remove('hide'); $('#rdNew').classList.toggle('hide', !mismatch && !!curName);
    m.classList.remove('hide');
  }
  function applyFields(keys) {
    const f = pending.fields, F = form();
    keys.forEach(k => {
      const el = F.querySelector(`[name="${k}"]`); if (!el) return;
      if (k === 'tbl_cps') el.value = JSON.stringify(f.tbl_cps);
      else if (el.type === 'checkbox') el.checked = !!f[k];
      else if (el.type === 'radio') F.querySelectorAll(`[name="${k}"]`).forEach(x => x.checked = x.value === f[k]);
      else el.value = f[k];
    });
    F.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function toastMsg(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); }
  function wireReader() {
    $('#rdCancel').onclick = () => $('#readModal').classList.add('hide');
    $('#rdApply').onclick = () => { const keys = $$('#rdBody input[data-f]:checked').map(x => x.dataset.f); applyFields(keys); $('#readModal').classList.add('hide'); toastMsg(`${keys.length} item(s) updated from the document`); };
    $('#rdNew').onclick = () => {
      const keys = Object.keys(pending.fields), rec = pending.rec; $('#readModal').classList.add('hide'); $('#btnNew').click();
      setTimeout(async () => {
        applyFields(keys);
        if (rec) { rec.cid = CDCApp.currentId(); await CDCDocs.update(rec); renderDocs(); }   // the document moves to the new consumer
        toastMsg('New consumer created from the document');
      }, 80);
    };
  }

  async function blobOf(id) { const d = await CDCDocs.get(id); return d && { d, url: URL.createObjectURL(new Blob([d.bytes], { type: d.type })) }; }

  PacketApp({
    KEY: 'cdcConsumers.v1',
    filler: { DOCS: [], applicability: () => ({}) },
    dupMsg: 'New consumer profile started from this one',
    DEFAULTS: { p_state: 'FL', g_state: 'FL', r_state: 'FL', p_lang: 'English', legal_status: 'competent', tbl_cps: '[]' },
    recTitle: d => [d.p_first, d.p_last].filter(Boolean).join(' ') || '(new consumer)',
    fileName: d => [d.p_first, d.p_last].join(' '),
    REQ: ['p_first', 'p_last', 'p_id', 'p_medicaid', 'p_dob', 'p_street', 'p_city', 'p_zip', 'p_phone', 'c_first', 'c_last', 'area', 'budget', 'sp_date', 'cp_from'],
    issues(d) {
      const out = [], bad = new Set();
      if (!d.p_first || !d.p_last) out.push('Enter the consumer\'s name');
      const id = String(d.p_id || '').replace(/\D/g, ''); if (id && id.length > 7) { out.push('CDC+ ID has more than 7 digits'); bad.add('p_id'); }
      const m = String(d.p_medicaid || '').replace(/\D/g, ''); if (m && m.length !== 10) { out.push('Medicaid ID must be 10 digits'); bad.add('p_medicaid'); }
      const s = String(d.p_ssn || '').replace(/\D/g, ''); if (s && s.length !== 9) { out.push('SSN must be 9 digits'); bad.add('p_ssn'); }
      if (/\bP\.?\s*O\.?\s*BOX\b/i.test(d.p_street || '')) { out.push('Use a physical street address (IRS forms do not accept a PO Box)'); bad.add('p_street'); }
      const missing = ['p_id', 'p_medicaid', 'p_dob', 'p_street', 'area', 'budget', 'sp_date', 'cp_from'].filter(k => !String(d[k] || '').trim());
      if (missing.length && d.p_first) out.push(`Reminder: ${missing.length} commonly used item(s) still empty — sections can only fill what the profile has`);
      if (d.cp_to && new Date(d.cp_to) < new Date()) out.push('Reminder: the Cost Plan end date has passed — update the Cost Plan');
      return { out, bad };
    },
    onRefresh(d) {
      $$('.guardianonly').forEach(e => e.classList.toggle('hide', !d.legal_status || d.legal_status === 'competent'));
      $$('.reponly').forEach(e => e.classList.toggle('hide', !d.has_rep));
      $('[name=rep_name]').value = d.has_rep ? [d.r_first, d.r_last].filter(Boolean).join(' ') : '';
      grid && grid.sync();
      if (grid) grid.setCalc((k, i) => { const r = JSON.parse(d.tbl_cps || '[]')[i]; return r && P.num(r.months) ? (P.num(r.units) / P.num(r.months)).toFixed(2).replace(/\.00$/, '') : ''; });
      clearTimeout(this._dt); this._dt = setTimeout(renderDocs, 50);
      setTimeout(filterList, 350);
    },
    setup(form, { refresh }) {
      $('[name=area]').innerHTML = '<option value=""></option>' + P.AREAS.map(a => `<option>${a}</option>`).join('');
      grid = window.LineGrid('g_cps', 'tbl_cps', [
        { k: 'svc', h: 'Service (as on Cost Plan)', w: 180 }, { k: 'months', h: '# months', num: 1, w: 60 }, { k: 'units', h: 'Total units', num: 1, w: 70 },
        { k: 'unit', h: 'Unit', sel: '<option value=""></option><option>Hour</option><option>QH</option><option>Day</option><option>Trip</option><option>Month</option><option>Unit</option><option>Mile</option>', w: 75 },
        { k: 'avg', h: 'Avg / month', calc: 1 }, { k: 'amount', h: 'Approved amount ($)', num: 1, w: 90 }, { k: 'kind', h: 'Type', sel: '<option value="">Regular</option><option>OTE</option><option>STE</option>', w: 85 }, { k: 'note', h: 'Dates · rate · provider', w: 220 }],
        { max: 30 });
      $('#docFile').onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const rec = await CDCDocs.add(CDCApp.currentId(), $('#docKind').value, f); e.target.value = ''; renderDocs();
        if (/pdf/i.test(rec.type) || /\.pdf$/i.test(rec.name)) readDoc(rec);
      };
      $('#docListDB').onclick = async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.open) { const x = await blobOf(b.dataset.open); if (x) { const a = document.createElement('a'); a.href = x.url; a.target = '_blank'; a.rel = 'noopener'; a.click(); } }
        if (b.dataset.save) { const x = await blobOf(b.dataset.save); if (x) { const a = document.createElement('a'); a.href = x.url; a.download = x.d.name; a.click(); } }
        if (b.dataset.read) { const d = await CDCDocs.get(b.dataset.read); if (d) readDoc(d); }
        if (b.dataset.rm) { if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Confirm'; setTimeout(() => { delete b.dataset.arm; b.textContent = 'Remove'; }, 3000); return; } await CDCDocs.del(b.dataset.rm); renderDocs(); }
      };
      // "Use this profile": remember the choice, then the section fills itself on open
      $$('[data-go]').forEach(b => b.onclick = () => { try { sessionStorage.setItem('cdcUseConsumer', CDCApp.currentId()); } catch (e) {} location.href = b.dataset.go; });
      $('#dbSearch').oninput = filterList;
      wireReader();
      $('#btnFromApps').onclick = () => {
        let apps = [], db; try { apps = (JSON.parse(localStorage.getItem('cdcAppRecords.v1')) || { records: [] }).records; db = JSON.parse(localStorage.getItem('cdcConsumers.v1')) || { records: [] }; } catch (e) { return; }
        const have = new Set(db.records.map(r => `${r.data.p_first}|${r.data.p_last}`.toLowerCase()));
        let n = 0;
        apps.forEach(r => { const d = r.data || {}; if (!d.p_first && !d.p_last) return; const k = `${d.p_first}|${d.p_last}`.toLowerCase(); if (have.has(k)) return;
          const keep = {}; Object.keys(d).forEach(x => { if (/^(p_|g_|r_|c_)/.test(x) || ['legal_status', 'has_rep', 'sp_date', 'cp_from', 'cp_to', 'ibudget_pin', 'rep_name'].includes(x)) keep[x] = d[x]; });
          db.records.push({ id: Math.random().toString(36).slice(2, 10), data: Object.assign({ tbl_cps: '[]' }, keep) }); have.add(k); n++; });
        localStorage.setItem('cdcConsumers.v1', JSON.stringify(db));
        const t = document.getElementById('toast'); t.textContent = n ? `${n} consumer profile(s) added — reloading…` : 'Every saved application already has a profile'; t.classList.add('show');
        if (n) setTimeout(() => location.reload(), 900); else setTimeout(() => t.classList.remove('show'), 2500);
      };
    },
    onDelete: r => { CDCDocs.delFor(r.id); },
    onImport: () => renderDocs(),
    mapHead: ['Profile data', 'Used in'],
    mapRows: [
      ['Name, IDs, date of birth, SSN, gender, race, address, phones, email, language', 'Application · Purchasing Plan (Page 1) · Employee & Vendor packets (employer / requester)'],
      ['Legal status and guardian', 'Application (Section II, who signs, IRS forms, Program Consent)'],
      ['CDC+ Representative', 'Application (Section III, Representative Agreement) · Purchasing Plan · I-9 employer line'],
      ['Consultant', 'Application (Section IV, Consent Form) '],
      ['APD Area, FFI, monthly budget', 'Purchasing Plan Page 1'],
      ['iBudget PIN, Support Plan and Cost Plan dates', 'Application Section V · Purchasing Plan Page 2'],
      ['Approved Cost Plan services', 'Purchasing Plan Section B (Needs, column 2)'],
      ['Latest monthly statement', 'Purchasing Plan Section E (statement date, balance, unrestricted funds)'],
      ['Employer EIN', 'Employee packet (W-4 employer EIN)'],
    ],
  });

  function filterList() {
    const q = ($('#dbSearch').value || '').trim().toLowerCase();
    $$('#recList .rec').forEach(el => el.classList.toggle('hide', !!q && !el.textContent.toLowerCase().includes(q)));
  }
})();
