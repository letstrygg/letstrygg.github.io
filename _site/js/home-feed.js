document.addEventListener("DOMContentLoaded", async () => {
    const display = document.getElementById('display');
    const modeBtn = document.getElementById('modeBtn');
    const supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    let isEditing = false;
    let masterList = [];      
    let currentFollows = [];  
    let pendingAdds = [];     
    let pendingRemoves = [];  
    let session = null;
    let isLoggedOut = false;

    const { data: authData } = await supabase.auth.getSession();
    session = authData.session;
    
    if (!session) {
        isLoggedOut = true;
        modeBtn.style.display = 'none'; // Hide the edit button if they can't use it
    }

    await syncData();

    async function syncData() {
        if (isLoggedOut) {
            // Logged Out: Fetch the top 12 from the view (or fallback to the main table if the view doesn't exist yet)
            const { data, error } = await supabase.from('top_streamers').select('*').limit(12);
            
            // Fallback just in case you haven't run the SQL view creation yet
            if (error) {
                const fallback = await supabase.from('ltg_streamers').select('slug, display_name, twitch_channel, youtube_channel_id, kick_channel').limit(12);
                masterList = fallback.data || [];
            } else {
                masterList = data || [];
            }
            render();
            return;
        }

        // Logged In: Normal fetch
        const [mRes, fRes] = await Promise.all([
            supabase.from('ltg_streamers').select('slug, display_name, twitch_channel, youtube_channel_id, kick_channel'),
            supabase.from('ltg_streamers_followed').select('streamer_slug').eq('user_id', session.user.id)
        ]);
        
        if (mRes.error) console.error("Streamers Fetch Error:", mRes.error.message);
        if (fRes.error) console.error("Follows Fetch Error:", fRes.error.message);

        masterList = mRes.data || [];
        currentFollows = (fRes.data || []).map(f => f.streamer_slug);
        render();
    }

    function getBtnState(slug) {
        if (pendingRemoves.includes(slug)) return "btn-red active";
        if (pendingAdds.includes(slug) || currentFollows.includes(slug)) return "btn-green active";
        return "";
    }

    function toggleState(slug) {
        const isFollowed = currentFollows.includes(slug);
        if (isFollowed) {
            pendingRemoves = pendingRemoves.includes(slug) 
                ? pendingRemoves.filter(s => s !== slug) 
                : [...pendingRemoves, slug];
        } else {
            pendingAdds = pendingAdds.includes(slug) 
                ? pendingAdds.filter(s => s !== slug) 
                : [...pendingAdds, slug];
        }
        render();
    }

    async function commitChanges() {
        if (pendingRemoves.length > 0) {
            await supabase.from('ltg_streamers_followed').delete().eq('user_id', session.user.id).in('streamer_slug', pendingRemoves);
        }
        if (pendingAdds.length > 0) {
            const batch = pendingAdds.map(slug => ({ user_id: session.user.id, streamer_slug: slug }));
            await supabase.from('ltg_streamers_followed').insert(batch);
        }
        pendingAdds = [];
        pendingRemoves = [];
        await syncData();
    }

    function getTooltipText(slug) {
        const isFollowed = currentFollows.includes(slug);
        const isPendingAdd = pendingAdds.includes(slug);
        const isPendingRemove = pendingRemoves.includes(slug);

        if (isPendingRemove || isPendingAdd) return "";
        if (isFollowed) return "remove";
        return "add";
    }

    function buildSubBtn(platform, handle, colorClass) {
        const icons = { twitch: 'tv', youtube: 'smart_display', kick: 'sports_esports' };
        const icon = icons[platform];
        
        if (!handle) {
            return `<button class="btn btn-gray" style="opacity: 0.3; pointer-events: none;">
                        <span class="material-symbols-outlined">${icon}</span>
                    </button>`;
        }

        if (isEditing) {
            return `<button class="btn btn-${colorClass} btn-static">
                        <span class="material-symbols-outlined">${icon}</span>
                    </button>`;
        } else {
            return `<a href="https://letstrygg.com/live/#${platform}/${handle}" 
                       target="_blank" 
                       class="btn btn-${colorClass}" 
                       data-tooltip="${platform}">
                        <span class="material-symbols-outlined">${icon}</span>
                    </a>`;
        }
    }

    // --- NEW HELPER: Assembles the HTML for a single card ---
    function buildCard(s, stateClass, topBtnAttr) {
        const sub1 = buildSubBtn('twitch', s.twitch_channel, 'purple');
        const sub2 = buildSubBtn('youtube', s.youtube_channel_id, 'red');
        const sub3 = buildSubBtn('kick', s.kick_channel, 'green');

        return `
        <div class="multi-btn">
            <button class="btn ${stateClass} btn-main" ${topBtnAttr}>
                ${s.display_name || s.slug}
            </button>
            <div class="btn-tray">
                ${sub1}
                ${sub2}
                ${sub3}
            </div>
        </div>`;
    }

    function render() {
        display.innerHTML = '';
        let html = '';

        // STATE 1: User is completely logged out
        if (isLoggedOut) {
            html += `<div style="width: 100%; margin-bottom: 12px; color: var(--gray);">Trending Streamers. Log in to follow your favorites.</div>`;
            masterList.forEach(s => html += buildCard(s, "btn-static", ""));
        } 
        // STATE 2: Logged in, not editing, but hasn't followed anyone
        else if (!isEditing && currentFollows.length === 0) {
            html += `<div style="width: 100%; margin-bottom: 12px; color: var(--gray);">You aren't following anyone yet. Click Edit to add some, or check out these popular channels:</div>`;
            // Just display the first 12 from the master list as a suggestion
            masterList.slice(0, 12).forEach(s => html += buildCard(s, "btn-static", ""));
        } 
        // STATE 3: Editing, or viewing an active list of follows
        else {
            const visibleItems = isEditing 
                ? masterList 
                : masterList.filter(s => currentFollows.includes(s.slug));

            visibleItems.forEach(s => {
                let topBtnAttr = "";
                let stateClass = "";

                if (isEditing) {
                    stateClass = getBtnState(s.slug);
                    const tip = getTooltipText(s.slug);
                    topBtnAttr = tip ? `data-tooltip="${tip}" onclick="window.uiClick('${s.slug}')"` : `onclick="window.uiClick('${s.slug}')"`;
                } else {
                    stateClass = "btn-static";
                    topBtnAttr = ``;
                }

                html += buildCard(s, stateClass, topBtnAttr);
            });
        }
        
        display.innerHTML = html;
    }

    window.uiClick = (slug) => toggleState(slug);

    modeBtn.addEventListener('click', async () => {
        if (isEditing) {
            await commitChanges(); 
            isEditing = false;     
            modeBtn.innerText = "Edit";
        } else {
            isEditing = true;
            modeBtn.innerText = "Save";
        }
        render();
    });
});