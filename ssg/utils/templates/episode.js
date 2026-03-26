export function episodeHTML(data) {
    const safeThumbnail = data.thumbnail || `https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg`;
    const escapedTitle = data.title.replace(/"/g, '\\"');
    const epNumPadded = String(data.episodeNum).padStart(3, '0');

    // Combine Game Tags and parsed Admin Tags
    const ytTagsHtml = data.tags && data.tags.length > 0 
        ? data.tags.map(t => `<a href="/yt/tags/${t.slug}/" class="btn btn-gray interactive text-sm" style="padding: 4px 12px; border-radius: 15px; border-color: var(--border);">#${t.name}</a>`).join('\n')
        : '';
        
    const allTagsHtml = (ytTagsHtml || data.adminTagsHtml) 
        ? `<div class="flex-row flex-wrap" style="gap: 8px; margin-bottom: 25px;">
             ${ytTagsHtml}
             ${data.adminTagsHtml || ''}
           </div>` 
        : '';

    // Combine Meta Strings 
    let combinedTagsString = data.tagsString || '';
    if (data.adminTagsMeta) {
        combinedTagsString = combinedTagsString ? `${combinedTagsString}, ${data.adminTagsMeta}` : data.adminTagsMeta;
    }

    return `---
layout: watch
title: "${epNumPadded} ${data.seriesTitle}"
description: "${data.seriesTitle} Let's Play Season ${data.seasonNum} Episode ${data.episodeNum}"
permalink: /yt/${data.channelSlug}/${data.gameSlug}/season-${data.seasonNum}/${data.fileName}
custom_css: "/css/game/${data.shortPrefix}-style.css"
thumbnail: "${safeThumbnail}"
upload_date: "${data.rawPublishedAt}"
duration_seconds: ${data.durationSeconds}
tags: "${combinedTagsString}"
youtube_id: "${data.id}"
game_slug: "${data.gameSlug}"
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
  "embedUrl": "https://www.youtube.com/embed/${data.id}",
  "keywords": "${combinedTagsString}",
  "interactionStatistic": {
    "@type": "InteractionCounter",
    "interactionType": { "@type": "WatchAction" },
    "userInteractionCount": ${data.views}
  }
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

  ${allTagsHtml}

  {% include admin_panel.html %}

  <div class="manual-content">
      <h1 class="title" style="font-size: 1.8rem; margin-bottom: 5px;">{{ page.title }}</h1>
      <p class="subtitle" style="margin-bottom: 20px;">Season ${data.seasonNum}, Episode ${data.episodeNum}</p>
      
      ${data.manualContent}
  </div>
</div>`;
}