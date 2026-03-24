import fs from 'fs';
import { getFullSeriesContext } from '../utils/db.js';
import { writeStaticPage, checkFileExists } from '../utils/fileSys.js';
import { seriesRootHTML } from '../utils/templates.js';
import { updateSeason } from './updateSeason.js';

// Added channelFamily array and rootChannelSlug overrides
export async function updateSeries(gameSlug, force = false, channelFamily = null, rootChannelSlug = null) {
    // Pass the filter down to the database query
    const seriesArray = await getFullSeriesContext(gameSlug, channelFamily);
    const gameTitle = seriesArray[0].ltg_games?.title || gameSlug;

    let allPlaylists = [];
    seriesArray.forEach(series => {
        if (series.ltg_playlists) {
            const taggedPlaylists = series.ltg_playlists.map(p => ({ ...p, series_status: series.status }));
            allPlaylists.push(...taggedPlaylists);
        }
    });

    if (allPlaylists.length === 0) return { success: true, skipped: true, totalEpisodes: 0 };
    
    // Use the explicitly provided root hub slug, or fallback to the playlist's channel
    const channelSlug = rootChannelSlug || allPlaylists[0]?.channel_slug || 'unknown';

    console.log(`\n📚 Processing Game: ${gameTitle} (${allPlaylists.length} seasons across ${seriesArray.length} series)`);

    const sortedPlaylists = allPlaylists.sort((a, b) => b.season - a.season);
    
    // Calculate the Master Sync Date from child playlists
    const masterSyncDate = sortedPlaylists.reduce((latest, p) => {
        const pDate = p.sync_date || 'never';
        return pDate > latest ? pDate : latest;
    }, 'never');

    const basePath = `yt/${channelSlug}/${gameSlug}`;
    const indexPath = `${basePath}/index.html`;
    const manualPath = `${basePath}/_manual/index.html`;

    // The Frontmatter Skip Logic
    if (!force && fs.existsSync(indexPath)) {
        const existingContent = fs.readFileSync(indexPath, 'utf8');
        const match = existingContent.match(/sync_date:\s*"?([^"\r\n]+)"?/);
        
        if (match && match[1] === masterSyncDate) {
            console.log(`⏩ Game Root completely skipped (Latest sync_date matches: ${masterSyncDate}).`);
            return { success: true, skipped: true, totalEpisodes: 0 };
        }
    }

    let anyUpdates = false;
    let totalEpisodes = 0;

    for (const playlist of sortedPlaylists) {
        const result = await updateSeason(playlist.id, force);
        totalEpisodes += result.episodesProcessed || 0;
        if (!result.skipped) anyUpdates = true;
    }

    if (!anyUpdates && !force && fs.existsSync(indexPath)) {
        console.log(`\n⏩ Game Root skipped (All child seasons reported as up-to-date).`);
        return { success: true, skipped: true, totalEpisodes };
    }

    console.log(`\n🏗️ Rebuilding Game Root Index for ${gameSlug}...`);

    const mappedSeasons = sortedPlaylists.map(p => {
        const stats = p.ltg_playlist_stats[0] || { 
            ep_count: 0, total_views: 0, total_duration: 0, 
            latest_published_at: new Date(0).toISOString(), first_video_id: '' 
        };

        const totalDuration = stats.total_duration;
        const latestDate = new Date(stats.latest_published_at);

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

	// Use gameSlug for the prefix
// Use the custom abbreviation if it exists, otherwise generate the default
    const dbAbbr = seriesArray[0].ltg_games?.custom_abbr;
    const shortPrefix = dbAbbr ? dbAbbr.toLowerCase() : gameSlug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    
    const templateData = {
        seriesTitle: gameTitle,
        gameSlug: gameSlug,
        channelSlug: channelSlug,
        shortPrefix: shortPrefix,
        syncDate: masterSyncDate, 
        seasons: mappedSeasons
    };

    // Always overwrite the main index
    const pageHTML = seriesRootHTML(templateData);
    writeStaticPage(indexPath, pageHTML);
    console.log(`✅ Game Root Index generated at: ${indexPath}`);

    // Create the manual fragment if missing
    if (!checkFileExists(manualPath)) {
        writeStaticPage(manualPath, "\n");
        console.log(`    [CREATED MANUAL FRAGMENT] ${manualPath}`);
    }

    return { success: true, skipped: false, totalEpisodes, channelSlug };
}