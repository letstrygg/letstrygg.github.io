import fs from 'fs';
import { supabase } from '../utils/db.js';
import { seasonHTML, episodeHTML } from '../utils/templates/index.js';
import { writeStaticPage } from '../utils/fileSys.js';
import { processAdminTags, getClientTagConfig } from '../utils/tagParser.js';

// --- NEW: Slugify Helper ---
function slugify(text) {
    return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

export async function updateSeason(playlistId, options = {}) {
    const isForce = options.force || false;
    
    // 1. Fetch Playlist + Series Info + NEW Playlist Stats
    const { data: playlistData, error: plError } = await supabase
        .from('ltg_playlists')
        .select(`
            *, 
            ltg_series!inner(
                slug, 
                title,
                game_slug,
                ltg_games ( title, custom_abbr, tags ) 
            ),
            ltg_playlist_stats ( ep_count, total_views, total_likes, total_comments, total_duration, latest_published_at, first_published_at )
        `)
        .eq('id', playlistId)
        .single();

    if (plError || !playlistData) {
        console.error(`❌ Playlist error: ${playlistId}`, plError?.message || '');
        return { success: false, skipped: false, episodesProcessed: 0, episodesList: [] };
    }

    // --- ADDED 'tags' and 'auto_tags' TO THE SELECT QUERY HERE ---
    const { data: episodes, error: epError } = await supabase
        .from('ltg_playlist_videos')
        .select(`
            sort_order,
            ltg_videos!inner (
                id, title, published_at, duration_seconds, view_count, likes, comments, tags, auto_tags
            )
        `)
        .eq('playlist_id', playlistId)
        .order('sort_order', { ascending: true });

    if (epError) {
        console.error(`❌ Video fetch error for ${playlistId}`, epError.message);
        return { success: false, skipped: false, episodesProcessed: 0, episodesList: [] };
    }

    // --- GAME TAGS ---
    const rawTags = playlistData.ltg_series.ltg_games?.tags || [];
    const tagsArr = rawTags.map(t => ({ name: t.trim(), slug: slugify(t) }));
    const tagsString = rawTags.join(', ');

    // Grab first and last episode views for drop-off rate
    const firstEpViews = episodes.length > 0 ? (episodes[0].ltg_videos.view_count || 0) : 0;
    const lastEpViews = episodes.length > 0 ? (episodes[episodes.length - 1].ltg_videos.view_count || 0) : 0;

    // 2. Fetch Series Averages for the Deltas
    const seriesSlug = playlistData.ltg_series.slug;
    
    const { data: seriesStats } = await supabase
        .from('ltg_series_stats')
        .select('*')
        .eq('series_slug', seriesSlug)
        .single();

    const { count: seasonCount } = await supabase
        .from('ltg_playlists')
        .select('*', { count: 'exact', head: true })
        .eq('series_slug', seriesSlug);

    // Calculate Baseline Averages
    const sCount = seasonCount || 1;
    const averages = {
        videos: Math.round((seriesStats?.total_videos || 0) / sCount),
        views: Math.round((seriesStats?.total_views || 0) / sCount),
        likes: Math.round((seriesStats?.total_likes || 0) / sCount),
        comments: Math.round((seriesStats?.total_comments || 0) / sCount),
        duration: Math.round((seriesStats?.total_duration || 0) / sCount)
    };

    // Format Current Season Stats
    const plStats = playlistData.ltg_playlist_stats?.[0] || {};
    const stats = {
        videos: plStats.ep_count || 0,
        views: plStats.total_views || 0,
        likes: plStats.total_likes || 0,
        comments: plStats.total_comments || 0,
        duration: plStats.total_duration || 0,
        firstPub: plStats.first_published_at || null,
        lastPub: plStats.latest_published_at || null
    };

    const gameSlug = playlistData.ltg_series.game_slug || playlistData.ltg_series.slug;
    const gameTitle = playlistData.ltg_series.ltg_games?.title || playlistData.ltg_series.title;
    
    // Decimal Season Logic
    const seasonNumStr = playlistData.season.toString();
    const seasonNumSafe = seasonNumStr.replace('.', '_'); 
    const seasonParts = seasonNumStr.split('.');
    const paddedSeason = seasonParts[0].padStart(2, '0') + (seasonParts[1] ? '_' + seasonParts[1] : '');
    
    const dbAbbr = playlistData.ltg_series.ltg_games?.custom_abbr;
    const shortPrefix = dbAbbr ? dbAbbr.toLowerCase() : gameSlug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    
    const channelSlug = playlistData.channel_slug;
    
    const seasonPath = `yt/${channelSlug}/${gameSlug}/season-${seasonNumSafe}`;
    const seasonIndexPath = `${seasonPath}/index.html`;

    const dbSyncDate = playlistData.sync_date ? new Date(playlistData.sync_date).getTime() : 0;
    
    // --- BYPASS CACHE IF FORCED OR TAGS NEED UPDATING ---
    if (!isForce && fs.existsSync(seasonIndexPath)) {
        const fileContent = fs.readFileSync(seasonIndexPath, 'utf8');
        const match = fileContent.match(/sync_date:\s*"([^"]+)"/);
        if (match) {
            const htmlSyncDate = new Date(match[1]).getTime();
            if (htmlSyncDate >= dbSyncDate) {
                return { 
                    success: true, 
                    skipped: true, 
                    episodesProcessed: episodes.length,
                    episodesList: episodes.map(ep => ep.sort_order),
                    firstEpViews,
                    lastEpViews
                };
            }
        }
    }

    console.log(`\n  📂 Processing Season: ${playlistData.title} (Season ${seasonNumStr})`);
    
    if (!fs.existsSync(seasonPath)) fs.mkdirSync(seasonPath, { recursive: true });
    if (!fs.existsSync(`${seasonPath}/_manual`)) fs.mkdirSync(`${seasonPath}/_manual`, { recursive: true });

    const epNumbers = [];
    const fullEpisodesList = [];
    
    // --- LOAD UI CONFIG ONCE PER SEASON FOR EFFICIENCY ---
    const clientTagConfig = getClientTagConfig(gameSlug);
    const clientTagConfigStr = JSON.stringify(clientTagConfig);

    if (!options.indexesOnly) {
        console.log(`  Found ${episodes.length} episodes. Generating files...`);
    } else {
        console.log(`  ⏩ Skipped episode page generation for Season ${seasonNumStr} (--indexes-only active). Aggregating stats for index...`);
    }

    for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i];
        const v = ep.ltg_videos;
        epNumbers.push(ep.sort_order); 

        const paddedEp = String(ep.sort_order).padStart(2, '0'); 
        const fileName = `${shortPrefix}-s${paddedSeason}e${paddedEp}.html`;
        const epPath = `${seasonPath}/${fileName}`;
        const epManualPath = `${seasonPath}/_manual/${fileName}`;
        const epUrl = `/yt/${channelSlug}/${gameSlug}/season-${seasonNumSafe}/${fileName}`;

        fullEpisodesList.push({
            epNum: ep.sort_order,
            videoId: v.id,
            title: v.title,
            views: v.view_count || 0,
            likes: v.likes || 0,
            comments: v.comments || 0,
            duration: v.duration_seconds || 0,
            url: epUrl,
            publishedAt: v.published_at
        });

        if (!options.indexesOnly) {
            let prevUrl = null;
            if (i > 0) {
                const prevEpNum = String(episodes[i - 1].sort_order).padStart(2, '0'); 
                prevUrl = `/yt/${channelSlug}/${gameSlug}/season-${seasonNumSafe}/${shortPrefix}-s${paddedSeason}e${prevEpNum}.html`;
            }

            let nextUrl = null;
            if (i < episodes.length - 1) {
                const nextEpNum = String(episodes[i + 1].sort_order).padStart(2, '0'); 
                nextUrl = `/yt/${channelSlug}/${gameSlug}/season-${seasonNumSafe}/${shortPrefix}-s${paddedSeason}e${nextEpNum}.html`;
            }

            const h = Math.floor(v.duration_seconds / 3600);
            const m = Math.floor((v.duration_seconds % 3600) / 60);
            const s = v.duration_seconds % 60;
            const durationFormatted = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
            
            const isoDuration = `PT${h > 0 ? h + 'H' : ''}${m > 0 ? m + 'M' : ''}${s}S`;

            let thumbnail = `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`;

            let manualContent = "\n";
            if (fs.existsSync(epManualPath)) {
                manualContent = fs.readFileSync(epManualPath, 'utf8');
            } else {
                writeStaticPage(epManualPath, manualContent);
            }

            // --- ADMIN TAG PARSING FOR THIS SPECIFIC EPISODE ---
            const mergedTags = [...(v.tags || []), ...(v.auto_tags || [])];
            const adminTagsData = processAdminTags(mergedTags);

            const epData = {
                id: v.id,
                title: v.title,
                seriesTitle: playlistData.ltg_series.title,
                gameSlug,
                channelSlug,
                seasonNum: seasonNumStr,
                episodeNum: ep.sort_order,
                fileName,
                shortPrefix,
                thumbnail,
                publishedAt: new Date(v.published_at).toLocaleDateString(),
                rawPublishedAt: v.published_at,
                durationFormatted,
                durationSeconds: v.duration_seconds,
                isoDuration,
                views: v.view_count || 0,
                likes: v.likes || 0,
                comments: v.comments || 0,
                prevUrl,
                nextUrl,
                tags: tagsArr,               
                tagsString: tagsString,      
                adminTagGroups: adminTagsData.groups,         // <-- CHANGED
                adminTagsMeta: adminTagsData.metaString,      
                clientTagConfigStr: clientTagConfigStr,       
                manualContent
            };

            const epHTML = episodeHTML(epData);
            writeStaticPage(epPath, epHTML);
        }
    }

    const seasonManualIndex = `${seasonPath}/_manual/index.html`;
    let seasonManualContent = "\n";
    if (fs.existsSync(seasonManualIndex)) {
        seasonManualContent = fs.readFileSync(seasonManualIndex, 'utf8');
    } else {
        writeStaticPage(seasonManualIndex, seasonManualContent);
    }

    const seasonData = {
        gameTitle,
        seriesTitle: playlistData.ltg_series.title,
        seasonNum: seasonNumStr,
        channelSlug,
        gameSlug,
        shortPrefix,
        syncDate: playlistData.sync_date || new Date().toISOString(),
        tags: tagsArr,               
        tagsString: tagsString,      
        manualContent: seasonManualContent,
        episodes: fullEpisodesList,
        stats,
        averages
    };

    const seasonPageHTML = seasonHTML(seasonData);
    writeStaticPage(seasonIndexPath, seasonPageHTML);
    console.log(`  ✅ Season Index generated at: ${seasonIndexPath}`);

    return { 
        success: true, 
        skipped: false, 
        episodesProcessed: episodes.length,
        episodesList: epNumbers,
        firstEpViews,
        lastEpViews
    };
}