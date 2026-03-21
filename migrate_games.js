import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load the .env file from one level up
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; 

// Quick safety check
if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Missing Supabase environment variables. Check C:\\GitHub\\.env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateGames() {
    console.log("Starting Games migration...");

    try {
        // 1. Read the local JSON file
        const rawData = fs.readFileSync('./_data/games.json', 'utf8');
        const gamesList = JSON.parse(rawData);

        // 2. Map the JSON to match our exact SQL schema
        const mappedGames = gamesList.map(game => ({
            slug: game.id,
            title: game.title,
            tags: game.tags || [] 
        }));

        console.log(`Found ${mappedGames.length} games to migrate. Inserting...`);

        // 3. Perform a bulk Upsert
        const { data, error } = await supabase
            .from('ltg_games')
            .upsert(mappedGames, { onConflict: 'slug' });

        if (error) {
            console.error("❌ Database Error:", error.message);
            console.error("Details:", error.details);
            return;
        }

        console.log("✅ Successfully migrated games into ltg_games!");

    } catch (err) {
        console.error("❌ Script Error:", err.message);
    }
}

migrateGames();