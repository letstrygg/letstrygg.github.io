export function channelHTML(data) {
    const isParent = data.channels.length > 1;
    
    // Calculate stats for the animation cards
    let letstryggCount = 0, plusCount = 0;
    if (isParent) {
        data.channels.forEach(ch => {
            if (ch.channelSlug === 'letstrygg') letstryggCount = ch.games.length;
            if (ch.channelSlug === 'ltg-plus') plusCount = ch.games.length;
        });
    }

    let html = `---
layout: new
title: "${data.hubSlug} - Games Directory"
permalink: /yt/${data.hubSlug}/
custom_css: "/css/home.css"
---

<style>
/* Flexbox Merge/Split Animation Styles */
.channel-split-container {
    display: flex; gap: 20px; width: 100%; margin-bottom: 30px;
    transition: gap 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}
.anim-card {
    border: 2px solid #333; border-radius: 12px; background: #1a1a1a;
    overflow: hidden; white-space: nowrap; display: flex; flex-direction: column;
    justify-content: center; align-items: center; user-select: none;
    transition: flex 0.5s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s ease, 
                padding 0.5s cubic-bezier(0.25, 1, 0.5, 1), border-width 0.5s ease;
}
.anim-card:hover { background: #222; }

/* STATE: COMBINED */
.state-combined .card-combined { flex: 1; opacity: 1; padding: 30px; border-color: var(--green); }
.state-combined .card-split { flex: 0; opacity: 0; padding: 0; border-width: 0; pointer-events: none; }
.state-combined { gap: 0; }

/* STATE: SPLIT */
.state-split .card-combined { flex: 0; opacity: 0; padding: 0; border-width: 0; pointer-events: none; }
.state-split .card-split { flex: 1; opacity: 1; padding: 30px; }
.state-split { gap: 20px; }

/* Active Filter State for Split Cards */
.card-split.active-filter { border-color: var(--green); background: #222; }
</style>

<div class="game-page-wrapper">
  {% include_relative _manual/index.html %}
`;

    // 1. Inject the Animated Header (Only for the Parent Channel)
    if (isParent) {
        html += `
  <div class="channel-split-container state-combined" id="networkToggleContainer">
      <div class="anim-card card-combined" onclick="toggleNetworkState('split', 'all')" style="cursor: pointer;">
          <h2 style="margin: 0 0 5px 0;">Let's Try GG Network</h2>
          <p style="margin: 0; color: var(--gray);">Click to split by channel</p>
      </div>

      <div class="anim-card card-split" id="card-letstrygg" onclick="toggleNetworkState('split', 'letstrygg')" style="cursor: pointer;">
          <h2 style="margin: 0 0 5px 0;">Letstrygg</h2>
          <p style="margin: 0; color: var(--gray);">${letstryggCount} Games</p>
      </div>

      <div class="anim-card card-split" id="card-ltg-plus" onclick="toggleNetworkState('split', 'ltg-plus')" style="cursor: pointer; border-color: #ff8888;">
          <h2 style="margin: 0 0 5px 0; color: #ff8888;">LTG Plus</h2>
          <p style="margin: 0; color: var(--gray);">${plusCount} Games</p>
      </div>
      
      <div class="anim-card card-split" onclick="toggleNetworkState('combined', 'all')" style="cursor: pointer; flex: 0.15; border-color: var(--gray);">
          <span class="material-symbols-outlined" style="font-size: 24px; color: var(--gray);">close_fullscreen</span>
      </div>
  </div>
`;
    } else {
        html += `
  <div style="margin-bottom: 30px; border-bottom: 1px solid var(--gray); padding-bottom: 15px;">
    <h1 class="title" style="text-transform: capitalize;">${data.hubSlug}</h1>
    <p class="subtitle" style="margin: 0;">Channel Directory</p>
  </div>
`;
    }

    // 2. The Game Grid (We will just output the basic links for now, 
    // but you can swap your rich card templates back in here anytime!)
    html += `  <div class="season-grid" id="directoryGrid">\n`;

    data.channels.forEach(channel => {
        channel.games.forEach(game => {
            const gameUrl = `/yt/${channel.channelSlug}/${game.slug}/`;
            html += `    <div class="season-block game-item" data-channel="${channel.channelSlug}" style="padding: 20px; border: 1px solid var(--gray); border-radius: 8px;">
      <h3 style="margin-top: 0; margin-bottom: 10px;"><a href="${gameUrl}" style="color: var(--text); text-decoration: none;">${game.title}</a></h3>
      <a href="${gameUrl}" class="btn btn-gray" style="display: inline-block;">View Series</a>
      <div style="margin-top: 15px; font-size: 0.75rem; color: var(--gray); text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">📺 ${channel.channelSlug}</div>
    </div>\n`;
        });
    });

    html += `  </div>\n</div>\n`;

    // 3. The Interactive Logic
    if (isParent) {
        html += `
<script>
function toggleNetworkState(targetState, filterSlug) {
    const container = document.getElementById('networkToggleContainer');
    const items = document.querySelectorAll('.game-item');
    const cLets = document.getElementById('card-letstrygg');
    const cPlus = document.getElementById('card-ltg-plus');
    
    // 1. Handle the CSS Animation State
    if (targetState === 'split') {
        container.classList.remove('state-combined');
        container.classList.add('state-split');
    } else {
        container.classList.remove('state-split');
        container.classList.add('state-combined');
    }

    // 2. Handle the Visual Active States on the Split Cards
    cLets.classList.remove('active-filter');
    cPlus.classList.remove('active-filter');
    if (filterSlug === 'letstrygg') cLets.classList.add('active-filter');
    if (filterSlug === 'ltg-plus') cPlus.classList.add('active-filter');

    // 3. Filter the Grid
    items.forEach(item => {
        if (filterSlug === 'all' || item.getAttribute('data-channel') === filterSlug) {
            item.style.display = 'block'; 
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