import fs from 'fs';
import { getChannelContext } from '../utils/db.js';
import { writeStaticPage, checkFileExists } from '../utils/fileSys.js';
import { channelRootHTML } from '../utils/templates.js';
import { updateSeries } from './updateSeries.js';

export async function updateChannel(channelSlug, force = false) {
    console.log(`\n📡 Fetching Data for Channel Family: ${channelSlug}...`);
    
    const context = await getChannelContext(channelSlug);
    
    const allUniqueGames = new Map();
    context.channels.forEach(ch => {
        ch.games.forEach(g => allUniqueGames.set(g.slug, g));
    });
    const gamesList = Array.from(allUniqueGames.values());
    const channelFamily = context.channels.map(c => c.channelSlug);

    console.log(`Found ${gamesList.length} unique games across ${context.channels.length} channel(s). Beginning concurrent cascade...`);

    let totalEpisodes = 0;
    let anyUpdates = false;
    const channelErrors = [];

    // --- CONCURRENT BATCH PROCESSING ---
    const batchSize = 15; // Process 15 games simultaneously
    
    for (let i = 0; i < gamesList.length; i += batchSize) {
        const batch = gamesList.slice(i, i + batchSize);
        
        // Fire off 15 updateSeries functions at the exact same time
        const batchPromises = batch.map(async (game) => {
            try {
                return await updateSeries(game.slug, force, channelFamily, context.hubSlug);
            } catch (err) {
                const errMsg = `[Game: ${game.slug}] Critical Series Failure: ${err.message}`;
                console.error(`❌ ${errMsg}`);
                return { error: errMsg };
            }
        });

        // Wait for the batch to finish before moving to the next 15
        const batchResults = await Promise.all(batchPromises);

        // Tally up the results from the concurrent workers
        batchResults.forEach(result => {
            if (result.error) {
                channelErrors.push(result.error);
            } else {
                totalEpisodes += result.totalEpisodes || 0;
                if (result.errors && result.errors.length > 0) {
                    channelErrors.push(...result.errors);
                }
                if (!result.skipped) anyUpdates = true;
            }
        });
    }

    const basePath = `yt/${context.hubSlug}`;
    const indexPath = `${basePath}/index.html`;
    const manualPath = `${basePath}/_manual/index.html`;

    if (!anyUpdates && !force && fs.existsSync(indexPath)) {
        console.log(`\n⏩ Channel Root skipped (All child series are up-to-date).`);
        return { success: true, skipped: true, totalEpisodes, errors: channelErrors };
    }

    console.log(`\n🏗️ Rebuilding Channel Root Index for ${context.hubSlug}...`);

    const pageHTML = channelRootHTML({
        hubSlug: context.hubSlug,
        channels: context.channels
    });

    writeStaticPage(indexPath, pageHTML);
    console.log(`✅ Channel Root Index generated at: ${indexPath}`);

    if (!checkFileExists(manualPath)) {
        writeStaticPage(manualPath, "\n");
    }

    return { success: true, skipped: false, totalEpisodes, errors: channelErrors };
}