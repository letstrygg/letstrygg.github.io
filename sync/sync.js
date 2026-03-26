import { execSync } from 'child_process';
import { syncPlaylist } from './syncPlaylist.js';
import { syncChannel } from './syncChannel.js';
import { supabase, updateSeriesSyncDateByPlaylist } from '../ssg/utils/db.js';

async function processChannelSync(channelSlug, syncMode, skipUpdate, forceUpdate) {
    // 1. Run the Sync 
    const { affectedGames, errors: syncErrors } = await syncChannel(channelSlug, syncMode);

    // 2. Trigger SSG Builds for affected games
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

    // 3. Print the error summary
    if (syncErrors && syncErrors.length > 0) {
        console.log(`\n⚠️  SYNC WARNINGS (${syncErrors.length}):`);
        syncErrors.forEach(err => console.log(`  - ${err}`));
    }
}

async function run() {
    const args = process.argv.slice(2);
    
    // Extract generic flags
    const skipUpdate = args.includes('--no-update') || args.includes('-n');
    const forceUpdate = args.includes('--force') || args.includes('-f');
    
    // Determine Sync Mode (Defaults to 'full' if no flags provided)
    let syncMode = 'full';
    if (args.includes('--smart') || args.includes('-s')) syncMode = 'smart';
    if (args.includes('--recent') || args.includes('-r')) syncMode = 'recent';
    
    // Clean args to find targets
    const cleanArgs = args.filter(a => !a.startsWith('-'));
    const command = cleanArgs[0]; 
    const targetId = cleanArgs[1]; // Only used if command === 'playlist'

    console.log(`\n🚀 Starting Sync Orchestrator...`);
    const startTime = Date.now();

    try {
        // SCENARIO 1: Individual Playlist (Preserved for manual testing)
        if (command === 'playlist' && targetId) {
            console.log(`🎯 Target: Single Playlist (${targetId})`);
            await syncPlaylist(targetId);
            const gameSlug = await updateSeriesSyncDateByPlaylist(targetId);

            if (!skipUpdate) {
                console.log(`\n🔨 Triggering SSG Build...`);
                const forceFlag = forceUpdate ? ' --force' : '';
                execSync(`node ssg/update.js season ${targetId}${forceFlag}`, { stdio: 'inherit' });
                if (gameSlug) execSync(`node ssg/update.js series ${gameSlug}${forceFlag}`, { stdio: 'inherit' });
            }
        } 
        
        // SCENARIO 2: Entire Network Sync (No arguments passed)
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
        
        // SCENARIO 3: Specific Channel Sync
        else {
            console.log(`📺 Target: Channel (${command}) [Mode: ${syncMode.toUpperCase()}]`);
            // We assume the command is the channel slug
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