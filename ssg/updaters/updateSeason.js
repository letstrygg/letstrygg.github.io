import fs from 'fs';
import { supabase } from '../utils/db.js';
import { seasonHTML, episodeHTML } from '../utils/templates/index.js';
import { writeStaticPage } from '../utils/fileSys.js';

export async function updateSeason(playlistId, options = {}) {
    const isForce = options.force || false;
    
    const { data: playlistData, error: plError } = await supabase
        .from('ltg_playlists')
        .select(`*, ltg_series!inner(slug, title)`)
        .eq('id', playlistId)
        .single();

    if (plError || !playlistData) {
        console.error(`❌ Playlist error: ${playlistId}`, plError?.message || '');
        return { success: false, skipped: false, episodesProcessed: 0, episodesList: [] };
    }

    const { data: episodes, error: epError } = await supabase
        .from('ltg_playlist_videos')
        .select(`
            episode_num,
            ltg_videos!inner (
                id, title, published_at, duration_seconds, view_count, like_count, comment_count, thumbnails
            )
        `)
        .eq('playlist_id', playlistId)
        .order('episode_num', { ascending: true });

    if (epError) {
        console.error(`❌ Video fetch error for ${playlistId}`, epError.message);
        return { success: false, skipped: false, episodesProcessed: 0, episodesList: [] };
    }

    const gameSlug = playlistData.ltg_series.slug;
    const seasonNum = playlistData.season_num;
    const shortPrefix = playlistData.short_prefix;
    const channelSlug = playlistData.channel_slug;
    
    const seasonPath = `yt/${channelSlug}/${gameSlug}/season-${Math.floor(seasonNum)}`;
    const seasonIndexPath = `${seasonPath}/index.html`;

    // Skip Logic
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
                    episodesList: episodes.map(ep => ep.episode_num)
                };
            }
        }
    }

    console.log(`\n  📂 Processing Season: ${playlistData.title} (Season ${seasonNum})`);
    
    if (!fs.existsSync(seasonPath)) fs.mkdirSync(seasonPath, { recursive: true });
    if (!fs.existsSync(`${seasonPath}/_manual`)) fs.mkdirSync(`${seasonPath}/_manual`, { recursive: true });

    const epNumbers = [];

    // Generate individual episodes IF NOT skipping indexes
    if (!options.indexesOnly) {
        console.log(`  Found ${episodes.length} episodes. Generating files...`);
        for (let i = 0; i < episodes.length; i++) {
            const ep = episodes[i];
            const v = ep.ltg_videos;
            epNumbers.push(ep.episode_num);

            const paddedSeason = String(Math.floor(seasonNum)).padStart(2, '0');
            const paddedEp = String(ep.episode_num).padStart(2, '0');
            const fileName = `${shortPrefix}-s${paddedSeason}e${paddedEp}.html`;
            const epPath = `${seasonPath}/${fileName}`;
            const epManualPath = `${seasonPath}/_manual/${fileName}`;

            let prevUrl = null;
            if (i > 0) {
                const prevEpNum = String(episodes[i - 1].episode_num).padStart(2, '0');
                prevUrl = `/yt/${channelSlug}/${gameSlug}/season-${Math.floor(seasonNum)}/${shortPrefix}-s${paddedSeason}e${prevEpNum}.html`;
            }

            let nextUrl = null;
            if (i < episodes.length - 1) {
                const nextEpNum = String(episodes[i + 1].episode_num).padStart(2, '0');
                nextUrl = `/yt/${channelSlug}/${gameSlug}/season-${Math.floor(seasonNum)}/${shortPrefix}-s${paddedSeason}e${nextEpNum}.html`;
            }

            const h = Math.floor(v.duration_seconds / 3600);
            const m = Math.floor((v.duration_seconds % 3600) / 60);
            const s = v.duration_seconds % 60;
            const durationFormatted = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
            
            // Handle ISO duration for schema
            const isoDuration = `PT${h > 0 ? h + 'H' : ''}${m}M${s}S`;

            let thumbnail = v.thumbnails?.maxres?.url || v.thumbnails?.high?.url || v.thumbnails?.default?.url;

            const epData = {
                id: v.id,
                title: v.title,
                seriesTitle: playlistData.ltg_series.title,
                gameSlug,
                channelSlug,
                seasonNum,
                episodeNum: ep.episode_num,
                fileName,
                shortPrefix,
                thumbnail,
                publishedAt: new Date(v.published_at).toLocaleDateString(),
                rawPublishedAt: v.published_at,
                durationFormatted,
                isoDuration,
                views: v.view_count || 0,
                likes: v.like_count || 0,
                comments: v.comment_count || 0,
                prevUrl,
                nextUrl
            };

            const epHTML = episodeHTML(epData);
            writeStaticPage(epPath, epHTML);
            
            if (!fs.existsSync(epManualPath)) {
                writeStaticPage(epManualPath, "\n");
            }
        }
    } else {
        // Just collect the numbers for the series index without building the files
        episodes.forEach(ep => epNumbers.push(ep.episode_num));
        console.log(`  ⏩ Skipped episode generation for Season ${seasonNum} (--indexes-only active)`);
    }

    // Always rebuild the Season Index page
    const seasonData = {
        seriesTitle: playlistData.ltg_series.title,
        seasonNum,
        channelSlug,
        gameSlug,
        shortPrefix,
        syncDate: playlistData.sync_date || new Date().toISOString()
    };

    const seasonPageHTML = seasonHTML(seasonData);
    writeStaticPage(seasonIndexPath, seasonPageHTML);
    console.log(`  ✅ Season Index generated at: ${seasonIndexPath}`);

    const seasonManualIndex = `${seasonPath}/_manual/index.html`;
    if (!fs.existsSync(seasonManualIndex)) {
        writeStaticPage(seasonManualIndex, "\n");
    }

    return { 
        success: true, 
        skipped: false, 
        episodesProcessed: episodes.length,
        episodesList: epNumbers
    };
}