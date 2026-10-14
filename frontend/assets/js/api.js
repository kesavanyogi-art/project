/* Talks to the Spring Boot REST API. Adds the login token to every request. */
const API = {
  token: () => localStorage.getItem('ems_token'),
  user: () => JSON.parse(localStorage.getItem('ems_user') || 'null'),
  clear: () => { localStorage.removeItem('ems_token'); localStorage.removeItem('ems_user'); },

  async req(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (API.token()) opts.headers.Authorization = 'Bearer ' + API.token();
    if (body !== undefined) opts.body = JSON.stringify(body);
    let res;
    try { res = await fetch(url, opts); }
    catch (e) { throw new Error('Cannot reach the server. Please make sure the backend is running.'); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (res.status === 401 && !url.includes('/auth/login')) { API.clear(); location.href = 'login.html'; throw new Error('Session expired.'); }
    if (!res.ok) throw new Error((data && data.message) || 'Something went wrong. Please try again.');
    return data;
  },
  get: u => API.req('GET', u),
  post: (u, b) => API.req('POST', u, b === undefined ? {} : b),
  put: (u, b) => API.req('PUT', u, b === undefined ? {} : b),
  del: u => API.req('DELETE', u),
  /** Build ?a=1&b=2 and skip empty values */
  qs: o => { const p = Object.entries(o || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => k + '=' + encodeURIComponent(v)); return p.length ? '?' + p.join('&') : ''; }
};
