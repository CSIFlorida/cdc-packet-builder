/* CDC+ Participant Application — page configuration */
(function () {
  const abaOk = r => { if (!/^\d{9}$/.test(r)) return false; const d = r.split('').map(Number); return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0; };
  const competent = d => !d.legal_status || d.legal_status === 'competent';
  PacketApp({
    KEY: 'cdcAppRecords.v1',
    filler: AppFill,
    packetSuffix: 'CDC-Application',
    dupMsg: 'New application with the same participant details',
    DEFAULTS: { p_state: 'FL', g_state: 'FL', r_state: 'FL', p_lang: 'English', legal_status: 'competent', acct_type: 'Checking', dd_attach: 'check', dd_holder: 'consumer', fill_sign_date: true },
    recTitle: d => [d.p_first, d.p_last].filter(Boolean).join(' ') || '(new application)',
    fileName: d => [d.p_first, d.p_last].filter(Boolean).join(' ') || 'Participant',
    REQ: ['p_first', 'p_last', 'p_ssn', 'p_dob', 'p_medicaid', 'p_gender', 'p_race', 'p_street', 'p_city', 'p_zip', 'p_county', 'p_phone', 'legal_status',
      'c_first', 'c_last', 'c_agency', 'c_email', 'ebu1', 'ebu2', 'ebu3', 'ebu4', 'tr_date'],
    issues(d, att) {
      const out = [], bad = new Set();
      const need = (k, label) => { if (!String(d[k] || '').trim()) { out.push(label + ' is missing'); bad.add(k); } };
      need('p_first', 'Participant first name'); need('p_last', 'Participant last name'); need('p_ssn', 'Participant SSN'); need('p_dob', 'Participant date of birth');
      need('p_medicaid', 'Medicaid ID #'); need('p_street', 'Mailing address'); need('p_city', 'City'); need('p_zip', 'ZIP'); need('p_county', 'County of residence'); need('p_phone', 'Home phone');
      const s = String(d.p_ssn || '').replace(/\D/g, ''); if (s && s.length !== 9) { out.push('SSN must be 9 digits'); bad.add('p_ssn'); }
      const m = String(d.p_medicaid || '').replace(/\D/g, ''); if (m && m.length !== 10) { out.push('Medicaid ID must be 10 digits'); bad.add('p_medicaid'); }
      if (/\bP\.?\s*O\.?\s*BOX\b/i.test(d.p_street || '')) { out.push('Mailing address must be a physical street address – the IRS does not accept a PO Box'); bad.add('p_street'); }
      if (!d.p_gender) out.push('Choose gender'); if (!d.p_race) out.push('Choose race');
      if (!competent(d)) { need('g_first', 'Guardian first name'); need('g_last', 'Guardian last name'); need('g_street', 'Guardian address'); need('g_city', 'Guardian city'); need('g_zip', 'Guardian ZIP'); need('g_phone', 'Guardian phone'); }
      if (d.p_dob && competent(d)) { const age = (Date.now() - new Date(d.p_dob)) / 3.15576e10; if (age < 18) out.push('The participant is under 18 – choose a “Minor” legal status in section 2'); }
      if (d.has_rep) { need('r_first', 'Representative first name'); need('r_last', 'Representative last name'); need('r_street', 'Representative address'); need('r_city', 'Representative city'); need('r_zip', 'Representative ZIP'); need('r_email', 'Representative email'); if (!d.r_rel) out.push('Choose the Representative\'s relationship'); }
      need('c_first', 'Consultant first name'); need('c_last', 'Consultant last name'); need('c_agency', 'Consultant agency (or SOLO)'); need('c_email', 'Consultant email');
      ['ebu1', 'ebu2', 'ebu3', 'ebu4'].forEach((k, i) => need(k, `Emergency Back-up Plan answer ${i + 1}`));
      if (d.has_rep) need('ebu5', 'Emergency Back-up Plan answer 5');
      need('tr_date', 'Training date');
      if (d.dd_on) {
        need('bank_name', 'Bank name'); need('account', 'Bank account number');
        const r = String(d.routing || '').replace(/\D/g, '');
        if (!r) { out.push('Routing number is missing'); bad.add('routing'); } else if (!abaOk(r)) { out.push('Routing number fails the bank checksum – double-check it'); bad.add('routing'); }
        if (d.dd_holder === 'rep' && !d.has_rep) out.push('Direct deposit: account holder is the Representative, but no Representative is entered');
        if (!att.check) out.push('Reminder: attach the voided check (name machine-printed) or a signed bank letter');
      }
      if (!competent(d) && !att.authority) out.push('Reminder: attach proof of authority to sign for the participant (needed for IRS 2678 and 8821)');
      if (!att.review) out.push('Reminder: attach the signed Training Review Answer Sheet');
      return { out, bad };
    },
    onRefresh(d, { $, $$ }) {
      const comp = competent(d);
      $$('.guardianonly').forEach(e => e.classList.toggle('hide', comp));
      $$('.competentonly').forEach(e => e.classList.toggle('hide', !comp));
      $$('.reponly').forEach(e => e.classList.toggle('hide', !d.has_rep));
      $$('.ddonly').forEach(e => e.classList.toggle('hide', !d.dd_on));
      $$('.raceother').forEach(e => e.classList.toggle('hide', d.p_race !== 'Other'));
      // keep a "rep_name" so the Employee / Vendor packets can reuse this participant's Representative
      const rn = document.querySelector('[name=rep_name]');
      rn.value = d.has_rep ? [d.r_first, d.r_last].filter(Boolean).join(' ') : '';
    },
    setup(form, { refresh }) {
      const ssn = form.querySelector('[name=p_ssn]');
      ssn.addEventListener('blur', () => { const n = ssn.value.replace(/\D/g, ''); if (n.length === 9) ssn.value = `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5)}`; refresh(); });
    },
    mapHead: ['Master field', 'Application', 'Rep. Agreement / EBU / Training', 'F/EA Consent', 'IRS 2678', 'IRS 8821', 'Program Consent', 'Direct Deposit'],
    mapRows: [
      ['Participant name', 'Section I name boxes; page-2 header', 'Participant Name (Rep Agreement, EBU)', 'Consumer (PRINT NAME)', 'Line 2 Employer\'s name', 'Section 1 taxpayer name', '“I, ___, choose to participate”', 'Employer/Participant'],
      ['SSN, DOB, Medicaid ID, gender, race', 'Section I boxes', 'Medicaid/CDC+ ID → EBU Participant ID, Training IDs', '—', '—', '—', '—', '—'],
      ['Mailing address', 'Section I address boxes', '—', '—', 'Line 4 address', 'Section 1 address', '—', '—'],
      ['Phones, email, language', 'Section I boxes', '—', '—', 'Best daytime phone', 'Daytime telephone', '—', 'Email (account holder)'],
      ['Legal status / guardian', 'Section II check box + guardian boxes; Print Name', 'Participant signer on Rep Agreement', 'Signer', '“Guardian for Consumer / minor or has guardian”', 'Same as 2678', 'Parent / Legal Guardian / Legal Rep box + Print Name', '—'],
      ['Signs with X or mark', '—', '—', '—', 'Two witness lines added', 'Two witness lines added', '—', '—'],
      ['CDC+ Representative', 'Section III', 'Representative Agreement names; Training trainee', '—', '—', '—', '—', 'Account holder (if chosen)'],
      ['Consultant', 'Section IV; Print Consultant Name', 'Consultant Name (Rep Agreement)', '—', '—', '—', 'Print Consultant Name', '—'],
      ['Support Plan / Cost Plan / iBudget PIN', 'Section V', 'iBudget PIN (Rep Agreement)', '—', '—', '—', '—', '—'],
      ['Emergency Back-up Plan answers', '—', 'EBU questions 1–5', '—', '—', '—', '—', '—'],
      ['Training date / IDs', '—', 'Training Affirmation', '—', '—', '—', '—', '—'],
      ['Representative Payee', '—', '—', '—', '—', '—', 'Print Representative Payee Name', '—'],
      ['Signature date', 'Date', 'Dates', 'Date', 'Date (MM/DD/YYYY)', 'Date; years = this year + next two', 'Dates', 'Date'],
    ],
  });
})();
