// ─── Phone number formatting (shared) ─────────────────────────────────────────

// Format a stored value for display: 10-digit US numbers become xxx-xxx-xxxx,
// anything else is shown as-is
function formatPhone(str) {
  const s = String(str || '').trim();
  let digits = s.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return s;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Live mask: dashes appear automatically while typing, capped at 10 digits
function attachPhoneMask(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    let out = digits;
    if (digits.length > 6)      out = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    else if (digits.length > 3) out = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    input.value = out;
  });
}
