const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'dashboard', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace text-white with text-foreground in headings
content = content.replace(/<(h[1-6]|strong|div|span)([^>]*?)text-white([^>]*?)>/g, (match, tag, before, after) => {
    // Check if this tag is a button or has bg-indigo/bg-purple/bg-gradient, if so, keep text-white
    if (match.includes('bg-indigo') || match.includes('bg-purple') || match.includes('bg-gradient') || match.includes('bg-emerald')) {
        return match;
    }
    return `<${tag}${before}text-foreground${after}>`;
});

// There is one exception on line 193 for the avatar placeholder which should be text-foreground if bg-background
// <div className="w-full h-full bg-background rounded-[14px] flex items-center justify-center font-black text-white text-xl">
content = content.replace('bg-background rounded-[14px] flex items-center justify-center font-black text-white text-xl', 'bg-background rounded-[14px] flex items-center justify-center font-black text-foreground text-xl');

// Line 232: <div className="text-sm font-bold text-white font-mono">
content = content.replace('text-sm font-bold text-white font-mono', 'text-sm font-bold text-foreground font-mono');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed dashboard text colors');
