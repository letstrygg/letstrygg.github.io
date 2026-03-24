export function seriesHTML(data) {
    const safeTitle = data.seriesTitle.replace(/"/g, '&quot;');

    let html = `---
layout: new
title: "${safeTitle} - All Seasons"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/
custom_css: "/css/home.css"
---

<style>
/* Split Card Styling Overrides */
.split-card.game-card {
    padding: 0 !important; /* Strip default padding to let zones fill the edges */
    display: flex;
    flex-direction: column;
    gap: 0;
}

.zone-top, .zone-bottom {
    text-decoration: none;
    color: inherit;
    display: block;
    cursor: pointer;
}

/* Zone 1: Ep 1 (Thumbnail & Title) */
.zone-top {
    padding-bottom: 8px;
}
.zone-top img {
    width: 100%;
    aspect-ratio: 16/9;
    object-fit: cover;
    transition: opacity 0.2s ease;
}
.zone-top:hover img {
    opacity: 0.7; /* Dim image on hover to indicate play action */
}
.zone-top .card-row {
    padding: 12px 15px 0 15px; /* Restore padding just for the text */
}

/* Zone 2: Season View (Stats & Link) */
.zone-bottom {
    padding: 10px 15px 15px 15px;
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid transparent;
    transition: background 0.2s ease, border-color 0.2s ease;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}
.zone-bottom:hover {
    background: rgba(255, 255, 255, 0.06);
    border-top: 1px solid var(--border);
}
.zone-bottom:hover .view-list-text {
    color: var(--blue);
}

.yt-header-link:hover {
    opacity: 1 !important;
}
.yt-header-link:hover .material-symbols-outlined {
    transform: scale(1.1);
}
</style>

<div class="game-page-wrapper">
  ${data.manualContent}

  <div class="season-grid" id="series-grid">
`;

    // Generate Season Blocks
    data.seasons.forEach(s => {
        // Find Episode 1 URL
        const paddedSeason = String(Math.floor(s.seasonNum)).padStart(2, '0');
        const firstEp = s.episodes && s.episodes.length > 0 ? s.episodes[0] : 1;
        const paddedEp = String(firstEp).padStart(2, '0');
        
        const ep1Url = `/yt/${data.channelSlug}/${data.gameSlug}/season-${Math.floor(s.seasonNum)}/${data.shortPrefix}-s${paddedSeason}e${paddedEp}.html`;
        const seasonUrl = `/yt/${data.channelSlug}/${data.gameSlug}/season-${Math.floor(s.seasonNum)}/`;
        const ytPlaylistUrl = `https://www.youtube.com/playlist?list=${s.id}`;
        
        const views = s.totalViews ? s.totalViews.toLocaleString() : '0';
        const thumbUrl = s.firstVideoId ? `https://i.ytimg.com/vi/${s.firstVideoId}/maxresdefault.jpg` : '/assets/img/default-thumbnail.jpg';

        html += `
    <div class="season-block">
      <div class="season-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span class="season-label" style="font-size: 1.2rem; font-weight: bold; padding-left: 6px; border-left: 4px solid var(--blue);">Season ${s.seasonNum}</span>
        
        <a href="${ytPlaylistUrl}" target="_blank" rel="noopener noreferrer" class="yt-header-link" style="display: flex; align-items: center; gap: 4px; color: var(--text); text-decoration: none; font-size: 0.9rem; opacity: 0.7; transition: all 0.2s;">
          <span class="material-symbols-outlined" style="color: var(--red); font-size: 20px; transition: transform 0.2s;">play_circle</span> YouTube
        </a>
      </div>
      
      <div class="split-card game-card filterable-card" data-updated="${s.lastUpdatedFormatted}">
        
        <a href="${ep1Url}" class="zone-top" title="Play Episode 1">
          <div style="background: #000;">
            <img src="${thumbUrl}" alt="${safeTitle} S${s.seasonNum}">
          </div>
          <div class="card-row">
            <strong style="font-size: 1.1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${safeTitle} S${s.seasonNum}</strong>
            <span class="card-status ${s.statusColor}">${s.status}</span>
          </div>
        </a>
        
        <a href="${seasonUrl}" class="zone-bottom" title="View Season Details">
          <div class="card-row stats-row" style="margin-bottom: 12px; font-size: 0.85rem;">
            <span><span class="material-symbols-outlined gray" style="font-size: 16px; vertical-align: text-bottom;">list</span> ${s.epCount}</span>
            <span><span class="material-symbols-outlined gray" style="font-size: 16px; vertical-align: text-bottom;">visibility</span> ${views}</span>
            <span class="card-duration">
              <span class="dur-full"><span class="material-symbols-outlined gray" style="font-size: 16px; vertical-align: text-bottom;">schedule</span> ${s.durFull}</span>
              <span class="dur-short"><span class="material-symbols-outlined gray" style="font-size: 16px; vertical-align: text-bottom;">schedule</span> ${s.durShort}</span>
            </span>
          </div>
          
          <div class="view-list-text" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: bold; color: var(--gray); border-top: 1px solid var(--border); padding-top: 10px; transition: color 0.2s;">
            View Episode List <span class="material-symbols-outlined" style="font-size: 18px;">arrow_forward</span>
          </div>
        </a>
        
      </div>
    </div>
`;
    });

    html += `
  </div>
</div>
`;

    return html;
}