import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './utils/db.js';

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HTML_OUTPUT_PATH = path.join(__dirname, '..', 'fitness', 'protein-price-comparison.html');

async function main() {
    console.log("Starting price tracker...");
    await processQueue();
    await updatePrices();
    await buildHtml();
    console.log("Done.");
}

async function processQueue() {
    const { data: queueItems, error } = await supabase
        .from('ltg_item_queue')
        .select('*')
        .eq('processed', false);

    if (error) {
        console.error("Fatal DB Error fetching queue:", error);
        process.exit(1);
    }

    for (const entry of queueItems) {
        console.log(`Processing queue item: ${entry.url}`);
        const asin = entry.url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1];
        if (!asin) continue;

        const cleanUrl = `https://www.amazon.com/dp/${asin}?tag=letstrygg.com-20&linkCode=ll2&language=en_US`;
        
        let scraper;
        try {
            scraper = await import('./get-prices/amazon.js');
        } catch (e) {
            console.error("Failed to load amazon scraper module.", e);
            continue;
        }
        
        const details = await scraper.getFullDetails(cleanUrl);

        if (!details) {
            console.error(`Failed to get details for ${cleanUrl}`);
            continue;
        }

        // 1. Insert Item
        const { data: item, error: itemErr } = await supabase.from('ltg_item').insert({
            name: details.name,
            brand: details.brand,
            category: entry.category
        }).select().single();
        if (itemErr) { console.error("Item insert error:", itemErr); process.exit(1); }

        // 2. Insert Variant
        const { data: variant, error: varErr } = await supabase.from('ltg_item_variant').insert({
            item_id: item.id,
            name: details.variantName,
            attributes: { size_lbs: 0, servings: 0, calories: 0, protein_g: 0, quality_pct: 1.0 }
        }).select().single();
        if (varErr) { console.error("Variant insert error:", varErr); process.exit(1); }

        // 3. Insert Listing
        const { data: listing, error: listErr } = await supabase.from('ltg_item_listing').insert({
            variant_id: variant.id,
            store: 'amazon',
            url: cleanUrl
        }).select().single();
        if (listErr) { console.error("Listing insert error:", listErr); process.exit(1); }

        // 4. Log initial price
        if (details.price > 0) {
            const { error: priceErr } = await supabase.from('ltg_price_log').insert({
                listing_id: listing.id,
                price: details.price
            });
            if (priceErr) { console.error("Price log error:", priceErr); process.exit(1); }
        }

        // 5. Mark Processed
        await supabase.from('ltg_item_queue').update({ processed: true }).eq('id', entry.id);
    }
}

async function updatePrices() {
    const { data: listings, error } = await supabase
        .from('ltg_item_listing')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error("Fatal DB Error fetching listings:", error);
        process.exit(1);
    }

    for (const listing of listings) {
        let scraper;
        try {
            scraper = await import(`./get-prices/${listing.store}.js`);
        } catch (e) {
            console.error(`Scraper for '${listing.store}' missing. Skipping ${listing.url}`);
            continue;
        }

        const currentPrice = await scraper.getPrice(listing.url);

        if (currentPrice !== null) {
            const { error: insertError } = await supabase
                .from('ltg_price_log')
                .insert([{ listing_id: listing.id, price: currentPrice }]);

            if (insertError) {
                console.error(`Fatal error inserting price for listing ${listing.id}:`, insertError);
                process.exit(1);
            }
            console.log(`Updated listing ${listing.id} to $${currentPrice}`);
        }
    }
}

async function buildHtml() {
    const { data, error } = await supabase
        .from('ltg_item_listing')
        .select(`
            store,
            url,
            ltg_item_variant (
                name,
                attributes,
                ltg_item ( name, brand, category )
            ),
            ltg_price_log ( price, recorded_at )
        `)
        .eq('is_active', true)
        .eq('ltg_item_variant.ltg_item.category', 'protein_powder');

    if (error) {
        console.error("Fatal DB Error fetching data for HTML:", error);
        process.exit(1);
    }

    let tableRows = '';

    data.forEach(row => {
        const item = row.ltg_item_variant.ltg_item;
        const variant = row.ltg_item_variant;
        const attrs = variant.attributes || {};
        
        const sortedLogs = row.ltg_price_log.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
        const latestLog = sortedLogs[0];
        
        const price = latestLog ? latestLog.price : 0;
        const priceDisplay = latestLog ? `$${price.toFixed(2)}` : 'N/A';
        const dateDisplay = latestLog ? new Date(latestLog.recorded_at).toLocaleDateString() : 'N/A';

        const proteinPerServing = attrs.protein_g || 0;
        const servings = attrs.servings || 0;
        const qualityPct = attrs.quality_pct || 1;
        
        let pricePerUsableGram = 'N/A';
        if (price > 0 && proteinPerServing > 0 && servings > 0) {
            const totalUsableProtein = proteinPerServing * servings * qualityPct;
            pricePerUsableGram = `$${(price / totalUsableProtein).toFixed(4)}`;
        }

        tableRows += `
            <tr>
                <td>${item.brand}</td>
                <td><a href="${row.url}" target="_blank" style="color: #bb86fc; text-decoration: none;">${item.name} - ${variant.name}</a></td>
                <td>${row.store}</td>
                <td>${attrs.size_lbs || '-'}</td>
                <td>${servings || '-'}</td>
                <td>${proteinPerServing || '-'}</td>
                <td>${(qualityPct * 100).toFixed(0)}%</td>
                <td>${priceDisplay}</td>
                <td>${pricePerUsableGram}</td>
                <td>${dateDisplay}</td>
            </tr>
        `;
    });

    // We replace the HTML wrapper with Jekyll Front Matter
    const htmlContent = `---
layout: new
title: "Protein Price Comparison"
permalink: /fitness/protein-price-comparison.html
---

<style>
    .tracker-table { width: 100%; border-collapse: collapse; margin-top: 1rem; color: #e0e0e0; }
    .tracker-table th, .tracker-table td { border: 1px solid #333; padding: 0.75rem; text-align: left; }
    .tracker-table th { background-color: #1e1e1e; font-weight: bold; }
    .tracker-table tr:hover { background-color: #1a1a1a; }
</style>

<div class="divider-bottom" style="margin-bottom: 30px; padding-bottom: 15px;">
    <h1 class="title">Protein Powder Price Tracker</h1>
    <p class="subtitle" style="margin: 0;">Live Market Analysis</p>
</div>

<div class="table-responsive" style="overflow-x: auto;">
    <table class="tracker-table">
        <thead>
            <tr>
                <th>Brand</th>
                <th>Product</th>
                <th>Store</th>
                <th>Size (lbs)</th>
                <th>Servings</th>
                <th>Protein (g)</th>
                <th>Quality %</th>
                <th>Current Price</th>
                <th>$/Usable Gram</th>
                <th>Last Updated</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
</div>
`;

    const dir = path.dirname(HTML_OUTPUT_PATH);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(HTML_OUTPUT_PATH, htmlContent, 'utf8');
    console.log(`Successfully built HTML at ${HTML_OUTPUT_PATH}`);
}

main();