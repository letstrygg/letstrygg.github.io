export const directoryFilterScript = `
<script>
const Utils = {
    formatNum: (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\\.0$/, '') + 'K';
        return Math.round(num).toString();
    },
    formatDur: (seconds) => {
        if (!seconds) return '0h 0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? \`\${h}h \${m}m\` : \`\${m}m\`;
    },
    daysBetween: (date1) => {
        if (!date1) return 1;
        const diff = Math.abs(new Date() - new Date(parseInt(date1)));
        return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    },
    hoursBetween: (date1) => {
        if (!date1) return 1;
        const diff = Math.abs(new Date() - new Date(parseInt(date1)));
        return Math.max(1, diff / (1000 * 60 * 60));
    },
    formatAge: (days) => {
        if (days < 365) return \`\${days}d\`;
        const y = Math.floor(days / 365);
        return \`\${y}y \${days % 365}d\`;
    },
    velocity: (t, d) => (t / d).toFixed(1),
    heat: (v, l, c, h) => ((v + (l * 5) + (c * 10)) / Math.pow(h + 2, 1.5)).toFixed(2),
    gem: (v, l, c) => (v === 0 ? "0.00" : (Math.max(0, ((l + c) / v) * Math.log(100000 / (v + 1)))).toFixed(2))
};

let currentSort = 'recent';
let activeTags = new Set();
let allSortedTags = [];
let isTagPanelActive = false;
let activeChannelFilter = 'all'; 

function updateDash(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function toggleNetworkState(targetState, filterSlug) {
    const container = document.getElementById('networkToggleContainer');
    if (!container) return;

    const splitCards = container.querySelectorAll('.card-split');

    if (targetState === 'split') {
        container.classList.remove('state-combined');
        container.classList.add('state-split');
        splitCards.forEach(c => {
            if (c.dataset.target === filterSlug) c.classList.add('active-filter');
            else c.classList.remove('active-filter');
        });
    } else {
        container.classList.remove('state-split');
        container.classList.add('state-combined');
        splitCards.forEach(c => c.classList.remove('active-filter'));
    }

    activeChannelFilter = filterSlug;
    applyFilters();
}

function sortGrid(type) {
    currentSort = type;
    document.querySelectorAll('.btn-group .btn').forEach(btn => btn.classList.remove('active'));
    
    const clickedBtn = document.getElementById(\`btn-\${type}\`);
    if (clickedBtn) clickedBtn.classList.add('active');

    const grid = document.getElementById('all-series-grid') || document.getElementById('series-grid');
    if (!grid) return;
    
    const cards = Array.from(grid.querySelectorAll('.filterable-card'));

    cards.sort((a, b) => {
        if (type === 'recent') return parseInt(b.dataset.updated || 0) - parseInt(a.dataset.updated || 0);
        if (type === 'popular') return parseInt(b.dataset.views || 0) - parseInt(a.dataset.views || 0);
        if (type === 'length') return parseInt(b.dataset.duration || 0) - parseInt(a.dataset.duration || 0);
        if (type === 'vpv') return parseInt(b.dataset.vpv || 0) - parseInt(a.dataset.vpv || 0);
        if (type === 'vel') return parseFloat(b.dataset.vel || 0) - parseFloat(a.dataset.vel || 0);
        if (type === 'heat') return parseFloat(b.dataset.heat || 0) - parseFloat(a.dataset.heat || 0);
        if (type === 'gem') return parseFloat(b.dataset.gem || 0) - parseFloat(a.dataset.gem || 0);
    });

    grid.innerHTML = '';
    cards.forEach(card => grid.appendChild(card));
}

function clearSearchInput() {
    const searchInput = document.getElementById('gameSearch');
    if (!searchInput) return;
    searchInput.value = '';
    document.getElementById('clearSearch').classList.add('hidden');
    applyFilters();
    searchInput.focus();
}

function applyFilters() {
    const searchInput = document.getElementById('gameSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const cards = document.querySelectorAll('.filterable-card');

    cards.forEach(card => {
        const title = card.getAttribute('data-title') || '';
        const tagsStr = card.getAttribute('data-tags') || '';
        const cardChannel = card.getAttribute('data-channel') || '';
        const cardTags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);

        const matchesSearch = title.includes(searchTerm);
        const matchesTags = activeTags.size === 0 || Array.from(activeTags).every(tag => cardTags.includes(tag));
        const matchesChannel = activeChannelFilter === 'all' || cardChannel === activeChannelFilter;

        if (matchesSearch && matchesTags && matchesChannel) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });

    calculateDynamicStats();
}

function calculateDynamicStats() {
    const cards = document.querySelectorAll('.filterable-card:not(.hidden)');
    
    let tGames = 0, tVids = 0, tViews = 0, tLikes = 0, tComms = 0, tDur = 0;
    let minFirst = Infinity, maxLast = 0;

    cards.forEach(c => {
        tGames++;
        tVids += parseInt(c.dataset.episodes || 0);
        tViews += parseInt(c.dataset.views || 0);
        tLikes += parseInt(c.dataset.likes || 0);
        tComms += parseInt(c.dataset.comments || 0);
        tDur += parseInt(c.dataset.duration || 0);

        const fp = parseInt(c.dataset.firstpub);
        const lp = parseInt(c.dataset.updated);
        if (fp && fp < minFirst) minFirst = fp;
        if (lp && lp > maxLast) maxLast = lp;
    });

    if (tGames === 0) return; 

    updateDash('dash-tot-games', \`<span class="material-symbols-outlined" style="color: var(--text); font-size: 18px;">sports_esports</span> \${Utils.formatNum(tGames)}\`);
    updateDash('dash-tot-vids', \`<span class="material-symbols-outlined red" style="font-size: 18px;">video_library</span> \${Utils.formatNum(tVids)}\`);
    updateDash('dash-tot-views', \`<span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> \${Utils.formatNum(tViews)}\`);
    updateDash('dash-tot-likes', \`<span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> \${Utils.formatNum(tLikes)}\`);
    updateDash('dash-tot-comms', \`<span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> \${Utils.formatNum(tComms)}\`);
    updateDash('dash-tot-dur', \`<span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> \${Utils.formatDur(tDur)}\`);

    updateDash('dash-avg-vid', \`<span class="material-symbols-outlined red" style="font-size: 18px;">video_library</span> \${Utils.formatNum(tVids / tGames)}\`);
    updateDash('dash-avg-view', \`<span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> \${Utils.formatNum(tViews / tGames)}\`);
    updateDash('dash-avg-like', \`<span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> \${Utils.formatNum(tLikes / tGames)}\`);
    updateDash('dash-avg-comm', \`<span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> \${Utils.formatNum(tComms / tGames)}\`);
    updateDash('dash-avg-dur', \`<span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> \${Utils.formatDur(tDur / tGames)}\`);

    const vC = Math.max(1, tVids);
    updateDash('dash-pv-view', \`<span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> \${Utils.formatNum(tViews / vC)}\`);
    updateDash('dash-pv-like', \`<span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> \${Utils.formatNum(tLikes / vC)}\`);
    updateDash('dash-pv-comm', \`<span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> \${Utils.formatNum(tComms / vC)}\`);
    updateDash('dash-pv-dur', \`<span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> \${Utils.formatDur(tDur / vC)}\`);

    const ageDays = Utils.daysBetween(minFirst);
    updateDash('dash-adv-age', \`<strong>Age:</strong> \${Utils.formatAge(ageDays)}\`);
    updateDash('dash-adv-dead', \`<strong>Inactive:</strong> \${Utils.formatAge(Utils.daysBetween(maxLast))}\`);
    updateDash('dash-adv-vel', \`<strong>Vel:</strong> <span class="blue">\${Utils.velocity(tViews, ageDays)}/d</span>\`);
    updateDash('dash-adv-heat', \`<strong>Heat:</strong> <span class="red">\${Utils.heat(tViews, tLikes, tComms, Utils.hoursBetween(minFirst))}</span>\`);
    updateDash('dash-adv-gem', \`<strong>Gem:</strong> <span class="orange">\${Utils.gem(tViews, tLikes, tComms)}</span>\`);
}

function toggleTagPanel() {
    isTagPanelActive = !isTagPanelActive;
    const btn = document.getElementById('btn-tags-toggle');
    const panel = document.getElementById('tag-filters');
    
    if (!btn || !panel) return;

    if (isTagPanelActive) {
        btn.classList.add('active');
        panel.classList.remove('hidden');
    } else {
        btn.classList.remove('active');
        panel.classList.add('hidden');
    }
}

function initTags() {
    const cards = document.querySelectorAll('.filterable-card');
    const tagCounts = {};
    
    cards.forEach(card => {
        const tagsStr = card.getAttribute('data-tags');
        if (!tagsStr) return;
        tagsStr.split(',').filter(Boolean).forEach(t => {
            const cleanTag = t.trim();
            tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        });
    });

    allSortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    if (allSortedTags.length === 0) return;

    const container = document.getElementById('tag-filters');
    if (!container) return;
    
    container.innerHTML = '';

    allSortedTags.forEach(([tag, count]) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-gray'; 
        btn.innerText = \`\${tag} (\${count})\`;
        
        btn.onclick = () => {
            if (activeTags.has(tag)) {
                activeTags.delete(tag);
                btn.classList.remove('active');
            } else {
                activeTags.add(tag);
                btn.classList.add('active');
            }
            applyFilters();
        };
        container.appendChild(btn);
    });
}

const searchInput = document.getElementById('gameSearch');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const clearBtn = document.getElementById('clearSearch');
        if (e.target.value.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
        applyFilters();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    sortGrid('recent');
    initTags(); 
});
</script>
`;