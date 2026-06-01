/* ============================================================
   AEON CRM — app.js
   Full client-side CRM with localStorage persistence
   ============================================================ */

'use strict';

/* ============================================================
   1. DATA LAYER
   ============================================================ */
const DB = {
  get: (key) => JSON.parse(localStorage.getItem('aeon_' + key) || '[]'),
  set: (key, val) => localStorage.setItem('aeon_' + key, JSON.stringify(val)),
  getObj: (key, def = {}) => JSON.parse(localStorage.getItem('aeon_' + key) || JSON.stringify(def)),
  setObj: (key, val) => localStorage.setItem('aeon_' + key, JSON.stringify(val)),

  leads:    () => DB.get('leads'),
  bookings: () => DB.get('bookings'),
  payments: () => DB.get('payments'),
  activity: () => DB.get('activity'),
  settings: () => DB.getObj('settings', { advisorName: 'AEON Advisor', email: '', phone: '', currency: 'USD' }),
  fees:     () => DB.getObj('fees', { feeEntry: 3500, feeStd: 10000, feePrem: 25000, commRate: 12 }),

  saveLead(lead) {
    const leads = DB.leads();
    const idx = leads.findIndex(l => l.id === lead.id);
    if (idx >= 0) leads[idx] = lead; else leads.unshift(lead);
    DB.set('leads', leads);
  },
  deleteLead(id) { DB.set('leads', DB.leads().filter(l => l.id !== id)); },

  saveBooking(b) {
    const all = DB.bookings();
    const idx = all.findIndex(x => x.id === b.id);
    if (idx >= 0) all[idx] = b; else all.unshift(b);
    DB.set('bookings', all);
  },
  deleteBooking(id) { DB.set('bookings', DB.bookings().filter(b => b.id !== id)); },

  savePayment(p) {
    const all = DB.payments();
    const idx = all.findIndex(x => x.id === p.id);
    if (idx >= 0) all[idx] = p; else all.unshift(p);
    DB.set('payments', all);
  },
  deletePayment(id) { DB.set('payments', DB.payments().filter(p => p.id !== id)); },

  addActivity(msg, type = 'stage') {
    const log = DB.activity();
    log.unshift({ id: uid(), msg, type, ts: new Date().toISOString(), read: false });
    DB.set('activity', log.slice(0, 80));
  }
};

/* ============================================================
   2. UTILITIES
   ============================================================ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function fmt(n) {
  if (!n) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = 'toast', 2800);
}

const STAGE_LABELS = {
  new_inquiry: 'New Inquiry',
  intake_call: 'Intake Call',
  proposal_sent: 'Proposal Sent',
  booking_confirmed: 'Confirmed',
  active_client: 'Active Client',
  completed: 'Completed'
};

const STAGE_BADGE = {
  new_inquiry: 'badge-new',
  intake_call: 'badge-intake',
  proposal_sent: 'badge-proposal',
  booking_confirmed: 'badge-confirmed',
  active_client: 'badge-active',
  completed: 'badge-completed'
};

const BUDGET_LABELS = { entry: 'Entry', mid: 'Mid', premium: 'Premium' };

/* ============================================================
   3. ROUTER
   ============================================================ */
const Router = {
  current: 'dashboard',
  titles: {
    dashboard: 'Dashboard', pipeline: 'Pipeline', clients: 'Clients',
    bookings: 'Bookings', revenue: 'Revenue', matcher: 'AI Matcher',
    notifications: 'Notifications', settings: 'Settings'
  },

  go(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const el = document.getElementById('view-' + view);
    if (el) el.classList.add('active');
    document.querySelectorAll(`[data-view="${view}"]`).forEach(n => n.classList.add('active'));
    document.getElementById('topbarTitle').textContent = this.titles[view] || view;
    this.current = view;
    Views[view] && Views[view]();
    // close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
  }
};

/* ============================================================
   4. VIEWS
   ============================================================ */
const Views = {

  /* ---- DASHBOARD ---- */
  dashboard() {
    const leads    = DB.leads();
    const bookings = DB.bookings();
    const payments = DB.payments();

    const now   = new Date();
    const mtd   = payments.filter(p => p.status === 'paid' && new Date(p.date).getMonth() === now.getMonth() && new Date(p.date).getFullYear() === now.getFullYear());
    const mtdAmt = mtd.reduce((s, p) => s + Number(p.amount || 0), 0);
    const active = leads.filter(l => !['completed', 'new_inquiry'].includes(l.stage)).length;
    const confirmed = leads.filter(l => ['booking_confirmed', 'active_client'].includes(l.stage)).length;
    const projected = leads.reduce((s, l) => s + Number(l.coordinationFee || 0) + Number(l.commissionExpected || 0), 0);

    document.getElementById('kpi-revenue').textContent = fmt(mtdAmt);
    document.getElementById('kpi-revenue-sub').textContent = `${mtd.length} payment${mtd.length !== 1 ? 's' : ''} received`;
    document.getElementById('kpi-leads').textContent = active;
    document.getElementById('kpi-clients').textContent = confirmed;
    document.getElementById('kpi-projected').textContent = fmt(projected);

    // pipeline badge
    document.getElementById('badge-pipeline').textContent = leads.filter(l => l.stage !== 'completed').length;

    // unread badge
    const unread = DB.activity().filter(a => !a.read).length;
    const nb = document.getElementById('badge-notif');
    nb.textContent = unread;
    nb.style.display = unread ? 'inline' : 'none';

    this._renderRevenueChart(payments);
    this._renderPipelineChart(leads);
    this._renderActivity();
    this._renderPending(payments, leads);
  },

  _renderRevenueChart(payments) {
    const ctx = document.getElementById('chartRevenue');
    if (!ctx) return;
    if (ctx._chart) ctx._chart.destroy();

    const months = [];
    const totals = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const lbl = d.toLocaleDateString('en-US', { month: 'short' });
      months.push(lbl);
      const sum = payments
        .filter(p => p.status === 'paid' && new Date(p.date).getMonth() === d.getMonth() && new Date(p.date).getFullYear() === d.getFullYear())
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      totals.push(sum);
    }

    ctx._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{ data: totals, backgroundColor: 'rgba(201,169,110,0.3)', borderColor: '#c9a96e', borderWidth: 1, borderRadius: 2 }]
      },
      options: {
        responsive: true, plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#626780', font: { size: 11 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#626780', font: { size: 11 }, callback: v => '$' + v.toLocaleString() } }
        }
      }
    });
  },

  _renderPipelineChart(leads) {
    const ctx = document.getElementById('chartPipeline');
    if (!ctx) return;
    if (ctx._chart) ctx._chart.destroy();

    const stages = Object.keys(STAGE_LABELS);
    const counts = stages.map(s => leads.filter(l => l.stage === s).length);
    const colors = ['#60a5fa', '#a78bfa', '#fbbf24', '#c9a96e', '#4ade80', '#626780'];

    ctx._chart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: Object.values(STAGE_LABELS), datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        plugins: { legend: { position: 'right', labels: { color: '#b0b4c8', font: { size: 11 }, boxWidth: 10, padding: 12 } } }
      }
    });
  },

  _renderActivity() {
    const feed = document.getElementById('activityFeed');
    const log  = DB.activity().slice(0, 8);
    if (!log.length) { feed.innerHTML = '<p style="font-size:0.75rem;color:var(--text-muted);padding:0.5rem 0">No activity yet.</p>'; return; }
    feed.innerHTML = log.map(a => `
      <div class="activity-item">
        <div class="activity-dot dot-${a.type}"></div>
        <div>
          <div class="activity-text">${a.msg}</div>
          <div class="activity-time">${timeAgo(a.ts)}</div>
        </div>
      </div>`).join('');
  },

  _renderPending(payments, leads) {
    const list = document.getElementById('pendingList');
    const pending = payments.filter(p => p.status === 'pending').slice(0, 6);
    if (!pending.length) { list.innerHTML = '<p style="font-size:0.75rem;color:var(--text-muted)">No pending payments.</p>'; return; }
    list.innerHTML = pending.map(p => {
      const lead = leads.find(l => l.id === p.clientId);
      return `<div class="pending-item">
        <div><div class="pending-item-name">${lead ? lead.name : 'Unknown'}</div>
        <div class="pending-item-type">${p.type === 'coordination_fee' ? 'Coordination Fee' : p.type === 'clinic_commission' ? 'Clinic Commission' : 'Retainer'}</div></div>
        <div class="pending-amount">${fmt(p.amount)}</div>
      </div>`;
    }).join('');
  },

  /* ---- PIPELINE ---- */
  pipeline() {
    const leads = DB.leads();
    document.getElementById('pipelineCount').textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''}`;
    const kanban = document.getElementById('kanban');
    const stages = Object.keys(STAGE_LABELS);

    kanban.innerHTML = stages.map(stage => {
      const cards = leads.filter(l => l.stage === stage);
      return `
        <div class="kanban-col" data-stage="${stage}">
          <div class="kanban-col-header">
            <span class="kanban-col-title">${STAGE_LABELS[stage]}</span>
            <span class="kanban-col-count">${cards.length}</span>
          </div>
          <div class="kanban-cards" data-stage="${stage}">
            ${cards.map(l => this._kanbanCard(l)).join('')}
          </div>
        </div>`;
    }).join('');

    this._initDragDrop();
  },

  _kanbanCard(l) {
    const days = Math.floor((Date.now() - new Date(l.createdAt)) / 86400000);
    return `
      <div class="kanban-card" draggable="true" data-id="${l.id}">
        ${l.referral ? `<div class="kcard-ref">${l.referral}</div>` : ''}
        <div class="kcard-name">${l.name}</div>
        <div class="kcard-goal">${l.primaryGoal || '—'}</div>
        <div class="kcard-meta">
          <span class="kcard-budget budget-${l.budget}">${BUDGET_LABELS[l.budget] || l.budget}</span>
          <span class="kcard-days">${days}d</span>
        </div>
        <div class="kcard-actions">
          <button class="btn-icon" onclick="Modals.editLead('${l.id}')">✏️</button>
          <button class="btn-icon" onclick="App.deleteLead('${l.id}')">🗑</button>
        </div>
      </div>`;
  },

  _initDragDrop() {
    let draggingId = null;
    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', () => { draggingId = card.dataset.id; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    document.querySelectorAll('.kanban-cards').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
      col.addEventListener('drop', e => {
        e.preventDefault(); col.classList.remove('drag-over');
        if (!draggingId) return;
        const newStage = col.dataset.stage;
        const lead = DB.leads().find(l => l.id === draggingId);
        if (lead && lead.stage !== newStage) {
          const old = lead.stage;
          lead.stage = newStage;
          lead.updatedAt = new Date().toISOString();
          DB.saveLead(lead);
          DB.addActivity(`<strong>${lead.name}</strong> moved from ${STAGE_LABELS[old]} → ${STAGE_LABELS[newStage]}`, 'stage');
          Views.pipeline();
          showToast('Stage updated', 'success');
        }
      });
    });
  },

  /* ---- CLIENTS ---- */
  clients() {
    const search = (document.getElementById('clientSearch').value || '').toLowerCase();
    const filter = document.getElementById('clientFilter').value;
    let leads = DB.leads();
    if (search) leads = leads.filter(l => l.name.toLowerCase().includes(search) || (l.email || '').toLowerCase().includes(search));
    if (filter) leads = leads.filter(l => l.stage === filter);

    const tbody = document.getElementById('clientsBody');
    if (!leads.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">No clients found.</td></tr>`; return; }

    tbody.innerHTML = leads.map(l => `
      <tr>
        <td><strong>${l.name}</strong><br><span style="font-size:0.68rem;color:var(--text-muted)">${l.email || ''}</span></td>
        <td>${l.primaryGoal || '—'}</td>
        <td><span class="kcard-budget budget-${l.budget}">${BUDGET_LABELS[l.budget] || '—'}</span></td>
        <td><span class="badge ${STAGE_BADGE[l.stage]}">${STAGE_LABELS[l.stage]}</span></td>
        <td>${l.assignedClinic || '—'}</td>
        <td>${l.coordinationFee ? fmt(l.coordinationFee) : '—'}</td>
        <td>${l.commissionExpected ? fmt(l.commissionExpected) : '—'}</td>
        <td>
          <button class="btn-icon" onclick="Modals.editLead('${l.id}')">✏️</button>
          <button class="btn-icon" onclick="App.deleteLead('${l.id}')">🗑</button>
        </td>
      </tr>`).join('');
  },

  /* ---- BOOKINGS ---- */
  bookings() {
    const bookings = DB.bookings();
    const leads = DB.leads();
    document.getElementById('bookingsStat').textContent = `${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`;

    // populate client select
    const sel = document.getElementById('bookingClientSelect');
    sel.innerHTML = leads.map(l => `<option value="${l.id}">${l.name}</option>`).join('');

    const tbody = document.getElementById('bookingsBody');
    if (!bookings.length) { tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:2rem">No bookings yet.</td></tr>`; return; }

    tbody.innerHTML = bookings.map(b => {
      const lead = leads.find(l => l.id === b.clientId);
      return `<tr>
        <td><strong>${lead ? lead.name : 'Unknown'}</strong></td>
        <td>${b.clinic || '—'}</td>
        <td>${b.program || '—'}</td>
        <td>${fmtDate(b.checkIn)}</td>
        <td>${fmtDate(b.checkOut)}</td>
        <td>${b.programInvestment ? fmt(b.programInvestment) : '—'}</td>
        <td>${b.coordinationFee ? fmt(b.coordinationFee) : '—'}</td>
        <td>${b.commissionAmount ? fmt(b.commissionAmount) : '—'}</td>
        <td><span class="badge badge-${b.status}">${b.status}</span></td>
        <td><button class="btn-icon" onclick="App.deleteBooking('${b.id}')">🗑</button></td>
      </tr>`;
    }).join('');
  },

  /* ---- REVENUE ---- */
  revenue() {
    const payments = DB.payments();
    const leads = DB.leads();

    const paid = payments.filter(p => p.status === 'paid');
    const pending = payments.filter(p => p.status !== 'paid');
    const coord = paid.filter(p => p.type === 'coordination_fee').reduce((s, p) => s + Number(p.amount), 0);
    const comm  = paid.filter(p => p.type === 'clinic_commission').reduce((s, p) => s + Number(p.amount), 0);
    const total = paid.reduce((s, p) => s + Number(p.amount), 0);
    const pendingAmt = pending.reduce((s, p) => s + Number(p.amount), 0);

    document.getElementById('rev-total').textContent   = fmt(total);
    document.getElementById('rev-coord').textContent   = fmt(coord);
    document.getElementById('rev-comm').textContent    = fmt(comm);
    document.getElementById('rev-pending').textContent = fmt(pendingAmt);

    const sel = document.getElementById('paymentClientSelect');
    if (sel) sel.innerHTML = leads.map(l => `<option value="${l.id}">${l.name}</option>`).join('');

    const tbody = document.getElementById('paymentsBody');
    if (!payments.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">No payments recorded.</td></tr>`; return; }

    tbody.innerHTML = payments.map(p => {
      const lead = leads.find(l => l.id === p.clientId);
      return `<tr>
        <td>${fmtDate(p.date)}</td>
        <td><strong>${lead ? lead.name : 'Unknown'}</strong></td>
        <td>${p.type === 'coordination_fee' ? 'Coordination Fee' : p.type === 'clinic_commission' ? 'Clinic Commission' : 'Retainer'}</td>
        <td>${fmt(p.amount)}</td>
        <td><span class="badge badge-${p.status}">${p.status}</span></td>
        <td>
          ${p.status === 'pending' ? `<button class="btn-icon" onclick="App.markPaid('${p.id}')">✅</button>` : ''}
          <button class="btn-icon" onclick="App.deletePayment('${p.id}')">🗑</button>
        </td>
      </tr>`;
    }).join('');
  },

  /* ---- NOTIFICATIONS ---- */
  notifications() {
    const log = DB.activity();
    log.forEach(a => { a.read = true; });
    DB.set('activity', log);
    document.getElementById('badge-notif').style.display = 'none';

    const leads = DB.leads();
    const sel = document.getElementById('templateRecipient');
    sel.innerHTML = '<option value="">Select recipient…</option>' + leads.map(l => `<option value="${l.id}">${l.name}</option>`).join('');

    Notif.renderTemplate('welcome');
    Notif.renderLog();
  },

  /* ---- SETTINGS ---- */
  settings() {
    const s = DB.settings();
    const f = DB.fees();
    document.getElementById('s-name').value     = s.advisorName || '';
    document.getElementById('s-email').value    = s.email || '';
    document.getElementById('s-phone').value    = s.phone || '';
    document.getElementById('s-currency').value = s.currency || 'USD';
    document.getElementById('s-fee-entry').value = f.feeEntry || 3500;
    document.getElementById('s-fee-std').value   = f.feeStd   || 10000;
    document.getElementById('s-fee-prem').value  = f.feePrem  || 25000;
    document.getElementById('s-comm-rate').value = f.commRate || 12;
  },

  /* ---- MATCHER ---- */
  matcher() {
    document.getElementById('matcherResults').innerHTML = `
      <div class="matcher-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        <p>Enter a client profile to generate AI-matched clinic recommendations.</p>
      </div>`;
  }
};

/* ============================================================
   5. AI MATCHER ENGINE
   ============================================================ */
const CLINICS_DB = [
  {
    name: 'Clinique La Prairie', location: 'Montreux, Switzerland',
    goals: ['diagnostics', 'retreat', 'aesthetic', 'pharmacological'],
    travel: ['europe', 'any'], budget: ['mid', 'premium'],
    duration: ['week', 'multi'], privacy: ['private', 'any'],
    invest: 'CHF 29,200 – 50,250 / week',
    tags: ['Revitalisation', 'Cellular therapy', 'Diagnostics', 'Aesthetics'],
    score_base: 90
  },
  {
    name: 'AEON Clinic', location: 'Dubai, UAE',
    goals: ['regenerative', 'diagnostics', 'aesthetic', 'pharmacological'],
    travel: ['dubai', 'any'], budget: ['entry', 'mid', 'premium'],
    duration: ['day', 'week'], privacy: ['private', 'any'],
    invest: 'AED 5,000 – 100,000 / program',
    tags: ['Stem cells', 'Exosomes', 'PRP', 'Biomarkers'],
    score_base: 85
  },
  {
    name: 'Chenot Palace Weggis', location: 'Weggis, Switzerland',
    goals: ['retreat', 'diagnostics', 'pharmacological'],
    travel: ['europe', 'any'], budget: ['mid', 'premium'],
    duration: ['week', 'multi'], privacy: ['private', 'any'],
    invest: 'CHF 5,500+ / program',
    tags: ['Chenot Method', 'Detox', 'Metabolic reset'],
    score_base: 86
  },
  {
    name: 'SHA Wellness Clinic', location: 'Alicante, Spain',
    goals: ['retreat', 'diagnostics', 'performance', 'aesthetic'],
    travel: ['europe', 'any'], budget: ['mid', 'premium'],
    duration: ['week', 'multi'], privacy: ['any'],
    invest: '€1,265 – €4,090 / night',
    tags: ['SHA Method', 'Nutrition', 'Performance', 'Diagnostics'],
    score_base: 83
  },
  {
    name: 'Lanserhof Tegernsee', location: 'Bavaria, Germany',
    goals: ['retreat', 'diagnostics', 'performance'],
    travel: ['europe', 'any'], budget: ['mid', 'premium'],
    duration: ['week', 'multi'], privacy: ['any'],
    invest: '€5,271+ / 9–11 nights',
    tags: ['Mayr medicine', 'Gut health', 'Regenerative'],
    score_base: 82
  },
  {
    name: 'Bioscience Institute', location: 'Dubai Healthcare City, UAE',
    goals: ['regenerative', 'pharmacological', 'diagnostics'],
    travel: ['dubai', 'any'], budget: ['mid', 'premium'],
    duration: ['day', 'week'], privacy: ['private', 'any'],
    invest: 'Premium, by program',
    tags: ['Precision medicine', 'Stem cells', 'Molecular testing'],
    score_base: 81
  },
  {
    name: 'Human Longevity', location: 'San Diego & San Francisco, US',
    goals: ['diagnostics', 'pharmacological'],
    travel: ['us', 'any'], budget: ['entry', 'mid'],
    duration: ['day', 'week'], privacy: ['any'],
    invest: '$8,000 – $12,000 / year',
    tags: ['WGS', 'Full-body MRI', '120+ biomarkers'],
    score_base: 87
  },
  {
    name: 'Fountain Life', location: 'US Network',
    goals: ['diagnostics', 'pharmacological', 'performance'],
    travel: ['us', 'any'], budget: ['mid', 'premium'],
    duration: ['day', 'week'], privacy: ['any'],
    invest: '$20,000+ / year',
    tags: ['AI diagnostics', 'Early detection', 'Prevention'],
    score_base: 85
  },
  {
    name: 'Extension Health NYC', location: 'New York City, US',
    goals: ['regenerative', 'pharmacological', 'performance'],
    travel: ['us', 'any'], budget: ['premium'],
    duration: ['day', 'week'], privacy: ['private', 'any'],
    invest: '$50,000 / year (Catalyst)',
    tags: ['Plasma exchange', 'EBOO', 'Hyperbaric', 'Personalized'],
    score_base: 84
  },
  {
    name: 'HUM2N', location: 'London, UK',
    goals: ['diagnostics', 'pharmacological', 'performance', 'aesthetic'],
    travel: ['europe', 'any'], budget: ['entry', 'mid'],
    duration: ['day', 'week'], privacy: ['any'],
    invest: '£1,495 – £1,695 baseline assessment',
    tags: ['Biomarkers', 'NAD+', 'IV protocols', 'Longevity'],
    score_base: 78
  },
  {
    name: 'Palazzo Fiuggi', location: 'Fiuggi, Italy',
    goals: ['retreat', 'performance', 'aesthetic'],
    travel: ['europe', 'any'], budget: ['mid', 'premium'],
    duration: ['week', 'multi'], privacy: ['private', 'any'],
    invest: '€7,300 – €11,900 / program',
    tags: ['Biohacking', 'Mitochondrial', 'Food as medicine'],
    score_base: 80
  },
  {
    name: 'Longevity Hub by CLP', location: 'Dubai, UAE',
    goals: ['diagnostics', 'aesthetic', 'pharmacological'],
    travel: ['dubai', 'any'], budget: ['mid', 'premium'],
    duration: ['day', 'week'], privacy: ['private', 'any'],
    invest: 'Membership-based',
    tags: ['CLP brand', 'Biological age', 'Peptides', 'Aesthetics'],
    score_base: 82
  }
];

const GOAL_REASONS = {
  diagnostics: 'delivers the deepest biomarker and imaging protocol, giving you a complete biological picture before designing any therapeutic intervention',
  retreat: 'offers the most validated multi-week residential longevity program with physician-supervised detox, metabolic reset, and measurable biomarker improvements',
  pharmacological: 'provides rigorous physician oversight for longevity pharmacology including NAD+ augmentation, senolytics, and evidence-based supplementation protocols',
  regenerative: 'operates one of the most clinically advanced regenerative programs, with documented outcomes across stem cell, exosome, and plasma-based interventions',
  performance: 'combines sports science diagnostics with longevity medicine, optimizing VO₂ max, HRV, sleep architecture, and metabolic flexibility under one roof',
  aesthetic: 'integrates aesthetic outcomes directly into the longevity protocol, treating skin biology and body composition as biomarkers of cellular health'
};

const Matcher = {
  run(params) {
    const { goal, travel, duration, budget, privacy } = params;

    const scored = CLINICS_DB.map(c => {
      let score = c.score_base;
      if (c.goals.includes(goal)) score += 8;
      if (c.travel.includes(travel) || travel === 'any') score += 4;
      if (c.budget.includes(budget)) score += 5;
      if (c.duration.includes(duration)) score += 3;
      if (privacy === 'private' && c.privacy.includes('private')) score += 3;
      // normalize to 100
      score = Math.min(99, score);
      return { ...c, matchScore: score };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return scored.slice(0, 3);
  },

  render(matches, params) {
    const reason = GOAL_REASONS[params.goal] || 'aligns precisely with your stated objectives and travel parameters';
    const container = document.getElementById('matcherResults');
    container.innerHTML = '';

    matches.forEach((c, i) => {
      const card = document.createElement('div');
      card.className = 'match-card reveal';
      card.innerHTML = `
        <div class="match-rank">${String(i + 1).padStart(2, '0')}</div>
        <div class="match-location">${c.location}</div>
        <div class="match-clinic-name">${c.name}</div>
        <div class="match-score-row">
          <div class="match-score-bar"><div class="match-score-fill" style="width:0%" data-w="${c.matchScore}%"></div></div>
          <div class="match-score-num">${c.matchScore}%</div>
        </div>
        <div class="match-why">
          Based on your profile, ${c.name} ${reason}.
          ${c.travel.includes('dubai') || c.location.includes('Dubai') ? 'Accessible from Dubai with no long-haul travel.' : ''}
        </div>
        <div class="match-invest"><strong>Program Investment:</strong> ${c.invest}</div>
        <div style="margin-top:0.5rem">${c.tags.map(t => `<span class="match-tag">${t}</span>`).join('')}</div>
        <div class="match-actions">
          <button class="btn-gold" style="font-size:0.65rem;padding:0.35rem 0.8rem" onclick="App.saveMatch('${c.name}', '${c.location}')">Save as Proposal</button>
          <button class="btn-ghost" style="font-size:0.65rem" onclick="App.copyMatchText('${c.name}', '${c.location}', '${c.invest}')">Copy Brief</button>
        </div>`;
      container.appendChild(card);

      setTimeout(() => {
        card.classList.add('visible');
        const fill = card.querySelector('.match-score-fill');
        fill.style.width = fill.dataset.w;
      }, i * 200);
    });
  }
};

/* ============================================================
   6. NOTIFICATION TEMPLATES
   ============================================================ */
const TEMPLATES = {
  welcome: `Dear [CLIENT NAME],

Thank you for reaching out to AEON Concierge.

I've noted your interest in [PRIMARY GOAL] and would like to arrange a brief private call to understand your objectives in more detail before I put together any recommendations.

Everything discussed remains entirely confidential.

Would [DATE/TIME] work for a 20-minute conversation? I'm available across Gulf business hours and can accommodate your schedule.

With warm regards,
[ADVISOR NAME]
AEON Concierge · Dubai`,

  proposal: `Dear [CLIENT NAME],

Following our conversation, I have reviewed your profile carefully and identified three programs that I believe are precisely suited to your objectives.

I am attaching a brief summary of each. Please note that all three facilities operate at the highest standard of clinical rigor and have been personally vetted by our advisory team.

1. [CLINIC 1] — [LOCATION] — [INVESTMENT RANGE]
2. [CLINIC 2] — [LOCATION] — [INVESTMENT RANGE]
3. [CLINIC 3] — [LOCATION] — [INVESTMENT RANGE]

I can arrange a private briefing with any or all of these facilities and handle all logistics on your behalf.

Please let me know your preferred direction and I will proceed immediately.

With warm regards,
[ADVISOR NAME]
AEON Concierge`,

  confirmed: `Dear [CLIENT NAME],

I am pleased to confirm your reservation at [CLINIC NAME] for [CHECK-IN DATE] to [CHECK-OUT DATE].

I will coordinate directly with the facility team and revert to you within 24 hours with your complete pre-arrival briefing, including:

— Physician team overview
— Program schedule and preparation guidelines
— Dietary and supplement protocols to begin now
— Private transfer arrangements
— Emergency contact details

In the meantime, please do not hesitate to contact me directly for anything at all.

With warm regards,
[ADVISOR NAME]
AEON Concierge`,

  followup: `Dear [CLIENT NAME],

I trust your program at [CLINIC NAME] exceeded expectations.

As discussed, the next step in your protocol is a [BIOMARKER PANEL / FOLLOW-UP CONSULTATION] approximately [6 weeks / 3 months] from your return date.

I have taken the liberty of identifying two options for this follow-up and will send you a brief note shortly.

Please do not hesitate to reach out in the meantime — I am available directly.

With warm regards,
[ADVISOR NAME]
AEON Concierge`,

  payment: `Dear [CLIENT NAME],

Please find enclosed the invoice for AEON Concierge advisory services in connection with your [CLINIC NAME] program.

Service: [SERVICE DESCRIPTION]
Amount: [AMOUNT]
Due: [DUE DATE]

Payment details:
[BANK / WIRE DETAILS]

This invoice covers our coordination and advisory service only. Your program investment with [CLINIC NAME] is billed directly by the facility.

Thank you for placing your trust in AEON Concierge.

With warm regards,
[ADVISOR NAME]
AEON Concierge`
};

const Notif = {
  current: 'welcome',

  renderTemplate(key) {
    this.current = key;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === key);
    });
    document.getElementById('templateContent').textContent = TEMPLATES[key] || '';
  },

  renderLog() {
    const list = document.getElementById('notifList');
    const log = DB.activity();
    if (!log.length) { list.innerHTML = '<p style="font-size:0.75rem;color:var(--text-muted)">No activity logged yet.</p>'; return; }
    list.innerHTML = log.slice(0, 30).map(a => `
      <div class="notif-item">
        <div class="notif-dot ${a.read ? 'read' : ''}"></div>
        <div class="notif-body">
          <div class="notif-msg">${a.msg}</div>
          <div class="notif-time">${timeAgo(a.ts)}</div>
        </div>
      </div>`).join('');
  }
};

/* ============================================================
   7. MODALS
   ============================================================ */
const Modals = {
  open(id) { document.getElementById(id).classList.add('open'); },
  close(id) { document.getElementById(id).classList.remove('open'); },

  newLead() {
    document.getElementById('modalLeadTitle').textContent = 'New Lead';
    document.getElementById('leadForm').reset();
    document.querySelector('#leadForm [name="id"]').value = '';
    this.open('modalLead');
  },

  editLead(id) {
    const lead = DB.leads().find(l => l.id === id);
    if (!lead) return;
    document.getElementById('modalLeadTitle').textContent = 'Edit Lead';
    const form = document.getElementById('leadForm');
    Object.entries(lead).forEach(([k, v]) => {
      const el = form.elements[k];
      if (el) el.value = v || '';
    });
    this.open('modalLead');
  }
};

/* ============================================================
   8. APP ACTIONS
   ============================================================ */
const App = {
  deleteLead(id) {
    if (!confirm('Remove this lead?')) return;
    const lead = DB.leads().find(l => l.id === id);
    DB.deleteLead(id);
    if (lead) DB.addActivity(`Lead <strong>${lead.name}</strong> removed`, 'stage');
    Views[Router.current]();
    showToast('Lead removed');
  },

  deleteBooking(id) {
    if (!confirm('Remove this booking?')) return;
    DB.deleteBooking(id);
    Views.bookings();
    showToast('Booking removed');
  },

  deletePayment(id) {
    if (!confirm('Remove this payment record?')) return;
    DB.deletePayment(id);
    Views.revenue();
    showToast('Payment removed');
  },

  markPaid(id) {
    const payments = DB.payments();
    const p = payments.find(x => x.id === id);
    if (!p) return;
    p.status = 'paid';
    p.paidDate = new Date().toISOString().split('T')[0];
    DB.savePayment(p);
    const lead = DB.leads().find(l => l.id === p.clientId);
    DB.addActivity(`Payment ${fmt(p.amount)} from <strong>${lead ? lead.name : 'client'}</strong> marked as paid`, 'paid');
    Views.revenue();
    showToast('Payment marked as paid', 'success');
  },

  saveMatch(name, location) {
    showToast(`${name} saved — open Pipeline to assign to a client`, 'success');
    DB.addActivity(`AI matched clinic <strong>${name}</strong> (${location}) saved as proposal`, 'stage');
  },

  copyMatchText(name, location, invest) {
    const text = `Clinic: ${name}\nLocation: ${location}\nProgram Investment: ${invest}\n\nI can arrange a private briefing and handle all logistics on your behalf.`;
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
  },

  exportCSV() {
    const leads = DB.leads();
    const headers = ['Name', 'Email', 'Phone', 'Referral', 'Stage', 'Goal', 'Budget', 'Clinic', 'Coord Fee', 'Commission', 'Created'];
    const rows = leads.map(l => [
      l.name, l.email, l.phone, l.referral,
      STAGE_LABELS[l.stage], l.primaryGoal, BUDGET_LABELS[l.budget],
      l.assignedClinic, l.coordinationFee, l.commissionExpected,
      fmtDate(l.createdAt)
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'aeon-clients.csv'; a.click();
    showToast('CSV exported', 'success');
  },

  exportJSON() {
    const data = { leads: DB.leads(), bookings: DB.bookings(), payments: DB.payments(), exported: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'aeon-crm-export.json'; a.click();
    showToast('JSON exported', 'success');
  },

  seedData() {
    if (DB.leads().length > 0) { showToast('Data already exists. Clear first to reload samples.'); return; }
    const now = Date.now();
    const sampleLeads = [
      { id: uid(), name: 'Khalid Al-Rashid', email: 'khalid.ar@example.com', phone: '+971 50 123 4567', referral: 'Emirates NBD Private Banking', stage: 'proposal_sent', primaryGoal: 'Comprehensive diagnostics & biomarker mapping', budget: 'premium', assignedClinic: 'Clinique La Prairie', coordinationFee: 15000, commissionExpected: 6000, notes: 'Family office principal. Interested in CLP vs Human Longevity comparison. Prefers Europe.', createdAt: new Date(now - 12 * 86400000).toISOString(), updatedAt: new Date(now - 2 * 86400000).toISOString() },
      { id: uid(), name: 'Fatima Al-Mansoori', email: 'fatima.m@example.com', phone: '+971 56 234 5678', referral: 'Julius Baer Dubai', stage: 'intake_call', primaryGoal: 'Hormonal & aesthetic integration', budget: 'mid', assignedClinic: '', coordinationFee: 10000, commissionExpected: 4000, notes: 'CEO, 44. Interested in longevity + aesthetic integration. Dubai-based, prefers local options first.', createdAt: new Date(now - 5 * 86400000).toISOString(), updatedAt: new Date(now - 1 * 86400000).toISOString() },
      { id: uid(), name: 'Marcus Hoffmann', email: 'marcus.h@example.com', phone: '+49 89 000 0000', referral: 'Peer referral', stage: 'booking_confirmed', primaryGoal: 'Regenerative medicine', budget: 'premium', assignedClinic: 'AEON Clinic Dubai', coordinationFee: 18000, commissionExpected: 8000, notes: 'European tech founder relocating to Dubai. Full stem cell protocol requested.', createdAt: new Date(now - 22 * 86400000).toISOString(), updatedAt: new Date(now - 3 * 86400000).toISOString() },
      { id: uid(), name: 'Rania Benali', email: 'rania.b@example.com', phone: '+212 6 00 00 00', referral: 'TIGER 21 Gulf', stage: 'new_inquiry', primaryGoal: 'Performance & cognitive optimization', budget: 'mid', assignedClinic: '', coordinationFee: 0, commissionExpected: 0, notes: 'Inquiry via website. Athlete background, interested in VO2 max and cognitive enhancement.', createdAt: new Date(now - 1 * 86400000).toISOString(), updatedAt: new Date(now - 1 * 86400000).toISOString() },
      { id: uid(), name: 'Ahmed Al-Sayed', email: 'ahmed.s@example.com', phone: '+966 50 000 0000', referral: 'Hevolution Forum Riyadh', stage: 'completed', primaryGoal: 'Residential longevity retreat', budget: 'premium', assignedClinic: 'Chenot Palace Weggis', coordinationFee: 12000, commissionExpected: 5500, notes: 'Completed 14-day Chenot program. Excellent results. Follow-up booked for 6 months.', createdAt: new Date(now - 60 * 86400000).toISOString(), updatedAt: new Date(now - 14 * 86400000).toISOString() }
    ];
    sampleLeads.forEach(l => DB.saveLead(l));

    const sampleBookings = [
      { id: uid(), clientId: sampleLeads[2].id, clinic: 'AEON Clinic Dubai', program: 'Full Regenerative Protocol', checkIn: '2026-06-15', checkOut: '2026-06-22', programInvestment: 55000, coordinationFee: 18000, commissionAmount: 8000, status: 'confirmed' },
      { id: uid(), clientId: sampleLeads[4].id, clinic: 'Chenot Palace Weggis', program: 'Chenot Method 14-day', checkIn: '2026-04-01', checkOut: '2026-04-15', programInvestment: 38000, coordinationFee: 12000, commissionAmount: 5500, status: 'completed' }
    ];
    sampleBookings.forEach(b => DB.saveBooking(b));

    const samplePayments = [
      { id: uid(), clientId: sampleLeads[2].id, type: 'coordination_fee', amount: 18000, date: '2026-05-20', status: 'paid' },
      { id: uid(), clientId: sampleLeads[4].id, type: 'coordination_fee', amount: 12000, date: '2026-04-10', status: 'paid' },
      { id: uid(), clientId: sampleLeads[4].id, type: 'clinic_commission', amount: 5500, date: '2026-04-20', status: 'paid' },
      { id: uid(), clientId: sampleLeads[0].id, type: 'coordination_fee', amount: 15000, date: '2026-06-01', status: 'pending' },
      { id: uid(), clientId: sampleLeads[2].id, type: 'clinic_commission', amount: 8000, date: '2026-06-22', status: 'pending' }
    ];
    samplePayments.forEach(p => DB.savePayment(p));

    DB.addActivity('Sample data loaded — 5 leads, 2 bookings, 5 payments', 'new');
    DB.addActivity(`<strong>Marcus Hoffmann</strong> booking confirmed at AEON Clinic Dubai`, 'book');
    DB.addActivity(`<strong>Ahmed Al-Sayed</strong> completed Chenot Palace program`, 'stage');
    DB.addActivity(`Payment ${fmt(18000)} received from <strong>Marcus Hoffmann</strong>`, 'paid');
    DB.addActivity(`New inquiry from <strong>Rania Benali</strong> via TIGER 21 Gulf`, 'new');

    showToast('Sample data loaded', 'success');
    Router.go('dashboard');
  },

  clearData() {
    if (!confirm('This will permanently delete all CRM data. Are you sure?')) return;
    ['leads', 'bookings', 'payments', 'activity', 'settings', 'fees'].forEach(k => localStorage.removeItem('aeon_' + k));
    showToast('All data cleared');
    Router.go('dashboard');
  }
};

/* ============================================================
   9. FORM HANDLERS & EVENT LISTENERS
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  /* --- Nav routing --- */
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); Router.go(el.dataset.view); });
  });

  /* --- Card links in dashboard --- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-view]');
    if (el && el.tagName === 'A') { e.preventDefault(); Router.go(el.dataset.view); }
  });

  /* --- Sidebar toggle (mobile) --- */
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  /* --- Add Lead buttons --- */
  document.getElementById('btnAddLead').addEventListener('click', () => Modals.newLead());
  document.getElementById('btnAddLeadPipeline').addEventListener('click', () => Modals.newLead());

  /* --- Add Booking button --- */
  document.getElementById('btnAddBooking').addEventListener('click', () => {
    document.getElementById('bookingForm').reset();
    const leads = DB.leads();
    document.getElementById('bookingClientSelect').innerHTML = leads.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    Modals.open('modalBooking');
  });

  /* --- Add Payment button --- */
  document.getElementById('btnAddPayment').addEventListener('click', () => {
    document.getElementById('paymentForm').reset();
    const leads = DB.leads();
    document.getElementById('paymentClientSelect').innerHTML = leads.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    document.getElementById('paymentForm').elements['date'].value = new Date().toISOString().split('T')[0];
    Modals.open('modalPayment');
  });

  /* --- Modal close --- */
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => Modals.close(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) Modals.close(overlay.id); });
  });

  /* --- Lead form submit --- */
  document.getElementById('leadForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const isNew = !data.id;
    if (isNew) { data.id = uid(); data.createdAt = new Date().toISOString(); }
    data.updatedAt = new Date().toISOString();
    DB.saveLead(data);
    if (isNew) DB.addActivity(`New lead <strong>${data.name}</strong> added (${data.primaryGoal || 'no goal set'})`, 'new');
    else DB.addActivity(`Lead <strong>${data.name}</strong> updated`, 'stage');
    Modals.close('modalLead');
    Views[Router.current]();
    showToast(isNew ? 'Lead added' : 'Lead updated', 'success');
  });

  /* --- Booking form submit --- */
  document.getElementById('bookingForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (!data.id) { data.id = uid(); data.createdAt = new Date().toISOString(); }
    DB.saveBooking(data);
    // update lead stage
    const lead = DB.leads().find(l => l.id === data.clientId);
    if (lead && lead.stage !== 'booking_confirmed' && lead.stage !== 'active_client' && lead.stage !== 'completed') {
      lead.stage = 'booking_confirmed';
      lead.assignedClinic = data.clinic;
      DB.saveLead(lead);
      DB.addActivity(`<strong>${lead.name}</strong> booking confirmed at ${data.clinic}`, 'book');
    }
    Modals.close('modalBooking');
    Views[Router.current]();
    showToast('Booking saved', 'success');
  });

  /* --- Payment form submit --- */
  document.getElementById('paymentForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (!data.id) { data.id = uid(); }
    DB.savePayment(data);
    const lead = DB.leads().find(l => l.id === data.clientId);
    if (data.status === 'paid') DB.addActivity(`Payment ${fmt(data.amount)} from <strong>${lead ? lead.name : 'client'}</strong> received`, 'paid');
    Modals.close('modalPayment');
    Views.revenue();
    showToast('Payment recorded', 'success');
  });

  /* --- AI Matcher form --- */
  document.getElementById('matcherForm').addEventListener('submit', e => {
    e.preventDefault();
    const params = Object.fromEntries(new FormData(e.target));
    const matches = Matcher.run(params);
    Matcher.render(matches, params);
    DB.addActivity(`AI matching run for goal: <strong>${params.goal}</strong>`, 'stage');
  });

  /* --- Client search/filter --- */
  document.getElementById('clientSearch').addEventListener('input', () => Views.clients());
  document.getElementById('clientFilter').addEventListener('change', () => Views.clients());

  /* --- Notification templates tabs --- */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => Notif.renderTemplate(btn.dataset.tab));
  });

  /* --- Copy template --- */
  document.getElementById('btnCopyTemplate').addEventListener('click', () => {
    const sel = document.getElementById('templateRecipient');
    const leadId = sel.value;
    let text = TEMPLATES[Notif.current] || '';
    if (leadId) {
      const lead = DB.leads().find(l => l.id === leadId);
      if (lead) {
        text = text.replace(/\[CLIENT NAME\]/g, lead.name)
                   .replace(/\[PRIMARY GOAL\]/g, lead.primaryGoal || 'longevity optimization')
                   .replace(/\[ADVISOR NAME\]/g, DB.settings().advisorName || 'AEON Advisor');
      }
    }
    navigator.clipboard.writeText(text).then(() => showToast('Template copied', 'success'));
  });

  document.getElementById('btnEmailDraft').addEventListener('click', () => {
    const sel = document.getElementById('templateRecipient');
    const lead = DB.leads().find(l => l.id === sel.value);
    const subject = encodeURIComponent('AEON Concierge — Private Longevity Advisory');
    const body = encodeURIComponent(TEMPLATES[Notif.current] || '');
    const email = lead ? lead.email : '';
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  });

  /* --- Settings forms --- */
  document.getElementById('settingsForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    DB.setObj('settings', data);
    showToast('Settings saved', 'success');
  });

  document.getElementById('feeForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    DB.setObj('fees', data);
    showToast('Fee structure saved', 'success');
  });

  /* --- Data management --- */
  document.getElementById('btnExportCSV').addEventListener('click', () => App.exportCSV());
  document.getElementById('btnExportJSON').addEventListener('click', () => App.exportJSON());
  document.getElementById('btnSeedData').addEventListener('click', () => App.seedData());
  document.getElementById('btnClearData').addEventListener('click', () => App.clearData());

  /* --- Inline form from main website --- */
  window.addEventListener('storage', e => {
    if (e.key === 'aeon_new_inquiry' && e.newValue) {
      try {
        const inquiry = JSON.parse(e.newValue);
        const lead = {
          id: uid(), name: inquiry.name || 'New Inquiry', email: inquiry.email || '',
          phone: '', referral: inquiry.referral || '',
          stage: 'new_inquiry', primaryGoal: inquiry.objective || '',
          budget: 'entry', notes: inquiry.message || '',
          coordinationFee: 0, commissionExpected: 0,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        DB.saveLead(lead);
        DB.addActivity(`New inquiry from <strong>${lead.name}</strong> via website`, 'new');
        localStorage.removeItem('aeon_new_inquiry');
      } catch {}
    }
  });

  /* --- Boot --- */
  Router.go('dashboard');
});
