import fs from 'fs';
import { supabase } from '../utils/db.js';
import { updateSeason } from './updateSeason.js';
import { seriesHTML } from '../utils/templates/index.js';
import { writeStaticPage } from '../utils/fileSys.js';

export async function updateSeries(gameSlug, options = {}, channelFamily = null, rootChannelSlug = null) {
    const isForce = options.force || false;
    
    const { data: allPlaylists, error } = await supabase
        .from('ltg_playlists')
        .select(`
            *,
            ltg_series!inner ( 
                slug, 
                title,
                game_slug,
                ltg_games ( title, tags, custom_abbr )
            ),
            ltg_playlist_stats ( ep_count, total_views, total_likes, total_comments, total_duration, latest_published_at, first_published_at, first_video_id )
        `)
        .eq('ltg_series.game_slug', gameSlug)
        .order('season', { ascending: true });

    if (error || !allPlaylists.length) {
        console.error(`❌ Series error or not found: ${gameSlug}`, error?.message || '');
        return { success: false, skipped: false, totalEpisodes: 0 };
    }

    const seriesTitle = allPlaylists[0].ltg_series.title;
    const gameTitle = allPlaylists[0].ltg_series.ltg_games?.title || seriesTitle;
    const gameTags = allPlaylists[0].ltg_series.ltg_games?.tags || [];
    const channelSlug = allPlaylists[0]?.channel_slug || rootChannelSlug || 'unknown';
    const seriesPath = `yt/${channelSlug}/${gameSlug}`;
    const seriesIndex = `${seriesPath}/index.html`;

    console.log(`\n📚 Processing Game: ${seriesTitle} (${allPlaylists.length} seasons)`);

    // Fetch Series Stats to calculate baseline averages
    const seriesSlug = allPlaylists[0].ltg_series.slug;
    const { data: seriesStats } = await supabase
        .from('ltg_series_stats')
        .select('*')
        .eq('series_slug', seriesSlug)
        .single();

    const seasonCount = allPlaylists.length || 1;
    const averages = {
        videos: Math.round((seriesStats?.total_videos || 0) / seasonCount),
        views: Math.round((seriesStats?.total_views || 0) / seasonCount),
        likes: Math.round((seriesStats?.total_likes || 0) / seasonCount),
        comments: Math.round((seriesStats?.total_comments || 0) / seasonCount),
        duration: Math.round((seriesStats?.total_duration || 0) / seasonCount)
    };

    let seriesSkipped = true;
    let totalEpisodes = 0;
    const seasonsData = [];

    for (const playlist of allPlaylists) {
        const seasonResult = await updateSeason(playlist.id, options);
        
        if (!seasonResult.skipped) {
            seriesSkipped = false;
        }
        
        totalEpisodes += seasonResult.episodesProcessed || 0;

        const stats = playlist.ltg_playlist_stats?.[0] || {};
        
        // --- STRICT STATUS MAPPING ---
        const displayStatus = playlist.status || 'Unknown';
        let sColor = 'gray'; 
        if (displayStatus === 'Active') sColor = 'green';
        else if (displayStatus === 'Complete') sColor = 'blue';
        else if (displayStatus === 'Pause') sColor = 'purple';
        else if (displayStatus === 'Abandon') sColor = 'red';

        seasonsData.push({
            id: playlist.id,
            seasonNum: playlist.season,
            title: playlist.title,
            status: displayStatus,
            statusColor: sColor,
            epCount: stats.ep_count || 0,
            totalViews: stats.total_views || 0,
            totalLikes: stats.total_likes || 0,
            totalComments: stats.total_comments || 0,
            totalDuration: stats.total_duration || 0,
            firstPub: stats.first_published_at || null,
            lastPub: stats.latest_published_at || null,
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

    const dbAbbr = allPlaylists[0].ltg_series.ltg_games?.custom_abbr;
    const shortPrefix = dbAbbr ? dbAbbr.toLowerCase() : gameSlug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();

    const seriesManual = `${seriesPath}/_manual/index.html`;
    let seriesManualContent = "\n";
    if (fs.existsSync(seriesManual)) {
        seriesManualContent = fs.readFileSync(seriesManual, 'utf8');
    } else {
        writeStaticPage(seriesManual, seriesManualContent);
    }

    const seriesPageHTML = seriesHTML({
        gameTitle,
        seriesTitle,
        channelSlug,
        gameSlug,
        shortPrefix: shortPrefix,
        syncDate: new Date().toISOString(),
        seasons: seasonsData,
        tags: gameTags,
        manualContent: seriesManualContent,
        averages // Pass the averages to the template
    });

    writeStaticPage(seriesIndex, seriesPageHTML);
    console.log(`  ✅ Wrote page: ${seriesIndex}`);

    return { success: true, skipped: false, totalEpisodes };
}