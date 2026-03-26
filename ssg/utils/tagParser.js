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

export function processAdminTags(tagsArray) {
    if (!tagsArray || !Array.isArray(tagsArray) || tagsArray.length === 0) {
        return { html: '', metaString: '' };
    }

    let metaTags = [];
    let htmlButtons = tagsArray.map(tagString => {
        const parts = tagString.split(':');
        if (parts.length < 2) return ''; 
        
        const game = parts[0];
        const category = parts[1];
        const item = parts[2] || category; 
        
        const displayName = toTitleCase(item);
        metaTags.push(displayName);
        
        let cssColor = 'var(--text-muted)';
        let cssBorder = 'var(--border)';
        let linkUrl = '#';
        let filePath = null;

        const config = GAME_CONFIGS[game];
        if (config) {
            const paths = config.getPaths(category, item);
            linkUrl = paths.url;
            filePath = paths.filePath;
            
            const style = config.getStyle(category, item);
            cssColor = style.color;
            cssBorder = style.border;
        }

        const exists = filePath ? checkFileExists(filePath) : false;

        if (exists) {
            return `<a href="${linkUrl}" class="btn interactive text-sm" style="padding: 4px 12px; border-radius: 15px; color: ${cssColor}; border: 1px solid ${cssBorder}; background: rgba(0,0,0,0.2);">#${displayName}</a>`;
        } else {
            return `<span class="btn text-sm" style="padding: 4px 12px; border-radius: 15px; color: ${cssColor}; border: 1px dashed ${cssBorder}; background: transparent; opacity: 0.6; cursor: not-allowed;" title="Wiki page not created yet">#${displayName}</span>`;
        }

    }).join('\n');

    return { html: htmlButtons, metaString: metaTags.join(', ') };
}