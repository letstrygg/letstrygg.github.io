import fs from 'fs'; 
import { getFullSeasonContext } from '../utils/db.js';
import { writeStaticPage } from '../utils/fileSys.js';
import { seasonHTML } from '../utils/templates.js';
import { updateEpisode } from './updateEpisode.js';

export async function updateSeason(playlistId, force = false) {
    const playlist = await getFullSeasonContext(playlistId);
    const series = playlist.ltg_series;
    const gameSlug = series.ltg_games?.slug || series.slug;
    const channelSlug = playlist.channel_slug;
    const seasonNum = playlist.season;

    // Use the custom abbreviation if it exists, otherwise generate the default
    const dbAbbr = series.ltg_games?.custom_abbr;
    const shortPrefix = dbAbbr ? dbAbbr.toLowerCase() : gameSlug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();

    const basePath = `yt/${channelSlug}/${gameSlug}/season-${Math.floor(seasonNum)}`;
    const indexPath = `${basePath}/index.html`;
    const manualPath = `${basePath}/_manual/index.html`;

    const dbSyncDate = playlist.sync_date || 'never';

    // --- BULLETPROOF SKIP LOGIC ---
    let fileDateStr = 'never';
    if (!force && fs.existsSync(indexPath)) {
        const existingContent = fs.readFileSync(indexPath, 'utf8');
        const match = existingContent.match(/sync_date:\s*"?([^"\r\n]+)"?/);
        if (match) fileDateStr = match[1];
    }

    // Convert both strings to raw milliseconds (0 if 'never')
    const dbTime = dbSyncDate === 'never' ? 0 : new Date(dbSyncDate).getTime();
    const fileTime = fileDateStr === 'never' ? 0 : new Date(fileDateStr).getTime();

    if (!force && dbTime === fileTime) {
        // Silently return without logging anything to the console
        return { success: true, episodesProcessed: 0, skipped: true, playlistId: playlist.id, seriesSlug: series.slug, errors: [] };
    }

    // Only print this if the season is actually out of date and needs to build
    console.log(`\n📂 Processing Season: ${series.title} (Season ${seasonNum}) for ${channelSlug}`);

    const videos = playlist.ltg_playlist_videos.sort((a, b) => a.sort_order - b.sort_order);
    console.log(`Found ${videos.length} episodes. Triggering concurrent updates...`);

    let successCount = 0;
    const errors = [];

    // --- CONCURRENT BATCH PROCESSING ---
    const batchSize = 15; // Process 15 episodes simultaneously

    for (let i = 0; i < videos.length; i += batchSize) {
        const batch = videos.slice(i, i + batchSize);

        // Fire off updateEpisode for the batch concurrently
        const batchPromises = batch.map(async (pv) => {
            try {
                await updateEpisode(pv.video_id);
                return { success: true };
            } catch (epError) {
                const errMsg = `[Season ${seasonNum}] Failed Episode ${pv.video_id}: ${epError.message}`;
                console.error(`❌ ${errMsg}`);
                return { success: false, error: errMsg };
            }
        });

        // Wait for this chunk of 15 to finish
        const batchResults = await Promise.all(batchPromises);

        // Tally results
        batchResults.forEach(res => {
            if (res.success) {
                successCount++;
            } else {
                errors.push(res.error);
            }
        });
    }

    // --- THE POISON PILL LOGIC ---
    // If any episodes failed to fetch, sabotage the sync_date written to the HTML file.
    const finalSyncDate = errors.length > 0 ? "ERROR_RETRY_NEEDED" : dbSyncDate;

    const templateData = {
        seasonNum: seasonNum,
        seriesTitle: series.title,
        channelSlug: channelSlug,
        gameSlug: gameSlug,
        shortPrefix: shortPrefix,
        syncDate: finalSyncDate
    };

    // Always overwrite the main index
    const seasonHTML = seasonHTML(templateData);
    writeStaticPage(indexPath, seasonHTML);

    if (!fs.existsSync(manualPath)) {
        writeStaticPage(manualPath, "\n");
    }

    // Return the errors array up the chain
    return {
        success: true,
        episodesProcessed: successCount,
        skipped: false,
        playlistId: playlist.id,
        seriesSlug: series.slug,
        errors: errors 
    };
}