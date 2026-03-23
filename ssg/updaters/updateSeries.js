import fs from 'fs';
import { getFullSeriesContext } from '../utils/db.js';
import { writeStaticPage, checkFileExists } from '../utils/fileSys.js';
import { seriesRootAutoHTML, seriesRootManualHTML } from '../utils/templates.js';
import { updateSeason } from './updateSeason.js';

export async function updateSeries(gameSlug, force = false) {
    const seriesArray = await getFullSeriesContext(gameSlug);
    const gameTitle = seriesArray[0].ltg_games?.title || gameSlug;

    let allPlaylists = [];
    seriesArray.forEach(series => {
        if (series.ltg_playlists) {
            const taggedPlaylists = series.ltg_playlists.map(p => ({ ...p, series_status: series.status }));
            allPlaylists.push(...taggedPlaylists);
        }
    });

    if (allPlaylists.length === 0) return { success: true, skipped: true, totalEpisodes: 0 };
    const channelSlug = allPlaylists[0]?.channel_slug || 'unknown';

    console.log(`\n📚 Processing Game: ${gameTitle} (${allPlaylists.length} seasons across ${seriesArray.length} series)`);

    const sortedPlaylists = allPlaylists.sort((a, b) => b.season - a.season);
    
    let anyUpdates = false;
    let totalEpisodes = 0;

    for (const playlist of sortedPlaylists) {
        const result = await updateSeason(playlist.id, force);
        totalEpisodes += result.episodesProcessed || 0;
        if (!result.skipped) anyUpdates = true;
    }

    const basePath = `yt/${channelSlug}/${gameSlug}`;
    const autoPath = `${basePath}/_seasons_auto.html`;
    const manualPath = `${basePath}/index.html`;

    if (!anyUpdates && !force && fs.existsSync(autoPath)) {
        console.log(`\n⏩ Game Root skipped (All child seasons are up-to-date).`);
        return { success: true, skipped: true, totalEpisodes };
    }

    console.log(`\n🏗️ Rebuilding Game Root Index for ${gameSlug}...`);

    // --- USE THE PRE-CALCULATED DB STATS ---
    const mappedSeasons = sortedPlaylists.map(p => {
        // Grab the stats from our new Database View
        const stats = p.ltg_playlist_stats[0] || { 
            ep_count: 0, total_views: 0, total_duration: 0, 
            latest_published_at: new Date(0).toISOString(), first_video_id: '' 
        };

        const totalDuration = stats.total_duration;
        const latestDate = new Date(stats.latest_published_at);

        // Formatting Helpers
        const h = Math.floor(totalDuration / 3600);
        const m = Math.floor((totalDuration % 3600) / 60);
        const durFull = h > 0 ? `${h}h ${m}m` : `${m}m`;
        const durShort = Math.round(totalDuration / 3600) > 0 ? `${Math.round(totalDuration / 3600)}h` : durFull;
        const lastUpdatedFormatted = latestDate.getFullYear() + String(latestDate.getMonth() + 1).padStart(2, '0') + String(latestDate.getDate()).padStart(2, '0');

        return {
            id: p.id,
            seasonNum: p.season,
            title: p.title || `Season ${p.season}`,
            status: p.series_status || 'Ongoing',
            statusColor: (p.series_status || '').toLowerCase() === 'completed' ? 'blue' : 'green',
            epCount: stats.ep_count,
            totalViews: stats.total_views,
            totalDuration: totalDuration,
            durFull,
            durShort,
            lastUpdatedFormatted,
            firstVideoId: stats.first_video_id,
            episodes: p.ltg_playlist_videos.map(pv => pv.sort_order).sort((a, b) => a - b)
        };
    });

    const shortPrefix = gameSlug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    const templateData = {
        seriesTitle: gameTitle,
        gameSlug: gameSlug,
        channelSlug: channelSlug,
        shortPrefix: shortPrefix,
        seasons: mappedSeasons
    };

    const autoHTML = seriesRootAutoHTML(templateData);
    writeStaticPage(autoPath, autoHTML);
    console.log(`✅ Game Grid generated at: ${autoPath}`);

    if (!checkFileExists(manualPath)) {
        const manualHTML = seriesRootManualHTML(templateData);
        writeStaticPage(manualPath, manualHTML);
    }

    return { success: true, skipped: false, totalEpisodes, channelSlug };
}