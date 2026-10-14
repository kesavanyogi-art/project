/* Departments: admin manages them; employee sees own department */
Views.departments = async c => {
  c.innerHTML = `<div class="page-head"><h4>Departments</h4><button class="btn btn-primary" id="addDept"><i class="bi bi-plus-lg"></i> Add department</button></div><div class="card-box" id="deptTable"></div>`;
  const tbl = document.getElementById('deptTable'); let rows = [];
  const load = async () => {
    rows = await API.get('/api/departments');
    UI.table(tbl, [
      { label: 'Department', render: r => `<a href="#" data-act="view" data-id="${r.id}" class="fw-semibold text-decoration-none">${UI.esc(r.department_name)}</a>` },
      { label: 'Description', render: r => UI.esc(r.description) },
      { label: 'Employees', render: r => `<span class="badge text-bg-light border">${r.employee_count}</span>` },
      { label: 'Created', render: r => UI.date(r.created_at) },
      { label: 'Actions', render: r => `<div class="btn-group btn-group-sm"><button class="btn btn-outline-secondary" data-act="view" data-id="${r.id}"><i class="bi bi-eye"></i></button>
        <button class="btn btn-outline-primary" data-act="edit" data-id="${r.id}"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-outline-danger" data-act="del" data-id="${r.id}"><i class="bi bi-trash"></i></button></div>` }], rows, { empty: 'No departments yet. Add your first department.' });
  };
  const form = d => UI.modal({
    title: d ? 'Edit department' : 'Add department', saveText: 'Save',
    body: `<form novalidate><div class="mb-3"><label class="form-label">Department name *</label><input name="department_name" class="form-control" required maxlength="80" value="${UI.esc(d?.department_name)}"></div>
      <div><label class="form-label">Description</label><textarea name="description" class="form-control" rows="3" maxlength="255">${UI.esc(d?.description)}</textarea></div></form>`,
    onSave: async f => { const r = d ? await API.put('/api/departments/' + d.id, UI.formData(f)) : await API.post('/api/departments', UI.formData(f)); UI.toast(r.message); load(); }
  });
  tbl.onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return; e.preventDefault();
    const d = rows.find(r => r.id == b.dataset.id);
    try {
      if (b.dataset.act === 'edit') form(d);
      if (b.dataset.act === 'view') showDepartment(await API.get('/api/departments/' + d.id));
      if (b.dataset.act === 'del' && await UI.confirm(`Delete the ${d.department_name} department?`, 'Delete')) { UI.toast((await API.del('/api/departments/' + d.id)).message); load(); }
    } catch (x) { UI.toast(x.message, 'danger'); }
  };
  addDept.onclick = () => form(null);
  load();
};

function showDepartment(d) {
  UI.modal({ title: d.department_name, size: 'modal-lg', body: `<p class="text-muted">${UI.esc(d.description || 'No description')}</p><h6>Employees (${d.employees.length})</h6>` +
    (d.employees.length ? `<table class="table table-sm"><thead><tr><th>ID</th><th>Name</th><th>Designation</th><th>Status</th></tr></thead><tbody>${d.employees.map(x =>
      `<tr><td>${UI.esc(x.employee_id)}</td><td>${UI.esc(x.full_name)}</td><td>${UI.esc(x.designation)}</td><td>${UI.badge(x.status)}</td></tr>`).join('')}</tbody></table>` : UI.empty('No employees in this department.')) });
}

Views.department = async c => {   // employee: "My Department"
  const emp = await API.get('/api/employees/me');
  const d = await API.get('/api/departments/' + emp.department_id);
  c.innerHTML = `<div class="page-head"><h4>My department: ${UI.esc(d.department_name)}</h4></div>
    <div class="card-box mb-3"><p class="mb-0">${UI.esc(d.description || 'No description available.')}</p></div>
    <div class="card-box"><h6>Team members</h6><div id="team"></div></div>`;
  UI.table(document.getElementById('team'), [
    { label: 'Name', render: r => UI.esc(r.full_name) }, { label: 'Designation', render: r => UI.esc(r.designation) }, { label: 'Status', render: r => UI.badge(r.status) }], d.employees);
};
