// --- EPISODE TEMPLATES ---
export function episodePageHTML(data) {
    const safeThumbnail = data.thumbnail || `https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg`;
    const escapedTitle = data.title.replace(/"/g, '\\"');
    const epNumPadded = String(data.episodeNum).padStart(3, '0');

    return `---
layout: watch
title: "${epNumPadded} ${data.seriesTitle}"
description: "${data.seriesTitle} Let's Play Season ${data.seasonNum} Episode ${data.episodeNum}"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/season-${Math.floor(data.seasonNum)}/${data.fileName}
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
permalink: /yt/${data.channelSlug}/${data.gameSlug}/season-${Math.floor(data.seasonNum)}/
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

    {%- assign ep_pages = site.pages | where_exp: "item", "item.url contains '/yt/${data.channelSlug}/${data.gameSlug}/season-${Math.floor(data.seasonNum)}/'" | where_exp: "item", "item.name != 'index.html'" | sort: "title" -%}
    
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
            
            const sFolder = `season-${Math.floor(season.seasonNum)}`;
            const paddedSeason = String(Math.floor(season.seasonNum)).padStart(2, '0');

            if (season.epCount <= 5) {
                season.episodes.forEach((ep, index) => {
                    const paddedEp = String(ep).padStart(2, '0');
                    html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${sFolder}/${data.shortPrefix}-s${paddedSeason}e${paddedEp}.html" class="btn">Ep ${ep}</a>\n`;
                    if (index < season.epCount - 1) html += `    <span class="ep-delimiter">•</span>\n`;
                });
            } else {
                const firstEp = season.episodes[0];
                const lastEp = season.episodes[season.epCount - 1];
                
                const paddedFirstEp = String(firstEp).padStart(2, '0');
                const paddedLastEp = String(lastEp).padStart(2, '0');

                html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${sFolder}/${data.shortPrefix}-s${paddedSeason}e${paddedFirstEp}.html" class="btn">Ep ${firstEp}</a>\n`;
                html += `    <span class="ep-delimiter">•</span>\n`;
                html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${sFolder}/" class="btn" style="flex: 1 1 auto; font-weight: bold;">View All ${season.epCount}</a>\n`;
                html += `    <span class="ep-delimiter">•</span>\n`;
                html += `    <a href="/yt/${data.channelSlug}/${data.gameSlug}/${sFolder}/${data.shortPrefix}-s${paddedSeason}e${paddedLastEp}.html" class="btn">Ep ${lastEp}</a>\n`;
            }
            html += `  </div>\n`;
        }
        html += `</div>\n`;
    });

    html += `  </div>\n</div>`;
    return html;
}

export function channelRootHTML(data) {
    const hasMultipleChannels = data.channels.length > 1;

    let html = `---
layout: new
title: "${data.hubSlug} - Games Directory"
permalink: /yt/${data.hubSlug}/
custom_css: "/css/game.css"
---

<div class="game-page-wrapper">
  {% include_relative _manual/index.html %}

  <div style="margin-bottom: 20px;">
    <h1 class="title">${data.hubSlug}</h1>
    <p class="subtitle">Channel Directory</p>
  </div>
`;

    // 1. Inject the Toggle Buttons if it's the Umbrella Hub
    if (hasMultipleChannels) {
        html += `
  <div class="channel-filters" style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
    <button class="btn active filter-btn" data-target="all" onclick="filterChannel('all')">All Games</button>
`;
        data.channels.forEach(ch => {
            html += `    <button class="btn btn-gray filter-btn" data-target="${ch.channelSlug}" onclick="filterChannel('${ch.channelSlug}')">${ch.channelSlug}</button>\n`;
        });
        html += `  </div>\n`;
    }

    html += `  <div class="season-grid" id="directoryGrid">\n`;

    // 2. Output the games with a data-channel tag so the JS knows what to hide
    data.channels.forEach(channel => {
        channel.games.forEach(game => {
            // Hardcode the physical channel path so ltg-plus games always route correctly
            const gameUrl = `/yt/${channel.channelSlug}/${game.slug}/`;
            
            html += `    <div class="season-block game-item" data-channel="${channel.channelSlug}" style="padding: 20px; border: 1px solid var(--gray); border-radius: 8px;">
      <h3 style="margin-top: 0; margin-bottom: 10px;"><a href="${gameUrl}" style="color: var(--text); text-decoration: none;">${game.title}</a></h3>
      <a href="${gameUrl}" class="btn btn-gray" style="display: inline-block;">View Series</a>
      <div style="margin-top: 15px; font-size: 0.75rem; color: var(--gray); text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">📺 ${channel.channelSlug}</div>
    </div>\n`;
        });
    });

    html += `  </div>\n</div>\n`;

    // 3. Inject the Vanilla JS logic
    if (hasMultipleChannels) {
        html += `
<script>
  function filterChannel(targetSlug) {
    // Update button visual states
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
      if (btn.getAttribute('data-target') === targetSlug) {
        btn.classList.add('active');
        btn.classList.remove('btn-gray');
      } else {
        btn.classList.remove('active');
        btn.classList.add('btn-gray');
      }
    });

    // Instantly hide/show the grid items
    const items = document.querySelectorAll('.game-item');
    items.forEach(item => {
      if (targetSlug === 'all' || item.getAttribute('data-channel') === targetSlug) {
        item.style.display = 'block'; // Or 'flex' depending on your CSS
      } else {
        item.style.display = 'none';
      }
    });
  }
</script>
`;
    }

    return html;
}