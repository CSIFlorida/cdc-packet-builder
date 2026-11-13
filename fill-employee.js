/* CDC+ Direct-Hire EMPLOYEE packet filler — maps one master record onto every employee form.
   Reuses the Good Moral Character and Direct Deposit fillers from fill.js (PacketFill). */
(function (root) {
  const up = s => String(s == null ? '' : s).trim();
  const digits = s => String(s || '').replace(/\D/g, '');
  const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };
  const fmtSSN = s => { const n = digits(s); return n.length === 9 ? `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}` : up(s); };
  const fmtPhone = s => { const n = digits(s); return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : up(s); };
  const cityLine = (c, s, z) => [up(c), [up(s), up(z)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  let L; // PDFLib

  function derive(d) {
    const participant = [up(d.p_first), up(d.p_last)].filter(Boolean).join(' ');
    const employee = [up(d.e_first), up(d.e_middle), up(d.e_last)].filter(Boolean).join(' ');
    const pAddr = [up(d.p_street), cityLine(d.p_city, d.p_state, d.p_zip)].filter(Boolean).join(', ');
    // Who signs for the employer: the participant, or "Rep Name for Participant Name"
    const signer = up(d.rep_name) ? `${up(d.rep_name)} for ${participant}` : participant;
    return {
      participant, employee, pAddr, signer,
      participantWithId: `${participant}${d.p_id ? ', CDC+ ID # ' + up(d.p_id) : ''}`,
      eCity: cityLine(d.e_city, d.e_state, d.e_zip),
      eStreetApt: [up(d.e_street), up(d.e_apt) ? 'Apt ' + up(d.e_apt) : ''].filter(Boolean).join(', '),
      signDate: d.fill_sign_date ? fmtDate(d.sign_date) : '',
      formDate: fmtDate(d.form_date),
      startDate: fmtDate(d.start_date),
    };
  }

  function applicability(d) {
    return {
      eif: 'required', w4: 'required', i9: 'required', gm: 'required', dd: 'required',
      chg: d.chg_on ? 'required (name/address change)' : 'only for a name/address change',
    };
  }

  /* ---------- low-level helpers ---------- */
  const H = () => L.StandardFontEmbedder.for(L.StandardFonts.Helvetica);
  function setText(form, name, val, size = 10) {
    try {
      const f = form.getTextField(name), str = up(val);
      const max = f.getMaxLength();
      f.setText(max && str.length > max ? str.slice(0, max) : str);
      const w = f.acroField.getWidgets()[0].getRectangle().width - 4;
      let sz = size;
      if (!f.isCombed() && str) while (sz > 6 && H().widthOfTextAtSize(str, sz) > w) sz -= 0.25;
      f.setFontSize(sz);
    } catch (e) { console.warn('field', name, e.message); }
  }
  function setCheck(form, name, on) {
    try {
      const c = form.getCheckBox(name), w = c.acroField.getWidgets()[0];
      const val = on ? (w.getOnValue() || L.PDFName.of('Yes')) : L.PDFName.of('Off');
      c.acroField.dict.set(L.PDFName.of('V'), val); w.dict.set(L.PDFName.of('AS'), val);
    } catch (e) { console.warn('check', name, e.message); }
  }
  function setSelect(form, name, val) {
    try { const dd = form.getDropdown(name); if (up(val) && dd.getOptions().includes(up(val).toUpperCase())) dd.select(up(val).toUpperCase()); } catch (e) { console.warn('select', name, e.message); }
  }
  function draw(page, font, str, x, y, maxW, size = 10) {
    str = up(str); if (!str) return;
    let s = size; while (maxW && s > 6 && font.widthOfTextAtSize(str, s) > maxW) s -= 0.25;
    page.drawText(str, { x, y, size: s, font, color: L.rgb(0, 0, 0) });
  }
  // Move a text box's bottom edge up so text sits clear of the printed line below it
  function lift(form, name, dy) {
    try { form.getTextField(name).acroField.getWidgets().forEach(w => { const r = w.getRectangle(); w.setRectangle({ x: r.x, y: r.y + dy, width: r.width, height: r.height - dy }); }); } catch (e) {}
  }
  // Forms that print "Phone: (     )": area code goes inside the printed parentheses, the rest after them
  function phoneParen(doc, form, font, field, open1, close0, close1, top, phone) {
    const n = digits(phone);
    if (n.length !== 10) { setText(form, field, phone); return; }
    const area = n.slice(0, 3), sz = 10, w = font.widthOfTextAtSize(area, sz);
    try {
      const f = form.getTextField(field), wd = f.acroField.getWidgets()[0], r = wd.getRectangle();
      if (r.x < close1 + 2) wd.setRectangle({ x: close1 + 2, y: r.y, width: r.x + r.width - close1 - 2, height: r.height });
    } catch (e) {}
    setText(form, field, `${n.slice(3, 6)}-${n.slice(6)}`);
    doc.getPage(0).drawText(area, { x: (open1 + close0) / 2 - w / 2, y: 792 - top, size: sz, font, color: L.rgb(0, 0, 0) });
  }
  async function open(bytes) {
    const doc = await L.PDFDocument.load(bytes, { ignoreEncryption: true });
    return { doc, form: doc.getForm(), font: await doc.embedFont(L.StandardFonts.Helvetica), bold: await doc.embedFont(L.StandardFonts.HelveticaBold) };
  }

  /* ---------- 1. Employee Information Form ---------- */
  async function fillEIF(bytes, d) {
    const v = derive(d), { doc, form, font } = await open(bytes);
    setText(form, 'Employer Participants Name', v.participant);
    setText(form, 'Participants CDC ID Number', d.p_id);
    setText(form, 'Date', v.formDate);
    setText(form, 'Last Name', d.e_last);
    setText(form, 'First Name', [up(d.e_first), up(d.e_middle)].filter(Boolean).join(' '));
    phoneParen(doc, form, font, 'Phone', 96.3, 133.8, 137.6, 199.5, d.e_phone);
    setText(form, 'Address', v.eStreetApt);
    setText(form, 'City', d.e_city);
    setText(form, 'State', up(d.e_state).toUpperCase());
    setText(form, 'Zip', d.e_zip);
    setText(form, 'SSN', fmtSSN(d.e_ssn));
    setText(form, 'Email Address', d.e_email);
    setText(form, 'DOB', fmtDate(d.e_dob));
    setText(form, 'Last Name_2', d.c_last);
    setText(form, 'First Name_2', d.c_first);
    phoneParen(doc, form, font, 'Phone_2', 96.3, 133.8, 137.6, 301, d.c_phone);
    setText(form, 'Relationship', d.c_rel);
    // Employee's relationship to employer (taxes) — check one
    const tax = { parent: 'Check Box1', child21: 'Check Box2', spouse: 'Check Box3', u18school: 'Check Box4', none: 'Check Box5' };
    Object.entries(tax).forEach(([k, n]) => setCheck(form, n, d.tax_rel === k));
    // Relationship for program reporting
    const rel = { None: 'Check Box9', Parent: 'Check Box10', Spouse: 'Check Box11', Child: 'Check Box12', Sibling: 'Check Box6', Grandparent: 'Check Box7', Grandchild: 'Check Box8' };
    Object.entries(rel).forEach(([k, n]) => setCheck(form, n, d.relationship === k));
    const yn = (val, yes, no) => { setCheck(form, yes, val === 'Yes'); setCheck(form, no, val === 'No'); };
    yn(d.live_in, 'Check Box13', 'Check Box14');
    yn(d.medicaid, 'Check Box15', 'Check Box16');
    yn(d.doh_license, 'Check Box17', 'Check Box18');
    yn(d.unemployed90, 'Check Box19', 'Check Box20');
    // Level 2 clearance letter attached (applies when No to 1 & 2, or Yes to 3)
    setCheck(form, 'Check Box21', d.medicaid === 'No' && d.doh_license === 'No');
    setCheck(form, 'Check Box22', d.unemployed90 === 'Yes');
    yn(d.statute, 'Check Box23', 'Check Box24');
    return doc;
  }

  /* ---------- 2. IRS Form W-4 (2026) ---------- */
  async function fillW4(bytes, d) {
    const v = derive(d), { doc, form, font, bold } = await open(bytes);
    const P = 'topmostSubform[0].Page1[0].';
    const S1 = P + 'Step1a[0].', S3 = P + 'Step3_ReadOrder[0].';
    ['f1_01[0]', 'f1_02[0]', 'f1_03[0]', 'f1_04[0]'].forEach(n => lift(form, S1 + n, 3));
    setText(form, S1 + 'f1_01[0]', [up(d.e_first), up(d.e_middle)].filter(Boolean).join(' '));
    setText(form, S1 + 'f1_02[0]', d.e_last);
    setText(form, S1 + 'f1_03[0]', v.eStreetApt);
    setText(form, S1 + 'f1_04[0]', v.eCity);
    setText(form, P + 'f1_05[0]', fmtSSN(d.e_ssn));
    const fs = { single: 0, mfj: 1, hoh: 2 }[d.w4_filing];
    for (let i = 0; i < 3; i++) setCheck(form, P + `c1_1[${i}]`, i === fs);
    setCheck(form, P + 'c1_2[0]', !!d.w4_2c);
    const money = x => { const n = parseFloat(String(x || '').replace(/[^\d.]/g, '')); return isNaN(n) || !n ? '' : n.toLocaleString('en-US', { maximumFractionDigits: 2 }); };
    const a = parseFloat(String(d.w4_3a || '').replace(/[^\d.]/g, '')) || 0, b = parseFloat(String(d.w4_3b || '').replace(/[^\d.]/g, '')) || 0;
    setText(form, S3 + 'f1_06[0]', money(d.w4_3a));
    setText(form, S3 + 'f1_07[0]', money(d.w4_3b));
    setText(form, P + 'f1_08[0]', a + b ? money(a + b) : '');
    setText(form, P + 'f1_09[0]', money(d.w4_4a));
    setText(form, P + 'f1_10[0]', money(d.w4_4b));
    setText(form, P + 'f1_11[0]', money(d.w4_4c));
    setCheck(form, P + 'c1_3[0]', !!d.w4_exempt);
    const pg = doc.getPage(0);
    if (d.w4_exempt) draw(pg, bold, 'EXEMPT', 513, 163, 60, 10); // APD: "Exempt" written below box 4(c)
    // Employer = CDC+ participant, with CDC+ ID
    const emp = form.getTextField(P + 'f1_12[0]');
    emp.enableMultiline();
    emp.setText([v.participantWithId, up(d.p_street), cityLine(d.p_city, d.p_state, d.p_zip)].filter(Boolean).join('\n'));
    emp.setFontSize(8);
    setText(form, P + 'f1_13[0]', v.startDate, 9);
    setText(form, P + 'f1_14[0]', d.p_ein, 9);
    if (v.signDate) draw(pg, font, v.signDate, 466, 792 - 699, 105, 10);
    return doc;
  }

  /* ---------- 3. Form I-9 (Edition 01/20/25) ---------- */
  async function fillI9(bytes, d) {
    const v = derive(d), { doc, form, bold } = await open(bytes);
    setText(form, 'Last Name (Family Name)', d.e_last);
    setText(form, 'First Name Given Name', d.e_first);
    setText(form, 'Employee Middle Initial (if any)', up(d.e_middle).slice(0, 1));
    setText(form, 'Employee Other Last Names Used (if any)', d.e_other_last || 'N/A');
    setText(form, 'Address Street Number and Name', d.e_street);
    setText(form, 'Apt Number (if any)', d.e_apt || 'N/A');
    setText(form, 'City or Town', d.e_city);
    setSelect(form, 'State', d.e_state);
    setText(form, 'ZIP Code', digits(d.e_zip).slice(0, 5));
    setText(form, 'Date of Birth mmddyyyy', fmtDate(d.e_dob));
    setText(form, 'US Social Security Number', digits(d.e_ssn));
    setText(form, 'Employees E-mail Address', d.e_email);
    setText(form, 'Telephone Number', fmtPhone(d.e_phone));
    ['CB_1', 'CB_2', 'CB_3', 'CB_4'].forEach((n, i) => setCheck(form, n, d.i9_status === String(i + 1)));
    setText(form, '3 A lawful permanent resident Enter USCIS or ANumber', d.i9_status === '3' ? d.i9_anum : '');
    setText(form, 'Exp Date mmddyyyy', d.i9_status === '4' ? fmtDate(d.i9_auth_exp) : '');
    setText(form, 'USCIS ANumber', d.i9_status === '4' ? digits(d.i9_anum4) : '');
    setText(form, 'Form I94 Admission Number', d.i9_status === '4' ? d.i9_i94 : '');
    setText(form, 'Foreign Passport Number and Country of IssuanceRow1', d.i9_status === '4' ? d.i9_passport : '');
    setText(form, "Today's Date mmddyyy", v.signDate);
    // Section 2 – documents examined by the employer
    if (d.i9_docs === 'A') {
      setText(form, 'Document Title 1', d.la_title); setText(form, 'Issuing Authority 1', d.la_auth);
      setText(form, 'Document Number 0 (if any)', d.la_no); setText(form, 'Expiration Date if any', fmtDate(d.la_exp) || d.la_exp_text);
    } else if (d.i9_docs === 'BC') {
      setText(form, 'List B Document 1 Title', d.lb_title); setText(form, 'List B Issuing Authority 1', d.lb_auth);
      setText(form, 'List B Document Number 1', d.lb_no); setText(form, 'List B Expiration Date 1', fmtDate(d.lb_exp) || d.lb_exp_text);
      setText(form, 'List C Document Title 1', d.lc_title); setText(form, 'List C Issuing Authority 1', d.lc_auth);
      setText(form, 'List C Document Number 1', d.lc_no); setText(form, 'List C Expiration Date 1', fmtDate(d.lc_exp) || d.lc_exp_text);
    }
    setText(form, 'FirstDayEmployed mmddyyyy', v.startDate);
    // APD: print participant (or "Rep for Participant"); title "Household Employer"
    const nm = up(d.rep_name) ? v.signer : [up(d.p_last), up(d.p_first)].filter(Boolean).join(', ');
    setText(form, 'Last Name First Name and Title of Employer or Authorized Representative', `${nm} – Household Employer`);
    setText(form, 'S2 Todays Date mmddyyyy', v.signDate);
    setText(form, 'Employers Business or Org Name', v.participant);
    setText(form, 'Employers Business or Org Address', v.pAddr);
    // APD: consumer LAST NAME + CDC+ ID in the bottom margin
    draw(doc.getPage(0), bold, `CDC+ Consumer: ${up(d.p_last).toUpperCase()}   CDC+ ID # ${up(d.p_id)}`, 36, 12, 400, 9);
    return doc;
  }

  /* ---------- Change of Name/Address (only when there is a change) ---------- */
  async function fillChange(bytes, d) {
    const v = derive(d), { doc, form, font } = await open(bytes);
    setText(form, 'Employer Participants Name', v.participant);
    setText(form, 'Participants CDC ID Number', d.p_id);
    setText(form, 'Date', v.formDate);
    // CURRENT (OLD) information
    setText(form, 'Last Name', d.o_last || d.e_last);
    setText(form, 'First Name', d.o_first || d.e_first);
    phoneParen(doc, form, font, 'Phone', 120.3, 145.1, 148.1, 403, d.o_phone || d.e_phone);
    setText(form, 'Address', d.o_street);
    setText(form, 'City', d.o_city);
    setText(form, 'State', up(d.o_state).toUpperCase());
    setText(form, 'Zip', d.o_zip);
    setText(form, 'DOB', fmtDate(d.e_dob));
    setText(form, 'Email Address', d.o_email || d.e_email);
    setText(form, 'Employee SSN', fmtSSN(d.e_ssn));
    // NEW information
    setText(form, 'Last Name_2', d.e_last);
    setText(form, 'First Name_2', d.e_first);
    phoneParen(doc, form, font, 'Phone_2', 120.3, 142.9, 145.9, 562.5, d.e_phone);
    setText(form, 'Address_2', v.eStreetApt);
    setText(form, 'City_2', d.e_city);
    setText(form, 'State_2', up(d.e_state).toUpperCase());
    setText(form, 'Zip_2', d.e_zip);
    setText(form, 'DOB_2', fmtDate(d.e_dob));
    setText(form, 'Email Address_2', d.e_email);
    setCheck(form, 'Yes', d.chg_livein === 'Yes');
    setCheck(form, 'No', d.chg_livein === 'No');
    return doc;
  }

  /* Good Moral + Direct Deposit: reuse the vendor-packet fillers with employee data */
  function asVendor(d) {
    return Object.assign({}, d, {
      v_name: [up(d.e_first), up(d.e_middle), up(d.e_last)].filter(Boolean).join(' '),
      v_business: '', v_email: d.e_email, prov_type: 'EMP',
      dd_for: 'Employee', gm_title: d.gm_title || 'Employee',
    });
  }

  const DOCS = [
    { key: 'eif', title: 'Employee Information Form', file: 'Employee-Information-Form', fn: fillEIF },
    { key: 'w4', title: 'IRS Form W-4 (2026)', file: 'W-4', fn: fillW4 },
    { key: 'i9', title: 'Form I-9 (Employment Eligibility)', file: 'I-9', fn: fillI9 },
    { key: 'gm', title: 'Certification of Good Moral Character', file: 'Good-Moral-Character', vendor: true },
    { key: 'dd', title: 'Direct Deposit Request (EFT)', file: 'Direct-Deposit', vendor: true },
    { key: 'chg', title: 'Change of Name/Address', file: 'Change-of-Name-Address', fn: fillChange },
  ];

  async function finish(doc, flatten) {
    const form = doc.getForm();
    form.updateFieldAppearances(await doc.embedFont(L.StandardFonts.Helvetica));
    if (flatten) {
      // Some widgets (I-9) ship appearance streams without /Subtype /Form; fix them so flattening stays valid
      const N = n => L.PDFName.of(n);
      const fixStream = s => { if (s && s.dict && !s.dict.get(N('Subtype'))) { s.dict.set(N('Type'), N('XObject')); s.dict.set(N('Subtype'), N('Form')); if (!s.dict.get(N('BBox'))) s.dict.set(N('BBox'), doc.context.obj([0, 0, 1, 1])); } };
      form.getFields().forEach(f => f.acroField.getWidgets().forEach(w => {
        const ap = w.dict.lookup(N('AP')); if (!ap) return;
        [N('N'), N('D'), N('R')].forEach(k => {
          const e = ap.lookup(k); if (!e) return;
          if (e.dict) fixStream(e); else if (e.entries) e.entries().forEach(([, v]) => fixStream(doc.context.lookup(v)));
        });
      }));
      // The I-9 is a tagged PDF; its structure tree points at the widgets that flattening removes.
      // Drop the tags in the flattened (print) copy so the file stays valid.
      doc.catalog.delete(N('StructTreeRoot'));
      doc.getPages().forEach(p => p.node.delete(N('StructParents')));
      form.getFields().forEach(f => { if (f.constructor.name === 'PDFSignature') { try { form.removeField(f); } catch (e) {} } });
      form.flatten();
      // Remove page annotation references left pointing at deleted widgets
      doc.getPages().forEach(p => {
        const annots = p.node.Annots(); if (!annots) return;
        for (let i = annots.size() - 1; i >= 0; i--) {
          const ref = annots.get(i);
          if (ref instanceof L.PDFRef && !doc.context.lookup(ref)) annots.remove(i);
        }
      });
    }
    return doc;
  }

  async function buildOne(PDFLib, key, tpl, d, flatten) {
    L = PDFLib;
    const spec = DOCS.find(x => x.key === key);
    if (spec.vendor) return root.PacketFill.buildOne(PDFLib, key, tpl, asVendor(d), flatten);
    return finish(await spec.fn(tpl[key], d), flatten);
  }

  /* Packet in APD order: EIF, W-4, I-9, background letter, Good Moral, Direct Deposit, voided check, (Change form) */
  async function buildPacket(PDFLib, tpl, d, selected, att) {
    L = PDFLib;
    const out = await PDFLib.PDFDocument.create();
    const add = async key => {
      if (!selected.includes(key)) return;
      const doc = await buildOne(PDFLib, key, tpl, d, true);
      const src = await PDFLib.PDFDocument.load(await doc.save());
      (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
    };
    await add('chg');
    await add('eif'); await add('w4'); await add('i9');
    await root.PacketFill.embedAttachment(PDFLib, out, att && att.bg);
    await add('gm'); await add('dd');
    await root.PacketFill.embedAttachment(PDFLib, out, att && att.check);
    return out;
  }

  const api = { DOCS, derive, applicability, buildOne, buildPacket };
  if (typeof module !== 'undefined') module.exports = api; else root.EmpFill = api;
})(typeof window !== 'undefined' ? window : globalThis);
