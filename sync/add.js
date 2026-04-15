import axios from 'axios';
import { supabase } from '../ssg/utils/db.js';
import { syncPlaylist } from './syncPlaylist.js';

const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
    console.error("❌ Sync Error: Missing YOUTUBE_API_KEY in .env");
    process.exit(1);
}

async function addPlaylist(playlistId, gameSlugInput, season = 1.0) {
    if (!playlistId || !gameSlugInput) {
        console.log(`\n❌ Missing Arguments!`);
        console.log(`👉 Usage: node sync/add.js <PLAYLIST_ID> <GAME_SLUG> [SEASON_NUMBER]`);
        console.log(`👉 Example: node sync/add.js PL1234567890 backpack-battles 5.0\n`);
        process.exit(1);
    }

    console.log(`\n🚀 Initializing New Playlist Setup...`);

    // 1. Check if the playlist already exists
    const { data: existing } = await supabase
        .from('ltg_playlists')
        .select('id')
        .eq('id', playlistId)
        .single();

    if (existing) {
        console.error(`\n❌ Aborting: Playlist '${playlistId}' is already in the database!`);
        process.exit(1);
    }

    // 2. Fetch Playlist Info from YouTube first to get the Title
    console.log(`🔍 Fetching playlist metadata from YouTube...`);
    try {
        const res = await axios.get('https://www.googleapis.com/youtube/v3/playlists', {
            params: { part: 'snippet', id: playlistId, key: API_KEY }
        });

        if (!res.data.items || res.data.items.length === 0) {
            console.error(`\n❌ Could not find playlist on YouTube. Please double-check the ID.`);
            process.exit(1);
        }

        const snippet = res.data.items[0].snippet;
        const title = snippet.title;
        const ytChannelId = snippet.channelId;
        const cleanGameTitle = title.split(' - ')[0]; // Basic attempt to extract game name from "Game - Part 1"

        // 3. Ensure the Game exists
        console.log(`🎮 Ensuring game entry for '${gameSlugInput}'...`);
        const { error: gameErr } = await supabase.from('ltg_games').upsert({
            slug: gameSlugInput,
            title: cleanGameTitle
        }, { onConflict: 'slug' });
        if (gameErr) throw new Error(`Game Upsert Failed: ${gameErr.message}`);

        // 4. Ensure the Series exists (Mapping Game Slug to Series Slug 1:1 for new setups)
        const finalSeriesSlug = gameSlugInput;
        console.log(`📚 Ensuring series entry for '${finalSeriesSlug}'...`);
        const { error: seriesErr } = await supabase.from('ltg_series').upsert({
            slug: finalSeriesSlug,
            game_slug: gameSlugInput,
            title: cleanGameTitle
        }, { onConflict: 'slug' });
        if (seriesErr) throw new Error(`Series Upsert Failed: ${seriesErr.message}`);

        // 5. Map the YouTube Channel ID to your database channel slug
        const { data: channel } = await supabase
            .from('ltg_channels')
            .select('slug')
            .eq('youtube_channel_id', ytChannelId)
            .single();

        const channelSlug = channel ? channel.slug : 'letstrygg';

        // 6. Insert the new Playlist into the Database
        console.log(`💾 Saving '${title}' (Season ${season}) to database...`);
        const { error: insertErr } = await supabase.from('ltg_playlists').insert({
            id: playlistId,
            series_slug: finalSeriesSlug,
            channel_slug: channelSlug,
            season: parseFloat(season),
            title: title,
            playlist_type: 'game',
            status: 'ongoing'
        });

        if (insertErr) throw insertErr;

        console.log(`✅ Playlist registered successfully under series '${finalSeriesSlug}'!`);
        
        // 7. Trigger the downloader to backfill all the videos
        console.log(`📥 Triggering initial video sync...`);
        await syncPlaylist(playlistId);

        console.log(`\n🎉 All done! The playlist and all its videos are securely in the database.`);
        console.log(`🔨 Run 'node ssg/update.js season ${playlistId}' to generate the HTML pages.\n`);

    } catch (err) {
        console.error("\n❌ Fatal Error adding playlist:", err.message);
    }
}

const args = process.argv.slice(2);
const targetPlaylist = args[0];
const targetGame = args[1];
const targetSeason = args[2] || 1.0; 

addPlaylist(targetPlaylist, targetGame, targetSeason);