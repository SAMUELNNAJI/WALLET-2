const fs = require('fs');
const out = [];
function probe(name, p) {
  const s = fs.readFileSync(p, 'utf8');
  const special = [...new Set(s.split('').filter(c => c.charCodeAt(0) > 0x2000 && c.charCodeAt(0) < 0x2200))];
  out.push(name + ': naira=' + (s.match(/₦/g) || []).length +
    ' | special=[' + special.map(c => c + 'U+' + c.charCodeAt(0).toString(16)).join(',') + ']');
}
try { probe('app.js', __dirname + '/app.js'); } catch (e) { out.push('app.js ERR ' + e.message); }
try { probe('index.html', __dirname + '/index.html'); } catch (e) { out.push('html ERR ' + e.message); }
try { probe('styles.css', __dirname + '/styles.css'); } catch (e) { out.push('css ERR ' + e.message); }
const s = fs.readFileSync(__dirname + '/app.js', 'utf8');
const i = s.indexOf('wdAvail');
out.push('ctx: ' + JSON.stringify(s.slice(i, i + 30)));
fs.writeFileSync(__dirname + '/_report.txt', out.join('\r\n'), 'utf8');
