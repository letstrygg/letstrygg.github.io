import fs from 'fs';
import path from 'path';
import { supabase } from '../utils/db.js';
import { tagHTML } from '../utils/templates/tag.js';

// Helper to convert "Tower Defense" into "tower-defense"
function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

export async function updateTag(targetTagSlug = null) {
    console.log(`\n🏷️  Generating Tag Directories...`);

    // 1. Fetch ALL game playlists, their parent series, game tags, and stats in one giant query
    const { data: rawPlaylists, error } = await supabase
        .from('ltg_playlists')
        .select(`
            channel_slug,
            ltg_channels ( display_name ),
            ltg_series (
                slug,
                ltg_games ( slug, title, tags )
            ),
            ltg_playlist_stats (
                ep_count,
                total_views,
                total_likes,
                total_comments,
                total_duration,
                latest_published_at,
                first_published_at,
                first_video_id
            )
        `)
        .eq('playlist_type', 'game');

    if (error) {
        console.error("❌ Failed to fetch data for tags:", error.message);
        return;
    }

    // 2. Aggregate playlists into Series (Games) per Channel
    // A single game might have multiple playlists (Season 1, Season 2). We combine them here.
    const seriesMap = new Map();

    rawPlaylists.forEach(p => {
        const game = p.ltg_series?.ltg_games;
        if (!game || !game.tags || game.tags.length === 0) return; // Skip if no tags

        const channelSlug = p.channel_slug;
        const channelName = p.ltg_channels?.display_name || channelSlug;
        const stats = p.ltg_playlist_stats?.[0];
        if (!stats || stats.ep_count === 0) return; // Skip empty playlists

        // Unique key so LTG's Slay the Spire is separate from LTG Plus's Slay the Spire
        const seriesKey = `${channelSlug}_${game.slug}`;

        if (!seriesMap.has(seriesKey)) {
            seriesMap.set(seriesKey, {
                channelSlug,
                channelDisplayName: channelName,
                gameSlug: game.slug,
                gameTitle: game.title,
                tags: game.tags,
                epCount: 0, totalViews: 0, totalLikes: 0, totalComments: 0, totalDuration: 0,
                firstPub: null, lastPub: null, thumbUrl: null
            });
        }

        const s = seriesMap.get(seriesKey);
        
        s.epCount += stats.ep_count || 0;
        s.totalViews += stats.total_views || 0;
        s.totalLikes += stats.total_likes || 0;
        s.totalComments += stats.total_comments || 0;
        s.totalDuration += stats.total_duration || 0;

        const pFirst = stats.first_published_at ? new Date(stats.first_published_at).getTime() : null;
        const pLast = stats.latest_published_at ? new Date(stats.latest_published_at).getTime() : null;

        if (pFirst && (!s.firstPub || pFirst < s.firstPub)) {
            s.firstPub = pFirst;
            if (stats.first_video_id) s.thumbUrl = `https://i.ytimg.com/vi/${stats.first_video_id}/maxresdefault.jpg`;
        }
        if (pLast && (!s.lastPub || pLast > s.lastPub)) {
            s.lastPub = pLast;
            s.lastUpdatedFormatted = new Date(pLast).toISOString();
        }
    });

    // 3. Bucket the Series into Tags
    const tagBuckets = new Map();

    for (const s of seriesMap.values()) {
        s.tags.forEach(tag => {
            const tSlug = slugify(tag);
            if (!tagBuckets.has(tSlug)) {
                tagBuckets.set(tSlug, { tagName: tag.trim(), tagSlug: tSlug, series: [] });
            }
            tagBuckets.get(tSlug).series.push(s);
        });
    }

    // 4. Generate Pages for each Tag
    let buildCount = 0;

    for (const [tSlug, tagData] of tagBuckets.entries()) {
        // If a specific tag was requested via CLI, skip the others
        if (targetTagSlug && targetTagSlug !== tSlug) continue;

        // Calculate Tag-Wide Totals
        const totals = { total_videos: 0, total_views: 0, total_likes: 0, total_comments: 0, total_duration: 0, first_published_at: null, latest_published_at: null };
        
        tagData.series.forEach(s => {
            totals.total_videos += s.epCount;
            totals.total_views += s.totalViews;
            totals.total_likes += s.totalLikes;
            totals.total_comments += s.totalComments;
            totals.total_duration += s.totalDuration;

            if (s.firstPub && (!totals.first_published_at || s.firstPub < totals.first_published_at)) totals.first_published_at = s.firstPub;
            if (s.lastPub && (!totals.latest_published_at || s.lastPub > totals.latest_published_at)) totals.latest_published_at = s.lastPub;
        });

        // Calculate Tag-Wide Averages
        const seriesCount = Math.max(1, tagData.series.length);
        const vidCount = Math.max(1, totals.total_videos);
        
        const averages = {
            series: Math.round(totals.total_videos / seriesCount),
            views: Math.round(totals.total_views / seriesCount),
            likes: Math.round(totals.total_likes / seriesCount),
            comments: Math.round(totals.total_comments / seriesCount),
            duration: Math.round(totals.total_duration / seriesCount),
            viewsPerVid: Math.round(totals.total_views / vidCount),
            likesPerVid: Math.round(totals.total_likes / vidCount),
            commentsPerVid: Math.round(totals.total_comments / vidCount),
            durPerVid: Math.round(totals.total_duration / vidCount)
        };

        const templateData = {
            tagName: tagData.tagName,
            tagSlug: tagData.tagSlug,
            series: tagData.series,
            totals,
            averages
        };

        const html = tagHTML(templateData);

        // Write the file to /yt/tags/tag-name/index.html
        const dirPath = path.join(process.cwd(), 'yt', 'tags', tSlug);
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
        
        const filePath = path.join(dirPath, 'index.html');
        fs.writeFileSync(filePath, html);
        
        console.log(`  ✅ Tag Directory generated at: yt/tags/${tSlug}/index.html`);
        buildCount++;
    }

    if (buildCount === 0) {
        console.log(`  ⏩ No tags found to build.`);
    } else {
        console.log(`✨ Successfully generated ${buildCount} tag directories!`);
    }
}