/* CDC+ Purchasing Plan — page configuration and editable line tables */
(function () {
  const P = PPFill, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const money = n => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const opt = (list, label) => [''].concat(list).map(v => Array.isArray(v) ? `<option value="${esc(v[0])}">${esc(v[1])}</option>` : `<option value="${esc(v)}">${esc(label ? label(v) : v)}</option>`).join('');
  const svcLabel = a => P.NAMES[a] ? `${a} – ${P.NAMES[a]}` : a;
  const REL = [['1', '1 – parent / step-parent'], ['2', '2 – child under 21'], ['3', '3 – spouse'], ['4', '4 – under 18, in high school'], ['5', '5 – not related as 1–4']];

  /* Provider names (and type / relationship) from the Employee and Vendor packets saved in this browser */
  function savedProviders() {
    const out = [];
    const rel = { parent: '1', child21: '2', spouse: '3', u18school: '4', none: '5' };
    try { (JSON.parse(localStorage.getItem('cdcEmpPacketRecords.v1')) || { records: [] }).records.forEach(r => { const d = r.data || {}; const n = [d.e_first, d.e_middle, d.e_last].filter(Boolean).join(' '); if (n) out.push({ name: n, type: 'DHE', rel: rel[d.tax_rel] || '', p: [d.p_first, d.p_last].join(' ').trim() }); }); } catch (e) {}
    try { (JSON.parse(localStorage.getItem('cdcPacketRecords.v1')) || { records: [] }).records.forEach(r => { const d = r.data || {}; if (d.v_name) out.push({ name: d.v_name, type: d.prov_type === 'IC' ? 'IC' : 'A/V', rel: '', p: [d.p_first, d.p_last].join(' ').trim() }); }); } catch (e) {}
    return out;
  }

  const Grid = window.LineGrid;
  const calcCost = r => { const n = P.num(r.units) * P.num(r.rate), sub = P.round2(n), tax = (String(r.type).toUpperCase() === 'DHE' && String(r.rel) === '5') ? P.round2(sub * 0.1115) : 0; return { sub, tax, total: P.round2(sub + tax) }; };
  let grids = {};

  PacketApp({
    KEY: 'cdcPPRecords.v1',
    filler: PPFill,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    packetSuffix: 'Purchasing-Plan',
    makeFileName: d => `PP_${[d.p_first, d.p_last].filter(Boolean).join('_').replace(/[^\w]+/g, '_') || 'Participant'}${d.eff_month ? '_' + d.eff_month + '-01' : ''}.xlsx`,
    dupMsg: 'New plan for the same participant',
    fromConsumer(c, now) {
      const out = {};
      const fmt = iso => iso ? iso.slice(5, 7) + '/' + iso.slice(8, 10) + '/' + iso.slice(0, 4) : '';
      out.pp_phone = (c.has_rep && c.r_phone) || c.p_phone || now.pp_phone || '';
      out.pp_cell = (c.has_rep && c.r_cell) || now.pp_cell || '';
      out.pp_contact = [(c.has_rep ? c.r_phone : c.p_phone), (c.has_rep ? c.r_email : c.p_email)].filter(Boolean).join(' / ') || now.pp_contact || '';
      if (c.cp_from) out.cp_date = fmt(c.cp_from) + (c.cp_to ? ' – ' + fmt(c.cp_to) : '');
      if (c.budget_month && !now.eff_month) out.eff_month = c.budget_month;
      // Cost Plan services → Section B, column 2 (only when Needs is still empty)
      let cps = []; try { cps = JSON.parse(c.tbl_cps || '[]').filter(r => r && r.svc); } catch (e) {}
      let needs = []; try { needs = JSON.parse(now.tbl_needs || '[]').filter(r => Object.values(r).some(v => String(v || '').trim())); } catch (e) {}
      if (cps.length && !needs.length) out.tbl_needs = JSON.stringify(cps.slice(0, 15).map(r => ({ cps: r.svc, months: r.months, units: r.units, cpunit: r.unit, notes: r.kind ? r.kind : '' })));
      return out;
    },
    DEFAULTS: { ffi: 'No', reason: 'update', cash_change: '', tbl_needs: '[]', tbl_svc: '[]', tbl_sup: '[]', tbl_cash: '[]', tbl_sav: '[]', tbl_ote: '[]' },
    recTitle: d => `${[d.p_first, d.p_last].filter(Boolean).join(' ') || '(new plan)'}${d.eff_month ? ' · ' + d.eff_month : ''}`,
    fileName: d => [d.p_first, d.p_last].filter(Boolean).join(' '),
    REQ: ['eff_month', 'budget', 'area', 'ffi', 'p_first', 'p_last', 'p_id', 'age', 'reason'],
    issues(d) {
      const out = [], bad = new Set();
      const need = (k, l) => { if (!String(d[k] || '').trim()) { out.push(l + ' is missing'); bad.add(k); } };
      need('eff_month', 'Effective date'); need('budget', 'Monthly budget'); need('area', 'APD Area'); need('ffi', 'FFI yes/no');
      need('p_first', 'Participant first name'); need('p_last', 'Participant last name'); need('p_id', 'CDC+ ID #'); need('age', 'Age');
      if (d.p_id && String(d.p_id).replace(/\D/g, '').length !== 7) { out.push('CDC+ ID # must be 7 digits'); bad.add('p_id'); }
      if (d.has_rep && !(d.r_first && d.r_last)) out.push('Enter the Representative\'s name');
      if (!d.reason) out.push('Choose the reason for submitting');
      if (d.reason === 'new' && !d.baf) out.push('New Start: the Budget Authorization Form must be attached');
      if (d.reason === 'change' && !(P.num(d.chg_budget) || P.num(d.chg_ote) || P.num(d.chg_ste))) out.push('Plan CHANGE: enter the new budget and/or the OTE/STE amount');
      if (d.newrep && !d.newrep_piu) out.push('New Representative: the Participant Information Update form is required');
      const { out: rules, x } = P.check(d);
      if (!x.t.svc.length && !x.t.sup.length) out.push('Add at least one service or supply line');
      if (!x.t.needs.length) out.push('B. Needs: list the needs/goals and the services approved on the Cost Plan');
      return { out: out.concat(rules), bad };
    },
    onRefresh(d) {
      $$('.reponly').forEach(e => e.classList.toggle('hide', !d.has_rep));
      $$('.newreponly').forEach(e => e.classList.toggle('hide', !d.newrep));
      $$('.r-new').forEach(e => e.classList.toggle('hide', d.reason !== 'new'));
      $$('.r-change').forEach(e => e.classList.toggle('hide', d.reason !== 'change'));
      $$('.r-rev').forEach(e => e.classList.toggle('hide', !(d.reason === 'change' || d.reason === 'update')));
      Object.values(grids).forEach(g => g.sync());
      const x = P.compute(d);
      // computed cells in the tables
      const flat = x.svcCalc.flat();
      grids.svc && grids.svc.setCalc((k, i) => { const r = flat[i]; if (!r) return ''; if (k === 'total') return money(r.total); if (k === 'tax') return r.tax ? money(r.tax) : '–'; if (k === 'added') return r.added ? money(r.added) : ''; if (k === 'code') return r.code; if (k === 'page') return ''; return ''; });
      const supFlat = x.supCalc.flat();
      grids.sup && grids.sup.setCalc((k, i) => supFlat[i] ? money(supFlat[i].total) : '');
      grids.cash && grids.cash.setCalc((k, i) => x.cashCalc[i] ? money(x.cashCalc[i].total) : '');
      grids.sav && grids.sav.setCalc((k, i) => x.savCalc[i] ? money(x.savCalc[i].total) : '');
      grids.ote && grids.ote.setCalc((k, i) => x.oteCalc[i] ? (k === 'code' ? x.oteCalc[i].code : money(x.oteCalc[i].total)) : '');
      grids.needs && grids.needs.setCalc((k, i) => { const r = x.t.needs[i]; return r && P.num(r.months) ? (P.num(r.units) / P.num(r.months)).toFixed(2).replace(/\.00$/, '') : ''; });
      // summary
      const row = (l, v, cls) => `<tr class="${cls || ''}"><td>${l}</td><td>${v}</td></tr>`;
      $('#sumTbl').innerHTML = row('Authorized budget', money(x.budget), 'b') +
        row('C. Services', money(x.C1)) + row('C. Supplies', money(x.C2)) + row('D. Cash', money(x.D)) +
        row('E. Savings each month', money(x.E), x.E < 0 ? 'bad' : 'ok') +
        row('Total monthly expenditures', money(x.C + x.D + x.E), 'b') +
        row('Funds reserved for EBUs', money(x.EBU)) + row('Plan pages', `${x.totalPages}${x.extraPages ? ` (uses Page 3${x.extraPages > 1 ? 'A and 3B' : 'A'})` : ''}`);
      $('#savNote').textContent = `Unrestricted funds made available for these purchases each month: ${money(x.E)}. Funds always reserved for Emergency Back Ups: ${money(x.EBU)}.`;
      // age from date of birth and effective date
      if (d.p_dob && d.eff_month && !d.age_manual) {
        const b = new Date(d.p_dob + 'T00:00:00'), e = new Date(d.eff_month + '-01T00:00:00');
        let a = e.getFullYear() - b.getFullYear(); if (e.getMonth() < b.getMonth() || (e.getMonth() === b.getMonth() && e.getDate() < b.getDate())) a--;
        const ag = document.querySelector('[name=age]'); if (ag && a >= 0 && String(a) !== ag.value) { ag.value = a; }
      }
    },
    setup(form, { refresh }) {
      $('[name=area]').innerHTML = opt(P.AREAS);
      // provider names for the services list
      const provs = savedProviders();
      $('#provList').innerHTML = [...new Set(provs.map(p => p.name))].map(n => `<option value="${esc(n)}">`).join('');
      const svcSel = opt(P.SERVICES.map(s => s[1]).filter(a => a !== 'CMS'), svcLabel);
      const savSel = opt(P.SAVINGS.map(s => s[1]), svcLabel);
      const typeSel = opt(['DHE', 'A/V', 'IC']);
      const relSel = r => String(r.type).toUpperCase() === 'DHE' ? opt(REL) : '<option value=""></option>';
      const prefill = (r, k) => {
        if (k !== 'prov') return false;
        const p = provs.find(p => p.name.toLowerCase() === String(r.prov).trim().toLowerCase());
        if (p && !r.type) { r.type = p.type; if (p.rel) r.rel = p.rel; if (p.type === 'DHE') r.unit = 'Hr.'; return true; }
        return false;
      };
      grids.needs = Grid('g_needs', 'tbl_needs', [
        { k: 'goal', h: 'Support Plan need / goal', area: 1, w: 180 }, { k: 'cps', h: 'Cost Plan service', w: 110 }, { k: 'months', h: '# months', num: 1, w: 55 },
        { k: 'units', h: 'Total units', num: 1, w: 60 }, { k: 'cpunit', h: 'CP unit', sel: opt(['Hour', 'QH', 'Day', 'Trip', 'Month', 'Unit', 'Mile']), w: 70 },
        { k: 'avg', h: 'Avg / month', calc: 1 }, { k: 'pps', h: 'Plan service', w: 90 }, { k: 'ppunits', h: 'Units / month', num: 1, w: 60 },
        { k: 'ppunit', h: 'PP unit', sel: opt(['Hr', 'Day', 'Trip', 'Item', 'Visit']), w: 65 }, { k: 'notes', h: 'Notes (OTE, STE, savings, natural support)', area: 1, w: 150 }],
        { max: 15 });
      grids.svc = Grid('g_svc', 'tbl_svc', [
        { k: 'abbr', h: 'Service', sel: svcSel, w: 120 }, { k: 'code', h: 'Code', calc: 1 }, { k: 'crit', h: 'Critical', sel: opt(['N', 'Y', 'EBU']), w: 74 },
        { k: 'prov', h: 'Provider legal name', list: 'provList', w: 170 }, { k: 'type', h: 'Type', sel: typeSel, w: 66 },
        { k: 'rel', h: 'DHE relationship', sel: relSel, w: 150 }, { k: 'units', h: '# units / month', num: 1, w: 62 },
        { k: 'unit', h: 'Unit', sel: opt(['Hr.', 'Day', 'Trip']), w: 62 }, { k: 'rate', h: 'Rate $', num: 1, w: 65 },
        { k: 'tax', h: 'Employer taxes', calc: 1 }, { k: 'total', h: 'Total cost', calc: 1 }, { k: 'added', h: 'EBU added cost', calc: 1 }],
        {
          max: 33, blank: () => ({ crit: 'N' }), rerenderOn: ['type', 'crit'],
          rowClass: r => String(r.crit).toUpperCase() === 'EBU' ? 'ebu' : String(r.crit).toUpperCase() === 'Y' ? 'crit' : '',
          extra: (r, i) => String(r.crit).toUpperCase() === 'Y' || String(r.crit).toUpperCase() === 'EBU' ? `<button type="button" class="sm" data-ebu="${i}" title="Add an emergency backup under this service">+ EBU</button>` : '',
          onEdit: (r, k, i, rows) => {
            let re = prefill(r, k);
            if (k === 'type' && String(r.type).toUpperCase() === 'DHE') { r.unit = 'Hr.'; re = true; }
            if (k === 'type' && String(r.type).toUpperCase() !== 'DHE' && r.rel) { r.rel = ''; re = true; }
            return re;
          },
          onButton: (b, rows) => {
            if (b.dataset.ebu == null) return false;
            let i = +b.dataset.ebu; while (i > 0 && String(rows[i].crit).toUpperCase() === 'EBU') i--;
            const prim = rows[i]; let k = i + 1; while (k < rows.length && String(rows[k].crit).toUpperCase() === 'EBU') k++;
            rows.splice(k, 0, { abbr: prim.abbr, crit: 'EBU', units: prim.units, unit: prim.unit });
          },
        });
      grids.sup = Grid('g_sup', 'tbl_sup', [
        { k: 'prov', h: 'Provider (as on Vendor Information Form)', list: 'provList', w: 170 }, { k: 'desc', h: 'Detailed description (item, package size)', area: 1, w: 220 },
        { k: 'units', h: '# units', num: 1, w: 55 }, { k: 'unit', h: 'Unit', ph: 'box, package…', w: 80 }, { k: 'rate', h: 'Rate $', num: 1, w: 65 }, { k: 'total', h: 'Total', calc: 1 }],
        { max: 15 });
      grids.cash = Grid('g_cash', 'tbl_cash', [
        { k: 'cat', h: 'Service', sel: savSel, w: 90 }, { k: 'desc', h: 'Detailed description of each item', area: 1, w: 230 },
        { k: 'units', h: '# units', num: 1, w: 55 }, { k: 'unit', h: 'Unit type', w: 70 }, { k: 'rate', h: 'Rate $', num: 1, w: 65 }, { k: 'total', h: 'Total', calc: 1 }],
        { max: 9 });
      grids.sav = Grid('g_sav', 'tbl_sav', [
        { k: 'abbr', h: 'Service', sel: savSel, w: 90 }, { k: 'desc', h: 'What exactly will be bought', w: 150 }, { k: 'prov', h: 'Provider', list: 'provList', w: 150 },
        { k: 'type', h: 'Type', sel: typeSel, w: 66 }, { k: 'rel', h: 'DHE rel.', sel: relSel, w: 110 }, { k: 'units', h: '# units', num: 1, w: 55 },
        { k: 'unit', h: 'Unit', sel: opt(['Day', 'Hr', 'Item', 'Trip', 'Visit']), w: 65 }, { k: 'rate', h: 'Rate $', num: 1, w: 65 }, { k: 'total', h: 'Est. total', calc: 1 },
        { k: 'last', h: 'Last date of purchase', t: 'date', w: 120 }, { k: 'actual', h: 'Actual date', t: 'date', w: 120 }],
        { max: 10, rerenderOn: ['type'], onEdit: (r, k) => { let re = prefill(r, k); if (k === 'type' && String(r.type).toUpperCase() === 'DHE') { r.unit = 'Hr'; re = true; } return re; } });
      grids.ote = Grid('g_ote', 'tbl_ote', [
        { k: 'kind', h: 'OTE / STE', sel: opt(['OTE', 'STE']), w: 62 },
        { k: 'abbr', h: 'Service', sel: r => opt((String(r.kind).toUpperCase() === 'OTE' ? P.OTE : P.STE).map(s => s[1]), svcLabel), w: 90 },
        { k: 'code', h: 'Code', calc: 1 }, { k: 'desc', h: 'Description (e.g. ramp at back door)', w: 150 }, { k: 'prov', h: 'Provider', list: 'provList', w: 150 },
        { k: 'type', h: 'Type', sel: r => opt(String(r.kind).toUpperCase() === 'OTE' ? ['A/V', 'IC'] : ['DHE', 'A/V', 'IC']), w: 66 }, { k: 'rel', h: 'DHE rel.', sel: relSel, w: 110 },
        { k: 'units', h: '# units', num: 1, w: 55 }, { k: 'unit', h: 'Unit', sel: opt(['Day', 'Hr', 'Item', 'Trip', 'Visit']), w: 65 }, { k: 'rate', h: 'Rate $', num: 1, w: 65 },
        { k: 'total', h: 'Total budget', calc: 1 }, { k: 'start', h: 'Start date', t: 'date', w: 120 }, { k: 'end', h: 'End date', t: 'date', w: 120 }],
        { max: 4, rerenderOn: ['kind', 'type'], onEdit: (r, k) => { let re = prefill(r, k); if (k === 'kind' && String(r.kind).toUpperCase() === 'OTE') { r.units = '1'; r.unit = 'Item'; re = true; } return re; } });

      // fill packet names from the saved packets of this participant
      const fillFrom = (key, field, nameOf) => {
        const p = [form.querySelector('[name=p_first]').value, form.querySelector('[name=p_last]').value].join(' ').trim().toLowerCase();
        let names = [];
        try { names = (JSON.parse(localStorage.getItem(key)) || { records: [] }).records.map(r => r.data || {}).filter(d => !p || [d.p_first, d.p_last].join(' ').trim().toLowerCase() === p).map(nameOf).filter(Boolean); } catch (e) {}
        const ta = form.querySelector(`[name=${field}]`); ta.value = [...new Set(ta.value.split('\n').map(s => s.trim()).filter(Boolean).concat(names))].join('\n'); refresh();
      };
      $('#fillEmp').onclick = () => fillFrom('cdcEmpPacketRecords.v1', 'pk_emp', d => [d.e_first, d.e_middle, d.e_last].filter(Boolean).join(' '));
      $('#fillVen').onclick = () => fillFrom('cdcPacketRecords.v1', 'pk_ven', d => d.v_name);
      form.querySelector('[name=age]').addEventListener('input', () => { /* typed by hand */ });
      // copy the whole plan into a new plan (for a Change or Update)
      $('#btnCopyPlan').onclick = () => {
        const all = {}; form.querySelectorAll('input,select,textarea').forEach(el => { if (!el.name || el.type === 'file') return; if (el.type === 'radio') { if (el.checked) all[el.name] = el.value; } else all[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
        delete all.revised_pages; all.reason = 'update';
        $('#btnNew').click();
        setTimeout(() => { form.querySelectorAll('input,select,textarea').forEach(el => { if (!el.name || !(el.name in all) || el.type === 'file') return; if (el.type === 'radio') el.checked = all[el.name] === el.value; else if (el.type === 'checkbox') el.checked = !!all[el.name]; else el.value = all[el.name]; }); refresh(); }, 50);
      };
    },
    mapHead: ['Your answer', 'Workbook page', 'Cells'],
    mapRows: [
      ['Effective date, budget, area, FFI', 'Page 1', 'K2, O2, S2, Yes/No boxes'], ['Participant name, CDC+ ID, age', 'Page 1', 'B6 / K6 / L6, Q6, X6'],
      ['Representative, phone, cell', 'Page 1', 'B9 / K9 / L9, Q9, S9'], ['Reason for submitting', 'Page 1', 'lines 1–11'],
      ['New Representative, cash change', 'Page 1', 'lines 12–14, Increase / Decrease / No change'], ['Provider packets, providers no longer used', 'Page 1', 'lines 15–21'],
      ['Total number of pages', 'Page 1', 'line 22 (6, 7 or 8 — automatic)'], ['Needs / Cost Plan / plan services', 'Page 2', 'Support Plan & Cost Plan dates, lines 1–15'],
      ['Services (with EBUs and EBU Added Cost)', 'Page 3 (+3A, 3B)', 'C.1 lines 1–11 per page; critical groups never split across pages'],
      ['Supplies', 'Page 3 (+3A, 3B)', 'C.2 lines 1–5 per page'], ['Cash; explanation of savings', 'Page 4', 'D lines 1–9; explanation box'],
      ['Statement, balance, unrestricted funds', 'Page 5', 'E header'], ['Savings items', 'Page 5', 'E lines 1–10 (line above reserved for EBUs)'],
      ['OTE / STE', 'Page 5', 'F lines 1–4'], ['Budget summary', 'Page 6', 'calculated; signatures left blank'],
    ],
  });
})();
