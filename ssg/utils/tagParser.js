import fs from 'fs';
import path from 'path';

// The UI Config (No import needed since it lives right here)
export function getClientTagConfig(gameSlug) {
    if (gameSlug === 'slay-the-spire-2') {
        return {
            priorityCategories: ["character"],
            colors: {
                "character:silent": "var(--green)",
                "character:defect": "var(--blue)",
                "character:ironclad": "var(--red)",
                "character:regent": "var(--orange, #e67e22)",
                "character:necrobinder": "var(--purple)",
                "default": "var(--yellow)"
            }
        };
    }
    return {};
}

export function processAdminTags(tagsArray, gameSlug = 'slay-the-spire-2') {
    const config = getClientTagConfig(gameSlug) || {};
    const colors = config.colors || {};

    const groups = {
        character: [],
        card: [],
        enchantment: [],
        relic: [],
        manual: []
    };

    const metaList = [];
    const rootDir = process.cwd();

    (tagsArray || []).forEach(tag => {
        const parts = tag.split(':');
        
        // --- 1. HANDLE STANDARD / MANUAL TAGS (Not 3-parts) ---
        if (parts.length < 3 || parts[0] !== gameSlug) {
            const cleanTag = parts.join('-');
            const displayName = cleanTag.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            metaList.push(displayName);
            
            // Standard tags ALWAYS link to the YouTube tag hub and are always bright
            const tagHtml = `<a href="/yt/tags/${cleanTag}/" class="btn interactive text-sm" style="padding: 2px 12px; border-radius: 15px; border: 1px solid var(--border, #333); color: var(--text-muted, #aaa); background: rgba(0,0,0,0.2); margin-right: 6px; margin-bottom: 6px; display: inline-flex; align-items: center; white-space: nowrap; text-decoration: none;">
                <strong>#${displayName}</strong>
            </a>`;
            groups.manual.push(tagHtml);
            return; // Skip the rest of the loop
        }

        // --- 2. HANDLE STS DIRECTORY TAGS (game:cat:item) ---
        const cat = parts[1].toLowerCase();
        const item = parts[2];

        const displayName = item.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        metaList.push(displayName);

        const colorKey = `${cat}:${item}`;
        const color = colors[colorKey] || colors['default'] || 'var(--text-muted, #aaa)';

        // Map categories to their correct folders (e.g., 'card' -> 'cards')
        const folderName = cat === 'relic' ? 'relics' : 
                           cat === 'card' ? 'cards' : 
                           cat === 'enchantment' ? 'enchantments' : 
                           cat === 'character' ? 'characters' : `${cat}s`;

        const targetUrl = `/games/${gameSlug}/${folderName}/${item}/`;
        const localFilePath = path.join(rootDir, 'games', gameSlug, folderName, item, 'index.html');

        // Check if the directory file actually exists
        const pageExists = fs.existsSync(localFilePath);
        let tagHtml = '';

        if (pageExists) {
            // Valid Page = Clickable Link
            tagHtml = `<a href="${targetUrl}" class="btn interactive text-sm" style="padding: 2px 12px; border-radius: 15px; border: 1px solid ${color}; color: ${color}; background: rgba(0,0,0,0.2); margin-right: 6px; margin-bottom: 6px; display: inline-flex; align-items: center; white-space: nowrap; text-decoration: none;">
                <span style="opacity: 0.6; font-size: 0.85em; margin-right: 4px;">${cat}:</span><strong>${displayName}</strong>
            </a>`;
        } else {
            // Missing Page = Dimmed Span (Not Clickable)
            tagHtml = `<span class="btn text-sm" style="padding: 2px 12px; border-radius: 15px; border: 1px solid ${color}; color: ${color}; background: transparent; opacity: 0.4; margin-right: 6px; margin-bottom: 6px; display: inline-flex; align-items: center; white-space: nowrap; cursor: default;">
                <span style="opacity: 0.6; font-size: 0.85em; margin-right: 4px;">${cat}:</span><strong>${displayName}</strong>
            </span>`;
        }

        // Push to the correct UI row bucket
        if (cat === 'character') groups.character.push(tagHtml);
        else if (cat === 'card') groups.card.push(tagHtml);
        else if (cat === 'enchantment') groups.enchantment.push(tagHtml);
        else if (cat === 'relic') groups.relic.push(tagHtml);
        else groups.manual.push(tagHtml);
    });

    return {
        metaString: metaList.join(', '),
        groups: groups
    };
}