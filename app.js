/* ==========================================================
   NOVA PAY — Live Wallet  ·  app.js
   Pure vanilla JS. State persisted to localStorage.
   ========================================================== */
'use strict';

/* ---------- tiny helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const wait = ms => new Promise(r => setTimeout(r, ms));
const uid = p => p + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

const money = (n, dec = 2) =>
  Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const splitMoney = n => {
  const s = money(n).split('.');
  return { int: s[0], dec: '.' + (s[1] || '00') };
};
const digits = v => String(v || '').replace(/\D+/g, '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const dayKey = ts => new Date(ts).toISOString().slice(0, 10);
const fmtDay = ts => {
  const today = new Date(), y = new Date(Date.now() - 864e5);
  const k = dayKey(ts);
  if (k === dayKey(today)) return 'Today';
  if (k === dayKey(y)) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};
const fmtTime = ts => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/* ==========================================================
   CONFIG
   ========================================================== */
const CFG = {
  PIN_FEE: 1000,
  BANK: { name: 'FRANK GODWIN', bank: 'BHU BANK', acct: '070003823727' },
  MIN_WD: 100,
  STORE: 'nova_wallet_v2'
};

/* ==========================================================
   STATE
   ========================================================== */
const NOW = Date.now();
const ago = ms => NOW - ms;

function seed() {
  return {
    profile: {
      name: 'Michael Carter',
      email: 'michael.carter@novapay.io',
      phone: '0803 555 0192',
      walletId: '7039821456',
      pin: '1234',
      cardNo: '5399  ••••  ••••  4291',
      cardExp: '08/29',
      cardFrozen: false
    },
    balance: 486320.5,
    balanceHidden: false,
    pendingPin: null,
    tx: [
      { id: uid('TX'), type: 'credit', title: 'Salary — Acme Systems', note: 'October payroll', amount: 320000, ts: ago(3 * 36e5), ref: 'CR' + Math.floor(1e7 + Math.random() * 9e6), status: 'success' },
      { id: uid('TX'), type: 'debit', title: 'Sent to Grace Okonkwo', note: 'Rent contribution', amount: 75000, ts: ago(9 * 36e5), ref: 'DR' + Math.floor(1e7 + Math.random() * 9e6), status: 'success' },
      { id: uid('TX'), type: 'pin', title: 'Withdrawal PIN purchase', note: 'Paid to FRANK GODWIN · BHU BANK', amount: 1000, fee: true, ts: ago(26 * 36e5), ref: 'NV' + Math.floor(1e6 + Math.random() * 9e6), status: 'success' },
      { id: uid('TX'), type: 'withdrawal', title: 'Withdrawal to GTBank', note: '•••• 8842', amount: 40000, ts: ago(27 * 36e5), ref: 'WD' + Math.floor(1e7 + Math.random() * 9e6), status: 'success' },
      { id: uid('TX'), type: 'debit', title: 'Airtime · MTN', note: '0803 555 0192', amount: 2000, ts: ago(50 * 36e5), ref: 'AIR' + Math.floor(1e6 + Math.random() * 9e6), status: 'success' },
      { id: uid('TX'), type: 'credit', title: 'Transfer from Tunde Bello', note: 'Split of the bill', amount: 18500, ts: ago(74 * 36e5), ref: 'CR' + Math.floor(1e7 + Math.random() * 9e6), status: 'success' }
    ]
  };
}

let S;
function load() {
  try {
    const raw = localStorage.getItem(CFG.STORE);
    S = raw ? JSON.parse(raw) : seed();
    if (!S || !S.profile || !Array.isArray(S.tx)) S = seed();
  } catch { S = seed(); }
}
function save() { try { localStorage.setItem(CFG.STORE, JSON.stringify(S)); } catch {} }

/* ==========================================================
   TOASTS
   ========================================================== */
const TOAST_ICON = { ok: 'i-check', err: 'i-x', info: 'i-info', warn: 'i-shield' };
function toast(title, msg = '', kind = 'ok', ms = 3400) {
  const el = document.createElement('div');
  el.className = 'toast toast--' + kind;
  el.innerHTML =
    `<span class="toast__ic"><svg class="ic"><use href="#${TOAST_ICON[kind] || 'i-info'}"/></svg></span>
     <span><b>${esc(title)}</b>${msg ? `<span>${esc(msg)}</span>` : ''}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 380); }, ms);
}

/* ==========================================================
   COPY
   ========================================================== */
async function copyText(text, label = 'Copied') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast(label, text.length > 34 ? text.slice(0, 34) + '…' : text, 'ok', 2200);
    return true;
  } catch { toast('Copy failed', 'Please copy manually', 'err'); return false; }
}

/* ==========================================================
   RENDER — HEADER / BALANCE / STATS
   ========================================================== */
function renderHeader() {
  const p = S.profile;
  const initials = (p.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || 'NV').toUpperCase();
  $('#hdrName').textContent = p.name;
  $('#avatarChip').textContent = initials;
  $('#profAvatar').textContent = initials;
  $('#profName').textContent = p.name;
  $('#profMail').textContent = p.email;
  $('#fundName').textContent = p.name.toUpperCase();
  $('#cardHolder').textContent = p.name.toUpperCase();
  $('#cardExp').textContent = p.cardExp;
  $('#cardNo').textContent = p.cardNo;
  $('#hdrAcct').textContent = p.walletId.replace(/(\d{4})(\d{4})(\d+)/, '$1 $2 $3');
  $('#profInName').value = p.name;
  $('#profInMail').value = p.email;
  $('#profInPhone').value = p.phone;

  const h = new Date().getHours();
  $('#greeting').textContent = h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,';
}

let balAnim = null;
function renderBalance(animate = true) {
  const amtEl = $('.holo__amt');
  if (S.balanceHidden) {
    $('#balInt').textContent = '••••••';
    $('#balDec').textContent = '';
    amtEl.classList.add('is-hidden');
    $('#eyeUse').setAttribute('href', '#i-eye-off');
  } else {
    amtEl.classList.remove('is-hidden');
    $('#eyeUse').setAttribute('href', '#i-eye');
    const from = Number(String($('#balInt').textContent).replace(/[^\d]/g, '')) || 0;
    const target = S.balance;
    if (!animate || from === Math.floor(target)) {
      const p = splitMoney(target);
      $('#balInt').textContent = p.int; $('#balDec').textContent = p.dec;
    } else {
      if (balAnim) cancelAnimationFrame(balAnim);
      const t0 = performance.now(), dur = 750;
      const step = t => {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        const p = splitMoney(from + (target - from) * e);
        $('#balInt').textContent = p.int; $('#balDec').textContent = p.dec;
        if (k < 1) balAnim = requestAnimationFrame(step);
      };
      balAnim = requestAnimationFrame(step);
    }
  }
  $('#wdAvail').textContent = '$' + money(S.balance);
}

function renderStats() {
  const d = new Date(), m = d.getMonth(), y = d.getFullYear();
  let inc = 0, out = 0;
  S.tx.forEach(t => {
    const td = new Date(t.ts);
    if (td.getMonth() !== m || td.getFullYear() !== y) return;
    if (t.type === 'credit') inc += t.amount; else out += t.amount;
  });
  $('#statIn').textContent = '+$' + money(inc, 0);
  $('#statOut').textContent = '-$' + money(out, 0);
  $('#statCount').textContent = S.tx.length;
}

/* ==========================================================
   RENDER — TRANSACTIONS
   ========================================================== */
const TX_META = {
  credit:     { icon: 'i-down-left', dir: 'credit', sign: '+' },
  debit:      { icon: 'i-up-right',  dir: 'debit',  sign: '-' },
  withdrawal: { icon: 'i-cash',      dir: 'debit',  sign: '-' },
  pin:        { icon: 'i-key',       dir: 'pin',    sign: '-' },
  airtime:    { icon: 'i-spark',     dir: 'debit',  sign: '-' }
};
const metaOf = t => TX_META[t.type] || TX_META.debit;

function txRow(t) {
  const m = metaOf(t);
  const credit = m.dir === 'credit';
  return `<button class="tx tx--${m.dir}" data-tx="${esc(t.id)}">
    <span class="tx__ic"><svg class="ic"><use href="#${m.icon}"/></svg></span>
    <span class="tx__mid">
      <span class="tx__t">${esc(t.title)}</span>
      <span class="tx__s">${fmtDay(t.ts)} · ${fmtTime(t.ts)}${t.note ? ' · ' + esc(t.note) : ''}</span>
    </span>
    <span class="tx__amt ${credit ? 'pos' : 'neg'}">${m.sign}$${money(t.amount)}
      <small>${t.status === 'success' ? 'Successful' : 'Pending'}</small>
    </span>
  </button>`;
}

function renderRecent() {
  const items = S.tx.slice(0, 6);
  $('#recentList').innerHTML = items.length
    ? items.map(txRow).join('')
    : `<li class="empty"><svg class="ic"><use href="#i-cash"/></svg><b>No transactions yet</b><span>Fund your wallet to get started.</span></li>`;
}

let txFilter = 'all', txQuery = '';
function renderHistory() {
  const box = $('#txFull');
  const q = txQuery.trim().toLowerCase();
  const items = S.tx.filter(t => {
    if (txFilter === 'credit' && t.type !== 'credit') return false;
    if (txFilter === 'debit' && !(t.type === 'debit' || t.type === 'airtime')) return false;
    if (txFilter === 'withdrawal' && t.type !== 'withdrawal') return false;
    if (!q) return true;
    return [t.title, t.note, t.ref].some(v => String(v || '').toLowerCase().includes(q));
  });

  if (!items.length) {
    box.innerHTML = `<div class="empty"><svg class="ic"><use href="#i-search"/></svg><b>Nothing found</b><span>Try a different search or filter.</span></div>`;
    return;
  }

  const groups = new Map();
  items.forEach(t => {
    const k = dayKey(t.ts);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  });

  box.innerHTML = Array.from(groups.values()).map(list => {
    const net = list.reduce((a, t) => a + (t.type === 'credit' ? t.amount : -t.amount), 0);
    return `<div class="daygroup">
      <div class="daygroup__h"><span>${fmtDay(list[0].ts)}</span><b>${net >= 0 ? '+' : '-'}$${money(Math.abs(net))}</b></div>
      <div class="daygroup__list">${list.map(txRow).join('')}</div>
    </div>`;
  }).join('');
}

function renderAll(animateBal = false) {
  renderHeader();
  renderBalance(animateBal);
  renderStats();
  renderRecent();
  renderHistory();
}

/* ==========================================================
   NAVIGATION
   ========================================================== */
function go(view) {
  $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + view));
  $$('.tab[data-view]').forEach(t => t.classList.toggle('is-on', t.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'history') renderHistory();
}

/* ==========================================================
   MODAL SYSTEM
   ========================================================== */
let openModalId = null;
function openModal(name) {
  const modal = $(`[data-modal="${name}"]`);
  if (!modal) return;
  if (openModalId && openModalId !== name) {
    const prev = $(`[data-modal="${openModalId}"]`);
    if (prev) prev.hidden = true;
  }
  $('#overlay').hidden = false;
  modal.hidden = false;
  openModalId = name;
  document.body.classList.add('is-locked');
  if (name === 'withdraw') resetWizard();
  if (name === 'fund') $('#fundAmt').value = '';
  if (name === 'send') $('#sendSummary').innerHTML = '';
}
function closeModal() {
  $('#overlay').hidden = true;
  $$('.modal').forEach(m => m.hidden = true);
  openModalId = null;
  document.body.classList.remove('is-locked');
}

/* ==========================================================
   WITHDRAW WIZARD
   Step 1 amount → Step 2 buy PIN → Step 3 enter PIN → Step 4 done
   ========================================================== */
const WD = { step: 1, amount: 0, ref: '', pin: '', bank: '', acct: '' };
const otpInputs = () => $$('#wdOtp .otp__in');

function newRef() { return 'NV-' + Math.floor(100000 + Math.random() * 899999); }
function newPin() { return String(Math.floor(100000 + Math.random() * 899999)); }

function setStep(n) {
  WD.step = n;
  $$('.wstep', $('#m-withdraw')).forEach(s => s.classList.toggle('is-on', +s.dataset.step === n));
  const bars = $$('#wdSteps i');
  bars.forEach((b, i) => {
    b.classList.toggle('is-on', i === n - 1);
    b.classList.toggle('is-done', i < n - 1);
  });
  const titles = ['', 'Withdraw funds', 'Purchase Withdrawal PIN', 'Enter Withdrawal PIN', 'Withdrawal complete'];
  $('#wdTitle').textContent = titles[n];
  $('#wdSub').textContent = n < 4 ? `Step ${n} of 4` : 'Receipt';
  $('#m-withdraw .modal__scroll').scrollTop = 0;
}

function resetWizard() {
  WD.amount = 0; WD.ref = ''; WD.pin = ''; WD.bank = ''; WD.acct = '';
  $('#wdAmount').value = '';
  $('#wdBank').value = '';
  $('#wdAcct').value = '';
  $('#wdPaid').checked = false;
  $('#wdNext2').disabled = true;
  $('#wdConfirm').disabled = true;
  $('#wdOtpErr').hidden = true;
  $('#wdOtp').classList.remove('is-err');
  otpInputs().forEach(i => { i.value = ''; i.classList.remove('has-val'); });
  $('#wdFee').textContent = '$' + money(CFG.PIN_FEE);
  $('#wdFee2').textContent = '$' + money(CFG.PIN_FEE, 0);
  $('#wdAvail').textContent = '$' + money(S.balance);
  setStep(1);
}

function readWdAmount() { return Number(digits($('#wdAmount').value)) || 0; }

function buildSummary() {
  $('#wdSummary').innerHTML = `
    <div class="summary__row"><span>Amount</span><b>$${money(WD.amount)}</b></div>
    <div class="summary__row"><span>Destination</span><b>${esc(WD.bank)} · •••• ${esc(WD.acct.slice(-4))}</b></div>
    <div class="summary__row"><span>Withdrawal PIN fee</span><b>Paid separately</b></div>
    <div class="summary__row summary__row--total"><span>You receive</span><b>$${money(WD.amount)}</b></div>`;
}

function fillReceipt(t) {
  $('#wdReceipt').innerHTML = `
    <div class="receipt__row"><span>Reference</span><b class="mono">${esc(t.ref)}</b></div>
    <div class="receipt__row"><span>Amount</span><b>$${money(t.amount)}</b></div>
    <div class="receipt__row"><span>Destination</span><b>${esc(t.title.replace('Withdrawal to ', ''))}</b></div>
    <div class="receipt__row"><span>Date</span><b>${fmtDay(t.ts)} · ${fmtTime(t.ts)}</b></div>
    <div class="receipt__row"><span>Status</span><b style="color:var(--lime)">SUCCESSFUL</b></div>
    <div class="receipt__row"><span>Balance after</span><b>$${money(S.balance)}</b></div>`;
}

/* --- STEP 1 → 2 --- */
function wdStep1Next() {
  const amt = readWdAmount();
  const bank = $('#wdBank').value.trim();
  const acct = digits($('#wdAcct').value);

  if (!amt || amt < CFG.MIN_WD) return toast('Enter an amount', `Minimum withdrawal is $${money(CFG.MIN_WD, 0)}`, 'warn');
  if (amt > S.balance) return toast('Insufficient balance', `Available: $${money(S.balance)}`, 'err');
  if (bank.length < 2) return toast('Destination bank required', 'Enter the receiving bank', 'warn');
  if (acct.length < 10) return toast('Invalid account number', 'Enter 10–11 digits', 'warn');

  WD.amount = amt; WD.bank = bank; WD.acct = acct; WD.ref = newRef();
  $('#wdRef').textContent = WD.ref;
  $('#wdPaid').checked = false;
  $('#wdNext2').disabled = true;

  if (S.pendingPin && S.pendingPin.pin) {
    showIssuedPin(true);
    setStep(3);
  } else {
    setStep(2);
  }
}

/* --- STEP 2 → 3 (payment confirmed, issue PIN) --- */
async function wdStep2Next(btn) {
  btn.classList.add('is-busy');
  btn.textContent = 'Verifying payment…';
  await wait(1500);
  btn.classList.remove('is-busy');
  btn.textContent = 'I have paid — issue my PIN';

  const pin = newPin();
  S.pendingPin = { pin, ref: WD.ref, fee: CFG.PIN_FEE, createdAt: Date.now() };
  S.tx.unshift({
    id: uid('TX'), type: 'pin', title: 'Withdrawal PIN purchase',
    note: `Paid to ${CFG.BANK.name} · ${CFG.BANK.bank}`,
    amount: CFG.PIN_FEE, fee: true, ref: WD.ref, ts: Date.now(), status: 'success'
  });
  save();
  renderStats(); renderRecent(); renderHistory();

  showIssuedPin(false);
  setStep(3);
  toast('Payment confirmed', `Withdrawal PIN ${pin} issued`, 'ok');
}

function showIssuedPin(alreadyOwned) {
  const pin = S.pendingPin ? S.pendingPin.pin : '';
  WD.pin = pin;
  $('#wdPinVal').textContent = pin;
  $('#wdGate3Title').textContent = alreadyOwned ? 'Active Withdrawal PIN' : 'Payment received';
  $('#wdPinMsg').textContent = alreadyOwned
    ? 'You already purchased a PIN for this request. Enter it below to authorise the withdrawal.'
    : 'Your withdrawal PIN has been issued. Enter it below to authorise this withdrawal.';
  $('#wdPinShow').style.display = '';
  otpInputs().forEach(i => { i.value = ''; i.classList.remove('has-val'); });
  $('#wdConfirm').disabled = true;
  $('#wdOtpErr').hidden = true;
  $('#wdOtp').classList.remove('is-err');
  buildSummary();
}

/* --- STEP 3 → 4 (confirm) --- */
async function wdConfirm(btn) {
  const entered = otpInputs().map(i => i.value).join('');
  if (entered.length < 6) return;
  if (entered !== WD.pin) {
    $('#wdOtp').classList.add('is-err');
    $('#wdOtpErr').hidden = false;
    toast('Incorrect PIN', 'Check your withdrawal PIN and try again', 'err');
    return;
  }
  if (WD.amount > S.balance) { toast('Insufficient balance', '', 'err'); return; }

  btn.classList.add('is-busy');
  btn.textContent = 'Processing…';
  await wait(1600);

  S.balance = Math.round((S.balance - WD.amount) * 100) / 100;
  S.pendingPin = null;
  const t = {
    id: uid('TX'), type: 'withdrawal',
    title: 'Withdrawal to ' + WD.bank,
    note: '•••• ' + WD.acct.slice(-4),
    amount: WD.amount, ref: 'WD' + Math.floor(1e7 + Math.random() * 9e6),
    ts: Date.now(), status: 'success'
  };
  S.tx.unshift(t);
  save();

  btn.classList.remove('is-busy');
  btn.textContent = 'Confirm withdrawal';

  $('#wdDoneAmt').textContent = '$' + money(WD.amount);
  $('#wdDoneTxt').textContent = `Sent to ${WD.bank} account ••••${WD.acct.slice(-4)}. Your withdrawal PIN has been consumed.`;
  fillReceipt(t);
  setStep(4);

  renderAll(true);
  toast('Withdrawal successful', `$${money(WD.amount)} sent to ${WD.bank}`, 'ok');
}

/* ==========================================================
   OTHER MONEY OPERATIONS
   ========================================================== */
function pushTx(t) { S.tx.unshift(t); save(); }

async function doFund(btn) {
  const amt = Number(digits($('#fundAmt').value)) || 0;
  if (amt < 100) return toast('Minimum top-up is $100', '', 'warn');
  btn.classList.add('is-busy'); btn.textContent = 'Crediting…';
  await wait(1400);
  btn.classList.remove('is-busy'); btn.textContent = 'Credit my wallet';

  S.balance = Math.round((S.balance + amt) * 100) / 100;
  pushTx({ id: uid('TX'), type: 'credit', title: 'Wallet funding', note: 'Instant top-up', amount: amt, ref: 'CR' + Math.floor(1e7 + Math.random() * 9e6), ts: Date.now(), status: 'success' });
  closeModal(); renderAll(true);
  toast('Wallet funded', `$${money(amt)} added to your balance`, 'ok');
}

async function doSend(btn) {
  const name = $('#sendName').value.trim();
  const bank = $('#sendBank').value.trim();
  const acct = digits($('#sendAcct').value);
  const amt = Number(digits($('#sendAmt').value)) || 0;
  const note = $('#sendNote').value.trim();

  if (name.length < 2) return toast('Recipient name required', '', 'warn');
  if (bank.length < 2) return toast('Bank required', '', 'warn');
  if (acct.length < 10) return toast('Invalid account number', 'Enter 10–11 digits', 'warn');
  if (amt < 50) return toast('Minimum transfer is $50', '', 'warn');
  if (amt > S.balance) return toast('Insufficient balance', `Available: $${money(S.balance)}`, 'err');

  btn.classList.add('is-busy'); btn.textContent = 'Sending…';
  await wait(1500);
  btn.classList.remove('is-busy'); btn.textContent = 'Send now';

  S.balance = Math.round((S.balance - amt) * 100) / 100;
  pushTx({ id: uid('TX'), type: 'debit', title: 'Sent to ' + name, note: note || (bank + ' · •••• ' + acct.slice(-4)), amount: amt, ref: 'DR' + Math.floor(1e7 + Math.random() * 9e6), ts: Date.now(), status: 'success' });
  closeModal(); renderAll(true);
  toast('Transfer successful', `$${money(amt)} sent to ${name}`, 'ok');
}

async function doAirtime(btn) {
  const phone = digits($('#airPhone').value);
  const amt = Number(digits($('#airAmt').value)) || 0;
  const net = ($('#airNet .chip.is-on') || {}).dataset ? $('#airNet .chip.is-on').dataset.net : 'MTN';
  if (phone.length < 11) return toast('Enter a valid phone number', '', 'warn');
  if (amt < 50) return toast('Minimum is $50', '', 'warn');
  if (amt > S.balance) return toast('Insufficient balance', '', 'err');

  btn.classList.add('is-busy'); btn.textContent = 'Processing…';
  await wait(1200);
  btn.classList.remove('is-busy'); btn.textContent = 'Buy airtime';

  S.balance = Math.round((S.balance - amt) * 100) / 100;
  pushTx({ id: uid('TX'), type: 'airtime', title: `Airtime · ${net}`, note: phone, amount: amt, ref: 'AIR' + Math.floor(1e6 + Math.random() * 9e6), ts: Date.now(), status: 'success' });
  closeModal(); renderAll(true);
  toast('Airtime purchased', `${net} $${money(amt)} to ${phone}`, 'ok');
}

/* ==========================================================
   SETTINGS MODALS
   ========================================================== */
async function doChangePin(btn) {
  const old = $('#pinOld').value, n1 = $('#pinNew').value, n2 = $('#pinNew2').value;
  if (old !== S.profile.pin) return toast('Current PIN is incorrect', 'Demo PIN is 1234', 'err');
  if (!/^\d{4}$/.test(n1)) return toast('New PIN must be 4 digits', '', 'warn');
  if (n1 !== n2) return toast('PINs do not match', '', 'warn');

  btn.classList.add('is-busy'); btn.textContent = 'Updating…';
  await wait(900);
  btn.classList.remove('is-busy'); btn.textContent = 'Update PIN';

  S.profile.pin = n1; save();
  $('#pinOld').value = $('#pinNew').value = $('#pinNew2').value = '';
  closeModal();
  toast('PIN updated', 'Use your new PIN next time', 'ok');
}

function doEditProfile(btn) {
  const name = $('#profInName').value.trim();
  const mail = $('#profInMail').value.trim();
  const phone = $('#profInPhone').value.trim();
  if (name.length < 2) return toast('Name required', '', 'warn');
  if (!/^\S+@\S+\.\S+$/.test(mail)) return toast('Enter a valid email', '', 'warn');

  S.profile.name = name; S.profile.email = mail; S.profile.phone = phone;
  save(); renderHeader(); closeModal();
  toast('Profile updated', '', 'ok');
}

/* ==========================================================
   INIT & EVENT WIRING
   ========================================================== */
document.addEventListener('DOMContentLoaded', async () => {

  /* -- toast container -- */
  if (!$('#toasts')) {
    const t = document.createElement('div');
    t.id = 'toasts';
    t.className = 'toasts';
    document.body.appendChild(t);
  }

  /* -- load state & render -- */
  load();
  renderAll(false);

  /* -- dismiss boot loader -- */
  await wait(1800);
  $('#boot').classList.add('is-done');

  /* ---- NAVIGATION ---- */
  document.addEventListener('click', e => {
    /* tab bar / goto links */
    const tab = e.target.closest('[data-view]');
    if (tab) { go(tab.dataset.view); return; }

    const goto = e.target.closest('[data-goto]');
    if (goto) { go(goto.dataset.goto); return; }

    /* open modal */
    const opener = e.target.closest('[data-open]');
    if (opener) { openModal(opener.dataset.open); return; }

    /* close modal */
    const closer = e.target.closest('[data-close]');
    if (closer) { closeModal(); return; }

    /* overlay backdrop close */
    if (e.target === $('#overlay')) { closeModal(); return; }

    /* copy buttons */
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) { copyText(copyBtn.dataset.copy, 'Copied'); return; }

    const copyRef = e.target.closest('[data-copy-ref]');
    if (copyRef) { copyText(WD.ref, 'Reference copied'); return; }

    const copyPin = e.target.closest('[data-copy-pin]');
    if (copyPin) { copyText(WD.pin, 'PIN copied'); return; }

    /* transaction row */
    const txBtn = e.target.closest('[data-tx]');
    if (txBtn) { openTxModal(txBtn.dataset.tx); return; }

    /* withdraw wizard back */
    const wdBack = e.target.closest('[data-wdback]');
    if (wdBack) { setStep(Math.max(1, WD.step - 1)); return; }

    /* card actions */
    const cardAct = e.target.closest('[data-cardact]');
    if (cardAct) { handleCardAct(cardAct.dataset.cardact); return; }
  });

  /* ---- WITHDRAW WIZARD BUTTONS ---- */
  $('#wdNext1').addEventListener('click', wdStep1Next);
  $('#wdNext2').addEventListener('click', function() { wdStep2Next(this); });
  $('#wdConfirm').addEventListener('click', function() { wdConfirm(this); });

  /* wdPaid checkbox enables the next button */
  $('#wdPaid').addEventListener('change', e => {
    $('#wdNext2').disabled = !e.target.checked;
  });

  /* quick amount chips — withdraw */
  $('#wdQuick').addEventListener('click', e => {
    const chip = e.target.closest('[data-q]');
    if (!chip) return;
    const v = chip.dataset.q === 'max' ? S.balance : Number(chip.dataset.q);
    $('#wdAmount').value = Math.floor(v);
  });

  /* ---- FUND ---- */
  $('#fundGo').addEventListener('click', function() { doFund(this); });
  $('#fundQuick').addEventListener('click', e => {
    const chip = e.target.closest('[data-q]');
    if (chip) $('#fundAmt').value = chip.dataset.q;
  });

  /* ---- SEND ---- */
  $('#sendGo').addEventListener('click', function() { doSend(this); });

  /* ---- AIRTIME ---- */
  $('#airGo').addEventListener('click', function() { doAirtime(this); });
  $('#airNet').addEventListener('click', e => {
    const chip = e.target.closest('[data-net]');
    if (!chip) return;
    $$('#airNet .chip').forEach(c => c.classList.remove('is-on'));
    chip.classList.add('is-on');
  });
  $('#airQuick').addEventListener('click', e => {
    const chip = e.target.closest('[data-q]');
    if (chip) $('#airAmt').value = chip.dataset.q;
  });

  /* ---- SETTINGS ---- */
  $('#pinGo').addEventListener('click', function() { doChangePin(this); });
  $('#profGo').addEventListener('click', function() { doEditProfile(this); });

  /* ---- HISTORY SEARCH & FILTER ---- */
  $('#txSearch').addEventListener('input', e => { txQuery = e.target.value; renderHistory(); });
  $('#txChips').addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    $$('#txChips .chip').forEach(c => c.classList.remove('is-on'));
    chip.classList.add('is-on');
    txFilter = chip.dataset.filter;
    renderHistory();
  });

  /* ---- BALANCE TOGGLE ---- */
  $('#btnEye').addEventListener('click', () => {
    S.balanceHidden = !S.balanceHidden;
    save();
    renderBalance(false);
  });

  /* ---- BELL ---- */
  $('#btnBell').addEventListener('click', () => {
    $('#bellDot').classList.add('is-off');
    toast('No new notifications', '', 'info');
  });

  /* ---- LOCK ---- */
  $('#btnLock').addEventListener('click', () => {
    toast('Wallet locked', 'Refresh to unlock (demo)', 'info');
  });

  /* ---- EXPORT ---- */
  $('#btnExport').addEventListener('click', () => {
    toast('Export coming soon', 'PDF statement feature is in progress', 'info');
  });

  /* ---- RESET ---- */
  $('#btnReset').addEventListener('click', () => {
    if (!confirm('Reset all demo data? This cannot be undone.')) return;
    localStorage.removeItem(CFG.STORE);
    location.reload();
  });

  /* ---- SIGN OUT ---- */
  $('#btnSignOut').addEventListener('click', () => {
    toast('Signed out', 'Thanks for using NOVA PAY (demo)', 'ok');
    setTimeout(() => { localStorage.removeItem(CFG.STORE); location.reload(); }, 1500);
  });

  /* ---- OTP input wiring ---- */
  document.addEventListener('input', e => {
    if (!e.target.classList.contains('otp__in')) return;
    const inputs = otpInputs();
    const idx = inputs.indexOf(e.target);
    e.target.classList.toggle('has-val', e.target.value !== '');
    if (e.target.value && idx < inputs.length - 1) inputs[idx + 1].focus();
    $('#wdConfirm').disabled = inputs.some(i => !i.value);
    $('#wdOtpErr').hidden = true;
    $('#wdOtp').classList.remove('is-err');
  });

  document.addEventListener('keydown', e => {
    if (!e.target.classList.contains('otp__in')) return;
    if (e.key === 'Backspace' && !e.target.value) {
      const inputs = otpInputs();
      const idx = inputs.indexOf(e.target);
      if (idx > 0) { inputs[idx - 1].focus(); inputs[idx - 1].value = ''; inputs[idx - 1].classList.remove('has-val'); }
    }
  });

  /* ---- NEW CARD (stub) ---- */
  $('#btnNewCard').addEventListener('click', () => {
    toast('Virtual card', 'New card issuance coming soon', 'info');
  });
});

/* ==========================================================
   TRANSACTION RECEIPT MODAL
   ========================================================== */
function openTxModal(id) {
  const t = S.tx.find(x => x.id === id);
  if (!t) return;
  const m = metaOf(t);
  const credit = m.dir === 'credit';
  const icClass = credit ? 'modal__ic--in' : t.type === 'pin' ? 'modal__ic--wd' : 'modal__ic--out';
  $('#txnIc').className = 'modal__ic ' + icClass;
  $('#txnIc').innerHTML = `<svg class="ic"><use href="#${m.icon}"/></svg>`;
  $('#txnTitle').textContent = t.title;
  $('#txnStatus').textContent = t.status === 'success' ? 'Successful' : 'Pending';
  const body = $('#m-txn .modal__scroll');
  body.innerHTML = `
    <div class="receipt">
      <div class="receipt__row"><span>Amount</span><b class="${credit ? 'pos' : 'neg'}">${m.sign}$${money(t.amount)}</b></div>
      <div class="receipt__row"><span>Reference</span><b class="mono">${esc(t.ref)}</b></div>
      <div class="receipt__row"><span>Date</span><b>${fmtDay(t.ts)} · ${fmtTime(t.ts)}</b></div>
      ${t.note ? `<div class="receipt__row"><span>Note</span><b>${esc(t.note)}</b></div>` : ''}
      <div class="receipt__row"><span>Status</span><b style="color:var(--lime)">SUCCESSFUL</b></div>
    </div>
    <button class="btn btn--grad btn--block" data-close style="margin-top:16px">Close</button>`;
  openModal('txn');
}

/* ==========================================================
   CARD ACTIONS
   ========================================================== */
function handleCardAct(act) {
  switch (act) {
    case 'freeze':
      S.profile.cardFrozen = !S.profile.cardFrozen;
      save();
      $('#plasticCard').classList.toggle('is-frozen', S.profile.cardFrozen);
      toast(S.profile.cardFrozen ? 'Card frozen' : 'Card unfrozen',
            S.profile.cardFrozen ? 'All transactions are blocked' : 'Card is active again',
            S.profile.cardFrozen ? 'warn' : 'ok');
      break;
    case 'reveal':
      toast('Card details', '5399 2847 0163 4291  CVV: 742', 'info', 5000);
      break;
    case 'pin':
      toast('Card PIN', 'Your card PIN is: 4921 (demo)', 'info', 5000);
      break;
    case 'limit':
      toast('Spending limits', 'Limit management coming soon', 'info');
      break;
  }
}




