export function seriesHTML(data) {
    const safeTitle = data.seriesTitle.replace(/"/g, '&quot;');

    // Helper for "4.2K" formatting
    const formatViews = (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    };

    let html = `---
layout: new
title: "${safeTitle} - All Seasons"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/
custom_css: "/css/home.css"
---

<style>
/* Generic Component System */
.panel {
    display: flex;
    flex-direction: column;
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.label {
    /* Relying on your global typography, add specifics here if needed */
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
    transition: transform 0.2s ease, border-color 0.2s ease;
}

.content:hover {
    transform: translateY(-2px);
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
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.info:hover {
    background: #222;
    border-color: var(--border-hover);
    transform: translateY(-2px);
}

.info:hover .info-cta {
    color: var(--blue);
}

.info-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 0.85rem;
}

.info-stats span {
    display: flex;
    align-items: center;
    gap: 4px;
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

/* Simple hover brighten for the YT link */
.yt-header-link {
    opacity: 0.7;
    transition: opacity 0.2s;
}
.yt-header-link:hover {
    opacity: 1;
}
</style>

<div class="game-page-wrapper">
  ${data.manualContent}

  <div class="season-grid" id="series-grid">
`;

    // Generate Panel Blocks
    data.seasons.forEach(s => {
        const paddedSeason = String(Math.floor(s.seasonNum)).padStart(2, '0');
        const firstEp = s.episodes && s.episodes.length > 0 ? s.episodes[0] : 1;
        const paddedEp = String(firstEp).padStart(2, '0');
        
        const ep1Url = `/yt/${data.channelSlug}/${data.gameSlug}/season-${Math.floor(s.seasonNum)}/${data.shortPrefix}-s${paddedSeason}e${paddedEp}.html`;
        const seasonUrl = `/yt/${data.channelSlug}/${data.gameSlug}/season-${Math.floor(s.seasonNum)}/`;
        const ytPlaylistUrl = `https://www.youtube.com/playlist?list=${s.id}`;
        
        const viewsFormatted = formatViews(s.totalViews);
        const thumbUrl = s.firstVideoId ? `https://i.ytimg.com/vi/${s.firstVideoId}/maxresdefault.jpg` : '/assets/img/default-thumbnail.jpg';

        html += `
    <div class="panel filterable-card" data-updated="${s.lastUpdatedFormatted}">
      
      <div class="panel-header">
        <span class="label">Season ${s.seasonNum}</span>
        <a href="${ytPlaylistUrl}" target="_blank" rel="noopener noreferrer" class="yt-header-link" style="display: flex; align-items: center; gap: 4px; color: var(--text); text-decoration: none; font-size: 0.9rem;">
          <span class="material-symbols-outlined" style="color: var(--red); font-size: 20px;">play_circle</span> YouTube
        </a>
      </div>
      
      <a href="${ep1Url}" class="content" title="Play Episode 1">
        <img src="${thumbUrl}" alt="${safeTitle} S${s.seasonNum}">
        <div class="content-row">
          <strong style="font-size: 1.1rem; line-height: 1.3; margin: 0;">${safeTitle} S${s.seasonNum}</strong>
          <span class="card-status ${s.statusColor}">${s.status}</span>
        </div>
      </a>
      
      <a href="${seasonUrl}" class="info" title="View Season Details">
        <div class="info-stats">
          <span><span class="material-symbols-outlined" style="color: var(--red); font-size: 16px; vertical-align: text-bottom;">video_library</span> ${s.epCount} videos</span>
          <span><span class="material-symbols-outlined" style="color: var(--blue); font-size: 16px; vertical-align: text-bottom;">visibility</span> ${viewsFormatted} views</span>
          <span class="card-duration">
            <span class="dur-full"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 16px; vertical-align: text-bottom;">schedule</span> ${s.durFull}</span>
            <span class="dur-short"><span class="material-symbols-outlined" style="color: var(--purple); font-size: 16px; vertical-align: text-bottom;">schedule</span> ${s.durShort}</span>
          </span>
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