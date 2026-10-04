const fs = require('fs');
const path = require('path');

const directories = [
  path.join(__dirname, 'src', 'app'),
  path.join(__dirname, 'src', 'components')
];

const colorMap = {
  'indigo': { '300': '600', '400': '700' },
  'emerald': { '300': '600', '400': '700' },
  'cyan': { '300': '600', '400': '700' },
  'purple': { '300': '600', '400': '700' },
  'amber': { '300': '600', '400': '700' },
  'yellow': { '300': '600', '400': '700' },
  'red': { '300': '600', '400': '700' },
  'blue': { '300': '600', '400': '700' }
};

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      const regex = /\btext-(indigo|emerald|cyan|purple|amber|yellow|red|blue)-(300|400)\b/g;
      
      const newContent = content.replace(regex, (match, color, weight) => {
        const lightWeight = colorMap[color][weight];
        // Special case: if we see the same color replacement exists, avoid double replacement.
        // We will just replace it cleanly
        return `text-${color}-${lightWeight} dark:text-${color}-${weight}`;
      });

      // Cleanup if any dark:dark: happened
      const cleanedContent = newContent.replace(/dark:dark:/g, 'dark:');

      if (content !== cleanedContent) {
        fs.writeFileSync(fullPath, cleanedContent, 'utf8');
        console.log(`Fixed colors in ${fullPath}`);
      }
    }
  }
}

directories.forEach(processDirectory);
console.log('Fixed colored text and icons across app.');
