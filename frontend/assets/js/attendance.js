/* Attendance: admin marks/edits; employee views own history */
Views.attendance = async (c, _p, q) => {
  const emps = isAdmin ? await API.get('/api/employees?status=Active') : [];
  const stOpts = ['Present', 'Absent', 'Late', 'Half Day', 'Leave'];
  c.innerHTML = `
  <div class="page-head"><h4>${isAdmin ? 'Attendance' : 'My attendance'}</h4>${isAdmin ? '<button class="btn btn-primary" id="addAtt"><i class="bi bi-calendar-plus"></i> Mark attendance</button>' : ''}</div>
  ${isAdmin ? '' : '<div class="row g-3 mb-3" id="attSummary"></div>'}
  <div class="card-box mb-3"><div class="row g-2">
    ${isAdmin ? `<div class="col-md-4"><input id="fSearch" class="form-control" placeholder="Search employee name or ID"></div>
      <div class="col-md-3"><input type="date" id="fDate" class="form-control" value="${UI.esc(q.date || '')}"></div>`
      : `<div class="col-md-3"><label class="small text-muted">From</label><input type="date" id="fFrom" class="form-control"></div><div class="col-md-3"><label class="small text-muted">To</label><input type="date" id="fTo" class="form-control"></div>`}
    <div class="col-md-3 ${isAdmin ? '' : 'd-flex align-items-end'}"><select id="fStatus" class="form-select"><option value="">All status</option>${stOpts.map(s => `<option>${s}</option>`).join('')}</select></div>
    <div class="col-md-2 d-flex align-items-end"><button class="btn btn-light w-100" id="fReset">Reset</button></div></div></div>
  <div class="card-box" id="attTable"></div>`;
  const tbl = document.getElementById('attTable'); let rows = [];

  const load = async () => {
    tbl.innerHTML = UI.loading();
    try {
      rows = await API.get('/api/attendance' + API.qs(isAdmin ? { search: fSearch.value, date: fDate.value, status: fStatus.value } : { from: fFrom.value, to: fTo.value, status: fStatus.value }));
      if (!isAdmin) attSummary.innerHTML = stOpts.map(s => `<div class="col-6 col-md"><div class="card-box text-center"><div class="fs-4 fw-bold">${rows.filter(r => r.status === s).length}</div><div class="text-muted small">${s}</div></div></div>`).join('');
      const cols = [];
      if (isAdmin) cols.push({ label: 'Employee', render: r => `${UI.esc(r.full_name)}<div class="text-muted small">${UI.esc(r.emp_code)}</div>` });
      cols.push({ label: 'Date', render: r => UI.date(r.date) }, { label: 'Check-in', render: r => UI.time(r.check_in) }, { label: 'Check-out', render: r => UI.time(r.check_out) }, { label: 'Status', render: r => UI.badge(r.status) });
      if (isAdmin) cols.push({ label: 'Actions', render: r => `<button class="btn btn-sm btn-outline-primary" data-act="edit" data-id="${r.id}"><i class="bi bi-pencil"></i> Edit</button>` });
      UI.table(tbl, cols, rows, { pageSize: 10, empty: 'No attendance records found.' });
    } catch (e) { tbl.innerHTML = UI.error(e.message); }
  };

  const form = r => {
    const edit = !!r; const t = v => (v ? String(v).substring(0, 5) : '');
    UI.modal({
      title: edit ? 'Edit attendance' : 'Mark attendance',
      body: `<form novalidate class="row g-3">
        <div class="col-12"><label class="form-label">Employee *</label>${edit ? `<input class="form-control" disabled value="${UI.esc(r.full_name)}">`
          : `<select name="employee_id" class="form-select" required>${UI.options(emps, 'id', 'full_name', '', 'Select employee')}</select>`}</div>
        <div class="col-md-6"><label class="form-label">Date *</label><input type="date" name="date" class="form-control" required ${edit ? 'disabled' : ''} max="${UI.today()}" value="${edit ? String(r.date).substring(0, 10) : UI.today()}"></div>
        <div class="col-md-6"><label class="form-label">Status *</label><select name="status" class="form-select" required>${stOpts.map(s => `<option ${edit && r.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="col-md-6"><label class="form-label">Check-in</label><input type="time" name="check_in" class="form-control" value="${edit ? t(r.check_in) : '09:00'}"></div>
        <div class="col-md-6"><label class="form-label">Check-out</label><input type="time" name="check_out" class="form-control" value="${edit ? t(r.check_out) : '18:00'}"></div></form>`,
      onSave: async f => {
        const d = UI.formData(f); if (edit) d.date = String(r.date).substring(0, 10);
        const res = edit ? await API.put('/api/attendance/' + r.id, d) : await API.post('/api/attendance', d);
        UI.toast(res.message); load();
      }
    });
  };
  tbl.onclick = e => { const b = e.target.closest('[data-act]'); if (b) form(rows.find(r => r.id == b.dataset.id)); };
  const inputs = isAdmin ? [fSearch, fDate, fStatus] : [fFrom, fTo, fStatus];
  inputs.forEach(i => i.oninput = UI.debounce(load, 250));
  fReset.onclick = () => { inputs.forEach(i => i.value = ''); load(); };
  if (isAdmin) addAtt.onclick = () => form(null);
  load();
  if (q.add) form(null);
};
