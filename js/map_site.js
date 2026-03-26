import fs from 'fs';
import path from 'path';

// Things to completely ignore
const IGNORE_EXACT = ['_site', 'node_modules', 'sync_logs', 'package-lock.json'];

function generateTree(dirPath, currentDepth = 0, relativePath = '') {
    let output = '';
    let items;
    
    try {
        items = fs.readdirSync(dirPath);
    } catch (e) {
        return '';
    }

    // Filter out hidden files/folders (starts with .) and explicit ignores
    items = items.filter(item => {
        if (item.startsWith('.')) return false;
        if (IGNORE_EXACT.includes(item)) return false;
        return true;
    });

    // Sort: Folders first, then files alphabetically
    items.sort((a, b) => {
        const aIsDir = fs.statSync(path.join(dirPath, a)).isDirectory();
        const bIsDir = fs.statSync(path.join(dirPath, b)).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
    });

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const fullPath = path.join(dirPath, item);
        const isDir = fs.statSync(fullPath).isDirectory();
        const isLast = i === items.length - 1;
        
        const marker = isLast ? '└── ' : '├── ';
        const indent = '    '.repeat(currentDepth);
        
        output += `${indent}${marker}${item}\n`;

        if (isDir) {
            // Normalize path for Windows/Mac compatibility
            const newRelative = relativePath ? `${relativePath}/${item}` : item;
            const segments = newRelative.split('/');
            
            // The "Stop condition": Don't dig deeper than 2 levels into /yt/ or /games/
            if ((segments[0] === 'yt' || segments[0] === 'games' || segments[0] === 'game') && segments.length >= 2) {
                output += `${indent}    └── ... (truncated)\n`;
                continue; 
            }
            
            output += generateTree(fullPath, currentDepth + 1, newRelative);
        }
    }
    return output;
}

console.log('🗺️ Mapping site structure...');
const tree = generateTree('.');
fs.writeFileSync('site_schema.txt', tree);
console.log('✅ Done! Open site_schema.txt to see your current architecture.');