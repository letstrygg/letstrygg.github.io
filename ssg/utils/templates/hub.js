export function hubHTML(networkData) {
    // Helper functions scoped to the template generation
    const formatViews = (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toLocaleString();
    };

    const formatDuration = (seconds) => {
    if (!seconds) return '0s'; // Or '0h', depending on your preference for zero
    
    if (seconds < 60) {
        return `${seconds.toLocaleString()}s`;
    }
    if (seconds < 3600) {
        const m = Math.floor(seconds / 60);
        return `${m.toLocaleString()}m`;
    }
    const h = Math.floor(seconds / 3600);
    return `${h.toLocaleString()}h`;
};

    let html = `---
layout: new
title: "LTG Network Directory"
permalink: /yt/
custom_css: "/css/home.css"
---

<div class="game-page-wrapper">
  ${networkData.manualContent}

  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 30px; border-bottom: 1px solid var(--gray); padding-bottom: 15px;">
    <div>
      <h1 class="title">LTG Network</h1>
      <p class="subtitle" style="margin: 0;">Select a channel to view its game directory</p>
    </div>
    <div style="text-align: right; font-size: 0.9em; color: var(--gray);">
        <div><strong>Total Network Scope</strong></div>
        <div>${networkData.totalGames} Games • ${networkData.totalVideos.toLocaleString()} Videos</div>
        <div>${formatViews(networkData.totalViews)} Views • ${formatDuration(networkData.totalDuration)}</div>
    </div>
  </div>

  <div class="channel-card-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px;">
`;

    networkData.channels.forEach(ch => {
        const vpv = ch.videos > 0 ? Math.round(ch.views / ch.videos) : 0;
        const avgVideosPerGame = ch.games > 0 ? Math.round(ch.videos / ch.games) : 0;
        const targetUrl = `/yt/${ch.slug}/`;

        html += `
    <div class="channel-directory-card" style="background: #111; border: 1px solid #333; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;">
        <div style="padding: 20px; background: #1a1a1a; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; text-transform: capitalize;"><a href="${targetUrl}" style="color: var(--text); text-decoration: none;">${ch.slug}</a></h2>
            <a href="${targetUrl}" class="btn">View Directory</a>
        </div>

        <div class="channel-stats-container" style="padding: 20px; position: relative;">
            
            <div class="stats-basic" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <div style="font-size: 0.8em; color: var(--gray); text-transform: uppercase;">Library</div>
                    <div style="font-size: 1.2em; font-weight: bold;">${ch.games} <span style="font-size: 0.7em; font-weight: normal; color: var(--gray);">Games</span></div>
                    <div style="font-size: 1.2em; font-weight: bold;">${ch.videos.toLocaleString()} <span style="font-size: 0.7em; font-weight: normal; color: var(--gray);">Videos</span></div>
                </div>
                <div>
                    <div style="font-size: 0.8em; color: var(--gray); text-transform: uppercase;">Performance</div>
                    <div style="font-size: 1.2em; font-weight: bold; color: var(--blue);">${formatViews(ch.views)} <span style="font-size: 0.7em; font-weight: normal; color: var(--gray);">Views</span></div>
                    <div style="font-size: 1.2em; font-weight: bold; color: var(--orange);">${formatViews(vpv)} <span style="font-size: 0.7em; font-weight: normal; color: var(--gray);">VPV</span></div>
                </div>
            </div>

            <div class="stats-advanced" style="display: none; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9em;">
                <div>
                    <div style="color: var(--gray); margin-bottom: 5px; border-bottom: 1px solid #333;">Averages</div>
                    <div><strong>${avgVideosPerGame}</strong> vids per game</div>
                    <div><strong>${formatDuration(ch.duration / (ch.games || 1))}</strong> per game</div>
                    <div><strong>${formatDuration(ch.duration / (ch.videos || 1))}</strong> per video</div>
                </div>
                <div>
                    <div style="color: var(--gray); margin-bottom: 5px; border-bottom: 1px solid #333;">Totals</div>
                    <div><strong>${ch.seasons}</strong> Total Playlists</div>
                    <div><strong>${formatDuration(ch.duration)}</strong> Total Duration</div>
                </div>
            </div>
            
            <button class="btn btn-gray toggle-stats-btn" style="width: 100%; margin-top: 20px; font-size: 0.8em;" onclick="toggleChannelStats(this)">Show Advanced Stats</button>
        </div>
    </div>\n`;
    });

    html += `  </div>
</div>

<script>
function toggleChannelStats(btn) {
    const container = btn.closest('.channel-stats-container');
    const basic = container.querySelector('.stats-basic');
    const adv = container.querySelector('.stats-advanced');
    
    if (adv.style.display === 'none') {
        basic.style.display = 'none';
        adv.style.display = 'grid';
        btn.innerText = 'Show Basic Stats';
        btn.classList.add('active');
    } else {
        basic.style.display = 'grid';
        adv.style.display = 'none';
        btn.innerText = 'Show Advanced Stats';
        btn.classList.remove('active');
    }
}
</script>
`;

    return html;
}