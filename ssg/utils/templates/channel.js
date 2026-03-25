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

    // Baseline SSG Averages
    const gCount = Math.max(1, global.total_games);
    const vCount = Math.max(1, global.total_videos);

    const avg = {
        vidPerGame: Math.round(global.total_videos / gCount),
        viewsPerGame: Math.round(global.total_views / gCount),
        likesPerGame: Math.round(global.total_likes / gCount),
        commentsPerGame: Math.round(global.total_comments / gCount),
        durPerGame: Math.round(global.total_duration / gCount),
        viewsPerVid: Math.round(global.total_views / vCount),
        likesPerVid: Math.round(global.total_likes / vCount),
        commentsPerVid: Math.round(global.total_comments / vCount),
        durPerVid: Math.round(global.total_duration / vCount)
    };

    const ageDays = StatsCalc.daysBetween(global.first_pub);
    const deadDays = StatsCalc.daysBetween(global.last_pub);
    const ageHours = StatsCalc.hoursBetween(global.first_pub);
    const velocity = StatsCalc.velocity(global.total_views, ageDays);
    const heat = StatsCalc.popularity(global.total_views, global.total_likes, global.total_comments, ageHours);
    const gem = StatsCalc.hiddenGemScore(global.total_views, global.total_likes, global.total_comments);

    let html = `---
layout: new
title: "${data.hubDisplayName} - Games Directory"
permalink: /yt/${data.hubSlug}/
---

<style>
.channel-split-container { display: flex; width: 100%; margin-bottom: 30px; position: relative; gap: 0; transition: gap 0.5s cubic-bezier(0.25, 1, 0.5, 1); }
.state-split { gap: 20px; } 
.anim-card { border: 2px solid var(--border); border-radius: 12px; background: var(--bg2); overflow: hidden; white-space: nowrap; display: flex; flex-direction: column; justify-content: center; align-items: center; user-select: none; transition: flex 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease, padding 0.5s cubic-bezier(0.25, 1, 0.5, 1), border-width 0.5s ease; }
.anim-card:hover { background: var(--bg3); }
.state-combined .card-combined { flex: 1; opacity: 1; padding: 30px; border-color: var(--blue); cursor: pointer; }
.state-combined .card-split { flex: 0; opacity: 0; padding: 0; border-width: 0; pointer-events: none; }
.state-split .card-combined { flex: 0; opacity: 0; padding: 0; border-width: 0; pointer-events: none; }
.state-split .card-split { flex: 1; opacity: 1; padding: 30px; cursor: pointer; }
.card-split.active-filter { border-color: var(--blue); background: var(--bg3); }
.merge-icon-btn { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(0); cursor: pointer; color: var(--gray); display: flex; justify-content: center; align-items: center; transition: transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s, color 0.2s; opacity: 0; z-index: 10; pointer-events: none; background: var(--bg2); border-radius: 50%; padding: 4px; }
.merge-icon-btn:hover { color: var(--blue); }
.state-split .merge-icon-btn { transform: translate(-50%, -50%) scale(1); opacity: 1; pointer-events: auto; }
</style>

<div class="game-page-wrapper">
  ${data.manualContent}
`;

    if (isParent) {
        html += `<div class="channel-split-container state-combined" id="networkToggleContainer">`;
        data.channels.forEach(ch => {
            html += `
            <div class="anim-card card-split" data-target="${ch.channelSlug}" onclick="toggleNetworkState('split', '${ch.channelSlug}')">
                <h2 style="margin: 0 0 5px 0; text-transform: capitalize;">${ch.displayName}</h2>
                <p style="margin: 0; color: var(--gray);">${ch.games.length} Games</p>
            </div>`;
        });
        html += `
            <div class="anim-card card-combined" onclick="toggleNetworkState('split', '${data.channels[0].channelSlug}')">
                <h2 style="margin: 0 0 5px 0;">${data.hubDisplayName}</h2>
                <p style="margin: 0; color: var(--gray);">Click to split by channel</p>
            </div>
            <div class="merge-icon-btn" onclick="toggleNetworkState('combined', 'all')" title="Re-combine Network">
                <span class="material-symbols-outlined" style="font-size: 28px;">close_fullscreen</span>
            </div>
        </div>`;
    } else {
        html += `
  <div style="margin-bottom: 30px; border-bottom: 1px solid var(--gray); padding-bottom: 15px;">
    <h1 class="title" style="text-transform: capitalize;">${data.hubDisplayName}</h1>
    <p class="subtitle" style="margin: 0;">Channel Directory</p>
  </div>`;
    }

    // THE CHANNEL DASHBOARD (With dynamic IDs for JS)
    html += `
  <div class="dash-panel" id="main-dashboard">
    <div class="dash-row" style="padding-top: 0;">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">TOTALS:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Games" id="dash-tot-games"><span class="material-symbols-outlined" style="color: var(--text); font-size: 18px;">sports_esports</span> ${global.total_games}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Videos" id="dash-tot-vids"><span class="material-symbols-outlined red" style="font-size: 18px;">video_library</span> ${StatsCalc.formatNum(global.total_videos)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Views" id="dash-tot-views"><span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> ${StatsCalc.formatNum(global.total_views)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Likes" id="dash-tot-likes"><span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(global.total_likes)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Comments" id="dash-tot-comms"><span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(global.total_comments)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Duration" id="dash-tot-dur"><span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> ${StatsCalc.formatDur(global.total_duration)}</div>
    </div>

    <div class="dash-row">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">PER GAME:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Videos per Game" id="dash-avg-vid"><span class="material-symbols-outlined red" style="font-size: 18px;">video_library</span> ${StatsCalc.formatNum(avg.vidPerGame)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Views per Game" id="dash-avg-view"><span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> ${StatsCalc.formatNum(avg.viewsPerGame)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Likes per Game" id="dash-avg-like"><span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(avg.likesPerGame)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Comments per Game" id="dash-avg-comm"><span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(avg.commentsPerGame)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Duration per Game" id="dash-avg-dur"><span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> ${StatsCalc.formatDur(avg.durPerGame)}</div>
    </div>

    <div class="dash-row">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">PER VID:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Views per Video" id="dash-pv-view"><span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> ${StatsCalc.formatNum(avg.viewsPerVid)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Likes per Video" id="dash-pv-like"><span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(avg.likesPerVid)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Comments per Video" id="dash-pv-comm"><span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(avg.commentsPerVid)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Duration per Video" id="dash-pv-dur"><span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> ${StatsCalc.formatDur(avg.durPerVid)}</div>
    </div>

    <div class="dash-row" style="gap: 20px;">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">ANALYTICS:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Age of filtered content" id="dash-adv-age"><strong>Age:</strong> ${StatsCalc.formatAge(ageDays)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Days since last upload" id="dash-adv-dead"><strong>Inactive:</strong> ${StatsCalc.formatAge(deadDays)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Views generated per day" id="dash-adv-vel"><strong>Vel:</strong> <span class="blue">${velocity}/d</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Overall Trending Score" id="dash-adv-heat"><strong>Heat:</strong> <span class="red">${heat}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Overall Hidden Gem Score" id="dash-adv-gem"><strong>Gem:</strong> <span class="orange">${gem}</span></div>
    </div>
  </div>
`;

    // Generalized Universal Controls
    html += `
<div class="panel" style="margin-bottom: 20px; gap: 15px;">
    <div class="flex-row">
        <div style="position: relative; flex: 1;">
            <input type="text" id="gameSearch" class="input" placeholder="Search Games...">
            <span id="clearSearch" class="material-symbols-outlined hidden" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--gray);" onclick="clearSearchInput()">close</span>
        </div>
        <div class="flex-row" style="gap: 10px;">
            <button class="btn btn-gray" id="btn-tags-toggle" onclick="toggleTagPanel()">
                <span class="material-symbols-outlined">sell</span> Tags
            </button>
        </div>
    </div>

    <div class="btn-group flex-wrap">
        <button class="btn btn-green active" id="btn-recent" onclick="sortGrid('recent')"><span class="material-symbols-outlined">psychiatry</span> New</button>
        <button class="btn btn-blue" id="btn-popular" onclick="sortGrid('popular')"><span class="material-symbols-outlined">visibility</span> Views</button>
        <button class="btn btn-purple" id="btn-length" onclick="sortGrid('length')"><span class="material-symbols-outlined">schedule</span> Duration</button>
        <button class="btn btn-orange" id="btn-vpv" onclick="sortGrid('vpv')"><span class="material-symbols-outlined">mode_heat</span> VPV</button>
        <button class="btn btn-blue" id="btn-vel" onclick="sortGrid('vel')"><span class="material-symbols-outlined">speed</span> Velocity</button>
        <button class="btn btn-red" id="btn-heat" onclick="sortGrid('heat')"><span class="material-symbols-outlined">local_fire_department</span> Heat</button>
        <button class="btn btn-yellow" id="btn-gem" onclick="sortGrid('gem')"><span class="material-symbols-outlined">diamond</span> Gem</button>
    </div>
</div>

<div id="tag-filters" class="panel hidden" style="flex-direction: row; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; padding: 12px;"></div>

<div class="grid" id="all-series-grid">
`;

    // Generate the Game Cards dynamically
    data.channels.forEach(channel => {
        channel.games.forEach(game => {
            let totalViews = 0, totalDuration = 0, totalLikes = 0, totalComments = 0, epCount = 0;
            let minFirst = Infinity, maxLast = 0, firstVideoId = null;

            game.ltg_series_playlists?.forEach(sp => {
                const stats = sp.ltg_playlists?.ltg_playlist_stats?.[0];
                if (stats) {
                    totalViews += parseInt(stats.total_views || 0);
                    totalDuration += parseInt(stats.total_duration || 0);
                    totalLikes += parseInt(stats.total_likes || 0);
                    totalComments += parseInt(stats.total_comments || 0);
                    epCount += parseInt(stats.ep_count || 0);
                    
                    const fP = new Date(stats.first_published_at || Infinity).getTime();
                    const lP = new Date(stats.latest_published_at || 0).getTime();
                    if (fP < minFirst) minFirst = fP;
                    if (lP > maxLast) maxLast = lP;
                    if (!firstVideoId && stats.first_video_id) firstVideoId = stats.first_video_id;
                }
            });

            if (minFirst === Infinity) minFirst = null;

            const vpv = epCount > 0 ? Math.round(totalViews / epCount) : 0;
            const lpv = epCount > 0 ? Math.round(totalLikes / epCount) : 0;
            const cpv = epCount > 0 ? Math.round(totalComments / epCount) : 0;
            const dpv = epCount > 0 ? Math.round(totalDuration / epCount) : 0;
            
            // Per Game Analytics
            const gAge = StatsCalc.daysBetween(minFirst);
            const gDead = StatsCalc.daysBetween(maxLast);
            const gSpan = StatsCalc.daysBetween(minFirst, maxLast);
            const gHours = StatsCalc.hoursBetween(minFirst);
            const gVel = StatsCalc.velocity(totalViews, gAge);
            const gHeat = StatsCalc.popularity(totalViews, totalLikes, totalComments, gHours);
            const gGem = StatsCalc.hiddenGemScore(totalViews, totalLikes, totalComments);

            const thumbUrl = firstVideoId ? `https://i.ytimg.com/vi/${firstVideoId}/maxresdefault.jpg` : '/assets/img/default-thumbnail.jpg';
            const tagsStr = (game.tags || []).join(',');
            const safeTitle = game.title.replace(/"/g, '&quot;');
            const gameUrl = `/yt/${channel.channelSlug}/${game.slug}/`;
            const statusColor = channel.channelSlug === 'ltg-plus' ? 'gray' : 'blue';

            // New Clean Utility Structure HTML
            html += `
  <div class="panel filterable-card flush-all" data-channel="${channel.channelSlug}" data-title="${safeTitle.toLowerCase()}" data-tags="${tagsStr}" 
       data-updated="${maxLast}" data-episodes="${epCount}" data-views="${totalViews}" data-likes="${totalLikes}" data-comments="${totalComments}" data-duration="${totalDuration}" data-vpv="${vpv}" data-firstpub="${minFirst}" data-vel="${gVel}" data-heat="${gHeat}" data-gem="${gGem}">
      
      <a href="${gameUrl}" class="inner-panel interactive flush-all" style="border: none;">
        
        <img src="${thumbUrl}" alt="${safeTitle}" loading="lazy" onerror="this.onerror=null; this.src='/assets/img/default-thumbnail.jpg';">
        
        <div style="padding: 15px; display: flex; flex-direction: column;">
            
            <div class="flex-between divider-bottom">
              <strong class="label">${safeTitle}</strong>
              <span class="card-status ${statusColor}">${channel.displayName}</span>
            </div>

            <div class="flex-between flex-wrap text-sm">
              <span title="Videos" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Videos vs Channel Avg"><span class="material-symbols-outlined red">video_library</span> ${StatsCalc.formatNum(epCount)} ${StatsCalc.formatDelta(epCount, avg.vidPerGame)}</span>
              <span title="Views" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Views vs Channel Avg"><span class="material-symbols-outlined blue">visibility</span> ${StatsCalc.formatNum(totalViews)} ${StatsCalc.formatDelta(totalViews, avg.viewsPerGame)}</span>
              <span title="Likes" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Likes vs Channel Avg"><span class="material-symbols-outlined green">thumb_up</span> ${StatsCalc.formatNum(totalLikes)} ${StatsCalc.formatDelta(totalLikes, avg.likesPerGame)}</span>
              <span title="Comments" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Comments vs Channel Avg"><span class="material-symbols-outlined orange">chat_bubble</span> ${StatsCalc.formatNum(totalComments)} ${StatsCalc.formatDelta(totalComments, avg.commentsPerGame)}</span>
              <span title="Duration" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Duration vs Channel Avg"><span class="material-symbols-outlined purple">schedule</span> ${StatsCalc.formatDur(totalDuration)} ${StatsCalc.formatDelta(totalDuration, avg.durPerGame, true)}</span>
            </div>
            
            <div class="flex-between flex-wrap text-sm divider-top-dashed">
              <span title="Views / Vid" class="tooltip-trigger flex-row gap-sm" data-tooltip="Views Per Video vs Channel Avg"><span class="material-symbols-outlined blue">visibility</span> ${StatsCalc.formatNum(vpv)} ${StatsCalc.formatDelta(vpv, avg.viewsPerVid)}</span>
              <span title="Likes / Vid" class="tooltip-trigger flex-row gap-sm" data-tooltip="Likes Per Video vs Channel Avg"><span class="material-symbols-outlined green">thumb_up</span> ${StatsCalc.formatNum(lpv)} ${StatsCalc.formatDelta(lpv, avg.likesPerVid)}</span>
              <span title="Comments / Vid" class="tooltip-trigger flex-row gap-sm" data-tooltip="Comments Per Video vs Channel Avg"><span class="material-symbols-outlined orange">chat_bubble</span> ${StatsCalc.formatNum(cpv)} ${StatsCalc.formatDelta(cpv, avg.commentsPerVid)}</span>
              <span title="Dur / Vid" class="tooltip-trigger flex-row gap-sm" data-tooltip="Duration Per Video vs Channel Avg"><span class="material-symbols-outlined purple">schedule</span> ${StatsCalc.formatDur(dpv)} ${StatsCalc.formatDelta(dpv, avg.durPerVid, true)}</span>
            </div>

            <div class="flex-row flex-wrap gap-md text-sm text-muted divider-top-dashed">
              <span class="tooltip-trigger" data-tooltip="Age of Game series"><strong>Age:</strong> ${StatsCalc.formatAge(gAge)}</span>
              <span class="tooltip-trigger" data-tooltip="Time between first and last video"><strong>Span:</strong> ${StatsCalc.formatAge(gSpan)}</span>
              <span class="tooltip-trigger" data-tooltip="Days since last upload"><strong>Inactive:</strong> ${StatsCalc.formatAge(gDead)}</span>
              <span class="tooltip-trigger" data-tooltip="Views generated per day"><strong>Vel:</strong> <span class="blue">${gVel}/d</span></span>
              <span class="tooltip-trigger" data-tooltip="Trending Score"><strong>Heat:</strong> <span class="red">${gHeat}</span></span>
              <span class="tooltip-trigger" data-tooltip="Hidden Gem Score"><strong>Gem:</strong> <span class="orange">${gGem}</span></span>
            </div>

            <div class="flex-between text-sm text-bold text-muted divider-top hover-color-blue" style="margin-bottom: 0;">
              View Series <span class="material-symbols-outlined hover-opacity" style="font-size: 18px;">arrow_forward</span>
            </div>
            
        </div>
      </a>
  </div>\n`;
        });
    });

    html += `</div>\n</div>\n`;

    // 4. Inject the interactive JavaScript
    html += `
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

    const grid = document.getElementById('all-series-grid');
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
    searchInput.value = '';
    document.getElementById('clearSearch').classList.add('hidden');
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

    if (tGames === 0) return; // Prevent NaN errors

    // DOM Updates - Totals
    document.getElementById('dash-tot-games').innerHTML = \`<span class="material-symbols-outlined" style="color: var(--text); font-size: 18px;">sports_esports</span> \${Utils.formatNum(tGames)}\`;
    document.getElementById('dash-tot-vids').innerHTML = \`<span class="material-symbols-outlined red" style="font-size: 18px;">video_library</span> \${Utils.formatNum(tVids)}\`;
    document.getElementById('dash-tot-views').innerHTML = \`<span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> \${Utils.formatNum(tViews)}\`;
    document.getElementById('dash-tot-likes').innerHTML = \`<span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> \${Utils.formatNum(tLikes)}\`;
    document.getElementById('dash-tot-comms').innerHTML = \`<span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> \${Utils.formatNum(tComms)}\`;
    document.getElementById('dash-tot-dur').innerHTML = \`<span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> \${Utils.formatDur(tDur)}\`;

    // Per Game Averages
    document.getElementById('dash-avg-vid').innerHTML = \`<span class="material-symbols-outlined red" style="font-size: 18px;">video_library</span> \${Utils.formatNum(tVids / tGames)}\`;
    document.getElementById('dash-avg-view').innerHTML = \`<span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> \${Utils.formatNum(tViews / tGames)}\`;
    document.getElementById('dash-avg-like').innerHTML = \`<span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> \${Utils.formatNum(tLikes / tGames)}\`;
    document.getElementById('dash-avg-comm').innerHTML = \`<span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> \${Utils.formatNum(tComms / tGames)}\`;
    document.getElementById('dash-avg-dur').innerHTML = \`<span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> \${Utils.formatDur(tDur / tGames)}\`;

    // Per Vid Averages
    const vC = Math.max(1, tVids);
    document.getElementById('dash-pv-view').innerHTML = \`<span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> \${Utils.formatNum(tViews / vC)}\`;
    document.getElementById('dash-pv-like').innerHTML = \`<span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> \${Utils.formatNum(tLikes / vC)}\`;
    document.getElementById('dash-pv-comm').innerHTML = \`<span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> \${Utils.formatNum(tComms / vC)}\`;
    document.getElementById('dash-pv-dur').innerHTML = \`<span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> \${Utils.formatDur(tDur / vC)}\`;

    // Advanced Analytics
    const ageDays = Utils.daysBetween(minFirst);
    document.getElementById('dash-adv-age').innerHTML = \`<strong>Age:</strong> \${Utils.formatAge(ageDays)}\`;
    document.getElementById('dash-adv-dead').innerHTML = \`<strong>Inactive:</strong> \${Utils.formatAge(Utils.daysBetween(maxLast))}\`;
    document.getElementById('dash-adv-vel').innerHTML = \`<strong>Vel:</strong> <span style="color: var(--blue);">\${Utils.velocity(tViews, ageDays)}/d</span>\`;
    document.getElementById('dash-adv-heat').innerHTML = \`<strong>Heat:</strong> <span style="color: var(--red);">\${Utils.heat(tViews, tLikes, tComms, Utils.hoursBetween(minFirst))}</span>\`;
    document.getElementById('dash-adv-gem').innerHTML = \`<strong>Gem:</strong> <span style="color: var(--orange);">\${Utils.gem(tViews, tLikes, tComms)}</span>\`;
}

function toggleTagPanel() {
    isTagPanelActive = !isTagPanelActive;
    const btn = document.getElementById('btn-tags-toggle');
    const panel = document.getElementById('tag-filters');
    
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

document.getElementById('gameSearch').addEventListener('input', (e) => {
    const clearBtn = document.getElementById('clearSearch');
    if (e.target.value.length > 0) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }
    applyFilters();
});

document.addEventListener('DOMContentLoaded', () => {
    sortGrid('recent');
    initTags(); 
});
</script>
`;

    return html;
}