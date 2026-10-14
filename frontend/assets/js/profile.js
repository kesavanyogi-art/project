/* Profile (admin account / employee profile) and Settings (change password) */
Views.profile = async c => {
  if (isAdmin) {
    const u = await API.get('/api/auth/me');
    c.innerHTML = `<div class="page-head"><h4>Admin profile</h4></div>
      <div class="card-box" style="max-width:560px"><div class="d-flex align-items-center gap-3 mb-3">${UI.avatar(u.fullName, null, 'avatar-lg')}<div><h5 class="mb-0">${UI.esc(u.username)}</h5><span class="badge text-bg-dark">${UI.esc(u.role)}</span></div></div>
      <form id="adminForm" novalidate><div class="mb-3"><label class="form-label">Username *</label><input name="username" class="form-control" required maxlength="50" value="${UI.esc(u.username)}"></div>
        <div class="mb-3"><label class="form-label">Email *</label><input type="email" name="email" class="form-control" required value="${UI.esc(u.email)}"></div>
        <button class="btn btn-primary">Save changes</button></form></div>`;
    adminForm.onsubmit = async e => {
      e.preventDefault(); if (!adminForm.checkValidity()) { adminForm.classList.add('was-validated'); return; }
      try { const r = await API.put('/api/auth/profile', UI.formData(adminForm)); UI.toast(r.message);
        const s = API.user(); const d = UI.formData(adminForm); s.username = d.username; s.email = d.email; s.fullName = d.username; localStorage.setItem('ems_user', JSON.stringify(s));
      } catch (x) { UI.toast(x.message, 'danger'); }
    };
    return;
  }
  const load = async () => renderProfile(c, await API.get('/api/employees/me'), false, load);
  await load();
};

/** Employees may edit only phone, address, emergency contact and photo */
function openSelfEditForm(e, onDone) {
  let photo = null;
  UI.modal({
    title: 'Edit my profile', saveText: 'Save changes',
    body: `<form novalidate class="row g-3"><div class="col-12 text-muted small">Name, department, designation and salary can only be changed by the admin.</div>
      <div class="col-md-6"><label class="form-label">Phone *</label><input name="phone" class="form-control" required pattern="\\+?[0-9]{10,13}" title="10 to 13 digits" value="${UI.esc(e.phone)}"></div>
      <div class="col-md-6"><label class="form-label">Emergency contact</label><input name="emergency_contact" class="form-control" pattern="\\+?[0-9]{10,13}" title="10 to 13 digits" value="${UI.esc(e.emergency_contact)}"></div>
      <div class="col-12"><label class="form-label">Address *</label><textarea name="address" class="form-control" rows="2" required maxlength="255">${UI.esc(e.address)}</textarea></div>
      <div class="col-12"><label class="form-label">Profile photo</label><input type="file" id="selfPhoto" accept="image/*" class="form-control"></div></form>`,
    onShown: () => { selfPhoto.onchange = async ev => { try { photo = await resizeImage(ev.target.files[0]); } catch (x) { UI.toast(x.message, 'danger'); ev.target.value = ''; } }; },
    onSave: async f => { const d = UI.formData(f); if (photo) d.profile_photo = photo; UI.toast((await API.put('/api/employees/me', d)).message); onDone && onDone(); }
  });
}

Views.settings = async c => {
  c.innerHTML = `<div class="page-head"><h4>Settings</h4></div>
  <div class="card-box" style="max-width:520px"><h6>Change password</h6>
    <form id="pwForm" novalidate>
      <div class="mb-3"><label class="form-label">Current password *</label><input type="password" name="currentPassword" class="form-control" required autocomplete="current-password"></div>
      <div class="mb-3"><label class="form-label">New password *</label><input type="password" name="newPassword" id="npw" class="form-control" required autocomplete="new-password"
        pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$" title="Min 8 characters with uppercase, lowercase, number and special character">
        <div class="form-text">At least 8 characters with uppercase, lowercase, a number and a special character.</div></div>
      <div class="mb-3"><label class="form-label">Confirm new password *</label><input type="password" id="cpw" class="form-control" required autocomplete="new-password"><div class="invalid-feedback">Passwords do not match.</div></div>
      <button class="btn btn-primary">Change password</button></form></div>`;
  pwForm.onsubmit = async e => {
    e.preventDefault();
    cpw.setCustomValidity(cpw.value === npw.value ? '' : 'Passwords do not match.');
    if (!pwForm.checkValidity()) { pwForm.classList.add('was-validated'); return; }
    try { UI.toast((await API.post('/api/auth/change-password', UI.formData(pwForm))).message); pwForm.reset(); pwForm.classList.remove('was-validated'); }
    catch (x) { UI.toast(x.message, 'danger'); }
  };
  cpw.oninput = () => cpw.setCustomValidity('');
};
