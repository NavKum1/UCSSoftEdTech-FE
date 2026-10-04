const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

const replacements = [
  { regex: /\bbg-slate-950\b/g, replacement: 'bg-background' },
  { regex: /\bbg-slate-900\b/g, replacement: 'bg-card' },
  { regex: /\bborder-slate-800\b/g, replacement: 'border-border' },
  { regex: /\btext-slate-200\b/g, replacement: 'text-foreground' },
  { regex: /\btext-slate-100\b/g, replacement: 'text-foreground' },
  { regex: /\btext-slate-400\b/g, replacement: 'text-muted-foreground' },
  { regex: /\bbg-slate-800\b/g, replacement: 'bg-muted' }
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      for (const { regex, replacement } of replacements) {
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
          modified = true;
        }
      }
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(directoryPath);
console.log("Refactoring complete.");
