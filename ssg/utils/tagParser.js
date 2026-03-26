// Helper to turn 'minion-dive-bomb' into 'Minion Dive Bomb'
function toTitleCase(str) {
    if (!str) return '';
    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Centralized configuration for 200+ games
const GAME_CONFIGS = {
    'sts2': {
        getLink: (category, item) => `/games/slay-the-spire-2/${category}s/${item}.html`,
        getStyle: (category, item) => {
            if (category === 'character') {
                if (item === 'silent') return { color: 'var(--green)', border: 'var(--green)' };
                if (item === 'defect') return { color: 'var(--blue)', border: 'var(--blue)' };
                if (item === 'ironclad') return { color: 'var(--red)', border: 'var(--red)' };
                if (item === 'regent') return { color: 'var(--orange, #e67e22)', border: 'var(--orange, #e67e22)' };
                if (item === 'necrobinder') return { color: 'var(--purple)', border: 'var(--purple)' };
            }
            return { color: 'var(--yellow)', border: 'var(--yellow)' }; // Default for sts2 cards/relics/events
        }
    }
    // 'btd6': {
    //     getLink: (category, item) => `/games/btd6/${category}/${item}.html`,
    //     getStyle: (category, item) => { return { color: 'var(--blue)', border: 'var(--blue)' }; }
    // }
};

export function processAdminTags(tagsArray) {
    if (!tagsArray || !Array.isArray(tagsArray) || tagsArray.length === 0) {
        return { html: '', metaString: '' };
    }

    let metaTags = [];
    let htmlButtons = tagsArray.map(tagString => {
        const parts = tagString.split(':');
        if (parts.length < 2) return ''; // Skip malformed tags
        
        const game = parts[0];
        const category = parts[1];
        const item = parts[2] || category; 
        
        const displayName = toTitleCase(item);
        metaTags.push(displayName);
        
        // Default Fallback Styles
        let cssColor = 'var(--text-muted)';
        let cssBorder = 'var(--border)';
        let linkUrl = '#';

        // Apply Game-Specific Configs
        const config = GAME_CONFIGS[game];
        if (config) {
            linkUrl = config.getLink(category, item);
            const style = config.getStyle(category, item);
            cssColor = style.color;
            cssBorder = style.border;
        }

        return `<a href="${linkUrl}" class="btn interactive text-sm" style="padding: 4px 12px; border-radius: 15px; color: ${cssColor}; border: 1px solid ${cssBorder}; background: rgba(0,0,0,0.2);">#${displayName}</a>`;
    }).join('\n');

    return {
        html: htmlButtons,
        metaString: metaTags.join(', ')
    };
}