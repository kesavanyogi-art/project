/* Leave management: employee applies; admin approves / rejects */
Views.leaves = async (c, _p, q) => {
  const types = ['Casual Leave', 'Sick Leave', 'Emergency Leave', 'Other'];
  c.innerHTML = `
  <div class="page-head"><h4>${isAdmin ? 'Leave management' : 'My leave'}</h4>${isAdmin ? '' : '<button class="btn btn-primary" id="applyBtn"><i class="bi bi-envelope-plus"></i> Apply for leave</button>'}</div>
  <div class="card-box mb-3"><div class="row g-2">
    ${isAdmin ? '<div class="col-md-3"><input id="fSearch" class="form-control" placeholder="Search employee"></div>' : ''}
    <div class="col-md-3"><select id="fType" class="form-select"><option value="">All leave types</option>${types.map(t => `<option>${t}</option>`).join('')}</select></div>
    <div class="col-md-2"><select id="fStatus" class="form-select"><option value="">All status</option><option>Pending</option><option>Approved</option><option>Rejected</option></select></div>
    ${isAdmin ? '<div class="col-md-2"><input type="date" id="fDate" class="form-control" title="Leave covering this date"></div>' : ''}
    <div class="col-md-2"><button class="btn btn-light w-100" id="fReset">Reset</button></div></div></div>
  <div class="card-box" id="leaveTable"></div>`;
  const tbl = document.getElementById('leaveTable'); let rows = []; fStatus.value = q.status || '';
  const ctl = () => [fType, fStatus, ...(isAdmin ? [fSearch, fDate] : [])];

  const load = async () => {
    tbl.innerHTML = UI.loading();
    try {
      rows = await API.get('/api/leaves' + API.qs({ type: fType.value, status: fStatus.value, search: isAdmin ? fSearch.value : '', date: isAdmin ? fDate.value : '' }));
      const cols = [];
      if (isAdmin) cols.push({ label: 'Employee', render: r => `${UI.esc(r.full_name)}<div class="text-muted small">${UI.esc(r.emp_code)}</div>` });
      cols.push({ label: 'Type', render: r => UI.esc(r.leave_type) }, { label: 'From', render: r => UI.date(r.start_date) }, { label: 'To', render: r => UI.date(r.end_date) },
        { label: 'Days', render: r => r.days }, { label: 'Reason', render: r => `<span title="${UI.esc(r.reason)}">${UI.esc(String(r.reason).substring(0, 40))}${r.reason.length > 40 ? '...' : ''}</span>` },
        { label: 'Status', render: r => UI.badge(r.status) }, { label: 'Admin remarks', render: r => UI.esc(r.admin_remarks || '-') });
      if (isAdmin) cols.push({ label: 'Actions', render: r => r.status === 'Pending'
        ? `<div class="btn-group btn-group-sm"><button class="btn btn-success" data-act="approve" data-id="${r.id}">Approve</button><button class="btn btn-outline-danger" data-act="reject" data-id="${r.id}">Reject</button></div>` : '-' });
      UI.table(tbl, cols, rows, { pageSize: 8, empty: 'No leave requests found.' });
    } catch (e) { tbl.innerHTML = UI.error(e.message); }
  };

  const decide = (r, action) => UI.modal({
    title: (action === 'approve' ? 'Approve' : 'Reject') + ' leave - ' + r.full_name, saveText: action === 'approve' ? 'Approve' : 'Reject',
    body: `<p class="mb-2">${UI.esc(r.leave_type)}: ${UI.date(r.start_date)} to ${UI.date(r.end_date)} (${r.days} day/s)<br><span class="text-muted">${UI.esc(r.reason)}</span></p>
      <form novalidate><label class="form-label">Remarks</label><textarea name="admin_remarks" class="form-control" rows="2" maxlength="255"></textarea></form>`,
    onSave: async f => { UI.toast((await API.put(`/api/leaves/${r.id}/${action}`, UI.formData(f))).message); load(); }
  });
  tbl.onclick = e => { const b = e.target.closest('[data-act]'); if (b) decide(rows.find(r => r.id == b.dataset.id), b.dataset.act); };

  const applyForm = () => UI.modal({
    title: 'Apply for leave', saveText: 'Submit request',
    body: `<form novalidate class="row g-3">
      <div class="col-12"><label class="form-label">Leave type *</label><select name="leave_type" class="form-select" required>${types.map(t => `<option>${t}</option>`).join('')}</select></div>
      <div class="col-md-6"><label class="form-label">Start date *</label><input type="date" name="start_date" id="ls" class="form-control" required value="${UI.today()}"></div>
      <div class="col-md-6"><label class="form-label">End date *</label><input type="date" name="end_date" id="le" class="form-control" required value="${UI.today()}"></div>
      <div class="col-12"><label class="form-label">Reason *</label><textarea name="reason" class="form-control" rows="3" required minlength="5" maxlength="500"></textarea></div></form>`,
    onShown: () => { ls.onchange = () => { le.min = ls.value; if (le.value < ls.value) le.value = ls.value; }; },
    onSave: async f => { UI.toast((await API.post('/api/leaves', UI.formData(f))).message); load(); }
  });
  ctl().forEach(i => i.oninput = UI.debounce(load, 250));
  fReset.onclick = () => { ctl().forEach(i => i.value = ''); load(); };
  if (!isAdmin) applyBtn.onclick = applyForm;
  load();
  if (q.apply && !isAdmin) applyForm();
};
