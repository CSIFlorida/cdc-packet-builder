/* CDC+ PURCHASING PLAN (APD Version 3.0-C) — calculations + filling APD's Excel workbook.
   The workbook keeps all of APD's formulas, drop-downs and print layout; this file also stores the calculated
   results in each formula cell so the plan reads correctly in any viewer, and replaces the Excel
   "Click Here to Compute EBU Added Cost" macro with the same rule from the Purchasing Plan Instructions. */
(function (root) {
  const TAX = 0.1115; // StaticValues_EmployerTaxRate
  const SERVICES = [['02', 'ADT'], ['06', 'BT'], ['08', 'BTS'], ['63', 'CMS'], ['11', 'COMP'], ['55', 'EMP'], ['88', 'GYM'], ['22', 'IHS'], ['51', 'MHT'], ['29', 'OT'], ['65', 'OTC'], ['32', 'PCA'], ['49', 'PDL'], ['50', 'PDR'], ['33', 'PERS'], ['38', 'PT'], ['43', 'RHAB'], ['58', 'RSPD'], ['46', 'RSPH'], ['45', 'RT'], ['56', 'SLC'], ['47', 'SNL'], ['48', 'SNR'], ['53', 'ST'], ['60', 'TRAN'], ['39', 'XTHER'], ['61', 'TRNG']];
  const SAVINGS = [['02', 'ADT'], ['03', 'DENT'], ['06', 'BT'], ['06A', 'BTA'], ['08', 'BTS'], ['11', 'COMP'], ['12', 'DIET'], ['14', 'ENV'], ['14A', 'ENVA'], ['22', 'IHS'], ['29', 'OT'], ['29A', 'OTA'], ['32', 'PCA'], ['33', 'PERS'], ['33A', 'PERSI'], ['38', 'PT'], ['38A', 'PTA'], ['39', 'XTHER'], ['43', 'RHAB'], ['45', 'RT'], ['45A', 'RTA'], ['46', 'RSPH'], ['47', 'SNL'], ['48', 'SNR'], ['49', 'PDL'], ['50', 'PDR'], ['51', 'MHT'], ['53', 'ST'], ['53A', 'STA'], ['55', 'EMP'], ['56', 'SLC'], ['58', 'RSPD'], ['60', 'TRAN'], ['61', 'TRNG'], ['63', 'CMS'], ['65', 'OTC'], ['70F', 'VEH'], ['75F', 'MICRO'], ['80', 'VMOD'], ['82', 'PARTS'], ['83', 'DME'], ['85', 'CAMP'], ['87', 'MED'], ['88', 'GYM'], ['89', 'ADV']];
  const OTE = [['14', 'ENV'], ['83', 'DME'], ['80', 'VMOD']];
  const STE = [['02', 'ADT'], ['06', 'BT'], ['06A', 'BTA'], ['08', 'BTS'], ['11', 'COMP'], ['03', 'DENT'], ['12', 'DIET'], ['55', 'EMP'], ['14A', 'ENVA'], ['22', 'IHS'], ['87', 'MED'], ['51', 'MHT'], ['29', 'OT'], ['29A', 'OTA'], ['65', 'OTC'], ['82', 'PARTS'], ['32', 'PCA'], ['49', 'PDL'], ['50', 'PDR'], ['33A', 'PERSI'], ['38', 'PT'], ['38A', 'PTA'], ['43', 'RHAB'], ['58', 'RSPD'], ['46', 'RSPH'], ['45', 'RT'], ['45A', 'RTA'], ['56', 'SLC'], ['47', 'SNL'], ['48', 'SNR'], ['53', 'ST'], ['53A', 'STA'], ['60', 'TRAN'], ['39', 'XTHER']];
  const AREAS = ['1', '2A', '2B', '3', '4', '7', '8', '9', '10', '11', '12', '13', '14', '15', '23'];
  const NAMES = { ADT: 'Adult Day Training', BT: 'Behavior Analysis', BTA: 'Behavior Analysis – assessment', BTS: 'Behavior Assistant', CMS: 'Consumable Medical Supplies', COMP: 'Companion / Life Skills Development 1', DENT: 'Dental', DIET: 'Dietitian', DME: 'Durable Medical Equipment', EMP: 'Supported Employment / Life Skills Development 2', ENV: 'Environmental Accessibility Adaptations (home modifications)', ENVA: 'Home modification assessment', IHS: 'In-Home Supports', OT: 'Occupational Therapy', OTA: 'Occupational Therapy – assessment', PCA: 'Personal Care Assistance / Personal Supports', PDL: 'Private Duty Nursing – LPN', PDR: 'Private Duty Nursing – RN', PERS: 'Personal Emergency Response System', PERSI: 'PERS installation', PT: 'Physical Therapy', PTA: 'Physical Therapy – assessment', RHAB: 'Residential Habilitation', RSPD: 'Respite – by the day', RSPH: 'Respite – by the hour', RT: 'Respiratory Therapy', RTA: 'Respiratory Therapy – assessment', SLC: 'Supported Living Coaching', SNL: 'Skilled Nursing – LPN', SNR: 'Skilled Nursing – RN', ST: 'Speech Therapy', STA: 'Speech Therapy – assessment', TRAN: 'Transportation', VMOD: 'Vehicle Modifications', MICRO: 'Microenterprise (FFI only)', VEH: 'Vehicle (FFI only)' };
  const codeOf = (list, abbr) => { const r = list.find(x => x[1] === String(abbr || '').toUpperCase()); return r ? r[0] : ''; };
  const num = x => { const n = parseFloat(String(x == null ? '' : x).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; };
  const round2 = x => (x < 0 ? -1 : 1) * Math.round((Math.abs(x) + 1e-9) * 100) / 100; // Excel ROUND (half away from zero)
  const parseJ = s => { try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  const blank = r => !Object.values(r || {}).some(v => String(v == null ? '' : v).trim());
  const tables = d => ({
    needs: parseJ(d.tbl_needs).filter(r => !blank(r)), svc: parseJ(d.tbl_svc).filter(r => !blank(r)), sup: parseJ(d.tbl_sup).filter(r => !blank(r)),
    cash: parseJ(d.tbl_cash).filter(r => !blank(r)), sav: parseJ(d.tbl_sav).filter(r => !blank(r)), ote: parseJ(d.tbl_ote).filter(r => !blank(r)),
  });
  const costLine = r => {
    const sub = round2(num(r.units) * num(r.rate));
    const tax = (String(r.type).toUpperCase() === 'DHE' && String(r.rel) === '5') ? round2(sub * TAX) : 0;
    return { sub, tax, total: round2(sub + tax) };
  };

  /* Split services into the three APD pages (11 lines each), never separating a critical service from its EBUs */
  function paginate(svc) {
    const groups = [];
    svc.forEach(r => { const c = String(r.crit || '').toUpperCase(); if (c === 'EBU' && groups.length) groups[groups.length - 1].push(r); else groups.push([r]); });
    const pages = [[]];
    for (const g of groups) {
      if (g.length > 11) { pages[pages.length - 1].push(...g); continue; }
      if (pages[pages.length - 1].length + g.length > 11) pages.push([]);
      pages[pages.length - 1].push(...g);
    }
    return pages;
  }
  /* EBU Added Cost (instructions, Page 3 item 14): for each critical group, if the highest EBU total cost is more
     than the primary provider's total cost, the difference goes on that EBU's row (first one if tied). */
  function ebuAdded(page) {
    const added = page.map(() => 0);
    for (let i = 0; i < page.length; i++) {
      if (String(page[i].crit).toUpperCase() !== 'Y') continue;
      const prim = costLine(page[i]).total; let best = -1, bestCost = -Infinity;
      for (let j = i + 1; j < page.length && String(page[j].crit).toUpperCase() === 'EBU'; j++) {
        const t = costLine(page[j]).total; if (t > bestCost) { bestCost = t; best = j; }
      }
      if (best >= 0 && bestCost > prim) added[best] = round2(bestCost - prim);
    }
    return added;
  }

  function compute(d) {
    const t = tables(d);
    const svcPages = paginate(t.svc);
    const supPages = [t.sup.slice(0, 5), t.sup.slice(5, 10), t.sup.slice(10, 15)];
    let C1 = 0, C2 = 0, EBU = 0;
    const svcCalc = svcPages.map(pg => {
      const add = ebuAdded(pg);
      return pg.map((r, i) => {
        const c = costLine(r), crit = String(r.crit || '').toUpperCase();
        const monthly = (crit === 'Y' || crit === 'N') ? c.total : 0;
        C1 += monthly; EBU += add[i];
        return Object.assign({}, r, c, { monthly, added: add[i], code: codeOf(SERVICES, r.abbr) });
      });
    });
    const supCalc = supPages.map(pg => pg.map(r => { const total = round2(num(r.units) * num(r.rate)); C2 += total; return Object.assign({}, r, { total, code: '63' }); }));
    let D = 0; const cashCalc = t.cash.slice(0, 9).map(r => { const total = round2(num(r.units) * num(r.rate)); D += total; return Object.assign({}, r, { total, code: codeOf(SAVINGS, r.cat) }); });
    const savCalc = t.sav.slice(0, 10).map(r => Object.assign({}, r, costLine(r)));
    const oteCalc = t.ote.slice(0, 4).map(r => Object.assign({}, r, costLine(r), { code: codeOf(String(r.kind).toUpperCase() === 'OTE' ? OTE : STE, r.abbr) }));
    const budget = num(d.budget);
    C1 = round2(C1); C2 = round2(C2); D = round2(D); EBU = round2(EBU);
    const C = round2(C1 + C2), E = round2(budget - C - D);
    const extraPages = Math.min(2, Math.max(svcPages.length, Math.ceil(t.sup.length / 5) || 1) - 1);
    return { t, svcPages, svcCalc, supCalc, cashCalc, savCalc, oteCalc, budget, C1, C2, C, D, E, EBU, totalPages: 6 + extraPages, extraPages };
  }

  /* Rule checks from the Purchasing Plan Instructions */
  function check(d) {
    const out = [], x = compute(d);
    x.t.svc.forEach((r, i) => {
      const n = `Services line ${i + 1}`, crit = String(r.crit || '').toUpperCase(), type = String(r.type || '').toUpperCase();
      if (!r.abbr) out.push(`${n}: choose the service`);
      if (!crit) out.push(`${n}: Critical must be Y, N or EBU — it cannot be blank`);
      if (!r.prov) out.push(`${n}: enter the provider's legal name`);
      if (!type) out.push(`${n}: choose the provider type`);
      if (type === 'DHE' && !r.rel) out.push(`${n}: enter the DHE's relationship to the participant (1–5)`);
      if (type === 'DHE' && r.unit && r.unit !== 'Hr.') out.push(`${n}: directly hired employees are always paid by the hour (Hr.)`);
      if (!num(r.units) || !num(r.rate)) out.push(`${n}: enter # of units and rate`);
      if (crit === 'EBU' && (i === 0 || !['Y', 'EBU'].includes(String(x.t.svc[i - 1].crit || '').toUpperCase()))) out.push(`${n}: an EBU must be listed directly under its critical (Y) service`);
      if (crit === 'Y') {
        let k = i + 1, cnt = 0; while (k < x.t.svc.length && String(x.t.svc[k].crit || '').toUpperCase() === 'EBU') { const e = x.t.svc[k]; cnt++;
          if (num(e.units) !== num(r.units)) out.push(`${n}: EBU “${e.prov || 'line ' + (k + 1)}” must plan the same # of units as the primary provider (a full month)`);
          if (e.unit !== r.unit && !(r.unit === 'Day' && String(r.type).toUpperCase() === 'A/V' && String(e.type).toUpperCase() === 'DHE' && e.unit === 'Hr.')) out.push(`${n}: EBU “${e.prov || 'line ' + (k + 1)}” must use the same unit type as the primary provider`);
          k++; }
        if (cnt < 2) out.push(`${n}: a critical service needs at least 2 emergency backups (EBU) listed right under it`);
      }
    });
    if (x.svcPages.length > 3) out.push('Too many service lines: the plan has room for 3 pages of 11 lines (Page 3, 3A and 3B)');
    x.t.sup.forEach((r, i) => { if (!r.prov || !r.desc || !num(r.units) || !num(r.rate)) out.push(`Supplies line ${i + 1}: enter provider, detailed description (item and package size), # of units and rate`); });
    if (x.t.sup.length > 15) out.push('Too many supply lines (15 maximum)');
    if (x.t.cash.length > 9) out.push('Too many cash lines (9 maximum)');
    x.t.sav.forEach((r, i) => {
      const n = `Savings line ${i + 1}`;
      if (!r.abbr || !r.desc) out.push(`${n}: give the service abbreviation and a specific description (e.g. EQUIP – hoyer lift)`);
      if (!r.prov) out.push(`${n}: enter the provider (add “Consumer/Rep Reimbursement” if you will pay and be reimbursed)`);
      if (String(r.type).toUpperCase() === 'DHE' && !r.rel) out.push(`${n}: enter the DHE's relationship (1–5)`);
      if (r.last) { const dt = new Date(r.last + 'T00:00:00'), nx = new Date(dt); nx.setDate(dt.getDate() + 1); if (nx.getDate() !== 1) out.push(`${n}: “Last date purchase will be made” must be the last day of a month`); }
      else out.push(`${n}: enter the last date the purchase will be made`);
    });
    if (x.t.sav.length > 10) out.push('Too many savings lines (10 maximum)');
    x.t.ote.forEach((r, i) => {
      const n = `OTE/STE line ${i + 1}`, k = String(r.kind || '').toUpperCase();
      if (!k) out.push(`${n}: choose OTE or STE`);
      if (k && !codeOf(k === 'OTE' ? OTE : STE, r.abbr)) out.push(`${n}: ${k === 'OTE' ? 'OTEs can only be ENV, DME or VMOD' : 'choose a valid STE service'}`);
      if (!r.start || !r.end) out.push(`${n}: enter start and end dates`);
      if (k === 'OTE' && num(r.units) !== 1) out.push(`${n}: an OTE (equipment or modification) is entered as 1 unit`);
    });
    if (x.t.ote.length > 4) out.push('Too many OTE/STE lines (4 maximum)');
    if (x.E < 0) out.push(`The amount going to Savings each month is negative (${x.E.toFixed(2)}): services, supplies and cash cost more than the monthly budget`);
    return { out, x };
  }

  /* ---------- Excel writing (ExcelJS) ---------- */
  const P3 = ['Page 3', 'Page 3A - Additional C1-C2', 'Page 3B - Additional C1-C2'];
  const asDate = iso => { if (!iso) return null; const [y, m, dd] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd)); };
  function setV(ws, addr, v) { if (v === undefined || v === null || v === '') return; ws.getCell(addr).value = v; }
  function setRes(ws, addr, result) {
    const c = ws.getCell(addr);
    if (c.formula) c.value = { formula: c.formula, result };
    else if (c.value && typeof c.value === 'object' && c.value.sharedFormula) c.value = Object.assign({}, c.value, { result });
  }

  async function buildWorkbook(ExcelJS, tplBytes, d) {
    const x = compute(d);
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(tplBytes);
    wb.calcProperties = Object.assign({}, wb.calcProperties, { fullCalcOnLoad: true });
    const ws = n => wb.getWorksheet(n);
    const title = 'CONSUMER-DIRECTED CARE PLUS Purchasing Plan  (Version 3.0-C)';
    const first = String(d.p_first || '').trim(), last = String(d.p_last || '').trim(), eff = asDate(d.eff_month ? d.eff_month + '-01' : d.eff_date);
    const X = on => on ? 'X' : undefined;

    /* Page 1 */
    const p1 = ws('Page 1');
    setRes(p1, 'B1', title);
    setV(p1, 'K2', eff); setV(p1, 'O2', num(d.budget) || undefined); setV(p1, 'S2', d.area ? (isNaN(+d.area) ? d.area : +d.area) : undefined);
    setV(p1, 'U3', X(d.ffi === 'Yes')); setV(p1, 'W3', X(d.ffi === 'No'));
    setV(p1, 'B6', first); setV(p1, 'K6', d.p_mi); setV(p1, 'L6', last);
    setV(p1, 'Q6', /^\d+$/.test(String(d.p_id || '').trim()) ? +d.p_id : d.p_id); setV(p1, 'X6', num(d.age) || undefined);
    if (d.has_rep) { setV(p1, 'B9', d.r_first); setV(p1, 'K9', d.r_mi); setV(p1, 'L9', d.r_last); }
    setV(p1, 'Q9', d.pp_phone); setV(p1, 'S9', d.pp_cell);
    // Reason for submitting
    if (d.reason === 'new') {
      setV(p1, 'C15', 'X'); setV(p1, 'E17', X(d.baf));
      if (num(d.new_budget_changed)) { setV(p1, 'E19', 'X'); setV(p1, 'L19', num(d.new_budget_changed)); setV(p1, 'O19', X(d.new_budget_due === 'spcp')); setV(p1, 'Q19', X(d.new_budget_due === 'recalc')); }
      if (num(d.new_ote)) { setV(p1, 'E21', 'X'); setV(p1, 'P21', num(d.new_ote)); }
      if (num(d.new_ste)) { setV(p1, 'E23', 'X'); setV(p1, 'P23', num(d.new_ste)); }
    } else if (d.reason === 'change') {
      setV(p1, 'C25', 'X');
      if (num(d.chg_budget)) { setV(p1, 'E27', 'X'); setV(p1, 'K27', num(d.chg_budget)); }
      if (num(d.chg_ote)) { setV(p1, 'E29', 'X'); setV(p1, 'P29', num(d.chg_ote)); }
      if (num(d.chg_ste)) { setV(p1, 'E31', 'X'); setV(p1, 'P31', num(d.chg_ste)); }
    } else if (d.reason === 'update') setV(p1, 'C33', 'X');
    if (String(d.revised_pages || '').trim() && d.reason !== 'new') { setV(p1, 'E35', 'X'); setV(p1, 'K35', d.revised_pages); }
    if (d.newrep) {
      setV(p1, 'C37', 'X'); setV(p1, 'K37', asDate(d.newrep_date)); setV(p1, 'M37', X(d.newrep_piu));
      setV(p1, 'E39', X(d.newrep_was_emp)); setV(p1, 'E41', X(d.oldrep_now_emp));
    }
    setV(p1, 'T41', X(d.cash_change === 'increase')); setV(p1, 'W41', X(d.cash_change === 'decrease')); setV(p1, 'W43', X(d.cash_change === 'none'));
    const lines = s => String(s || '').split(/\n|;/).map(v => v.trim()).filter(Boolean);
    const emp = lines(d.pk_emp), ven = lines(d.pk_ven), gone = lines(d.gone);
    if (emp.length || ven.length) {
      setV(p1, 'C43', 'X');
      if (emp.length) { setV(p1, 'E45', emp.length); setV(p1, 'J45', emp.join(', ')); }
      if (ven.length) { setV(p1, 'E47', ven.length); setV(p1, 'J47', ven.join(', ')); }
    }
    if (gone.length) { setV(p1, 'C49', 'X'); ['E51', 'E52', 'E53'].forEach((a, i) => p1.getCell(a).value = gone[i] || (i < 3 ? p1.getCell(a).value : '')); if (gone.length > 3) p1.getCell('E53').value = gone.slice(2).join(', '); }
    setV(p1, 'R51', d.pp_contact);
    setV(p1, 'C55', 'X'); setV(p1, 'K55', x.totalPages);

    /* headers on every page */
    const hdr = [['Page 2 - Needs', 'E1', 'H1', 'L1', 'B3'], ['Page 3', 'H1', 'K1', 'O1', 'B3'], [P3[1], 'H1', 'K1', 'O1', 'B3'], [P3[2], 'H1', 'K1', 'O1', 'B3'],
      ['Page 4', 'H1', 'J1', 'N1', 'B3'], ['Page 5', 'J1', 'M1', 'Q1', 'B3'], ['Page 6', 'F1', 'H1', 'O1', 'A3']];
    hdr.forEach(([n, a, b, c, t]) => { const s = ws(n); setRes(s, a, first); setRes(s, b, last); setRes(s, c, eff || ''); setRes(s, t, title); });

    /* Page 2 – Needs */
    const p2 = ws('Page 2 - Needs');
    setV(p2, 'C8', asDate(d.sp_date) || undefined); setV(p2, 'G8', d.cp_date ? (/^\d{4}-\d{2}-\d{2}$/.test(d.cp_date) ? asDate(d.cp_date) : d.cp_date) : undefined);
    x.t.needs.slice(0, 15).forEach((r, i) => {
      const n = 10 + i;
      setV(p2, 'B' + n, r.goal); setV(p2, 'D' + n, r.cps); setV(p2, 'E' + n, num(r.months) || undefined); setV(p2, 'F' + n, num(r.units) || undefined);
      setV(p2, 'G' + n, r.cpunit); setV(p2, 'I' + n, r.pps); setV(p2, 'J' + n, num(r.ppunits) || undefined); setV(p2, 'K' + n, r.ppunit); setV(p2, 'L' + n, r.notes);
      setRes(p2, 'H' + n, num(r.months) ? round2(num(r.units) / num(r.months)) : '');
    });
    for (let n = 10 + Math.min(15, x.t.needs.length); n <= 24; n++) setRes(p2, 'H' + n, '');

    /* Pages 3 / 3A / 3B – services and supplies */
    P3.forEach((name, pi) => {
      const s = ws(name), rows = x.svcCalc[pi] || [], sup = x.supCalc[pi] || [];
      let tot = 0, totE = 0, totS = 0;
      for (let i = 0; i < 11; i++) {
        const n = 7 + i, r = rows[i];
        if (r) {
          setV(s, 'B' + n, String(r.abbr).toUpperCase()); setV(s, 'E' + n, String(r.crit).toUpperCase()); setV(s, 'F' + n, r.prov);
          setV(s, 'G' + n, String(r.type).toUpperCase()); setV(s, 'H' + n, String(r.type).toUpperCase() === 'DHE' && r.rel ? +r.rel : undefined);
          setV(s, 'I' + n, num(r.units)); setV(s, 'J' + n, r.unit); setV(s, 'K' + n, num(r.rate));
          if (r.added) s.getCell('P' + n).value = r.added;
          setRes(s, 'D' + n, r.code || 'Error'); setRes(s, 'L' + n, r.sub); setRes(s, 'M' + n, r.tax); setRes(s, 'N' + n, r.total); setRes(s, 'O' + n, r.monthly);
          tot += r.monthly; totE += r.added;
        } else { setRes(s, 'D' + n, ''); setRes(s, 'L' + n, 0); setRes(s, 'M' + n, 0); setRes(s, 'N' + n, 0); setRes(s, 'O' + n, 0); }
      }
      setRes(s, 'O18', round2(tot)); setRes(s, 'P18', round2(totE));
      for (let i = 0; i < 5; i++) {
        const n = 21 + i, r = sup[i];
        if (r) { setV(s, 'B' + n, 'CMS'); setV(s, 'E' + n, r.prov); setV(s, 'G' + n, r.desc); setV(s, 'L' + n, num(r.units)); setV(s, 'M' + n, r.unit); setV(s, 'N' + n, num(r.rate)); setRes(s, 'D' + n, '63'); setRes(s, 'O' + n, r.total); totS += r.total; }
        else { setRes(s, 'D' + n, ''); setRes(s, 'O' + n, 0); }
      }
      setRes(s, 'O26', round2(totS));
      if (pi < 2 && x.extraPages > pi) setV(s, 'O27', 'X');   // "Check if you use 3A / 3B"
    });

    /* Page 4 – Cash */
    const p4 = ws('Page 4');
    for (let i = 0; i < 9; i++) {
      const n = 6 + i, r = x.cashCalc[i];
      if (r) { setV(p4, 'B' + n, r.cat); p4.getCell('C' + n).value = r.code || ''; setV(p4, 'D' + n, r.desc); setV(p4, 'K' + n, num(r.units)); setV(p4, 'L' + n, r.unit); setV(p4, 'M' + n, num(r.rate)); setRes(p4, 'N' + n, r.total); }
      else { setRes(p4, 'C' + n, ''); setRes(p4, 'N' + n, 0); }
    }
    setRes(p4, 'N15', x.D);
    setV(p4, 'B18', d.explain);

    /* Page 5 – Savings (E) and OTE/STE (F) */
    const p5 = ws('Page 5');
    setV(p5, 'F5', d.st_date ? asDate(d.st_date.length === 7 ? d.st_date + '-01' : d.st_date) : undefined);
    if (d.st_balance !== '' && d.st_balance != null) setV(p5, 'H5', num(d.st_balance));
    if (d.unrestricted !== '' && d.unrestricted != null) setV(p5, 'N5', num(d.unrestricted));
    setRes(p5, 'R5', x.E); setRes(p5, 'P7', x.EBU);
    for (let i = 0; i < 10; i++) {
      const n = 8 + i, r = x.savCalc[i];
      if (r) {
        setV(p5, 'B' + n, [String(r.abbr || '').toUpperCase(), r.desc].filter(Boolean).join(' – ')); setV(p5, 'E' + n, codeOf(SAVINGS, r.abbr));
        setV(p5, 'F' + n, r.prov); setV(p5, 'I' + n, String(r.type || '').toUpperCase()); setV(p5, 'J' + n, String(r.type).toUpperCase() === 'DHE' && r.rel ? +r.rel : undefined);
        setV(p5, 'K' + n, num(r.units)); setV(p5, 'L' + n, r.unit); setV(p5, 'M' + n, num(r.rate)); setV(p5, 'Q' + n, asDate(r.last)); setV(p5, 'R' + n, asDate(r.actual));
        setRes(p5, 'N' + n, r.sub); setRes(p5, 'O' + n, r.tax); setRes(p5, 'P' + n, r.total);
      } else { setRes(p5, 'N' + n, 0); setRes(p5, 'O' + n, 0); setRes(p5, 'P' + n, 0); }
    }
    for (let i = 0; i < 4; i++) {
      const n = 20 + i, r = x.oteCalc[i];
      if (r) {
        setV(p5, 'B' + n, String(r.kind).toUpperCase());
        setV(p5, 'C' + n, [String(r.abbr || '').toUpperCase(), r.desc].filter(Boolean).join(' – '));
        p5.getCell('E' + n).value = r.code || '';                  // code written directly (description sits beside the abbreviation)
        setV(p5, 'F' + n, r.prov); setV(p5, 'I' + n, String(r.type || '').toUpperCase()); setV(p5, 'J' + n, String(r.type).toUpperCase() === 'DHE' && r.rel ? +r.rel : undefined);
        setV(p5, 'K' + n, num(r.units)); setV(p5, 'L' + n, r.unit); setV(p5, 'M' + n, num(r.rate)); setV(p5, 'Q' + n, asDate(r.start)); setV(p5, 'R' + n, asDate(r.end));
        setRes(p5, 'N' + n, r.sub); setRes(p5, 'O' + n, r.tax); setRes(p5, 'P' + n, r.total);
      } else { setRes(p5, 'E' + n, ''); setRes(p5, 'N' + n, 0); setRes(p5, 'O' + n, 0); setRes(p5, 'P' + n, 0); }
    }

    /* Page 6 – Budget summary */
    const p6 = ws('Page 6');
    setRes(p6, 'K8', x.budget); setRes(p6, 'F10', x.C); setRes(p6, 'F11', x.D); setRes(p6, 'F12', x.E); setRes(p6, 'K13', round2(x.C + x.D + x.E));

    // Hide Page 3A / 3B when they are not used, so printing the workbook gives exactly the pages to submit
    if (x.extraPages < 2) ws(P3[2]).state = 'hidden';
    if (x.extraPages < 1) ws(P3[1]).state = 'hidden';
    // ExcelJS reads "fit to one page" as off: restore one printed page per sheet, landscape
    wb.worksheets.forEach(s => { if (/^Page/.test(s.name)) { s.pageSetup.fitToPage = true; s.pageSetup.fitToWidth = 1; s.pageSetup.fitToHeight = 1; s.pageSetup.orientation = 'landscape'; } });
    return wb;
  }

  const DOCS = [{ key: 'pp', title: 'Purchasing Plan (APD Excel, Version 3.0-C)', file: 'Purchasing-Plan' }];
  function applicability() { return { pp: 'required' }; }
  async function buildOne(_PDFLib, key, tpl, d) {
    const wb = await buildWorkbook(root.ExcelJS, tpl.pp, d);
    return { save: async () => new Uint8Array(await wb.xlsx.writeBuffer()) };
  }
  const buildPacket = (PDFLib, tpl, d) => buildOne(PDFLib, 'pp', tpl, d);

  const api = { DOCS, applicability, buildOne, buildPacket, buildWorkbook, compute, check, paginate, SERVICES, SAVINGS, OTE, STE, AREAS, NAMES, codeOf, num, round2 };
  if (typeof module !== 'undefined') module.exports = api; else root.PPFill = api;
})(typeof window !== 'undefined' ? window : globalThis);
