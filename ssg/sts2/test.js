import dotenv from 'dotenv';

dotenv.config({ path: '../.env' }); // Adjust if your .env is elsewhere

async function checkModels() {
    console.log("🔍 Fetching available Gemini models...");

    if (!process.env.GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY not found.");
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();

        if (data.models) {
            console.log("✅ Available Models that support generateContent:\n");
            
            data.models.forEach(model => {
                if (model.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${model.name}`);
                    console.log(`  Description: ${model.description}`);
                    console.log(`  Version: ${model.version}\n`);
                }
            });
        } else {
            console.error("❌ Failed to fetch models. Raw response:", data);
        }
    } catch (err) {
        console.error(`❌ Fetch Error: ${err.message}`);
    }
}

checkModels();