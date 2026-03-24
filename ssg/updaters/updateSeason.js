import fs from 'fs';
import { supabase } from '../utils/db.js';
import { seasonHTML, episodeHTML } from '../utils/templates/index.js';
import { writeStaticPage } from '../utils/fileSys.js';

export async function updateSeason(playlistId, options = {}) {
    const isForce = options.force || false;
    
    const { data: playlistData, error: plError } = await supabase
        .from('ltg_playlists')
        .select(`
            *, 
            ltg_series!inner(
                slug, 
                title,
                game_slug,
                ltg_games ( title, custom_abbr )
            )
        `)
        .eq('id', playlistId)
        .single();

    if (plError || !playlistData) {
        console.error(`❌ Playlist error: ${playlistId}`, plError?.message || '');
        return { success: false, skipped: false, episodesProcessed: 0, episodesList: [] };
    }

    const { data: episodes, error: epError } = await supabase
        .from('ltg_playlist_videos')
        .select(`
            sort_order,
            ltg_videos!inner (
                id, title, published_at, duration_seconds, view_count, likes, comments
            )
        `)
        .eq('playlist_id', playlistId)
        .order('sort_order', { ascending: true });

    if (epError) {
        console.error(`❌ Video fetch error for ${playlistId}`, epError.message);
        return { success: false, skipped: false, episodesProcessed: 0, episodesList: [] };
    }

    const gameSlug = playlistData.ltg_series.game_slug || playlistData.ltg_series.slug;
    const gameTitle = playlistData.ltg_series.ltg_games?.title || playlistData.ltg_series.title;
    
    // Decimal Season Logic
    const seasonNumStr = playlistData.season.toString();
    const seasonNumSafe = seasonNumStr.replace('.', '_'); // e.g., "3_2"
    const seasonParts = seasonNumStr.split('.');
    const paddedSeason = seasonParts[0].padStart(2, '0') + (seasonParts[1] ? '_' + seasonParts[1] : '');
    
    const dbAbbr = playlistData.ltg_series.ltg_games?.custom_abbr;
    const shortPrefix = dbAbbr ? dbAbbr.toLowerCase() : gameSlug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    
    const channelSlug = playlistData.channel_slug;
    
    const seasonPath = `yt/${channelSlug}/${gameSlug}/season-${seasonNumSafe}`;
    const seasonIndexPath = `${seasonPath}/index.html`;

    const dbSyncDate = playlistData.sync_date ? new Date(playlistData.sync_date).getTime() : 0;
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
                    episodesList: episodes.map(ep => ep.sort_order) 
                };
            }
        }
    }

    console.log(`\n  📂 Processing Season: ${playlistData.title} (Season ${seasonNumStr})`);
    
    if (!fs.existsSync(seasonPath)) fs.mkdirSync(seasonPath, { recursive: true });
    if (!fs.existsSync(`${seasonPath}/_manual`)) fs.mkdirSync(`${seasonPath}/_manual`, { recursive: true });

    const epNumbers = [];
    const fullEpisodesList = [];

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

        // Populate the list for the Season Index Page (Regardless of indexesOnly flag)
        fullEpisodesList.push({
            epNum: ep.sort_order,
            videoId: v.id,
            title: v.title,
            views: v.view_count || 0,
            likes: v.likes || 0,
            comments: v.comments || 0,
            duration: v.duration_seconds || 0,
            url: epUrl
        });

        // ONLY generate the actual Episode HTML files if NOT in indexesOnly mode
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
                isoDuration,
                views: v.view_count || 0,
                likes: v.likes || 0,
                comments: v.comments || 0,
                prevUrl,
                nextUrl,
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

    // Now pass the full array to the season template
    const seasonData = {
        gameTitle,
        seasonNum: seasonNumStr,
        channelSlug,
        gameSlug,
        shortPrefix,
        syncDate: playlistData.sync_date || new Date().toISOString(),
        manualContent: seasonManualContent,
        episodes: fullEpisodesList
    };

    const seasonPageHTML = seasonHTML(seasonData);
    writeStaticPage(seasonIndexPath, seasonPageHTML);
    console.log(`  ✅ Season Index generated at: ${seasonIndexPath}`);

    return { 
        success: true, 
        skipped: false, 
        episodesProcessed: episodes.length,
        episodesList: epNumbers
    };
}