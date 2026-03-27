import { execSync } from 'child_process';
import { syncPlaylist, linkOrphanedRuns } from './syncPlaylist.js';
import { syncChannel } from './syncChannel.js';
import { supabase, updateSeriesSyncDateByPlaylist } from '../ssg/utils/db.js';
import { syncSts2Runs } from '../ssg/updaters/syncSts2Runs.js';
import { generateAutoTags } from '../ssg/updaters/generateAutoTags.js';

async function processChannelSync(channelSlug, syncMode, skipUpdate, forceUpdate) {
    const { affectedGames, errors: syncErrors } = await syncChannel(channelSlug, syncMode);

    // --- NEW: Generate tags BEFORE building the HTML ---
    if (affectedGames.includes('slay-the-spire-2')) {
        await generateAutoTags();
    }
    // ---------------------------------------------------

    if (!skipUpdate && affectedGames.length > 0) {
        console.log(`\n🔨 Triggering SSG Builds for ${affectedGames.length} affected games...`);
        const forceFlag = forceUpdate ? ' --force' : '';
        
        for (const slug of affectedGames) {
            console.log(`   >> Building Series: ${slug}...`);
            execSync(`node ssg/update.js series ${slug}${forceFlag}`, { stdio: 'inherit' });
        }
        
        console.log(`   >> Rebuilding Network Tag Hub...`);
        execSync(`node ssg/update.js tag${forceFlag}`, { stdio: 'inherit' });

        console.log(`   >> Rebuilding Network Master Hub...`);
        execSync(`node ssg/update.js yt${forceFlag}`, { stdio: 'inherit' });

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

async function run() {
    const args = process.argv.slice(2);
    
    const skipUpdate = args.includes('--no-update') || args.includes('-n');
    const forceUpdate = args.includes('--force') || args.includes('-f');
    
    let syncMode = 'full';
    if (args.includes('--smart') || args.includes('-s')) syncMode = 'smart';
    if (args.includes('--recent') || args.includes('-r')) syncMode = 'recent';
    
    const cleanArgs = args.filter(a => !a.startsWith('-'));
    const command = cleanArgs[0]; 
    const targetId = cleanArgs[1]; 

    console.log(`\n🚀 Starting Sync Orchestrator...`);
    const startTime = Date.now();

    try {
        // --- NEW: Pre-Sync Local Runs ---
        await syncSts2Runs();
        // --------------------------------

        if (command === 'playlist' && targetId) {
            console.log(`🎯 Target: Single Playlist (${targetId})`);
            const syncResult = await syncPlaylist(targetId);
            const gameSlug = await updateSeriesSyncDateByPlaylist(targetId);

            if (gameSlug === 'slay-the-spire-2') {
                if (syncResult?.newVideoIds?.length > 0) {
                    const latestNewVideoId = syncResult.newVideoIds[syncResult.newVideoIds.length - 1];
                    await linkOrphanedRuns(latestNewVideoId);
                }
                
                // --- NEW: Generate tags BEFORE building the HTML ---
                await generateAutoTags();
            }

            if (!skipUpdate) {
                console.log(`\n🔨 Triggering SSG Build...`);
                const forceFlag = forceUpdate ? ' --force' : '';
                execSync(`node ssg/update.js season ${targetId}${forceFlag}`, { stdio: 'inherit' });
                if (gameSlug) execSync(`node ssg/update.js series ${gameSlug}${forceFlag}`, { stdio: 'inherit' });
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