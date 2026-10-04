const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('./src', function(filePath) {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        let newContent = content
            .replace(/\bbg-background\b/g, 'bg-slate-950')
            .replace(/\bbg-card\b/g, 'bg-slate-900')
            .replace(/\bborder-border\b/g, 'border-slate-800')
            .replace(/\btext-foreground\b/g, 'text-slate-200')
            .replace(/\btext-muted-foreground\b/g, 'text-slate-400');
            
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Reversed:', filePath);
        }
    }
});
console.log('Reverse complete.');
