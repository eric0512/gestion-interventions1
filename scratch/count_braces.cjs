const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
let openB = 0;
let closeB = 0;
let openP = 0;
let closeP = 0;
let inString = null;

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inString) {
        if (char === inString && content[i-1] !== '\\') {
            inString = null;
        }
    } else {
        if (char === "'" || char === '"' || char === "`") {
            inString = char;
        } else if (char === '{') {
            openB++;
        } else if (char === '}') {
            closeB++;
        } else if (char === '(') {
            openP++;
        } else if (char === ')') {
            closeP++;
        }
    }
}

console.log(`Braces: {:${openB} }:${closeB}`);
console.log(`Parens: (:${openP} ):${closeP}`);
if (openB !== closeB) console.log("BRACE MISMATCH!");
if (openP !== closeP) console.log("PAREN MISMATCH!");
