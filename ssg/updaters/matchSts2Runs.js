import { supabase } from '../utils/db.js';

export async function matchSts2Runs() {
    console.log(`\n🔗 Initiating Chronological Run-to-Video Matcher...`);

    // 1. Fetch all Spire 2 episodes by GAME slug (safely handles any series naming conventions)
    const { data: playlists, error: plError } = await supabase
        .from('ltg_playlists')
        .select(`
            id,
            ltg_series!inner ( game_slug ),
            ltg_playlist_videos (
                sort_order,
                ltg_videos!inner ( id, title, published_at )
            )
        `)
        .eq('ltg_series.game_slug', 'slay-the-spire-2');

    if (plError || !playlists || playlists.length === 0) {
        console.error("❌ Could not fetch Spire 2 playlist. Error:", plError?.message || "No playlists found.");
        return;
    }

    // Flatten and sort the episodes CHRONOLOGICALLY 
    // (We sort by publish date, NOT episode number, so multiple seasons don't overlap!)
    let episodes = [];
    playlists.forEach(pl => {
        if (!pl.ltg_playlist_videos) return;
        pl.ltg_playlist_videos.forEach(pv => {
            if (!pv.ltg_videos) return;
            episodes.push({
                epNum: pv.sort_order,
                videoId: pv.ltg_videos.id,
                title: pv.ltg_videos.title,
                publishedAt: new Date(pv.ltg_videos.published_at).getTime()
            });
        });
    });
    
    episodes.sort((a, b) => a.publishedAt - b.publishedAt);

    // 2. Fetch all runs chronologically
    const { data: runs, error: runsError } = await supabase
        .from('ltg_sts2_runs')
        .select('id, start_time, video_id')
        .order('start_time', { ascending: true });

    if (runsError || !runs) {
        console.error("❌ Could not fetch runs from DB:", runsError?.message);
        return;
    }

    // 3. The 1:1 Matcher Algorithm
    let runIndex = 0;
    const updates = [];

    console.log(`Found ${episodes.length} episodes and ${runs.length} runs. Attempting 1:1 match...`);

    for (const ep of episodes) {
        // Skip runs that are already assigned
        while (runIndex < runs.length && runs[runIndex].video_id !== null) {
            runIndex++;
        }

        if (runIndex >= runs.length) break; // Out of runs

        const currentRun = runs[runIndex];
        const runStartTime = new Date(currentRun.start_time).getTime();

        // TEMPORAL SAFEGUARD: The run must have happened BEFORE the video was published
        if (runStartTime > ep.publishedAt) {
            console.log(`⚠️ Skip: Run ${currentRun.id} happened after Episode ${ep.epNum} was published. Waiting for next episode.`);
            continue; 
        }

        // Match them!
        updates.push({
            id: currentRun.id,
            video_id: ep.videoId
        });

        console.log(`   Linked: Episode ${ep.epNum} -> Run ${currentRun.id}`);
        runIndex++;
    }

    // 4. Batch push updates to Supabase (Safe Update Loop)
    if (updates.length > 0) {
        console.log(`\n🚀 Pushing ${updates.length} links to the database...`);
        
        const updatePromises = updates.map(u => 
            supabase.from('ltg_sts2_runs').update({ video_id: u.video_id }).eq('id', u.id)
        );

        const results = await Promise.all(updatePromises);
        const hasError = results.find(r => r.error);

        if (hasError) {
            console.error("❌ Failed to link some runs:", hasError.error.message);
        } else {
            console.log(`✅ Successfully linked ${updates.length} runs! (${runs.length - updates.length} runs remain unassigned)`);
        }
    } else {
        console.log(`✅ No new links to make. Everything is up to date.`);
    }
}

if (process.argv[1].endsWith('matchSts2Runs.js')) {
    matchSts2Runs();
}