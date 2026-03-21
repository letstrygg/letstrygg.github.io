import { getFullEpisodeContext } from '../utils/db.js';
import { writeStaticPage } from '../utils/fileSys.js';
import { buildEpisodeHtml } from '../utils/templates.js';

export async function updateEpisode(videoId) {
    // 1. Fetch all data via helper
    const video = await getFullEpisodeContext(videoId);
    
    // Data destructuring
    const junction = video.ltg_playlist_videos[0];
    const playlist = junction.ltg_playlists;
    const series = playlist.ltg_series;
    const gameSlug = series.ltg_games?.slug || series.slug;
    const channelSlug = playlist.channel_slug;

    // 2. Format Data 
    const formatDuration = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
    };

    const templateData = {
        id: video.id,
        title: video.title,
        views: video.view_count,
        likes: video.likes,
        durationFormatted: formatDuration(video.duration_seconds),
        publishedAt: new Date(video.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        episodeNum: junction.sort_order,
        seasonNum: playlist.season,
        seriesTitle: series.title,
        gameSlug: gameSlug,
        channelSlug: channelSlug
    };

    // 3. Generate the URL path
    const shortPrefix = series.slug.split('-').map(w => w[0]).join(''); 
    const fileName = `${shortPrefix}-ep-${templateData.episodeNum}.html`;
    const filePath = `yt/${channelSlug}/${gameSlug}/s${Math.floor(playlist.season)}/${fileName}`;

	// 4. Wrap it in HTML and save 
    const html = buildEpisodeHtml(templateData);
    writeStaticPage(filePath, html);

    // 5. Return the payload back to the Command Center
    return {
        success: true,
        filePath: filePath,
        playlistId: playlist.id, // Returned so update.js can trigger updateSeason later
        seriesSlug: series.slug
    };
}