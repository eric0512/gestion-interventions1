const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

// Fix 1495
content[1494] = content[1494].replace('))}', ')}');

// Fix 1500
if (content[1499].includes(')}')) {
    content[1499] = content[1499].replace(')}', '))}') ;
}

fs.writeFileSync('src/App.tsx', content.join('\n'));
