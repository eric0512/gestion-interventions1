const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

let balance = 0;
let inString = false;
let quote = '';
let inComment = false;

const targets = [794, 1195, 1213, 1297, 1299, 1421, 1423, 1594, 1607];

lines.forEach((line, index) => {
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i+1];
        
        if (inComment) {
            if (char === '*' && next === '/') {
                inComment = false;
                i++;
            }
            continue;
        }
        if (inString) {
            if (char === quote && line[i-1] !== '\\') inString = false;
            continue;
        }
        if (char === '/' && next === '*') {
            inComment = true;
            i++;
            continue;
        }
        if (char === '/' && next === '/') {
            break;
        }
        if (char === '"' || char === "'" || char === "`") {
            inString = true;
            quote = char;
            continue;
        }
        if (char === '{') balance++;
        else if (char === '}') balance--;
    }
    if (targets.includes(index + 1)) {
        console.log(`Line ${index + 1}: balance ${balance}`);
    }
});
