import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Get exact directory of this file (C:\GitHub\letstrygg\ssg\utils)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Resolve the path to C:\GitHub\.env (Up 3 levels: utils -> ssg -> letstrygg -> GitHub)
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