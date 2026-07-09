// ─── Phone number formatting (shared) ─────────────────────────────────────────
// US numbers only. Display format: xxx-xxx-xxxx.
// Texting always uses the bare 10 digits.

// Format a stored value for display: 10-digit US numbers become xxx-xxx-xxxx,
// anything else is shown as-is
function formatPhone(str) {
  const s = String(str || '').trim();
  let digits = s.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return s;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Live mask: dashes added while typing, capped at 10 digits
function attachPhoneMask(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    // Drop any +1 prefix (pasted or from previously saved values) before reading the digits
    const raw = input.value.replace(/^\s*\(?\+?1\)?[\s\-.]*/, '');
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (!digits) { input.value = ''; return; }
    let out = digits;
    if (digits.length > 6)      out = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    else if (digits.length > 3) out = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    input.value = out;
  });
}
