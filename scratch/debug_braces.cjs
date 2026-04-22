const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
let stack = [];
let inString = null;
let lines = content.split('\n');

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
            stack.push({ char, pos: i });
        } else if (char === '}') {
            if (stack.length === 0 || stack[stack.length-1].char !== '{') {
                console.log(`EXTRA } at pos ${i}`);
            } else {
                stack.pop();
            }
        }
    }
}

stack.forEach(s => {
    // Find line number
    let lineNum = content.substring(0, s.pos).split('\n').length;
    console.log(`UNCLOSED { at line ${lineNum}`);
});
