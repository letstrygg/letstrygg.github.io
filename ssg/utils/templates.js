// --- EPISODE TEMPLATES ---
export function episodePageHTML(data) {
    const safeThumbnail = data.thumbnail || `https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg`;
    const escapedTitle = data.title.replace(/"/g, '\\"');
    const epNumPadded = String(data.episodeNum).padStart(3, '0');

    return `---
layout: watch
title: "${epNumPadded} ${data.seriesTitle}"
description: "${data.seriesTitle} Let's Play Season ${data.seasonNum} Episode ${data.episodeNum}"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/s${Math.floor(data.seasonNum)}/${data.fileName}
custom_css: "/css/game/${data.shortPrefix}-style.css"
thumbnail: "${safeThumbnail}"
sync_date: "${data.rawPublishedAt}"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "${escapedTitle}",
  "description": "Episode ${data.episodeNum} of the ${data.seriesTitle} Let's Play series.",
  "thumbnailUrl": "${safeThumbnail}",
  "uploadDate": "${data.rawPublishedAt}",
  "duration": "${data.isoDuration}",
  "embedUrl": "https://www.youtube.com/embed/${data.id}"
}
</script>

<div class="game-page-wrapper">
  {% include watch_player.html 
      video_id="${data.id}"
      published="${data.publishedAt}"
      duration="${data.durationFormatted}"
      views="${data.views.toLocaleString()}"
      likes="${data.likes.toLocaleString()}"
      comments="${data.comments.toLocaleString()}"
      prev_url="${data.prevUrl || ''}"
      next_url="${data.nextUrl || ''}"
  %}

  <div class="manual-content">
      <h1 class="title" style="font-size: 1.8rem; margin-bottom: 5px;">{{ page.title }}</h1>
      <p class="subtitle" style="margin-bottom: 20px;">Season ${data.seasonNum}, Episode ${data.episodeNum}</p>
      
      {% include_relative _manual/${data.fileName} %}
  </div>
</div>`;
}

// --- SEASON TEMPLATES ---
export function seasonIndexHTML(data) {
    return `---
layout: new
title: "Season ${data.seasonNum} Episodes - ${data.seriesTitle}"
description: "A complete list of episodes from Season ${data.seasonNum} of the ${data.seriesTitle} Let's Play."
permalink: /yt/${data.channelSlug}/${data.gameSlug}/s${Math.floor(data.seasonNum)}/
custom_css: "/css/game/${data.shortPrefix}-style.css"
sync_date: "${data.syncDate}"
---

<div class="game-page-wrapper">
  <div style="display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <h1 class="title">${data.seriesTitle}</h1>
      <p class="subtitle">Season ${data.seasonNum} Episodes</p>
    </div>
    <button class="btn btn-gray" onclick="toggleEpSort()" title="Reverse Order">
      <span class="material-symbols-outlined" id="sortIcon">arrow_downward</span> Sort
    </button>
  </div>

  <div class="game-section">
    {% include_relative _manual/index.html %}

    {%- assign ep_pages = site.pages | where_exp: "item", "item.url contains '/yt/${data.channelSlug}/${data.gameSlug}/s${Math.floor(data.seasonNum)}/'" | where_exp: "item", "item.url contains '-ep-'" | sort: "title" -%}
    
    <div id="epGrid" class="ep-grid">
    {%- for ep in ep_pages -%}
      <a href="{{ ep.url | relative_url }}">
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
    const items = Array.from(epGrid.children);
    items.reverse();
    epGrid.innerHTML = '';
    items.forEach(item => epGrid.appendChild(item));
  }
</script>`;
}

// --- SERIES TEMPLATES ---
export function seriesRootHTML(data) {
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
        const sFolder = `s${Math.floor(season.seasonNum)}`;
        
        html += `\n<div class="season-block">\n`;
        html += `  <div class="season-header">\n`;
        html += `    <span class="season-label">Season ${season.seasonNum}</span>\n`;
        html += `  </div>\n`;
        
        // Playlist Card HTML
        html += `  <a href="https://www.youtube.com/watch?v=${season.firstVideoId}&list=${season.id}" target="_blank" rel="noopener noreferrer" class="filterable-card">\n`;
        html += `    <div class="game-card" data-updated="${season.lastUpdatedFormatted}" data-episodes="${season.epCount}" data-views="${season.totalViews}" data-duration="${season.totalDuration}">\n`;
        const thumbUrl = season.firstVideoId ? `https://i.ytimg.com/vi/${season.firstVideoId}/maxresdefault.jpg` : '/assets/img/default-thumbnail.jpg';
        html += `      <img src="${thumbUrl}" alt="${season.title}">\n`;
        html += `      <div class="card-row">\n        <strong>${season.title}</strong>\n        <span class="card-status ${season.statusColor}">${season.status}</span>\n      </div>\n`;
        html += `      <div class="card-row">\n        <span>${season.epCount} videos</span>\n        <span>${season.totalViews.toLocaleString()} views</span>\n        <span class="card-duration">\n          <span class="dur-full">⏱ ${season.durFull}</span>\n          <span class="dur-short">⏱ ${season.durShort}</span>\n        </span>\n      </div>\n`;
        html += `    </div>\n  </a>\n`;

        if (season.epCount > 0) {
            html += `  <div class="ep-pill-container">\n`;
            if (season.epCount <= 5) {
                season.episodes.forEach((ep, index) => {
                    html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${sFolder}/${data.shortPrefix}-ep-${ep}.html" class="btn">Ep ${ep}</a>\n`;
                    if (index < season.epCount - 1) html += `    <span class="ep-delimiter">•</span>\n`;
                });
            } else {
                const firstEp = season.episodes[0];
                const lastEp = season.episodes[season.epCount - 1];
                html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${sFolder}/${data.shortPrefix}-ep-${firstEp}.html" class="btn">Ep ${firstEp}</a>\n`;
                html += `    <span class="ep-delimiter">•</span>\n`;
                html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${sFolder}/" class="btn" style="flex: 1 1 auto; font-weight: bold;">View All ${season.epCount}</a>\n`;
                html += `    <span class="ep-delimiter">•</span>\n`;
                html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${sFolder}/${data.shortPrefix}-ep-${lastEp}.html" class="btn">Ep ${lastEp}</a>\n`;
            }
            html += `  </div>\n`;
        }
        html += `</div>\n`;
    });

    html += `  </div>\n</div>`;
    return html;
}