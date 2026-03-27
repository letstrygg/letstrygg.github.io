import { checkFileExists } from './fileSys.js';

function toTitleCase(str) {
    if (!str) return '';
    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// 1. Define the UI Rules (Serializable for the frontend)
const sts2ClientConfig = {
    priorityCategories: ['character'], // Pushes these to the top of the Quick Add list
    colors: {
        'character:silent': 'var(--green)',
        'character:defect': 'var(--blue)',
        'character:ironclad': 'var(--red)',
        'character:regent': 'var(--orange, #e67e22)',
        'character:necrobinder': 'var(--purple)',
        'default': 'var(--yellow)' // Fallback for cards, relics, etc.
    }
};

const GAME_CONFIGS = {
    'slay-the-spire-2': {
        clientConfig: sts2ClientConfig,
        getPaths: (category, item) => {
            const dir = category.endsWith('s') ? category : category + 's';
            const relPath = `games/slay-the-spire-2/${dir}/${item}.html`;
            return { url: `/${relPath}`, filePath: relPath };
        },
        getStyle: (category, item) => {
            // Read directly from the config object so backend/frontend stay synced
            const key = `${category}:${item}`;
            const color = sts2ClientConfig.colors[key] || sts2ClientConfig.colors['default'] || 'var(--text-muted)';
            return { color: color, border: color };
        }
    }
};

// --- NEW EXPORT FOR THE SSG BUILDER ---
export function getClientTagConfig(gameSlug) {
    return GAME_CONFIGS[gameSlug]?.clientConfig || { priorityCategories: [], colors: {} };
}

export function processAdminTags(tagsArray, gameSlug = 'slay-the-spire-2') {
    const config = getClientTagConfig(gameSlug);
    const colors = config.colors || {};

    const groups = {
        character: [],
        card: [],
        enchantment: [],
        relic: [],
        manual: []
    };

    const metaList = [];

    (tagsArray || []).forEach(tag => {
        const parts = tag.split(':');
        const cat = parts.length > 1 ? parts[1].toLowerCase() : 'other';
        const item = parts.length > 2 ? parts.slice(2).join(':') : (parts[1] || parts[0]);

        // Convert hyphens to spaces and Title Case it for the UI (e.g., iron-wave -> Iron Wave)
        const displayName = item.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        metaList.push(displayName);

        const colorKey = `${cat}:${item}`;
        const color = colors[colorKey] || colors['default'] || 'var(--text-muted, #aaa)';

        // CHANGED: <a> to <span> to prevent dead links.
        // CHANGED: border-radius to 15px and padding to 2px 12px to match game tags perfectly.
        const tagHtml = `<span class="btn interactive text-sm" style="padding: 2px 12px; border-radius: 15px; border: 1px solid ${color}; color: ${color}; background: rgba(0,0,0,0.2); margin-right: 6px; margin-bottom: 6px; display: inline-flex; align-items: center; white-space: nowrap; cursor: default;">
            <span style="opacity: 0.6; font-size: 0.85em; margin-right: 4px;">${cat}:</span><strong>${displayName}</strong>
        </span>`;

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