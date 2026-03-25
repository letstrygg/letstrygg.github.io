import fs from 'fs';
import path from 'path';
import { supabase } from '../ssg/utils/db.js';
import { syncPlaylist } from './syncPlaylist.js';

function ensureLogDir() {
    const logDir = path.resolve('sync_logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    return logDir;
}

export async function syncChannel(channelSlug, isFullSync = false) {
    console.log(`\n🧠 Initiating ${isFullSync ? 'FULL' : 'Smart'} Sync for Channel: ${channelSlug}...`);

    // 1. Fetch all game playlists for this channel with their stats
    const { data: playlists, error } = await supabase
        .from('ltg_playlists')
        .select(`
            id,
            title,
            sync_date,
            ltg_series ( game_slug ),
            ltg_playlist_stats (
                ep_count,
                total_views,
                latest_published_at
            )
        `)
        .eq('channel_slug', channelSlug)
        .eq('playlist_type', 'game');

    if (error || !playlists) {
        throw new Error(`Failed to fetch playlists for ${channelSlug}: ${error?.message}`);
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Map the raw DB data into an easily sortable array
    const pool = playlists.map(p => {
        const stats = p.ltg_playlist_stats?.[0] || { ep_count: 0, total_views: 0, latest_published_at: 0 };
        const lastUpload = stats.latest_published_at ? new Date(stats.latest_published_at).getTime() : 0;
        const lastSync = p.sync_date ? new Date(p.sync_date).getTime() : 0;

        return {
            id: p.id,
            title: p.title,
            gameSlug: p.ltg_series?.game_slug,
            lastUpload,
            lastSync,
            daysSinceUpload: lastUpload > 0 ? (now - lastUpload) / dayMs : Infinity,
            oldViews: stats.total_views,
            oldEps: stats.ep_count
        };
    });

    const queue = [];
    const queuedIds = new Set();

    const addToQueue = (item, reason) => {
        if (!queuedIds.has(item.id)) {
            queue.push({ ...item, reason });
            queuedIds.add(item.id);
        }
    };

    if (isFullSync) {
        console.log(`\n🚨 FULL SYNC FLAG DETECTED: Bypassing smart buckets. Syncing all ${pool.length} playlists.`);
        // Sort by oldest sync first
        pool.sort((a, b) => a.lastSync - b.lastSync).forEach(p => addToQueue(p, 'Full Sync (--all)'));
    } else {
        // --- BUCKET 1: 6 Most Recently Uploaded ---
        const sortedByUpload = [...pool].sort((a, b) => b.lastUpload - a.lastUpload);
        sortedByUpload.slice(0, 6).forEach(p => addToQueue(p, 'Top 6 Most Recent'));

        // --- BUCKET 2: 30 Days (Most Stale Sync) ---
        const stale30 = [...pool].filter(p => !queuedIds.has(p.id) && p.daysSinceUpload <= 30).sort((a, b) => a.lastSync - b.lastSync);
        stale30.slice(0, 6).forEach(p => addToQueue(p, '<= 30 Days (Stale)'));

        // --- BUCKET 3: 90 Days (Most Stale Sync) ---
        const stale90 = [...pool].filter(p => !queuedIds.has(p.id) && p.daysSinceUpload > 30 && p.daysSinceUpload <= 90).sort((a, b) => a.lastSync - b.lastSync);
        stale90.slice(0, 6).forEach(p => addToQueue(p, '<= 90 Days (Stale)'));

        // --- BUCKET 4: 365 Days (Most Stale Sync) ---
        const stale365 = [...pool].filter(p => !queuedIds.has(p.id) && p.daysSinceUpload > 90 && p.daysSinceUpload <= 365).sort((a, b) => a.lastSync - b.lastSync);
        stale365.slice(0, 6).forEach(p => addToQueue(p, '<= 365 Days (Stale)'));

        // --- BUCKET 5: Overall Oldest Syncs ---
        const staleAll = [...pool].filter(p => !queuedIds.has(p.id)).sort((a, b) => a.lastSync - b.lastSync);
        staleAll.slice(0, 6).forEach(p => addToQueue(p, 'Oldest Overall'));
    }

    console.log(`\n🎯 Sync queued ${queue.length} playlists.`);

    const resultsLog = [];
    const affectedGames = new Set();
    const syncErrors = []; // <-- NEW: Track errors for the summary

    // 2. Execute the Syncs
    for (const plan of queue) {
        console.log(`\n=========================================`);
        console.log(`[${plan.reason}] ${plan.title}`);
        console.log(`=========================================`);

        try {
            // Run the worker
            const syncResult = await syncPlaylist(plan.id);
            
            // Catch explicit error returns if your script uses them
            if (syncResult && syncResult.error) {
                syncErrors.push(`[${plan.title}]: ${syncResult.error}`);
                continue; // Skip the stats check
            }
            
            if (plan.gameSlug) affectedGames.add(plan.gameSlug);

        } catch (err) {
            // Catch hard throws from the worker
            syncErrors.push(`[${plan.title}]: ${err.message}`);
            continue; // Skip the stats check for this broken playlist
        }

        // Fetch fresh stats to calculate deltas
        const { data: freshStats } = await supabase
            .from('ltg_playlist_stats')
            .select('ep_count, total_views')
            .eq('playlist_id', plan.id)
            .single();

        const newViews = freshStats?.total_views || 0;
        const newEps = freshStats?.ep_count || 0;
        
        const hoursSinceSync = plan.lastSync > 0 ? ((now - plan.lastSync) / (1000 * 60 * 60)).toFixed(2) : 'Never';

        resultsLog.push({
            playlist: plan.title,
            reason: plan.reason,
            hoursSinceLastSync: hoursSinceSync,
            addedEps: newEps - plan.oldEps,
            addedViews: newViews - plan.oldViews,
            totalEps: newEps,
            totalViews: newViews
        });
    }

    // 3. Write the JSON Log
    if (resultsLog.length > 0) {
        const logDir = ensureLogDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logType = isFullSync ? 'full_sync' : 'smart_sync';
        const logPath = path.join(logDir, `${logType}_${channelSlug}_${timestamp}.json`);
        
        fs.writeFileSync(logPath, JSON.stringify({ channel: channelSlug, type: logType, syncedAt: new Date().toISOString(), results: resultsLog, errors: syncErrors }, null, 2));
        console.log(`\n📄 Sync Log written to: ${logPath}`);
    }

    // Return both the games to update AND the error list
    return {
        affectedGames: Array.from(affectedGames),
        errors: syncErrors
    };
}