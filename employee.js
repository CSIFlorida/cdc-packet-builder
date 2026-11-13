/* Direct-Hire Employee packet — page configuration */
(function () {
  const abaOk = r => { if (!/^\d{9}$/.test(r)) return false; const d = r.split('').map(Number); return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0; };
  const num = x => parseFloat(String(x || '').replace(/[^\d.]/g, '')) || 0;
  const QN = { live_in: 'live-in status', medicaid: 'Q1 Medicaid-enrolled', doh_license: 'Q2 DOH license', unemployed90: 'Q3 unemployed 90+ days', statute: 'Q4 s. 402.3057 affidavit' };
  PacketApp({
    KEY: 'cdcEmpPacketRecords.v1',
    filler: EmpFill,
    packetSuffix: 'Employee-Packet',
    dupMsg: 'New employee for the same participant',
    DEFAULTS: { p_state: 'FL', e_state: 'FL', acct_type: 'Checking', dd_attach: 'check', fill_sign_date: true, i9_docs: 'BC', w4_filing: 'single' },
    recTitle: d => [d.e_first, d.e_last].filter(Boolean).join(' ') || '(new employee)',
    fileName: d => [d.e_first, d.e_last].filter(Boolean).join(' ') || 'Employee',
    REQ: ['p_first', 'p_last', 'p_id', 'p_street', 'p_city', 'p_state', 'p_zip', 'e_first', 'e_last', 'e_street', 'e_city', 'e_state', 'e_zip', 'e_phone', 'e_email', 'e_dob', 'e_ssn',
      'c_first', 'c_last', 'c_rel', 'c_phone', 'tax_rel', 'relationship', 'live_in', 'medicaid', 'doh_license', 'unemployed90', 'statute', 'w4_filing', 'i9_status', 'i9_docs',
      'bank_name', 'routing', 'account', 'form_date', 'start_date'],
    issues(d, att) {
      const out = [], bad = new Set();
      const need = (k, label) => { if (!String(d[k] || '').trim()) { out.push(label + ' is missing'); bad.add(k); } };
      need('p_first', 'Participant first name'); need('p_last', 'Participant last name'); need('p_id', 'CDC+ ID #');
      need('p_street', 'Participant street'); need('p_city', 'Participant city'); need('p_state', 'Participant state'); need('p_zip', 'Participant ZIP');
      need('e_first', 'Employee first name'); need('e_last', 'Employee last name'); need('e_street', 'Employee street'); need('e_city', 'Employee city');
      need('e_state', 'Employee state'); need('e_zip', 'Employee ZIP'); need('e_phone', 'Employee phone'); need('e_email', 'Employee email'); need('e_dob', 'Employee date of birth'); need('e_ssn', 'Employee SSN');
      const s = String(d.e_ssn || '').replace(/\D/g, ''); if (s && s.length !== 9) { out.push('SSN must be 9 digits'); bad.add('e_ssn'); }
      if (d.e_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.e_email)) { out.push('Employee email looks invalid'); bad.add('e_email'); }
      need('c_first', 'Contact first name'); need('c_last', 'Contact last name'); need('c_rel', 'Contact relationship'); need('c_phone', 'Contact phone');
      if (!d.tax_rel) out.push('Employee Information: choose the employee\'s relationship (taxes)');
      if (!d.relationship) out.push('Employee Information: choose relationship to participant');
      Object.keys(QN).forEach(k => { if (!d[k]) out.push(`Employee Information: answer “${QN[k]}”`); });
      if (!d.w4_filing) out.push('W-4: choose a filing status');
      if (!d.i9_status) out.push('I-9: choose citizenship / immigration status');
      if (d.i9_status === '3') need('i9_anum', 'I-9: USCIS / A-Number');
      if (d.i9_status === '4' && !(d.i9_anum4 || d.i9_i94 || d.i9_passport)) out.push('I-9: enter an A-Number, I-94 number or foreign passport');
      if (d.i9_docs === 'A') { need('la_title', 'I-9 List A title'); need('la_auth', 'I-9 List A issuing authority'); need('la_no', 'I-9 List A number'); }
      else if (d.i9_docs === 'BC') { need('lb_title', 'I-9 List B title'); need('lb_auth', 'I-9 List B issuing authority'); need('lb_no', 'I-9 List B number'); need('lc_title', 'I-9 List C title'); need('lc_auth', 'I-9 List C issuing authority'); need('lc_no', 'I-9 List C number'); }
      else out.push('I-9: choose which documents were examined');
      need('bank_name', 'Bank name'); need('account', 'Bank account number');
      const r = String(d.routing || '').replace(/\D/g, '');
      if (!r) { out.push('Routing number is missing'); bad.add('routing'); } else if (!abaOk(r)) { out.push('Routing number fails the bank checksum – double-check it'); bad.add('routing'); }
      need('form_date', 'Form date'); need('start_date', 'First day of employment');
      if (d.chg_on) { need('o_street', 'Change form: old street address'); if (!d.chg_livein) out.push('Change form: answer the live-in question'); }
      if (d.start_date && d.sign_date && d.fill_sign_date && d.start_date <= d.sign_date) out.push('Reminder: APD asks that the I-9 first day of employment be a future date from the signature date');
      if (d.w4_exempt) out.push('Reminder: a W-4 exemption must be renewed every year');
      const needLetter = (d.medicaid === 'No' && d.doh_license === 'No') || d.unemployed90 === 'Yes';
      if (needLetter && !att.bg) out.push('Reminder: attach the Level 2 background screening clearance letter');
      if (!att.check) out.push('Reminder: attach a pre-printed voided check or bank letter');
      return { out, bad };
    },
    onRefresh(d, { $, $$ }) {
      $$('.st3').forEach(e => e.classList.toggle('hide', d.i9_status !== '3'));
      $$('.st4').forEach(e => e.classList.toggle('hide', d.i9_status !== '4'));
      $$('.docA').forEach(e => e.classList.toggle('hide', d.i9_docs !== 'A'));
      $$('.docBC').forEach(e => e.classList.toggle('hide', d.i9_docs !== 'BC'));
      $$('.chgonly').forEach(e => e.classList.toggle('hide', !d.chg_on));
      const t = num(d.w4_3a) + num(d.w4_3b);
      $('#w4_3tot').value = t ? '$' + t.toLocaleString('en-US') : '';
    },
    setup(form, { refresh }) {
      const ssn = form.querySelector('[name=e_ssn]');
      ssn.addEventListener('blur', () => { const n = ssn.value.replace(/\D/g, ''); if (n.length === 9) ssn.value = `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`; refresh(); });
    },
    mapHead: ['Master field', 'Employee Information', 'W-4 (2026)', 'I-9', 'Good Moral', 'Direct Deposit', 'Change of Name/Address'],
    mapRows: [
      ['Participant name', 'Employer (Participant)\'s Name', 'Employer\'s name and address (+ CDC+ ID)', 'Sec. 2 employer name/title, business name; LAST NAME in bottom margin', 'Health Care Provider/Employer', 'Employer/Participant + CDC+ ID', 'Employer (Participant)\'s Name'],
      ['CDC+ ID #', 'Participant\'s CDC+ ID', 'Employer box', 'Bottom margin', 'with Employer', 'with Employer', 'Participant\'s CDC+ ID'],
      ['Participant address', '—', 'Employer box', 'Employer\'s business address', 'Address of Health Care Provider', '—', '—'],
      ['CDC+ Representative', '—', '—', '“Rep for Participant – Household Employer”', '—', '—', '—'],
      ['Employee name', 'Last / First Name', 'Step 1(a)', 'Section 1 name, middle initial, other last names', 'Employee/Contractor Name; “Under penalty of perjury, I …”', 'Name of Individual', 'NEW information'],
      ['Employee address', 'Address, City, State, Zip', 'Step 1 address lines', 'Section 1 address (state dropdown)', '—', '—', 'NEW information'],
      ['Phone / email', 'Phone, Email', '—', 'Section 1 phone, email', '—', 'Email', 'NEW information'],
      ['SSN / DOB', 'SSN, DOB', 'Step 1(b) SSN', 'Section 1 SSN, DOB', '—', '—', 'Employee SSN; DOB'],
      ['Contact if mail returned', '“Who can we contact” lines', '—', '—', '—', '—', '—'],
      ['Relationship / live-in / Q1–Q4', 'Check boxes (letter-attached boxes automatic)', '—', '—', '—', '—', '—'],
      ['W-4 answers', '—', 'Step 1(c), 2(c), 3, 4(a)-(c), Exempt box + “EXEMPT” below 4(c)', '—', '—', '—', '—'],
      ['I-9 status & documents', '—', '—', 'Section 1 status boxes; Section 2 List A or B + C', '—', '—', '—'],
      ['First day of employment', '—', 'First date of employment', 'First Day of Employment', '—', '—', '—'],
      ['Bank info', '—', '—', '—', '—', 'Account type, bank, routing, account, attachment', '—'],
      ['Old name / address', '—', '—', '—', '—', '—', 'CURRENT (OLD) information; live-in Yes/No'],
      ['Form date / signature date', 'Date', 'Date (Step 5)', 'Section 1 & 2 dates', 'Date beside signature', 'Date', 'Date'],
    ],
  });
})();
