import fs from 'fs';
import { getFullSeriesContext } from '../utils/db.js';
import { writeStaticPage, checkFileExists } from '../utils/fileSys.js';
import { seriesRootAutoHTML, seriesRootManualHTML } from '../utils/templates.js';
import { updateSeason } from './updateSeason.js';

export async function updateSeries(gameSlug, force = false) {
    // 1. Fetch DB Context (Returns an array of Series)
    const seriesArray = await getFullSeriesContext(gameSlug);
    
    // Grab the proper Game Title from the first series' joined table
    const gameTitle = seriesArray[0].ltg_games?.title || gameSlug;

    // Aggregate ALL playlists across ALL series for this game
    let allPlaylists = [];
    seriesArray.forEach(series => {
        if (series.ltg_playlists) {
            allPlaylists.push(...series.ltg_playlists);
        }
    });

    if (allPlaylists.length === 0) {
        console.log(`⚠️ No seasons/playlists found for game: ${gameSlug}`);
        return { success: true, skipped: true, totalEpisodes: 0 };
    }

    // Assume all seasons for a game belong to the same channel
    const channelSlug = allPlaylists[0]?.channel_slug || 'unknown';

    console.log(`\n📚 Processing Game: ${gameTitle} (${allPlaylists.length} seasons across ${seriesArray.length} series)`);

    // 2. Sort all seasons descending and process them
    const sortedPlaylists = allPlaylists.sort((a, b) => b.season - a.season);
    
    let anyUpdates = false;
    let totalEpisodes = 0;

    for (const playlist of sortedPlaylists) {
        const result = await updateSeason(playlist.id, force);
        totalEpisodes += result.episodesProcessed || 0;
        
        // If even a single season updated, we must flag the game root for a rebuild
        if (!result.skipped) {
            anyUpdates = true;
        }
    }

    // 3. The Bubble-Up Skip Logic
    const basePath = `yt/${channelSlug}/${gameSlug}`;
    const autoPath = `${basePath}/_seasons_auto.html`;
    const manualPath = `${basePath}/index.html`;

    if (!anyUpdates && !force && fs.existsSync(autoPath)) {
        console.log(`\n⏩ Game Root skipped (All child seasons are up-to-date).`);
        return { success: true, skipped: true, totalEpisodes };
    }

    console.log(`\n🏗️ Rebuilding Game Root Index for ${gameSlug}...`);

    // 4. Assemble Data
    const shortPrefix = gameSlug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    
    const templateData = {
        seriesTitle: gameTitle, // Pass the Game title down for the page H1
        gameSlug: gameSlug,
        channelSlug: channelSlug,
        shortPrefix: shortPrefix,
        seasons: sortedPlaylists.map(p => ({
            id: p.id,
            seasonNum: p.season,
            episodes: p.ltg_playlist_videos.map(pv => pv.sort_order).sort((a, b) => a - b)
        }))
    };

    // 5. Write the Files
    const autoHTML = seriesRootAutoHTML(templateData);
    writeStaticPage(autoPath, autoHTML);
    console.log(`✅ Game Grid generated at: ${autoPath}`);

    if (!checkFileExists(manualPath)) {
        const manualHTML = seriesRootManualHTML(templateData);
        writeStaticPage(manualPath, manualHTML);
        console.log(`    [CREATED MANUAL SHELL] ${manualPath}`);
    }

    return { 
        success: true, 
        skipped: false, 
        totalEpisodes,
        channelSlug 
    };
}