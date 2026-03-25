import { StatsCalc } from '../statsCalc.js';

export function hubHTML(networkData) {
    let html = `---
layout: new
title: "LTG Network Directory"
permalink: /yt/
---

<div class="game-page-wrapper">
  ${networkData.manualContent}

  <div class="flex-between divider-bottom" style="margin-bottom: 30px; padding-bottom: 15px; align-items: flex-end;">
    <div>
      <h1 class="title">LTG Network</h1>
      <p class="subtitle" style="margin: 0;">Select a channel to view its game directory</p>
    </div>
    <div style="text-align: right; font-size: 0.9em; color: var(--gray);">
        <div style="color: var(--text); font-weight: bold; margin-bottom: 4px;">Total Network Scope</div>
        <div class="flex-row" style="gap: 15px; justify-content: flex-end;">
            <span title="Total Games" class="flex-row gap-sm"><span class="material-symbols-outlined" style="font-size: 16px;">sports_esports</span> ${StatsCalc.formatNum(networkData.totalGames)}</span>
            <span title="Total Videos" class="flex-row gap-sm"><span class="material-symbols-outlined red" style="font-size: 16px;">video_library</span> ${StatsCalc.formatNum(networkData.totalVideos)}</span>
            <span title="Total Views" class="flex-row gap-sm"><span class="material-symbols-outlined blue" style="font-size: 16px;">visibility</span> ${StatsCalc.formatNum(networkData.totalViews)}</span>
            <span title="Total Duration" class="flex-row gap-sm"><span class="material-symbols-outlined purple" style="font-size: 16px;">schedule</span> ${StatsCalc.formatDur(networkData.totalDuration)}</span>
        </div>
    </div>
  </div>

  <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));">
`;

    networkData.channels.forEach(ch => {
        const vpv = ch.videos > 0 ? Math.round(ch.views / ch.videos) : 0;
        const avgVideosPerGame = ch.games > 0 ? Math.round(ch.videos / ch.games) : 0;
        const durPerGame = ch.games > 0 ? Math.round(ch.duration / ch.games) : 0;
        const durPerVid = ch.videos > 0 ? Math.round(ch.duration / ch.videos) : 0;
        const targetUrl = `/yt/${ch.slug}/`;
        
        const statusColor = ch.slug === 'ltg-plus' ? 'gray' : 'blue';

        html += `
    <div class="panel flush-all">
        <a href="${targetUrl}" class="inner-panel interactive flush-all" style="border: none; padding: 0;">
            
            <div class="flex-between divider-bottom" style="padding: 20px 20px 10px 20px; background: var(--bg3); border-bottom: 1px solid var(--border);">
                <h2 style="margin: 0; text-transform: capitalize;">${ch.displayName || ch.slug}</h2>
                <span class="card-status ${statusColor}">Channel</span>
            </div>

            <div style="padding: 20px; display: flex; flex-direction: column; gap: 20px;">
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <div class="text-sm text-bold" style="color: var(--gray); margin-bottom: 8px;">TOTALS</div>
                        <div class="flex-row gap-sm" style="font-size: 1.1rem; margin-bottom: 4px;"><span class="material-symbols-outlined" style="color: var(--text);">sports_esports</span> <strong>${StatsCalc.formatNum(ch.games)}</strong> Games</div>
                        <div class="flex-row gap-sm" style="font-size: 1.1rem; margin-bottom: 4px;"><span class="material-symbols-outlined red">video_library</span> <strong>${StatsCalc.formatNum(ch.videos)}</strong> Videos</div>
                        <div class="flex-row gap-sm" style="font-size: 1.1rem; margin-bottom: 4px;"><span class="material-symbols-outlined blue">visibility</span> <strong>${StatsCalc.formatNum(ch.views)}</strong> Views</div>
                        <div class="flex-row gap-sm" style="font-size: 1.1rem;"><span class="material-symbols-outlined purple">schedule</span> <strong>${StatsCalc.formatDur(ch.duration)}</strong></div>
                    </div>
                    
                    <div>
                        <div class="text-sm text-bold" style="color: var(--gray); margin-bottom: 8px;">PER GAME AVERAGES</div>
                        <div class="flex-row gap-sm" style="font-size: 1.1rem; margin-bottom: 4px;"><span class="material-symbols-outlined red">video_library</span> <strong>${StatsCalc.formatNum(avgVideosPerGame)}</strong> Vids / Game</div>
                        <div class="flex-row gap-sm" style="font-size: 1.1rem; margin-bottom: 4px;"><span class="material-symbols-outlined blue">visibility</span> <strong>${StatsCalc.formatNum(ch.games > 0 ? ch.views / ch.games : 0)}</strong> Views / Game</div>
                        <div class="flex-row gap-sm" style="font-size: 1.1rem; margin-bottom: 4px;"><span class="material-symbols-outlined blue">mode_heat</span> <strong>${StatsCalc.formatNum(vpv)}</strong> VPV</div>
                        <div class="flex-row gap-sm" style="font-size: 1.1rem;"><span class="material-symbols-outlined purple">schedule</span> <strong>${StatsCalc.formatDur(durPerGame)}</strong> / Game</div>
                    </div>
                </div>

                <div class="flex-between text-sm text-bold text-muted divider-top hover-color-blue" style="margin-bottom: 0;">
                    View Channel Directory <span class="material-symbols-outlined hover-opacity" style="font-size: 18px;">arrow_forward</span>
                </div>
                
            </div>
        </a>
    </div>\n`;
    });

    html += `  </div>
</div>`;

    return html;
}