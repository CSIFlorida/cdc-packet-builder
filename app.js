(function(){
const KEY='cdcPacketRecords.v1', VERSION='1.0.4';
document.getElementById('ver').textContent=VERSION;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const form=$('#f');
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const DEFAULTS={p_state:'FL',v_state:'FL',prov_type:'IC',tin_type:'SSN',w9_class:'auto',acct_type:'Checking',dd_attach:'check',fill_sign_date:true};
let store={records:[],current:null}, att={}, touched=new Set(), showAll=false;

// Build Yes/No segmented controls
$$('.yn').forEach(el=>{const n=el.dataset.name;el.innerHTML=`<label><input type="radio" name="${n}" value="Yes">Yes</label><label><input type="radio" name="${n}" value="No">No</label>`;});

function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);}
function load(){try{store=JSON.parse(localStorage.getItem(KEY))||store;}catch(e){}}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(store));}catch(e){}}
function uid(){return Math.random().toString(36).slice(2,10);}
function cur(){return store.records.find(r=>r.id===store.current);}

function readForm(){
  const d={};
  form.querySelectorAll('input,select').forEach(el=>{
    if(!el.name||el.type==='file')return;
    if(el.type==='radio'){if(el.checked)d[el.name]=el.value;else if(!(el.name in d))d[el.name]='';}
    else if(el.type==='checkbox')d[el.name]=el.checked;
    else d[el.name]=el.value;
  });
  return d;
}
function writeForm(d){
  touched=new Set();showAll=false;
  form.querySelectorAll('input,select').forEach(el=>{
    if(!el.name||el.type==='file')return;
    const v=d[el.name];
    if(el.type==='radio')el.checked=(v===el.value);
    else if(el.type==='checkbox')el.checked=!!v;
    else{el.value=v==null?'':v; if(el.tagName==='SELECT'&&el.selectedIndex<0)el.selectedIndex=0;}
  });
  refresh();
}
function newRecord(base){
  const r={id:uid(),data:Object.assign({},DEFAULTS,{form_date:today(),sign_date:today()},base||{})};
  store.records.unshift(r);store.current=r.id;persist();writeForm(r.data);renderRecs();
}
function renderRecs(){
  const el=$('#recList');
  if(!store.records.length){el.innerHTML='<div class="file">No records yet.</div>';return;}
  el.innerHTML=store.records.map(r=>{
    const d=r.data,n=d.v_name||'(new provider)',p=[d.p_first,d.p_last].filter(Boolean).join(' ')||'—';
    return `<div class="rec ${r.id===store.current?'on':''}" data-id="${r.id}"><div>${esc(n)}<small>Participant: ${esc(p)}</small></div></div>`;}).join('');
  el.querySelectorAll('.rec').forEach(x=>x.onclick=()=>{store.current=x.dataset.id;persist();writeForm(cur().data);renderRecs();});
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

// ---------- validation ----------
function abaOk(r){if(!/^\d{9}$/.test(r))return false;const d=r.split('').map(Number);return (3*(d[0]+d[3]+d[6])+7*(d[1]+d[4]+d[7])+(d[2]+d[5]+d[8]))%10===0;}
function issues(d){
  const out=[],bad=new Set();
  const need=(k,label)=>{if(!String(d[k]||'').trim()){out.push(label+' is missing');bad.add(k);}};
  need('p_first','Participant first name');need('p_last','Participant last name');need('p_id','CDC+ ID #');
  need('p_street','Participant street');need('p_city','Participant city');need('p_state','Participant state');need('p_zip','Participant ZIP');
  need('v_name','Provider legal name');need('v_street','Provider street');need('v_city','Provider city');need('v_state','Provider state');need('v_zip','Provider ZIP');
  need('v_phone','Provider phone');need('v_email','Provider email');need('tin','Tax ID');
  if(d.prov_type==='AV'&&!d.av_entity){out.push('Choose the Agency/Vendor entity type');}
  const t=String(d.tin||'').replace(/\D/g,'');if(t&&t.length!==9){out.push('Tax ID must be 9 digits');bad.add('tin');}
  if(d.v_email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.v_email)){out.push('Email looks invalid');bad.add('v_email');}
  if((d.w9_class==='llc'||(d.w9_class==='auto'&&d.prov_type==='AV'&&d.av_entity==='llc'))&&!d.llc_code&&d.av_entity!=='corporation'){out.push('W-9: choose the LLC tax code (C, S or P)');}
  ['live_in','medicaid','doh_license','direct_care','statute'].forEach(k=>{if(!d[k])out.push('Vendor Form: answer question “'+({live_in:'live-in',medicaid:'Medicaid-enrolled',doh_license:'DOH license',direct_care:'direct care',statute:'s. 402.3057 certificate'})[k]+'”');});
  if(!d.relationship)out.push('Vendor Form: choose relationship to participant');
  if(d.prov_type==='AV'&&!d.evv)out.push('Vendor Form: answer EVV question');
  need('bank_name','Bank name');need('account','Bank account number');
  const r=String(d.routing||'').replace(/\D/g,'');
  if(!r){out.push('Routing number is missing');bad.add('routing');}else if(!abaOk(r)){out.push('Routing number fails the bank checksum – double-check it');bad.add('routing');}
  need('form_date','Vendor Form date');
  if(d.direct_care==='Yes'&&!att.bg)out.push('Reminder: attach the Level 2 background screening letter (direct care = Yes)');
  if(!att.check)out.push('Reminder: attach the voided check or bank letter');
  return {out,bad};
}

const REQ=['p_first','p_last','p_id','p_street','p_city','p_state','p_zip','v_name','v_street','v_city','v_state','v_zip','v_phone','v_email','tin','live_in','medicaid','doh_license','direct_care','statute','relationship','bank_name','routing','account','form_date'];
// ---------- UI refresh ----------
function refresh(){
  const d=readForm();
  const isAV=d.prov_type==='AV';
  $$('.avonly').forEach(e=>e.classList.toggle('hide',!isAV));
  const cls=d.w9_class==='auto'?(isAV?{corporation:'ccorp',llc:'llc',partnership:'partnership'}[d.av_entity]:'individual'):d.w9_class;
  $$('.llconly').forEach(e=>e.classList.toggle('hide',cls!=='llc'));
  $$('.otheronly').forEach(e=>e.classList.toggle('hide',d.w9_class!=='other'));
  $$('.mcdonly').forEach(e=>e.classList.toggle('hide',d.medicaid!=='Yes'));
  $$('.dohonly').forEach(e=>e.classList.toggle('hide',d.doh_license!=='Yes'));
  $('.w9sec').classList.toggle('hide',isAV&&d.av_entity==='corporation');
  const ap=PacketFill.applicability(d);
  const prev=new Set($$('#docList input:checked').map(x=>x.value));
  const first=!$('#docList').children.length;
  $('#docList').innerHTML=PacketFill.DOCS.map(x=>{
    const a=ap[x.key],cls=a==='required'?'b-req':a.startsWith('not')?'b-no':'b-opt';
    const on=first?!a.startsWith('not'):(prev.has(x.key)||(a==='required'&&!prev.size));
    return `<label class="doc"><input type="checkbox" value="${x.key}" ${on&&!a.startsWith('not')?'checked':''} ${a.startsWith('not')?'disabled':''}><span class="t"><b>${x.title}</b><span class="badge ${cls}">${a}</span></span><button class="sm one" data-k="${x.key}" type="button" ${a.startsWith('not')?'disabled':''}>PDF</button></label>`;}).join('');
  $$('#docList .one').forEach(b=>b.onclick=e=>{e.preventDefault();genOne(b.dataset.k);});
  const {out,bad}=issues(d);
  form.querySelectorAll('[name]').forEach(el=>el.classList.toggle('invalid',bad.has(el.name)&&(showAll||touched.has(el.name))));
  const hard=out.filter(x=>!x.startsWith('Reminder'));
  $('#issues').innerHTML=out.length?`<div class="issues ${hard.length?'':'ok'}">${hard.length?`<b>${hard.length} item(s) to complete</b>`:'<b>All required data entered</b>'}<ul>${out.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:`<div class="issues ok"><b>✓ Everything complete — ready to generate.</b></div>`;
  const done=REQ.filter(k=>String(d[k]||'').trim()).length;
  const pct=hard.length?Math.min(99,Math.round(100*done/REQ.length)):100;
  $('#progBar').style.width=Math.max(0,pct)+'%';$('#progTxt').textContent=Math.max(0,pct)+'% complete';
  const r=cur();if(r){r.data=d;persist();}
  clearTimeout(refresh._r);refresh._r=setTimeout(renderRecs,300);
}
form.addEventListener('focusout',e=>{if(e.target.name){touched.add(e.target.name);refresh();}});
form.addEventListener('input',refresh);form.addEventListener('change',refresh);
// digits-only helpers
form.querySelector('[name=routing]').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,9);});
form.querySelector('[name=tin]').addEventListener('blur',e=>{const n=e.target.value.replace(/\D/g,'');if(n.length===9){const t=form.querySelector('[name=tin_type]:checked');e.target.value=t&&t.value==='EIN'?n.slice(0,2)+'-'+n.slice(2):n.slice(0,3)+'-'+n.slice(3,5)+'-'+n.slice(5);}refresh();});
['p_state','v_state','llc_code'].forEach(n=>form.querySelector(`[name=${n}]`).addEventListener('blur',e=>{e.target.value=e.target.value.toUpperCase();refresh();}));

// attachments
async function readFile(inp,key){
  const f=inp.files[0];if(!f){delete att[key];$('#'+inp.id+'_n').textContent='';refresh();return;}
  att[key]={bytes:new Uint8Array(await f.arrayBuffer()),type:f.type||(f.name.toLowerCase().endsWith('.pdf')?'application/pdf':f.name.toLowerCase().endsWith('.png')?'image/png':'image/jpeg'),name:f.name};
  $('#'+inp.id+'_n').textContent='✓ '+f.name;refresh();
}
$('#att_bg').onchange=e=>readFile(e.target,'bg');$('#att_check').onchange=e=>readFile(e.target,'check');

// ---------- generation ----------
const b64=s=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;};
const TPL={};for(const k in window.TEMPLATES_B64)TPL[k]=b64(window.TEMPLATES_B64[k]);
function fname(d,suffix){const n=(d.v_name||'Provider').replace(/[^\w]+/g,'-').replace(/^-|-$/g,'');return `${n}_${(d.p_last||'').replace(/[^\w]+/g,'')}_${suffix}.pdf`;}
function save(bytes,name){
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function confirmIssues(){
  showAll=true;refresh();
  const {out}=issues(readForm());const hard=out.filter(x=>!x.startsWith('Reminder'));
  if(hard.length){toast(`${hard.length} item(s) still blank — generating anyway; review before signing.`);}
}
async function genOne(k){
  try{confirmIssues();const d=readForm();const doc=await PacketFill.buildOne(PDFLib,k,TPL,d,false);
    const spec=PacketFill.DOCS.find(x=>x.key===k);save(await doc.save(),fname(d,spec.file));}
  catch(e){console.error(e);toast('Error: '+e.message);}
}
$('#btnEach').onclick=async()=>{const ks=$$('#docList input:checked').map(x=>x.value);if(!ks.length)return toast('Select at least one document');for(const k of ks){await genOne(k);await new Promise(r=>setTimeout(r,350));}};
$('#btnPacket').onclick=async()=>{
  try{const ks=$$('#docList input:checked').map(x=>x.value);if(!ks.length)return toast('Select at least one document');
    confirmIssues();const d=readForm();const p=await PacketFill.buildPacket(PDFLib,TPL,d,ks,att);
    save(await p.save(),fname(d,'Vendor-IC-Packet'));toast('Packet created');}
  catch(e){console.error(e);toast('Error: '+e.message);}
};

// ---------- records buttons ----------
$('#btnNew').onclick=()=>newRecord();
$('#btnDup').onclick=()=>{const d=readForm();const keep={};['p_first','p_last','p_id','p_street','p_city','p_state','p_zip'].forEach(k=>keep[k]=d[k]);newRecord(keep);toast('New provider for the same participant');};
$('#btnDel').onclick=()=>{const r=cur();if(!r)return;if(!$('#btnDel').dataset.arm){$('#btnDel').dataset.arm=1;$('#btnDel').textContent='Confirm delete';setTimeout(()=>{delete $('#btnDel').dataset.arm;$('#btnDel').textContent='Delete';},3000);return;}
  store.records=store.records.filter(x=>x!==r);delete $('#btnDel').dataset.arm;$('#btnDel').textContent='Delete';
  if(!store.records.length)newRecord();else{store.current=store.records[0].id;persist();writeForm(cur().data);renderRecs();}};
$('#btnExport').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(store,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`cdc-packet-records-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};
$('#imp').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const s=JSON.parse(await f.text());const recs=s.records||[];recs.forEach(r=>{if(!store.records.find(x=>x.id===r.id))store.records.push(r);});if(recs[0]){store.current=recs[0].id;writeForm(cur().data);}persist();renderRecs();toast(`Imported ${recs.length} record(s)`);}catch(err){toast('Could not read that file');}e.target.value='';};

// ---------- field map ----------
const MAP=[
 ['Participant first + last name','Participant Name','Requester name & address (box beside line 5–6); LAST NAME in bottom margin','Health Care Provider/Employer Name','Employer/Participant Name and CDC+ ID'],
 ['CDC+ ID #','Participant ID #','Requester box; bottom margin','with Employer Name','Employer/Participant Name and CDC+ ID'],
 ['Participant address','—','Requester name & address','Address of Health Care Provider','—'],
 ['Provider legal name','Vendor Name','Line 1','Employee/Contractor Name; “Under penalty of perjury, I …”','Name of Individual/Business (line 1)'],
 ['Business / DBA','Vendor Name (in parentheses)','Line 2','—','Name of Individual/Business (line 2)'],
 ['Provider address','Address (2 lines)','Lines 5 and 6','—','—'],
 ['Phone','Phone #','—','—','—'],
 ['Email','Email','—','—','Email Address of Individual/Business'],
 ['Tax ID (SSN or EIN)','Tax ID/FEIN','Part I – SSN or EIN boxes','—','—'],
 ['Provider type / entity','Q1 checkboxes','Line 3a classification (auto)','Title (default “Independent Contractor”)','“for” checkbox (IC / Vendor)'],
 ['W-9 tax classification (and LLC code)','—','Line 3a (lines 3b, 4 and 7 left blank)','—','—'],
 ['Vendor questions 2–7','Q2–Q7, Medicaid # / DOH #, circled Medicaid type','—','—','—'],
 ['Prior screening purpose / agency / date','—','—','Page 4 box','—'],
 ['Bank info','—','—','—','Account type, bank name, routing (9 boxes), account #, attachment type'],
 ['Vendor Form date','Date','—','—','—'],
 ['Signature date (optional)','—','Date beside signature','Date beside signature (p.3 or p.4)','Date'],
];
$('#mapTable').innerHTML='<table class="map"><tr><th>Master field</th><th>Vendor Information Form</th><th>IRS W-9 (Rev. 3-2024)</th><th>Good Moral Character</th><th>Direct Deposit</th></tr>'+MAP.map(r=>'<tr>'+r.map(c=>`<td>${esc(c)}</td>`).join('')+'</tr>').join('')+'</table>';
$('#showMap').onclick=()=>$('#mapModal').classList.remove('hide');

// ---------- help / privacy / wipe / install ----------
const help=$('#helpModal');
$('#btnHelp').onclick=()=>help.classList.remove('hide');
$('#helpOk').onclick=()=>{help.classList.add('hide');try{localStorage.setItem(KEY+'.welcomed','1');}catch(e){}};
$('#btnWipe').onclick=()=>{const b=$('#btnWipe');if(!b.dataset.arm){b.dataset.arm=1;b.textContent='Tap again to erase everything';setTimeout(()=>{delete b.dataset.arm;b.textContent='Erase all data on this device';},4000);return;}
  try{localStorage.removeItem(KEY);}catch(e){} store={records:[],current:null};att={};$('#att_bg').value='';$('#att_check').value='';$('#att_bg_n').textContent='';$('#att_check_n').textContent='';
  delete b.dataset.arm;b.textContent='Erase all data on this device';newRecord();toast('All saved data erased from this device');};
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#btnInstall').classList.remove('hide');});
$('#btnInstall').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('#btnInstall').classList.add('hide');};
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){navigator.serviceWorker.register('sw.js').catch(()=>{});}
try{if(!localStorage.getItem(KEY+'.welcomed'))help.classList.remove('hide');}catch(e){help.classList.remove('hide');}

// ---------- start ----------
load();
if(!store.records.length)newRecord();else{if(!cur())store.current=store.records[0].id;writeForm(cur().data);renderRecs();}
})();
