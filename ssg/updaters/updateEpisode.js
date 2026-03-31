import fs from 'fs';
import { supabase, getFullEpisodeContext, getAdjacentEpisodes } from '../utils/db.js';
import { writeStaticPage, checkFileExists } from '../utils/fileSys.js';
import { episodeHTML } from '../utils/templates/index.js'; 
import { processAdminTags, getClientTagConfig } from '../utils/tagParser.js';
import { slugify, formatDuration, isoDuration } from '../utils/format.js';

export async function updateEpisode(videoId, options = {}) {
    // 1. Fetch DB Context
    const video = await getFullEpisodeContext(videoId);
    // ... (existing junction/playlist logic) ...

    // --- NEW: Fetch Runs for this Video ---
    const { data: runsData } = await supabase
        .from('ltg_sts2_runs')
        .select('run_number, character, win, ascension, floor_history')
        .eq('video_id', videoId)
        .order('run_number', { ascending: true });

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
    console.log(`\n[DEBUG] Video ID: ${video.id}`);

    // Merge manual tags and auto tags
    const mergedTags = [...(video.tags || []), ...(video.auto_tags || [])];
    const adminTagsData = processAdminTags(mergedTags);
    
    const clientTagConfig = getClientTagConfig(gameSlug); // <-- Grab the UI rules

    // --- PREFIX, PADDING, AND PATH LOGIC ---
    const dbAbbr = series.ltg_games?.custom_abbr;
    const shortPrefix = dbAbbr ? dbAbbr.toLowerCase() : gameSlug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    
    const seasonNumStr = playlist.season.toString();
    const seasonNumSafe = seasonNumStr.replace('.', '_');
    const seasonParts = seasonNumStr.split('.');
    const paddedSeason = seasonParts[0].padStart(2, '0') + (seasonParts[1] ? '_' + seasonParts[1] : '');

    const paddedEp = String(junction.sort_order).padStart(2, '0');
    const fileName = `${shortPrefix}-s${paddedSeason}e${paddedEp}.html`;
    const basePath = `yt/${channelSlug}/${gameSlug}/season-${seasonNumSafe}`;
    const epUrl = `/${basePath}/${fileName}`;

    // Sync the generated URL to the database if it's missing or changed
    if (video.url !== epUrl) {
        await supabase.from('ltg_videos').update({ url: epUrl }).eq('id', video.id);
    }

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
        adminTagGroups: adminTagsData.groups,
        adminTagsMeta: adminTagsData.metaString,
        clientTagConfigStr: JSON.stringify(clientTagConfig),
        runs: runsData || [],
        prevUrl: prevSortOrder ? `/yt/${channelSlug}/${gameSlug}/season-${seasonNumSafe}/${shortPrefix}-s${paddedSeason}e${prevPaddedEp}.html` : null,
        nextUrl: nextSortOrder ? `/yt/${channelSlug}/${gameSlug}/season-${seasonNumSafe}/${shortPrefix}-s${paddedSeason}e${nextPaddedEp}.html` : null
    };

    return buildEpisodePage(templateData, basePath);
}

/**
 * Shared rendering logic used by both updateEpisode and updateSeason
 */
export function buildEpisodePage(data, basePath) {
    const mainFilePath = `${basePath}/${data.fileName}`;
    const manualFilePath = `${basePath}/_manual/${data.fileName}`;

    const pageHTML = episodeHTML(data);
    writeStaticPage(mainFilePath, pageHTML);

    if (!checkFileExists(manualFilePath)) {
        writeStaticPage(manualFilePath, "\n");
    }

    return { success: true, filePath: mainFilePath };
}