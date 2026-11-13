/* Vendor / Independent Contractor packet — page configuration */
(function () {
  const abaOk = r => { if (!/^\d{9}$/.test(r)) return false; const d = r.split('').map(Number); return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0; };
  window.abaOk = abaOk;
  PacketApp({
    KEY: 'cdcPacketRecords.v1',
    filler: PacketFill,
    packetSuffix: 'Vendor-IC-Packet',
    dupMsg: 'New provider for the same participant',
    DEFAULTS: { p_state: 'FL', v_state: 'FL', prov_type: 'IC', tin_type: 'SSN', w9_class: 'auto', acct_type: 'Checking', dd_attach: 'check', fill_sign_date: true },
    recTitle: d => d.v_name || '(new provider)',
    fileName: d => d.v_name || 'Provider',
    REQ: ['p_first', 'p_last', 'p_id', 'p_street', 'p_city', 'p_state', 'p_zip', 'v_name', 'v_street', 'v_city', 'v_state', 'v_zip', 'v_phone', 'v_email', 'tin', 'live_in', 'medicaid', 'doh_license', 'direct_care', 'statute', 'relationship', 'bank_name', 'routing', 'account', 'form_date'],
    issues(d, att) {
      const out = [], bad = new Set();
      const need = (k, label) => { if (!String(d[k] || '').trim()) { out.push(label + ' is missing'); bad.add(k); } };
      need('p_first', 'Participant first name'); need('p_last', 'Participant last name'); need('p_id', 'CDC+ ID #');
      need('p_street', 'Participant street'); need('p_city', 'Participant city'); need('p_state', 'Participant state'); need('p_zip', 'Participant ZIP');
      need('v_name', 'Provider legal name'); need('v_street', 'Provider street'); need('v_city', 'Provider city'); need('v_state', 'Provider state'); need('v_zip', 'Provider ZIP');
      need('v_phone', 'Provider phone'); need('v_email', 'Provider email'); need('tin', 'Tax ID');
      if (d.prov_type === 'AV' && !d.av_entity) out.push('Choose the Agency/Vendor entity type');
      const t = String(d.tin || '').replace(/\D/g, ''); if (t && t.length !== 9) { out.push('Tax ID must be 9 digits'); bad.add('tin'); }
      if (d.v_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.v_email)) { out.push('Email looks invalid'); bad.add('v_email'); }
      if ((d.w9_class === 'llc' || (d.w9_class === 'auto' && d.prov_type === 'AV' && d.av_entity === 'llc')) && !d.llc_code) out.push('W-9: choose the LLC tax code (C, S or P)');
      ['live_in', 'medicaid', 'doh_license', 'direct_care', 'statute'].forEach(k => { if (!d[k]) out.push('Vendor Form: answer question “' + ({ live_in: 'live-in', medicaid: 'Medicaid-enrolled', doh_license: 'DOH license', direct_care: 'direct care', statute: 's. 402.3057 certificate' })[k] + '”'); });
      if (!d.relationship) out.push('Vendor Form: choose relationship to participant');
      if (d.prov_type === 'AV' && !d.evv) out.push('Vendor Form: answer EVV question');
      need('bank_name', 'Bank name'); need('account', 'Bank account number');
      const r = String(d.routing || '').replace(/\D/g, '');
      if (!r) { out.push('Routing number is missing'); bad.add('routing'); } else if (!abaOk(r)) { out.push('Routing number fails the bank checksum – double-check it'); bad.add('routing'); }
      need('form_date', 'Vendor Form date');
      if (d.direct_care === 'Yes' && !att.bg) out.push('Reminder: attach the Level 2 background screening letter (direct care = Yes)');
      if (!att.check) out.push('Reminder: attach the voided check or bank letter');
      return { out, bad };
    },
    onRefresh(d, { $, $$ }) {
      const isAV = d.prov_type === 'AV';
      $$('.avonly').forEach(e => e.classList.toggle('hide', !isAV));
      const cls = d.w9_class === 'auto' ? (isAV ? { corporation: 'ccorp', llc: 'llc', partnership: 'partnership' }[d.av_entity] : 'individual') : d.w9_class;
      $$('.llconly').forEach(e => e.classList.toggle('hide', cls !== 'llc'));
      $$('.otheronly').forEach(e => e.classList.toggle('hide', d.w9_class !== 'other'));
      $$('.mcdonly').forEach(e => e.classList.toggle('hide', d.medicaid !== 'Yes'));
      $$('.dohonly').forEach(e => e.classList.toggle('hide', d.doh_license !== 'Yes'));
      $('.w9sec').classList.toggle('hide', isAV && d.av_entity === 'corporation');
    },
    setup(form, { refresh }) {
      form.querySelector('[name=tin]').addEventListener('blur', e => {
        const n = e.target.value.replace(/\D/g, '');
        if (n.length === 9) { const t = form.querySelector('[name=tin_type]:checked'); e.target.value = t && t.value === 'EIN' ? n.slice(0, 2) + '-' + n.slice(2) : n.slice(0, 3) + '-' + n.slice(3, 5) + '-' + n.slice(5); }
        refresh();
      });
    },
    mapHead: ['Master field', 'Vendor Information Form', 'IRS W-9 (Rev. 3-2024)', 'Good Moral Character', 'Direct Deposit'],
    mapRows: [
      ['Participant first + last name', 'Participant Name', 'Requester name & address; LAST NAME in bottom margin', 'Health Care Provider/Employer Name', 'Employer/Participant Name and CDC+ ID'],
      ['CDC+ ID #', 'Participant ID #', 'Requester box; bottom margin', 'with Employer Name', 'Employer/Participant Name and CDC+ ID'],
      ['Participant address', '—', 'Requester name & address', 'Address of Health Care Provider', '—'],
      ['Provider legal name', 'Vendor Name', 'Line 1', 'Employee/Contractor Name; “Under penalty of perjury, I …”', 'Name of Individual/Business'],
      ['Business / DBA', 'Vendor Name (in parentheses)', 'Line 2', '—', 'Name of Individual/Business (in parentheses)'],
      ['Provider address', 'Address (2 lines)', 'Lines 5 and 6', '—', '—'],
      ['Phone', 'Phone #', '—', '—', '—'],
      ['Email', 'Email', '—', '—', 'Email Address of Individual/Business'],
      ['Tax ID (SSN or EIN)', 'Tax ID/FEIN', 'Part I – SSN or EIN boxes', '—', '—'],
      ['Provider type / entity', 'Q1 checkboxes', 'Line 3a classification (auto)', 'Title (default “Independent Contractor”)', '“for” checkbox (IC / Vendor)'],
      ['W-9 tax classification (and LLC code)', '—', 'Line 3a (lines 3b, 4 and 7 left blank)', '—', '—'],
      ['Vendor questions 2–7', 'Q2–Q7, Medicaid # / DOH #, circled Medicaid type', '—', '—', '—'],
      ['Prior screening purpose / agency / date', '—', '—', 'Page 4 box', '—'],
      ['Bank info', '—', '—', '—', 'Account type, bank name, routing (9 boxes), account #, attachment type'],
      ['Vendor Form date', 'Date', '—', '—', '—'],
      ['Signature date (optional)', '—', 'Date beside signature', 'Date beside signature (p.3 or p.4)', 'Date'],
    ],
  });
})();
