const form = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');
const submitBtn = document.getElementById('submit-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.className = 'msg';
  errorMsg.textContent = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      window.location.href = '/';
    } else {
      showError(data.error || 'Login failed');
    }
  } catch {
    showError('Connection error. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.className = 'msg error';
}
