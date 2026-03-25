import { StatsCalc } from '../statsCalc.js';
import { UI } from '../uiComponents.js';
import { directoryFilterScript } from '../clientScripts.js';

export function channelHTML(data) {
    const isParent = data.channels.length > 1;
    const global = data.dashboardTotals || {};

    const gCount = Math.max(1, global.total_games);
    const vCount = Math.max(1, global.total_videos);

    // Standardized Averages
    const avg = {
        items: Math.round(global.total_videos / gCount),
        views: Math.round(global.total_views / gCount),
        likes: Math.round(global.total_likes / gCount),
        comments: Math.round(global.total_comments / gCount),
        duration: Math.round(global.total_duration / gCount),
        viewsPerVid: Math.round(global.total_views / vCount),
        likesPerVid: Math.round(global.total_likes / vCount),
        commentsPerVid: Math.round(global.total_comments / vCount),
        durPerVid: Math.round(global.total_duration / vCount)
    };

    const adv = {
        age: StatsCalc.daysBetween(global.first_pub),
        dead: StatsCalc.daysBetween(global.last_pub),
        vel: StatsCalc.velocity(global.total_views, StatsCalc.daysBetween(global.first_pub)),
        heat: StatsCalc.popularity(global.total_views, global.total_likes, global.total_comments, StatsCalc.hoursBetween(global.first_pub)),
        gem: StatsCalc.hiddenGemScore(global.total_views, global.total_likes, global.total_comments)
    };

    let html = `---
layout: new
title: "${data.hubDisplayName} - Games Directory"
permalink: /yt/${data.hubSlug}/
---
<div class="game-page-wrapper">
  ${data.manualContent}
`;

    if (isParent) {
        html += `<div class="network-splitter state-combined" id="networkToggleContainer">`;
        
        // Find the exact middle to inject the combined card for proper Mitosis physics
        const midIndex = Math.ceil(data.channels.length / 2);
        
        data.channels.forEach((ch, index) => {
            if (index === midIndex) {
                html += `
            <div class="network-cell card-combined active-filter" onclick="toggleNetworkState('split', '${data.channels[0].channelSlug}')">
                <h2>${data.hubDisplayName}</h2>
                <p>Click to split by channel</p>
            </div>`;
            }
            
            html += `
            <div class="network-cell card-split" data-target="${ch.channelSlug}" onclick="toggleNetworkState('split', '${ch.channelSlug}')">
                <h2>${ch.displayName}</h2>
                <p>${ch.games.length} Games</p>
            </div>`;
        });
        
        html += `
            <div class="merge-btn" onclick="toggleNetworkState('combined', 'all')" title="Re-combine Network">
                <span class="material-symbols-outlined" style="font-size: 20px;">close_fullscreen</span>
            </div>
        </div>`;
    } else {
        html += `
  <div class="divider-bottom" style="margin-bottom: 30px; padding-bottom: 15px;">
    <h1 class="title" style="text-transform: capitalize;">${data.hubDisplayName}</h1>
    <p class="subtitle" style="margin: 0;">Channel Directory</p>
  </div>`;
    }

    html += UI.Dashboard(global, avg, adv, {
        itemCount: global.total_games,
        itemIcon: "sports_esports",
        itemLabel: "Total Games",
        groupLabel: "PER GAME"
    });

    html += UI.FilterControls();
    html += `<div class="grid" id="all-series-grid">`;

    data.channels.forEach(channel => {
        channel.games.forEach(game => {
            let totalViews = 0, totalDuration = 0, totalLikes = 0, totalComments = 0, epCount = 0;
            let minFirst = Infinity, maxLast = 0, firstVideoId = null;

            game.ltg_series_playlists?.forEach(sp => {
                const s = sp.ltg_playlists?.ltg_playlist_stats?.[0];
                if (s) {
                    totalViews += parseInt(s.total_views || 0); totalDuration += parseInt(s.total_duration || 0);
                    totalLikes += parseInt(s.total_likes || 0); totalComments += parseInt(s.total_comments || 0);
                    epCount += parseInt(s.ep_count || 0);
                    
                    const fP = new Date(s.first_published_at || Infinity).getTime();
                    const lP = new Date(s.latest_published_at || 0).getTime();
                    if (fP < minFirst) minFirst = fP; if (lP > maxLast) maxLast = lP;
                    if (!firstVideoId && s.first_video_id) firstVideoId = s.first_video_id;
                }
            });

            if (minFirst === Infinity) minFirst = null;

            const cStats = {
                epCount, totalViews, totalLikes, totalComments, totalDuration,
                vpv: epCount > 0 ? Math.round(totalViews / epCount) : 0,
                lpv: epCount > 0 ? Math.round(totalLikes / epCount) : 0,
                cpv: epCount > 0 ? Math.round(totalComments / epCount) : 0,
                dpv: epCount > 0 ? Math.round(totalDuration / epCount) : 0
            };
            
            const gAge = StatsCalc.daysBetween(minFirst);
            const cAdv = {
                age: gAge, span: StatsCalc.daysBetween(minFirst, maxLast), dead: StatsCalc.daysBetween(maxLast),
                vel: StatsCalc.velocity(totalViews, gAge), heat: StatsCalc.popularity(totalViews, totalLikes, totalComments, StatsCalc.hoursBetween(minFirst)),
                gem: StatsCalc.hiddenGemScore(totalViews, totalLikes, totalComments),
                maxLast, minFirst
            };

            const cBase = {
                url: `/yt/${channel.channelSlug}/${game.slug}/`,
                thumbUrl: firstVideoId ? `https://i.ytimg.com/vi/${firstVideoId}/maxresdefault.jpg` : '/assets/img/default-thumbnail.jpg',
                title: game.title.replace(/"/g, '&quot;'),
                superTitle: channel.displayName,
                superTitleColor: channel.channelSlug === 'ltg-plus' ? 'gray' : 'blue',
                targetSlug: channel.channelSlug,
                tagsStr: (game.tags || []).join(',')
            };

            html += UI.GridCard(cBase, cStats, cAdv, avg, { contextAvg: "Channel Avg", ctaText: "View Series" });
        });
    });

    html += `</div>\n</div>\n${directoryFilterScript}`;
    return html;
}