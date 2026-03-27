import dotenv from 'dotenv';
import { supabase } from '../utils/db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config({ path: '../.env' }); 

export async function generateSummaries() {
    console.log("🤖 Booting up Gemini to generate Episode Summaries...");

    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY not found in C:\\GitHub\\.env");
        return;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: "You are a data-to-text parser for a Slay the Spire 2 tracking website. I will provide a JSON object representing a single YouTube episode, which contains one or more game runs. Write a punchy, 2-to-3 sentence summary designed for a YouTube description. Highlight the overall narrative of the episode (e.g., a massive victorious run, or a series of tragic early deaths). Mention the character(s), the ascension level, and explicitly name 2 or 3 notable cards or relics seen across the attempts. DO NOT invent details. Return ONLY the description text, with no conversational filler or markdown formatting."
    });

    // 1. Get a unique list of all video IDs that have STS2 runs mapped to them
    const { data: mappedRuns } = await supabase
        .from('ltg_sts2_runs')
        .select('video_id')
        .not('video_id', 'is', null);

    if (!mappedRuns || mappedRuns.length === 0) {
        console.log("✅ No mapped STS2 runs found to summarize.");
        return;
    }

    const sts2VideoIds = [...new Set(mappedRuns.map(r => r.video_id))];

    // 2. Fetch ONLY those specific videos, and only if they lack an AI summary
    const { data: videos, error: vidError } = await supabase
        .from('ltg_videos')
        .select('id, title')
        .in('id', sts2VideoIds)
        .is('ai_summary', null);

    if (vidError || !videos || videos.length === 0) {
        console.log("✅ All Slay the Spire 2 videos already have summaries!");
        return;
    }

    console.log(`📝 Found ${videos.length} STS2 videos needing summaries. Processing...`);

    for (const video of videos) {
        try {
            // 3. Fetch all runs mapped to this specific video
            const { data: runs, error: runError } = await supabase
                .from('ltg_sts2_runs')
                .select('*')
                .eq('video_id', video.id)
                .order('run_number', { ascending: true });

            if (runError || !runs || runs.length === 0) {
                continue; // Skip videos with no mapped runs yet
            }

            // 4. Package the episode data for Gemini
            const episodeData = {
                episode_title: video.title,
                total_attempts_in_video: runs.length,
                runs: runs.map(run => {
                    const finalFloor = run.floor_history[run.floor_history.length - 1]?.floor || 0;
                    return {
                        run_number: run.run_number,
                        character: run.character.replace('CHARACTER.', ''),
                        ascension: run.ascension,
                        result: run.win ? "Victory" : `Died on floor ${finalFloor} to ${run.killed_by ? run.killed_by.replace('ENCOUNTER.', '') : 'Unknown'}`,
                        run_time_minutes: Math.floor(run.run_time / 60),
                        // Grab just a few items to avoid overloading the prompt
                        sample_deck: (run.deck_list || []).slice(-4).map(c => c.id.replace('CARD.', '')),
                        sample_relics: (run.relic_list || []).slice(-4).map(r => r.replace('RELIC.', ''))
                    };
                })
            };

            const prompt = JSON.stringify(episodeData, null, 2);
            
            process.stdout.write(`   Generating summary for Episode: "${video.title}"... `);
            
            const result = await model.generateContent(prompt);
            const summaryText = result.response.text().trim();
            
            // 5. Save directly back to the videos table
            const { error: updateError } = await supabase
                .from('ltg_videos')
                .update({ ai_summary: summaryText })
                .eq('id', video.id);
                
            if (updateError) {
                console.log(`❌ DB Update Failed: ${updateError.message}`);
            } else {
                console.log(`✅ Saved!`);
            }

            await new Promise(resolve => setTimeout(resolve, 6500));

        } catch (err) {
            console.log(`❌ Gemini API Error: ${err.message}`);
        }
    }
    
    console.log("🎉 All episode summaries generated!");
}

if (process.argv[1].endsWith('generateSummaries.js')) {
    generateSummaries();
}