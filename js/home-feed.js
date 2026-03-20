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

    // Check Authentication
    const { data: authData } = await supabase.auth.getSession();
    session = authData.session;
    
    if (!session) {
        isLoggedOut = true;
        modeBtn.style.display = 'none'; 
    }

    await syncData();

    // --- DATA SYNCING ---
    async function syncData() {
        if (isLoggedOut) {
            // Fetch from the top_streamers view (Includes live_data)
            const { data, error } = await supabase.from('top_streamers').select('slug, display_name, twitch_channel, youtube_channel_id, kick_channel, live_data').limit(12);
            
            if (error) {
                // Fallback to ltg_channels if view fails
                const fallback = await supabase.from('ltg_channels').select('slug, display_name, twitch_channel, youtube_channel_id, kick_channel, live_data').limit(12);
                masterList = fallback.data || [];
            } else {
                masterList = data || [];
            }
            render();
            return;
        }

        // Logged In: Fetch full library and user follows
        const [mRes, fRes] = await Promise.all([
            supabase.from('ltg_channels').select('slug, display_name, twitch_channel, youtube_channel_id, kick_channel, live_data'),
            supabase.from('ltg_streamers_followed').select('streamer_slug').eq('user_id', session.user.id)
        ]);
        
        if (mRes.error) console.error("Channels Fetch Error:", mRes.error.message);
        
        masterList = mRes.data || [];
        currentFollows = (fRes.data || []).map(f => f.streamer_slug);
        render();
    }

    // --- BUTTON STATE HELPERS ---
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
        return isFollowed ? "remove" : "add";
    }

    // --- HTML BUILDERS ---

    // Build the sub-buttons (Twitch, YT, Kick)
    function buildSubBtn(platform, handle, colorClass, liveData) {
        const icons = { twitch: 'tv', youtube: 'smart_display', kick: 'sports_esports' };
        const icon = icons[platform];
        
        const isLive = liveData && liveData.is_live && liveData.platforms && liveData.platforms.includes(platform);
        const activeClass = isLive ? "active" : "";

        if (!handle) {
            return `<button class="btn btn-gray" style="opacity: 0.3; pointer-events: none;">
                        <span class="material-symbols-outlined">${icon}</span>
                    </button>`;
        }

        if (isEditing) {
            return `<button class="btn btn-${colorClass} ${activeClass} btn-static">
                        <span class="material-symbols-outlined">${icon}</span>
                    </button>`;
        } else {
            return `<a href="https://letstrygg.com/live/#${platform}/${handle}" 
                       target="_blank" 
                       class="btn btn-${colorClass} ${activeClass}" 
                       data-tooltip="${isLive ? 'LIVE - ' + platform : platform}">
                        <span class="material-symbols-outlined">${icon}</span>
                    </a>`;
        }
    }

    // Build the whole multi-button card
    function buildCard(s, isEditMode) {
        let topBtnAttr = "";
        let stateClass = "";

        if (isEditMode) {
            stateClass = getBtnState(s.slug);
            const tip = getTooltipText(s.slug);
            topBtnAttr = tip ? `data-tooltip="${tip}" onclick="window.uiClick('${s.slug}')"` : `onclick="window.uiClick('${s.slug}')"`;
        } else {
            stateClass = "btn-static";
            topBtnAttr = "";
        }

        const sub1 = buildSubBtn('twitch', s.twitch_channel, 'purple', s.live_data);
        const sub2 = buildSubBtn('youtube', s.youtube_channel_id, 'red', s.live_data);
        const sub3 = buildSubBtn('kick', s.kick_channel, 'green', s.live_data);

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

    // --- RENDER LOOP ---
    function render() {
        display.innerHTML = '';
        let html = '';

        if (isLoggedOut) {
            html += `<div style="width: 100%; margin-bottom: 12px; color: var(--gray);">Trending Streamers. Log in to follow.</div>`;
            masterList.forEach(s => html += buildCard(s, false));
        } 
        else if (!isEditing && currentFollows.length === 0) {
            html += `<div style="width: 100%; margin-bottom: 12px; color: var(--gray);">You aren't following anyone yet. Popular channels:</div>`;
            masterList.slice(0, 12).forEach(s => html += buildCard(s, false));
        } 
        else {
            const visibleItems = isEditing 
                ? masterList 
                : masterList.filter(s => currentFollows.includes(s.slug));

            visibleItems.forEach(s => html += buildCard(s, isEditing));
        }
        
        display.innerHTML = html;
    }

    // --- EVENT LISTENERS ---
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
    
    // --- REALTIME: Listen for live_data updates ---
    const streamerSubscription = supabase
        .channel('schema-db-changes')
        .on(
            'postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'ltg_channels' 
            }, 
            (payload) => {
                const updatedStreamer = payload.new;
                
                // Find the streamer in our local list and update their live_data
                const index = masterList.findIndex(s => s.slug === updatedStreamer.slug);
                if (index !== -1) {
                    masterList[index].live_data = updatedStreamer.live_data;
                    
                    // Only re-render if we are NOT currently in Edit Mode 
                    // (To prevent UI jumping while the user is clicking things)
                    if (!isEditing) {
                        render();
                    }
                }
            }
        )
        .subscribe();
});