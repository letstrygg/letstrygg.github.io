import axios from 'axios';
import { supabase } from '../ssg/utils/db.js';

// Get API Key from the already-loaded environment (handled by db.js)
const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
    console.error("❌ Sync Error: Missing YOUTUBE_API_KEY in .env");
    process.exit(1);
}

// --- Duration Parser ---
function parseDuration(durationString) {
    if (!durationString) return 0;
    const matches = durationString.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = matches?.[1] ? parseInt(matches[1]) : 0;
    const minutes = matches?.[2] ? parseInt(matches[2]) : 0;
    const seconds = matches?.[3] ? parseInt(matches[3]) : 0;
    return hours * 3600 + minutes * 60 + seconds;
}

// --- Fetch all video IDs in a playlist ---
async function fetchAllPlaylistItems(playlistId, nextPageToken = null, allItems = []) {
    try {
        const res = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
            params: {
                part: 'contentDetails',
                playlistId: playlistId,
                key: API_KEY,
                maxResults: 50,
                pageToken: nextPageToken
            }
        });

        const items = res.data.items || [];
        allItems.push(...items);

        if (res.data.nextPageToken) {
            return await fetchAllPlaylistItems(playlistId, res.data.nextPageToken, allItems);
        }

        return allItems;
    } catch (err) {
        console.error(`❌ YouTube API Error (Playlist Items):`, err.response?.data?.error?.message || err.message);
        throw err;
    }
}

// --- Fetch detailed stats for batches of videos ---
async function fetchVideoDetails(videoIds) {
    const processedVideos = [];
    const batchSize = 50;

    for (let i = 0; i < videoIds.length; i += batchSize) {
        const batch = videoIds.slice(i, i + batchSize);
        const idsString = batch.join(',');

        process.stdout.write(`\r   >> Fetching YouTube details: batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(videoIds.length / batchSize)}... `);

        try {
            const res = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
                params: {
                    part: 'snippet,contentDetails,statistics',
                    id: idsString,
                    key: API_KEY
                }
            });

            processedVideos.push(...res.data.items);
        } catch (err) {
            console.error(`\n❌ YouTube API Error (Video Details):`, err.response?.data?.error?.message || err.message);
            throw err;
        }
    }
    console.log(`\n   ✅ Fetched metadata for ${processedVideos.length} videos.`);
    return processedVideos;
}

// --- Main Sync Function ---
export async function syncPlaylist(playlistId) {
    console.log(`\n🔄 Starting Sync for Playlist: ${playlistId}`);
    
    // 1. Fetch from YouTube
    console.log(`   >> Scanning playlist for items...`);
    const playlistItems = await fetchAllPlaylistItems(playlistId);
    
    if (playlistItems.length === 0) {
        console.log(`⚠️ Playlist is empty or not found.`);
        return;
    }

    // Preserve the exact order the videos appear in the YouTube Playlist
    const orderedVideoIds = playlistItems.map(item => item.contentDetails.videoId);
    
    // 2. Fetch rich metadata for those videos
    const rawVideos = await fetchVideoDetails(orderedVideoIds);

    // 3. Format payload for `ltg_videos`
    const videosPayload = rawVideos.map(v => ({
        id: v.id,
        title: v.snippet.title,
        published_at: v.snippet.publishedAt,
        duration_seconds: parseDuration(v.contentDetails.duration),
        view_count: parseInt(v.statistics.viewCount || '0', 10),
        likes: parseInt(v.statistics.likeCount || '0', 10),
        comments: parseInt(v.statistics.commentCount || '0', 10)
    }));

    // 4. Format payload for `ltg_playlist_videos` (The Junction Table)
    const junctionPayload = orderedVideoIds.map((vid, index) => ({
        playlist_id: playlistId,
        video_id: vid,
        sort_order: index + 1 // Ep 1, Ep 2, Ep 3, etc. based on playlist order
    })).filter(j => rawVideos.some(rv => rv.id === j.video_id)); // Safety check: only link videos that actually exist/weren't deleted

    try {
        // 5. Upsert Videos into Database
        console.log(`   >> Upserting ${videosPayload.length} videos into database...`);
        const { error: videoError } = await supabase
            .from('ltg_videos')
            .upsert(videosPayload, { onConflict: 'id' });
        
        if (videoError) throw videoError;

        // 6. Upsert Junction Links into Database
        console.log(`   >> Updating playlist sort orders...`);
        const { error: junctionError } = await supabase
            .from('ltg_playlist_videos')
            .upsert(junctionPayload, { onConflict: 'playlist_id, video_id' });

        if (junctionError) throw junctionError;

        // 7. Update the Playlist sync_date
        const { error: syncError } = await supabase
            .from('ltg_playlists')
            .update({ sync_date: new Date().toISOString() })
            .eq('id', playlistId);
            
        if (syncError) throw syncError;

        console.log(`✅ Sync Complete! Playlist ${playlistId} is up to date.`);

    } catch (dbError) {
        console.error(`❌ Database Sync Error:`, dbError.message);
    }
}