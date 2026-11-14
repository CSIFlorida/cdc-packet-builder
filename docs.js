/* Consumer documents (Budget Calculation Worksheet, Cost Plan, monthly statement, …) kept in this browser's IndexedDB. */
(function () {
  const DB = 'cdcDocs', ST = 'docs';
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(ST, { keyPath: 'id' }); s.createIndex('cid', 'cid'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(ST, mode), s = t.objectStore(ST); const out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  window.CDCDocs = {
    async add(cid, kind, file, extra) { const rec = Object.assign({ id: uid(), cid, kind, name: file.name, type: file.type || 'application/pdf', size: file.size, added: new Date().toISOString(), bytes: new Uint8Array(await file.arrayBuffer()) }, extra || {}); await tx('readwrite', s => s.put(rec)); return rec; },
    async update(rec) { await tx('readwrite', s => s.put(rec)); },
    async list(cid) { try { return await tx('readonly', s => s.index('cid').getAll(cid)); } catch (e) { return []; } },
    async get(id) { return tx('readonly', s => s.get(id)); },
    async del(id) { await tx('readwrite', s => s.delete(id)); },
    async delFor(cid) { const l = await this.list(cid); for (const d of l) await this.del(d.id); },
    async all() { try { return await tx('readonly', s => s.getAll()); } catch (e) { return []; } },
    async exportAll() { return (await this.all()).map(d => Object.assign({}, d, { bytes: b64(d.bytes) })); },
    async importAll(list) { let n = 0; for (const d of list || []) { if (!d.id || !d.bytes) continue; await tx('readwrite', s => s.put(Object.assign({}, d, { bytes: unb64(d.bytes) }))); n++; } return n; },
    async wipe() { await tx('readwrite', s => s.clear()).catch(() => {}); },
  };
})();
