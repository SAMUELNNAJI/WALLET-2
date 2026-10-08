const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const js = fs.readFileSync(__dirname + '/app.js', 'utf8');
const css = fs.readFileSync(__dirname + '/styles.css', 'utf8');
const out = [];

const idRefs = [...new Set([...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'/g)].map(m => m[1]))];
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const missing = idRefs.filter(id => !htmlIds.has(id));
out.push('JS IDs missing in HTML (' + missing.length + '): ' + (missing.join(', ') || 'none'));

const all = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const dupes = [...new Set(all.filter((v, i) => all.indexOf(v) !== i))];
out.push('Duplicate HTML IDs: ' + (dupes.join(', ') || 'none'));

const defined = new Set([...js.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)].map(m => m[1]));
[...js.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/g)].forEach(m => defined.add(m[1]));
const called = new Set([...js.matchAll(/(?<![.\w$])([a-zA-Z_][A-Za-z0-9_$]*)\s*\(/g)].map(m => m[1]));
const kw = new Set(['if','for','while','switch','catch','return','function','typeof','new','await','async','constructor','super','do','else','try','of','in','case','delete','void','yield','throw','Math','Number','String','Array','Object','JSON','Date','Boolean','RegExp','Set','Map','Promise','Error','parseInt','parseFloat','isNaN','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame','confirm','alert','fetch','console','Blob','URL','localStorage','document','window','navigator','require','JSON']);
const undef = [...called].filter(f => !defined.has(f) && !kw.has(f) && !new RegExp('(function\\s+' + f + '\\b|\\b' + f + '\\s*=)').test(js));
out.push('Possibly-undefined functions: ' + (undef.join(', ') || 'none'));

const classUse = new Set();
[...html.matchAll(/class="([^"]+)"/g)].forEach(m => m[1].split(/\s+/).forEach(c => c && classUse.add(c)));
const cssClasses = new Set([...css.matchAll(/\.([A-Za-z0-9_-]+)/g)].map(m => m[1]));
const noCss = [...classUse].filter(c => !cssClasses.has(c));
out.push('HTML classes with no CSS rule: ' + (noCss.join(', ') || 'none'));

const declared = new Set([...js.matchAll(/(?:function\s+|const\s+|let\s+|var\s+)([A-Za-z0-9_$]+)/g)].map(m => m[1]));
[...js.matchAll(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=)/gm)].forEach(m => {
  const n = m[1];
  if (!declared.has(n)) out.push('Possible implicit global: ' + n);
});

// currency audit
out.push('naira in js/html: ' + (js.match(/₦/g) || []).length + '/' + (html.match(/₦/g) || []).length);
out.push('dollar-as-currency in js: ' + ((js.match(/\$\{money/g) || []).length + (js.match(/'\$' \+/g) || []).length));

fs.writeFileSync(__dirname + '/_report.txt', out.join('\r\n'), 'utf8');
