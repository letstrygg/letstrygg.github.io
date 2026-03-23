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
                        ltg_games(slug, title)
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
                ltg_games (slug)
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

export async function getFullSeriesContext(gameSlug) {
    const { data, error } = await supabase
        .from('ltg_series')
        .select(`
            slug,
            title,
            status,
            ltg_games!inner (slug, title),
            ltg_playlists (
                id,
                season,
                channel_slug,
                sync_date,
                title,
                ltg_playlist_videos (
                    sort_order,
                    ltg_videos (
                        id,
                        duration_seconds,
                        view_count,
                        published_at
                    )
                )
            )
        `)
        .eq('game_slug', gameSlug);

    if (error) throw error;
    
    if (!data || data.length === 0) {
        throw new Error(`No series found attached to game slug: '${gameSlug}'.`);
    }

    return data;
}