/* Functional test: verifies seeded history removal, one-time wipe,
   persistence of real transactions, and empty seeds for new accounts. */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/app.js', 'utf8');

/* --- minimal browser stubs --- */
const store = {};
globalThis.document = {
  addEventListener() {}, createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
  querySelector: () => null, querySelectorAll: () => [],
  body: { classList: { add(){}, remove(){}, toggle(){} }, appendChild() {} }
};
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
globalThis.sessionStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
globalThis.window = globalThis;
globalThis.performance = { now: () => 0 };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const harness = `
;globalThis.__results = (function () {
  const out = {};
  const countOpening = () => S.tx.filter(t => t.opening).length;

  // 1. Legacy account with OLD demo history -> replaced by EXACTLY the opening deposit
  localStorage.setItem(CFG.STORE, JSON.stringify({
    profile: { name: 'Old User', email: 'old@x.com', walletId: '4000000001', pin: '1234' },
    balance: 129000, balanceHidden: false, pendingPin: null,
    tx: [{ id:'TX-OLD', type:'credit', title:'Direct Deposit — Acme Corp', amount:5000, ts:Date.now(), ref:'CR1', status:'success' }]
  }));
  load();
  out.legacyGetsOnlyOpening =
    S.tx.length === 1 && S.tx[0].opening === true && S.tx[0].amount === 129000 &&
    S.tx[0].title === 'Initial deposit' && S.txWiped === true;

  // 2. User makes a real transaction -> recorded and survives reloads
  S.tx.unshift({ id:'TX-NEW', type:'credit', title:'Wallet deposit', amount:100, ts:Date.now(), ref:'CR2', status:'success' });
  save(); load();
  out.realTxPreserved = S.tx.length === 2 && S.tx.some(t => t.id === 'TX-NEW') && countOpening() === 1;

  // 3. New signup seed -> exactly 1 history entry: the $129,000 opening deposit
  const seed = seedForUser({ name: 'New User', email: 'new@x.com', walletId: '4000000002' });
  out.newSeedOneOpening =
    seed.tx.length === 1 && seed.tx[0].opening === true &&
    seed.tx[0].amount === 129000 && seed.balance === 129000 && seed.txWiped === true;

  // 4. Fresh signup flow (doSignUp storage behavior) -> stays at exactly one entry
  localStorage.removeItem(CFG.STORE);
  S = seedForUser({ name: 'Fresh', email: 'fresh@x.com', walletId: '4000000003' });
  save(); load();
  out.signupStaysOneEntry = S.tx.length === 1 && S.tx[0].opening === true;

  // 5. Repeated loads never duplicate the opening deposit
  S.tx.unshift({ id:'TX-3', type:'debit', title:'Withdrawal to Chase', amount:50, ts:Date.now(), ref:'WD1', status:'success' });
  save(); load(); load();
  out.noDuplicateOpening = S.tx.length === 2 && countOpening() === 1;

  // 6. State already emptied by previous empty-history version -> opening deposit backfilled
  localStorage.setItem(CFG.STORE, JSON.stringify({
    profile: { name: 'Wiped', email: 'w@x.com', walletId: '4000000004', pin: '1234' },
    balance: 129000, tx: [], txWiped: true
  }));
  load();
  out.wipedStateBackfilled = S.tx.length === 1 && S.tx[0].opening === true && S.tx[0].amount === 129000;

  // 7. Previously wiped state that already has real history -> opening prepended once, real tx kept
  localStorage.setItem(CFG.STORE, JSON.stringify({
    profile: { name: 'Active', email: 'a@x.com', walletId: '4000000005', pin: '1234' },
    balance: 128950, tx: [{ id:'TX-R', type:'debit', title:'Withdrawal to Chase', amount:50, ts:Date.now(), ref:'WD9', status:'success' }], txWiped: true
  }));
  load();
  out.activeStateBackfilled =
    S.tx.length === 2 && S.tx[0].opening === true && S.tx.some(t => t.id === 'TX-R') && countOpening() === 1;

  return out;
})();
`;
const results = (0, eval)(src + harness);
console.log(JSON.stringify(results, null, 2));

const pass = results.legacyGetsOnlyOpening && results.realTxPreserved && results.newSeedOneOpening
          && results.signupStaysOneEntry && results.noDuplicateOpening
          && results.wipedStateBackfilled && results.activeStateBackfilled;
console.log(pass ? 'ALL TESTS PASSED' : 'TESTS FAILED');
process.exit(pass ? 0 : 1);
