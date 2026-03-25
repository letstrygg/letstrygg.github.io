import { StatsCalc } from '../statsCalc.js';
import { UI } from '../uiComponents.js';
import { directoryFilterScript } from '../clientScripts.js';

export function tagsHubHTML(data) {
    let html = `---
layout: new
title: "Tag Directory - LTG Network"
permalink: /yt/tags/
---
<div class="game-page-wrapper">
  <div class="flex-between divider-bottom" style="margin-bottom: 30px; padding-bottom: 15px; align-items: flex-end;">
    <div>
      <h1 class="title">Tag Directory</h1>
      <p class="subtitle" style="margin: 0;">Browse network series by genre and category</p>
    </div>
    <div style="text-align: right; font-size: 0.9em; color: var(--gray);">
        <div style="color: var(--text); font-weight: bold; margin-bottom: 4px;">Tagged Network Scope</div>
        <div class="flex-row" style="gap: 15px; justify-content: flex-end;">
            <span title="Total Tags" class="flex-row gap-sm"><span class="material-symbols-outlined" style="font-size: 16px;">sell</span> ${data.tags.length}</span>
            <span title="Tagged Games" class="flex-row gap-sm"><span class="material-symbols-outlined" style="font-size: 16px;">sports_esports</span> ${StatsCalc.formatNum(data.global.series)}</span>
            <span title="Total Views" class="flex-row gap-sm"><span class="material-symbols-outlined blue" style="font-size: 16px;">visibility</span> ${StatsCalc.formatNum(data.global.views)}</span>
            <span title="Total Duration" class="flex-row gap-sm"><span class="material-symbols-outlined purple" style="font-size: 16px;">schedule</span> ${StatsCalc.formatDur(data.global.duration)}</span>
        </div>
    </div>
  </div>

  ${UI.FilterControls()}
  
  <div class="grid" id="series-grid">
`;

    data.tags.forEach(t => {
        const base = {
            url: `/yt/tags/${t.tagSlug}/`,
            title: t.tagName,
            seriesCount: t.seriesCount
        };
        const stats = {
            totalViews: t.stats.total_views,
            totalLikes: t.stats.total_likes,
            totalComments: t.stats.total_comments,
            totalDuration: t.stats.total_duration
        };
        
        html += UI.TagCard(base, stats, t.adv, { ctaText: "Browse Tag" });
    });

    html += `  </div>\n</div>\n${directoryFilterScript}`;
    return html;
}