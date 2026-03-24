export function episodeHTML(data) {
    const safeThumbnail = data.thumbnail || `https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg`;
    // Escape quotes so the JSON-LD schema doesn't break
    const escapedTitle = data.title.replace(/"/g, '\\"');
    const epNumPadded = String(data.episodeNum).padStart(3, '0');

    return `---
layout: watch
title: "${epNumPadded} ${data.seriesTitle}"
description: "${data.seriesTitle} Let's Play Season ${data.seasonNum} Episode ${data.episodeNum}"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/season-${data.seasonNum}/${data.fileName}
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
      
      ${data.manualContent}
  </div>
</div>`;
}