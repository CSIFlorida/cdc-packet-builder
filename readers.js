/* Reads APD / CDC+ PDFs (text-based, not scans) and turns them into Consumer Database fields.
   Supported: Budget Authorization Form (BAF), Fiscal Year Cost Plan (iBudget), CDC+ Monthly Statement. */
(function (root) {
  const T = s => String(s || '').replace(/\s+/g, ' ').trim();
  const title = s => T(s).toLowerCase().replace(/(^|[\s\-'(/])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Ii|Iii|Iv)\b/g, m => m.toUpperCase()).replace(/\bMc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase()).replace(/\bCdc\+/g, 'CDC+').replace(/\bApd\b/g, 'APD');
  const money = s => { const n = parseFloat(String(s || '').replace(/[^\d.-]/g, '')); return isNaN(n) ? '' : n.toFixed(2); };
  const iso = s => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return ''; let y = +m[3]; if (y < 100) y += 2000; return `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`; };
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const splitName = s => { const p = T(s).split(' ').filter(Boolean); if (!p.length) return ['', '']; if (p.length === 1) return [title(p[0]), '']; return [title(p[0]), title(p.slice(1).join(' '))]; };

  /* text items with positions (top-left origin), per page */
  async function extract(pdfjs, bytes) {
    const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
      pages.push(tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: vp.height - i.transform[5], p })));
    }
    return pages;
  }
  const allText = pages => pages.map(items => lines(items).map(l => l.map(i => i.s).join(' ')).join('\n')).join('\n');
  function lines(items, tol = 4) {
    const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x), out = [];
    for (const it of sorted) { const l = out[out.length - 1]; if (l && Math.abs(l[0].y - it.y) <= tol) l.push(it); else out.push([it]); }
    return out.map(l => l.sort((a, b) => a.x - b.x));
  }
  // value to the right of a label on (about) the same line
  function rightOf(items, label, { maxDx = 400, tol = 5, stopX, exact } = {}) {
    const L = items.find(i => exact ? T(i.s).toLowerCase() === label.toLowerCase() : T(i.s).toLowerCase().startsWith(label.toLowerCase())); if (!L) return '';
    const rest = T(L.s).slice(label.length).replace(/^[:\s_]+/, '').replace(/_+$/, '').trim();
    const cand = items.filter(i => i !== L && Math.abs(i.y - L.y) <= tol && i.x > L.x && i.x - L.x < maxDx && (!stopX || i.x < stopX)).sort((a, b) => a.x - b.x);
    return T([rest].concat(cand.map(c => c.s)).join(' ')).replace(/_+/g, '').trim();
  }
  // Recognize a document by its printed title (a whole text item near the top of page 1), not by words in its body
  function detect(text, pages) {
    const p1 = (pages && pages[0]) || [];
    const titleItem = re => p1.some(i => i.y < 140 && re.test(T(i.s)));
    const hasItem = re => p1.some(i => re.test(T(i.s)));
    if (titleItem(/^Budget Authorization Form$/i) && hasItem(/^Participant Name/i)) return 'baf';
    if (titleItem(/^Fiscal Year Cost Plan$/i) && hasItem(/^Total Allocated Amount$/i)) return 'costplan';
    if (titleItem(/^Monthly Statement$/i) && hasItem(/^Ending Balance:?$/i) && hasItem(/^Consumer ID$/i)) return 'statement';
    if (titleItem(/^Budget Calculation Worksheet/i)) return 'bcw';
    return '';
  }

  /* ---------- Budget Authorization Form ---------- */
  function readBAF(pages) {
    const it = pages[0], f = {}, info = [];
    const name = rightOf(it, 'Participant Name', { stopX: 340 });
    const id = rightOf(it, 'Participant ID');
    const rep = rightOf(it, 'Representative Name', { stopX: 440 });
    const cons = rightOf(it, 'Consultant Name', { stopX: 440 });
    const agency = rightOf(it, 'Consultant Agency', { stopX: 340 });
    const budget = rightOf(it, 'Monthly Budget');
    const start = rightOf(it, 'Anticipated CDC+ Program Start Date', { stopX: 340 });
    const sent = rightOf(it, 'BAF sent out by CDC+ State Office');
    // county and APD area are printed (without labels) at the right of the Representative / Consultant lines
    const L = (lab) => it.find(i => T(i.s).startsWith(lab));
    const near = (lab) => { const l = L(lab); return l ? it.filter(i => Math.abs(i.y - l.y) <= 6 && i.x > 440).map(i => T(i.s)).join(' ') : ''; };
    const county = near('Representative Name'), area = near('Consultant Name');
    if (name) [f.p_first, f.p_last] = splitName(name);
    if (id) f.p_id = id.replace(/\D/g, '');
    if (rep) { f.has_rep = true; [f.r_first, f.r_last] = splitName(rep); }
    if (cons) [f.c_first, f.c_last] = splitName(cons);
    if (agency) f.c_agency = title(agency).replace(/\bInc\b/, 'Inc');
    if (budget) f.budget = money(budget);
    if (start) { f.cdc_start = iso(start); if (f.cdc_start) f.budget_month = f.cdc_start.slice(0, 7); }
    if (county && /^[A-Za-z .-]+$/.test(county)) f.p_county = title(county);
    if (/^(1|2A|2B|3|4|7|8|9|10|11|12|13|14|15|23)$/i.test(area)) f.area = area.toUpperCase();
    if (sent) info.push(`BAF sent by the CDC+ State Office on ${sent}`);
    return { kind: 'baf', label: 'Budget Authorization Form', fields: f, info };
  }

  /* ---------- Fiscal Year Cost Plan ---------- */
  function readCostPlan(pages) {
    const f = {}, info = [], p1 = pages[0];
    const val = lab => rightOf(p1, lab, { maxDx: 400, exact: true });
    const name = val('Consumer Name'), fy = val('Fiscal Year'), alloc = val('Total Allocated Amount'), budgeted = val('Total Budgeted'), bal = val('Total Balance'), eff = val('Effective Date');
    if (name) [f.p_first, f.p_last] = splitName(name);
    if (alloc) f.cp_annual = money(alloc);
    const fyN = parseInt(fy, 10);
    if (fyN) { f.cp_from = `${fyN - 1}-07-01`; f.cp_to = `${fyN}-06-30`; }
    if (eff && iso(eff)) f.cp_eff = iso(eff);
    info.push(`Fiscal year ${fy || '?'} · allocated $${money(alloc) || '?'} · budgeted $${money(budgeted) || '?'} · balance $${money(bal) || '?'}`);
    // service lines: columns found from the header row of each page
    const rows = [];
    let bounds = null, cur = null;
    pages.forEach(items => {
      const hdr = items.find(i => /^Procedure/.test(T(i.s)));
      let top = 0;
      if (hdr) {
        const col = lab => { const h = items.find(i => T(i.s) === lab && Math.abs(i.y - hdr.y) < 20); return h ? h.x : null; };
        const X = { svc: col('Service'), status: col('Cost Plan') ?? col('Status'), prov: col('Provider'), begin: col('Begin'), end: col('End'), rate: col('Rate'), units: col('Units'), amt: col('Amounts'), notes: col('Notes') };
        if (X.svc != null && X.units != null) {
          // values sit a little left of their (centred) column headings
          bounds = [['code', -1], ['svc', X.svc - 30], ['status', X.status - 14], ['prov', X.prov - 30], ['begin', X.begin - 4], ['end', X.end - 4], ['rate', X.rate - 20], ['units', X.units - 30], ['amt', X.amt - 4], ['notes', X.notes - 45]].sort((a, b) => a[1] - b[1]);
          top = hdr.y + 10;
        }
      }
      if (!bounds) return;                                   // pages after the first reuse the same columns
      const colOf = x => { let c = bounds[0][0]; for (const [k, b] of bounds) if (x >= b) c = k; return c; };
      const body = items.filter(i => i.y > top && !/^(Page \d|Date Printed)/.test(T(i.s))).sort((a, b) => a.y - b.y || a.x - b.x);
      for (const i of body) {
        const c = colOf(i.x);
        if (c === 'code' && /^[A-Z]\d{4}/.test(T(i.s))) { cur = { code: '', svc: '', status: '', prov: '', begin: '', end: '', rate: '', units: '', amt: '', notes: '' }; rows.push(cur); }
        if (!cur) continue;
        cur[c] = T(cur[c] + ' ' + i.s);
      }
    });
    const months = (b, e) => { const B = new Date(iso(b)), E = new Date(iso(e)); if (isNaN(B) || isNaN(E)) return ''; return Math.max(1, Math.round((E - B) / (1000 * 60 * 60 * 24 * 30.44))); };
    f.tbl_cps = rows.map(r => {
      const units = parseFloat(r.units.replace(/[^\d.]/g, '')) || '', m = months(r.begin, r.end);
      const svc = T(r.svc).replace(/\s*-\s*$/, '');
      let unit = 'Unit';
      const notes = r.notes.toLowerCase(), per = units && m ? units / m : 0, hm = notes.match(/(\d+(?:\.\d+)?)\s*hours?\s*(?:of service\s*)?(?:a|per)\s*month/);
      if (/trip/i.test(svc) || /trips/.test(notes)) unit = 'Trip';
      else if (/consultant|support coordination/i.test(svc) || /service per month/.test(notes)) unit = 'Month';
      else if (/per diem|daily|\bday\b/i.test(svc)) unit = 'Day';
      else if (hm && per) unit = Math.abs(per - 4 * hm[1]) < Math.abs(per - hm[1]) ? 'QH' : 'Hour';
      else if (/\bqh\b|quarter hour/.test(notes)) unit = 'QH';
      const terminated = /terminated/i.test(r.notes);
      return { svc: `${svc}${r.code ? ' [' + r.code.split(' ')[0] + ']' : ''}`, months: String(m), units: String(units), unit, amount: money(r.amt), kind: '',
        note: `${r.begin}–${r.end}${r.rate ? ' · rate ' + T(r.rate) : ''}${r.prov ? ' · ' + title(r.prov) : ''}${terminated ? ' · TERMINATED' : ''}` };
    });
    return { kind: 'costplan', label: 'Cost Plan', fields: f, info };
  }

  /* ---------- CDC+ Monthly Statement ---------- */
  function readStatement(pages) {
    const it = pages[0], f = {}, info = [];
    const head = it.find(i => /Monthly Statement/i.test(i.s));
    const monthItem = it.find(i => new RegExp(`^(${MONTHS.join('|')})\\s+\\d{4}$`, 'i').test(T(i.s)));
    if (monthItem) { const [mn, yr] = T(monthItem.s).split(' '); f.st_date = `${yr}-${String(MONTHS.indexOf(mn.toLowerCase()) + 1).padStart(2, '0')}`; }
    const id = rightOf(it, 'Consumer ID', { maxDx: 150 }); if (id) f.p_id = id.replace(/\D/g, '');
    const ending = rightOf(it, 'Ending Balance'), beginning = rightOf(it, 'Beginning Balance');
    if (ending) f.st_balance = money(ending);
    // representative / consultant names may wrap onto two lines
    const block = lab => { const l = it.find(i => T(i.s).startsWith(lab)); if (!l) return ''; return it.filter(i => i.x > l.x + 30 && i.y >= l.y - 4 && i.y <= l.y + 16).sort((a, b) => a.y - b.y || a.x - b.x).map(i => i.s).join(' '); };
    const rep = block('Representative:'), cons = block('Consultant:');
    if (T(rep)) { f.has_rep = true; [f.r_first, f.r_last] = splitName(rep); }
    if (T(cons)) [f.c_first, f.c_last] = splitName(cons);
    // name and address block under the Consumer ID, left column
    const idL = it.find(i => T(i.s).startsWith('Consumer ID'));
    if (idL) {
      const addr = lines(it.filter(i => i.x < 260 && i.y > idL.y + 20 && i.y < idL.y + 110));
      const L = addr.map(l => T(l.map(i => i.s).join(' '))).filter(Boolean);
      if (L[0]) [f.p_first, f.p_last] = splitName(L[0]);
      if (L[1]) f.p_street = title(L[1]).replace(/\b(Nw|Ne|Sw|Se)\b/g, m => m.toUpperCase());
      const cz = L.slice(2).join(' ').match(/^(.*?)\s+([A-Z]{2})\s+(\d{5})(-\d{4})?$/);
      if (cz) { f.p_city = title(cz[1]); f.p_state = cz[2]; f.p_zip = cz[3]; }
    }
    info.push(`Statement ${monthItem ? T(monthItem.s) : ''}: beginning balance $${money(beginning) || '?'} · ending balance $${money(ending) || '?'}`);
    return { kind: 'statement', label: 'CDC+ Monthly Statement', fields: f, info };
  }

  async function read(pdfjs, bytes) {
    const pages = await extract(pdfjs, bytes);
    const text = allText(pages);
    if (text.replace(/\s/g, '').length < 40) return { kind: '', error: 'This PDF has no readable text (it is probably a scan). Please type the figures in.' };
    const kind = detect(text, pages);
    if (kind === 'baf') return readBAF(pages);
    if (kind === 'costplan') return readCostPlan(pages);
    if (kind === 'statement') return readStatement(pages);
    if (kind === 'bcw') return { kind, error: 'Budget Calculation Worksheet recognized, but no sample was provided yet to learn its layout — please send one.' };
    return { kind: '', error: 'This document was not recognized (supported: Budget Authorization Form, Cost Plan, CDC+ Monthly Statement).' };
  }

  const LABELS = { p_first: 'First name', p_last: 'Last name', p_id: 'CDC+ ID #', has_rep: 'Has a CDC+ Representative', r_first: 'Representative first name', r_last: 'Representative last name',
    c_first: 'Consultant first name', c_last: 'Consultant last name', c_agency: 'Consultant agency', budget: 'Monthly budget ($)', cdc_start: 'Anticipated CDC+ start date', budget_month: 'Budget effective month',
    p_county: 'County', area: 'APD Area', cp_annual: 'Annual Cost Plan amount ($)', cp_from: 'Cost Plan from', cp_to: 'Cost Plan to', cp_eff: 'Cost Plan effective date',
    st_date: 'Statement month', st_balance: 'Statement (ending) balance ($)', p_street: 'Street address', p_city: 'City', p_state: 'State', p_zip: 'ZIP', tbl_cps: 'Approved Cost Plan services' };
  const api = { read, extract, detect, readBAF, readCostPlan, readStatement, LABELS, allText };
  if (typeof module !== 'undefined') module.exports = api; else root.DocReader = api;
})(typeof window !== 'undefined' ? window : globalThis);
