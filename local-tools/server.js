const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

app.get('/api/config', (req, res) => {
    res.json({
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY
    });
});

const AVATARS_DIR = path.join(__dirname, '../assets/avatars');

// Endpoint 1: Scrape the HTML and return the image URL
app.post('/api/fetch-avatar-url', async (req, res) => {
    const { platform, handle } = req.body;

    if (!platform || !handle) {
        return res.status(400).json({ error: 'Missing platform or handle' });
    }

    try {
        let imageUrl = '';
        
        // Base headers to spoof a modern Chrome browser
        const baseHeaders = { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        };

        if (platform === 'twitch') {
            const { data: html } = await axios.get(`https://www.twitch.tv/${handle}`, { headers: baseHeaders });
            const $ = cheerio.load(html);
            imageUrl = $('meta[property="og:image"]').attr('content');
        } 
        else if (platform === 'youtube') {
            let profileUrl = '';
            // Fix 404: Route UC IDs to /channel/ and handles to /@
            if (handle.startsWith('UC') && handle.length === 24) {
                profileUrl = `https://www.youtube.com/channel/${handle}`;
            } else {
                profileUrl = `https://www.youtube.com/${handle.startsWith('@') ? handle : '@' + handle}`;
            }
            
            const { data: html } = await axios.get(profileUrl, { headers: baseHeaders });
            const $ = cheerio.load(html);
            imageUrl = $('meta[property="og:image"]').attr('content') || $('link[rel="image_src"]').attr('href');
        } 
        else if (platform === 'kick') {
            // Fix 403: Add strict Referer and Accept headers to bypass basic Cloudflare checks
            const kickHeaders = {
                ...baseHeaders,
                'Accept': 'application/json',
                'Referer': `https://kick.com/${handle}`,
                'Origin': 'https://kick.com'
            };
            const { data } = await axios.get(`https://kick.com/api/v1/channels/${handle}`, { headers: kickHeaders });
            imageUrl = data?.user?.profile_pic;
        }

        if (!imageUrl) return res.status(404).json({ error: 'Image not found on page' });
        
        res.json({ success: true, imageUrl });
    } catch (error) {
        console.error(`Scrape Error (${platform}):`, error.message);
        res.status(500).json({ error: `Request failed: ${error.message}` });
    }
});

// Endpoint 2: Download, process, and save the provided URL
app.post('/api/save-avatar', async (req, res) => {
    const { slug, imageUrl } = req.body;

    if (!slug || !imageUrl) return res.status(400).json({ error: 'Missing slug or imageUrl' });

    try {
        const targetDir = path.join(AVATARS_DIR, slug);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        const response = await axios({ url: imageUrl, responseType: 'arraybuffer' });
        const outputPath = path.join(targetDir, 'sm.webp');
        
        await sharp(response.data)
            .resize(30, 30, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(outputPath);

        res.json({ success: true, message: `Saved sm.webp for ${slug}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Local Admin running at http://localhost:${PORT}`));