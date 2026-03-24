import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // UPDATED: Pointing to ltg_channels
        const { data: channels, error: fetchError } = await supabase
            .from('ltg_channels')
            .select('slug, twitch_channel, youtube_channel_id, kick_channel');

        if (fetchError) throw fetchError;
        if (!channels || channels.length === 0) return new Response("No channels found.", { status: 200 });

        const twitchToken = await getTwitchToken();

        // Run checks concurrently
        const operations = channels.map(async (channel) => {
            const checks = [];
            
            if (channel.twitch_channel) checks.push(checkTwitch(channel.twitch_channel, twitchToken));
            if (channel.kick_channel) checks.push(checkKick(channel.kick_channel));
            if (channel.youtube_channel_id) checks.push(checkYouTube(channel.youtube_channel_id));

            const results = await Promise.all(checks);
            const activeStreams = results.filter(r => r.isLive);
            
            const liveDataPayload = {
                is_live: activeStreams.length > 0,
                platforms: activeStreams.map(r => r.platform),
                viewers: activeStreams.reduce((max, r) => Math.max(max, r.viewers || 0), 0),
                last_checked: new Date().toISOString()
            };

            // UPDATED: Pointing to ltg_channels
            return supabase
                .from('ltg_channels')
                .update({ live_data: liveDataPayload })
                .eq('slug', channel.slug);
        });

        await Promise.all(operations);

        return new Response(JSON.stringify({ success: true, updated: channels.length }), {
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
        if (data.data && data.data.length > 0) return { isLive: true, viewers: data.data[0].viewer_count, platform: 'twitch' };
    } catch (e) {}
    return { isLive: false, platform: 'twitch' };
}

async function checkKick(handle) {
    try {
        const res = await fetch(`https://kick.com/api/v2/channels/${handle}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.livestream !== null) return { isLive: true, viewers: data.livestream.viewer_count, platform: 'kick' };
        }
    } catch (e) {}
    return { isLive: false, platform: 'kick' };
}

// ==========================================
// YOUTUBE (DOUBLE-GOOGLEBOT METHOD)
// ==========================================
async function checkYouTube(channelId) {
    try {
        if (!channelId.startsWith('UC') || channelId.length !== 24) {
            return { isLive: false, platform: 'youtube' };
        }

        const botHeaders = {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': 'text/html',
            'Accept-Language': 'en-US,en;q=0.9'
        };

        // 1. Get the Canonical URL to find the active Video ID
        const liveUrl = `https://www.youtube.com/channel/${channelId}/live`;
        const botRes = await fetch(liveUrl, { headers: botHeaders });
        const botHtml = await botRes.text();

        const canonicalMatch = botHtml.match(/<link rel="canonical" href="(.*?)">/);
        const canonicalStr = canonicalMatch ? canonicalMatch[1] : "";

        if (!canonicalStr.includes('/watch?v=')) {
            return { isLive: false, platform: 'youtube' };
        }

        // 2. Fetch the watch page directly to read the SEO live tags
        const videoRes = await fetch(canonicalStr, { headers: botHeaders });
        const videoHtml = await videoRes.text();

        if (videoHtml.includes('isLiveBroadcast":true') || 
            videoHtml.includes('"isLiveNow":true') || 
            videoHtml.includes('itemprop="isLiveBroadcast"')) {
            return { isLive: true, viewers: 0, platform: 'youtube' };
        }

    } catch (e) { 
        console.error(`YouTube error for ${channelId}:`, e); 
    }
    
    return { isLive: false, platform: 'youtube' };
}