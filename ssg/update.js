import { updateEpisode } from './updaters/updateEpisode.js';
import { updateSeason } from './updaters/updateSeason.js'; // <-- Uncommented

async function run() {
    const args = process.argv.slice(2);
    const command = args[0];
    const targetId = args[1];

    if (!command) {
        console.error("❌ Please provide a command. Example: node update.js episode 5b861ZbgHE4");
        process.exit(1);
    }

    console.log(`\n🚀 Starting Build Process: [${command.toUpperCase()}] -> Target: ${targetId || 'ALL'}`);
    const startTime = Date.now();

    try {
        switch (command) {
            case 'episode':
                if (!targetId) throw new Error("Missing Video ID.");
                const epResult = await updateEpisode(targetId);
                console.log(`✅ Episode HTML generated at: ${epResult.filePath}`);
                
                // THE CASCADE: Later, we can uncomment this to auto-update the parent season
                // console.log(`Triggering cascade update for Season: ${epResult.playlistId}...`);
                // await updateSeason(epResult.playlistId); 
                break;

            case 'season': // <-- Implemented
                if (!targetId) throw new Error("Missing Playlist ID.");
                const seasonResult = await updateSeason(targetId);
                console.log(`✅ Season complete! Processed ${seasonResult.episodesProcessed} episodes.`);
                
                // THE CASCADE: Next up will be triggering updateSeries(seasonResult.seriesSlug)
                break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                console.log("Available commands: episode, season, series, channel, all");
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