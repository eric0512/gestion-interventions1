const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

let balance = 0;
let inString = false;
let quote = '';
let inComment = false;

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
    if (balance < 0) {
        console.log(`Extra } at line ${index + 1}`);
        balance = 0; // Reset to continue
    }
});

console.log(`Final balance: ${balance}`);
