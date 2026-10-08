const fs = require('fs');
const N = '\\u20A6'; // ASCII-safe escape for the naira sign
const log = [];

/* ---------------- app.js ---------------- */
let js = fs.readFileSync(__dirname + '/app.js', 'utf8');
const before = js;
const jsRules = [
  ["'$' + money(",             "'" + N + "' + money("],
  ["'+$' + money(",            "'+" + N + "' + money("],
  ["'-$' + money(",            "'-" + N + "' + money("],
  ["'N' + money(",             "'" + N + "' + money("],
  ["$${money(",                N + "${money("],
  ["is $100",                  "is " + N + "100"],
  ["is $50",                   "is " + N + "50"],
  ["${v.net} $",               "${v.net} " + N]
];
jsRules.forEach(([a, b]) => {
  const c = js.split(a).length - 1;
  if (c) { log.push('js: "' + a + '" -> ' + c); js = js.split(a).join(b); }
});
fs.writeFileSync(__dirname + '/app.js', js, 'utf8');
log.push('js bytes ' + before.length + ' -> ' + js.length);

/* ---------------- index.html ---------------- */
let html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const ent = '&#8358;';
const htmlBefore = html;
// every "$" in this file is currency
const htmlCount = (html.match(/\$/g) || []).length;
html = html.split('$').join(ent);
fs.writeFileSync(__dirname + '/index.html', html, 'utf8');
log.push('html: replaced ' + htmlCount + ' "$" with ' + ent);

fs.writeFileSync(__dirname + '/_report.txt', log.join('\r\n'), 'utf8');
