/* ===========================================================
   Clean Cut Barber Shop — booking + hours logic
   =========================================================== */

/* ---- The only two lines you'd ever need to edit ---- */
const SHOP_PHONE = '+13523764489';        // where text booking requests go
const BOOKING_EMAIL = '';                 // add the shop's email to switch on the "email" button
/* ---------------------------------------------------- */

const SHOP_TZ = 'America/New_York';

/* Posted hours: [openHour, closeHour] in 24h, keyed by JS day number. null = closed. */
const HOURS = {
  0: null,        // Sunday
  1: [12, 18],    // Monday    12–6
  2: [8, 18],     // Tuesday    8–6
  3: [8, 18],     // Wednesday  8–6
  4: [8, 18],     // Thursday   8–6
  5: [8, 19],     // Friday     8–7
  6: [8, 15]      // Saturday   8–3
};
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SERVICES = [
  { id: 'men-reg',   name: "Men's regular cut",  price: 10 },
  { id: 'fade',      name: 'Fade or fro',        price: 12 },
  { id: 'boys-fade', name: "Boys' fade (low)",   price: 10 },
  { id: 'boys-reg',  name: "Boys' regular cut",  price: 8  },
  { id: 'philly',    name: 'Philly fro',         price: 14 },
  { id: 'modify',    name: 'Modify cut',         price: 16 },
  { id: 'flat-bald', name: 'Flat top or bald',   price: 12 },
  { id: 'senior',    name: 'Senior citizen 65+', price: 8  },
  { id: 'razor',     name: 'Razor shave',        price: null },
  { id: 'shine',     name: 'Shoe shine',         price: null }
];

const ADDONS = [
  { id: 'beard-cut', name: 'Beard with cut', price: 3 },
  { id: 'edge',      name: 'Edge or beard',  price: 7 },
  { id: 'edge-beard',name: 'Edge + beard',   price: 10 },
  { id: 'mustache',  name: 'Mustache',       price: 3 },
  { id: 'clipper',   name: 'Clipper shave',  price: 5 },
  { id: 'shampoo',   name: 'Shampoo',        price: 7 }
];

const SLOT_MINUTES = 30;     // slot spacing
const LEAD_MINUTES = 45;     // don't offer a slot less than this far out

/* ---------- helpers ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const money = n => '$' + n;

/* "Now" as the shop experiences it, regardless of the visitor's timezone. */
function shopNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(new Date()).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return new Date(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
}

function fmtTime(h, m) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return hr + ':' + String(m).padStart(2, '0') + ' ' + ampm;
}
function fmtHourShort(h) {
  const ampm = h >= 12 ? 'pm' : 'am';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return hr + ampm;
}
function fmtDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ---------- open / closed pill ---------- */
function renderStatus() {
  const pill = $('#status-pill');
  const text = $('#status-text');
  if (!pill) return;

  const now = shopNow();
  const today = HOURS[now.getDay()];
  const mins = now.getHours() * 60 + now.getMinutes();

  let open = false, msg = '';
  if (today) {
    const [o, c] = today;
    if (mins >= o * 60 && mins < c * 60) {
      open = true;
      msg = 'Open now · until ' + fmtHourShort(c) + ' today';
    } else if (mins < o * 60) {
      msg = 'Closed · opens ' + fmtHourShort(o) + ' today';
    }
  }
  if (!msg) {
    // find the next day that has hours
    for (let i = 1; i <= 7; i++) {
      const d = (now.getDay() + i) % 7;
      if (HOURS[d]) {
        const label = i === 1 ? 'tomorrow' : DAY_NAMES[d];
        msg = 'Closed · opens ' + fmtHourShort(HOURS[d][0]) + ' ' + label;
        break;
      }
    }
  }

  text.textContent = msg;
  pill.classList.toggle('is-open', open);
  pill.classList.toggle('is-closed', !open);
  pill.hidden = false;

  const row = $('#hours-table tr[data-day="' + now.getDay() + '"]');
  if (row) row.classList.add('is-today');
}

/* ---------- booking state ---------- */
const state = { service: null, addons: [], date: null, time: null };

/* ---------- step 1: services ---------- */
function renderServices() {
  $('#service-chips').innerHTML = SERVICES.map(s => `
    <label class="chip">
      <input type="radio" name="service" value="${s.id}">
      <span>${s.name} <em>${s.price === null ? 'ask' : money(s.price)}</em></span>
    </label>`).join('');

  $('#addon-chips').innerHTML = ADDONS.map(a => `
    <label class="chip">
      <input type="checkbox" name="addon" value="${a.id}">
      <span>${a.name} <em>${money(a.price)}</em></span>
    </label>`).join('');

  $('#service-chips').addEventListener('change', e => {
    state.service = SERVICES.find(s => s.id === e.target.value) || null;
    updateSummary();
  });
  $('#addon-chips').addEventListener('change', () => {
    state.addons = $$('#addon-chips input:checked').map(i => ADDONS.find(a => a.id === i.value));
    updateSummary();
  });
}

/* ---------- step 2: days + slots ---------- */
function slotsFor(date, now) {
  const hours = HOURS[date.getDay()];
  if (!hours) return [];
  const [open, close] = hours;
  const isToday = date.toDateString() === now.toDateString();
  const earliest = isToday ? now.getHours() * 60 + now.getMinutes() + LEAD_MINUTES : -1;

  const out = [];
  for (let m = open * 60; m <= close * 60 - SLOT_MINUTES; m += SLOT_MINUTES) {
    if (m < earliest) continue;
    out.push({ mins: m, label: fmtTime(Math.floor(m / 60), m % 60) });
  }
  return out;
}

function renderDays() {
  const now = shopNow();
  const wrap = $('#day-chips');
  const days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { weekday: 'short' });
    const available = slotsFor(d, now).length > 0;
    days.push({ d, label, available, i });
  }

  wrap.innerHTML = days.map(({ d, label, available, i }) => `
    <label class="chip day">
      <input type="radio" name="day" value="${i}" ${available ? '' : 'disabled'}>
      <span>
        <b>${label}</b>
        <i>${available ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Closed'}</i>
      </span>
    </label>`).join('');

  wrap.addEventListener('change', e => {
    const i = +e.target.value;
    state.date = days[i].d;
    state.time = null;
    renderSlots();
    updateSummary();
  });

  // preselect the first bookable day so the form feels alive
  const first = days.find(x => x.available);
  if (first) {
    const input = wrap.querySelector('input[value="' + first.i + '"]');
    input.checked = true;
    state.date = first.d;
  }
  renderSlots();
}

function renderSlots() {
  const box = $('#time-slots');
  const note = $('#slot-note');
  if (!state.date) { box.innerHTML = '<p class="empty">Pick a day first.</p>'; note.textContent = ''; return; }

  const list = slotsFor(state.date, shopNow());
  const hours = HOURS[state.date.getDay()];
  note.textContent = hours ? '· ' + fmtHourShort(hours[0]) + '–' + fmtHourShort(hours[1]) : '';

  if (!list.length) {
    box.innerHTML = '<p class="empty">No times left for that day. Try the next one, or just walk in.</p>';
    return;
  }
  box.innerHTML = list.map(s => `
    <label class="chip slot">
      <input type="radio" name="time" value="${s.mins}">
      <span>${s.label}</span>
    </label>`).join('');
}

/* delegated so it survives re-renders */
document.addEventListener('change', e => {
  if (e.target.name === 'time') {
    state.time = +e.target.value;
    updateSummary();
  }
});

/* ---------- summary ---------- */
function whenText() {
  if (!state.date || state.time === null) return null;
  return fmtDate(state.date) + ' at ' + fmtTime(Math.floor(state.time / 60), state.time % 60);
}

function totalText() {
  if (!state.service) return '—';
  const addonSum = state.addons.reduce((n, a) => n + a.price, 0);
  if (state.service.price === null) {
    return addonSum ? money(addonSum) + ' + cut' : 'Ask in shop';
  }
  return money(state.service.price + addonSum);
}

function updateSummary() {
  const set = (k, v) => { const el = $('[data-sum="' + k + '"]'); if (el) el.textContent = v; };
  set('service', state.service ? state.service.name + (state.service.price === null ? '' : ' · ' + money(state.service.price)) : '—');
  set('addons', state.addons.length ? state.addons.map(a => a.name).join(', ') : 'None');
  set('when', whenText() || '—');
  set('name', $('#f-name').value.trim() || '—');
  set('total', totalText());
}

/* ---------- steps ---------- */
function goToStep(n, focus = true) {
  $$('.step').forEach(step => {
    const i = +step.dataset.step;
    step.classList.toggle('is-active', i === n);
    step.classList.toggle('is-done', i < n);
  });
  const active = $('.step[data-step="' + n + '"]');
  if (active && focus) {
    const top = active.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top, behavior: 'smooth' });
    const firstInput = active.querySelector('input:not([disabled]), textarea');
    if (firstInput && n === 3) setTimeout(() => firstInput.focus(), 260);
  }
}

function validateStep(n) {
  clearErrors();
  if (n === 1 && !state.service) {
    flash('#service-chips', 'Pick a service to keep going.');
    return false;
  }
  if (n === 2) {
    if (!state.date) { flash('#day-chips', 'Pick a day.'); return false; }
    if (state.time === null) { flash('#time-slots', 'Pick a time.'); return false; }
  }
  return true;
}

function flash(sel, msg) {
  const el = $(sel);
  let note = el.parentElement.querySelector('.err');
  if (!note) {
    note = document.createElement('span');
    note.className = 'err';
    el.parentElement.appendChild(note);
  }
  note.textContent = msg;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
function clearErrors() {
  $$('.err').forEach(e => { if (!e.dataset.err) e.textContent = ''; });
}

/* ---------- message + send ---------- */
function buildMessage(data) {
  const lines = [
    'Booking request — Clean Cut Barber Shop',
    '',
    'Service: ' + state.service.name + (state.service.price === null ? '' : ' (' + money(state.service.price) + ')'),
  ];
  if (state.addons.length) {
    lines.push('Add-ons: ' + state.addons.map(a => a.name + ' (' + money(a.price) + ')').join(', '));
  }
  lines.push('Requested: ' + whenText());
  lines.push('Name: ' + data.name);
  lines.push('Phone: ' + data.phone);
  if (data.barber) lines.push('Barber: ' + data.barber);
  if (data.note) lines.push('Notes: ' + data.note);
  lines.push('Estimated total: ' + totalText());
  return lines.join('\n');
}

function showSendBox(message) {
  const box = $('#sendbox');
  $('#send-preview').textContent = message;

  const encoded = encodeURIComponent(message);
  $('#send-sms').href = 'sms:' + SHOP_PHONE + '?&body=' + encoded;

  const emailBtn = $('#send-email');
  if (BOOKING_EMAIL) {
    emailBtn.href = 'mailto:' + BOOKING_EMAIL
      + '?subject=' + encodeURIComponent('Booking request — ' + $('#f-name').value.trim())
      + '&body=' + encoded;
    emailBtn.hidden = false;
  } else {
    emailBtn.hidden = true;
  }

  box.hidden = false;
  $('#booking').style.display = 'none';
  box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  box.focus({ preventScroll: true });
}

/* ---------- wire up ---------- */
function init() {
  renderStatus();
  renderServices();
  renderDays();
  updateSummary();
  const y = $('#year');
  if (y) y.textContent = String(new Date().getFullYear());

  $$('.btn-next').forEach(b => b.addEventListener('click', () => {
    const current = +b.closest('.step').dataset.step;
    if (validateStep(current)) goToStep(+b.dataset.next);
  }));
  $$('.btn-back').forEach(b => b.addEventListener('click', () => goToStep(+b.dataset.back)));

  $$('.step-head').forEach(head => head.addEventListener('click', () => {
    const step = head.closest('.step');
    if (!step.classList.contains('is-active')) goToStep(+step.dataset.step);
  }));

  $('#f-name').addEventListener('input', updateSummary);

  $('#booking').addEventListener('submit', e => {
    e.preventDefault();
    if (!validateStep(1)) { goToStep(1); return; }
    if (!validateStep(2)) { goToStep(2); return; }

    const name = $('#f-name').value.trim();
    const phone = $('#f-phone').value.trim();
    const digits = phone.replace(/\D/g, '');
    let bad = false;

    $('[data-err="name"]').textContent = '';
    $('[data-err="phone"]').textContent = '';
    $('#f-name').removeAttribute('aria-invalid');
    $('#f-phone').removeAttribute('aria-invalid');

    if (!name) {
      $('[data-err="name"]').textContent = 'We need a name to call out.';
      $('#f-name').setAttribute('aria-invalid', 'true');
      bad = true;
    }
    if (digits.length < 10) {
      $('[data-err="phone"]').textContent = 'Enter a 10-digit mobile number so we can confirm.';
      $('#f-phone').setAttribute('aria-invalid', 'true');
      bad = true;
    }
    if (bad) { $('#f-name').focus(); return; }

    showSendBox(buildMessage({
      name, phone,
      barber: $('#f-barber').value.trim(),
      note: $('#f-note').value.trim()
    }));
  });

  $('#send-edit').addEventListener('click', () => {
    $('#sendbox').hidden = true;
    $('#booking').style.display = '';
    goToStep(3);
  });

  $('#send-copy').addEventListener('click', async e => {
    const btn = e.currentTarget;
    const text = $('#send-preview').textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
    const original = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = original; }, 1800);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
