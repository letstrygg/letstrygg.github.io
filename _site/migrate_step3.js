import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

const MAIN_CHANNEL_SLUG = 'letstrygg'; 

async function batchUpsert(tableName, dataArray, conflictKey, batchSize = 1000) {
    for (let i = 0; i < dataArray.length; i += batchSize) {
        const batch = dataArray.slice(i, i + batchSize);
        console.log(`Uploading ${batch.length} rows to ${tableName} (Batch ${i / batchSize + 1})...`);
        const { error } = await supabase.from(tableName).upsert(batch, { onConflict: conflictKey });
        if (error) {
            console.error(`❌ Batch Error in ${tableName}:`, error.message);
            throw error;
        }
    }
}

async function migrateStep3() {
    console.log("Starting Step 3: Playlists, Videos, and Junctions...\n");

    try {
        // --- NEW: Fetch valid series from the database to check against ---
        console.log("Fetching existing series to validate foreign keys...");
        const { data: existingSeries, error: fetchError } = await supabase.from('ltg_series').select('slug');
        if (fetchError) throw fetchError;
        
        const validSeriesSlugs = new Set(existingSeries.map(s => s.slug));

        // --- 1. Load Series Manifest for Mappings ---
        const rawSeries = fs.readFileSync('../series-manifest.json', 'utf8');
        const seriesManifest = JSON.parse(rawSeries);
        
        const playlistManifestMap = new Map();
        seriesManifest.forEach(item => {
            if (item.id && item.alias) {
                playlistManifestMap.set(item.id, {
                    series_slug: item.alias,
                    season: item.season || 1.0
                });
            }
        });

        // --- 2. Process Playlists ---
        console.log("\nReading Playlist files...");
        const playlistFiles = fs.readdirSync('./_data/playlists').filter(f => f.endsWith('.json'));
        
        const uniquePlaylistsMap = new Map(); 
        const slugToPlaylistIdMap = new Map();
        const missingSeriesWarnings = [];

        for (const file of playlistFiles) {
            const data = JSON.parse(fs.readFileSync(`./_data/playlists/${file}`, 'utf8'));
            const manifestInfo = playlistManifestMap.get(data.id);

            if (!manifestInfo) {
                console.warn(`⚠️ Skipping playlist ${data.id} (${data.title}): Not found in series-manifest.json`);
                continue;
            }

            // SAFETY CHECK: Does the series actually exist in the DB?
            if (!validSeriesSlugs.has(manifestInfo.series_slug)) {
                if (!missingSeriesWarnings.includes(manifestInfo.series_slug)) {
                    missingSeriesWarnings.push(manifestInfo.series_slug);
                }
                continue; // Skip it
            }

            slugToPlaylistIdMap.set(data.slug, data.id);

            uniquePlaylistsMap.set(data.id, {
                id: data.id,
                series_slug: manifestInfo.series_slug,
                channel_slug: MAIN_CHANNEL_SLUG, 
                season: manifestInfo.season,
                title: data.title,
                sync_date: data.fetched || new Date().toISOString()
            });
        }

        if (missingSeriesWarnings.length > 0) {
            console.warn(`⚠️ Skipped some Playlists because these Series don't exist in DB:`, missingSeriesWarnings);
        }

        const playlistsToInsert = Array.from(uniquePlaylistsMap.values());

        if (playlistsToInsert.length > 0) {
            console.log(`\nInserting ${playlistsToInsert.length} valid Playlists...`);
            await batchUpsert('ltg_playlists', playlistsToInsert, 'id');
            console.log("✅ Playlists migrated!\n");
        } else {
            console.log("No valid playlists to insert.\n");
        }

        // --- 3. Process Videos and Junctions ---
        console.log("Reading Video files...");
        const videoFiles = fs.readdirSync('./_archive/videos').filter(f => f.endsWith('.json'));
        
        const uniqueVideosMap = new Map();
        const uniqueJunctionsMap = new Map(); 

        for (const file of videoFiles) {
            const rawVideos = JSON.parse(fs.readFileSync(`./_archive/videos/${file}`, 'utf8'));
            
            const playlistSlug = file.replace('-playlist_videos.json', '');
            const playlistId = slugToPlaylistIdMap.get(playlistSlug);

            if (!playlistId) continue; 

            rawVideos.forEach((v, index) => {
                const videoId = v.contentDetails?.videoId;
                if (!videoId) return;

                if (!uniqueVideosMap.has(videoId)) {
                    uniqueVideosMap.set(videoId, {
                        id: videoId,
                        title: v.title || 'Unknown Title',
                        published_at: v.contentDetails.videoPublishedAt || new Date().toISOString(),
                        duration_seconds: v.contentDetails.durationInSeconds || 0,
                        view_count: v.contentDetails.viewCount || 0,
                        likes: v.likes || 0,
                        comments: v.comments || 0
                    });
                }

                const junctionKey = `${playlistId}_${videoId}`;
                if (!uniqueJunctionsMap.has(junctionKey)) {
                    uniqueJunctionsMap.set(junctionKey, {
                        playlist_id: playlistId,
                        video_id: videoId,
                        sort_order: index + 1
                    });
                }
            });
        }

        const videosToInsert = Array.from(uniqueVideosMap.values());
        if (videosToInsert.length > 0) {
            console.log(`\nFound ${videosToInsert.length} unique videos. Inserting...`);
            await batchUpsert('ltg_videos', videosToInsert, 'id');
            console.log("✅ Videos migrated!\n");
        }

        const junctionsToInsert = Array.from(uniqueJunctionsMap.values());
        if (junctionsToInsert.length > 0) {
            console.log(`Found ${junctionsToInsert.length} playlist-video links. Inserting...`);
            await batchUpsert('ltg_playlist_videos', junctionsToInsert, 'playlist_id, video_id');
            console.log("✅ Playlist-Video junctions migrated!\n");
        }

        console.log("🎉 ALL MIGRATIONS COMPLETE! Your database is fully populated.");

    } catch (err) {
        console.error("❌ Script Error:", err.message);
    }
}

migrateStep3();