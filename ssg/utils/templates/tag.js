import { StatsCalc } from '../statsCalc.js';
import { UI } from '../uiComponents.js';
import { directoryFilterScript } from '../clientScripts.js';

export function tagHTML(data) {
    const global = data.totals || {};
    const avgData = data.averages || { series: 0, views: 0, likes: 0, comments: 0, duration: 0, viewsPerVid: 0, likesPerVid: 0, commentsPerVid: 0, durPerVid: 0 };
    
    const avg = {
        items: avgData.series, views: avgData.views, likes: avgData.likes, comments: avgData.comments, duration: avgData.duration,
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
title: "${data.tagName} Series - LTG Network"
permalink: /yt/tags/${data.tagSlug}/
---
<div class="game-page-wrapper">
  <div class="divider-bottom" style="margin-bottom: 20px; padding-bottom: 15px;">
    <h1 class="title">${data.tagName}</h1>
    <p class="subtitle" style="margin: 0;">Games tagged with <strong>${data.tagName}</strong> across the network</p>
  </div>
`;

    // The Dashboard
    html += UI.Dashboard(global, avg, adv, {
        itemCount: data.series.length,
        itemIcon: "sports_esports",
        itemLabel: "Total Games",
        groupLabel: "PER GAME",
        hideGroupAvg: data.series.length <= 1
    });

    html += `${UI.FilterControls()}\n<div class="grid" id="series-grid">`;

    // The Grid Cards (Games/Series)
    data.series.forEach(s => {
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
            url: `/yt/${s.channelSlug}/${s.gameSlug}/`,
            thumbUrl: s.thumbUrl || '/assets/img/default-thumbnail.jpg',
            title: s.gameTitle,
            superTitle: s.channelDisplayName, // Show the channel name above the title so they know where it lives!
            superTitleColor: s.channelSlug === 'ltg-plus' ? 'gray' : 'blue',
            targetSlug: s.channelSlug,
            tagsStr: (s.tags || []).join(',')
        };

        html += UI.GridCard(cBase, cStats, cAdv, avg, { 
            contextAvg: "Genre Avg", 
            ctaText: "View Series",
            hideDeltas: data.series.length <= 1 
        });
    });

    html += `</div>\n</div>\n${directoryFilterScript}`;
    return html;
}