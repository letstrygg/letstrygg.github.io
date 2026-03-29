import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../utils/db.js';
import { hubHTML } from '../utils/templates/hub.js';

// Define absolute pathing so this script can be run from ANY directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../'); 

function slugify(text) {
    return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

export async function updateYT(options = {}) {
    console.log(`\n🏗️  Aggregating Network Statistics for Master Hub...`);

    const { data: rawPlaylists, error } = await supabase
        .from('ltg_playlists')
        .select(`
            channel_slug,
            ltg_channels ( display_name ),
            ltg_series (
                slug,
                ltg_games ( slug, tags )
            ),
            ltg_playlist_stats (
                ep_count,
                total_views,
                total_duration
            )
        `)
        .eq('playlist_type', 'game');

    if (error) {
        console.error("❌ Failed to fetch network data:", error.message);
        return;
    }

    const networkTotals = { games: new Set(), videos: 0, views: 0, duration: 0 };
    const channelsMap = new Map();
    const tagsMap = new Map();

    rawPlaylists.forEach(p => {
        const channelSlug = p.channel_slug;
        const channelName = p.ltg_channels?.display_name || channelSlug;
        
        if (!channelsMap.has(channelSlug)) {
            channelsMap.set(channelSlug, {
                slug: channelSlug,
                displayName: channelName,
                games: new Set(),
                videos: 0, views: 0, duration: 0
            });
        }

        const ch = channelsMap.get(channelSlug);
        const stats = p.ltg_playlist_stats?.[0] || { ep_count: 0, total_views: 0, total_duration: 0 };
        const gameSlug = p.ltg_series?.ltg_games?.slug;

        if (gameSlug) {
            ch.games.add(gameSlug);
            networkTotals.games.add(gameSlug);
            
            const tags = p.ltg_series?.ltg_games?.tags || [];
            tags.forEach(tag => {
                const tSlug = slugify(tag);
                if (!tagsMap.has(tSlug)) {
                    tagsMap.set(tSlug, { name: tag.trim(), slug: tSlug, games: new Set() });
                }
                tagsMap.get(tSlug).games.add(gameSlug);
            });
        }

        ch.videos += stats.ep_count;
        ch.views += stats.total_views;
        ch.duration += stats.total_duration;

        networkTotals.videos += stats.ep_count;
        networkTotals.views += stats.total_views;
        networkTotals.duration += stats.total_duration;
    });

    const channelsArray = Array.from(channelsMap.values()).map(c => ({
        ...c,
        games: c.games.size
    }));

    const tagsArray = Array.from(tagsMap.values())
        .map(t => ({ name: t.name, slug: t.slug, count: t.games.size }))
        .sort((a, b) => b.count - a.count);

    const networkData = {
        totalGames: networkTotals.games.size,
        totalVideos: networkTotals.videos,
        totalViews: networkTotals.views,
        totalDuration: networkTotals.duration,
        channels: channelsArray,
        tags: tagsArray
    };

    const html = hubHTML(networkData);
    
    // Safely anchor to the project root instead of process.cwd()
    const dirPath = path.join(PROJECT_ROOT, 'yt');
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    
    fs.writeFileSync(path.join(dirPath, 'index.html'), html);
    console.log(`  ✅ Master Network Hub generated at: yt/index.html`);
}