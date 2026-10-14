/* Payroll: admin processes salary; both can view payslips */
const monthLabel = m => { const [y, mo] = String(m).split('-'); return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); };

function payslipHtml(r) {
  const row = (k, v, b = '') => `<tr class="${b}"><td>${k}</td><td class="text-end">${v}</td></tr>`;
  return `<div class="payslip"><div class="text-center mb-3"><h4 class="mb-0">PAYSLIP</h4><div class="text-muted">Employee Management System - ${UI.esc(monthLabel(r.salary_month))}</div></div>
    <table class="table table-sm table-borderless mb-3"><tr><td>Employee name</td><td class="fw-semibold">${UI.esc(r.full_name)}</td><td>Employee ID</td><td class="fw-semibold">${UI.esc(r.emp_code)}</td></tr>
      <tr><td>Department</td><td>${UI.esc(r.department_name)}</td><td>Designation</td><td>${UI.esc(r.designation)}</td></tr>
      <tr><td>Salary month</td><td>${UI.esc(monthLabel(r.salary_month))}</td><td>Payment status</td><td>${UI.esc(r.payment_status)}</td></tr></table>
    <table class="table table-bordered mb-0"><thead class="table-light"><tr><th>Description</th><th class="text-end">Amount</th></tr></thead><tbody>
      ${row('Basic salary', UI.money(r.basic_salary))}${row('Allowances', UI.money(r.allowances))}${row('Bonus', UI.money(r.bonus))}${row('Deductions', '- ' + UI.money(r.deductions))}
      ${row('Net salary', UI.money(r.net_salary), 'table-light fw-bold')}</tbody></table>
    <p class="text-muted small mt-3 mb-0">Net Salary = Basic Salary + Allowances + Bonus - Deductions. This is a computer-generated payslip.</p></div>`;
}
const showPayslip = r => UI.modal({ title: 'Payslip', size: 'modal-lg', body: payslipHtml(r), saveText: 'Print / Download PDF', onSave: async () => UI.printHtml('Payslip ' + r.emp_code + ' ' + r.salary_month, payslipHtml(r)) });

Views.payroll = async (c, _p, q) => {
  const emps = isAdmin ? await API.get('/api/employees?status=Active') : [];
  const thisMonth = new Date().toISOString().substring(0, 7);
  c.innerHTML = `
  <div class="page-head"><h4>${isAdmin ? 'Payroll' : 'My salary'}</h4>${isAdmin ? '<button class="btn btn-primary" id="addPay"><i class="bi bi-cash-coin"></i> Process payroll</button>' : ''}</div>
  <div class="card-box mb-3"><div class="row g-2">
    <div class="col-md-3"><input type="month" id="fMonth" class="form-control" title="Salary month"></div>
    ${isAdmin ? '<div class="col-md-4"><input id="fSearch" class="form-control" placeholder="Search employee name or ID"></div>' : ''}
    <div class="col-md-3"><select id="fStatus" class="form-select"><option value="">All payment status</option><option>Pending</option><option>Paid</option></select></div>
    <div class="col-md-2"><button class="btn btn-light w-100" id="fReset">Reset</button></div></div></div>
  <div class="card-box" id="payTable"></div>`;
  const tbl = document.getElementById('payTable'); let rows = [];
  const ctl = () => [fMonth, fStatus, ...(isAdmin ? [fSearch] : [])];

  const load = async () => {
    tbl.innerHTML = UI.loading();
    try {
      rows = await API.get('/api/payroll' + API.qs({ month: fMonth.value, status: fStatus.value, search: isAdmin ? fSearch.value : '' }));
      const cols = [];
      if (isAdmin) cols.push({ label: 'Employee', render: r => `${UI.esc(r.full_name)}<div class="text-muted small">${UI.esc(r.emp_code)}</div>` });
      cols.push({ label: 'Month', render: r => UI.esc(monthLabel(r.salary_month)) }, { label: 'Basic', render: r => UI.money(r.basic_salary) }, { label: 'Allowances', render: r => UI.money(r.allowances) },
        { label: 'Bonus', render: r => UI.money(r.bonus) }, { label: 'Deductions', render: r => UI.money(r.deductions) }, { label: 'Net salary', render: r => `<strong>${UI.money(r.net_salary)}</strong>` },
        { label: 'Status', render: r => UI.badge(r.payment_status) },
        { label: 'Actions', render: r => `<div class="btn-group btn-group-sm"><button class="btn btn-outline-secondary" data-act="slip" data-id="${r.id}"><i class="bi bi-receipt"></i> Payslip</button>${isAdmin ? `<button class="btn btn-outline-primary" data-act="edit" data-id="${r.id}"><i class="bi bi-pencil"></i></button>` : ''}</div>` });
      UI.table(tbl, cols, rows, { empty: 'No payroll records found.' });
    } catch (e) { tbl.innerHTML = UI.error(e.message); }
  };

  const form = r => {
    const edit = !!r, v = k => (edit ? r[k] : (k === 'payment_status' ? 'Pending' : 0));
    UI.modal({
      title: edit ? 'Edit payroll' : 'Process payroll', size: 'modal-lg',
      body: `<form novalidate class="row g-3">
        <div class="col-md-8"><label class="form-label">Employee *</label>${edit ? `<input class="form-control" disabled value="${UI.esc(r.full_name)}">`
          : `<select name="employee_id" id="pEmp" class="form-select" required>${UI.options(emps, 'id', 'full_name', '', 'Select employee')}</select>`}</div>
        <div class="col-md-4"><label class="form-label">Salary month *</label><input type="month" name="salary_month" class="form-control" required ${edit ? 'readonly' : ''} value="${edit ? r.salary_month : thisMonth}"></div>
        <div class="col-md-3"><label class="form-label">Basic salary *</label><input type="number" name="basic_salary" id="pB" class="form-control" required min="0" step="0.01" value="${v('basic_salary')}"></div>
        <div class="col-md-3"><label class="form-label">Allowances</label><input type="number" name="allowances" id="pA" class="form-control" min="0" step="0.01" value="${v('allowances')}"></div>
        <div class="col-md-3"><label class="form-label">Bonus</label><input type="number" name="bonus" id="pBo" class="form-control" min="0" step="0.01" value="${v('bonus')}"></div>
        <div class="col-md-3"><label class="form-label">Deductions</label><input type="number" name="deductions" id="pD" class="form-control" min="0" step="0.01" value="${v('deductions')}"></div>
        <div class="col-md-6"><label class="form-label">Payment status</label><select name="payment_status" class="form-select"><option ${v('payment_status') === 'Pending' ? 'selected' : ''}>Pending</option><option ${v('payment_status') === 'Paid' ? 'selected' : ''}>Paid</option></select></div>
        <div class="col-md-6"><label class="form-label">Net salary (auto)</label><div class="form-control bg-light fw-bold" id="pNet">-</div></div></form>`,
      onShown: () => {
        const calc = () => pNet.textContent = UI.money((+pB.value || 0) + (+pA.value || 0) + (+pBo.value || 0) - (+pD.value || 0));
        [pB, pA, pBo, pD].forEach(i => i.oninput = calc); calc();
        if (!edit) pEmp.onchange = () => { const e = emps.find(x => x.id == pEmp.value); if (e) { pB.value = e.salary; pA.value = (e.salary * 0.2).toFixed(2); pD.value = (e.salary * 0.1).toFixed(2); calc(); } };
      },
      onSave: async f => {
        const d = UI.formData(f); const res = edit ? await API.put('/api/payroll/' + r.id, d) : await API.post('/api/payroll', d);
        UI.toast(res.message); load();
      }
    });
  };
  tbl.onclick = e => { const b = e.target.closest('[data-act]'); if (!b) return; const r = rows.find(x => x.id == b.dataset.id); b.dataset.act === 'slip' ? showPayslip(r) : form(r); };
  ctl().forEach(i => i.oninput = UI.debounce(load, 250));
  fReset.onclick = () => { ctl().forEach(i => i.value = ''); load(); };
  if (isAdmin) addPay.onclick = () => form(null);
  load();
  if (q.add && isAdmin) form(null);
};
