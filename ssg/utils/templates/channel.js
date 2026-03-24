export function channelHTML(data) {
    const isParent = data.channels.length > 1;
    
    // Calculate stats for the top animation cards
    let letstryggCount = 0, plusCount = 0;
    if (isParent) {
        data.channels.forEach(ch => {
            if (ch.channelSlug === 'letstrygg') letstryggCount = ch.games.length;
            if (ch.channelSlug === 'ltg-plus') plusCount = ch.games.length;
        });
    }

    // Formatting Helpers for the HTML generation
    const formatViews = (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    let html = `---
layout: new
title: "${data.hubSlug} - Games Directory"
permalink: /yt/${data.hubSlug}/
custom_css: "/css/home.css"
---

<style>
/* Flexbox Merge/Split Animation Styles */
.channel-split-container {
    display: flex; gap: 20px; width: 100%; margin-bottom: 30px;
    transition: gap 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}
.anim-card {
    border: 2px solid #333; border-radius: 12px; background: #1a1a1a;
    overflow: hidden; white-space: nowrap; display: flex; flex-direction: column;
    justify-content: center; align-items: center; user-select: none;
    transition: flex 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s ease, 
                padding 0.5s cubic-bezier(0.25, 1, 0.5, 1), border-width 0.5s ease;
}
.anim-card:hover { background: #222; }

/* STATE: COMBINED */
.state-combined .card-combined { flex: 1; opacity: 1; padding: 30px; border-color: var(--green); }
.state-combined .card-split { flex: 0; opacity: 0; padding: 0; border-width: 0; pointer-events: none; }
.state-combined { gap: 0; }

/* STATE: SPLIT */
.state-split .card-combined { flex: 0; opacity: 0; padding: 0; border-width: 0; pointer-events: none; }
.state-split .card-split { flex: 1; opacity: 1; padding: 30px; }
.state-split { gap: 20px; }

/* Active Filter State for Split Cards */
.card-split.active-filter { border-color: var(--green); background: #222; }
</style>

<div class="game-page-wrapper">
  {% include_relative _manual/index.html %}
`;

    // 1. Inject the Animated Header (Only for the Parent Channel)
    if (isParent) {
        html += `
  <div class="channel-split-container state-combined" id="networkToggleContainer">
      <div class="anim-card card-combined" onclick="toggleNetworkState('split', 'all')" style="cursor: pointer;">
          <h2 style="margin: 0 0 5px 0;">Let's Try GG Network</h2>
          <p style="margin: 0; color: var(--gray);">Click to split by channel</p>
      </div>

      <div class="anim-card card-split" id="card-letstrygg" onclick="toggleNetworkState('split', 'letstrygg')" style="cursor: pointer;">
          <h2 style="margin: 0 0 5px 0;">Letstrygg</h2>
          <p style="margin: 0; color: var(--gray);">${letstryggCount} Games</p>
      </div>

      <div class="anim-card card-split" id="card-ltg-plus" onclick="toggleNetworkState('split', 'ltg-plus')" style="cursor: pointer; border-color: #ff8888;">
          <h2 style="margin: 0 0 5px 0; color: #ff8888;">LTG Plus</h2>
          <p style="margin: 0; color: var(--gray);">${plusCount} Games</p>
      </div>
      
      <div class="anim-card card-split" onclick="toggleNetworkState('combined', 'all')" style="cursor: pointer; flex: 0.15; border-color: var(--gray);">
          <span class="material-symbols-outlined" style="font-size: 24px; color: var(--gray);">close_fullscreen</span>
      </div>
  </div>
`;
    } else {
        html += `
  <div style="margin-bottom: 30px; border-bottom: 1px solid var(--gray); padding-bottom: 15px;">
    <h1 class="title" style="text-transform: capitalize;">${data.hubSlug}</h1>
    <p class="subtitle" style="margin: 0;">Channel Directory</p>
  </div>
`;
    }

    // 2. The Rich UI Controls
    html += `
<div class="controls-wrapper">
    <div class="controls-top-row">
        <input type="text" id="gameSearch" placeholder="Search Games">
        <div class="top-row-buttons">
            <button class="btn" id="btn-tags-toggle" onclick="toggleTagPanel()">
                <span class="material-symbols-outlined">sell</span> Tags
            </button>
            <button class="btn" id="btn-info" onclick="toggleInfo()">
                <span class="material-symbols-outlined">info</span> Info
            </button>
        </div>
    </div>

    <div class="btn-group">
        <button class="btn btn-green active" id="btn-recent" onclick="sortGrid('recent')">
            <span class="material-symbols-outlined">psychiatry</span> New
        </button>
        <button class="btn btn-blue" id="btn-popular" onclick="sortGrid('popular')">
            <span class="material-symbols-outlined">visibility</span> Views
        </button>
        <button class="btn btn-purple" id="btn-length" onclick="sortGrid('length')">
            <span class="material-symbols-outlined">schedule</span> Duration
        </button>
        <button class="btn btn-orange" id="btn-vpv" onclick="sortGrid('vpv')">
            <span class="material-symbols-outlined">mode_heat</span> VPV
        </button>
    </div>
</div>

<div id="tag-filters" class="tag-filters"></div>

<div id="summary-info-box" class="summary-info-box" style="display: none;">
    <div class="summary-grid">
        <div>
            <strong class="text-blue" style="font-size: 1.1em;">Library Scope</strong><br>
            Games: <strong id="stat-games">0</strong><br>
            Videos: <strong id="stat-videos-total">0</strong><br>
            Avg / Game: <strong id="stat-avg-vid-game">0</strong>
        </div>
        <div>
            <strong class="text-green" style="font-size: 1.1em;">Views</strong><br>
            Total: <span id="stat-views-total">0</span><br>
            Avg / Game: <span id="stat-views-avg-game">0</span><br>
            Avg / Video: <span id="stat-vpv" class="text-orange" style="font-weight: bold;">0</span>
        </div>
        <div>
            <strong class="text-purple" style="font-size: 1.1em;">Duration</strong><br>
            Total: <span id="stat-dur-total">0</span><br>
            Avg / Game: <span id="stat-dur-game">0</span><br>
            Avg / Video: <span id="stat-dur-video">0</span>
        </div>
    </div>
</div>

<div class="game-grid" id="all-series-grid">
`;

    // 3. Generate the Game Cards dynamically
    data.channels.forEach(channel => {
        channel.games.forEach(game => {
            // Aggregate DB stats for this game
            let totalViews = 0, totalDuration = 0, epCount = 0, maxTime = 0;
            let firstVideoId = null;

            game.ltg_series_playlists?.forEach(sp => {
                const stats = sp.ltg_playlists?.ltg_playlist_stats?.[0];
                if (stats) {
                    totalViews += parseInt(stats.total_views || 0);
                    totalDuration += parseInt(stats.total_duration || 0);
                    epCount += parseInt(stats.ep_count || 0);
                    const pubTime = stats.latest_published_at ? new Date(stats.latest_published_at).getTime() : 0;
                    if (pubTime > maxTime) maxTime = pubTime;
                    if (!firstVideoId && stats.first_video_id) firstVideoId = stats.first_video_id;
                }
            });

            const vpv = epCount > 0 ? Math.round(totalViews / epCount) : 0;
            const thumbUrl = firstVideoId ? `https://i.ytimg.com/vi/${firstVideoId}/maxresdefault.jpg` : '/assets/img/default-thumbnail.jpg';
            const tagsStr = (game.tags || []).join(',');
            const safeTitle = game.title.replace(/"/g, '&quot;');
            const gameUrl = `/yt/${channel.channelSlug}/${game.slug}/`;

            // Use the channel slug as the status indicator (e.g., letstrygg or ltg-plus)
            const statusColor = channel.channelSlug === 'ltg-plus' ? 'gray' : 'blue';

            html += `
  <a href="${gameUrl}" class="filterable-card" data-channel="${channel.channelSlug}" data-title="${safeTitle.toLowerCase()}" data-tags="${tagsStr}">
    <div class="game-card" data-updated="${maxTime}" data-episodes="${epCount}" data-views="${totalViews}" data-duration="${totalDuration}" data-vpv="${vpv}">
      <img src="${thumbUrl}" alt="${safeTitle}">
      <div class="card-row">
          <strong>${safeTitle}</strong>
          <span class="card-status ${statusColor}">${channel.channelSlug}</span>
      </div>
      <div class="card-row">
          <span><span class="material-symbols-outlined gray">play_circle</span> ${epCount}</span>
          <span><span class="material-symbols-outlined gray">visibility</span> ${formatViews(totalViews)}</span>
          <span class="card-duration">
              <span class="dur-full"><span class="material-symbols-outlined gray">schedule</span> ${formatDuration(totalDuration)}</span>
              <span class="dur-short"><span class="material-symbols-outlined gray">schedule</span> ${Math.floor(totalDuration/3600)}h</span>
          </span>
      </div>
      <div class="card-row vpv-row" style="display: none; color: #aaa; margin-top: 5px; border-top: 1px solid #333; padding-top: 5px; justify-content: center;">
          <span><span class="material-symbols-outlined orange">mode_heat</span> ${formatViews(vpv)} views per video</span>
      </div>
    </div>
  </a>\n`;
        });
    });

    html += `</div>\n</div>\n`;

    // 4. Inject the interactive JavaScript
    html += `
<script>
// --- State Management ---
let currentSort = 'recent';
let isInfoActive = false;
let activeTags = new Set();
let allSortedTags = [];
let isTagPanelActive = false;
let activeChannelFilter = 'all'; // Used by the flexbox merge/split cards

// --- Formatting Helpers ---
function formatViews(num) {
    num = Math.round(num);
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\\.0$/, '') + 'K';
    return num.toString();
}

function formatDuration(seconds) {
    seconds = Math.round(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? \`\${h}h \${m}m\` : \`\${m}m\`;
}

// --- Split/Merge Network Toggle ---
function toggleNetworkState(targetState, filterSlug) {
    const container = document.getElementById('networkToggleContainer');
    const cLets = document.getElementById('card-letstrygg');
    const cPlus = document.getElementById('card-ltg-plus');
    
    if (!container) return; // Failsafe if not on parent hub

    if (targetState === 'split') {
        container.classList.remove('state-combined');
        container.classList.add('state-split');
    } else {
        container.classList.remove('state-split');
        container.classList.add('state-combined');
    }

    cLets.classList.remove('active-filter');
    cPlus.classList.remove('active-filter');
    if (filterSlug === 'letstrygg') cLets.classList.add('active-filter');
    if (filterSlug === 'ltg-plus') cPlus.classList.add('active-filter');

    // Update global state and trigger main filter function
    activeChannelFilter = filterSlug;
    applyFilters();
}

// --- Info Box Logic ---
function toggleInfo() {
    isInfoActive = !isInfoActive;
    const btn = document.getElementById('btn-info');
    const infoBox = document.getElementById('summary-info-box');

    if (isInfoActive) {
        btn.classList.add('active'); 
        infoBox.style.display = 'block';
        calculateStats();
    } else {
        btn.classList.remove('active');
        infoBox.style.display = 'none';
    }
    updateVPVVisibility();
}

function calculateStats() {
    if (!isInfoActive) return;

    const cards = document.querySelectorAll('.filterable-card');
    let gamesCount = 0;
    let totalViews = 0;
    let totalVideos = 0;
    let totalDuration = 0;

    cards.forEach(card => {
        if (card.style.display !== 'none') {
            gamesCount++;
            const inner = card.querySelector('.game-card');
            totalViews += parseInt(inner.dataset.views || 0);
            totalVideos += parseInt(inner.dataset.episodes || 0);
            totalDuration += parseInt(inner.dataset.duration || 0);
        }
    });

    const avgViewsGame = gamesCount > 0 ? totalViews / gamesCount : 0;
    const avgViewsVideo = totalVideos > 0 ? totalViews / totalVideos : 0;
    const avgDurGame = gamesCount > 0 ? totalDuration / gamesCount : 0;
    const avgDurVideo = totalVideos > 0 ? totalDuration / totalVideos : 0;
    const avgVideosGame = gamesCount > 0 ? Math.round(totalVideos / gamesCount) : 0;
    
    document.getElementById('stat-games').innerText = gamesCount;
    document.getElementById('stat-videos-total').innerText = totalVideos;
    document.getElementById('stat-avg-vid-game').innerText = avgVideosGame;
    document.getElementById('stat-views-total').innerText = formatViews(totalViews);
    document.getElementById('stat-views-avg-game').innerText = formatViews(avgViewsGame);
    document.getElementById('stat-vpv').innerText = formatViews(avgViewsVideo);
    document.getElementById('stat-dur-total').innerText = formatDuration(totalDuration);
    document.getElementById('stat-dur-game').innerText = formatDuration(avgDurGame);
    document.getElementById('stat-dur-video').innerText = formatDuration(avgDurVideo);
}

function updateVPVVisibility() {
    const cards = document.querySelectorAll('.filterable-card');
    cards.forEach(card => {
        const vpvRow = card.querySelector('.vpv-row');
        if (vpvRow) {
            vpvRow.style.display = (currentSort === 'vpv' || isInfoActive) ? 'flex' : 'none';
        }
    });
}

// --- Sorting Logic ---
function sortGrid(type) {
    currentSort = type;
    document.querySelectorAll('.btn-group .btn').forEach(btn => btn.classList.remove('active'));
    
    const clickedBtn = document.getElementById(\`btn-\${type}\`);
    if (clickedBtn) clickedBtn.classList.add('active');

    const grid = document.getElementById('all-series-grid');
    const cards = Array.from(grid.querySelectorAll('.filterable-card'));

    cards.sort((a, b) => {
        const cardA = a.querySelector('.game-card');
        const cardB = b.querySelector('.game-card');
        if (!cardA || !cardB) return 0;

        if (type === 'recent') return parseInt(cardB.dataset.updated || 0) - parseInt(cardA.dataset.updated || 0);
        if (type === 'popular') return parseInt(cardB.dataset.views || 0) - parseInt(cardA.dataset.views || 0);
        if (type === 'length') return parseInt(cardB.dataset.duration || 0) - parseInt(cardA.dataset.duration || 0);
        if (type === 'vpv') return parseInt(cardB.dataset.vpv || 0) - parseInt(cardA.dataset.vpv || 0);
    });

    grid.innerHTML = '';
    cards.forEach(card => grid.appendChild(card));
    updateVPVVisibility();
}

// --- Unified Filter Logic ---
function applyFilters() {
    const searchTerm = document.getElementById('gameSearch').value.toLowerCase();
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
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });

    calculateStats(); 
}

// --- Tag Logic ---
function toggleTagPanel() {
    isTagPanelActive = !isTagPanelActive;
    const btn = document.getElementById('btn-tags-toggle');
    const panel = document.getElementById('tag-filters');
    
    if (isTagPanelActive) {
        btn.classList.add('active');
        panel.style.display = 'flex'; 
    } else {
        btn.classList.remove('active');
        panel.style.display = 'none'; 
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
    container.innerHTML = '';

    allSortedTags.forEach(([tag, count]) => {
        const btn = document.createElement('button');
        btn.className = 'btn-tag tag-item'; 
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

// Ensure event listener triggers the unified filter function
document.getElementById('gameSearch').addEventListener('input', applyFilters);

// Boot it all up
document.addEventListener('DOMContentLoaded', () => {
    sortGrid('recent');
    initTags(); 
});
</script>
`;

    return html;
}