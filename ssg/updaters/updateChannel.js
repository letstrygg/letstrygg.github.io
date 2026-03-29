import fs from 'fs';
import { getChannelContext } from '../utils/db.js';
import { writeStaticPage } from '../utils/fileSys.js';
import { channelHTML, hubHTML } from '../utils/templates/index.js'; 
import { updateSeries } from './updateSeries.js';

export async function updateChannel(hubSlug, options = {}) {
    const isForce = options.force || false;

    console.log(`\n📡 Fetching Data for Channel Family: ${hubSlug}...`);
    
    const context = await getChannelContext(hubSlug);
    
    const allUniqueGames = new Map();
    context.channels.forEach(ch => {
        ch.games.forEach(g => allUniqueGames.set(g.slug, g));
    });
    const gamesList = Array.from(allUniqueGames.values());
    const channelFamily = context.channels.map(c => c.channelSlug);

    let totalEpisodes = 0;
    let anyUpdates = false;
    const channelErrors = [];

    console.log(`Found ${gamesList.length} unique games across ${context.channels.length} channel(s). Beginning concurrent cascade...`);

    const batchSize = 15; 
    for (let i = 0; i < gamesList.length; i += batchSize) {
        const batch = gamesList.slice(i, i + batchSize);
        const batchPromises = batch.map(async (game) => {
            try {
                return await updateSeries(game.slug, options, channelFamily, context.hubSlug);
            } catch (err) {
                const errMsg = `[Game: ${game.slug}] Critical Series Failure: ${err.message}`;
                console.error(`❌ ${errMsg}`);
                return { error: errMsg };
            }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => {
            if (result.error) {
                channelErrors.push(result.error);
            } else {
                totalEpisodes += result.totalEpisodes || 0;
                if (result.errors && result.errors.length > 0) channelErrors.push(...result.errors);
                if (!result.skipped) anyUpdates = true;
            }
        });
    }

    const basePath = `yt/${context.hubSlug}`;
    const indexPath = `${basePath}/index.html`;

    if (!anyUpdates && !isForce && fs.existsSync(indexPath)) {
        console.log(`\n⏩ Channel Root skipped (All child series are up-to-date).`);
        return { success: true, skipped: true, totalEpisodes, errors: channelErrors };
    }

    console.log(`  🏗️ Rebuilding Channel Root Index for ${context.hubSlug}...`);
    const html = channelHTML(context);
    writeStaticPage(indexPath, html);
    console.log(`  ✅ Channel Index generated at: ${indexPath}`);

    return { success: true, skipped: false, totalEpisodes, errors: channelErrors };
}