import { StatsCalc } from '../statsCalc.js';
import { UI } from '../uiComponents.js';
import { directoryFilterScript } from '../clientScripts.js';

export function seasonHTML(data) {
    const safeGameTitle = data.gameTitle ? data.gameTitle.replace(/"/g, '&quot;') : data.seriesTitle.replace(/"/g, '&quot;');
    const global = {
        total_videos: data.stats.videos,
        total_views: data.stats.views,
        total_likes: data.stats.likes,
        total_comments: data.stats.comments,
        total_duration: data.stats.duration
    };

    const gCount = Math.max(1, global.total_videos);

    const avg = {
        items: data.averages.videos,
        views: data.averages.views,
        likes: data.averages.likes,
        comments: data.averages.comments,
        duration: data.averages.duration,
        viewsPerVid: Math.round(global.total_views / gCount),
        likesPerVid: Math.round(global.total_likes / gCount),
        commentsPerVid: Math.round(global.total_comments / gCount),
        durPerVid: Math.round(global.total_duration / gCount)
    };

    const adv = {
        age: StatsCalc.daysBetween(data.stats.firstPub),
        dead: StatsCalc.daysBetween(data.stats.lastPub),
        span: StatsCalc.daysBetween(data.stats.firstPub, data.stats.lastPub),
        vel: StatsCalc.velocity(global.total_views, StatsCalc.daysBetween(data.stats.firstPub)),
        heat: StatsCalc.popularity(global.total_views, global.total_likes, global.total_comments, StatsCalc.hoursBetween(data.stats.firstPub)),
        gem: StatsCalc.hiddenGemScore(global.total_views, global.total_likes, global.total_comments)
    };

    // Build the Tag Buttons HTML
    const tagsHtml = data.tags && data.tags.length > 0 
        ? `<div class="flex-row flex-wrap" style="gap: 8px; margin-top: 15px;">
            ${data.tags.map(t => `<a href="/yt/tags/${t.slug}/" class="btn btn-gray interactive text-sm" style="padding: 4px 12px; border-radius: 15px; border-color: var(--border);">#${t.name}</a>`).join('\n')}
           </div>`
        : '';

    // --- NEW: SEO ItemList Schema ---
    const baseUrl = "https://letstrygg.com";
    const itemListElements = data.episodes.map((ep, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "url": `${baseUrl}${ep.url}`,
        "name": ep.title.replace(/"/g, '\\"')
    }));

    const schemaJSON = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": `${safeGameTitle} - Season ${data.seasonNum}`,
        "numberOfItems": data.episodes.length,
        "itemListElement": itemListElements
    };

    let html = `---
layout: new
title: "${safeGameTitle} - Season ${data.seasonNum}"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/season-${data.seasonNum.toString().replace('.', '_')}/
tags: "${data.tagsString}"
---
<script type="application/ld+json">
${JSON.stringify(schemaJSON, null, 2)}
</script>

<div class="game-page-wrapper">
  <div class="divider-bottom" style="margin-bottom: 20px; padding-bottom: 15px;">
    <h1 class="title">${safeGameTitle}</h1>
    <p class="subtitle" style="margin: 0;">Season ${data.seasonNum}</p>
    ${tagsHtml}
  </div>
`;

    html += UI.Dashboard(global, avg, adv, {
        itemCount: data.episodes.length,
        itemIcon: "video_library",
        itemLabel: "Total Episodes",
        groupLabel: "SERIES AVG",
        hideGroupAvg: true // <--- Hides the redundant second row!
    });

    html += `${data.manualContent}\n${UI.FilterControls()}\n<div class="grid" id="series-grid">`;

    data.episodes.forEach(ep => {
        const eStats = {
            views: ep.views,
            likes: ep.likes,
            comments: ep.comments,
            duration: ep.duration
        };

        const eAge = StatsCalc.daysBetween(ep.publishedAt);
        const eAdv = {
            age: eAge,
            rawDate: ep.publishedAt ? new Date(ep.publishedAt).getTime() : 0,
            vel: StatsCalc.velocity(ep.views, eAge),
            heat: StatsCalc.popularity(ep.views, ep.likes, ep.comments, StatsCalc.hoursBetween(ep.publishedAt)),
            gem: StatsCalc.hiddenGemScore(ep.views, ep.likes, ep.comments)
        };

        const eBase = {
            url: ep.url,
            thumbUrl: `https://i.ytimg.com/vi/${ep.videoId}/maxresdefault.jpg`,
            title: ep.title.replace(/"/g, '&quot;'),
            superTitle: `Ep ${String(ep.epNum).padStart(2, '0')}`,
            superTitleColor: "gray",
            targetSlug: "",
            tagsStr: ""
        };

        html += UI.EpisodeCard(eBase, eStats, eAdv, avg, { 
            contextAvg: "Season Avg",
            hideDeltas: data.episodes.length <= 1 // <--- ADDED: Hides the (0) deltas
        });
    });

    html += `</div>\n</div>\n${directoryFilterScript}`;
    return html;
}