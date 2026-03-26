import { getFullEpisodeContext, getAdjacentEpisodes } from '../utils/db.js';
import { writeStaticPage, checkFileExists } from '../utils/fileSys.js';
import { episodeHTML } from '../utils/templates/index.js'; 
import { processAdminTags } from '../utils/tagParser.js';

function slugify(text) {
    return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

export async function updateEpisode(videoId) {
    // 1. Fetch DB Context
    const video = await getFullEpisodeContext(videoId);
    const junction = video.ltg_playlist_videos[0];
    const playlist = junction.ltg_playlists;
    const series = playlist.ltg_series;
    const gameSlug = series.ltg_games?.slug || series.slug;
    const channelSlug = playlist.channel_slug;

    const { prevSortOrder, nextSortOrder } = await getAdjacentEpisodes(playlist.id, junction.sort_order);

    // --- GAME TAGS (Original) ---
    const rawTags = series.ltg_games?.tags || [];
    const tagsArr = rawTags.map(t => ({ name: t.trim(), slug: slugify(t) }));
    const tagsString = rawTags.join(', ');

    // --- ADMIN TAGS (New) ---
    // Grabs the text array from ltg_videos, runs it through our new config parser
    const adminTagsData = processAdminTags(video.tags || []);

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

    // --- PREFIX, PADDING, AND PATH LOGIC ---
    const dbAbbr = series.ltg_games?.custom_abbr;
    const shortPrefix = dbAbbr ? dbAbbr.toLowerCase() : gameSlug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    
    const paddedSeason = String(Math.floor(playlist.season)).padStart(2, '0');
    const paddedEp = String(junction.sort_order).padStart(2, '0');
    const fileName = `${shortPrefix}-s${paddedSeason}e${paddedEp}.html`;
    const basePath = `yt/${channelSlug}/${gameSlug}/season-${Math.floor(playlist.season)}`;

    const prevPaddedEp = prevSortOrder ? String(prevSortOrder).padStart(2, '0') : null;
    const nextPaddedEp = nextSortOrder ? String(nextSortOrder).padStart(2, '0') : null;

    // 3. Assemble the Data Payload
    const templateData = {
        id: video.id,
        title: video.title,
        views: video.view_count,
        likes: video.likes,
        comments: video.comments,
        durationFormatted: formatDuration(video.duration_seconds),
        durationSeconds: video.duration_seconds,
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
        tags: tagsArr,               
        tagsString: tagsString,      
        adminTagsHtml: adminTagsData.html,            // <-- ADDED
        adminTagsMeta: adminTagsData.metaString,      // <-- ADDED
        prevUrl: prevSortOrder ? `/yt/${channelSlug}/${gameSlug}/season-${Math.floor(playlist.season)}/${shortPrefix}-s${paddedSeason}e${prevPaddedEp}.html` : null,
        nextUrl: nextSortOrder ? `/yt/${channelSlug}/${gameSlug}/season-${Math.floor(playlist.season)}/${shortPrefix}-s${paddedSeason}e${nextPaddedEp}.html` : null
    };

    // 4. Write the Files
    const mainFilePath = `${basePath}/${fileName}`;
    const manualFilePath = `${basePath}/_manual/${fileName}`;
    
    const pageHTML = episodeHTML(templateData);
    writeStaticPage(mainFilePath, pageHTML);

    if (!checkFileExists(manualFilePath)) {
        writeStaticPage(manualFilePath, "\n");
        console.log(`    [CREATED MANUAL FRAGMENT] ${manualFilePath}`);
    }

    return { success: true, filePath: mainFilePath, playlistId: playlist.id, seriesSlug: series.slug };
}