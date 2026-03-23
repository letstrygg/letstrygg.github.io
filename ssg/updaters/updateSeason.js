import fs from 'fs'; 
import { getFullSeasonContext } from '../utils/db.js';
import { writeStaticPage } from '../utils/fileSys.js';
import { seasonIndexHTML } from '../utils/templates.js';
import { updateEpisode } from './updateEpisode.js';

export async function updateSeason(playlistId, force = false) {
    const playlist = await getFullSeasonContext(playlistId);
    const series = playlist.ltg_series;
    const gameSlug = series.ltg_games?.slug || series.slug;
    const channelSlug = playlist.channel_slug;
    const seasonNum = playlist.season;

    console.log(`\n📂 Processing Season: ${series.title} (Season ${seasonNum}) for ${channelSlug}`);

    const shortPrefix = series.slug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    const basePath = `yt/${channelSlug}/${gameSlug}/s${Math.floor(seasonNum)}`;
    const indexPath = `${basePath}/index.html`;
    const manualPath = `${basePath}/_manual/index.html`;

    const dbSyncDate = playlist.sync_date || 'never';

    // The Smart Skip Logic
    if (!force && fs.existsSync(indexPath)) {
        const existingContent = fs.readFileSync(indexPath, 'utf8');
        const match = existingContent.match(/sync_date:\s*"?([^"\r\n]+)"?/);
        
        if (match && match[1] === dbSyncDate) {
            console.log(`⏩ Skipping updates. Data is in sync with database timestamp: ${dbSyncDate}`);
            console.log(`   (Use --force to override)`);
            return { success: true, episodesProcessed: 0, skipped: true, playlistId: playlist.id, seriesSlug: series.slug };
        }
    }

    const videos = playlist.ltg_playlist_videos.sort((a, b) => a.sort_order - b.sort_order);
    console.log(`Found ${videos.length} episodes. Triggering granular updates...`);

    let successCount = 0;
    for (const pv of videos) {
        try {
            await updateEpisode(pv.video_id);
            successCount++;
        } catch (epError) {
            console.error(`❌ Failed to update episode ${pv.video_id}:`, epError.message);
        }
    }

    const templateData = {
        seasonNum: seasonNum,
        seriesTitle: series.title,
        channelSlug: channelSlug,
        gameSlug: gameSlug,
        shortPrefix: shortPrefix,
        syncDate: dbSyncDate
    };

    // Always overwrite the main index
    const seasonHTML = seasonIndexHTML(templateData);
    writeStaticPage(indexPath, seasonHTML);
    console.log(`✅ Season Index generated at: ${indexPath}`);

    // Create the manual fragment if missing
    if (!fs.existsSync(manualPath)) {
        writeStaticPage(manualPath, "\n");
        console.log(`    [CREATED MANUAL FRAGMENT] ${manualPath}`);
    }

    return {
        success: true,
        episodesProcessed: successCount,
        skipped: false,
        playlistId: playlist.id,
        seriesSlug: series.slug
    };
}