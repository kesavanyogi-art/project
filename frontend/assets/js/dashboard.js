/* Dashboard (Admin and Employee) */
Views.dashboard = async (c) => isAdmin ? adminDashboard(c) : employeeDashboard(c);

async function adminDashboard(c) {
  const d = await API.get('/api/dashboard/admin');
  const stat = (icon, num, lbl, href) => `<div class="col-6 col-lg-4 col-xl-2"><a href="${href}" class="text-decoration-none text-reset"><div class="card-box stat"><div class="ico"><i class="bi bi-${icon}"></i></div><div><div class="num">${num}</div><div class="lbl">${lbl}</div></div></div></a></div>`;
  c.innerHTML = `
  <div class="page-head"><h4>Dashboard</h4>
    <div class="d-flex flex-wrap gap-2">
      <a class="btn btn-primary btn-sm" href="#employees?add=1"><i class="bi bi-person-plus"></i> Add employee</a>
      <a class="btn btn-outline-primary btn-sm" href="#attendance?add=1"><i class="bi bi-calendar-plus"></i> Mark attendance</a>
      <a class="btn btn-outline-primary btn-sm" href="#leaves?status=Pending"><i class="bi bi-envelope-check"></i> Review leaves</a>
      <a class="btn btn-outline-primary btn-sm" href="#payroll?add=1"><i class="bi bi-cash-coin"></i> Process payroll</a></div></div>
  <div class="row g-3 mb-3">
    ${stat('people', d.totalEmployees, 'Total employees', '#employees')}
    ${stat('person-check', d.activeEmployees, 'Active employees', '#employees?status=Active')}
    ${stat('person-dash', d.inactiveEmployees, 'Inactive employees', '#employees?status=Inactive')}
    ${stat('diagram-3', d.totalDepartments, 'Departments', '#departments')}
    ${stat('calendar-check', d.todayPresent + '/' + d.todayMarked, "Today's attendance", '#attendance?date=' + UI.today())}
    ${stat('hourglass-split', d.pendingLeaves, 'Pending leaves', '#leaves?status=Pending')}
  </div>
  <div class="row g-3 mb-3">
    <div class="col-lg-4"><div class="card-box"><h6>Employees by department</h6><div class="chart-box"><canvas id="c1"></canvas></div></div></div>
    <div class="col-lg-4"><div class="card-box"><h6>Attendance this month</h6><div class="chart-box"><canvas id="c2"></canvas></div></div></div>
    <div class="col-lg-4"><div class="card-box"><h6>Leave statistics</h6><div class="chart-box"><canvas id="c3"></canvas></div></div></div>
    <div class="col-lg-4"><div class="card-box"><h6>Employee status</h6><div class="chart-box"><canvas id="c4"></canvas></div></div></div>
    <div class="col-lg-8"><div class="card-box"><h6>Payroll summary (net salary per month)</h6><div class="chart-box"><canvas id="c5"></canvas></div></div></div>
  </div>
  <div class="card-box"><h6>Recently added employees</h6><div id="recent"></div></div>`;
  UI.chart('c1', 'bar', d.employeesByDepartment, 'Employees');
  UI.chart('c2', 'doughnut', d.monthlyAttendance);
  UI.chart('c3', 'pie', d.leaveStats);
  UI.chart('c4', 'doughnut', d.employeeStatus);
  UI.chart('c5', 'line', d.payrollSummary, 'Net salary');
  UI.table(document.getElementById('recent'), [
    { label: 'ID', render: r => UI.esc(r.employee_id) },
    { label: 'Name', render: r => `<a href="#employee/${r.id}">${UI.esc(r.full_name)}</a>` },
    { label: 'Department', render: r => UI.esc(r.department_name) },
    { label: 'Designation', render: r => UI.esc(r.designation) },
    { label: 'Joined', render: r => UI.date(r.joining_date) },
    { label: 'Status', render: r => UI.badge(r.status) }], d.recentEmployees, { pageSize: 5 });
}

async function employeeDashboard(c) {
  const d = await API.get('/api/dashboard/employee'), i = d.info || {}, p = d.lastPayslip;
  c.innerHTML = `
  <div class="page-head"><h4>Welcome, ${UI.esc(i.full_name)}</h4><a class="btn btn-primary btn-sm" href="#leaves?apply=1"><i class="bi bi-envelope-plus"></i> Apply for leave</a></div>
  <div class="row g-3 mb-3">
    <div class="col-md-6 col-xl-3"><div class="card-box stat"><div class="ico"><i class="bi bi-person-badge"></i></div><div><div class="fw-bold">${UI.esc(i.employee_id)}</div><div class="lbl">${UI.esc(i.designation)}</div></div></div></div>
    <div class="col-md-6 col-xl-3"><div class="card-box stat"><div class="ico"><i class="bi bi-diagram-3"></i></div><div><div class="fw-bold">${UI.esc(i.department_name)}</div><div class="lbl">${i.department_size} colleagues</div></div></div></div>
    <div class="col-md-6 col-xl-3"><div class="card-box stat"><div class="ico"><i class="bi bi-hourglass-split"></i></div><div><div class="num">${d.pendingLeaves}</div><div class="lbl">Pending leave requests</div></div></div></div>
    <div class="col-md-6 col-xl-3"><div class="card-box stat"><div class="ico"><i class="bi bi-cash-stack"></i></div><div><div class="fw-bold">${p ? UI.money(p.net_salary) : '-'}</div><div class="lbl">${p ? 'Last net salary (' + UI.esc(p.salary_month) + ', ' + UI.esc(p.payment_status) + ')' : 'No payslip yet'}</div></div></div></div>
  </div>
  <div class="row g-3">
    <div class="col-md-6"><div class="card-box"><h6>My attendance this month</h6><div class="chart-box"><canvas id="c1"></canvas></div></div></div>
    <div class="col-md-6"><div class="card-box"><h6>My leave requests</h6><div class="chart-box"><canvas id="c2"></canvas></div></div></div>
  </div>`;
  UI.chart('c1', 'doughnut', d.monthAttendance);
  UI.chart('c2', 'pie', d.leaveStats);
}
