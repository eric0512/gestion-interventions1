const fs = require('fs');
const filePath = 'src/App.tsx';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// 1272 is index 1271
if (lines[1271].includes('); })}')) {
    lines[1271] = lines[1271].replace('); })}', '))}');
}
// 1402 is index 1401
if (lines[1401].includes('); })}')) {
    lines[1401] = lines[1401].replace('); })}', '))}');
}
// 1284 is index 1283
if (lines[1283].includes('); })}')) {
    lines[1283] = '            );' + '\n' + '          })}';
}
// 1414 is index 1413
if (lines[1413].includes('); })}')) {
    lines[1413] = '            );' + '\n' + '          })}';
}

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Fixed App.tsx syntax lines precisely');
