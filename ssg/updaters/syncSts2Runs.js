import fs from 'fs';
import path from 'path';
import { supabase } from '../utils/db.js';

// Helper to filter out basic un-upgraded starter cards to reduce bloat
function isStarterCard(cardId) {
    return cardId.startsWith('CARD.STRIKE_') || cardId.startsWith('CARD.DEFEND_');
}

export async function syncSts2Runs() {
    console.log(`\n⚔️ Initiating Slay the Spire 2 Local Run Sync...`);

    // 1. Locate the Local Save Directory dynamically
    const appData = process.env.APPDATA;
    if (!appData) {
        console.error("❌ Could not find %APPDATA% environment variable.");
        return;
    }

    const sts2SteamDir = path.join(appData, 'SlayTheSpire2', 'steam');
    if (!fs.existsSync(sts2SteamDir)) {
        console.error(`❌ Could not find STS2 Steam directory at: ${sts2SteamDir}`);
        return;
    }

    // Find the Steam ID folder (usually just one folder in here)
    const steamIds = fs.readdirSync(sts2SteamDir).filter(f => fs.statSync(path.join(sts2SteamDir, f)).isDirectory());
    if (steamIds.length === 0) {
        console.error("❌ Could not find a Steam ID folder.");
        return;
    }

    const historyDir = path.join(sts2SteamDir, steamIds[0], 'profile1', 'saves', 'history');
    if (!fs.existsSync(historyDir)) {
        console.error(`❌ Could not find run history folder at: ${historyDir}`);
        return;
    }

    // 2. Read local .run files
    const runFiles = fs.readdirSync(historyDir).filter(f => f.endsWith('.run'));
    console.log(`📂 Found ${runFiles.length} local run files.`);

    if (runFiles.length === 0) return;

    // 3. Check Supabase to see what we already have
    const { data: existingRuns, error: fetchError } = await supabase
        .from('ltg_sts2_runs')
        .select('id');

    if (fetchError) {
        console.error("❌ Failed to fetch existing runs from database:", fetchError.message);
        return;
    }

    const existingIds = new Set(existingRuns.map(r => r.id));
    const newRunsToInsert = [];

    // 4. Sort new files chronologically BEFORE parsing so run numbers increment correctly
    const newFilesToProcess = runFiles.filter(file => !existingIds.has(file.replace('.run', '')));
    newFilesToProcess.sort((a, b) => parseInt(a.replace('.run', '')) - parseInt(b.replace('.run', '')));

    // Get the highest existing run number to start incrementing from
    const { data: maxRunData } = await supabase.from('ltg_sts2_runs').select('run_number').order('run_number', { ascending: false }).limit(1);
    let nextRunNum = (maxRunData && maxRunData.length > 0) ? maxRunData[0].run_number + 1 : 1;

    // 5. Parse the new files
    for (const file of newFilesToProcess) {
        const runId = file.replace('.run', '');
        const filePath = path.join(historyDir, file);
        try {
            const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const player = rawData.players?.[0];
            if (!player) continue;

            const cleanDeck = player.deck.filter(c => !isStarterCard(c.id) || c.current_upgrade_level > 0 || c.enchantment).map(c => ({ id: c.id, upgrades: c.current_upgrade_level || 0, enchantment: c.enchantment?.id || null }));
            const cleanRelics = player.relics.map(r => r.id);
            
            let currentFloor = 1;
            let floorHistory = [];
            if (rawData.map_point_history && rawData.map_point_history.length > 0) {
                // THE FIX: Use .flat() to combine all the acts into one continuous timeline
                const allFloors = rawData.map_point_history.flat();
                
                floorHistory = allFloors.map(pt => {
                    const stats = pt.player_stats?.[0] || {};
                    return { floor: currentFloor++, type: pt.map_point_type, hp: stats.current_hp || 0, max_hp: stats.max_hp || 0, gold: stats.current_gold || 0 };
                });
            }

            const startTimeIso = new Date(parseInt(runId) * 1000).toISOString();

            newRunsToInsert.push({
                id: runId,
                run_number: nextRunNum++, // <-- Automatically assign the next number
                video_id: null, // Will be paired by matcher
                start_time: startTimeIso,
                run_time: rawData.run_time || 0,
                character: player.character,
                ascension: rawData.ascension || 0,
                win: rawData.win || false,
                killed_by: rawData.killed_by_encounter || rawData.killed_by_event || null,
                deck_list: cleanDeck,
                relic_list: cleanRelics,
                floor_history: floorHistory
            });

        } catch (err) {
            console.error(`⚠️ Failed to parse file ${file}:`, err.message);
        }
    }

    // 6. Upload to Supabase
    if (newRunsToInsert.length > 0) {
        console.log(`🚀 Uploading ${newRunsToInsert.length} new runs to the database...`);
        const { error: insertError } = await supabase.from('ltg_sts2_runs').insert(newRunsToInsert);
        if (insertError) console.error("❌ Failed to insert new runs:", insertError.message);
        else console.log(`✅ Successfully synced ${newRunsToInsert.length} runs!`);
    } else {
        console.log(`✅ Database is already perfectly up-to-date with local files.`);
    }
}

// Allow running this script directly from the terminal for testing
if (process.argv[1].endsWith('syncSts2Runs.js')) {
    syncSts2Runs();
}