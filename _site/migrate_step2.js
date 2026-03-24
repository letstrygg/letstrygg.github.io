import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateStep2() {
    console.log("Starting Step 2: Steam Metadata & Series...\n");

    try {
        console.log("Fetching existing games to validate foreign keys...");
        const { data: existingGames, error: fetchError } = await supabase.from('ltg_games').select('slug');
        if (fetchError) throw fetchError;
        
        const validGameSlugs = new Set(existingGames.map(g => g.slug));

        // THE FIX: Translation map for known bad slugs
        const slugCorrections = {
            'shapezio': 'shapez',
            'dwarves-gdl': 'dwarves-glory-death-and-loot'
        };

        // ==========================================
        // 1. STEAM METADATA
        // ==========================================
        console.log("\nReading ../game-data.json...");
        const rawGameData = fs.readFileSync('../game-data.json', 'utf8');
        const gameData = JSON.parse(rawGameData);

        const steamRecords = [];
        const missingSteamGames = [];

        for (const [key, data] of Object.entries(gameData)) {
            if (!isNaN(key) && data.game_id) {
                
                let gameSlug = data.game_id.toLowerCase();
                // Apply correction if it exists
                if (slugCorrections[gameSlug]) {
                    gameSlug = slugCorrections[gameSlug];
                }
                
                if (!validGameSlugs.has(gameSlug)) {
                    missingSteamGames.push(gameSlug);
                    continue; 
                }

                let releaseDate = null;
                if (data.release) {
                    try { releaseDate = new Date(data.release).toISOString(); } catch (e) {}
                }

                steamRecords.push({
                    app_id: parseInt(key, 10),
                    game_slug: gameSlug,
                    developer: data.developer || null,
                    release_date: releaseDate,
                    reviews_total: data.reviews?.total || null,
                    reviews_positive: data.reviews?.positive || null,
                    rating_text: data.reviews?.rating_text || null,
                    sync_date: data.last_fetch || new Date().toISOString()
                });
            }
        }

        if (missingSteamGames.length > 0) {
            console.warn(`⚠️ Skipped ${missingSteamGames.length} Steam records (Game doesn't exist in DB):`, missingSteamGames);
        }

        if (steamRecords.length > 0) {
            console.log(`Inserting ${steamRecords.length} valid Steam records...`);
            const { error: steamError } = await supabase
                .from('ltg_steam_metadata')
                .upsert(steamRecords, { onConflict: 'app_id' });

            if (steamError) console.error("❌ Steam Error:", steamError.message);
            else console.log("✅ Steam metadata migrated!");
        }

        // ==========================================
        // 2. SERIES
        // ==========================================
        console.log("\nReading ../series-manifest.json...");
        const rawSeries = fs.readFileSync('../series-manifest.json', 'utf8');
        const seriesManifest = JSON.parse(rawSeries);

        const uniqueSeriesMap = new Map();
        const missingSeriesGames = [];

        seriesManifest.forEach(item => {
            if (!item.alias) return; 
            
            let gameSlug = (item.game_id || item.alias).toLowerCase();
            // Apply correction if it exists
            if (slugCorrections[gameSlug]) {
                gameSlug = slugCorrections[gameSlug];
            }
            
            if (!validGameSlugs.has(gameSlug)) {
                if (!missingSeriesGames.includes(gameSlug)) missingSeriesGames.push(gameSlug);
                return; 
            }

            if (!uniqueSeriesMap.has(item.alias)) {
                const cleanTitle = item.alias.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                
                uniqueSeriesMap.set(item.alias, {
                    slug: item.alias, 
                    game_slug: gameSlug, 
                    title: cleanTitle,
                    status: item.status || 'Ongoing'
                });
            }
        });

        if (missingSeriesGames.length > 0) {
            console.warn(`⚠️ Skipped some Series because these Games don't exist in DB:`, missingSeriesGames);
        }

        const seriesRecords = Array.from(uniqueSeriesMap.values());
        if (seriesRecords.length > 0) {
            console.log(`Inserting ${seriesRecords.length} valid Series...`);
            const { error: seriesError } = await supabase
                .from('ltg_series')
                .upsert(seriesRecords, { onConflict: 'slug' });

            if (seriesError) console.error("❌ Series Error:", seriesError.message);
            else console.log("✅ Series migrated!");
        }

    } catch (err) {
        console.error("❌ Script Error:", err.message);
    }
}

migrateStep2();