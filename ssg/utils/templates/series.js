export function seriesHTML(data) {
    let html = `---
layout: new
title: "${data.seriesTitle}"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/
custom_css: "/css/game.css"
sync_date: "${data.syncDate}"
---

<div class="game-page-wrapper">
  {% include_relative _manual/index.html %}

  <div class="season-grid">\n`;

    data.seasons.forEach(season => {
        html += `\n<div class="season-block">\n`;
        html += `  <div class="season-header">\n`;
        html += `    <span class="season-label">Season ${season.seasonNum}</span>\n`;
        html += `  </div>\n`;
        
        // Playlist Card HTML (Links directly to the YouTube playlist)
        html += `  <a href="https://www.youtube.com/watch?v=${season.firstVideoId}&list=${season.id}" target="_blank" rel="noopener noreferrer" class="filterable-card">\n`;
        html += `    <div class="game-card" data-updated="${season.lastUpdatedFormatted}" data-episodes="${season.epCount}" data-views="${season.totalViews}" data-duration="${season.totalDuration}">\n`;
        
        const thumbUrl = season.firstVideoId ? `https://i.ytimg.com/vi/${season.firstVideoId}/maxresdefault.jpg` : '/assets/img/default-thumbnail.jpg';
        html += `      <img src="${thumbUrl}" alt="${season.title}">\n`;
        
        html += `      <div class="card-row">\n        <strong>${season.title}</strong>\n        <span class="card-status ${season.statusColor}">${season.status}</span>\n      </div>\n`;
        html += `      <div class="card-row">\n        <span>${season.epCount} videos</span>\n        <span>${season.totalViews.toLocaleString()} views</span>\n        <span class="card-duration">\n          <span class="dur-full">⏱ ${season.durFull}</span>\n          <span class="dur-short">⏱ ${season.durShort}</span>\n        </span>\n      </div>\n`;
        html += `    </div>\n  </a>\n`;

        // The Episode Pills (Link to the local SSG pages)
        if (season.epCount > 0) {
            html += `  <div class="ep-pill-container">\n`;
            
            const seasonPath = `season-${Math.floor(season.seasonNum)}`;
            const paddedSeason = String(Math.floor(season.seasonNum)).padStart(2, '0');

            if (season.epCount <= 5) {
                // If 5 or fewer episodes, show all of them
                season.episodes.forEach((ep, index) => {
                    const paddedEp = String(ep).padStart(2, '0');
                    html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${seasonPath}/${data.shortPrefix}-s${paddedSeason}e${paddedEp}.html" class="btn">Ep ${ep}</a>\n`;
                    if (index < season.epCount - 1) html += `    <span class="ep-delimiter">•</span>\n`;
                });
            } else {
                // If more than 5, show First Ep -> View All -> Last Ep
                const firstEp = season.episodes[0];
                const lastEp = season.episodes[season.epCount - 1];
                
                const paddedFirstEp = String(firstEp).padStart(2, '0');
                const paddedLastEp = String(lastEp).padStart(2, '0');

                html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${seasonPath}/${data.shortPrefix}-s${paddedSeason}e${paddedFirstEp}.html" class="btn">Ep ${firstEp}</a>\n`;
                html += `    <span class="ep-delimiter">•</span>\n`;
                html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${seasonPath}/" class="btn" style="flex: 1 1 auto; font-weight: bold;">View All ${season.epCount}</a>\n`;
                html += `    <span class="ep-delimiter">•</span>\n`;
                html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${seasonPath}/${data.shortPrefix}-s${paddedSeason}e${paddedLastEp}.html" class="btn">Ep ${lastEp}</a>\n`;
            }
            html += `  </div>\n`;
        }
        html += `</div>\n`;
    });

    html += `  </div>\n</div>`;
    return html;
}