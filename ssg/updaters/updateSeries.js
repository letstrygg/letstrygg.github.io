import fs from 'fs';
import { supabase } from '../utils/db.js';
import { updateSeason } from './updateSeason.js';
import { seriesHTML } from '../utils/templates/index.js';
import { writeStaticPage, getChannelContext } from '../utils/fileSys.js';

export async function updateSeries(gameSlug, options = {}, channelFamily = null, rootChannelSlug = null) {
    const isForce = options.force || false;
    const { data: allPlaylists, error } = await supabase
        .from('ltg_playlists')
        .select(`
            *,
            ltg_series!inner ( slug, title, tags ),
            ltg_playlist_stats ( ep_count, total_views, total_duration, latest_published_at, first_video_id )
        `)
        .eq('ltg_series.slug', gameSlug)
        .order('sort_order', { ascending: true });

    if (error || !allPlaylists.length) {
        console.error(`❌ Series error or not found: ${gameSlug}`, error?.message || '');
        return { success: false, skipped: false, totalEpisodes: 0 };
    }

    const seriesTitle = allPlaylists[0].ltg_series.title;
    
    // Use the channel that owns the first playlist, fallback to the root channel if provided
    const channelSlug = allPlaylists[0]?.channel_slug || rootChannelSlug || 'unknown';
    const seriesPath = `yt/${channelSlug}/${gameSlug}`;
    const seriesIndex = `${seriesPath}/index.html`;
    const seriesManual = `${seriesPath}/_manual/index.html`;

    console.log(`\n📚 Processing Game: ${seriesTitle} (${allPlaylists.length} seasons)`);

    let seriesSkipped = true;
    let totalEpisodes = 0;
    const seasonsData = [];

    // Process each season and gather stats for the series page
    for (const playlist of allPlaylists) {
        // Pass the options object down to the season builder
        const seasonResult = await updateSeason(playlist.id, options);
        
        if (!seasonResult.skipped) {
            seriesSkipped = false;
        }
        
        totalEpisodes += seasonResult.episodesProcessed || 0;

        const stats = playlist.ltg_playlist_stats?.[0] || {};
        seasonsData.push({
            id: playlist.id,
            seasonNum: playlist.season_num,
            title: playlist.title,
            status: playlist.status === 'c' ? 'Complete' : playlist.status === 'h' ? 'Hiatus' : 'Active',
            statusColor: playlist.status === 'c' ? 'green' : playlist.status === 'h' ? 'orange' : 'blue',
            epCount: stats.ep_count || 0,
            totalViews: stats.total_views || 0,
            totalDuration: stats.total_duration || 0,
            durFull: stats.total_duration ? Math.floor(stats.total_duration / 3600) + 'h ' + Math.floor((stats.total_duration % 3600) / 60) + 'm' : '0m',
            durShort: stats.total_duration ? Math.floor(stats.total_duration / 3600) + 'h' : '0h',
            firstVideoId: stats.first_video_id,
            lastUpdatedFormatted: stats.latest_published_at ? new Date(stats.latest_published_at).getTime() : 0,
            episodes: seasonResult.episodesList || []
        });
    }

    if (seriesSkipped && !isForce && fs.existsSync(seriesIndex)) {
        console.log(`  ⏩ Game Root skipped (All child seasons reported as up-to-date).`);
        return { success: true, skipped: true, totalEpisodes };
    }

    console.log(`  🏗️ Rebuilding Game Root Index for ${gameSlug}...`);
    
    if (!fs.existsSync(seriesPath)) fs.mkdirSync(seriesPath, { recursive: true });
    if (!fs.existsSync(`${seriesPath}/_manual`)) fs.mkdirSync(`${seriesPath}/_manual`, { recursive: true });

    const seriesPageHTML = seriesHTML({
        seriesTitle,
        channelSlug,
        gameSlug,
        shortPrefix: allPlaylists[0].short_prefix,
        syncDate: new Date().toISOString(),
        seasons: seasonsData
    });

    writeStaticPage(seriesIndex, seriesPageHTML);
    console.log(`  ✅ Wrote page: ${seriesIndex}`);

    if (!fs.existsSync(seriesManual)) {
        writeStaticPage(seriesManual, "\n");
    }

    return { success: true, skipped: false, totalEpisodes };
}