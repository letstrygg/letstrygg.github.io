import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { data: streamers, error: fetchError } = await supabase
            .from('ltg_streamers')
            .select('slug, twitch_channel, youtube_channel_id, kick_channel');

        if (fetchError) throw fetchError;
        if (!streamers || streamers.length === 0) return new Response("No streamers found.", { status: 200 });

        const twitchToken = await getTwitchToken();

        const updatePromises = streamers.map(async (streamer) => {
            // Fire all checks at the exact same time
            const checks = [];
            
            if (streamer.twitch_channel) checks.push(checkTwitch(streamer.twitch_channel, twitchToken));
            if (streamer.youtube_channel_id) checks.push(checkYouTube(streamer.youtube_channel_id));
            if (streamer.kick_channel) checks.push(checkKick(streamer.kick_channel));

            // Wait for all three platforms to respond
            const results = await Promise.all(checks);
            
            // Filter down to only the platforms where they are currently live
            const activeStreams = results.filter(r => r.isLive);
            
            const liveDataPayload = {
                is_live: activeStreams.length > 0,
                platforms: activeStreams.map(r => r.platform), // e.g., ['twitch', 'youtube']
                viewers: activeStreams.reduce((max, r) => Math.max(max, r.viewers || 0), 0), // Keeps highest viewer count
                last_checked: new Date().toISOString()
            };

            return supabase
                .from('ltg_streamers')
                .update({ live_data: liveDataPayload })
                .eq('slug', streamer.slug);
        });

        await Promise.all(updatePromises);

        return new Response(JSON.stringify({ success: true, updated: streamers.length }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (err) {
        console.error("Worker Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});

// ==========================================
// PLATFORM HELPER FUNCTIONS
// ==========================================

async function getTwitchToken() {
    const clientId = Deno.env.get('TWITCH_CLIENT_ID');
    const clientSecret = Deno.env.get('TWITCH_CLIENT_SECRET');
    if (!clientId || !clientSecret) return null;

    try {
        const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, { method: 'POST' });
        const data = await res.json();
        return data.access_token;
    } catch (e) { return null; }
}

async function checkTwitch(handle, token) {
    if (!token) return { isLive: false, platform: 'twitch' };
    const clientId = Deno.env.get('TWITCH_CLIENT_ID');
    
    try {
        const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${handle}`, {
            headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.data && data.data.length > 0) {
            return { isLive: true, viewers: data.data[0].viewer_count, platform: 'twitch' };
        }
    } catch (e) { console.error(`Twitch error for ${handle}:`, e); }
    return { isLive: false, platform: 'twitch' };
}

async function checkYouTube(channelId) {
    try {
        // 1. Check if they accidentally put a handle in, otherwise use the proper /channel/ URL
        let url = '';
        if (channelId.startsWith('UC') && channelId.length === 24) {
            url = `https://www.youtube.com/channel/${channelId}/live`;
        } else {
            // Fallback just in case you do have handles like '@destiny' stored
            const cleanHandle = channelId.startsWith('@') ? channelId : `@${channelId}`;
            url = `https://www.youtube.com/${cleanHandle}/live`;
        }
        
        // 2. Disguise the request
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        // 3. If they are offline, YouTube redirects to /streams or their main channel page
        if (!res.url.includes('/watch') && !res.url.includes('/live')) {
            return { isLive: false, platform: 'youtube' };
        }

        const html = await res.text();

        // 4. Broaden the search to catch multiple variations of YouTube's live flags
        const isLive = html.includes('itemprop="isLiveBroadcast"') || 
                       html.includes('"isLiveNow":true') || 
                       html.includes('isLiveContent');

        if (isLive) {
            const viewerMatch = html.match(/"viewCount":"(\d+)"/);
            const viewers = viewerMatch ? parseInt(viewerMatch[1], 10) : 0;
            return { isLive: true, viewers: viewers, platform: 'youtube' };
        }
    } catch (e) { 
        console.error(`YouTube error for ${channelId}:`, e); 
    }
    return { isLive: false, platform: 'youtube' };
}

async function checkKick(handle) {
    try {
        const res = await fetch(`https://kick.com/api/v2/channels/${handle}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.livestream !== null) {
                return { isLive: true, viewers: data.livestream.viewer_count, platform: 'kick' };
            }
        }
    } catch (e) { console.error(`Kick error for ${handle}:`, e); }
    return { isLive: false, platform: 'kick' };
}