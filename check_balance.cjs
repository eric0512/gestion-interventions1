const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');
let balance = 0;
let inString = false;
let quote = '';
let inComment = false;
let line = 1;
for (let i = 0; i < content.length; i++) {
  const char = content[i];
  const next = content[i+1];
  if (char === '\n') line++;
  if (inComment) {
    if (char === '*' && next === '/') {
      inComment = false;
      i++;
    }
    continue;
  }
  if (inString) {
    if (char === quote && content[i-1] !== '\\') inString = false;
    continue;
  }
  if (char === '/' && next === '*') {
    inComment = true;
    i++;
    continue;
  }
  if (char === '/' && next === '/') {
    while (i < content.length && content[i] !== '\n') i++;
    line++;
    continue;
  }
  if (char === '"' || char === "'" || char === "`") {
    inString = true;
    quote = char;
    continue;
  }
  if (char === '{') balance++;
  else if (char === '}') balance--;
  if (balance < 0) {
    console.log('Extra closing brace at line ' + line);
    process.exit(1);
  }
}
console.log('Final balance: ' + balance);
if (balance > 0) {
    console.log('Missing closing braces');
}
