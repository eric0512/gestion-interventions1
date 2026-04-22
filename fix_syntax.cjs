const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

// Fix beginning
if (content[38].trim() === '') {
    content[38] = '}';
}

// Fix line 1500 (roughly)
for (let i = 1490; i < 1510; i++) {
    if (content[i] && content[i].includes(')}')) {
        content[i] = content[i].replace(')}', '))}') ;
        break;
    }
}

// Fix end
if (content[content.length - 2].trim() === '}' && content[content.length - 3].trim() === '}') {
    content.splice(content.length - 2, 1);
}

fs.writeFileSync('src/App.tsx', content.join('\n'));
