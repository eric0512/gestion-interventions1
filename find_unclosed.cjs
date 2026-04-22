const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');

let stack = [];
let inString = false;
let quote = '';
let inComment = false;

lines.forEach((line, lineIdx) => {
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
        if (char === '{') {
            stack.push(lineIdx + 1);
        } else if (char === '}') {
            if (stack.length > 0) {
                stack.pop();
            } else {
                console.log(`Extra } at line ${lineIdx + 1}`);
            }
        }
    }
});

console.log('Unclosed braces opened at lines:', stack);
