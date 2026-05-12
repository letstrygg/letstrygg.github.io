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

    // --- DYNAMIC AGGREGATION FOR DASHBOARD ---
    // This sums up all content within the hub to ensure the Dashboard shows accurate totals
    const dashboardTotals = {
        total_games: 0,
        total_videos: 0,
        total_views: 0,
        total_likes: 0,
        total_comments: 0,
        total_duration: 0,
        first_pub: null,
        last_pub: null
    };

    const uniqueGameSlugs = new Set();
    context.channels.forEach(ch => {
        ch.games.forEach(game => {
            if (!uniqueGameSlugs.has(game.slug)) {
                uniqueGameSlugs.add(game.slug);
                dashboardTotals.total_games++;
            }
            
            game.ltg_series_playlists?.forEach(sp => {
                const s = sp.ltg_playlists?.ltg_playlist_stats?.[0];
                if (s) {
                    dashboardTotals.total_videos += parseInt(s.ep_count || 0);
                    dashboardTotals.total_views += parseInt(s.total_views || 0);
                    dashboardTotals.total_likes += parseInt(s.total_likes || 0);
                    dashboardTotals.total_comments += parseInt(s.total_comments || 0);
                    dashboardTotals.total_duration += parseInt(s.total_duration || 0);

                    if (s.first_published_at && (!dashboardTotals.first_pub || new Date(s.first_published_at) < new Date(dashboardTotals.first_pub))) {
                        dashboardTotals.first_pub = s.first_published_at;
                    }
                    if (s.latest_published_at && (!dashboardTotals.last_pub || new Date(s.latest_published_at) > new Date(dashboardTotals.last_pub))) {
                        dashboardTotals.last_pub = s.latest_published_at;
                    }
                }
            });
        });
    });

    if (!anyUpdates && !isForce && fs.existsSync(indexPath)) {
        console.log(`\n⏩ Channel Root skipped (All child series are up-to-date).`);
        return { success: true, skipped: true, totalEpisodes, errors: channelErrors };
    }

    console.log(`  🏗️ Rebuilding Channel Root Index for ${context.hubSlug}...`);
    const html = channelHTML({ ...context, dashboardTotals, manualContent });
    writeStaticPage(indexPath, html);
    console.log(`  ✅ Channel Index generated at: ${indexPath}`);

    return { success: true, skipped: false, totalEpisodes, errors: channelErrors };
}