/* Employee management (admin) + shared employee profile view */
let DEPTS = [];
const loadDepts = async () => (DEPTS = await API.get('/api/departments'));

/** Shrink a chosen image to max 300px and return a small base64 string */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const s = Math.min(1, 300 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = img.width * s; cv.height = img.height * s; cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/jpeg', 0.8)); }; img.onerror = () => reject(new Error('Invalid image.')); img.src = r.result; };
    r.readAsDataURL(file);
  });
}

Views.employees = async (c, _p, q) => {
  await loadDepts();
  c.innerHTML = `
  <div class="page-head"><h4>Employees</h4><button class="btn btn-primary" id="addEmp"><i class="bi bi-person-plus"></i> Add employee</button></div>
  <div class="card-box mb-3"><div class="row g-2">
    <div class="col-md-5"><input id="fSearch" class="form-control" placeholder="Search by ID, name, email, department, designation" value="${UI.esc(q.search || '')}"></div>
    <div class="col-md-3"><select id="fDept" class="form-select">${UI.options(DEPTS, 'id', 'department_name', '', 'All departments')}</select></div>
    <div class="col-md-2"><select id="fStatus" class="form-select"><option value="">All status</option><option>Active</option><option>Inactive</option></select></div>
    <div class="col-md-2"><button class="btn btn-light w-100" id="fReset">Reset</button></div></div></div>
  <div class="card-box" id="empTable"></div>`;
  const tbl = document.getElementById('empTable'); fStatus.value = q.status || '';
  let rows = [];

  const load = async () => {
    tbl.innerHTML = UI.loading();
    try {
      rows = await API.get('/api/employees' + API.qs({ search: fSearch.value, department: fDept.value, status: fStatus.value }));
      UI.table(tbl, [
        { label: 'ID', render: r => UI.esc(r.employee_id) },
        { label: 'Employee', render: r => `<div class="d-flex align-items-center gap-2">${UI.avatar(r.full_name)}<div><a href="#employee/${r.id}" class="fw-semibold text-decoration-none">${UI.esc(r.full_name)}</a><div class="text-muted small">${UI.esc(r.email)}</div></div></div>` },
        { label: 'Department', render: r => UI.esc(r.department_name) },
        { label: 'Designation', render: r => UI.esc(r.designation) },
        { label: 'Type', render: r => UI.esc(r.employment_type) },
        { label: 'Status', render: r => UI.badge(r.status) },
        { label: 'Actions', render: r => `<div class="btn-group btn-group-sm">
            <a class="btn btn-outline-secondary" href="#employee/${r.id}" title="View"><i class="bi bi-eye"></i></a>
            <button class="btn btn-outline-primary" data-act="edit" data-id="${r.id}" title="Edit"><i class="bi bi-pencil"></i></button>
            ${r.status === 'Active' ? `<button class="btn btn-outline-danger" data-act="deactivate" data-id="${r.id}" title="Deactivate"><i class="bi bi-person-x"></i></button>`
              : `<button class="btn btn-outline-success" data-act="activate" data-id="${r.id}" title="Activate"><i class="bi bi-person-check"></i></button>`}</div>` }
      ], rows, { empty: 'No employees found.' });
    } catch (e) { tbl.innerHTML = UI.error(e.message); }
  };

  tbl.onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id;
    try {
      if (b.dataset.act === 'edit') openEmployeeForm(await API.get('/api/employees/' + id), load);
      if (b.dataset.act === 'deactivate' && await UI.confirm('Are you sure you want to deactivate this employee?', 'Deactivate')) { UI.toast((await API.del('/api/employees/' + id)).message); load(); }
      if (b.dataset.act === 'activate' && await UI.confirm('Activate this employee again?', 'Activate', 'btn-success')) { UI.toast((await API.put('/api/employees/' + id + '/status', { status: 'Active' })).message); load(); }
    } catch (x) { UI.toast(x.message, 'danger'); }
  };
  fSearch.oninput = UI.debounce(load); fDept.onchange = load; fStatus.onchange = load;
  fReset.onclick = () => { fSearch.value = ''; fDept.value = ''; fStatus.value = ''; load(); };
  addEmp.onclick = () => openEmployeeForm(null, load);
  load();
  if (q.add) openEmployeeForm(null, load);
};

/** Add / Edit modal. emp = null for a new employee */
async function openEmployeeForm(emp, onDone) {
  if (!DEPTS.length) await loadDepts();
  const e = emp || {}, edit = !!emp; let photo = null;
  const sel = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('');
  UI.modal({
    title: edit ? 'Edit employee' : 'Add employee', size: 'modal-lg', saveText: edit ? 'Save changes' : 'Add employee',
    body: `<form novalidate class="row g-3">
      <div class="col-md-4"><label class="form-label">Employee ID</label><input name="employee_id" class="form-control" value="${UI.esc(e.employee_id)}" ${edit ? 'required' : ''} placeholder="${edit ? '' : 'Auto-generated if empty'}" maxlength="20"></div>
      <div class="col-md-8"><label class="form-label">Full name *</label><input name="full_name" class="form-control" required maxlength="100" value="${UI.esc(e.full_name)}"></div>
      <div class="col-md-4"><label class="form-label">Gender *</label><select name="gender" class="form-select" required>${sel(['Male', 'Female', 'Other'], e.gender)}</select></div>
      <div class="col-md-4"><label class="form-label">Date of birth *</label><input type="date" name="dob" class="form-control" required max="${UI.today()}" value="${UI.esc(String(e.dob || '').substring(0, 10))}"></div>
      <div class="col-md-4"><label class="form-label">Profile photo</label><input type="file" id="photoIn" accept="image/*" class="form-control"></div>
      <div class="col-md-6"><label class="form-label">Email *</label><input type="email" name="email" class="form-control" required value="${UI.esc(e.email)}"></div>
      <div class="col-md-3"><label class="form-label">Phone *</label><input name="phone" class="form-control" required pattern="\\+?[0-9]{10,13}" title="10 to 13 digits" value="${UI.esc(e.phone)}"></div>
      <div class="col-md-3"><label class="form-label">Emergency contact</label><input name="emergency_contact" class="form-control" pattern="\\+?[0-9]{10,13}" title="10 to 13 digits" value="${UI.esc(e.emergency_contact)}"></div>
      <div class="col-12"><label class="form-label">Address *</label><textarea name="address" class="form-control" rows="2" required maxlength="255">${UI.esc(e.address)}</textarea></div>
      <div class="col-md-4"><label class="form-label">Department *</label><select name="department_id" class="form-select" required>${UI.options(DEPTS, 'id', 'department_name', e.department_id, 'Select department')}</select></div>
      <div class="col-md-4"><label class="form-label">Designation *</label><input name="designation" class="form-control" required maxlength="80" value="${UI.esc(e.designation)}"></div>
      <div class="col-md-4"><label class="form-label">Date of joining *</label><input type="date" name="joining_date" class="form-control" required value="${UI.esc(String(e.joining_date || UI.today()).substring(0, 10))}"></div>
      <div class="col-md-4"><label class="form-label">Employment type *</label><select name="employment_type" class="form-select" required>${sel(['Full-Time', 'Part-Time', 'Contract', 'Intern'], e.employment_type)}</select></div>
      <div class="col-md-4"><label class="form-label">Salary (monthly) *</label><input type="number" name="salary" class="form-control" required min="1" step="0.01" value="${UI.esc(e.salary)}"></div>
      <div class="col-md-4"><label class="form-label">Status</label><select name="status" class="form-select">${sel(['Active', 'Inactive'], e.status)}</select></div>
      ${edit ? '' : `<div class="col-12"><label class="form-label">Login password</label><input type="text" name="password" class="form-control" placeholder="Default: Employee@123"
        pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$" title="Min 8 characters with uppercase, lowercase, number and special character"><div class="form-text">The employee logs in with the email above.</div></div>`}
    </form>`,
    onShown: () => { document.getElementById('photoIn').onchange = async ev => { try { photo = await resizeImage(ev.target.files[0]); } catch (x) { UI.toast(x.message, 'danger'); ev.target.value = ''; } }; },
    onSave: async form => {
      const data = UI.formData(form); if (photo) data.profile_photo = photo;
      const r = edit ? await API.put('/api/employees/' + e.id, data) : await API.post('/api/employees', data);
      UI.toast(r.message); onDone && onDone();
    }
  });
}

/** Detailed profile page (used by admin for any employee, and by employee for self) */
function renderProfile(c, e, admin, reload) {
  const a = e.attendanceSummary, l = e.leaveSummary;
  const kv = rows => `<dl class="kv mb-0">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  c.innerHTML = `
  <div class="page-head"><h4>${admin ? 'Employee profile' : 'My profile'}</h4>
    <div>${admin ? '<a href="#employees" class="btn btn-light btn-sm">Back</a> ' : ''}<button class="btn btn-primary btn-sm" id="editProf"><i class="bi bi-pencil"></i> Edit profile</button></div></div>
  <div class="row g-3">
    <div class="col-lg-4"><div class="card-box text-center">
      ${UI.avatar(e.full_name, e.profile_photo, 'avatar-lg mb-2')}
      <h5 class="mb-0">${UI.esc(e.full_name)}</h5><div class="text-muted">${UI.esc(e.designation)}</div>
      <div class="my-2">${UI.badge(e.status)}</div><div class="small text-muted">${UI.esc(e.employee_id)} &middot; ${UI.esc(e.department_name)}</div></div></div>
    <div class="col-lg-8 d-grid gap-3">
      <div class="card-box"><h6>Personal information</h6>${kv([['Gender', UI.esc(e.gender)], ['Date of birth', UI.date(e.dob)], ['Created', UI.date(e.created_at)]])}</div>
      <div class="card-box"><h6>Contact information</h6>${kv([['Email', UI.esc(e.email)], ['Phone', UI.esc(e.phone)], ['Address', UI.esc(e.address)], ['Emergency contact', UI.esc(e.emergency_contact || '-')]])}</div>
      <div class="card-box"><h6>Job information</h6>${kv([['Department', UI.esc(e.department_name)], ['Designation', UI.esc(e.designation)], ['Joining date', UI.date(e.joining_date)], ['Employment type', UI.esc(e.employment_type)], ['Salary', UI.money(e.salary)]])}</div>
      <div class="row g-3"><div class="col-md-6"><div class="card-box h-100"><h6>Attendance summary</h6>${kv(Object.entries(a).map(([k, v]) => [k, v]))}</div></div>
        <div class="col-md-6"><div class="card-box h-100"><h6>Leave summary</h6>${kv([['Approved requests', l.Approved], ['Pending requests', l.Pending], ['Rejected requests', l.Rejected], ['Approved leave days', l.approvedDays]])}</div></div></div>
    </div></div>`;
  document.getElementById('editProf').onclick = () => admin ? openEmployeeForm(e, reload) : openSelfEditForm(e, reload);
}

Views.employee = async (c, id) => {
  const load = async () => renderProfile(c, await API.get('/api/employees/' + id), true, load);
  await load();
};
