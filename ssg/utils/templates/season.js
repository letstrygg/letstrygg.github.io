import { StatsCalc } from '../statsCalc.js';

export function seasonHTML(data) {
    // Safely extract stats (Fallback to 0 if updater hasn't passed them yet)
    const stats = data.stats || { videos: 0, views: 0, likes: 0, comments: 0, duration: 0, firstPub: null, lastPub: null };
    const avg = data.averages || { videos: 0, views: 0, likes: 0, comments: 0, duration: 0 };

    // Calculate Time Metrics
    const ageDays = StatsCalc.daysBetween(stats.firstPub);
    const deadDays = StatsCalc.daysBetween(stats.lastPub);
    const longevityDays = StatsCalc.daysBetween(stats.firstPub, stats.lastPub);
    const viewsVelocity = StatsCalc.velocity(stats.views, ageDays);
    const gemScore = StatsCalc.hiddenGemScore(stats.views, stats.likes, stats.comments);

    return `---
layout: new
title: "Season ${data.seasonNum} Episodes - ${data.seriesTitle}"
description: "A complete list of episodes from Season ${data.seasonNum} of the ${data.seriesTitle} Let's Play."
permalink: /yt/${data.channelSlug}/${data.gameSlug}/season-${data.seasonNum.toString().replace('.', '_')}/
custom_css: "/css/game/${data.shortPrefix}-style.css"
sync_date: "${data.syncDate}"
---

<style>
/* Dashboard Styles */
.analytics-dash {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    color: var(--text);
}
.dash-row {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 15px;
    padding: 10px 0;
    border-bottom: 1px solid #333;
}
.dash-row:last-child { border-bottom: none; padding-bottom: 0; }
.stat-item { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; }
.stat-label { color: var(--gray); font-weight: bold; margin-right: 4px; }
</style>

<div class="game-page-wrapper">
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 1px solid var(--gray); padding-bottom: 15px;">
    <div>
      <h1 class="title" style="margin-bottom: 5px;">${data.seriesTitle}</h1>
      <p class="subtitle" style="margin: 0;">Season ${data.seasonNum} Episodes</p>
    </div>
    <button class="btn btn-gray" onclick="toggleEpSort()" title="Reverse Order">
      <span class="material-symbols-outlined" id="sortIcon" style="font-size: 18px; vertical-align: middle;">arrow_downward</span> Sort
    </button>
  </div>

  <div class="analytics-dash">
    
    <div class="dash-row">
        <div class="stat-item"><span class="stat-label">ORIGINAL:</span></div>
        <div class="stat-item" title="Videos"><span class="material-symbols-outlined" style="color: var(--red); font-size: 18px;">video_library</span> ${StatsCalc.formatNum(stats.videos)}</div>
        <div class="stat-item" title="Views"><span class="material-symbols-outlined" style="color: var(--blue); font-size: 18px;">visibility</span> ${StatsCalc.formatNum(stats.views)}</div>
        <div class="stat-item" title="Likes"><span class="material-symbols-outlined" style="color: var(--green); font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(stats.likes)}</div>
        <div class="stat-item" title="Comments"><span class="material-symbols-outlined" style="color: var(--orange); font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(stats.comments)}</div>
        <div class="stat-item" title="Duration"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 18px;">schedule</span> ${StatsCalc.formatDur(stats.duration)}</div>
    </div>

    <div class="dash-row">
        <div class="stat-item"><span class="stat-label tooltip-trigger" data-tooltip="Compared to Series Average">W/ DELTAS:</span></div>
        <div class="stat-item"><span class="material-symbols-outlined" style="color: var(--red); font-size: 18px;">video_library</span> ${StatsCalc.formatNum(stats.videos)} ${StatsCalc.formatDelta(stats.videos, avg.videos)}</div>
        <div class="stat-item"><span class="material-symbols-outlined" style="color: var(--blue); font-size: 18px;">visibility</span> ${StatsCalc.formatNum(stats.views)} ${StatsCalc.formatDelta(stats.views, avg.views)}</div>
        <div class="stat-item"><span class="material-symbols-outlined" style="color: var(--green); font-size: 18px;">thumb_up</span> ${StatsCalc.formatNum(stats.likes)} ${StatsCalc.formatDelta(stats.likes, avg.likes)}</div>
        <div class="stat-item"><span class="material-symbols-outlined" style="color: var(--orange); font-size: 18px;">chat_bubble</span> ${StatsCalc.formatNum(stats.comments)} ${StatsCalc.formatDelta(stats.comments, avg.comments)}</div>
    </div>

    <div class="dash-row" style="margin-top: 5px;">
        <div class="stat-item">
            <span class="stat-label tooltip-trigger" data-tooltip="Total Age of Season">Age:</span> ${ageDays}d
        </div>
        <div class="stat-item">
            <span class="stat-label tooltip-trigger" data-tooltip="Days between Ep 1 and Final Ep">Longevity:</span> ${longevityDays}d
        </div>
        <div class="stat-item">
            <span class="stat-label tooltip-trigger" data-tooltip="Days since latest upload">Last Video:</span> ${deadDays}d ago
        </div>
        <div class="stat-item">
            <span class="stat-label tooltip-trigger" data-tooltip="Average views generated per day">Velocity:</span> <span style="color: var(--blue);">${viewsVelocity}/d</span>
        </div>
        <div class="stat-item">
            <span class="stat-label tooltip-trigger" data-tooltip="High Engagement + Low Views = Hidden Gem">Gem Score:</span> <span style="color: var(--orange); font-weight: bold;">${gemScore}</span>
        </div>
    </div>

  </div>

  <div class="game-section">
    ${data.manualContent}

    {%- assign ep_pages = site.pages | where_exp: "item", "item.url contains '/yt/${data.channelSlug}/${data.gameSlug}/season-${data.seasonNum}/'" | where_exp: "item", "item.name != 'index.html'" | sort: "title" -%}
    
    <div id="epGrid" class="ep-grid">
    {%- for ep in ep_pages -%}
      <a href="{{ ep.url | relative_url }}" class="btn btn-gray" style="text-align: left; padding: 10px 15px;">
        {{ ep.title | remove: "${data.seriesTitle}" | strip }}
      </a>
    {%- endfor -%}
    </div>
  </div>
</div>

<script>
  let isAscending = true;
  const epGrid = document.getElementById('epGrid');
  const sortIcon = document.getElementById('sortIcon');

  function toggleEpSort() {
    isAscending = !isAscending;
    sortIcon.innerText = isAscending ? 'arrow_downward' : 'arrow_upward';
    
    // Convert HTMLCollection to Array to reverse it
    const items = Array.from(epGrid.children);
    items.reverse();
    
    // Clear and re-append in the new order
    epGrid.innerHTML = '';
    items.forEach(item => epGrid.appendChild(item));
  }
</script>`;
}