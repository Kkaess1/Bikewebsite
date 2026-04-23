// ─── Logout ───────────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function parseDate(str) {
  return new Date(str + 'T00:00:00');
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPresetRange(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(today);
  let from = new Date(today);

  switch (preset) {
    case 'week':  from.setDate(today.getDate() - 6); break;
    case 'month': from = new Date(today.getFullYear(), today.getMonth(), 1); break;
    case 'quarter': {
      const qMonth = Math.floor(today.getMonth() / 3) * 3;
      from = new Date(today.getFullYear(), qMonth, 1);
      break;
    }
    case 'year': from = new Date(today.getFullYear(), 0, 1); break;
  }
  return { from: toISO(from), to: toISO(to) };
}

// ─── Filter Buttons ───────────────────────────────────────────────────────────
const filterBtns = document.querySelectorAll('.filter-btn[data-preset]');
const customRange = document.getElementById('custom-range');
const quarterlySelect = document.getElementById('quarterly-select');
const monthlySelect = document.getElementById('monthly-select');

function hideAllSubpanels() {
  customRange.classList.remove('visible');
  quarterlySelect.classList.remove('visible');
  monthlySelect.classList.remove('visible');
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const preset = btn.dataset.preset;
    hideAllSubpanels();
    if (preset === 'custom') {
      customRange.classList.add('visible');
    } else if (preset === 'quarterly') {
      quarterlySelect.classList.add('visible');
    } else if (preset === 'monthly') {
      monthlySelect.classList.add('visible');
    } else {
      const { from, to } = getPresetRange(preset);
      loadReport(from, to);
    }
  });
});

// Quarter buttons (Q1–Q4)
document.querySelectorAll('.filter-btn[data-q]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn[data-q]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const q = parseInt(btn.dataset.q);
    const year = new Date().getFullYear();
    const from = `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
    const lastMonth = q * 3;
    const lastDay = new Date(year, lastMonth, 0).getDate();
    const to = `${year}-${String(lastMonth).padStart(2, '0')}-${lastDay}`;
    loadReport(from, to);
  });
});

// ─── By Month picker ──────────────────────────────────────────────────────────
let monthPickerYear = new Date().getFullYear();

function updateMonthYearLabel() {
  document.getElementById('month-year-label').textContent = monthPickerYear;
}

function loadMonth(month) {
  const from = `${monthPickerYear}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(monthPickerYear, month, 0).getDate();
  const to = `${monthPickerYear}-${String(month).padStart(2, '0')}-${lastDay}`;
  loadReport(from, to);
}

document.getElementById('month-year-prev').addEventListener('click', () => {
  monthPickerYear--;
  updateMonthYearLabel();
});
document.getElementById('month-year-next').addEventListener('click', () => {
  monthPickerYear++;
  updateMonthYearLabel();
});

document.querySelectorAll('.filter-btn[data-month]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn[data-month]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadMonth(parseInt(btn.dataset.month));
  });
});

updateMonthYearLabel();

document.getElementById('custom-apply-btn').addEventListener('click', () => {
  const from = document.getElementById('from-date').value;
  const to = document.getElementById('to-date').value;
  if (!from || !to) { showError('Please select both a start and end date.'); return; }
  if (from > to) { showError('Start date must be before end date.'); return; }
  loadReport(from, to);
});

// ─── Print ────────────────────────────────────────────────────────────────────
let currentFrom = null;
let currentTo = null;

function printReport() {
  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  document.getElementById('print-period').textContent = `Period: ${fmt(currentFrom)} - ${fmt(currentTo)}`;
  document.getElementById('print-generated').textContent = `Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  window.print();
}

// ─── Load Report ──────────────────────────────────────────────────────────────
async function loadReport(from, to) {
  clearError();
  try {
    const res = await fetch(`/api/reports?from=${from}&to=${to}`);
    const data = await res.json();
    if (!res.ok) { showError(data.error || 'Failed to load report'); return; }
    currentFrom = from;
    currentTo = to;
    renderReport(data, from, to);
  } catch {
    showError('Connection error. Please try again.');
  }
}

// ─── Chart ────────────────────────────────────────────────────────────────────
let chartInstance = null;
let lastChartData = null;

// Decide grouping based on range length
function getGrouping(from, to) {
  const days = (parseDate(to) - parseDate(from)) / 86400000;
  if (days <= 14)  return 'day';
  if (days <= 90)  return 'week';
  return 'month';
}

function groupJobs(jobs, from, to) {
  const grouping = getGrouping(from, to);
  const buckets = {};

  // Build all bucket keys for the range so empty periods show as zero
  const cur = parseDate(from);
  const end = parseDate(to);
  while (cur <= end) {
    const key = bucketKey(cur, grouping);
    if (!buckets[key]) buckets[key] = { revenue: 0, expenses: 0, profit: 0, tips: 0, jobs: 0, label: bucketLabel(cur, grouping) };
    if (grouping === 'day')   cur.setDate(cur.getDate() + 1);
    else if (grouping === 'week')  cur.setDate(cur.getDate() + 7);
    else cur.setMonth(cur.getMonth() + 1);
  }

  for (const job of jobs) {
    const d = parseDate(job.date);
    const key = bucketKey(d, grouping);
    if (buckets[key]) {
      buckets[key].revenue   += job.customer_cost + (job.tip || 0);
      buckets[key].expenses  += job.total_expenses;
      buckets[key].profit    += job.profit;
      buckets[key].tips      += job.tip || 0;
      buckets[key].jobs      += 1;
    }
  }

  return Object.values(buckets);
}

function bucketKey(date, grouping) {
  if (grouping === 'day') return toISO(date);
  if (grouping === 'week') {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay()); // start of week (Sunday)
    return toISO(d);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function bucketLabel(date, grouping) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (grouping === 'day') {
    return local.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (grouping === 'week') {
    const d = new Date(local);
    d.setDate(d.getDate() - d.getDay());
    return 'Wk ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return local.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function renderChart(jobs, from, to) {
  const grouped = groupJobs(jobs, from, to);
  lastChartData = grouped;

  const labels = grouped.map(b => b.label);
  const activeMetrics = getActiveMetrics();

  const datasets = [];
  if (activeMetrics.has('revenue'))  datasets.push({ label: 'Revenue',   data: grouped.map(b => +b.revenue.toFixed(2)),  backgroundColor: 'rgba(26,95,168,0.75)',  borderColor: '#1a5fa8', borderWidth: 1 });
  if (activeMetrics.has('expenses')) datasets.push({ label: 'Expenses',  data: grouped.map(b => +b.expenses.toFixed(2)), backgroundColor: 'rgba(184,96,0,0.75)',   borderColor: '#b86000', borderWidth: 1 });
  if (activeMetrics.has('profit'))   datasets.push({ label: 'Profit',    data: grouped.map(b => +b.profit.toFixed(2)),   backgroundColor: 'rgba(26,122,26,0.75)',  borderColor: '#1a7a1a', borderWidth: 1 });
  if (activeMetrics.has('tips'))     datasets.push({ label: 'Tips',      data: grouped.map(b => +b.tips.toFixed(2)),     backgroundColor: 'rgba(255,193,7,0.85)',  borderColor: '#c79a00', borderWidth: 1 });
  if (activeMetrics.has('jobs'))     datasets.push({ label: 'Job Count', data: grouped.map(b => b.jobs),                  backgroundColor: 'rgba(122,26,122,0.75)', borderColor: '#7a1a7a', borderWidth: 1, yAxisID: 'y2' });

  document.getElementById('chart-card').style.display = '';

  if (chartInstance) chartInstance.destroy();

  const hasJobCount = activeMetrics.has('jobs');
  chartInstance = new Chart(document.getElementById('report-chart'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label(ctx) {
              if (ctx.dataset.yAxisID === 'y2') return ` ${ctx.dataset.label}: ${ctx.parsed.y}`;
              return ` ${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { callback: v => '$' + v },
          title: { display: true, text: 'Dollars ($)' },
        },
        ...(hasJobCount ? {
          y2: {
            position: 'right',
            beginAtZero: true,
            ticks: { stepSize: 1 },
            title: { display: true, text: 'Jobs' },
            grid: { drawOnChartArea: false },
          },
        } : {}),
      },
    },
  });
}

// ─── Metric toggle buttons ────────────────────────────────────────────────────
function getActiveMetrics() {
  const active = new Set();
  document.querySelectorAll('.chart-toggle.active').forEach(btn => active.add(btn.dataset.metric));
  return active;
}

document.querySelectorAll('.chart-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    if (lastChartData && chartInstance) {
      // Rebuild from cached data rather than re-fetching
      const labels = lastChartData.map(b => b.label);
      const activeMetrics = getActiveMetrics();
      const datasets = [];
      if (activeMetrics.has('revenue'))  datasets.push({ label: 'Revenue',   data: lastChartData.map(b => +b.revenue.toFixed(2)),  backgroundColor: 'rgba(26,95,168,0.75)',  borderColor: '#1a5fa8', borderWidth: 1 });
      if (activeMetrics.has('expenses')) datasets.push({ label: 'Expenses',  data: lastChartData.map(b => +b.expenses.toFixed(2)), backgroundColor: 'rgba(184,96,0,0.75)',   borderColor: '#b86000', borderWidth: 1 });
      if (activeMetrics.has('profit'))   datasets.push({ label: 'Profit',    data: lastChartData.map(b => +b.profit.toFixed(2)),   backgroundColor: 'rgba(26,122,26,0.75)',  borderColor: '#1a7a1a', borderWidth: 1 });
      if (activeMetrics.has('tips'))     datasets.push({ label: 'Tips',      data: lastChartData.map(b => +b.tips.toFixed(2)),     backgroundColor: 'rgba(255,193,7,0.85)',  borderColor: '#c79a00', borderWidth: 1 });
      if (activeMetrics.has('jobs'))     datasets.push({ label: 'Job Count', data: lastChartData.map(b => b.jobs),                  backgroundColor: 'rgba(122,26,122,0.75)', borderColor: '#7a1a7a', borderWidth: 1, yAxisID: 'y2' });
      chartInstance.data.labels = labels;
      chartInstance.data.datasets = datasets;

      const hasJobCount = activeMetrics.has('jobs');
      chartInstance.options.scales.y2 = hasJobCount ? {
        position: 'right', beginAtZero: true, ticks: { stepSize: 1 },
        title: { display: true, text: 'Jobs' }, grid: { drawOnChartArea: false },
      } : undefined;

      chartInstance.update();
    }
  });
});

// ─── Render ───────────────────────────────────────────────────────────────────
function fmt(n) { return '$' + Number(n).toFixed(2); }

function renderReport({ jobs, summary }, from, to) {
  document.getElementById('summary-card').style.display = '';

  // Summary boxes
  const tipsBox = summary.tips_total > 0
    ? `<div class="total-box"><label>Tips Total</label><div class="amount" style="color:#1a7a1a;">${fmt(summary.tips_total)}</div></div>`
    : '';
  document.getElementById('summary-grid').innerHTML = `
    <div class="total-box">
      <label>Jobs</label>
      <div class="amount">${summary.job_count}</div>
    </div>
    <div class="total-box">
      <label>Total Expenses</label>
      <div class="amount">${fmt(summary.total_expenses)}</div>
    </div>
    <div class="total-box">
      <label>Services Total</label>
      <div class="amount">${fmt(summary.services_total)}</div>
    </div>
    ${tipsBox}
    <div class="total-box">
      <label>Total Revenue</label>
      <div class="amount">${fmt(summary.total_revenue)}</div>
    </div>
    <div class="total-box highlight" style="grid-column:1/-1; width:fit-content; justify-self:center; text-align:center; padding:10px 36px;">
      <label>Total Profit</label>
      <div class="amount" style="color:#4caf50;">${fmt(summary.total_profit)}</div>
    </div>
  `;

  // Chart
  renderChart(jobs, from, to);
}

// ─── Messages ─────────────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.className = 'msg error';
}

function clearError() {
  document.getElementById('error-msg').className = 'msg';
}

// Auto-load current month
(function () {
  document.querySelector('[data-preset="month"]').click();
})();
