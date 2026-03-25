import { updateEpisode } from './updaters/updateEpisode.js';
import { updateSeason } from './updaters/updateSeason.js'; 
import { updateSeries } from './updaters/updateSeries.js'; 
import { updateChannel } from './updaters/updateChannel.js';
import { updateTag } from './updaters/updateTag.js';
import { updateYT } from './updaters/updateYT.js';

async function run() {
    const args = process.argv.slice(2);
    
    // Extract commands and flags
    const isForce = args.includes('--force') || args.includes('-f');
    const indexesOnly = args.includes('--indexes-only') || args.includes('-i');
    const cleanArgs = args.filter(a => !a.startsWith('-')); // Remove flags so we get the pure command/target
    
    const command = cleanArgs[0];
    const targetId = cleanArgs[1];

    if (!command) {
        console.error("❌ Please provide a command. Example: node update.js episode [id]");
        process.exit(1);
    }

    // Dynamic UI logging for flags
    const forceLog = isForce ? '(FORCE REBUILD)' : '';
    const indexLog = indexesOnly ? '(INDEXES ONLY)' : '';
    console.log(`\n🚀 Starting Build Process: [${command.toUpperCase()}] -> Target: ${targetId || 'ALL'} ${forceLog} ${indexLog}`);
    
    const startTime = Date.now();

    try {
        switch (command) {
            case 'episode':
                if (!targetId) throw new Error("Missing Video ID.");
                const epResult = await updateEpisode(targetId);
                console.log(`✅ Episode HTML generated at: ${epResult.filePath}`);
                break;

            case 'season':
                if (!targetId) throw new Error("Missing Playlist ID.");
                // Pass flags down as an options object
                const seasonResult = await updateSeason(targetId, { force: isForce, indexesOnly });
                
                if (seasonResult.skipped) {
                    console.log(`⏩ Season skipped (Already up-to-date).`);
                } else {
                    console.log(`✅ Season complete! Processed ${seasonResult.episodesProcessed || 0} episodes.`);
                }
                break;
            
            case 'series':
                if (!targetId) throw new Error("Missing Series Slug.");
                const seriesResult = await updateSeries(targetId, { force: isForce, indexesOnly });
                
                if (seriesResult.skipped) {
                    console.log(`⏩ Series fully skipped (Already up-to-date).`);
                } else {
                    console.log(`✅ Series complete! Processed ${seriesResult.totalEpisodes || 0} episodes.`);
                }
                break;
            
            case 'channel':
                if (!targetId) throw new Error("Missing Channel Slug.");
                const channelResult = await updateChannel(targetId, { force: isForce, indexesOnly });
                
                if (channelResult.skipped) {
                    console.log(`\n✨ Channel fully skipped in ${((Date.now() - startTime) / 1000).toFixed(2)}s (Already up-to-date).`);
                } else {
                    console.log(`\n✨ Channel complete in ${((Date.now() - startTime) / 1000).toFixed(2)}s! Processed ${channelResult.totalEpisodes || 0} episodes.`);
                }
                break;
				
			case 'tag':
				await updateTag();
				break;
				
			case 'yt':
				await updateYT();
				break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                console.log("Available commands: episode, season, series, channel");
                break;
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✨ Build completed successfully in ${duration}s!`);

    } catch (err) {
        console.error(`\n❌ Build Failed:`, err.message);
        process.exit(1);
    }
}

run();