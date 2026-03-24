import axios from 'axios';
import { supabase } from '../ssg/utils/db.js';

const API_KEY = process.env.YOUTUBE_API_KEY;
const LTG_PLUS_ID = 'UCxLetgjZot172Atpf5NpIaA';

if (!API_KEY) {
    console.error("❌ Missing YOUTUBE_API_KEY in .env");
    process.exit(1);
}

async function getLtgPlusPlaylists() {
    let playlistIds = [];
    let nextPageToken = '';
    
    console.log(`📡 Fetching playlists from YouTube for ltg-plus...`);
    try {
        do {
            const res = await axios.get('https://www.googleapis.com/youtube/v3/playlists', {
                params: {
                    part: 'id',
                    channelId: LTG_PLUS_ID,
                    maxResults: 50,
                    pageToken: nextPageToken,
                    key: API_KEY
                }
            });
            
            // We only need the physical IDs to match against our database
            playlistIds.push(...res.data.items.map(item => item.id));
            nextPageToken = res.data.nextPageToken;
            
        } while (nextPageToken);
        
        console.log(`   >> Found ${playlistIds.length} playlists on YouTube.`);
        return playlistIds;
        
    } catch (err) {
        console.error(`❌ YouTube API Error:`, err.response?.data?.error?.message || err.message);
        process.exit(1);
    }
}

async function runPatch() {
    const ytIds = await getLtgPlusPlaylists();

    console.log(`\n💾 Patching Supabase...`);
    
    // Using .in('id', ytIds) guarantees we ONLY update playlists that YouTube says 
    // belong to ltg-plus AND that you have explicitly imported into your database.
    const { data, error } = await supabase
        .from('ltg_playlists')
        .update({ channel_slug: 'ltg-plus' })
        .in('id', ytIds)
        .select('id, title'); // Ask Supabase to return the rows it successfully updated

    if (error) {
        console.error(`❌ Database Update Failed:`, error.message);
        process.exit(1);
    }

    console.log(`✅ Success! Migrated ${data.length} playlists to 'ltg-plus'.`);
    
    // Print out the exact playlists it changed so you can visually verify
    console.log(`\n📋 Updated Playlists:`);
    data.forEach(p => console.log(` - ${p.title} (${p.id})`));
}

runPatch();