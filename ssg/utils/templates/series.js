import { StatsCalc } from '../statsCalc.js';
import { UI } from '../uiComponents.js';
import { directoryFilterScript } from '../clientScripts.js';

export function seriesHTML(data) {
    const safeGameTitle = data.gameTitle ? data.gameTitle.replace(/"/g, '&quot;') : data.seriesTitle.replace(/"/g, '&quot;');
    const global = data.seriesTotals || {};

    const avgData = data.averages || { videos: 0, views: 0, likes: 0, comments: 0, duration: 0, viewsPerVid: 0, likesPerVid: 0, commentsPerVid: 0, durPerVid: 0 };
    
    const avg = {
        items: avgData.videos, views: avgData.views, likes: avgData.likes, comments: avgData.comments, duration: avgData.duration,
        viewsPerVid: avgData.viewsPerVid, likesPerVid: avgData.likesPerVid, commentsPerVid: avgData.commentsPerVid, durPerVid: avgData.durPerVid
    };

    const adv = {
        age: StatsCalc.daysBetween(global.first_published_at),
        dead: StatsCalc.daysBetween(global.latest_published_at),
        span: StatsCalc.daysBetween(global.first_published_at, global.latest_published_at),
        vel: StatsCalc.velocity(global.total_views || 0, StatsCalc.daysBetween(global.first_published_at)),
        heat: StatsCalc.popularity(global.total_views || 0, global.total_likes || 0, global.total_comments || 0, StatsCalc.hoursBetween(global.first_published_at)),
        gem: StatsCalc.hiddenGemScore(global.total_views, global.total_likes, global.total_comments)
    };

    let html = `---
layout: new
title: "${safeGameTitle} - All Seasons"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/
---
<div class="game-page-wrapper">
  <div class="divider-bottom" style="margin-bottom: 20px; padding-bottom: 15px;">
    <h1 class="title">${safeGameTitle}</h1>
    <p class="subtitle" style="margin: 0;">Series Overview</p>
  </div>
`;

    html += UI.Dashboard(global, avg, adv, {
        itemCount: data.seasons.length,
        itemIcon: "folder",
        itemLabel: "Total Seasons",
        groupLabel: "PER SEASON",
        hideGroupAvg: data.seasons.length <= 1 // <--- Hides if only 1 season exists!
    });

    html += `${data.manualContent}\n${UI.FilterControls()}\n<div class="grid" id="series-grid">`;

    data.seasons.forEach(s => {
        const seasonNumStr = s.seasonNum.toString();
        const seasonNumSafe = seasonNumStr.replace('.', '_');
        
        const epCountSafe = Math.max(1, s.epCount);
        const cStats = {
            epCount: s.epCount, totalViews: s.totalViews, totalLikes: s.totalLikes, totalComments: s.totalComments, totalDuration: s.totalDuration,
            vpv: Math.round(s.totalViews / epCountSafe), lpv: Math.round(s.totalLikes / epCountSafe),
            cpv: Math.round(s.totalComments / epCountSafe), dpv: Math.round(s.totalDuration / epCountSafe)
        };

        const gAge = StatsCalc.daysBetween(s.firstPub);
        const cAdv = {
            age: gAge, span: StatsCalc.daysBetween(s.firstPub, s.lastPub), dead: StatsCalc.daysBetween(s.lastPub),
            vel: StatsCalc.velocity(s.totalViews, gAge), heat: StatsCalc.popularity(s.totalViews, s.totalLikes, s.totalComments, StatsCalc.hoursBetween(s.firstPub)),
            gem: StatsCalc.hiddenGemScore(s.totalViews, s.totalLikes, s.totalComments),
            maxLast: s.lastUpdatedFormatted, minFirst: s.firstPub
        };

        const cBase = {
            url: `/yt/${data.channelSlug}/${data.gameSlug}/season-${seasonNumSafe}/`,
            thumbUrl: s.firstVideoId ? `https://i.ytimg.com/vi/${s.firstVideoId}/maxresdefault.jpg` : '/assets/img/default-thumbnail.jpg',
            title: `${safeGameTitle} S${seasonNumStr}`,
            superTitle: s.status,
            superTitleColor: s.statusColor,
            targetSlug: "",
            tagsStr: ""
        };

        html += UI.GridCard(cBase, cStats, cAdv, avg, { contextAvg: "Series Avg", ctaText: "View Season" });
    });

    html += `</div>\n</div>\n${directoryFilterScript}`;
    return html;
}