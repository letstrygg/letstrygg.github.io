import { execSync } from 'child_process';
import { syncPlaylist } from './syncPlaylist.js';
import { syncChannel } from './syncChannel.js';
import { updateSeriesSyncDateByPlaylist } from '../ssg/utils/db.js';

async function run() {
    const args = process.argv.slice(2);
    
    // Extract flags
    const skipUpdate = args.includes('--no-update') || args.includes('-n');
    const forceUpdate = args.includes('--force') || args.includes('-f');
    const fullSync = args.includes('--all') || args.includes('-a'); // NEW FLAG
    
    const cleanArgs = args.filter(a => !a.startsWith('-'));
    const command = cleanArgs[0];
    const targetId = cleanArgs[1];

    if (!command || !targetId) {
        console.error("❌ Usage: node sync/sync.js [playlist|channel] [id] [--no-update] [--force] [--all]");
        process.exit(1);
    }

    console.log(`\n🚀 Starting Orchestrator: [SYNC ${command.toUpperCase()}] -> Target: ${targetId}`);
    if (fullSync) console.log(`⚠️  FLAG DETECTED: [--all] Full catalog sync enabled.`);
    const startTime = Date.now();

    try {
        switch (command) {
            case 'playlist':
                // 1. Run the YouTube -> Supabase Sync
                await syncPlaylist(targetId);
                
                // 2. Bubble the sync_date up to the parent Series
                const gameSlug = await updateSeriesSyncDateByPlaylist(targetId);

                // 3. Trigger the SSG Build (Unless explicitly skipped)
                if (!skipUpdate) {
                    console.log(`\n🔨 Triggering SSG Build...`);
                    
                    const forceFlag = forceUpdate ? ' --force' : '';
                    
                    // We execute the SSG script as a separate process to keep memory clean
                    execSync(`node ssg/update.js season ${targetId}${forceFlag}`, { stdio: 'inherit' });
                    
                    // Trigger the game root page rebuild using the correct Game Slug
                    if (gameSlug) {
                        execSync(`node ssg/update.js series ${gameSlug}${forceFlag}`, { stdio: 'inherit' });
                    }
                } else {
                    console.log(`\n⏩ Skipping SSG Build (--no-update provided).`);
                }
                break;

            case 'channel':
                // 1. Run the Sync (Unpack the new return object)
                const { affectedGames, errors: syncErrors } = await syncChannel(targetId, fullSync);

                // 2. Trigger SSG Builds for affected games
                if (!skipUpdate && affectedGames.length > 0) {
                    console.log(`\n🔨 Triggering SSG Builds for ${affectedGames.length} affected games...`);
                    const forceFlag = forceUpdate ? ' --force' : '';
                    
                    for (const slug of affectedGames) {
                        console.log(`   >> Building ${slug}...`);
                        execSync(`node ssg/update.js series ${slug}${forceFlag}`, { stdio: 'inherit' });
                    }
                    
                    console.log(`   >> Rebuilding Channel Hub...`);
                    execSync(`node ssg/update.js channel ${targetId}${forceFlag}`, { stdio: 'inherit' });

                } else if (skipUpdate) {
                    console.log(`\n⏩ Skipping SSG Builds (--no-update provided).`);
                } else {
                    console.log(`\n⏩ No games were affected. Skipping SSG Build.`);
                }

                // 3. PRINT THE ERROR SUMMARY
                if (syncErrors && syncErrors.length > 0) {
                    console.log(`\n⚠️  SYNC WARNINGS (${syncErrors.length}):`);
                    syncErrors.forEach(err => console.log(`  - ${err}`));
                }
                break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                console.log("Available commands: playlist, channel");
                break;
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✨ Orchestration completed successfully in ${duration}s!`);

    } catch (err) {
        console.error(`\n❌ Orchestration Failed:`, err.message);
        process.exit(1);
    }
}

run();