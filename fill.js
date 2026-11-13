/* CDC+ Vendor / IC packet filler — maps one master record onto every form. */
(function (root) {
  const digits = s => String(s || '').replace(/\D/g, '');
  const up = s => String(s || '').trim();
  const fmtDate = iso => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${m}/${d}/${y}`;
  };
  const fmtTin = d => {
    const n = digits(d.tin);
    if (!n) return '';
    return d.tin_type === 'EIN' ? `${n.slice(0, 2)}-${n.slice(2)}` : `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`;
  };
  const cityLine = (c, s, z) => [up(c), [up(s), up(z)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const pName = d => [up(d.p_first), up(d.p_last)].filter(Boolean).join(' ');

  /* Derived values shared by all forms */
  function derive(d) {
    const isIC = d.prov_type === 'IC';
    let w9class = d.w9_class;
    if (!w9class || w9class === 'auto') {
      if (isIC) w9class = 'individual';
      else if (d.av_entity === 'corporation') w9class = 'ccorp';
      else if (d.av_entity === 'partnership') w9class = 'partnership';
      else if (d.av_entity === 'llc') w9class = 'llc';
      else w9class = 'individual';
    }
    return {
      isIC,
      w9class,
      participant: pName(d),
      participantWithId: `${pName(d)}${d.p_id ? ', CDC+ ID # ' + up(d.p_id) : ''}`,
      pAddr1: up(d.p_street),
      pAddr2: cityLine(d.p_city, d.p_state, d.p_zip),
      vAddr1: up(d.v_street),
      vAddr2: cityLine(d.v_city, d.v_state, d.v_zip),
      signDate: d.fill_sign_date ? fmtDate(d.sign_date) : '',
      formDate: fmtDate(d.form_date),
      tinFmt: fmtTin(d),
    };
  }

  /* Which documents apply for this provider */
  function applicability(d) {
    const isIC = d.prov_type === 'IC';
    const corp = !isIC && d.av_entity === 'corporation';
    return {
      vendor: 'required',
      w9: corp ? 'not needed (corporation)' : 'required',
      gm: isIC ? 'required' : 'optional for agencies',
      dd: 'required',
    };
  }

  async function prep(PDFLib, bytes) {
    const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    return { doc, font, bold };
  }

  function text(page, font, str, x, y, maxW, size = 10) {
    str = up(str);
    if (!str) return;
    let s = size;
    while (maxW && s > 6 && font.widthOfTextAtSize(str, s) > maxW) s -= 0.25;
    page.drawText(str, { x, y, size: s, font, color: PDFLib_rgb(0, 0, 0) });
  }
  let PDFLib_rgb, PDFLib_ref;

  function xbox(page, font, left, top, w, h) {
    // left/top in "top-origin" coordinates measured on the page
    const size = Math.min(w, h) * 0.95;
    const tw = font.widthOfTextAtSize('X', size);
    page.drawText('X', { x: left + (w - tw) / 2, y: 792 - top - h + (h - size * 0.72) / 2, size, font, color: PDFLib_rgb(0, 0, 0) });
  }

  function setText(form, name, val, size = 10) {
    try {
      const f = form.getTextField(name), str = up(val) || '';
      f.setText(str);
      if (size) {
        // shrink long entries so they fit the box instead of being cut off
        const w = f.acroField.getWidgets()[0].getRectangle().width - 4;
        const H = PDFLib_ref.StandardFontEmbedder.for(PDFLib_ref.StandardFonts.Helvetica);
        let sz = size;
        if (!f.isCombed() && str) while (sz > 6 && H.widthOfTextAtSize(str, sz) > w) sz -= 0.25;
        f.setFontSize(sz);
      }
    } catch (e) { console.warn('field', name, e.message); }
  }
  // Move a text box's bottom edge up so its text is drawn clear of the line below
  function liftField(form, name, dy) {
    try {
      form.getTextField(name).acroField.getWidgets().forEach(w => {
        const r = w.getRectangle();
        w.setRectangle({ x: r.x, y: r.y + dy, width: r.width, height: r.height - dy });
      });
    } catch (e) { console.warn('lift', name, e.message); }
  }
  function setCheck(form, name, on) {
    // Set /V and /AS directly so the form's own (original) check-mark appearance is kept
    try {
      const c = form.getCheckBox(name);
      const N = PDFLib_ref.PDFName;
      const w = c.acroField.getWidgets()[0];
      const onVal = w.getOnValue() || N.of('Yes');
      const val = on ? onVal : N.of('Off');
      c.acroField.dict.set(N.of('V'), val);
      w.dict.set(N.of('AS'), val);
    } catch (e) { console.warn('check', name, e.message); }
  }

  /* ---------- 1. Vendor Information Form (flat PDF – overlay) ---------- */
  async function fillVendor(PDFLib, bytes, d) {
    const v = derive(d);
    const { doc, font, bold } = await prep(PDFLib, bytes);
    const pg = doc.getPage(0);
    const B = (l, t, w = 10.5, h = 11.2) => xbox(pg, bold, l, t, w, h);
    const LIFT = 3.5; // keeps typed text clearly above the printed underline
    const yb = top => 792 - top + LIFT; // baseline from top coordinate

    text(pg, font, v.participant, 150, yb(214.5), 132, 10);
    text(pg, font, d.p_id, 412, yb(214.5), 72, 10);
    text(pg, font, v.formDate, 517, yb(214.5), 52, 9);

    const vname = up(d.v_business) && up(d.v_business) !== up(d.v_name) ? `${up(d.v_name)} (${up(d.v_business)})` : up(d.v_name);
    text(pg, font, vname, 120, yb(240.5), 390, 10);
    text(pg, font, v.vAddr1, 92, yb(262.5), 418, 10);
    text(pg, font, v.vAddr2, 114, yb(283.5), 396, 10);
    text(pg, font, d.v_phone, 90, yb(305.5), 92, 9);
    text(pg, font, d.v_email, 215, yb(305.5), 122, 9);
    text(pg, font, v.tinFmt, 400, yb(305.5), 130, 9);

    // 1. provider type
    if (v.isIC) B(69.8, 412.2);
    else {
      B(69.0, 335.0, 10.5, 12);
      if (d.av_entity === 'corporation') B(95.2, 354.2);
      if (d.av_entity === 'llc') B(95.2, 373.2);
      if (d.av_entity === 'partnership') B(95.2, 392.7);
    }
    // 2. live-in
    if (d.live_in === 'Yes') B(317.2, 429.9); else if (d.live_in === 'No') B(356.2, 429.9);
    // 3. relationship
    const rel = { None: [273.8, 448.9], Parent: [324.8, 449.4], Spouse: [378.0, 448.9], Child: [70.5, 467.9], Sibling: [120.0, 467.8], Grandparent: [174.8, 468.1], Grandchild: [252.0, 468.2] }[d.relationship];
    if (rel) B(rel[0], rel[1]);
    // 4. Medicaid
    if (d.medicaid === 'Yes') B(261.0, 486.8); else if (d.medicaid === 'No') B(300.0, 486.8);
    if (d.medicaid === 'Yes') {
      const circ = (x0, x1) => pg.drawEllipse({ x: (x0 + x1) / 2, y: yb(512.5) - LIFT, xScale: (x1 - x0) / 2 + 4, yScale: 8, borderWidth: 0.9, borderColor: PDFLib_rgb(0, 0, 0) });
      if (d.mcd_apd) circ(275, 332);
      if (d.mcd_general) circ(346, 382);
    }
    if (d.doh_license === 'Yes') B(286.5, 544.4); else if (d.doh_license === 'No') B(329.2, 544.4);
    const mcdX = [166, 179, 193, 207, 220, 234, 248, 262, 276];
    const dohX = [366, 380, 394, 407, 421, 435, 449, 462, 476];
    if (up(d.medicaid_no)) {
      const s = String(d.medicaid_no).replace(/\s/g, '');
      if (s.length <= 9) s.split('').forEach((c, i) => text(pg, font, c, mcdX[i] + 2.5, yb(573), 0, 10));
      else text(pg, font, s, 166, yb(573), 120, 9);
    }
    if (up(d.doh_no)) {
      const s = String(d.doh_no).replace(/\s/g, '');
      if (s.length <= 9) s.split('').forEach((c, i) => text(pg, font, c, dohX[i] + 2.5, yb(573), 0, 10));
      else text(pg, font, s, 366, yb(573), 125, 9);
    }
    // 5. direct care
    if (d.direct_care === 'Yes') B(346.5, 581.9, 12, 12); else if (d.direct_care === 'No') B(387.8, 582.2);
    // 6. 402.3057
    if (d.statute === 'Yes') B(155.2, 637.8); else if (d.statute === 'No') B(204.8, 638.6);
    // 7. EVV (A/V only)
    if (!v.isIC) { if (d.evv === 'Yes') B(341.2, 677.3, 9, 9); else if (d.evv === 'No') B(392.2, 677.9, 9, 9); }
    return doc;
  }

  /* ---------- 2. IRS W-9 (Rev. March 2024) ---------- */
  async function fillW9(PDFLib, bytes, d) {
    const v = derive(d);
    const { doc, font, bold } = await prep(PDFLib, bytes);
    // Drop the XFA layer so viewers show the AcroForm values we set
    try { doc.catalog.lookup(PDFLib.PDFName.of('AcroForm')).delete(PDFLib.PDFName.of('XFA')); } catch (e) {}
    const form = doc.getForm();
    const P = 'topmostSubform[0].Page1[0].';
    const BX = P + 'Boxes3a-b_ReadOrder[0].';
    [P + 'f1_01[0]', P + 'f1_02[0]', P + 'Address_ReadOrder[0].f1_07[0]', P + 'Address_ReadOrder[0].f1_08[0]', P + 'f1_10[0]',
     BX + 'f1_04[0]'].forEach(n => liftField(form, n, 3));
    setText(form, P + 'f1_01[0]', d.v_name);
    setText(form, P + 'f1_02[0]', up(d.v_business) !== up(d.v_name) ? d.v_business : '');
    const idx = { individual: 0, ccorp: 1, scorp: 2, partnership: 3, trust: 4, llc: 5, other: 6 }[v.w9class];
    for (let i = 0; i < 7; i++) setCheck(form, BX + `c1_1[${i}]`, i === idx);
    setText(form, BX + 'f1_03[0]', v.w9class === 'llc' ? up(d.llc_code).toUpperCase() : '');
    setText(form, BX + 'f1_04[0]', v.w9class === 'other' ? d.other_class : '');
    // Line 3b, exempt payee code and FATCA code are not collected: always left blank
    setCheck(form, BX + 'c1_2[0]', false);
    setText(form, P + 'f1_05[0]', '');
    setText(form, P + 'f1_06[0]', '');
    setText(form, P + 'Address_ReadOrder[0].f1_07[0]', v.vAddr1);
    setText(form, P + 'Address_ReadOrder[0].f1_08[0]', v.vAddr2);
    // Requester = CDC+ consumer (participant)
    const req = form.getTextField(P + 'f1_09[0]');
    req.enableMultiline();
    req.setText([v.participantWithId, v.pAddr1, v.pAddr2].filter(Boolean).join('\n'));
    req.setFontSize(8);
    setText(form, P + 'f1_10[0]', ''); // line 7 (account numbers) left blank
    const n = digits(d.tin);
    if (d.tin_type === 'EIN') {
      setText(form, P + 'f1_14[0]', n.slice(0, 2)); setText(form, P + 'f1_15[0]', n.slice(2, 9));
      ['f1_11[0]', 'f1_12[0]', 'f1_13[0]'].forEach(f => setText(form, P + f, ''));
    } else {
      setText(form, P + 'f1_11[0]', n.slice(0, 3)); setText(form, P + 'f1_12[0]', n.slice(3, 5)); setText(form, P + 'f1_13[0]', n.slice(5, 9));
      ['f1_14[0]', 'f1_15[0]'].forEach(f => setText(form, P + f, ''));
    }
    const pg = doc.getPage(0);
    if (v.signDate) text(pg, font, v.signDate, 406, 792 - 597, 120, 10);
    // Required by APD: consumer LAST NAME + CDC+ ID in bottom margin
    const margin = `CDC+ Consumer: ${up(d.p_last).toUpperCase()}   CDC+ ID # ${up(d.p_id)}`;
    text(pg, bold, margin, 36, 14, 400, 9);
    return doc;
  }

  /* ---------- 4. Certification of Good Moral Character ---------- */
  async function fillGM(PDFLib, bytes, d) {
    const v = derive(d);
    const { doc, font } = await prep(PDFLib, bytes);
    const form = doc.getForm();
    setText(form, 'EmployeeContractor Name', d.v_name, 9);
    setText(form, 'Health Care Provider Employer Name', v.participantWithId, 9);
    setText(form, 'Address of Health Care Provider', [v.pAddr1, v.pAddr2].filter(Boolean).join(', '), 9);
    setText(form, 'Under penalty of perjury I', d.v_name);
    const title = d.gm_title || (v.isIC ? 'Independent Contractor' : '');
    if (d.gm_disclosure) {
      setText(form, 'undefined_5', title); setText(form, 'undefined_6', v.signDate);
    } else {
      setText(form, 'undefined_2', title); setText(form, 'undefined_3', v.signDate);
    }
    setText(form, 'Purpose of Prior Screening', d.prior_purpose);
    setText(form, 'Date of Prior Screening', fmtDate(d.prior_date), 9);
    const agencies = { AHCA: [72, 327.5], APD: [72, 339.5], DFS: [72, 351.5], DOH: [288, 327.5], DOEA: [288, 339.5], DCF: [288, 351.5] };
    const ag = agencies[d.prior_by];
    if (ag) { const b = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold); xbox(doc.getPage(3), b, ag[0] + 0.5, ag[1] + 1.5, 8, 8); }
    return doc;
  }

  /* ---------- 5. Direct Deposit / EFT ---------- */
  async function fillDD(PDFLib, bytes, d) {
    const v = derive(d);
    const { doc, font } = await prep(PDFLib, bytes);
    const form = doc.getForm();
    const who = d.dd_for || (v.isIC ? 'Independent Contractor' : 'Vendor');
    setCheck(form, 'ConsRep', who === 'ConsRep');
    setCheck(form, 'Employee', who === 'Employee');
    setCheck(form, 'Independent Contractor', who === 'Independent Contractor');
    setCheck(form, 'Vendor', who === 'Vendor');
    setText(form, 'EmployerParticipant Name and CDC ID Number', v.participantWithId);
    // The form's field "...Direct Deposit 2" is actually the box on the Email line
    const ddName = up(d.v_business) && up(d.v_business) !== up(d.v_name) ? `${up(d.v_name)} (${up(d.v_business)})` : up(d.v_name);
    setText(form, 'Name of IndividualBusiness requesting Direct Deposit 1', ddName);
    setText(form, 'Name of IndividualBusiness requesting Direct Deposit 2', d.v_email);
    setCheck(form, 'Checking', d.acct_type === 'Checking');
    setCheck(form, 'Savings', d.acct_type === 'Savings');
    setText(form, 'Bank Name', d.bank_name);
    const r = digits(d.routing);
    const rf = ['Bank Routing Number 9 digits', 'undefined', 'undefined_2', 'undefined_3', 'undefined_4', 'undefined_5', 'undefined_6', 'undefined_7', 'undefined_8'];
    rf.forEach((f, i) => setText(form, f, r[i] || '', 12));
    setText(form, 'Bank Account Number', d.account);
    setCheck(form, 'Voided check Not a deposit slip', d.dd_attach !== 'letter');
    setCheck(form, 'Bank letter or specification sheet See your bank representative', d.dd_attach === 'letter');
    setText(form, 'Date', v.signDate);
    return doc;
  }

  async function finish(PDFLib, doc, flatten) {
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    const form = doc.getForm();
    if (form.getFields().length) {
      form.updateFieldAppearances(font);
      if (flatten) {
        // keep signature lines; drop the empty /Sig widgets so flatten doesn't choke
        form.getFields().forEach(f => { if (f.constructor.name === 'PDFSignature') { try { form.removeField(f); } catch (e) {} } });
        form.flatten();
      }
    }
    return doc;
  }

  const DOCS = [
    { key: 'vendor', title: 'Vendor Information Form', file: 'Vendor-Information-Form', fn: fillVendor },
    { key: 'w9', title: 'IRS Form W-9', file: 'W-9', fn: fillW9 },
    { key: 'gm', title: 'Certification of Good Moral Character', file: 'Good-Moral-Character', fn: fillGM },
    { key: 'dd', title: 'Direct Deposit Request (EFT)', file: 'Direct-Deposit', fn: fillDD },
  ];

  async function buildOne(PDFLib, key, tpl, d, flatten) {
    PDFLib_rgb = PDFLib.rgb; PDFLib_ref = PDFLib;
    const spec = DOCS.find(x => x.key === key);
    const doc = await spec.fn(PDFLib, tpl[key], d);
    await finish(PDFLib, doc, flatten);
    return doc;
  }

  async function embedAttachment(PDFLib, out, att) {
    if (!att || !att.bytes) return;
    const t = (att.type || '').toLowerCase();
    if (t.includes('pdf')) {
      const src = await PDFLib.PDFDocument.load(att.bytes, { ignoreEncryption: true });
      (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
    } else {
      const img = t.includes('png') ? await out.embedPng(att.bytes) : await out.embedJpg(att.bytes);
      const page = out.addPage([612, 792]);
      const s = Math.min(540 / img.width, 720 / img.height, 1.5);
      page.drawImage(img, { x: (612 - img.width * s) / 2, y: 792 - 36 - img.height * s, width: img.width * s, height: img.height * s });
    }
  }

  /* Full packet in APD submission order */
  async function buildPacket(PDFLib, tpl, d, selected, att) {
    PDFLib_rgb = PDFLib.rgb; PDFLib_ref = PDFLib;
    const out = await PDFLib.PDFDocument.create();
    const add = async key => {
      if (!selected.includes(key)) return;
      const doc = await buildOne(PDFLib, key, tpl, d, true);
      const src = await PDFLib.PDFDocument.load(await doc.save());
      (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
    };
    await add('vendor');
    await add('w9');
    await embedAttachment(PDFLib, out, att && att.bg);
    await add('gm');
    await add('dd');
    await embedAttachment(PDFLib, out, att && att.check);
    return out;
  }

  const api = { DOCS, derive, applicability, buildOne, buildPacket, fmtDate };
  if (typeof module !== 'undefined') module.exports = api; else root.PacketFill = api;
})(this);
