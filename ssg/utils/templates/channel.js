import { StatsCalc } from '../statsCalc.js';

export function channelHTML(data) {
    const isParent = data.channels.length > 1;
    const global = data.dashboardTotals || {};
    
    // Calculate stats for the top animation cards
    let letstryggCount = 0, plusCount = 0;
    if (isParent) {
        data.channels.forEach(ch => {
            if (ch.channelSlug === 'letstrygg') letstryggCount = ch.games.length;
            if (ch.channelSlug === 'ltg-plus') plusCount = ch.games.length;
        });
    }

    // Baseline Averages for the Dashboard
    const gCount = Math.max(1, global.total_games);
    const vCount = Math.max(1, global.total_videos);

    const avg = {
        // Per Game
        vidPerGame: Math.round(global.total_videos / gCount),
        viewsPerGame: Math.round(global.total_views / gCount),
        likesPerGame: Math.round(global.total_likes / gCount),
        commentsPerGame: Math.round(global.total_comments / gCount),
        durPerGame: Math.round(global.total_duration / gCount),
        
        // Per Video
        viewsPerVid: Math.round(global.total_views / vCount),
        likesPerVid: Math.round(global.total_likes / vCount),
        commentsPerVid: Math.round(global.total_comments / vCount),
        durPerVid: Math.round(global.total_duration / vCount)
    };

    // Advanced Metrics
    const ageDays = StatsCalc.daysBetween(global.first_pub);
    const deadDays = StatsCalc.daysBetween(global.last_pub);
    const spanDays = StatsCalc.daysBetween(global.first_pub, global.last_pub);
    const ageHours = StatsCalc.hoursBetween(global.first_pub);
    const velocity = StatsCalc.velocity(global.total_views, ageDays);
    const heat = StatsCalc.popularity(global.total_views, global.total_likes, global.total_comments, ageHours);
    const gem = StatsCalc.hiddenGemScore(global.total_views, global.total_likes, global.total_comments);


    let html = `---
layout: new
title: "${data.hubSlug} - Games Directory"
permalink: /yt/${data.hubSlug}/
---

<style>
/* Flexbox Merge/Split Animation Styles */
.channel-split-container {
    display: flex; width: 100%; margin-bottom: 30px; position: relative;
    gap: 0; 
    transition: gap 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}
.state-split { gap: 20px; } 

.anim-card {
    border: 2px solid #333; border-radius: 12px; background: #1a1a1a;
    overflow: hidden; white-space: nowrap; display: flex; flex-direction: column;
    justify-content: center; align-items: center; user-select: none;
    transition: flex 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease, 
                padding 0.5s cubic-bezier(0.25, 1, 0.5, 1), border-width 0.5s ease;
}
.anim-card:hover { background: #222; }

/* STATE: COMBINED */
.state-combined .card-combined { flex: 1; opacity: 1; padding: 30px; border-color: var(--blue); cursor: pointer; }
.state-combined .card-split { flex: 0; opacity: 0; padding: 0; border-width: 0; pointer-events: none; }

/* STATE: SPLIT */
.state-split .card-combined { flex: 0; opacity: 0; padding: 0; border-width: 0; pointer-events: none; }
.state-split .card-split { flex: 1; opacity: 1; padding: 30px; cursor: pointer; }
.card-split.active-filter { border-color: var(--blue); background: #222; }

/* The Floating Merge Icon */
.merge-icon-btn {
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%) scale(0);
    cursor: pointer; color: var(--gray);
    display: flex; justify-content: center; align-items: center;
    transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s, color 0.2s;
    opacity: 0; z-index: 10; pointer-events: none;
    background: #111; border-radius: 50%; padding: 4px;
}
.merge-icon-btn:hover { color: var(--blue); }
.state-split .merge-icon-btn {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1; pointer-events: auto;
}
</style>

<div class="game-page-wrapper">
  ${data.manualContent}
`;

    if (isParent) {
        html += `
  <div class="channel-split-container state-combined" id="networkToggleContainer">
      <div class="anim-card card-split" id="card-letstrygg" onclick="toggleNetworkState('split', 'letstrygg')">
          <h2 style="margin: 0 0 5px 0;">Letstrygg</h2>
          <p style="margin: 0; color: var(--gray);">${letstryggCount} Games</p>
      </div>
      <div class="anim-card card-combined" onclick="toggleNetworkState('split', 'letstrygg')">
          <h2 style="margin: 0 0 5px 0;">Let's Try GG Network</h2>
          <p style="margin: 0; color: var(--gray);">Click to split by channel</p>
      </div>
      <div class="anim-card card-split" id="card-ltg-plus" onclick="toggleNetworkState('split', 'ltg-plus')">
          <h2 style="margin: 0 0 5px 0;">LTG Plus</h2>
          <p style="margin: 0; color: var(--gray);">${plusCount} Games</p>
      </div>
      <div class="merge-icon-btn" onclick="toggleNetworkState('combined', 'all')" title="Re-combine Network">
          <span class="material-symbols-outlined" style="font-size: 28px;">close_fullscreen</span>
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

    // THE CHANNEL DASHBOARD (Always Visible)
    html += `
  <div class="dash-panel">
    
    <div class="dash-row" style="padding-top: 0;">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">TOTALS:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Games"><span class="material-symbols-outlined" style="color: var(--text); font-size: 18px;">sports_esports</span> ${global.total_games}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Videos"><span class="material-symbols-outlined" style="color: var(--red); font-size: 18px;">video_library</span> ${StatsCalc.formatNum(global.total_videos)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Views"><span class="material-symbols-outlined" style="color: var(--blue); font-size: 18px;">visibility</span> ${StatsCalc.formatNum(global.total_views)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Likes"><span class="material-symbols-outlined" style="color: var(--green); font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(global.total_likes)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Comments"><span class="material-symbols-outlined" style="color: var(--orange); font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(global.total_comments)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Duration"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 18px;">schedule</span> ${StatsCalc.formatDur(global.total_duration)}</div>
    </div>

    <div class="dash-row">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">PER GAME:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Videos per Game"><span class="material-symbols-outlined" style="color: var(--red); font-size: 18px;">video_library</span> ${StatsCalc.formatNum(avg.vidPerGame)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Views per Game"><span class="material-symbols-outlined" style="color: var(--blue); font-size: 18px;">visibility</span> ${StatsCalc.formatNum(avg.viewsPerGame)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Likes per Game"><span class="material-symbols-outlined" style="color: var(--green); font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(avg.likesPerGame)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Comments per Game"><span class="material-symbols-outlined" style="color: var(--orange); font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(avg.commentsPerGame)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Duration per Game"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 18px;">schedule</span> ${StatsCalc.formatDur(avg.durPerGame)}</div>
    </div>

    <div class="dash-row">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">PER VID:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Views per Video"><span class="material-symbols-outlined" style="color: var(--blue); font-size: 18px;">visibility</span> ${StatsCalc.formatNum(avg.viewsPerVid)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Likes per Video"><span class="material-symbols-outlined" style="color: var(--green); font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(avg.likesPerVid)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Comments per Video"><span class="material-symbols-outlined" style="color: var(--orange); font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(avg.commentsPerVid)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Duration per Video"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 18px;">schedule</span> ${StatsCalc.formatDur(avg.durPerVid)}</div>
    </div>

    <div class="dash-row" style="gap: 20px;">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">ANALYTICS:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Channel Age"><strong>Age:</strong> ${StatsCalc.formatAge(ageDays)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Days since last upload"><strong>Inactive:</strong> ${deadDays}d</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Network Views per day"><strong>Vel:</strong> <span style="color: var(--blue);">${velocity}/d</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Overall Trending Score"><strong>Heat:</strong> <span style="color: var(--red);">${heat}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Overall Hidden Gem Score"><strong>Gem:</strong> <span style="color: var(--orange);">${gem}</span></div>
    </div>
  </div>
`;

    // The Rich UI Controls
    html += `
<div class="controls-wrapper">
    <div class="controls-top-row">
        <div class="search-wrapper" style="position: relative; flex: 1;">
            <input type="text" id="gameSearch" placeholder="Search Games" style="width: 100%; padding-right: 35px; box-sizing: border-box;">
            <span id="clearSearch" class="material-symbols-outlined" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--gray); font-size: 20px; display: none;" onclick="clearSearchInput()">close</span>
        </div>
        
        <div class="top-row-buttons">
            <button class="btn" id="btn-tags-toggle" onclick="toggleTagPanel()">
                <span class="material-symbols-outlined">sell</span> Tags
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

<div class="game-grid" id="all-series-grid">
`;

    // Generate the Game Cards dynamically
    data.channels.forEach(channel => {
        channel.games.forEach(game => {
            let totalViews = 0, totalDuration = 0, totalLikes = 0, totalComments = 0, epCount = 0, maxTime = 0;
            let firstVideoId = null;

            game.ltg_series_playlists?.forEach(sp => {
                const stats = sp.ltg_playlists?.ltg_playlist_stats?.[0];
                if (stats) {
                    totalViews += parseInt(stats.total_views || 0);
                    totalDuration += parseInt(stats.total_duration || 0);
                    totalLikes += parseInt(stats.total_likes || 0);
                    totalComments += parseInt(stats.total_comments || 0);
                    epCount += parseInt(stats.ep_count || 0);
                    const pubTime = stats.latest_published_at ? new Date(stats.latest_published_at).getTime() : 0;
                    if (pubTime > maxTime) maxTime = pubTime;
                    if (!firstVideoId && stats.first_video_id) firstVideoId = stats.first_video_id;
                }
            });

            const vpv = epCount > 0 ? Math.round(totalViews / epCount) : 0;
            const lpv = epCount > 0 ? Math.round(totalLikes / epCount) : 0;
            const dpv = epCount > 0 ? Math.round(totalDuration / epCount) : 0;
            
            const thumbUrl = firstVideoId ? `https://i.ytimg.com/vi/${firstVideoId}/maxresdefault.jpg` : '/assets/img/default-thumbnail.jpg';
            const tagsStr = (game.tags || []).join(',');
            const safeTitle = game.title.replace(/"/g, '&quot;');
            const gameUrl = `/yt/${channel.channelSlug}/${game.slug}/`;

            const statusColor = channel.channelSlug === 'ltg-plus' ? 'gray' : 'blue';

            // New Panel-Style Game Cards
            html += `
  <div class="panel filterable-card" data-channel="${channel.channelSlug}" data-title="${safeTitle.toLowerCase()}" data-tags="${tagsStr}" data-updated="${maxTime}" data-episodes="${epCount}" data-views="${totalViews}" data-duration="${totalDuration}" data-vpv="${vpv}">
      
      <a href="${gameUrl}" class="content" title="View Directory">
        <img src="${thumbUrl}" alt="${safeTitle}" loading="lazy" onerror="this.onerror=null; this.src='/assets/img/default-thumbnail.jpg';">
        <div class="content-row">
          <strong style="font-size: 1.1rem; line-height: 1.3; margin: 0;">${safeTitle}</strong>
          <span class="card-status ${statusColor}">${channel.channelSlug}</span>
        </div>
      </a>

      <a href="${gameUrl}" class="info" title="View Details">
        <div class="info-stats" style="margin-bottom: 8px;">
          <span title="Videos"><span class="material-symbols-outlined" style="color: var(--red); font-size: 16px; vertical-align: text-bottom;">video_library</span> ${StatsCalc.formatNum(epCount)}</span>
          <span title="Views"><span class="material-symbols-outlined" style="color: var(--blue); font-size: 16px; vertical-align: text-bottom;">visibility</span> ${StatsCalc.formatNum(totalViews)}</span>
          <span title="Duration"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 16px; vertical-align: text-bottom;">schedule</span> ${StatsCalc.formatDur(totalDuration)}</span>
        </div>
        
        <div class="info-stats" style="border-top: 1px dashed #333; padding-top: 8px;">
          <span title="Views / Vid" class="tooltip-trigger" data-tooltip="Avg Views per Video"><span class="material-symbols-outlined" style="color: var(--blue); font-size: 16px; vertical-align: text-bottom;">visibility</span> ${StatsCalc.formatNum(vpv)} /v</span>
          <span title="Likes / Vid" class="tooltip-trigger" data-tooltip="Avg Likes per Video"><span class="material-symbols-outlined" style="color: var(--green); font-size: 16px; vertical-align: text-bottom;">thumb_up</span> ${StatsCalc.formatNum(lpv)} /v</span>
          <span title="Dur / Vid" class="tooltip-trigger" data-tooltip="Avg Duration per Video"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 16px; vertical-align: text-bottom;">schedule</span> ${StatsCalc.formatDur(dpv)} /v</span>
        </div>
      </a>
  </div>\n`;
        });
    });

    html += `</div>\n</div>\n`;

    // 4. Inject the interactive JavaScript
    html += `
<script>
// --- State Management ---
let currentSort = 'recent';
let activeTags = new Set();
let allSortedTags = [];
let isTagPanelActive = false;
let activeChannelFilter = 'all'; 

function toggleNetworkState(targetState, filterSlug) {
    const container = document.getElementById('networkToggleContainer');
    const cLets = document.getElementById('card-letstrygg');
    const cPlus = document.getElementById('card-ltg-plus');
    
    if (!container) return;

    if (targetState === 'split') {
        container.classList.remove('state-combined');
        container.classList.add('state-split');
        
        if (filterSlug === 'letstrygg') {
            cLets.classList.add('active-filter');
            cPlus.classList.remove('active-filter');
        } else if (filterSlug === 'ltg-plus') {
            cPlus.classList.add('active-filter');
            cLets.classList.remove('active-filter');
        }
    } else {
        container.classList.remove('state-split');
        container.classList.add('state-combined');
        
        cLets.classList.remove('active-filter');
        cPlus.classList.remove('active-filter');
    }

    activeChannelFilter = filterSlug;
    applyFilters();
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
        if (type === 'recent') return parseInt(b.dataset.updated || 0) - parseInt(a.dataset.updated || 0);
        if (type === 'popular') return parseInt(b.dataset.views || 0) - parseInt(a.dataset.views || 0);
        if (type === 'length') return parseInt(b.dataset.duration || 0) - parseInt(a.dataset.duration || 0);
        if (type === 'vpv') return parseInt(b.dataset.vpv || 0) - parseInt(a.dataset.vpv || 0);
    });

    grid.innerHTML = '';
    cards.forEach(card => grid.appendChild(card));
}

// --- Unified Filter & Search Logic ---
function clearSearchInput() {
    const searchInput = document.getElementById('gameSearch');
    searchInput.value = '';
    document.getElementById('clearSearch').style.display = 'none';
    applyFilters();
    searchInput.focus();
}

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

// Listen for search input and toggle the 'x' button
document.getElementById('gameSearch').addEventListener('input', (e) => {
    const clearBtn = document.getElementById('clearSearch');
    clearBtn.style.display = e.target.value.length > 0 ? 'block' : 'none';
    applyFilters();
});

// Boot it all up
document.addEventListener('DOMContentLoaded', () => {
    sortGrid('recent');
    initTags(); 
});
</script>
`;

    return html;
}