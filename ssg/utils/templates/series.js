import { StatsCalc } from '../statsCalc.js';

export function seriesHTML(data) {
    const safeGameTitle = data.gameTitle ? data.gameTitle.replace(/"/g, '&quot;') : data.seriesTitle.replace(/"/g, '&quot;');
    const avg = data.averages || { videos: 0, views: 0, likes: 0, comments: 0, duration: 0, viewsPerVid: 0, likesPerVid: 0, commentsPerVid: 0, durPerVid: 0 };
    const global = data.seriesStats || {};

    // Calculate Series-Level Advanced Stats
    const seriesAgeDays = StatsCalc.daysBetween(global.first_published_at);
    const seriesDeadDays = StatsCalc.daysBetween(global.latest_published_at);
    const seriesSpanDays = StatsCalc.daysBetween(global.first_published_at, global.latest_published_at);
    const seriesAgeHours = StatsCalc.hoursBetween(global.first_published_at);
    const seriesVel = StatsCalc.velocity(global.total_views || 0, seriesAgeDays);
    const seriesGem = StatsCalc.hiddenGemScore(global.total_views, global.total_likes, global.total_comments);
    const seriesRetention = StatsCalc.retention(global.firstEpViews, global.lastEpViews);
    const seriesHeat = StatsCalc.popularity(global.total_views || 0, global.total_likes || 0, global.total_comments || 0, seriesAgeHours);

    let html = `---
layout: new
title: "${safeGameTitle} - All Seasons"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/
custom_css: "/css/home.css"
---

<style>
/* Generic Component System */
.panel {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    background: transparent;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0px 4px 4px 4px;
}

.label {
    font-size: 1.1rem;
    font-weight: bold;
}

/* Zone 1: Generic Content Block */
.content {
    display: flex;
    flex-direction: column;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    text-decoration: none;
    color: var(--text);
    transition: border-color 0.2s ease;
}

.content:hover {
    border-color: var(--border-hover);
}

.content img {
    width: 100%;
    aspect-ratio: 16/9;
    object-fit: cover;
}

.content-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
    gap: 12px;
}

/* Zone 2: Generic Info Block */
.info {
    display: flex;
    flex-direction: column;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 15px;
    margin-top: 10px;
    text-decoration: none;
    color: var(--text);
    transition: background 0.2s ease, border-color 0.2s ease;
}

.info:hover {
    background: var(--bg3);
    border-color: var(--border-hover);
}

.info:hover .info-cta {
    color: var(--blue);
}

.info-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    flex-wrap: wrap; 
}

.info-stats span {
    display: flex;
    align-items: center;
    gap: 2px;
}

.info-cta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    font-weight: bold;
    color: var(--gray);
    border-top: 1px solid var(--border);
    padding-top: 10px;
    transition: color 0.2s;
}

.yt-header-link {
    opacity: 0.7;
    transition: opacity 0.2s;
}
.yt-header-link:hover {
    opacity: 1;
}

/* Series Dashboard Specifics */
.dash-panel {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
}
.dash-row {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    padding: 12px 0;
    border-bottom: 1px dashed var(--border);
    align-items: center;
}
.dash-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
}
.dash-stat {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.95rem;
}
</style>

<div class="game-page-wrapper">
  
  <div style="margin-bottom: 20px; border-bottom: 1px solid var(--gray); padding-bottom: 15px;">
    <h1 class="title">${safeGameTitle}</h1>
    <p class="subtitle" style="margin: 0;">Series Overview</p>
  </div>

  <div class="dash-panel">
    
    <div class="dash-row" style="padding-top: 0;">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">TOTALS:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Seasons"><span class="material-symbols-outlined" style="color: var(--text); font-size: 18px;">folder</span> ${data.seasons.length}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Videos"><span class="material-symbols-outlined" style="color: var(--red); font-size: 18px;">video_library</span> ${StatsCalc.formatNum(global.total_videos)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Views"><span class="material-symbols-outlined" style="color: var(--blue); font-size: 18px;">visibility</span> ${StatsCalc.formatNum(global.total_views)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Likes"><span class="material-symbols-outlined" style="color: var(--green); font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(global.total_likes)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Comments"><span class="material-symbols-outlined" style="color: var(--orange); font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(global.total_comments)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Duration"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 18px;">schedule</span> ${StatsCalc.formatDur(global.total_duration)}</div>
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
      <div class="dash-stat tooltip-trigger" data-tooltip="Time since first video"><strong>Age:</strong> ${StatsCalc.formatAge(seriesAgeDays)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Time between first and last video"><strong>Span:</strong> ${StatsCalc.formatAge(seriesSpanDays)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Days since last upload"><strong>Inactive:</strong> <span style="color: var(--red);">${seriesDeadDays}d</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Views per day"><strong>Vel:</strong> <span style="color: var(--blue);">${seriesVel}/d</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Franchise Retention: Latest Season Final Ep vs Season 1 First Ep"><strong>Retain:</strong> <span style="color: var(--green);">${seriesRetention}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Trending score based on engagement and recency"><strong>Heat:</strong> <span style="color: var(--red);">${seriesHeat}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Hidden Gem Score"><strong>Gem:</strong> <span style="color: var(--orange);">${seriesGem}</span></div>
    </div>

  </div>

  ${data.manualContent}

  <div class="season-grid" id="series-grid">
`;

    // Generate Panel Blocks for each Season
    data.seasons.forEach(s => {
        // Handle Decimals Safely
        const seasonNumStr = s.seasonNum.toString();
        const seasonNumSafe = seasonNumStr.replace('.', '_');
        const seasonParts = seasonNumStr.split('.');
        const paddedSeason = seasonParts[0].padStart(2, '0') + (seasonParts[1] ? '_' + seasonParts[1] : '');
        
        const firstEp = s.episodes && s.episodes.length > 0 ? s.episodes[0] : 1;
        const paddedEp = String(firstEp).padStart(2, '0');
        
        const ep1Url = `/yt/${data.channelSlug}/${data.gameSlug}/season-${seasonNumSafe}/${data.shortPrefix}-s${paddedSeason}e${paddedEp}.html`;
        const seasonUrl = `/yt/${data.channelSlug}/${data.gameSlug}/season-${seasonNumSafe}/`;
        const ytPlaylistUrl = `https://www.youtube.com/playlist?list=${s.id}`;
        const thumbUrl = s.firstVideoId ? `https://i.ytimg.com/vi/${s.firstVideoId}/maxresdefault.jpg` : '/assets/img/default-thumbnail.jpg';
        
        const displayTitle = `${safeGameTitle} S${seasonNumStr}`;

        // Crunch Season-Specific Advanced Stats
        const ageDays = StatsCalc.daysBetween(s.firstPub);
        const deadDays = StatsCalc.daysBetween(s.lastPub);
        const longevityDays = StatsCalc.daysBetween(s.firstPub, s.lastPub);
        const ageHours = StatsCalc.hoursBetween(s.firstPub);
        const viewsVelocity = StatsCalc.velocity(s.totalViews, ageDays);
        const gemScore = StatsCalc.hiddenGemScore(s.totalViews, s.totalLikes, s.totalComments);
        const sRetention = StatsCalc.retention(s.firstEpViews, s.lastEpViews);
        const sHeat = StatsCalc.popularity(s.totalViews, s.totalLikes, s.totalComments, ageHours);

        // Crunch Season-Specific Per-Video Stats
        const epCountSafe = Math.max(1, s.epCount); // prevent divide by zero
        const sViewsPerVid = Math.round(s.totalViews / epCountSafe);
        const sLikesPerVid = Math.round(s.totalLikes / epCountSafe);
        const sCommentsPerVid = Math.round(s.totalComments / epCountSafe);
        const sDurPerVid = Math.round(s.totalDuration / epCountSafe);

        html += `
    <div class="panel filterable-card" data-updated="${s.lastUpdatedFormatted}">
      
      <div class="panel-header">
        <span class="label">Season ${seasonNumStr}</span>
        <a href="${ytPlaylistUrl}" target="_blank" rel="noopener noreferrer" class="yt-header-link" style="display: flex; align-items: center; gap: 4px; color: var(--text); text-decoration: none; font-size: 0.9rem;">
          <span class="material-symbols-outlined" style="color: var(--red); font-size: 20px;">play_circle</span> YouTube
        </a>
      </div>
      
      <a href="${ep1Url}" class="content" title="Play Episode 1">
        <img src="${thumbUrl}" alt="${displayTitle}" loading="lazy" onerror="this.onerror=null; this.src='/assets/img/default-thumbnail.jpg';">
        <div class="content-row">
          <strong style="font-size: 1.1rem; line-height: 1.3; margin: 0;">${displayTitle}</strong>
          <span class="card-status ${s.statusColor}">${s.status}</span>
        </div>
      </a>
      
      <a href="${seasonUrl}" class="info" title="View Season Details">
        
        <div class="info-stats" style="margin-bottom: 8px;">
          <span title="Videos" class="tooltip-trigger" data-tooltip="Total Videos vs Series Avg"><span class="material-symbols-outlined" style="color: var(--red); font-size: 16px; vertical-align: text-bottom;">video_library</span> ${StatsCalc.formatNum(s.epCount)} ${StatsCalc.formatDelta(s.epCount, avg.videos)}</span>
          <span title="Views" class="tooltip-trigger" data-tooltip="Total Views vs Series Avg"><span class="material-symbols-outlined" style="color: var(--blue); font-size: 16px; vertical-align: text-bottom;">visibility</span> ${StatsCalc.formatNum(s.totalViews)} ${StatsCalc.formatDelta(s.totalViews, avg.views)}</span>
          <span title="Likes" class="tooltip-trigger" data-tooltip="Total Likes vs Series Avg"><span class="material-symbols-outlined" style="color: var(--green); font-size: 16px; vertical-align: text-bottom;">thumb_up</span> ${StatsCalc.formatNum(s.totalLikes)} ${StatsCalc.formatDelta(s.totalLikes, avg.likes)}</span>
          <span title="Comments" class="tooltip-trigger" data-tooltip="Total Comments vs Series Avg"><span class="material-symbols-outlined" style="color: var(--orange); font-size: 16px; vertical-align: text-bottom;">chat_bubble</span> ${StatsCalc.formatNum(s.totalComments)} ${StatsCalc.formatDelta(s.totalComments, avg.comments)}</span>
          <span title="Duration" class="tooltip-trigger" data-tooltip="Total Duration vs Series Avg"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 16px; vertical-align: text-bottom;">schedule</span> ${StatsCalc.formatDur(s.totalDuration)} ${StatsCalc.formatDelta(s.totalDuration, avg.duration, true)}</span>
        </div>

        <div class="info-stats" style="margin-bottom: 8px; border-top: 1px dashed #333; padding-top: 8px;">
          <span title="Views / Vid" class="tooltip-trigger" data-tooltip="Views Per Video vs Series Avg"><span class="material-symbols-outlined" style="color: var(--blue); font-size: 16px; vertical-align: text-bottom;">visibility</span> ${StatsCalc.formatNum(sViewsPerVid)} ${StatsCalc.formatDelta(sViewsPerVid, avg.viewsPerVid)}</span>
          <span title="Likes / Vid" class="tooltip-trigger" data-tooltip="Likes Per Video vs Series Avg"><span class="material-symbols-outlined" style="color: var(--green); font-size: 16px; vertical-align: text-bottom;">thumb_up</span> ${StatsCalc.formatNum(sLikesPerVid)} ${StatsCalc.formatDelta(sLikesPerVid, avg.likesPerVid)}</span>
          <span title="Comments / Vid" class="tooltip-trigger" data-tooltip="Comments Per Video vs Series Avg"><span class="material-symbols-outlined" style="color: var(--orange); font-size: 16px; vertical-align: text-bottom;">chat_bubble</span> ${StatsCalc.formatNum(sCommentsPerVid)} ${StatsCalc.formatDelta(sCommentsPerVid, avg.commentsPerVid)}</span>
          <span title="Duration / Vid" class="tooltip-trigger" data-tooltip="Duration Per Video vs Series Avg"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 16px; vertical-align: text-bottom;">schedule</span> ${StatsCalc.formatDur(sDurPerVid)} ${StatsCalc.formatDelta(sDurPerVid, avg.durPerVid, true)}</span>
        </div>

        <div class="info-stats" style="margin-bottom: 10px; border-top: 1px dashed #333; padding-top: 8px; justify-content: flex-start; gap: 12px; color: var(--gray);">
          <span class="tooltip-trigger" data-tooltip="Age of Season"><strong>Age:</strong> ${StatsCalc.formatAge(ageDays)}</span>
          <span class="tooltip-trigger" data-tooltip="Time between first and last video"><strong>Span:</strong> ${StatsCalc.formatAge(longevityDays)}</span>
          <span class="tooltip-trigger" data-tooltip="Days since last upload"><strong>Inactive:</strong> <span style="color: var(--red);">${deadDays}d</span></span>
          <span class="tooltip-trigger" data-tooltip="Views generated per day"><strong>Vel:</strong> <span style="color: var(--blue);">${viewsVelocity}/d</span></span>
          <span class="tooltip-trigger" data-tooltip="Retention: Final Ep Views vs Ep 1 Views"><strong>Retain:</strong> <span style="color: var(--green);">${sRetention}</span></span>
          <span class="tooltip-trigger" data-tooltip="Trending Score"><strong>Heat:</strong> <span style="color: var(--red);">${sHeat}</span></span>
          <span class="tooltip-trigger" data-tooltip="Hidden Gem Score"><strong>Gem:</strong> <span style="color: var(--orange);">${gemScore}</span></span>
        </div>
        
        <div class="info-cta">
          View Episode List <span class="material-symbols-outlined" style="font-size: 18px;">arrow_forward</span>
        </div>
      </a>
      
    </div>
`;
    });

    html += `
  </div>
</div>
`;

    return html;
}