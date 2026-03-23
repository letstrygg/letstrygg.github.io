document.addEventListener("DOMContentLoaded", async () => {
    const sidebar = document.getElementById('ltg-left-sidebar');
    const content = document.getElementById('sidebar-content');
    const openBtn = document.getElementById('openSidebarBtn');
    const closeBtn = document.getElementById('closeSidebarBtn');
    
    if (!sidebar || !content) return;

    // --- 1. TOGGLE & RESPONSIVE STATE LOGIC ---
    let isMobile = window.innerWidth <= 768;

    function updateToggleUI(mobileState) {
        if (openBtn) {
            const icon = openBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = mobileState ? 'keyboard_double_arrow_up' : 'keyboard_double_arrow_right';
            if (mobileState) {
                openBtn.classList.remove('tooltip-bottom');
            } else {
                openBtn.classList.add('tooltip-bottom');
            }
        }
        if (closeBtn) {
            const icon = closeBtn.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = mobileState ? 'keyboard_double_arrow_down' : 'keyboard_double_arrow_left';
            if (mobileState) {
                closeBtn.classList.remove('tooltip-bottom');
            } else {
                closeBtn.classList.add('tooltip-bottom');
            }
        }
    }

    // Set initial icons and tooltips
    updateToggleUI(isMobile);

    window.ltgSidebar = {
        isOpen: !isMobile,
        toggle: function(forceState) {
            this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;
            
            if (this.isOpen) {
                document.body.classList.add('sidebar-open-squish');
                if (openBtn) openBtn.style.display = 'none';
                
                if (window.innerWidth <= 768 && typeof isChatOpen !== 'undefined' && isChatOpen) {
                    isChatOpen = false;
                    if (typeof updateChatVisibility === 'function') updateChatVisibility();
                }
            } else {
                document.body.classList.remove('sidebar-open-squish');
                if (openBtn) openBtn.style.display = 'flex';
            }
        }
    };

    window.ltgSidebar.toggle(window.ltgSidebar.isOpen);
    if (openBtn) openBtn.addEventListener('click', () => window.ltgSidebar.toggle(true));
    if (closeBtn) closeBtn.addEventListener('click', () => window.ltgSidebar.toggle(false));

    document.addEventListener('keydown', function(e) {
        const activeElement = document.activeElement;
        const isInput = activeElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) || activeElement.isContentEditable);
        if (isInput) return; 

        if (e.key.toLowerCase() === 'd') {
            e.preventDefault();
            window.ltgSidebar.toggle();
        }
    });

    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        const currentWidth = window.innerWidth;
        const wasMobile = lastWidth <= 768;
        const isNowMobile = currentWidth <= 768;
        
        if (!wasMobile && isNowMobile) {
            updateToggleUI(true);
            window.ltgSidebar.toggle(false);
            if (typeof isChatOpen !== 'undefined') {
                isChatOpen = true;
                if (typeof updateChatVisibility === 'function') updateChatVisibility();
            }
        } 
        else if (wasMobile && !isNowMobile) {
            updateToggleUI(false);
            window.ltgSidebar.toggle(true);
            if (typeof isChatOpen !== 'undefined') {
                isChatOpen = true;
                if (typeof updateChatVisibility === 'function') updateChatVisibility();
            }
        }
        lastWidth = currentWidth;
    });

    // --- 2. AUTH & DATA FETCHING ---

    // --- 2. AUTH & DATA FETCHING ---
    const supabaseUrl = window.SUPABASE_URL;
    const supabaseKey = window.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;
    
    const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    const { data: authData } = await supabaseClient.auth.getSession();
    const session = authData.session;

    const defaultPrefs = ['twitch', 'youtube', 'kick'];
    let userPrefs = defaultPrefs;
    
    let followedChannels = [];
    let unfollowedChannels = [];

    // Fetch follows if logged in
    if (session) {
        const [profileRes, followsRes] = await Promise.all([
            supabaseClient.from('ltg_profiles').select('platform_prefs').eq('user_id', session.user.id).maybeSingle(),
            supabaseClient.from('ltg_channels_followed')
                .select(`channel_slug, ltg_channels (slug, display_name, live_data)`)
                .eq('user_id', session.user.id)
        ]);

        if (profileRes.data && profileRes.data.platform_prefs) userPrefs = profileRes.data.platform_prefs;
        if (followsRes.data) {
            followedChannels = followsRes.data.map(f => f.ltg_channels).filter(c => c !== null);
        }
    }

    // Calculate how many more channels we need to hit 15
    const needed = 15 - followedChannels.length;
    
    if (needed > 0) {
        let query = supabaseClient.from('ltg_channels').select('slug, display_name, live_data').limit(needed);
        
        // Exclude already followed channels from this backfill query
        if (followedChannels.length > 0) {
            const followedSlugs = followedChannels.map(c => c.slug);
            query = query.not('slug', 'in', `(${followedSlugs.join(',')})`);
        }
        
        const { data } = await query;
        if (data) unfollowedChannels = data;
    }

    // --- 3. ROUTING & SORTING LOGIC ---
    function getBestLiveRoute(channel) {
        const liveData = channel.live_data || {};
        if (!liveData.is_live || !Array.isArray(liveData.platforms) || liveData.platforms.length === 0) {
            return { isLive: false, platform: null, url: `/live/#twitch/${channel.slug}` };
        }
        for (const pref of userPrefs) {
            if (liveData.platforms.includes(pref)) return { isLive: true, platform: pref, url: `/live/#${pref}/${channel.slug}` };
        }
        return { isLive: true, platform: liveData.platforms[0], url: `/live/#${liveData.platforms[0]}/${channel.slug}` };
    }

    // Tag the channels so we know how to group them during the sort
    followedChannels = followedChannels.map(ch => ({ ...ch, isFollowed: true, route: getBestLiveRoute(ch) }));
    unfollowedChannels = unfollowedChannels.map(ch => ({ ...ch, isFollowed: false, route: getBestLiveRoute(ch) }));
    
    let processedChannels = [...followedChannels, ...unfollowedChannels];

    function sortAndRender() {
        processedChannels.sort((a, b) => {
            // Group 1: Followed channels always stack above unfollowed
            if (a.isFollowed && !b.isFollowed) return -1;
            if (!a.isFollowed && b.isFollowed) return 1;

            // Group 2: Within their respective groups, live channels stack above offline
            if (a.route.isLive && !b.route.isLive) return -1;
            if (!a.route.isLive && b.route.isLive) return 1;
            
            // Group 3: Alphabetical fallback
            const nameA = (a.display_name || a.slug).toLowerCase();
            const nameB = (b.display_name || b.slug).toLowerCase();
            return nameA.localeCompare(nameB);
        });

        content.innerHTML = '';
        processedChannels.forEach(ch => {
            const displayName = ch.display_name || ch.slug;
            const firstLetter = displayName.charAt(0);
            const imgPath = `/assets/avatars/${ch.slug}/sm.webp`;
            const statusClass = ch.route.isLive ? `live-${ch.route.platform}` : 'offline';

            const rowHtml = `
                <a href="${ch.route.url}" class="sidebar-avatar-wrapper tooltip-left ${statusClass}" data-tooltip="${displayName}">
                    <div class="sidebar-avatar-fallback">${firstLetter}</div>
                    <img src="${imgPath}" class="sidebar-avatar-img" alt="${displayName}" onerror="this.style.display='none'">
                </a>
            `;
            content.insertAdjacentHTML('beforeend', rowHtml);
        });
    }

    sortAndRender();

    // --- 4. REALTIME LISTENER ---
    const sidebarChannel = supabaseClient.channel('sidebar_updates');
    sidebarChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ltg_channels' }, payload => {
        const updated = payload.new;
        const index = processedChannels.findIndex(c => c.slug === updated.slug);
        if (index !== -1) {
            processedChannels[index].live_data = updated.live_data;
            processedChannels[index].route = getBestLiveRoute(processedChannels[index]);
            sortAndRender();
        }
    });
    sidebarChannel.subscribe();
});