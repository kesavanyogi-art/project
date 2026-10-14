/* App shell: login guard, role-based sidebar, hash router, notifications, logout. */
const me = API.user();
if (!API.token() || !me) location.href = 'login.html';
const isAdmin = me && me.role === 'ADMIN';

const ROUTES = {   // route -> [roles allowed]
  dashboard: ['ADMIN', 'EMPLOYEE'], employees: ['ADMIN'], employee: ['ADMIN'], departments: ['ADMIN'], department: ['EMPLOYEE'],
  attendance: ['ADMIN', 'EMPLOYEE'], leaves: ['ADMIN', 'EMPLOYEE'], payroll: ['ADMIN', 'EMPLOYEE'], reports: ['ADMIN'],
  profile: ['ADMIN', 'EMPLOYEE'], settings: ['ADMIN', 'EMPLOYEE']
};
const MENU = isAdmin ? [
  ['dashboard', 'speedometer2', 'Dashboard'], ['employees', 'people', 'Employees'], ['departments', 'diagram-3', 'Departments'],
  ['attendance', 'calendar-check', 'Attendance'], ['leaves', 'envelope-paper', 'Leave Management'], ['payroll', 'cash-stack', 'Payroll'],
  ['reports', 'bar-chart-line', 'Reports'], ['profile', 'person-circle', 'Profile'], ['settings', 'gear', 'Settings']
] : [
  ['dashboard', 'speedometer2', 'Dashboard'], ['profile', 'person-circle', 'My Profile'], ['attendance', 'calendar-check', 'My Attendance'],
  ['leaves', 'envelope-paper', 'My Leave'], ['payroll', 'cash-stack', 'My Salary'], ['department', 'diagram-3', 'My Department'], ['settings', 'gear', 'Settings']
];

function buildSidebar(active) {
  sidebar.innerHTML = `<div class="brand"><i class="bi bi-people-fill"></i> EMS</div>` +
    MENU.map(([r, ic, label]) => `<a href="#${r}" class="${r === active ? 'active' : ''}"><i class="bi bi-${ic}"></i>${label}</a>`).join('') +
    `<a href="#" id="logoutSide"><i class="bi bi-box-arrow-right"></i>Logout</a>`;
  document.getElementById('logoutSide').onclick = logout;
  sidebar.classList.remove('open');
}

async function logout(e) {
  if (e) e.preventDefault();
  try { await API.post('/api/auth/logout'); } catch (x) { /* ignore */ }
  API.clear(); location.href = 'login.html';
}

async function navigate() {
  UI.destroyCharts();
  const [path, qstr] = (location.hash.slice(1) || 'dashboard').split('?');
  const [name, param] = path.split('/');
  const query = Object.fromEntries(new URLSearchParams(qstr || ''));
  if (!ROUTES[name] || !ROUTES[name].includes(me.role)) { location.hash = '#dashboard'; return; }
  buildSidebar(name === 'employee' ? 'employees' : name);
  view.innerHTML = UI.loading();
  try { await Views[name](view, param, query); }
  catch (e) { view.innerHTML = UI.error(e.message); }
  window.scrollTo(0, 0);
}

/* ---- notifications ---- */
async function loadNotifications() {
  try {
    const r = await API.get('/api/notifications');
    bellCount.textContent = r.unread; bellCount.classList.toggle('d-none', !r.unread);
    notifList.innerHTML = r.items.length ? r.items.map(n => `<div class="notif-item ${n.is_read ? '' : 'unread'}">${UI.esc(n.message)}<div class="text-muted" style="font-size:.72rem">${UI.esc(String(n.created_at).replace('T', ' ').substring(0, 16))}</div></div>`).join('')
      : UI.empty('No notifications', 'bell-slash');
  } catch (e) { /* ignore */ }
}
markRead.onclick = async e => { e.preventDefault(); await API.put('/api/notifications/read-all'); loadNotifications(); };

/* ---- init ---- */
meName.textContent = me.fullName; meAvatar.textContent = UI.initials(me.fullName);
logoutTop.onclick = logout;
menuBtn.onclick = () => sidebar.classList.toggle('open');
if (!isAdmin) globalSearch.classList.add('invisible');
globalSearch.onsubmit = e => { e.preventDefault(); location.hash = '#employees?search=' + encodeURIComponent(globalQ.value); };
window.addEventListener('hashchange', navigate);
navigate(); loadNotifications(); setInterval(loadNotifications, 60000);
