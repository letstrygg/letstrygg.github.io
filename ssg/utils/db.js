import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Get exact directory of this file (C:\GitHub\letstrygg\ssg\utils)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Resolve the path to C:\GitHub\.env
const envPath = path.resolve(__dirname, '../../../.env');

// 3. Load the environment variables explicitly
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error(`❌ DB Init Error: Missing Supabase credentials. Looked in: ${envPath}`);
    process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Generic helper to get all context needed for a single video page
export async function getFullEpisodeContext(videoId) {
    const { data, error } = await supabase
        .from('ltg_videos')
        .select(`
            *,
            ltg_playlist_videos!inner(
                sort_order,
                ltg_playlists!inner(
                    id, season, title, channel_slug,
                    ltg_series!inner(
                        slug, title,
                        ltg_games(slug, title, custom_abbr)
                    )
                )
            )
        `)
        .eq('id', videoId)
        .single();

    if (error) throw error;
    return data;
}

// Helper to find the Prev/Next episodes in the same playlist
export async function getAdjacentEpisodes(playlistId, currentSortOrder) {
    const { data: prevData } = await supabase
        .from('ltg_playlist_videos')
        .select('video_id, sort_order')
        .eq('playlist_id', playlistId)
        .lt('sort_order', currentSortOrder)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

    const { data: nextData } = await supabase
        .from('ltg_playlist_videos')
        .select('video_id, sort_order')
        .eq('playlist_id', playlistId)
        .gt('sort_order', currentSortOrder)
        .order('sort_order', { ascending: true })
        .limit(1)
        .single();

    return { 
        prevSortOrder: prevData?.sort_order || null, 
        nextSortOrder: nextData?.sort_order || null 
    };
}

// Add this to your existing exports in ssg/utils/db.js
export async function getFullSeasonContext(playlistId) {
    const { data, error } = await supabase
        .from('ltg_playlists')
        .select(`
            id,
            season,
            channel_slug,
            sync_date, 
            ltg_series (
                slug,
                title,
                ltg_games (slug, custom_abbr)
            ),
            ltg_playlist_videos (
                video_id,
                sort_order
            )
        `)
        .eq('id', playlistId)
        .single();

    if (error) throw error;
    return data;
}

export async function getFullSeriesContext(gameSlug, channelFamily = null) {
    const { data, error } = await supabase
        .from('ltg_series')
        .select(`
            slug,
            title,
            status,
            ltg_games!inner (slug, title, custom_abbr),
            ltg_playlists (
                id,
                season,
                channel_slug,
                sync_date,
                title,
                playlist_type, 
                ltg_playlist_stats (
                    ep_count,
                    total_views,
                    total_duration,
                    latest_published_at,
                    first_video_id
                ),
                ltg_playlist_videos (
                    sort_order
                )
            )
        `)
        .eq('game_slug', gameSlug);

    if (error) throw error;

    let processedData = data;

    // Filter out non-games AND playlists outside the channel family
    processedData.forEach(series => {
        if (series.ltg_playlists) {
            series.ltg_playlists = series.ltg_playlists.filter(p => {
                // 1. Must be a game
                if (p.playlist_type !== 'game') return false;
                
                // 2. Must belong to the specified channel family (if provided)
                if (channelFamily && Array.isArray(channelFamily) && channelFamily.length > 0) {
                    return channelFamily.includes(p.channel_slug);
                }
                
                return true;
            });
        }
    });
    
    // Remove any series that now have 0 valid playlists after the filter
    processedData = processedData.filter(s => s.ltg_playlists && s.ltg_playlists.length > 0);
    
    if (!processedData || processedData.length === 0) {
        throw new Error(`No valid game series found attached to game slug: '${gameSlug}'.`);
    }

    return processedData;
}

// In ssg/utils/db.js
export async function getChannelContext(targetSlug) {
    // 1. Check if this channel has any children
    const { data: childrenData } = await supabase
        .from('ltg_channels')
        .select('slug')
        .eq('parent_channel', targetSlug);

    // Build our array of slugs to query (e.g., ['letstrygg', 'ltg-plus'])
    const slugsToFetch = [targetSlug];
    if (childrenData && childrenData.length > 0) {
        slugsToFetch.push(...childrenData.map(c => c.slug));
    }

	// 2. Fetch playlists for ALL channels in that family
    const { data, error } = await supabase
        .from('ltg_playlists')
        .select(`
            channel_slug,
            ltg_series!inner (
                ltg_games!inner (
                    slug,
                    title,
                    custom_abbr
                )
            )
        `)
        .in('channel_slug', slugsToFetch)
        .eq('playlist_type', 'game'); // <-- Strict DB-level filter

    if (error) throw error;
    
    if (!data || data.length === 0) {
        throw new Error(`No playlists found for channel family: '${slugsToFetch.join(', ')}'.`);
    }

    // 3. Group the games by their actual channel slug so the template can separate them
    const channelsMap = new Map();
    
    slugsToFetch.forEach(slug => {
        channelsMap.set(slug, new Map()); // Initialize an empty game map for each channel
    });

    data.forEach(p => {
        const cSlug = p.channel_slug;
        const game = p.ltg_series.ltg_games;
        
        const gameMap = channelsMap.get(cSlug);
        if (!gameMap.has(game.slug)) {
            gameMap.set(game.slug, {
                slug: game.slug,
                title: game.title,
                custom_abbr: game.custom_abbr,
                channelOwner: cSlug
            });
        }
    });

    // Convert our maps back into clean arrays
    const formattedChannels = Array.from(channelsMap.entries())
        .map(([slug, gamesMap]) => ({
            channelSlug: slug,
            isParent: slug === targetSlug, // Helps the template know which one is the main hub
            games: Array.from(gamesMap.values())
        }))
        .filter(c => c.games.length > 0); // Only pass channels that actually have games

    return {
        hubSlug: targetSlug, // The URL we are building the page on (yt/letstrygg/)
        channels: formattedChannels // Array of channels, each with their own games array
    };
}

export async function updateSeriesSyncDateByPlaylist(playlistId) {
    // 1. Find the series_slug AND the parent game_slug associated with this playlist
    const { data: playlist, error: fetchError } = await supabase
        .from('ltg_playlists')
        .select(`
            series_slug,
            ltg_series (
                game_slug
            )
        `)
        .eq('id', playlistId)
        .single();

    if (fetchError || !playlist?.series_slug) {
        console.error(`⚠️ Could not find parent series for playlist ${playlistId} to update sync_date.`);
        return null;
    }

    // 2. Update the sync_date on that series
    const { error: updateError } = await supabase
        .from('ltg_series')
        .update({ sync_date: new Date().toISOString() })
        .eq('slug', playlist.series_slug);

    if (updateError) {
        console.error(`❌ Failed to update sync_date for series ${playlist.series_slug}:`, updateError.message);
        return null;
    }

    console.log(`   >> Bubbled sync_date up to Series: ${playlist.series_slug}`);
    
    // Return the GAME SLUG so the SSG builder knows exactly which Game Root page to rebuild
    return playlist.ltg_series?.game_slug || playlist.series_slug.toLowerCase();
}