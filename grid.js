/* Small editable line table used by the Purchasing Plan and the Consumer Database.
   Rows are kept as JSON in a hidden form field so they are saved with the record. */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  window.LineGrid = function Grid(id, field, cols, opts) {
    const box = $('#' + id), hidden = document.querySelector(`[name=${field}]`);
    let rows = [], rendered = null;
    const read = () => { try { const a = JSON.parse(hidden.value || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
    const commit = () => { hidden.value = JSON.stringify(rows); rendered = hidden.value; hidden.dispatchEvent(new Event('input', { bubbles: true })); };
    function cell(c, r, i) {
      const v = r[c.k] == null ? '' : r[c.k], a = `data-i="${i}" data-k="${c.k}"`;
      if (c.calc) return `<td class="calc" data-calc="${c.k}" data-i="${i}"></td>`;
      if (c.sel) return `<td><select ${a}>${typeof c.sel === 'function' ? c.sel(r) : c.sel}</select></td>`;
      if (c.area) return `<td><textarea ${a} rows="2">${esc(v)}</textarea></td>`;
      return `<td><input ${a} type="${c.t || 'text'}" ${c.list ? `list="${c.list}"` : ''} ${c.num ? 'inputmode="decimal"' : ''} value="${esc(v)}" ${c.ph ? `placeholder="${esc(c.ph)}"` : ''}></td>`;
    }
    function render() {
      rows = read(); rendered = hidden.value;
      const head = `<tr><th>#</th>${cols.map(c => `<th${c.w ? ` style="min-width:${c.w}px"` : ''}>${c.h}</th>`).join('')}<th></th></tr>`;
      const body = rows.map((r, i) => `<tr class="${opts.rowClass ? opts.rowClass(r) : ''}"><td class="ix">${i + 1}</td>${cols.map(c => cell(c, r, i)).join('')}<td class="act">${opts.extra ? opts.extra(r, i) : ''}<button type="button" class="sm" data-up="${i}" title="Move up">↑</button><button type="button" class="sm" data-down="${i}" title="Move down">↓</button><button type="button" class="sm danger" data-del="${i}" title="Remove line">✕</button></td></tr>`).join('');
      box.innerHTML = `<div class="tblwrap"><table class="lines">${head}${body}</table></div><div class="btnrow"><button type="button" class="sm" data-add>+ Add line</button>${opts.addExtra || ''}<span class="file">${rows.length} of ${opts.max}</span></div>`;
      box.querySelectorAll('select[data-k]').forEach(s => { s.value = rows[+s.dataset.i][s.dataset.k] == null ? '' : rows[+s.dataset.i][s.dataset.k]; });
    }
    box.addEventListener('input', e => {
      const el = e.target; if (el.dataset.k == null) return; e.stopPropagation();
      const r = rows[+el.dataset.i]; r[el.dataset.k] = el.value;
      if (opts.onEdit && opts.onEdit(r, el.dataset.k, +el.dataset.i, rows)) { commit(); render(); return; }
      commit();
    });
    box.addEventListener('change', e => { if (e.target.tagName === 'SELECT' && e.target.dataset.k != null && opts.rerenderOn && opts.rerenderOn.includes(e.target.dataset.k)) render(); });
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-add')) { if (rows.length >= opts.max) return; rows.push(opts.blank ? opts.blank() : {}); }
      else if (b.dataset.del != null) rows.splice(+b.dataset.del, 1);
      else if (b.dataset.up != null) { const i = +b.dataset.up; if (i > 0) [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; }
      else if (b.dataset.down != null) { const i = +b.dataset.down; if (i < rows.length - 1) [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; }
      else if (opts.onButton && opts.onButton(b, rows) === false) return;
      else if (!opts.onButton) return;
      commit(); render();
    });
    return {
      sync() { if (hidden.value !== rendered) render(); },
      setCalc(fn) { box.querySelectorAll('td.calc').forEach(td => { td.textContent = fn(td.dataset.calc, +td.dataset.i); }); },
    };
  }

})();
