import fs from 'fs';
import { getChannelContext } from '../utils/db.js';
import { writeStaticPage, checkFileExists } from '../utils/fileSys.js';
import { channelHTML, hubHTML } from '../utils/templates/index.js'; // Imported hubHTML!
import { updateSeries } from './updateSeries.js';

export async function updateChannel(hubSlug, options = {}) {
    const isForce = options.force || false;

    // FIX: Using hubSlug instead of undefined channelSlug
    console.log(`\n📡 Fetching Data for Channel Family: ${hubSlug}...`);
    
    const context = await getChannelContext(hubSlug);
    
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
    const batchSize = 15; 
    
    for (let i = 0; i < gamesList.length; i += batchSize) {
        const batch = gamesList.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (game) => {
            try {
                // FIX: Passing the 'options' object down instead of just 'force'
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
                if (result.errors && result.errors.length > 0) {
                    channelErrors.push(...result.errors);
                }
                if (!result.skipped) anyUpdates = true;
            }
        });
    }

    const basePath = `yt/${context.hubSlug}`;
    const indexPath = `${basePath}/index.html`;

    // FIX: using isForce
    if (!anyUpdates && !isForce && fs.existsSync(indexPath)) {
        console.log(`\n⏩ Channel Root skipped (All child series are up-to-date).`);
        return { success: true, skipped: true, totalEpisodes, errors: channelErrors };
    }

    // --- 1. GENERATE THE MASTER HUB DIRECTORY (/yt/index.html) ---
    console.log(`\n🏗️  Aggregating Network Statistics for Master Hub...`);
    const networkData = {
        totalGames: 0, totalVideos: 0, totalViews: 0, totalDuration: 0, channels: []
    };

    for (const ch of context.channels) {
        const chStats = { slug: ch.channelSlug, games: ch.games.length, seasons: 0, videos: 0, views: 0, duration: 0 };
        for (const game of ch.games) {
            const gameSeasons = game.ltg_series_playlists || [];
            chStats.seasons += gameSeasons.length;
            for (const sp of gameSeasons) {
                const stats = sp.ltg_playlists?.ltg_playlist_stats?.[0];
                if (stats) {
                    chStats.videos += parseInt(stats.ep_count || 0);
                    chStats.views += parseInt(stats.total_views || 0);
                    chStats.duration += parseInt(stats.total_duration || 0);
                }
            }
        }
        networkData.channels.push(chStats);
        networkData.totalGames += chStats.games;
        networkData.totalVideos += chStats.videos;
        networkData.totalViews += chStats.views;
        networkData.totalDuration += chStats.duration;
    }

    const rootPath = `yt`;
    if (!fs.existsSync(rootPath)) fs.mkdirSync(rootPath, { recursive: true });
    
    writeStaticPage(`${rootPath}/index.html`, hubHTML(networkData));
    console.log(`✅ Master Network Directory generated at: ${rootPath}/index.html`);


    // --- 2. GENERATE THE INDIVIDUAL CHANNEL DIRECTORIES (/yt/letstrygg/index.html) ---
    console.log(`\n🏗️  Generating Channel Indexes for the ${context.hubSlug} family...`);

    for (const channel of context.channels) {
        const channelPath = `yt/${channel.channelSlug}`;
        const channelIndex = `${channelPath}/index.html`;
        const channelManual = `${channelPath}/_manual/index.html`;

        if (!fs.existsSync(channelPath)) fs.mkdirSync(channelPath, { recursive: true });
        if (!fs.existsSync(`${channelPath}/_manual`)) fs.mkdirSync(`${channelPath}/_manual`, { recursive: true });

        const isMainHub = channel.channelSlug === context.hubSlug;
        const channelsToRender = isMainHub ? context.channels : [channel];

        const pageHTML = channelHTML({
            hubSlug: channel.channelSlug,
            channels: channelsToRender
        });

        writeStaticPage(channelIndex, pageHTML);
        console.log(`✅ Channel Index generated at: ${channelIndex}`);

        if (!fs.existsSync(channelManual)) {
            writeStaticPage(channelManual, "\n");
        }
    }

    return { success: true, skipped: false, totalEpisodes, errors: channelErrors };
}