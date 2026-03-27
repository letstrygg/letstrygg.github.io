export function episodeHTML(data) {
    const safeThumbnail = data.thumbnail || `https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg`;
    const escapedTitle = data.title.replace(/"/g, '\\"');
    const epNumPadded = String(data.episodeNum).padStart(3, '0');

    // 1. Format YouTube Game Tags
    const ytTagsHtml = data.tags && data.tags.length > 0 
        ? data.tags.map(t => `<a href="/yt/tags/${t.slug}/" class="btn interactive text-sm" style="padding: 2px 12px; border-radius: 15px; border: 1px solid var(--border); background: rgba(0,0,0,0.2); color: var(--text-muted); margin-right: 6px; margin-bottom: 6px; display: inline-block; text-decoration: none; white-space: nowrap;">#${t.name}</a>`).join('')
        : '';

    // 2. Fetch the Tag Groups from the parser
    const g = data.adminTagGroups || { character: [], manual: [], card: [], enchantment: [], relic: [] };

    // 3. Assemble the Rows
    const row1 = ytTagsHtml + (g.character || []).join('') + (g.manual || []).join('');
    const row2 = (g.card || []).join('');
    const row3 = (g.enchantment || []).join('');
    const row4 = (g.relic || []).join('');

    let allTagsHtml = '<div class="tags-container" style="margin-bottom: 25px;">';
    
    if (row1) {
        allTagsHtml += `<div class="tag-row row-top" style="margin-bottom: 12px; display: flex; flex-wrap: wrap; align-items: center;">${row1}</div>`;
    }
    if (row2) {
        allTagsHtml += `<div class="tag-row row-cards" style="margin-bottom: 12px; border-top: 1px solid var(--border, #333); padding-top: 10px;">
            <div style="font-size: 0.75em; color: gray; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Cards</div>
            <div style="display: flex; flex-wrap: wrap;">${row2}</div>
        </div>`;
    }
    if (row3) {
        allTagsHtml += `<div class="tag-row row-enchants" style="margin-bottom: 12px; border-top: 1px solid var(--border, #333); padding-top: 10px;">
            <div style="font-size: 0.75em; color: gray; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Enchantments</div>
            <div style="display: flex; flex-wrap: wrap;">${row3}</div>
        </div>`;
    }
    if (row4) {
        allTagsHtml += `<div class="tag-row row-relics" style="margin-bottom: 12px; border-top: 1px solid var(--border, #333); padding-top: 10px;">
            <div style="font-size: 0.75em; color: gray; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Relics</div>
            <div style="display: flex; flex-wrap: wrap;">${row4}</div>
        </div>`;
    }
    
    allTagsHtml += '</div>';

    if (!row1 && !row2 && !row3 && !row4) allTagsHtml = '';

    // Combine Meta Strings for Schema
    let combinedTagsString = data.tagsString || '';
    if (data.adminTagsMeta) {
        combinedTagsString = combinedTagsString ? `${combinedTagsString}, ${data.adminTagsMeta}` : data.adminTagsMeta;
    }

    const safeConfigStr = data.clientTagConfigStr || '{}';

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

  <script>window.LTG_TAG_CONFIG = ${safeConfigStr};</script>
  {% include admin_panel.html %}

  <div class="manual-content">
      <h1 class="title" style="font-size: 1.8rem; margin-bottom: 5px;">{{ page.title }}</h1>
      <p class="subtitle" style="margin-bottom: 20px;">Season ${data.seasonNum}, Episode ${data.episodeNum}</p>
      
      ${data.manualContent}
  </div>
</div>`;
}