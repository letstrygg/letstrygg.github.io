import fs from 'fs'; // Add this at the top to read the existing index
import { getFullSeasonContext } from '../utils/db.js';
import { writeStaticPage } from '../utils/fileSys.js';
import { seasonIndexHTML } from '../utils/templates.js';
import { updateEpisode } from './updateEpisode.js';

// Accept the force flag (defaulting to false)
export async function updateSeason(playlistId, force = false) {
    // 1. Fetch DB Context
    const playlist = await getFullSeasonContext(playlistId);
    const series = playlist.ltg_series;
    const gameSlug = series.ltg_games?.slug || series.slug;
    const channelSlug = playlist.channel_slug;
    const seasonNum = playlist.season;

    console.log(`\n📂 Processing Season: ${series.title} (Season ${seasonNum}) for ${channelSlug}`);

    // Set paths
    const shortPrefix = series.slug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    const basePath = `yt/${channelSlug}/${gameSlug}/s${Math.floor(seasonNum)}`;
    const indexPath = `${basePath}/index.html`;

    // Ensure we have a valid sync_date to compare against (fallback to current time if null)
    const dbSyncDate = playlist.sync_date || new Date().toISOString(); 

    // 2. The Smart Skip Logic
    if (!force && fs.existsSync(indexPath)) {
        const existingContent = fs.readFileSync(indexPath, 'utf8');
        // Regex to extract the sync_date string from the frontmatter
        const match = existingContent.match(/sync_date:\s*"?([^"\r\n]+)"?/);
        
        if (match && match[1] === dbSyncDate) {
            console.log(`⏩ Skipping updates. Data is in sync with database timestamp: ${dbSyncDate}`);
            console.log(`   (Use --force to override)`);
            return { success: true, episodesProcessed: 0, skipped: true, playlistId: playlist.id, seriesSlug: series.slug };
        }
    }

    // 3. Sort videos and process episodes (Only runs if force is true, or sync_date changed)
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

    // 4. Assemble Data for the Season Index Page
    const templateData = {
        seasonNum: seasonNum,
        seriesTitle: series.title,
        channelSlug: channelSlug,
        gameSlug: gameSlug,
        shortPrefix: shortPrefix,
        syncDate: dbSyncDate // Pass the timestamp to the template
    };

    // 5. Write the Season Index HTML
    const seasonHTML = seasonIndexHTML(templateData);
    writeStaticPage(indexPath, seasonHTML);
    console.log(`✅ Season Index generated at: ${indexPath}`);

    return {
        success: true,
        episodesProcessed: successCount,
        skipped: false,
        playlistId: playlist.id,
        seriesSlug: series.slug
    };
}