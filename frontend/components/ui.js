/* Reusable UI helpers: toast, modal, confirm, table with pagination, badges, charts. */
const UI = {
  // ---- XSS protection: ALWAYS escape database text before putting it in HTML ----
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  money: n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  date: d => { if (!d) return '-'; const x = new Date(String(d).substring(0, 10) + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); },
  time: t => t ? String(t).substring(0, 5) : '-',
  today: () => new Date().toISOString().substring(0, 10),
  initials: n => String(n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
  avatar: (name, photo, cls = '') => `<span class="avatar ${cls}">${photo ? `<img src="${UI.esc(photo)}" alt="">` : UI.esc(UI.initials(name))}</span>`,

  badge(status) {
    const c = { Active: 'success', Inactive: 'secondary', Present: 'success', Absent: 'danger', Late: 'warning', 'Half Day': 'info', Leave: 'primary',
      Pending: 'warning', Approved: 'success', Rejected: 'danger', Paid: 'success' }[status] || 'secondary';
    return `<span class="badge text-bg-${c}">${UI.esc(status)}</span>`;
  },
  loading: (msg = 'Loading...') => `<div class="loading"><div class="spinner-border text-primary mb-2"></div><div>${msg}</div></div>`,
  empty: (msg, icon = 'inbox') => `<div class="empty"><i class="bi bi-${icon}"></i>${UI.esc(msg)}</div>`,
  error: msg => `<div class="alert alert-danger">${UI.esc(msg)}</div>`,

  toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast align-items-center text-bg-${type} border-0`;
    el.innerHTML = `<div class="d-flex"><div class="toast-body"></div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    el.querySelector('.toast-body').textContent = msg;
    document.getElementById('toasts').appendChild(el);
    const t = new bootstrap.Toast(el, { delay: 3500 }); t.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
  },

  /** Yes/No dialog. Returns a Promise<boolean>. */
  confirm(message, okText = 'Confirm', okClass = 'btn-danger') {
    return new Promise(resolve => {
      const m = bootstrap.Modal.getOrCreateInstance(document.getElementById('confirmModal'));
      document.getElementById('confirmText').textContent = message;
      const ok = document.getElementById('confirmOk'); ok.textContent = okText; ok.className = 'btn ' + okClass;
      let answered = false;
      ok.onclick = () => { answered = true; m.hide(); resolve(true); };
      document.getElementById('confirmModal').addEventListener('hidden.bs.modal', () => { if (!answered) resolve(false); }, { once: true });
      m.show();
    });
  },

  /** Form modal. onSave(formElement) may throw an Error -> shown inside the modal. */
  modal({ title, body, saveText = 'Save', size = '', onSave = null, onShown = null }) {
    const el = document.getElementById('appModal');
    document.getElementById('appModalDialog').className = 'modal-dialog modal-dialog-scrollable ' + size;
    document.getElementById('appModalTitle').textContent = title;
    document.getElementById('appModalBody').innerHTML = body;
    document.getElementById('appModalError').innerHTML = '';
    const save = document.getElementById('appModalSave');
    save.classList.toggle('d-none', !onSave); save.textContent = saveText; save.disabled = false;
    const m = bootstrap.Modal.getOrCreateInstance(el);
    save.onclick = async () => {
      const form = el.querySelector('form');
      if (form && !form.checkValidity()) { form.classList.add('was-validated'); form.reportValidity(); return; }
      save.disabled = true; const old = save.textContent; save.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
      try { await onSave(form); m.hide(); }
      catch (e) { document.getElementById('appModalError').innerHTML = `<div class="alert alert-danger py-2"></div>`; document.getElementById('appModalError').firstChild.textContent = e.message; }
      finally { save.disabled = false; save.textContent = old; }
    };
    m.show();
    if (onShown) onShown(el);
    return m;
  },
  closeModal: () => bootstrap.Modal.getOrCreateInstance(document.getElementById('appModal')).hide(),

  /** Table + pagination. columns: [{label, render(row)}]. Re-renders itself into `container`. */
  table(container, columns, rows, { pageSize = 8, empty = 'No records found.' } = {}) {
    let page = 1;
    const draw = () => {
      if (!rows.length) { container.innerHTML = UI.empty(empty); return; }
      const pages = Math.ceil(rows.length / pageSize); page = Math.min(page, pages);
      const slice = rows.slice((page - 1) * pageSize, page * pageSize);
      let h = `<div class="table-responsive"><table class="table align-middle table-hover mb-2"><thead><tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr></thead><tbody>`;
      slice.forEach(r => h += '<tr>' + columns.map(c => `<td>${c.render(r)}</td>`).join('') + '</tr>');
      h += `</tbody></table></div><div class="d-flex justify-content-between align-items-center"><small class="text-muted">Showing ${(page - 1) * pageSize + 1}-${(page - 1) * pageSize + slice.length} of ${rows.length}</small>`;
      if (pages > 1) {
        h += '<ul class="pagination pagination-sm mb-0">';
        h += `<li class="page-item ${page === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-pg="${page - 1}">Prev</a></li>`;
        for (let i = 1; i <= pages; i++) h += `<li class="page-item ${i === page ? 'active' : ''}"><a class="page-link" href="#" data-pg="${i}">${i}</a></li>`;
        h += `<li class="page-item ${page === pages ? 'disabled' : ''}"><a class="page-link" href="#" data-pg="${page + 1}">Next</a></li></ul>`;
      }
      container.innerHTML = h + '</div>';
      container.querySelectorAll('[data-pg]').forEach(a => a.onclick = e => { e.preventDefault(); page = +a.dataset.pg; draw(); });
    };
    draw();
  },

  /** Chart.js wrapper. data = [{label, value}] straight from the API. */
  charts: [],
  destroyCharts() { UI.charts.forEach(c => c.destroy()); UI.charts = []; },
  chart(id, type, data, label = '') {
    const el = document.getElementById(id); if (!el) return;
    if (!data || !data.length) { el.parentElement.innerHTML = UI.empty('No data yet', 'bar-chart'); return; }
    const colors = ['#0e7c86', '#e8a33d', '#3d5a80', '#c8553d', '#7a9e7e', '#8d6a9f', '#5bc0be'];
    const circular = ['doughnut', 'pie'].includes(type);
    UI.charts.push(new Chart(el, {
      type, data: { labels: data.map(d => d.label), datasets: [{ label, data: data.map(d => Number(d.value)), backgroundColor: circular ? colors : '#0e7c86', borderColor: '#0e7c86', borderWidth: type === 'line' ? 2 : 0, tension: .3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: circular, position: 'bottom' } }, scales: circular ? {} : { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    }));
  },

  /** Print any HTML in a clean new window (user can "Save as PDF"). */
  printHtml(title, html) {
    const w = window.open('', '_blank');
    if (!w) { UI.toast('Please allow pop-ups to print.', 'warning'); return; }
    w.document.write(`<html><head><title>${UI.esc(title)}</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>body{padding:24px;font-family:system-ui,sans-serif}.payslip{border:2px solid #10262e;padding:24px;max-width:640px;margin:auto}</style></head><body>${html}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 600);
  },

  /** Download rows (array of objects) as a CSV file */
  csv(filename, rows) {
    if (!rows.length) { UI.toast('Nothing to export.', 'warning'); return; }
    const keys = Object.keys(rows[0]);
    const cell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const text = [keys.join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = filename; a.click();
  },
  debounce: (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
  /** Read all fields of a <form> into an object */
  formData: form => Object.fromEntries(new FormData(form).entries()),
  options: (items, valKey, textKey, selected = '', blank = '') => (blank ? `<option value="">${blank}</option>` : '') + items.map(i => `<option value="${UI.esc(i[valKey])}" ${String(i[valKey]) === String(selected) ? 'selected' : ''}>${UI.esc(i[textKey])}</option>`).join('')
};

/** Each page registers itself here: Views.employees = async (container, param, query) => {...} */
const Views = {};
