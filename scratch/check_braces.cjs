const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
let inString = null;
let stringStartLine = 0;
let inComment = null;

for (let i = 0; i < content.length; i++) {
    if (inComment === 'single') {
        if (content[i] === '\n') inComment = null;
    } else if (inComment === 'multi') {
        if (content[i] === '*' && content[i+1] === '/') {
            inComment = null;
            i++;
        }
    } else if (inString) {
        if (content[i] === inString && content[i-1] !== '\\') inString = null;
    } else {
        if (content[i] === '/' && content[i+1] === '/') {
            inComment = 'single';
            i++;
        } else if (content[i] === '/' && content[i+1] === '*') {
            inComment = 'multi';
            i++;
        } else if (content[i] === '"' || content[i] === "'" || content[i] === '`') {
            inString = content[i];
            stringStartLine = content.substring(0, i).split('\n').length;
        }
    }
}
if (inString) {
    console.log('Unclosed string starting at line ' + stringStartLine + ' with ' + inString);
} else {
    console.log('All strings closed');
}
