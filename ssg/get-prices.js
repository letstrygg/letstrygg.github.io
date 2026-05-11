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
            attributes: { size_lbs: 0, servings: 0, calories: 0, protein_g: 0, quality_pct: 1.0 }
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
        const qualityPct = attrs.quality_pct || 1;
        const attrsJson = JSON.stringify(attrs).replace(/'/g, "&apos;");

        tableRows += `
            <tr data-item-id="${item.id}" data-variant-id="${variant.id}" 
                data-attrs='${attrsJson}'
                data-price="${priceNum}" data-protein="${proteinPerServing}" 
                data-servings="${servings}" data-quality="${qualityPct}"
                data-item-name="${item.name || ''}" data-variant-name="${variant.name || ''}">
                <td class="cell-brand">${item.brand || '-'}</td>
                <td class="cell-product"><a href="${row.url}" target="_blank" style="color: #bb86fc; text-decoration: none;">${item.name || 'Pending Data'}</a></td>
                <td class="cell-variant">${variant.name || '-'}</td>
                <td>${row.store}</td>
                <td class="cell-size">${attrs.size_lbs || '-'}</td>
                <td class="cell-servings">${servings || '-'}</td>
                <td class="cell-protein">${proteinPerServing || '-'}</td>
                <td class="cell-quality">${(qualityPct * 100).toFixed(0)}%</td>
                <td>${priceDisplay}</td>
                <td class="calc-price-per-gram">N/A</td>
                <td>${dateDisplay}</td>
                <td class="admin-only hidden"><button class="btn-edit btn btn-blue">Edit</button></td>
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
    .tracker-table input.sm { width: 100%; padding: 4px; background: #111; color: #fff; border: 1px solid #444; font-size: 0.9em; border-radius: 4px; }
    .affiliate-footer { margin-top: 30px; font-size: 0.85em; color: #888; }
</style>

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
                <th>Protein (g)</th>
                <th style="white-space: nowrap;">Quality % <span data-tooltip="Factor in Quality % for $/Gram Protein" style="display: inline-block; vertical-align: middle;"><input type="checkbox" id="toggleQuality" checked style="margin-left: 5px; cursor: pointer;"></span></th>
                <th>Current Price</th>
                <th>$/Gram Protein</th>
                <th>Last Updated</th>
                <th class="admin-only hidden">Admin</th>
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
        const rows = document.querySelectorAll('.tracker-table tbody tr');

        function calculatePrices() {
            const useQuality = toggle.checked;

            rows.forEach(row => {
                const price = parseFloat(row.getAttribute('data-price'));
                const protein = parseFloat(row.getAttribute('data-protein'));
                const servings = parseFloat(row.getAttribute('data-servings'));
                const quality = parseFloat(row.getAttribute('data-quality'));
                const targetCell = row.querySelector('.calc-price-per-gram');

                if (price > 0 && protein > 0 && servings > 0) {
                    const effectiveQuality = useQuality ? quality : 1.0;
                    const totalProtein = protein * servings * effectiveQuality;
                    const pricePerGram = price / totalProtein;
                    targetCell.textContent = '$' + pricePerGram.toFixed(4);
                } else {
                    targetCell.textContent = 'N/A';
                }
            });
        }

        toggle.addEventListener('change', calculatePrices);
        calculatePrices();

        // --- ADMIN EDIT LOGIC ---
        const checkAuth = async () => {
            if (!window.supabaseClient) return;
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session?.user?.email === 'letstrygg@gmail.com') {
                document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
            }
        };
        
        const authInterval = setInterval(() => {
            if (window.supabaseClient) {
                clearInterval(authInterval);
                checkAuth();
                window.supabaseClient.auth.onAuthStateChange(() => checkAuth());
            }
        }, 500);

        document.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-edit');
            if (!btn) return;

            const row = btn.closest('tr');
            const isEditing = btn.textContent === 'Save';

            if (!isEditing) {
                btn.textContent = 'Save';
                btn.classList.replace('btn-blue', 'btn-green');
                
                // Brand
                const brandCell = row.querySelector('.cell-brand');
                brandCell.innerHTML = \`<input type="text" class="input sm" value="\${row.dataset.itemName ? brandCell.textContent.trim() : ''}">\`;
                
                // Product (Item Name)
                const productCell = row.querySelector('.cell-product');
                productCell.innerHTML = \`<input type="text" class="input sm" value="\${row.dataset.itemName}">\`;
                
                // Variant
                const variantCell = row.querySelector('.cell-variant');
                variantCell.innerHTML = \`<input type="text" class="input sm" value="\${row.dataset.variantName}">\`;

                row.querySelector('.cell-size').innerHTML = \`<input type="number" step="0.01" class="input sm" value="\${row.querySelector('.cell-size').textContent.trim() === '-' ? '' : row.querySelector('.cell-size').textContent.trim()}">\`;
                row.querySelector('.cell-servings').innerHTML = \`<input type="number" class="input sm" value="\${row.dataset.servings}">\`;
                row.querySelector('.cell-protein').innerHTML = \`<input type="number" class="input sm" value="\${row.dataset.protein}">\`;
                row.querySelector('.cell-quality').innerHTML = \`<input type="number" step="0.01" class="input sm" value="\${row.dataset.quality}">\`;
            } else {
                btn.disabled = true;
                btn.textContent = '...';

                const inputs = row.querySelectorAll('input');
                const brand = inputs[0].value;
                const itemName = inputs[1].value;
                const variantName = inputs[2].value;
                const size = parseFloat(inputs[3].value) || 0;
                const servings = parseFloat(inputs[4].value) || 0;
                const protein = parseFloat(inputs[5].value) || 0;
                const quality = parseFloat(inputs[6].value) || 0;

                const itemId = row.dataset.itemId;
                const variantId = row.dataset.variantId;
                const oldAttrs = JSON.parse(row.dataset.attrs || '{}');
                const attributes = { ...oldAttrs, size_lbs: size, servings, protein_g: protein, quality_pct: quality };

                const { error: err1 } = await window.supabaseClient.from('ltg_item').update({ brand, name: itemName }).eq('id', itemId);
                const { error: err2 } = await window.supabaseClient.from('ltg_item_variant').update({ name: variantName, attributes }).eq('id', variantId);

                if (err1 || err2) {
                    alert('Error: ' + (err1?.message || err2?.message));
                    btn.disabled = false;
                    btn.textContent = 'Save';
                } else {
                    alert('Saved! Run build script to update the static HTML.');
                    location.reload();
                }
            }
        });
    });
</script>
`;

    const dir = path.dirname(HTML_OUTPUT_PATH);
    if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); }
    fs.writeFileSync(HTML_OUTPUT_PATH, htmlContent, 'utf8');
    console.log(`[HTML] Successfully built at ${HTML_OUTPUT_PATH}`);
}

main();