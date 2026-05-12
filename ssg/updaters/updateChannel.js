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
    let aggVideos = 0, aggViews = 0, aggLikes = 0, aggComments = 0, aggDuration = 0;
    let firstDate = null, lastDate = null;

    context.channels.forEach(ch => {
        // Aggregate numerical stats
        aggVideos += (ch.total_videos || 0);
        aggViews += (ch.total_views || 0);
        aggLikes += (ch.total_likes || 0);
        aggComments += (ch.total_comments || 0);
        aggDuration += (ch.total_duration_s || 0);

        // Aggregate date boundaries for Age and Inactivity calculations
        if (ch.first_video_at && (!firstDate || new Date(ch.first_video_at) < new Date(firstDate))) firstDate = ch.first_video_at;
        if (ch.last_video_at && (!lastDate || new Date(ch.last_video_at) > new Date(lastDate))) lastDate = ch.last_video_at;

        ch.games.forEach(g => allUniqueGames.set(g.slug, g));
    });

    // Overwrite context totals with aggregated sums from all child channels
    context.total_videos = aggVideos;
    context.total_views = aggViews;
    context.total_likes = aggLikes;
    context.total_comments = aggComments;
    context.total_duration_s = aggDuration;
    context.total_games = allUniqueGames.size;
    context.first_video_at = firstDate;
    context.last_video_at = lastDate;

    const gamesList = Array.from(allUniqueGames.values());
    const channelFamily = context.channels.map(c => c.channelSlug);

    let totalEpisodes = 0;
    let anyUpdates = false;
    const channelErrors = [];

    if (!options.noCascade) {
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
    } else {
        console.log(`  ⏩ Skipping series cascade (--no-cascade active). Rebuilding index only...`);
    }

    const basePath = `yt/${context.hubSlug}`;
    const indexPath = `${basePath}/index.html`;

    // --- LOAD MANUAL FRAGMENT ---
    const manualPath = `${basePath}/_manual/index.html`;
    let manualContent = "\n";
    if (fs.existsSync(manualPath)) {
        manualContent = fs.readFileSync(manualPath, 'utf8');
    } else {
        if (!fs.existsSync(`${basePath}/_manual`)) fs.mkdirSync(`${basePath}/_manual`, { recursive: true });
        fs.writeFileSync(manualPath, manualContent);
    }

    if (!anyUpdates && !isForce && fs.existsSync(indexPath)) {
        console.log(`\n⏩ Channel Root skipped (All child series are up-to-date).`);
        return { success: true, skipped: true, totalEpisodes, errors: channelErrors };
    }

    console.log(`  🏗️ Rebuilding Channel Root Index for ${context.hubSlug}...`);
    const html = channelHTML({ ...context, manualContent });
    writeStaticPage(indexPath, html);
    console.log(`  ✅ Channel Index generated at: ${indexPath}`);

    return { success: true, skipped: false, totalEpisodes, errors: channelErrors };
}