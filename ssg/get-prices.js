import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './utils/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML_OUTPUT_PATH = path.join(__dirname, '..', 'fitness', 'protein-price-comparison.html');

async function main() {
    await processQueue();
    await updatePrices();
    await buildHtml();
}

async function processQueue() {
    const { data: queueItems, error } = await supabase
        .from('ltg_item_queue')
        .select('*')
        .eq('processed', false);

    if (error) { console.error("[Queue] Fatal DB Error:", error); process.exit(1); }

    for (const entry of queueItems) {
        console.log(`[Queue] Processing NEW item from URL: ${entry.url}`);
        const asin = entry.url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1];
        if (!asin) {
            console.error(`[Queue] Failed to extract ASIN from ${entry.url}`);
            continue;
        }

        const cleanUrl = `https://www.amazon.com/dp/${asin}?tag=letstrygg.com-20&linkCode=ll2&language=en_US`;
        let scraper;
        try { scraper = await import('./get-prices/amazon.js'); } 
        catch (e) { console.error("[Queue] Failed to load scraper.", e); continue; }
        
        const details = await scraper.getFullDetails(cleanUrl);
        if (!details) { 
            console.error(`[Queue] Scraper returned null/failed for ${cleanUrl}`); 
            continue; 
        }

        const { data: item, error: itemErr } = await supabase.from('ltg_item').insert({
            name: details.name,
            brand: details.brand,
            category: entry.category
        }).select().single();
        if (itemErr) { console.error("[Queue] Item insert error:", itemErr); process.exit(1); }

        const { data: variant, error: varErr } = await supabase.from('ltg_item_variant').insert({
            item_id: item.id,
            name: details.variantName,
            attributes: { size_lbs: 0, servings: 0, calories: 0, protein_g: 0, quality_pct: 100 }
        }).select().single();
        if (varErr) { console.error("[Queue] Variant insert error:", varErr); process.exit(1); }

        const { data: listing, error: listErr } = await supabase.from('ltg_item_listing').insert({
            variant_id: variant.id,
            store: 'amazon',
            url: cleanUrl
        }).select().single();
        if (listErr) { console.error("[Queue] Listing insert error:", listErr); process.exit(1); }

        if (details.price > 0) {
            const { error: priceErr } = await supabase.from('ltg_item_prices').insert({ listing_id: listing.id, price: details.price });
            if (priceErr) { console.error("[Queue] Price log error:", priceErr); process.exit(1); }
            console.log(`[Queue] Initial price $${details.price} logged successfully.`);
        } else {
            console.log(`[Queue] Warning: Price returned 0 or null. No initial price log created.`);
        }

        await supabase.from('ltg_item_queue').update({ processed: true }).eq('id', entry.id);
    }
}

async function updatePrices() {
    const { data: listings, error } = await supabase
        .from('ltg_item_listing')
        .select(`
            id, store, url,
            ltg_item_variant ( id, name, ltg_item ( id, name, brand ) ),
            ltg_item_prices ( price, recorded_at )
        `)
        .eq('is_active', true);

    if (error) { console.error("[Updater] Fatal DB Error fetching listings:", error); process.exit(1); }

    const todayString = new Date().toDateString();

    for (const listing of listings) {
        let scraper;
        try { scraper = await import(`./get-prices/${listing.store}.js`); } 
        catch (e) { console.error(`[Updater] Scraper missing for ${listing.store}`); continue; }

        const item = listing.ltg_item_variant.ltg_item;
        const variant = listing.ltg_item_variant;

        const sortedLogs = listing.ltg_item_prices ? listing.ltg_item_prices.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at)) : [];
        const latestLog = sortedLogs[0];

        // Figure out exactly what is missing
        const missingFields = [];
        if (!item.name) missingFields.push('item.name');
        if (!item.brand) missingFields.push('item.brand');
        if (!variant.name) missingFields.push('variant.name');

        if (missingFields.length > 0) {
            // Get the best available name for the console log
            const displayName = item.name || item.brand || listing.url.split('dp/')[1]?.split('?')[0] || 'Unknown Item';
            console.log(`[Updater] ${displayName} missing [ ${missingFields.join(', ')} ]`);
            
            const details = await scraper.getFullDetails(listing.url);
            
            if (details) {
                // Construct tight updates ONLY for null fields that we successfully scraped
                const itemUpdates = {};
                if (!item.name && details.name) itemUpdates.name = details.name;
                if (!item.brand && details.brand) itemUpdates.brand = details.brand;

                if (Object.keys(itemUpdates).length > 0) {
                    await supabase.from('ltg_item').update(itemUpdates).eq('id', item.id);
                    console.log(`[Updater] Backfilled Item ->`, itemUpdates);
                }

                if (!variant.name && details.variantName) {
                    await supabase.from('ltg_item_variant').update({ name: details.variantName }).eq('id', variant.id);
                    console.log(`[Updater] Backfilled Variant -> { name: "${details.variantName}" }`);
                }

                // Log what is STILL missing so you can identify scraper flaws
                const stillMissing = [];
                if (!item.name && !details.name) stillMissing.push('item.name');
                if (!item.brand && !details.brand) stillMissing.push('item.brand');
                if (!variant.name && !details.variantName) stillMissing.push('variant.name');

                if (stillMissing.length > 0) {
                    console.log(`[Updater] Still unable to locate: [ ${stillMissing.join(', ')} ]`);
                }
                
                // Handle Price logging
                if (details.price > 0) {
                    const logDateString = latestLog ? new Date(latestLog.recorded_at).toDateString() : '';
                    if (latestLog && latestLog.price === details.price && todayString === logDateString) {
                        console.log(`[Updater] Price ($${details.price}) unchanged today. Skipping log.`);
                    } else {
                        await supabase.from('ltg_item_prices').insert([{ listing_id: listing.id, price: details.price }]);
                        console.log(`[Updater] Logged new price: $${details.price}`);
                    }
                }
            }
        } else {
            // Standard lightweight price check
            const currentPrice = await scraper.getPrice(listing.url);
            if (currentPrice !== null) {
                const logDateString = latestLog ? new Date(latestLog.recorded_at).toDateString() : '';
                
                if (latestLog && latestLog.price === currentPrice && todayString === logDateString) {
                    console.log(`[Updater] ${item.brand} ${item.name} - Price ($${currentPrice}) unchanged today. Skipping log.`);
                } else {
                    const { error: insertError } = await supabase
                        .from('ltg_item_prices')
                        .insert([{ listing_id: listing.id, price: currentPrice }]);

                    if (insertError) { console.error(`[Updater] Price insert error:`, insertError); process.exit(1); }
                    console.log(`[Updater] ${item.brand} ${item.name} - Logged new price: $${currentPrice}`);
                }
            }
        }
    }
}

async function buildHtml() {
    const { data, error } = await supabase
        .from('ltg_item_listing')
        .select(`
            id, store, url,
            ltg_item_variant ( id, name, attributes, ltg_item ( id, name, brand, category ) ),
            ltg_item_prices ( price, recorded_at )
        `)
        .eq('is_active', true)
        .eq('ltg_item_variant.ltg_item.category', 'protein_powder');

    if (error) { console.error("[HTML] Fatal DB Error fetching data:", error); process.exit(1); }

    let tableRows = '';

    data.forEach(row => {
        const item = row.ltg_item_variant.ltg_item;
        const variant = row.ltg_item_variant;
        const attrs = variant.attributes || {};
        
        const sortedLogs = row.ltg_item_prices.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
        const latestLog = sortedLogs[0];
        
        const priceNum = latestLog ? latestLog.price : 0;
        const priceDisplay = latestLog ? `$${priceNum.toFixed(2)}` : 'N/A';
        const dateDisplay = latestLog ? new Date(latestLog.recorded_at).toLocaleDateString() : 'N/A';

        const proteinPerServing = attrs.protein_g || 0;
        const servings = attrs.servings || 0;
        const calories = attrs.calories || 0;
        const qualityPct = attrs.quality_pct ?? 100;
        const attrsJson = JSON.stringify(attrs).replace(/'/g, "&apos;");

        tableRows += `
            <tr data-item-id="${item.id}" data-variant-id="${variant.id}" data-url="${row.url}"
                data-attrs='${attrsJson}'
                data-price="${priceNum}" data-protein="${proteinPerServing}"
                data-servings="${servings}" data-calories="${calories}" data-quality="${qualityPct}"
                data-item-name="${item.name || ''}" data-variant-name="${variant.name || ''}">
                <td class="cell-brand">${item.brand || '-'}</td>
                <td class="cell-product"><a href="${row.url}" target="_blank" style="color: #bb86fc; text-decoration: none;">${item.name || 'Pending Data'}</a></td>
                <td class="cell-variant">${variant.name || '-'}</td>
                <td>${row.store}</td>
                <td class="cell-size">${attrs.size_lbs || '-'}</td>
                <td class="cell-servings">${servings || '-'}</td>
                <td class="cell-calories">${calories || '-'}</td>
                <td class="cell-protein">${proteinPerServing || '-'}</td>
                <td class="cell-quality">${qualityPct.toFixed(0)}%</td>
                <td>${priceDisplay}</td>
                <td class="calc-price-per-gram">N/A</td>
                <td>${dateDisplay}</td>
            </tr>
        `;
    });

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
    .tracker-table input.sm { width: 100%; padding: 4px; background: #111; color: #fff; border: 1px solid #333; font-size: 0.9em; border-radius: 4px; }
    .affiliate-footer { margin-top: 30px; font-size: 0.85em; color: #888; }
</style>

<div id="ctrl" class="hidden" style="margin-bottom: 15px;">
    <button id="btn">Edit</button>
    <input id="input" class="hidden" placeholder="Paste Amazon URL and press Enter...">
</div>

<div class="table-responsive" style="overflow-x: auto;">
    <table class="tracker-table">
        <thead>
            <tr>
                <th>Brand</th>
                <th>Product</th>
                <th>Variant</th>
                <th>Store</th>
                <th>Size (lbs)</th>
                <th>Servings</th>
                <th>Calories</th>
                <th>Protein (g)</th>
                <th style="white-space: nowrap;">Quality % <span data-tooltip="Factor in Quality % for $/Gram Protein" style="display: inline-block; vertical-align: middle;"><input type="checkbox" id="toggleQuality" checked style="margin-left: 5px; cursor: pointer;"></span></th>
                <th>Current Price</th>
                <th>$/Gram Protein</th>
                <th>Last Updated</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
</div>

<div class="affiliate-footer">
    As an <a href="https://www.amazon.com/?&linkCode=ll2&tag=letstrygg.com-20&linkId=675320e66b238f584ccfe3c7d717cd28&language=en_US&ref_=as_li_ss_tl" target="_blank" style="color: inherit; text-decoration: underline;">Amazon</a> Associate I earn from qualifying purchases.
</div>

<script>
    document.addEventListener('DOMContentLoaded', () => {
        const toggle = document.getElementById('toggleQuality');
        const btn = document.getElementById('btn');
        const input = document.getElementById('input');
        const rows = document.querySelectorAll('.tracker-table tbody tr');

        input.addEventListener('keypress', async (e) => {
            if (e.key !== 'Enter') return;
            const url = input.value.trim();
            const match = url.match(/\\/dp\\/([A-Z0-9]{10})/i);
            const asin = match ? match[1] : null;
            if (!asin) return;
            
            input.disabled = true;
            const { data: existing } = await window.supabaseClient.from('ltg_item_listing').select('id').ilike('url', '%' + asin + '%').limit(1);
            if (existing && existing.length > 0) {
                console.log("[Queue] ASIN " + asin + " is already tracked.");
            } else {
                const { error } = await window.supabaseClient.from('ltg_item_queue').insert([{ url: url, category: 'protein_powder' }]);
                if (error) console.error("[Queue] Database error:", error.message);
                else input.value = '';
            }
            input.disabled = false;
        });

        function calculatePrices() {
            rows.forEach(row => {
                const price = parseFloat(row.getAttribute('data-price'));
                let p, s, q;
                if (btn.textContent === 'Save') {
                    const ins = row.querySelectorAll('input');
                    s = parseFloat(ins[4].value) || 0; // Servings
                    p = parseFloat(ins[6].value) || 0; // Protein
                    q = parseFloat(ins[7].value) || 0; // Quality % (0-100)
                } else {
                    p = parseFloat(row.dataset.protein) || 0;
                    s = parseFloat(row.dataset.servings) || 0;
                    q = parseFloat(row.dataset.quality) || 100;
                }
                const cell = row.querySelector('.calc-price-per-gram');
                if (price > 0 && p > 0 && s > 0) {
                    const effQ = (toggle && toggle.checked) ? q / 100 : 1;
                    cell.textContent = '$' + (price / (p * s * effQ)).toFixed(4);
                } else {
                    cell.textContent = 'N/A';
                }
            });
        }

        const authInt = setInterval(async () => {
            if (!window.supabaseClient) return;
            clearInterval(authInt);
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            console.log("[Auth] Current user:", session?.user?.email || "Guest");
            if (session?.user?.email === 'letstrygg@gmail.com') document.getElementById('ctrl').classList.remove('hidden');
        }, 500);

        btn.addEventListener('click', async () => {
            if (btn.textContent === 'Edit') {
                btn.textContent = 'Save';
                input.classList.remove('hidden');
                rows.forEach(row => {
                    const cells = ['.cell-brand', '.cell-product', '.cell-variant', '.cell-size', '.cell-servings', '.cell-calories', '.cell-protein', '.cell-quality'];
                    const vals = [
                        row.querySelector('.cell-brand').textContent === '-' ? '' : row.querySelector('.cell-brand').textContent,
                        row.dataset.itemName, row.dataset.variantName,
                        row.querySelector('.cell-size').textContent === '-' ? '' : row.querySelector('.cell-size').textContent,
                        row.dataset.servings, row.dataset.calories, row.dataset.protein, parseFloat(row.dataset.quality)
                    ];
                    cells.forEach((c, i) => {
                        const cell = row.querySelector(c);
                        const el = document.createElement('input');
                        el.className = 'sm';
                        el.value = vals[i];
                        if (i > 2) el.type = 'number';
                        if (i === 3 || i === 6) el.step = '0.01';
                        el.oninput = calculatePrices;
                        cell.innerHTML = '';
                        cell.appendChild(el);
                    });
                });
            } else {
                btn.disabled = true;
                btn.textContent = 'Saving...';
                console.log("[Save] Starting batch update for " + rows.length + " rows.");

                for (const row of rows) {
                    const iId = row.dataset.itemId;
                    const vId = row.dataset.variantId;
                    console.log("[Save] Processing Row - Item ID: " + iId + ", Variant ID: " + vId);

                    const ins = row.querySelectorAll('input');
                    const b = ins[0].value, n = ins[1].value, v = ins[2].value, s = parseFloat(ins[3].value) || 0;
                    const sv = parseFloat(ins[4].value) || 0, cal = parseFloat(ins[5].value) || 0;
                    const p = parseFloat(ins[6].value) || 0, q = parseFloat(ins[7].value) || 0;
                    const attrs = { ...JSON.parse(row.dataset.attrs || '{}'), size_lbs: s, servings: sv, calories: cal, protein_g: p, quality_pct: q };
                    
                    console.log("[Save] -> Updating ltg_item (id: " + iId + ") with brand: " + b + ", name: " + n);
                    const { data: res1, error: err1 } = await window.supabaseClient.from('ltg_item').update({ brand: b, name: n }).eq('id', iId).select();
                    if (err1) console.error("[Save] ltg_item Error:", err1);
                    if (res1 && res1.length === 0) console.error("[Save] FAILED: ltg_item update affected 0 rows. Check Supabase RLS policies for table 'ltg_item'.");

                    console.log("[Save] -> Updating ltg_item_variant (id: " + vId + ") with name: " + v + ", attributes: ", attrs);
                    const { data: res2, error: err2 } = await window.supabaseClient.from('ltg_item_variant').update({ name: v, attributes: attrs }).eq('id', vId).select();
                    if (err2) console.error("[Save] ltg_item_variant Error:", err2);
                    if (res2 && res2.length === 0) console.error("[Save] FAILED: ltg_item_variant update affected 0 rows. Check Supabase RLS policies for table 'ltg_item_variant'.");

                    if (!err1 && !err2 && res1?.length > 0 && res2?.length > 0) console.log("[Save] Successfully updated row " + iId);
                    
                    row.querySelector('.cell-brand').textContent = b || '-';
                    row.querySelector('.cell-product').innerHTML = '<a href="' + row.dataset.url + '" target="_blank" style="color:#bb86fc;text-decoration:none;">' + (n || 'Pending') + '</a>';
                    row.querySelector('.cell-variant').textContent = v || '-';
                    row.querySelector('.cell-size').textContent = s || '-';
                    row.querySelector('.cell-servings').textContent = sv || '-';
                    row.querySelector('.cell-calories').textContent = cal || '-';
                    row.querySelector('.cell-protein').textContent = p || '-';
                    row.querySelector('.cell-quality').textContent = q.toFixed(0) + '%';
                    
                    row.dataset.itemName = n; row.dataset.variantName = v; row.dataset.servings = sv; row.dataset.calories = cal; row.dataset.protein = p; row.dataset.quality = q;
                    row.dataset.attrs = JSON.stringify(attrs);
                }
                console.log("[Save] Batch update finished.");
                btn.textContent = 'Edit';
                btn.disabled = false;
                input.classList.add('hidden');
                calculatePrices();
            }
        });

        toggle.addEventListener('change', calculatePrices);
        calculatePrices();
    });
</script>
`;

    const dir = path.dirname(HTML_OUTPUT_PATH);
    if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); }
    fs.writeFileSync(HTML_OUTPUT_PATH, htmlContent, 'utf8');
    console.log(`[HTML] Successfully built at ${HTML_OUTPUT_PATH}`);
}

main();