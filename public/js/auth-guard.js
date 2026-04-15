(async function () {
  try {
    const res = await fetch('/api/auth/check');
    if (res.status === 401) {
      window.location.href = '/login';
    }
  } catch {
    window.location.href = '/login';
  }
})();

// Redirect to login on any future 401 API response
const _fetch = window.fetch;
window.fetch = async function (...args) {
  const res = await _fetch(...args);
  if (res.status === 401) {
    window.location.href = '/login';
  }
  return res;
};
