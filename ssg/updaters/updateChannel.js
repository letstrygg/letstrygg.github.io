import fs from 'fs';
import { getChannelContext } from '../utils/db.js';
import { writeStaticPage } from '../utils/fileSys.js';
import { channelHTML, hubHTML } from '../utils/templates/index.js'; 
import { updateSeries } from './updateSeries.js';
import { StatsCalc } from '../utils/statsCalc.js';

export async function updateChannel(hubSlug, options = {}) {
    const isForce = options.force || false;

    console.log(`\n📡 Fetching Data for Channel Family: ${hubSlug}...`);
    
    const context = await getChannelContext(hubSlug);
    
    const allUniqueGames = new Map();
    let aggVideos = 0, aggViews = 0, aggLikes = 0, aggComments = 0, aggDuration = 0;
    let firstDate = null, lastDate = null;

    context.channels.forEach(ch => {
        // Aggregate numerical stats
        aggVideos += (ch.totalVideos || ch.total_videos || 0);
        aggViews += (ch.totalViews || ch.total_views || 0);
        aggLikes += (ch.totalLikes || ch.total_likes || 0);
        aggComments += (ch.totalComments || ch.total_comments || 0);
        aggDuration += (ch.totalDuration || ch.total_duration || ch.total_duration_s || 0);

        // Aggregate date boundaries for Age and Inactivity calculations
        const chFirst = ch.firstVideoAt || ch.first_video_at;
        const chLast = ch.lastVideoAt || ch.last_video_at;
        if (chFirst && (!firstDate || new Date(chFirst) < new Date(firstDate))) firstDate = chFirst;
        if (chLast && (!lastDate || new Date(chLast) > new Date(lastDate))) lastDate = chLast;

        ch.games.forEach(g => allUniqueGames.set(g.slug, g));
    });

    // Set values in context, preferring existing non-zero values from the DB if they exist.
    // We map both formats to the camelCase keys expected by the channelHTML/hubHTML templates.
    context.totalVideos = context.totalVideos || context.total_videos || aggVideos;
    context.totalViews = context.totalViews || context.total_views || aggViews;
    context.totalLikes = context.totalLikes || context.total_likes || aggLikes;
    context.totalComments = context.totalComments || context.total_comments || aggComments;
    context.totalDuration = context.totalDuration || context.total_duration || context.total_duration_s || aggDuration;
    context.totalGames = context.totalGames || context.total_games || allUniqueGames.size;
    
    context.firstVideoAt = context.firstVideoAt || context.first_video_at || firstDate;
    context.lastVideoAt = context.lastVideoAt || context.last_video_at || lastDate;

    // Recalculate Hub Averages for "PER GAME" and "PER VID" sections
    const gameCount = Math.max(1, context.totalGames);
    const vidCount = Math.max(1, context.totalVideos);

    context.averages = {
        videos: Math.round(context.totalVideos / gameCount),
        views: Math.round(context.totalViews / gameCount),
        likes: Math.round(context.totalLikes / gameCount),
        comments: Math.round(context.totalComments / gameCount),
        duration: Math.round(context.totalDuration / gameCount),
        
        viewsPerVid: Math.round(context.totalViews / vidCount),
        likesPerVid: Math.round(context.totalLikes / vidCount),
        commentsPerVid: Math.round(context.totalComments / vidCount),
        durPerVid: Math.round(context.totalDuration / vidCount)
    };

    // Recalculate derived analytics for the combined hub header
    const firstTs = context.firstVideoAt ? new Date(context.firstVideoAt).getTime() : null;
    const ageDays = StatsCalc.daysBetween(firstTs);
    context.adv = {
        age: ageDays,
        inactive: StatsCalc.daysBetween(context.lastVideoAt ? new Date(context.lastVideoAt).getTime() : null),
        vel: StatsCalc.velocity(context.totalViews, ageDays),
        heat: StatsCalc.popularity(context.totalViews, context.totalLikes, context.totalComments, StatsCalc.hoursBetween(firstTs)),
        gem: StatsCalc.hiddenGemScore(context.totalViews, context.totalLikes, context.totalComments)
    };

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

    // Only skip if there were no updates AND we aren't forcing AND we aren't in "index only" mode
    if (!anyUpdates && !isForce && !options.noCascade && fs.existsSync(indexPath)) {
        console.log(`\n⏩ Channel Root skipped (All child series are up-to-date).`);
        return { success: true, skipped: true, totalEpisodes, errors: channelErrors };
    }

    console.log(`  🏗️ Rebuilding Channel Root Index for ${context.hubSlug}...`);
    const html = channelHTML({ ...context, manualContent });
    writeStaticPage(indexPath, html);
    console.log(`  ✅ Channel Index generated at: ${indexPath}`);

    return { success: true, skipped: false, totalEpisodes, errors: channelErrors };
}