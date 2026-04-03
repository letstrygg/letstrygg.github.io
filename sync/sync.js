import { execSync } from 'child_process';
import { syncPlaylist, linkOrphanedRuns } from './syncPlaylist.js';
import { syncChannel } from './syncChannel.js';
import { supabase, updateSeriesSyncDateByPlaylist } from '../ssg/utils/db.js';
import { syncSts2Runs } from '../ssg/updaters/syncSts2Runs.js';
import { generateAutoTags } from '../ssg/updaters/generateAutoTags.js';

async function processChannelSync(channelSlug, syncMode, skipUpdate, forceUpdate) {
    const options = { force: forceUpdate };
    const { affectedGames, errors: syncErrors } = await syncChannel(channelSlug, syncMode);

    // Centralized Game Hooks: Regenerate tags if STS2 data changed
    if (affectedGames.includes('slay-the-spire-2')) {
        console.log(`\n🧩 Slay the Spire 2 detected. Updating auto-tags...`);
        await generateAutoTags();
    }

    if (!skipUpdate && affectedGames.length > 0) {
        console.log(`\n🔨 Triggering SSG Builds for ${affectedGames.length} affected games...`);
        
        for (const slug of affectedGames) {
            console.log(`   >> Building Series: ${slug}...`);
            await execBuild('series', slug, options);
        }
        
        console.log(`   >> Rebuilding Network Tag Hub...`);
        await execBuild('tag', null, options);

        console.log(`   >> Rebuilding Network Master Hub...`);
        await execBuild('yt', null, options);

    } else if (skipUpdate) {
        console.log(`\n⏩ Skipping SSG Builds (--no-update provided).`);
    } else {
        console.log(`\n⏩ No games were affected. Skipping SSG Build.`);
    }

    if (syncErrors && syncErrors.length > 0) {
        console.log(`\n⚠️  SYNC WARNINGS (${syncErrors.length}):`);
        syncErrors.forEach(err => console.log(`  - ${err}`));
    }
}

async function execBuild(type, target, options) {
    const forceFlag = options.force ? ' --force' : '';
    const targetArg = target ? ` ${target}` : '';
    const cmd = `node ssg/update.js ${type}${targetArg}${forceFlag}`;
    execSync(cmd, { stdio: 'inherit' });
}

async function run() {
    const args = process.argv.slice(2);
    
    const skipUpdate = args.includes('--no-update') || args.includes('-n');
    const forceUpdate = args.includes('--force') || args.includes('-f');
    
    let syncMode = 'full';
    if (args.includes('--smart') || args.includes('-s')) syncMode = 'smart';
    if (args.includes('--recent') || args.includes('-r')) syncMode = 'recent';
    const options = { force: forceUpdate };
    
    const cleanArgs = args.filter(a => !a.startsWith('-'));
    const command = cleanArgs[0]; 
    const targetId = cleanArgs[1]; 

    console.log(`\n🚀 Starting Sync Orchestrator...`);
    const startTime = Date.now();

    try {
        await syncSts2Runs();

        if (command === 'playlist' && targetId) {
            console.log(`🎯 Target: Single Playlist (${targetId})`);
            const syncResult = await syncPlaylist(targetId);
            const gameSlug = await updateSeriesSyncDateByPlaylist(targetId);

            if (gameSlug === 'slay-the-spire-2') {
                if (syncResult?.newVideoIds?.length > 0) {
                    const latestNewVideoId = syncResult.newVideoIds[syncResult.newVideoIds.length - 1];
                    await linkOrphanedRuns(latestNewVideoId);
                }
                
                await generateAutoTags();
            }

            if (!skipUpdate) {
                console.log(`\n🔨 Triggering SSG Build...`);
                await execBuild('season', targetId, options);
                if (gameSlug) await execBuild('series', gameSlug, options);
            }
        } 
        
        else if (command === 'series' && targetId) {
            console.log(`📚 Target: Series (${targetId})`);

            const { data: playlists, error } = await supabase
                .from('ltg_playlists')
                .select(`
                    id,
                    ltg_series!inner ( game_slug )
                `)
                .eq('ltg_series.game_slug', targetId);

            if (error || !playlists || playlists.length === 0) {
                throw new Error(`No playlists found for series: ${targetId}`);
            }

            console.log(`   >> Found ${playlists.length} playlists to sync.`);

            for (const p of playlists) {
                console.log(`\n   >> Syncing Playlist: ${p.id}...`);
                const syncResult = await syncPlaylist(p.id);
                await updateSeriesSyncDateByPlaylist(p.id);

                // Safe Orphan Linking for STS2
                if (targetId === 'slay-the-spire-2' && syncResult?.newVideoIds?.length > 0) {
                    const latestNewVideoId = syncResult.newVideoIds[syncResult.newVideoIds.length - 1];
                    await linkOrphanedRuns(latestNewVideoId);
                }
            }

            if (targetId === 'slay-the-spire-2') {
                console.log(`\n🧩 Slay the Spire 2 detected. Updating auto-tags...`);
                await generateAutoTags();
            }

            if (!skipUpdate) {
                console.log(`\n🔨 Triggering SSG Build for Series: ${targetId}...`);
                await execBuild('series', targetId, options);
                await execBuild('tag', null, options);
                await execBuild('yt', null, options);
            }
        }

        else if (!command) {
            console.log(`🌍 Target: ENTIRE NETWORK [Mode: ${syncMode.toUpperCase()}]`);
            
            const { data: channels } = await supabase
                .from('ltg_channels')
                .select('slug')
                .eq('generate_dir', true);
                
            if (channels) {
                for (const ch of channels) {
                    await processChannelSync(ch.slug, syncMode, skipUpdate, forceUpdate);
                }
            } else {
                console.log("⚠️ No active network channels found to sync.");
            }
        } 
        
        else {
            console.log(`📺 Target: Channel (${command}) [Mode: ${syncMode.toUpperCase()}]`);
            await processChannelSync(command, syncMode, skipUpdate, forceUpdate);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✨ Orchestration completed successfully in ${duration}s!`);

    } catch (err) {
        console.error(`\n❌ Orchestration Failed:`, err.message);
        process.exit(1);
    }
}

run(); 