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
            // Attach the parent series status to each playlist so the card knows if it's "Completed" or "Ongoing"
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

    // --- MAP & REDUCE THE CARD DATA ---
    const mappedSeasons = sortedPlaylists.map(p => {
        let totalViews = 0;
        let totalDuration = 0;
        let latestDate = new Date(0);
        let firstVideoId = '';
        
        // Filter out null videos and sort by order
        const validVideos = p.ltg_playlist_videos
            .filter(pv => pv.ltg_videos)
            .sort((a, b) => a.sort_order - b.sort_order);

        if (validVideos.length > 0) {
            firstVideoId = validVideos[0].ltg_videos.id; // Grab the thumbnail for Ep 1
            
            validVideos.forEach(pv => {
                const v = pv.ltg_videos;
                totalViews += (v.view_count || 0);
                totalDuration += (v.duration_seconds || 0);
                
                const pubDate = new Date(v.published_at);
                if (pubDate > latestDate) latestDate = pubDate;
            });
        }

        // Formatting Helpers for the template
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
            epCount: validVideos.length,
            totalViews,
            totalDuration,
            durFull,
            durShort,
            lastUpdatedFormatted,
            firstVideoId,
            episodes: validVideos.map(pv => pv.sort_order)
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