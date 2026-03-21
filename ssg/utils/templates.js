// The outer shell of the page (Header, Footer, Chat Panel)
function baseLayout(pageTitle, headMeta, mainContent) {
    return `<!DOCTYPE html>
<html lang="en" data-overlayscrollbars-initialize>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle} | letstrygg</title>
    ${headMeta}
    
    <link rel="stylesheet" href="/css/style.css">
    <link rel="stylesheet" href="/css/layout.css">
    <link rel="stylesheet" href="/css/colors.css">
    <link rel="stylesheet" href="/css/watch.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0"/>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/overlayscrollbars@2.14.0/styles/overlayscrollbars.min.css">
    
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script>
        window.SUPABASE_URL = 'https://fnwmtytnltmqjaflfwyr.supabase.co';
        window.SUPABASE_ANON_KEY = 'sb_publishable_y12qZF_dSbUPmV_aieiUgA_CibDsxQV';
    </script>
</head>
<body data-overlayscrollbars-initialize>

    <div class="fixed-layer pin-top pin-right flex-col-stack">
        <button id="themeToggleBtn" class="floating-btn tooltip-right" data-tooltip="Toggle Theme">
            <span id="theme-toggle-icon" class="material-symbols-outlined">bedtime</span>
        </button>
        <button id="openChatBtn" class="floating-btn tooltip-right mobile-pin-bottom-right" data-tooltip="Expand Chat" style="display: none;">
            <span class="material-symbols-outlined">chat_bubble</span>
            <span id="chat-online-count" class="chat-viewer-count" style="display: none;">0</span>
            <span id="chat-unread-dot" class="chat-unread-dot" style="display: none;"></span>
        </button>
    </div>

    <main>
        ${mainContent}
    </main>

    <link rel="stylesheet" href="/css/chat.css">
    <div id="chatPanel" class="chat-panel" style="background: var(--bg); border-left: 1px solid var(--border); display: flex; flex-direction: column; z-index: 1000;">
        <div class="chat-header" style="min-height: 50px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; padding: 0 10px; background: var(--bg);">
            <span style="font-weight: 600; font-size: 13px; color: var(--text); text-transform: uppercase;">Live Chat</span>
        </div>
        <div id="chatBox" style="flex-grow: 1; overflow-y: auto; padding: 10px; color: var(--text); background: var(--bg);">
            <em>Loading messages...</em>
        </div>
    </div>
    <script src="/js/chat.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/overlayscrollbars@2.14.0/browser/overlayscrollbars.browser.es6.min.js"></script>
</body>
</html>`;
}

// The specific HTML for an Episode Watch Page
export function buildEpisodeHtml(data) {
    // Format Episode Number (e.g., 17 -> "017")
    const epNumPadded = String(data.episodeNum).padStart(3, '0');
    const fullTitle = `${epNumPadded} ${data.seriesTitle}`;
    
    // Generate SEO Meta Tags
    const headMeta = `
    <meta name="title" content="${fullTitle}">
    <meta name="description" content="${data.seriesTitle} Let's Play Season ${data.seasonNum} Episode ${data.episodeNum}">
    <meta property="og:image" content="https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg">
    <meta property="twitter:image" content="https://i.ytimg.com/vi/${data.id}/maxresdefault.jpg">
    `;

    // Generate the inner page content
    const pageContent = `
    <div style="margin-top: 5px; margin-bottom: 5px;">
        <div class="breadcrumbs">
            <a href="/">letstrygg.com</a> <span style="margin: 0 10px; opacity: 0.5;">/</span>
            <a href="/yt/" class="breadcrumb-link">yt</a> <span style="margin: 0 10px; opacity: 0.5;">/</span>
            <a href="/yt/${data.channelSlug}/" class="breadcrumb-link">${data.channelSlug}</a> <span style="margin: 0 10px; opacity: 0.5;">/</span>
            <a href="/yt/${data.channelSlug}/${data.gameSlug}/" class="breadcrumb-link">${data.seriesTitle}</a> <span style="margin: 0 10px; opacity: 0.5;">/</span>
            <a href="/yt/${data.channelSlug}/${data.gameSlug}/s${data.seasonNum}/" class="breadcrumb-link">Season ${data.seasonNum}</a> <span style="margin: 0 10px; opacity: 0.5;">/</span>
            <strong class="breadcrumb-current">Ep ${epNumPadded}</strong>
        </div>
    </div>

    <div class="game-page-wrapper">
        <div class="game-section auto-generated-stats" style="margin-top: 0;">
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                <div style="width: 100%; max-width: calc((100vh - 75px) * 16 / 9);">
                    <div id="player-wrapper" style="position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; margin-bottom: 5px; z-index: 10;">
                        
                        <div id="video-overlay" class="video-overlay" style="z-index: 20;">
                            <div class="overlay-stats">
                                <span class="ep-stat"><span class="material-symbols-outlined yellow">calendar_month</span> ${data.publishedAt}</span>
                                <span class="ep-stat"><span class="material-symbols-outlined purple">schedule</span> ${data.durationFormatted}</span>
                                <span class="ep-stat"><span class="material-symbols-outlined blue">visibility</span> ${data.views}</span>
                                <span class="ep-stat"><span class="material-symbols-outlined green">thumb_up</span> ${data.likes}</span>
                            </div>
                        </div>

                        <iframe id="ytplayer" src="https://www.youtube.com/embed/${data.id}?enablejsapi=1&rel=0&modestbranding=1" frameborder="0" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;"></iframe>
                    </div>
                </div>
            </div>
        </div>

        <div class="manual-content">
            <h1 class="title" style="font-size: 1.8rem; margin-bottom: 5px;">${data.title}</h1>
            <p class="subtitle" style="margin-bottom: 20px;">Season ${data.seasonNum}, Episode ${data.episodeNum}</p>
        </div>
    </div>`;

    // Wrap the content in the base HTML layout
    return baseLayout(fullTitle, headMeta, pageContent);
}