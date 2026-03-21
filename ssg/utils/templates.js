// ssg/utils/templates.js

export function watchPageAutoHTML(data) {
    const safeThumbnail = data.thumbnail || `https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg`;
    const escapedTitle = data.title.replace(/"/g, '\\"');

    // Pass the raw data to Jekyll via the include
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "${escapedTitle}",
  "description": "${data.seriesTitle} Let's Play Season ${data.seasonNum} Episode ${data.episodeNum}",
  "thumbnailUrl": "${safeThumbnail}",
  "uploadDate": "${data.rawPublishedAt}",
  "duration": "${data.isoDuration}",
  "embedUrl": "https://www.youtube.com/embed/${data.id}"
}
</script>

{% include watch_player.html 
    video_id="${data.id}"
    published="${data.publishedAt}"
    duration="${data.durationFormatted}"
    views="${data.views.toLocaleString()}"
    likes="${data.likes.toLocaleString()}"
    comments="${data.comments.toLocaleString()}"
    prev_url="${data.prevUrl || ''}"
    next_url="${data.nextUrl || ''}"
%}`;
}

export function watchPageManualHTML(data) {
    const epNumPadded = String(data.episodeNum).padStart(3, '0');
    const safeThumbnail = data.thumbnail || `https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg`;
    
    // Note: Updated the permalink to your new /yt/ structure
    return `---
layout: watch
title: "${epNumPadded} ${data.seriesTitle}"
description: "${data.seriesTitle} Let's Play Season ${data.seasonNum} Episode ${data.episodeNum}"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/s${Math.floor(data.seasonNum)}/${data.fileName}
custom_css: "/css/game/${data.shortPrefix}-style.css"
thumbnail: "${safeThumbnail}"
---

<div class="game-page-wrapper">
  {% include_relative _auto/${data.fileName} %}

  <div class="manual-content">
      <h1 class="title" style="font-size: 1.8rem; margin-bottom: 5px;">{{ page.title }}</h1>
      <p class="subtitle" style="margin-bottom: 20px;">Season ${data.seasonNum}, Episode ${data.episodeNum}</p>
  </div>
</div>`;
}