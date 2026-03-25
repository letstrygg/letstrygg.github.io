export const StatsCalc = {
    // 1. Core Formatters
    formatNum(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    },
    formatDur(seconds) {
        if (!seconds) return '0h 0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    },

    // 2. Time & Age Math
    daysBetween(date1, date2 = new Date()) {
        if (!date1) return 1;
        const diff = Math.abs(new Date(date2) - new Date(date1));
        return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    },
    
    // 3. Advanced Metrics
    velocity(total, days) {
        return (total / days).toFixed(1);
    },
    hiddenGemScore(views, likes, comments) {
        if (!views) return "0.0";
        // Simple starting formula: (Engagement / Views) * Scaling Factor
        const score = ((likes + comments) / views) * Math.log(100000 / (views + 1));
        return Math.max(0, score).toFixed(2);
    },

    // 4. HTML Generators (The Green/Red Deltas)
    formatDelta(actual, average, isDuration = false) {
        if (!average) return '';
        const diff = actual - average;
        
        if (diff === 0) return `<span style="color: var(--gray); font-size: 0.85em; font-weight: normal; margin-left: 4px;">(0)</span>`;
        
        const sign = diff > 0 ? '+' : '';
        // If duration, we usually don't want to color it red just because it's longer, but we can stick to standard green=more for now.
        let color = diff > 0 ? 'var(--green)' : 'var(--red)';
        
        let formatStr = '';
        if (isDuration) {
            const h = Math.floor(Math.abs(diff) / 3600);
            const m = Math.floor((Math.abs(diff) % 3600) / 60);
            formatStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
        } else {
            formatStr = Math.abs(diff) >= 1000000 ? (Math.abs(diff)/1000000).toFixed(1).replace(/\.0$/, '') + 'M' :
                        Math.abs(diff) >= 1000 ? (Math.abs(diff)/1000).toFixed(1).replace(/\.0$/, '') + 'K' : 
                        Math.round(Math.abs(diff));
        }

        return `<span style="color: ${color}; font-size: 0.85em; font-weight: bold; margin-left: 4px;">(${sign}${formatStr})</span>`;
    }
};