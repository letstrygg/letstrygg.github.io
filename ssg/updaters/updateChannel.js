import fs from 'fs';
import { getChannelContext } from '../utils/db.js';
import { writeStaticPage, checkFileExists } from '../utils/fileSys.js';
import { channelRootHTML } from '../utils/templates.js';
import { updateSeries } from './updateSeries.js';

export async function updateChannel(channelSlug, force = false) {
    console.log(`\n📡 Fetching Data for Channel Family: ${channelSlug}...`);
    
    // 1. Fetch the nested channel family data
    const context = await getChannelContext(channelSlug);
    
    // Flatten all games across the family so we know which series to update
    const allUniqueGames = new Map();
    context.channels.forEach(ch => {
        ch.games.forEach(g => allUniqueGames.set(g.slug, g));
    });
    const gamesList = Array.from(allUniqueGames.values());

    // Extract an array of all valid channel slugs in this family (e.g., ['letstrygg', 'ltg-plus'])
    const channelFamily = context.channels.map(c => c.channelSlug);

    console.log(`Found ${gamesList.length} unique games across ${context.channels.length} channel(s). Beginning cascade...`);

    let totalEpisodes = 0;
    let anyUpdates = false;

    // 2. Cascade downwards into updateSeries
    for (const game of gamesList) {
        try {
            // Pass the scope parameters down so updateSeries stays strictly in its lane
            const result = await updateSeries(game.slug, force, channelFamily, context.hubSlug);
            
            totalEpisodes += result.totalEpisodes || 0;
            if (!result.skipped) anyUpdates = true;
        } catch (err) {
            console.error(`❌ Failed to update series for game ${game.slug}:`, err.message);
        }
    }

    // 3. Build the Channel Hub Page
    const basePath = `yt/${context.hubSlug}`;
    const indexPath = `${basePath}/index.html`;
    const manualPath = `${basePath}/_manual/index.html`;

    if (!anyUpdates && !force && fs.existsSync(indexPath)) {
        console.log(`\n⏩ Channel Root skipped (All child series are up-to-date).`);
        return { success: true, skipped: true, totalEpisodes };
    }

    console.log(`\n🏗️ Rebuilding Channel Root Index for ${context.hubSlug}...`);

    // Pass the new structured channels array to the template
    const pageHTML = channelRootHTML({
        hubSlug: context.hubSlug,
        channels: context.channels
    });

    writeStaticPage(indexPath, pageHTML);
    console.log(`✅ Channel Root Index generated at: ${indexPath}`);

    if (!checkFileExists(manualPath)) {
        writeStaticPage(manualPath, "\n");
        console.log(`    [CREATED MANUAL FRAGMENT] ${manualPath}`);
    }

    return { success: true, skipped: false, totalEpisodes };
}