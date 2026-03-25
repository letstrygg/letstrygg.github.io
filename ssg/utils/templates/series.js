import { StatsCalc } from '../statsCalc.js';

export function seriesHTML(data) {
    const safeGameTitle = data.gameTitle ? data.gameTitle.replace(/"/g, '&quot;') : data.seriesTitle.replace(/"/g, '&quot;');
    const avg = data.averages || { videos: 0, views: 0, likes: 0, comments: 0, duration: 0, viewsPerVid: 0, likesPerVid: 0, commentsPerVid: 0, durPerVid: 0 };
    const global = data.seriesTotals || {};

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
---

<div class="game-page-wrapper">
  
  <div style="margin-bottom: 20px; border-bottom: 1px solid var(--gray); padding-bottom: 15px;">
    <h1 class="title">${safeGameTitle}</h1>
    <p class="subtitle" style="margin: 0;">Series Overview</p>
  </div>

  <div class="dash-panel">
    
    <div class="dash-row" style="padding-top: 0;">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 100px;">TOTALS:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Seasons"><span class="material-symbols-outlined" style="color: var(--text); font-size: 18px;">folder</span> ${data.seasons.length}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Videos"><span class="material-symbols-outlined red" style="font-size: 18px;">video_library</span> ${StatsCalc.formatNum(global.total_videos)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Views"><span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> ${StatsCalc.formatNum(global.total_views)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Likes"><span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(global.total_likes)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Comments"><span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(global.total_comments)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Duration"><span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> ${StatsCalc.formatDur(global.total_duration)}</div>
    </div>

    <div class="dash-row">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 100px;">PER SEASON:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Videos per Season"><span class="material-symbols-outlined red" style="font-size: 18px;">video_library</span> ${StatsCalc.formatNum(avg.videos)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Views per Season"><span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> ${StatsCalc.formatNum(avg.views)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Likes per Season"><span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(avg.likes)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Comments per Season"><span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(avg.comments)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Duration per Season"><span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> ${StatsCalc.formatDur(avg.duration)}</div>
    </div>

    <div class="dash-row">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 100px;">PER VID:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Views per Video"><span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> ${StatsCalc.formatNum(avg.viewsPerVid)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Likes per Video"><span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(avg.likesPerVid)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Comments per Video"><span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(avg.commentsPerVid)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Duration per Video"><span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> ${StatsCalc.formatDur(avg.durPerVid)}</div>
    </div>

    <div class="dash-row" style="gap: 20px;">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 100px;">ANALYTICS:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Time since first video"><strong>Age:</strong> ${StatsCalc.formatAge(seriesAgeDays)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Time between first and last video"><strong>Span:</strong> ${StatsCalc.formatAge(seriesSpanDays)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Days since last upload"><strong>Inactive:</strong> ${StatsCalc.formatAge(seriesDeadDays)}</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Views per day"><strong>Vel:</strong> <span style="color: var(--blue);">${seriesVel}/d</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Franchise Retention: Latest Season Final Ep vs Season 1 First Ep"><strong>Retain:</strong> <span style="color: var(--green);">${seriesRetention}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Trending score based on engagement and recency"><strong>Heat:</strong> <span style="color: var(--red);">${seriesHeat}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Hidden Gem Score"><strong>Gem:</strong> <span style="color: var(--orange);">${seriesGem}</span></div>
    </div>

  </div>

  ${data.manualContent}

  <div class="grid" id="series-grid">
`;

    // Generate Panel Blocks for each Season
    data.seasons.forEach(s => {
        const seasonNumStr = s.seasonNum.toString();
        const seasonNumSafe = seasonNumStr.replace('.', '_');
        
        const seasonUrl = `/yt/${data.channelSlug}/${data.gameSlug}/season-${seasonNumSafe}/`;
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
    <div class="panel filterable-card flush-all" data-updated="${s.lastUpdatedFormatted}">
      
      <a href="${seasonUrl}" class="inner-panel interactive flush-all" style="border: none;">
        
        <img src="${thumbUrl}" alt="${displayTitle}" loading="lazy" style="width: 100%; aspect-ratio: 16/9; object-fit: cover;" onerror="this.onerror=null; this.src='/assets/img/default-thumbnail.jpg';">
        
        <div style="padding: 15px; display: flex; flex-direction: column;">
          
          <div class="flex-between divider-bottom">
            <strong class="label">${displayTitle}</strong>
            <span class="card-status ${s.statusColor}">${s.status}</span>
          </div>

          <div class="flex-between flex-wrap text-sm">
            <span title="Videos" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Videos vs Series Avg"><span class="material-symbols-outlined red">video_library</span> ${StatsCalc.formatNum(s.epCount)} ${StatsCalc.formatDelta(s.epCount, avg.videos)}</span>
            <span title="Views" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Views vs Series Avg"><span class="material-symbols-outlined blue">visibility</span> ${StatsCalc.formatNum(s.totalViews)} ${StatsCalc.formatDelta(s.totalViews, avg.views)}</span>
            <span title="Likes" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Likes vs Series Avg"><span class="material-symbols-outlined green">thumb_up</span> ${StatsCalc.formatNum(s.totalLikes)} ${StatsCalc.formatDelta(s.totalLikes, avg.likes)}</span>
            <span title="Comments" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Comments vs Series Avg"><span class="material-symbols-outlined orange">chat_bubble</span> ${StatsCalc.formatNum(s.totalComments)} ${StatsCalc.formatDelta(s.totalComments, avg.comments)}</span>
            <span title="Duration" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Duration vs Series Avg"><span class="material-symbols-outlined purple">schedule</span> ${StatsCalc.formatDur(s.totalDuration)} ${StatsCalc.formatDelta(s.totalDuration, avg.duration, true)}</span>
          </div>

          <div class="flex-between flex-wrap text-sm divider-top-dashed">
            <span title="Views / Vid" class="tooltip-trigger flex-row gap-sm" data-tooltip="Views Per Video vs Series Avg"><span class="material-symbols-outlined blue">visibility</span> ${StatsCalc.formatNum(sViewsPerVid)} ${StatsCalc.formatDelta(sViewsPerVid, avg.viewsPerVid)}</span>
            <span title="Likes / Vid" class="tooltip-trigger flex-row gap-sm" data-tooltip="Likes Per Video vs Series Avg"><span class="material-symbols-outlined green">thumb_up</span> ${StatsCalc.formatNum(sLikesPerVid)} ${StatsCalc.formatDelta(sLikesPerVid, avg.likesPerVid)}</span>
            <span title="Comments / Vid" class="tooltip-trigger flex-row gap-sm" data-tooltip="Comments Per Video vs Series Avg"><span class="material-symbols-outlined orange">chat_bubble</span> ${StatsCalc.formatNum(sCommentsPerVid)} ${StatsCalc.formatDelta(sCommentsPerVid, avg.commentsPerVid)}</span>
            <span title="Dur / Vid" class="tooltip-trigger flex-row gap-sm" data-tooltip="Duration Per Video vs Series Avg"><span class="material-symbols-outlined purple">schedule</span> ${StatsCalc.formatDur(sDurPerVid)} ${StatsCalc.formatDelta(sDurPerVid, avg.durPerVid, true)}</span>
          </div>

          <div class="flex-row flex-wrap gap-md text-sm text-muted divider-top-dashed">
            <span class="tooltip-trigger" data-tooltip="Age of Season"><strong>Age:</strong> ${StatsCalc.formatAge(ageDays)}</span>
            <span class="tooltip-trigger" data-tooltip="Time between first and last video"><strong>Span:</strong> ${StatsCalc.formatAge(longevityDays)}</span>
            <span class="tooltip-trigger" data-tooltip="Days since last upload"><strong>Inactive:</strong> ${StatsCalc.formatAge(deadDays)}</span>
            <span class="tooltip-trigger" data-tooltip="Views generated per day"><strong>Vel:</strong> <span class="blue">${viewsVelocity}/d</span></span>
            <span class="tooltip-trigger" data-tooltip="Retention: Final Ep Views vs Ep 1 Views"><strong>Retain:</strong> <span class="green">${sRetention}</span></span>
            <span class="tooltip-trigger" data-tooltip="Trending Score"><strong>Heat:</strong> <span class="red">${sHeat}</span></span>
            <span class="tooltip-trigger" data-tooltip="Hidden Gem Score"><strong>Gem:</strong> <span class="orange">${gemScore}</span></span>
          </div>
          
          <div class="flex-between text-sm text-bold text-muted divider-top hover-color-blue" style="margin-bottom: 0;">
            View Season <span class="material-symbols-outlined hover-opacity" style="font-size: 18px;">arrow_forward</span>
          </div>
          
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