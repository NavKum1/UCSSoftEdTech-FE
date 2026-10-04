const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'components');

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

      const newContent = content.replace(/<(h[1-6]|strong|div|span|p)([^>]*?)text-white([^>]*?)>/g, (match, tag, before, after) => {
        // If the element has a solid colored background that requires white text, keep text-white
        if (match.includes('bg-indigo') || match.includes('bg-purple') || match.includes('bg-gradient') || match.includes('bg-emerald') || match.includes('bg-red') || match.includes('bg-cyan') || match.includes('bg-blue') || match.includes('bg-zinc-800') || match.includes('bg-zinc-900') || match.includes('bg-slate-900') || match.includes('bg-slate-950') || match.includes('bg-black') || match.includes('bg-slate-800')) {
            return match;
        }
        return `<${tag}${before}text-foreground${after}>`;
      });

      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Fixed text-white in ${fullPath}`);
      }
    }
  }
}

processDirectory(directoryPath);
console.log('Fixed white text across app.');
