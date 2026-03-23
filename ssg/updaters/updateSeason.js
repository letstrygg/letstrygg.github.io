// ssg/updaters/updateSeason.js
import { getFullSeasonContext } from '../utils/db.js';
import { writeStaticPage } from '../utils/fileSys.js';
import { seasonIndexHTML } from '../utils/templates.js';
import { updateEpisode } from './updateEpisode.js';

export async function updateSeason(playlistId) {
    // 1. Fetch DB Context
    const playlist = await getFullSeasonContext(playlistId);
    const series = playlist.ltg_series;
    const gameSlug = series.ltg_games?.slug || series.slug;
    const channelSlug = playlist.channel_slug;
    const seasonNum = playlist.season;

    console.log(`\n📂 Processing Season: ${series.title} (Season ${seasonNum}) for ${channelSlug}`);

    // 2. Sort videos and process episodes
    const videos = playlist.ltg_playlist_videos.sort((a, b) => a.sort_order - b.sort_order);
    console.log(`Found ${videos.length} episodes. Triggering granular updates...`);

    let successCount = 0;
    for (const pv of videos) {
        try {
            await updateEpisode(pv.video_id);
            successCount++;
        } catch (epError) {
            console.error(`❌ Failed to update episode ${pv.video_id}:`, epError.message);
        }
    }

    // 3. Assemble Data for the Season Index Page
    const shortPrefix = series.slug.split('-').map(w => isNaN(parseInt(w)) ? w[0] : w).join('').toLowerCase();
    const basePath = `yt/${channelSlug}/${gameSlug}/s${Math.floor(seasonNum)}`;
    
    const templateData = {
        seasonNum: seasonNum,
        seriesTitle: series.title,
        channelSlug: channelSlug,
        gameSlug: gameSlug,
        shortPrefix: shortPrefix
    };

    // 4. Write the Season Index HTML
    const seasonHTML = seasonIndexHTML(templateData);
    const indexPath = `${basePath}/index.html`;
    
    writeStaticPage(indexPath, seasonHTML);
    console.log(`✅ Season Index generated at: ${indexPath}`);

    return {
        success: true,
        episodesProcessed: successCount,
        playlistId: playlist.id,
        seriesSlug: series.slug
    };
}