import fs from 'fs';
import { getChannelContext } from '../utils/db.js';
import { writeStaticPage, checkFileExists } from '../utils/fileSys.js';
import { channelHTML } from '../utils/templates.js';
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

    
    // Instead of one build, we loop through every channel in the family context
    // and build an index for each one.    
    console.log(`\n🏗️  Generating Hub Indexes for the ${context.hubSlug} family...`);

    for (const channel of context.channels) {
        const channelPath = `yt/${channel.channelSlug}`;
        const channelIndex = `${channelPath}/index.html`;
        const channelManual = `${channelPath}/_manual/index.html`;

        if (!fs.existsSync(channelPath)) fs.mkdirSync(channelPath, { recursive: true });

        // If this channel is the main hub (letstrygg), it gets the whole family's data. 
        // If it's a child (ltg-plus), it only gets its own data.
        const isMainHub = channel.channelSlug === context.hubSlug;
        const channelsToRender = isMainHub ? context.channels : [channel];

        const pageHTML = channelHTML({
            hubSlug: channel.channelSlug,
            channels: channelsToRender
        });

        writeStaticPage(channelIndex, pageHTML);
        console.log(`✅ Hub Index generated at: ${channelIndex}`);

        if (!fs.existsSync(channelManual)) {
            writeStaticPage(channelManual, "\n");
        }
    }

    return { success: true, skipped: false, totalEpisodes, errors: channelErrors };
}