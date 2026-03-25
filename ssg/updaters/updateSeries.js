import fs from 'fs';
import { supabase } from '../utils/db.js';
import { updateSeason } from './updateSeason.js';
import { seriesHTML } from '../utils/templates/index.js';
import { writeStaticPage } from '../utils/fileSys.js';

export async function updateSeries(gameSlug, options = {}, channelFamily = null, rootChannelSlug = null) {
    const isForce = options.force || false;
    
    // Dropped the .order() here to handle custom sorting in JS
    const { data: rawPlaylists, error } = await supabase
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
        .eq('ltg_series.game_slug', gameSlug);

    if (error || !rawPlaylists.length) {
        console.error(`❌ Series error or not found: ${gameSlug}`, error?.message || '');
        return { success: false, skipped: false, totalEpisodes: 0 };
    }

    // Custom Sort: Descending by Major Number, Ascending by Minor Number (e.g. 5, 5.1, 5.2, 4)
    const allPlaylists = rawPlaylists.sort((a, b) => {
        const aMajor = Math.floor(a.season);
        const bMajor = Math.floor(b.season);
        if (aMajor !== bMajor) return bMajor - aMajor; // Descending major
        return a.season - b.season; // Ascending minor
    });

    const seriesTitle = allPlaylists[0].ltg_series.title;
    const gameTitle = allPlaylists[0].ltg_series.ltg_games?.title || seriesTitle;
    const gameTags = allPlaylists[0].ltg_series.ltg_games?.tags || [];
    const channelSlug = allPlaylists[0]?.channel_slug || rootChannelSlug || 'unknown';
    const seriesPath = `yt/${channelSlug}/${gameSlug}`;
    const seriesIndex = `${seriesPath}/index.html`;

    console.log(`\n📚 Processing Game: ${seriesTitle} (${allPlaylists.length} seasons)`);

    // Fetch Series Stats to calculate baseline averages & populate top panel
    const seriesSlug = allPlaylists[0].ltg_series.slug;
    const { data: seriesStats } = await supabase
        .from('ltg_series_stats')
        .select('*')
        .eq('series_slug', seriesSlug)
        .single();

    const seasonCount = allPlaylists.length || 1;
    const seriesVidsCount = seriesStats?.total_videos || 1; // Prevent div/0

    const averages = {
        // Per-Season Averages
        videos: Math.round((seriesStats?.total_videos || 0) / seasonCount),
        views: Math.round((seriesStats?.total_views || 0) / seasonCount),
        likes: Math.round((seriesStats?.total_likes || 0) / seasonCount),
        comments: Math.round((seriesStats?.total_comments || 0) / seasonCount),
        duration: Math.round((seriesStats?.total_duration || 0) / seasonCount),
        
        // Per-Video Averages (across the whole series)
        viewsPerVid: Math.round((seriesStats?.total_views || 0) / seriesVidsCount),
        likesPerVid: Math.round((seriesStats?.total_likes || 0) / seriesVidsCount),
        commentsPerVid: Math.round((seriesStats?.total_comments || 0) / seriesVidsCount),
        durPerVid: Math.round((seriesStats?.total_duration || 0) / seriesVidsCount)
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
            firstEpViews: seasonResult.firstEpViews || 0,
            lastEpViews: seasonResult.lastEpViews || 0,
            lastUpdatedFormatted: stats.latest_published_at ? new Date(stats.latest_published_at).getTime() : 0,
            episodes: seasonResult.episodesList || []
        });
    }

    // Calculate Series First and Last Episode Views for franchise retention
    // Finds chronological first/last safely, regardless of how the array is sorted
    const earliestSeason = seasonsData.reduce((prev, curr) => (prev.firstPub < curr.firstPub ? prev : curr), seasonsData[0]);
    const latestSeason = seasonsData.reduce((prev, curr) => (prev.lastPub > curr.lastPub ? prev : curr), seasonsData[0]);
    
    // Inject them directly into the seriesStats object so the template can easily grab them
    if (seriesStats) {
        seriesStats.firstEpViews = earliestSeason?.firstEpViews || 0;
        seriesStats.lastEpViews = latestSeason?.lastEpViews || 0;
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
        averages,
        seriesStats: seriesStats || {} // Pass full stats for the top panel
    });

    writeStaticPage(seriesIndex, seriesPageHTML);
    console.log(`  ✅ Wrote page: ${seriesIndex}`);

    return { success: true, skipped: false, totalEpisodes };
}