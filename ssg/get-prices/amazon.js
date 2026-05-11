import * as cheerio from 'cheerio';

async function fetchHtml(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
}

async function getPrice(url) {
    try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);

        const priceText = $('.a-price .a-offscreen').first().text() || $('#priceblock_ourprice').text();
        if (!priceText) return null;

        return parseFloat(priceText.replace(/[^0-9.]/g, ''));
    } catch (error) {
        console.error(`Error scraping price for ${url}:`, error.message);
        return null;
    }
}

async function getFullDetails(url) {
    try {
        const html = await fetchHtml(url);
        const $ = cheerio.load(html);

        const priceText = $('.a-price .a-offscreen').first().text() || $('#priceblock_ourprice').text();
        const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : 0.00;

        const name = $('#productTitle').text().trim() || 'Unknown Product';
        
        // Amazon uses various layouts for the brand line. Try multiple fallback selectors.
        let brand = $('#bylineInfo').text().trim();
        if (!brand) brand = $('.po-brand .a-span9 span').text().trim();
        if (!brand) brand = $('#sellerProfileTriggerId').text().trim();

        // Clean up common Amazon prefix/suffix junk
        brand = brand.replace(/Visit the | Store/gi, '').replace(/Brand:\s*/gi, '').trim() || 'Unknown Brand';
        
        const variantName = $('.selection').text().trim() || 'Standard';

        return { name, brand, variantName, price };
    } catch (error) {
        console.error(`Error scraping details for ${url}:`, error.message);
        return null;
    }
}

export { getPrice, getFullDetails };