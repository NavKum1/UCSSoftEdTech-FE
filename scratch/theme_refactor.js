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
            .replace(/\bbg-slate-950\b/g, 'bg-background')
            .replace(/\bbg-slate-900\b/g, 'bg-card')
            .replace(/\bborder-slate-800\b/g, 'border-border')
            .replace(/\bborder-slate-700\b/g, 'border-border')
            .replace(/\btext-slate-100\b/g, 'text-foreground')
            .replace(/\btext-slate-200\b/g, 'text-foreground')
            .replace(/\btext-slate-300\b/g, 'text-muted-foreground')
            .replace(/\btext-slate-400\b/g, 'text-muted-foreground')
            .replace(/\btext-slate-500\b/g, 'text-muted-foreground')
            .replace(/\btext-slate-600\b/g, 'text-muted-foreground');
            
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Updated:', filePath);
        }
    }
});
console.log('Refactor complete.');
