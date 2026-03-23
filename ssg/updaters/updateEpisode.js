import { getFullEpisodeContext, getAdjacentEpisodes } from '../utils/db.js';
import { writeStaticPage, checkFileExists } from '../utils/fileSys.js';
import { episodePageHTML } from '../utils/templates.js'; 

export async function updateEpisode(videoId) {
    // 1. Fetch DB Context
    const video = await getFullEpisodeContext(videoId);
    const junction = video.ltg_playlist_videos[0];
    const playlist = junction.ltg_playlists;
    const series = playlist.ltg_series;
    const gameSlug = series.ltg_games?.slug || series.slug;
    const channelSlug = playlist.channel_slug;

    const { prevSortOrder, nextSortOrder } = await getAdjacentEpisodes(playlist.id, junction.sort_order);

    // 2. Formatting Helpers
    const formatDuration = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
    };

    const isoDuration = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        return `PT${h > 0 ? h + 'H' : ''}${m > 0 ? m + 'M' : ''}${s}S`;
    };

    const shortPrefix = series.slug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    const fileName = `${shortPrefix}-ep-${junction.sort_order}.html`;
    const basePath = `yt/${channelSlug}/${gameSlug}/s${Math.floor(playlist.season)}`;

    // 3. Assemble the Data Payload
    const templateData = {
        id: video.id,
        title: video.title,
        views: video.view_count,
        likes: video.likes,
        comments: video.comments,
        durationFormatted: formatDuration(video.duration_seconds),
        isoDuration: isoDuration(video.duration_seconds),
        publishedAt: new Date(video.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        rawPublishedAt: video.published_at,
        episodeNum: junction.sort_order,
        seasonNum: playlist.season,
        seriesTitle: series.title,
        gameSlug: gameSlug,
        channelSlug: channelSlug,
        shortPrefix: shortPrefix,
        fileName: fileName,
        prevUrl: prevSortOrder ? `/yt/${channelSlug}/${gameSlug}/s${Math.floor(playlist.season)}/${shortPrefix}-ep-${prevSortOrder}.html` : null,
        nextUrl: nextSortOrder ? `/yt/${channelSlug}/${gameSlug}/s${Math.floor(playlist.season)}/${shortPrefix}-ep-${nextSortOrder}.html` : null
    };

    // 4. Write the Files
    const mainFilePath = `${basePath}/${fileName}`;
    const manualFilePath = `${basePath}/_manual/${fileName}`;
    
    // Always overwrite the main page with fresh stats, frontmatter, and structure
    const pageHTML = episodePageHTML(templateData);
    writeStaticPage(mainFilePath, pageHTML);

    // Only generate the manual fragment if it doesn't exist
    if (!checkFileExists(manualFilePath)) {
        writeStaticPage(manualFilePath, "\n");
        console.log(`    [CREATED MANUAL FRAGMENT] ${manualFilePath}`);
    }

    return {
        success: true,
        filePath: mainFilePath,
        playlistId: playlist.id,
        seriesSlug: series.slug
    };
}