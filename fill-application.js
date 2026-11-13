/* CDC+ PARTICIPANT APPLICATION & ENROLLMENT filler.
   Application packet (APD, fillable): Application, Participant/Consultant Agreement, Representative Agreement,
   Emergency Back-up Plan.  Enrollment packet (flat/scanned, text placed by position): Informed Consent F/EA,
   IRS 2678, IRS 8821, Program Consent.  Plus New Participant Training Affirmation and Direct Deposit (Cons/Rep).
   The consultant-interview pages of the Application Packet are intentionally not used. */
(function (root) {
  const up = s => String(s == null ? '' : s).trim();
  const U = s => up(s).toUpperCase();
  const digits = s => String(s || '').replace(/\D/g, '');
  const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };
  const cityLine = (c, s, z) => [up(c), [up(s), up(z)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const fmtPhone = s => { const n = digits(s); return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : up(s); };
  let L;

  // Application packet page indexes (0-based) – interview pages (4-6) are skipped on purpose
  const APP_PAGES = { app: [2, 3], pca: [7, 8, 9], rep: [10, 11], ebu: [12] };
  // enrollment_forms.pdf: 0 Informed Consent F/EA, 1-2 IRS 2678, 3 IRS 8821, 4-8 Program Consent
  const ENR_PAGES = { fea: [0], f2678: [1, 2], f8821: [3], consent: [4, 5, 6, 7, 8] };

  function derive(d) {
    const participant = [up(d.p_first), up(d.p_mi), up(d.p_last)].filter(Boolean).join(' ');
    const guardian = [up(d.g_first), up(d.g_mi), up(d.g_last)].filter(Boolean).join(' ');
    const rep = [up(d.r_first), up(d.r_mi), up(d.r_last)].filter(Boolean).join(' ');
    const competent = d.legal_status === 'competent' || !d.legal_status;
    // APD: application/enrollment forms are signed by the consumer, or the parent / legal guardian / legal representative
    const signer = competent ? participant : (guardian || '');
    const reason = d.legal_status === 'minor_parent' || d.legal_status === 'minor_guardian' ? 'minor' : d.legal_status === 'adult_legal_rep' ? 'has guardian' : '';
    const irsPrint = competent ? U(participant) : `${U(signer)} for ${U(participant)} / ${reason}`;
    const yr = +((d.sign_date || '').slice(0, 4)) || new Date().getFullYear();
    return {
      participant, guardian, rep, competent, signer, irsPrint,
      pStreet: [up(d.p_street), up(d.p_street2)].filter(Boolean).join(', '),
      pCity: cityLine(d.p_city, d.p_state || 'FL', d.p_zip),
      signDate: d.fill_sign_date ? fmtDate(d.sign_date) : '',
      years: `${yr}, ${yr + 1}, ${yr + 2}`,
      pid: up(d.p_id) || up(d.p_medicaid),
      phone: fmtPhone(d.irs_phone || (competent ? d.p_phone : d.g_phone) || d.p_phone),
    };
  }

  function applicability(d) {
    return {
      app: 'required', pca: 'required',
      rep: d.has_rep ? 'required (CDC+ Representative)' : 'not needed (no CDC+ Representative)',
      ebu: 'required', training: 'required',
      fea: 'required', f2678: 'required', f8821: 'required', consent: 'required',
      dd: d.dd_on ? 'required (reimbursement by direct deposit)' : 'only for reimbursement by direct deposit',
    };
  }

  /* ---------- helpers ---------- */
  const H = () => L.StandardFontEmbedder.for(L.StandardFonts.Helvetica);
  function field(form, name) { try { return form.getTextField(name); } catch (e) { console.warn('no field', name); return null; } }
  function setText(form, name, val, size = 10) {
    const f = field(form, name); if (!f) return;
    const str = up(val); f.setText(str);
    const w = f.acroField.getWidgets()[0].getRectangle().width - 4;
    let sz = size; if (str) while (sz > 6 && H().widthOfTextAtSize(str, sz) > w) sz -= 0.25;
    f.setFontSize(sz);
  }
  // Letter-box (comb) fields: CAPITAL letters one per box; if the entry is longer than the boxes, write it small instead
  function setComb(form, name, val, boxes) {
    const f = field(form, name); if (!f) return;
    const str = U(val);
    if (boxes) { try { f.setMaxLength(boxes); } catch (e) {} }
    const max = f.getMaxLength();
    if (max && str.length > max) {
      f.disableCombing(); f.setMaxLength(undefined); f.setText(str);
      const w = f.acroField.getWidgets()[0].getRectangle().width - 4; let sz = 10;
      while (sz > 5 && H().widthOfTextAtSize(str, sz) > w) sz -= 0.25; f.setFontSize(sz);
    } else { f.setText(str); f.setFontSize(11); }
  }
  function phone3(form, a, b, c, val) {
    const n = digits(val); if (n.length !== 10) { setComb(form, a, ''); setComb(form, b, ''); setComb(form, c, ''); return; }
    setComb(form, a, n.slice(0, 3), 3); setComb(form, b, n.slice(3, 6), 3); setComb(form, c, n.slice(6), 4);
  }
  function date3(form, a, b, c, iso) {
    if (!iso) return; const [y, m, dd] = iso.split('-');
    setComb(form, a, m, 2); setComb(form, b, dd, 2); setComb(form, c, y, 4);
  }
  function setCheck(form, name, on) {
    try {
      const c = form.getCheckBox(name), w = c.acroField.getWidgets()[0];
      const val = on ? (w.getOnValue() || L.PDFName.of('Yes')) : L.PDFName.of('Off');
      c.acroField.dict.set(L.PDFName.of('V'), val); w.dict.set(L.PDFName.of('AS'), val);
    } catch (e) { console.warn('check', name, e.message); }
  }
  // Draw text with a baseline given as distance from the TOP of the page
  function put(page, font, str, x, top, maxW, size = 10) {
    str = up(str); if (!str) return;
    let s = size; while (maxW && s > 5.5 && font.widthOfTextAtSize(str, s) > maxW) s -= 0.25;
    page.drawText(str, { x, y: page.getHeight() - top, size: s, font, color: L.rgb(0, 0, 0) });
  }
  function xIn(page, font, x0, top0, x1, top1) {
    const s = Math.min(x1 - x0, top1 - top0) * 1.05, w = font.widthOfTextAtSize('X', s);
    page.drawText('X', { x: (x0 + x1) / 2 - w / 2, y: page.getHeight() - top1 + (top1 - top0 - s * 0.72) / 2, size: s, font, color: L.rgb(0, 0, 0) });
  }
  function witnessLines(page, font) {
    const line = n => `WITNESS #${n}: ____________________________   Date: ____________   WITNESS #${n} Printed Name: ____________________________`;
    put(page, font, line(1), 36, page.getHeight() - 24, 540, 7.5);
    put(page, font, line(2), 36, page.getHeight() - 11, 540, 7.5);
  }
  async function load(bytes) {
    const doc = await L.PDFDocument.load(bytes, { ignoreEncryption: true });
    return { doc, form: doc.getForm(), font: await doc.embedFont(L.StandardFonts.Helvetica), bold: await doc.embedFont(L.StandardFonts.HelveticaBold) };
  }
  async function flatten(doc) {
    const form = doc.getForm();
    if (form.getFields().length) {
      form.updateFieldAppearances(await doc.embedFont(L.StandardFonts.Helvetica));
      form.getFields().forEach(f => { if (f.constructor.name === 'PDFSignature') { try { form.removeField(f); } catch (e) {} } });
      form.flatten();
      // drop page annotation references left pointing at removed widgets
      doc.getPages().forEach(p => {
        const a = p.node.Annots(); if (!a) return;
        for (let i = a.size() - 1; i >= 0; i--) { const r = a.get(i); if (r instanceof L.PDFRef && !doc.context.lookup(r)) a.remove(i); }
      });
      doc.catalog.delete(L.PDFName.of('StructTreeRoot'));
    }
    return doc;
  }
  // Copy only some pages of a filled document into a new PDF
  async function pick(doc, pages) {
    const out = await L.PDFDocument.create();
    const src = await L.PDFDocument.load(await doc.save());
    (await out.copyPages(src, pages)).forEach(p => out.addPage(p));
    return out;
  }

  /* ---------- Application packet (fillable) ---------- */
  async function fillAppPacket(bytes, d, which) {
    const v = derive(d), { doc, form, font } = await load(bytes);
    if (which === 'app') {
      setComb(form, 'Participants First Name', d.p_first, 14);
      setComb(form, 'MI', d.p_mi, 1);
      setComb(form, 'Participants Last Name', d.p_last, 27);
      const s = digits(d.p_ssn);
      setComb(form, 'Participants Social Security Number', s.slice(0, 3), 3); setComb(form, 'comb_4', s.slice(3, 5), 2); setComb(form, 'undefined', s.slice(5, 9), 4);
      date3(form, 'Participants Date of Birth', 'Participants Gender', 'undefined_2', d.p_dob);
      setComb(form, 'Participants Medicaid ID Number', digits(d.p_medicaid), 10);
      try { if (d.p_gender) form.getRadioGroup('undefined_3').select(d.p_gender); } catch (e) { console.warn('gender', e.message); }
      const race = { White: 'White', Black: 'Black', Native: 'Indian or Alaskan Native', Asian: 'Asian', Hispanic: 'LatinHispanic', Other: 'undefined_4' };
      Object.entries(race).forEach(([k, n]) => setCheck(form, n, d.p_race === k));
      setText(form, 'Other', d.p_race === 'Other' ? U(d.p_race_other) : '', 9);
      setComb(form, 'Participants Mailing Address', d.p_street, 27);
      setComb(form, 'Mailing Address Line 2', d.p_street2, 27);
      setComb(form, 'City', d.p_city, 17);
      setComb(form, 'Zip Code', digits(d.p_zip).slice(0, 5), 6); // this ZIP row has 6 boxes
      setComb(form, 'County of Residence', d.p_county, 12);
      phone3(form, 'Home Phone Number', 'undefined_5', 'undefined_6', d.p_phone);
      phone3(form, 'Alternate Phone Number', 'undefined_7', 'undefined_8', d.p_phone_alt);
      phone3(form, 'Fax Number', 'undefined_9', 'undefined_10', d.p_fax);
      setComb(form, 'Participants Email Address', d.p_email, 27);
      setComb(form, 'Participants Primary Language', d.p_lang || 'English', 11);
      setComb(form, 'Written Materials  Language if other than English', d.p_lang_written, 15);
      // Section II legal status
      setCheck(form, 'Minor Parental Guardian', d.legal_status === 'minor_parent');
      setCheck(form, 'Minor Other Legal Guardian', d.legal_status === 'minor_guardian');
      setCheck(form, 'undefined_11', d.legal_status === 'competent');
      if (d.legal_status === 'adult_legal_rep') xIn(doc.getPage(2), font, 235.5, 562.5, 245.5, 572); // box has no form field
      if (d.legal_status && d.legal_status !== 'competent') {
        setComb(form, 'undefined_12', d.g_first, 10); setComb(form, 'GuardianLegal Representatives First Name Middle Initial Last Name If none leave blank', d.g_mi, 1); setComb(form, 'undefined_13', d.g_last, 13);
        setComb(form, 'GuardianLegal Representatives Mailing Address', d.g_street, 26);
        setComb(form, 'City_2', d.g_city, 17); setComb(form, 'State', d.g_state, 2); setComb(form, 'Zip Code_2', digits(d.g_zip).slice(0, 5), 5);
        phone3(form, 'Home Phone Number_2', 'undefined_14', 'undefined_15', d.g_phone);
        phone3(form, 'Alternate Phone Number_2', 'undefined_16', 'undefined_17', d.g_phone_alt);
      }
      // Page 2 header + Section III representative
      setText(form, 'Participant', v.participant, 10);
      if (d.has_rep) {
        setComb(form, 'Representative First Name', d.r_first, 10); setComb(form, 'M I', d.r_mi, 1); setComb(form, 'Representative Last Name', d.r_last, 13);
        setComb(form, 'Representatives Legal Mailing Address', d.r_street, 26);
        setComb(form, 'City_3', d.r_city, 17); setComb(form, 'State_2', d.r_state, 2); setComb(form, 'Zip Code_3', digits(d.r_zip).slice(0, 5), 5);
        phone3(form, 'Representatives Home Phone Number', 'comb_8', 'undefined_18', d.r_phone);
        phone3(form, 'Cell Phone Number', 'comb_11', 'undefined_19', d.r_cell);
        phone3(form, 'Work or an Alternate Phone Number', 'comb_14', 'undefined_20', d.r_work);
        phone3(form, 'Fax Number_2', 'comb_17', 'undefined_21', d.r_fax);
        setComb(form, 'Representatives Email Address', d.r_email, 26);
        const rel = { Parent: 'undefined_22', Spouse: 'undefined_23', 'Other Relative': 'undefined_24', Friend: 'undefined_25' };
        Object.entries(rel).forEach(([k, n]) => setCheck(form, n, d.r_rel === k));
        setComb(form, 'Representatives Primary Language', d.r_lang || 'English', 11);
        setComb(form, 'Written Materials  Language if other than English_2', d.r_lang_written, 14);
      }
      // Section IV consultant
      setComb(form, 'Consultants First Name', d.c_first, 10); setComb(form, 'Consultants Last Name', d.c_last, 15);
      setComb(form, 'Consultants Email Address', d.c_email, 26);
      put(doc.getPage(3), font, U(d.c_agency), 392, 458.5, 168, 10); // agency line has no form field
      // Section V cost plan (optional – usually the consultant)
      date3(form, 'Most Recent Support Plan Date', 'undefined_26', 'undefined_27', d.sp_date);
      setComb(form, 'iBudget PIN', digits(d.ibudget_pin), 10);
      date3(form, 'Current Cost Plan Dates', 'undefined_28', 'To', d.cp_from);
      date3(form, 'undefined_29', 'undefined_30', 'undefined_31', d.cp_to);
      setText(form, 'Date', v.signDate, 10);
      setText(form, 'Print Name', U(v.signer), 10);
      setText(form, 'Print Consultant Name', U([d.c_first, d.c_last].filter(Boolean).join(' ')), 10);
    }
    if (which === 'pca') setText(form, 'Date', v.signDate, 10);
    if (which === 'rep') {
      setText(form, 'Participant Name', v.participant);
      setComb(form, 'iBudget PIN', digits(d.ibudget_pin), 10);
      setText(form, 'I Representative Name', v.rep);
      setText(form, 'I voluntarily agree to serve as Representative for', v.participant);
      setText(form, 'Representative Name', v.rep);
      setText(form, 'Date', v.signDate);
      setText(form, 'Participant Name_2', v.competent ? v.participant : `${v.signer} for ${v.participant}`);
      setText(form, 'Date_2', v.signDate);
      setText(form, 'Consultant Name', [d.c_first, d.c_last].filter(Boolean).join(' '));
    }
    if (which === 'ebu') {
      setText(form, 'Participant Name', v.participant);
      setText(form, 'Participant ID', v.pid);
      const q = ['What would you do if a primary provider of a critical service failed to report to work or otherwise could not perform the job at the scheduled time and placeRow1',
        'What would you do if you experienced a personal emergency eg a house fire an accident in which you were injured or loss of a loved oneRow1',
        'What would you do if there were a communitywide emergency eg requiring evacuationRow1',
        'What would you do if an unexpected shortage of funds were to occur eg if state budget shortfalls required a severe cut in program fundsRow1',
        'If you have selected a Representative to help you with CDC how would you manage the program if he or she told you that they could no longer act as your Representative You have 30 days to arrange for someone to be trained and become your RepresentativeRow1'];
      q.forEach((n, i) => {
        const f = field(form, n); if (!f) return;
        f.enableMultiline(); const t = up(d['ebu' + (i + 1)]); f.setText(t);
        // choose a font size that fits the box
        const r = f.acroField.getWidgets()[0].getRectangle(); let sz = 10.5;
        const lines = s => t.split('\n').reduce((n2, para) => n2 + Math.max(1, Math.ceil(H().widthOfTextAtSize(para, s) / (r.width - 6))), 0);
        while (sz > 6 && lines(sz) * sz * 1.18 > r.height - 4) sz -= 0.5;
        f.setFontSize(sz);
      });
      setText(form, 'Date', v.signDate);
    }
    await flatten(doc);
    return pick(doc, APP_PAGES[which]);
  }

  /* ---------- New Participant Training Affirmation (fillable) ---------- */
  async function fillTraining(bytes, d, flat) {
    const v = derive(d), { doc, form } = await load(bytes);
    const who = d.tr_who || (d.has_rep ? 'rep' : (v.competent ? 'participant' : 'guardian'));
    const person = who === 'rep' ? { n: v.rep, s: d.r_street, c: cityLine(d.r_city, d.r_state, d.r_zip) }
      : who === 'guardian' ? { n: v.guardian, s: d.g_street, c: cityLine(d.g_city, d.g_state, d.g_zip) }
        : { n: v.participant, s: v.pStreet, c: v.pCity };
    setText(form, 'DATE', fmtDate(d.tr_date));
    setText(form, 'NAME Printed', U(person.n));
    setText(form, 'ADDRESS', U([person.s, person.c].filter(Boolean).join(', ')));
    setText(form, 'DATE_2', v.signDate);
    const ids = (up(d.tr_ids) || v.pid).split(/[,;\n]+/).map(up).filter(Boolean);
    ['List All Consumer  Participant ID Numbers', '1_2', '1_3', '1', '2_2', '2_3', '2', '3', '3_2'].forEach((n, i) => setText(form, n, ids[i] || ''));
    if (flat) await flatten(doc); else form.updateFieldAppearances(await doc.embedFont(L.StandardFonts.Helvetica));
    return doc;
  }

  /* ---------- Enrollment packet (flat forms – text placed by position) ---------- */
  async function fillEnrollment(bytes, d, which) {
    const v = derive(d), { doc, font, bold } = await load(bytes);
    const pg = i => doc.getPage(i);
    if (which === 'fea') {
      put(pg(0), font, U(v.participant), 90, 601, 330, 11);         // Consumer (PRINT NAME); Consumer ID left blank for APD
      put(pg(0), font, v.signDate, 436, 645, 110, 11);
    }
    if (which === 'f2678') {
      const p = pg(1);
      put(p, font, U(v.participant), 263, 295.5, 300, 10);         // 2 Employer's name (EIN and trade name left blank)
      put(p, font, U(v.pStreet), 264, 343.5, 300, 10);             // 4 Address (physical street address)
      put(p, font, U(d.p_city), 264, 373.5, 178, 10);
      put(p, font, U(d.p_state || 'FL'), 452, 373.5, 34, 10);
      put(p, font, digits(d.p_zip).slice(0, 5), 500, 373.5, 66, 10);
      put(p, font, v.irsPrint, 391, 677.5, 176, 9);                // Print your name here ("Household Employer" is pre-printed)
      put(p, font, v.phone, 391, 725.5, 75, 9);
      if (v.signDate) { const [m, dd, y] = v.signDate.split('/'); put(p, font, m, 137, 725.5, 0, 10); put(p, font, dd, 163, 725.5, 0, 10); put(p, font, y, 186, 725.5, 30, 10); }
      if (v.competent && d.sign_mark) witnessLines(p, bold);
    }
    if (which === 'f8821') {
      const p = pg(3);
      put(p, font, U(v.participant), 40, 131, 300, 9.5);            // Section 1 taxpayer name and address
      put(p, font, U(v.pStreet), 40, 141.5, 300, 9.5);
      put(p, font, U(v.pCity), 40, 152, 300, 9.5);
      put(p, font, v.phone, 352, 154, 110, 9.5);                   // Daytime telephone
      // Section 3(c): current year plus the following two years, on all three lines
      [405.8, 429.8, 453.8].forEach(t => {
        p.drawRectangle({ x: 316, y: p.getHeight() - t - 2.5, width: 110, height: 11, color: L.rgb(1, 1, 1) });
        put(p, bold, v.years, 318.8, t, 105, 7.5);
      });
      put(p, font, v.signDate, 437, 657, 120, 10);
      put(p, font, v.irsPrint, 60, 691, 360, 9.5);                // Print Name ("Household Employer" title is pre-printed)
      if (v.competent && d.sign_mark) witnessLines(p, bold);
    }
    if (which === 'consent') {
      const p1 = pg(4), p5 = pg(8);
      const name = U(v.participant), w = font.widthOfTextAtSize(name, 11);
      put(p1, font, name, Math.max(90, 210 - w / 2), 235.5, 240, 11);   // "I, ____ , choose to participate"
      const sign = (p, top, boxes) => {
        if (v.competent) { put(p, font, v.signDate, 446, top.date, 110, 11); return; }
        const b = { minor_parent: boxes[0], minor_guardian: boxes[1], adult_legal_rep: boxes[2] }[d.legal_status];
        if (b) xIn(p, bold, b[0], b[1], b[2], b[3]);
        put(p, font, U(v.signer), 84, top.print, 340, 11);
        put(p, font, v.signDate, 446, top.print, 110, 11);
      };
      sign(p1, { date: 309, print: 417 }, [[173.0, 358.1, 181.2, 367.0], [243.1, 358.1, 251.8, 367.0], [170.4, 384.5, 178.8, 393.4]]);
      sign(p5, { date: 113.5, print: 222 }, [[174.2, 162.8, 182.9, 171.7], [245.3, 162.8, 253.7, 171.7], [171.6, 189.2, 180.0, 198.1]]);
      put(p5, font, U(d.payee_name), 78, 449.5, 300, 11);            // Representative Payee (if any)
      put(p5, font, U([d.c_first, d.c_last].filter(Boolean).join(' ')), 406, 650.5, 170, 10);
    }
    return pick(doc, ENR_PAGES[which]);
  }

  /* Direct Deposit (Cons/Rep) – reuses the vendor-packet filler */
  function asVendor(d) {
    const v = derive(d);
    const holder = d.dd_holder === 'rep' && d.has_rep ? v.rep : v.participant;
    return Object.assign({}, d, { v_name: holder, v_business: '', v_email: d.dd_holder === 'rep' && d.has_rep ? d.r_email : d.p_email, prov_type: 'CR', dd_for: 'ConsRep', p_first: up(d.p_first), p_last: up(d.p_last), p_id: up(d.p_id) });
  }

  const DOCS = [
    { key: 'app', title: 'CDC+ Application', file: 'CDC-Application', src: 'apppkt' },
    { key: 'pca', title: 'Participant/Consultant Agreement', file: 'Participant-Consultant-Agreement', src: 'apppkt' },
    { key: 'rep', title: 'Representative Agreement', file: 'Representative-Agreement', src: 'apppkt' },
    { key: 'ebu', title: 'Emergency Back-up Plan', file: 'Emergency-Backup-Plan', src: 'apppkt' },
    { key: 'training', title: 'New Participant Training Affirmation', file: 'Training-Affirmation', src: 'training' },
    { key: 'fea', title: 'Informed Consent – F/EA', file: 'Informed-Consent-FEA', src: 'enroll' },
    { key: 'f2678', title: 'IRS Form 2678', file: 'IRS-2678', src: 'enroll' },
    { key: 'f8821', title: 'IRS Form 8821', file: 'IRS-8821', src: 'enroll' },
    { key: 'consent', title: 'CDC+ Program Consent Form', file: 'Program-Consent', src: 'enroll' },
    { key: 'dd', title: 'Direct Deposit (Cons/Rep)', file: 'Direct-Deposit', vendor: true },
  ];

  async function buildOne(PDFLib, key, tpl, d, flat) {
    L = PDFLib;
    const spec = DOCS.find(x => x.key === key);
    if (spec.vendor) return root.PacketFill.buildOne(PDFLib, 'dd', tpl, asVendor(d), flat);
    if (spec.src === 'apppkt') return fillAppPacket(tpl.apppkt, d, key);
    if (spec.src === 'training') return fillTraining(tpl.training, d, flat);
    return fillEnrollment(tpl.enroll, d, key);
  }

  /* Order: Application packet, Training Affirmation (+ review answer sheet), Enrollment packet
     (+ proof of signing authority after the IRS forms), Direct Deposit (+ voided check) */
  async function buildPacket(PDFLib, tpl, d, selected, att) {
    L = PDFLib;
    const out = await PDFLib.PDFDocument.create();
    const add = async key => {
      if (!selected.includes(key)) return;
      const doc = await buildOne(PDFLib, key, tpl, d, true);
      const src = await PDFLib.PDFDocument.load(await doc.save());
      (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
    };
    const attach = a => root.PacketFill.embedAttachment(PDFLib, out, a);
    for (const k of ['app', 'pca', 'rep', 'ebu', 'training']) await add(k);
    if (selected.includes('training')) await attach(att && att.review);
    for (const k of ['fea', 'f2678', 'f8821']) await add(k);
    await attach(att && att.authority);
    await add('consent');
    await add('dd');
    if (selected.includes('dd')) await attach(att && att.check);
    return out;
  }

  const api = { DOCS, derive, applicability, buildOne, buildPacket };
  if (typeof module !== 'undefined') module.exports = api; else root.AppFill = api;
})(typeof window !== 'undefined' ? window : globalThis);
