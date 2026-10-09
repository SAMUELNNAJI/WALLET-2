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

  // 1. Existing account with OLD demo history -> load() must wipe it once
  localStorage.setItem(CFG.STORE, JSON.stringify({
    profile: { name: 'Old User', email: 'old@x.com', walletId: '4000000001', pin: '1234' },
    balance: 129000, balanceHidden: false, pendingPin: null,
    tx: [{ id:'TX-OLD', type:'credit', title:'Direct Deposit — Acme Corp', amount:5000, ts:Date.now(), ref:'CR1', status:'success' }]
  }));
  load();
  out.oldStateWiped       = Array.isArray(S.tx) && S.tx.length === 0 && S.txWiped === true;

  // 2. User makes a real transaction -> survives subsequent loads
  S.tx.unshift({ id:'TX-NEW', type:'credit', title:'Wallet deposit', amount:100, ts:Date.now(), ref:'CR2', status:'success' });
  save();
  load();
  out.realTxPreserved     = S.tx.length === 1 && S.tx[0].id === 'TX-NEW';

  // 3. New signup seed -> no history / recent activity at all
  const seed = seedForUser({ name: 'New User', email: 'new@x.com', walletId: '4000000002' });
  out.newSeedEmpty        = seed.tx.length === 0 && seed.txWiped === true && seed.balance === 129000;

  // 4. Simulated fresh signup flow (doSignUp storage behavior)
  localStorage.removeItem(CFG.STORE);
  S = seedForUser({ name: 'Fresh', email: 'fresh@x.com', walletId: '4000000003' });
  save();
  load();
  out.signupStaysEmpty    = S.tx.length === 0 && S.txWiped === true;

  // 5. Double load is idempotent (flag prevents re-wipe of real history)
  S.tx.unshift({ id:'TX-3', type:'debit', title:'Withdrawal to Chase', amount:50, ts:Date.now(), ref:'WD1', status:'success' });
  save(); load(); load();
  out.noDoubleWipe        = S.tx.length === 1;

  return out;
})();
`;
const results = (0, eval)(src + harness);
console.log(JSON.stringify(results, null, 2));

const pass = results.oldStateWiped && results.realTxPreserved && results.newSeedEmpty
          && results.signupStaysEmpty && results.noDoubleWipe;
console.log(pass ? 'ALL TESTS PASSED' : 'TESTS FAILED');
process.exit(pass ? 0 : 1);
