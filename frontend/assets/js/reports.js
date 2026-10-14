/* Reports (admin): employee, department, attendance, leave, payroll. Filter, print, export CSV. */
Views.reports = async c => {
  const [depts, emps] = await Promise.all([API.get('/api/departments'), API.get('/api/employees')]);
  const STATUS = { employees: ['Active', 'Inactive'], departments: [], attendance: ['Present', 'Absent', 'Late', 'Half Day', 'Leave'], leaves: ['Pending', 'Approved', 'Rejected'], payroll: ['Pending', 'Paid'] };
  const TITLES = { employees: 'Employee report', departments: 'Department report', attendance: 'Attendance report', leaves: 'Leave report', payroll: 'Payroll report' };
  const MONEY = ['salary', 'basic_salary', 'allowances', 'bonus', 'deductions', 'net_salary', 'average_salary', 'total_salary'];
  const DATES = ['joining_date', 'date', 'start_date', 'end_date'];
  let rows = [];

  c.innerHTML = `<div class="page-head"><h4>Reports</h4></div>
  <div class="card-box mb-3"><div class="row g-2">
    <div class="col-md-3"><label class="small text-muted">Report</label><select id="rType" class="form-select">${Object.entries(TITLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="col-md-3"><label class="small text-muted" id="lFrom">From</label><input type="date" id="rFrom" class="form-control"></div>
    <div class="col-md-3"><label class="small text-muted" id="lTo">To</label><input type="date" id="rTo" class="form-control"></div>
    <div class="col-md-3"><label class="small text-muted">Status</label><select id="rStatus" class="form-select"></select></div>
    <div class="col-md-3"><label class="small text-muted">Department</label><select id="rDept" class="form-select">${UI.options(depts, 'id', 'department_name', '', 'All departments')}</select></div>
    <div class="col-md-3"><label class="small text-muted">Employee</label><select id="rEmp" class="form-select">${UI.options(emps, 'id', 'full_name', '', 'All employees')}</select></div>
    <div class="col-md-6 d-flex align-items-end gap-2"><button class="btn btn-primary" id="rGo"><i class="bi bi-play-fill"></i> Generate</button>
      <button class="btn btn-outline-secondary" id="rPrint"><i class="bi bi-printer"></i> Print</button><button class="btn btn-outline-secondary" id="rCsv"><i class="bi bi-filetype-csv"></i> Export CSV</button></div></div></div>
  <div class="card-box"><div id="rInfo" class="text-muted small mb-2"></div><div id="rOut"></div></div>`;

  const label = k => k.replace(/_/g, ' ').replace(/^./, s => s.toUpperCase());
  const cell = (k, v) => v == null ? '-' : MONEY.includes(k) ? UI.money(v) : DATES.includes(k) ? UI.date(v) : /^check_/.test(k) ? UI.time(v) : UI.esc(v);
  const tableHtml = () => `<table class="table table-sm table-bordered"><thead class="table-light"><tr>${Object.keys(rows[0]).map(k => `<th>${label(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${Object.keys(r).map(k => `<td>${cell(k, r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  const setType = () => {
    const t = rType.value, isPay = t === 'payroll';
    rFrom.type = rTo.type = isPay ? 'month' : 'date'; rFrom.value = rTo.value = '';
    lFrom.textContent = isPay ? 'From month' : t === 'employees' ? 'Joined from' : 'From date'; lTo.textContent = isPay ? 'To month' : t === 'employees' ? 'Joined to' : 'To date';
    rStatus.innerHTML = '<option value="">All status</option>' + STATUS[t].map(s => `<option>${s}</option>`).join('');
    [rFrom, rTo, rStatus, rDept, rEmp].forEach(i => i.disabled = t === 'departments');
  };
  const generate = async () => {
    rOut.innerHTML = UI.loading('Generating report...');
    try {
      rows = await API.get('/api/reports/' + rType.value + API.qs({ from: rFrom.value, to: rTo.value, status: rStatus.value, department: rDept.value, employeeId: rEmp.value }));
      rInfo.textContent = TITLES[rType.value] + ' - ' + rows.length + ' record(s) - generated ' + new Date().toLocaleString();
      rOut.innerHTML = rows.length ? `<div class="table-responsive">${tableHtml()}</div>` : UI.empty('No records match these filters.', 'file-earmark-x');
    } catch (e) { rOut.innerHTML = UI.error(e.message); }
  };
  rType.onchange = () => { setType(); generate(); };
  rGo.onclick = generate;
  rPrint.onclick = () => rows.length ? UI.printHtml(TITLES[rType.value], `<h4 class="mb-1">${TITLES[rType.value]}</h4><p class="text-muted">${UI.esc(rInfo.textContent)}</p>${tableHtml()}`) : UI.toast('Generate a report with data first.', 'warning');
  rCsv.onclick = () => UI.csv(rType.value + '-report.csv', rows);
  setType(); generate();
};
