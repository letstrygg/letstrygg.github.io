document.addEventListener("DOMContentLoaded", async () => {
    const sidebar = document.getElementById('ltg-left-sidebar');
    const content = document.getElementById('sidebar-content');
    const openBtn = document.getElementById('openSidebarBtn');
    const closeBtn = document.getElementById('closeSidebarBtn');
    
    if (!sidebar || !content) return;

    // --- 1. TOGGLE & RESPONSIVE STATE LOGIC ---
    let isMobile = window.innerWidth <= 768;

    window.ltgSidebar = {
        isOpen: !isMobile, // Default: Open on Desktop, Closed on Mobile
        toggle: function(forceState) {
            this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;
            
            if (this.isOpen) {
                document.body.classList.add('sidebar-open-squish');
                if (openBtn) openBtn.style.display = 'none';
                
                // MOBILE EXCLUSIVITY: Close Chat if opening Sidebar
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

    // Apply Initial State
    window.ltgSidebar.toggle(window.ltgSidebar.isOpen);
    if (openBtn) openBtn.addEventListener('click', () => window.ltgSidebar.toggle(true));
    if (closeBtn) closeBtn.addEventListener('click', () => window.ltgSidebar.toggle(false));

    // Global Hotkey 'D'
    document.addEventListener('keydown', function(e) {
        const activeElement = document.activeElement;
        const isInput = activeElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) || activeElement.isContentEditable);
        if (isInput) return; 

        if (e.key.toLowerCase() === 'd') {
            e.preventDefault();
            window.ltgSidebar.toggle();
        }
    });

    // --- 2. THE RESPONSIVE SNAP COORDINATOR ---
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
        const currentWidth = window.innerWidth;
        const wasMobile = lastWidth <= 768;
        const isNowMobile = currentWidth <= 768;
        
        // Crossed breakpoint from Desktop -> Mobile
        if (!wasMobile && isNowMobile) {
            window.ltgSidebar.toggle(false); // Close Directory
            if (typeof isChatOpen !== 'undefined') {
                isChatOpen = true; // Open Chat
                if (typeof updateChatVisibility === 'function') updateChatVisibility();
            }
        } 
        // Crossed breakpoint from Mobile -> Desktop
        else if (wasMobile && !isNowMobile) {
            window.ltgSidebar.toggle(true); // Open Directory
            if (typeof isChatOpen !== 'undefined') {
                isChatOpen = true; // Open Chat
                if (typeof updateChatVisibility === 'function') updateChatVisibility();
            }
        }
        lastWidth = currentWidth;
    });

    // --- 3. AUTH & DATA FETCHING ---
    const supabaseUrl = window.SUPABASE_URL;
    const supabaseKey = window.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;
    
    const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    const { data: authData } = await supabaseClient.auth.getSession();
    const session = authData.session;

    if (!session) {
        if (openBtn) openBtn.style.display = 'none';
        return;
    }

    const defaultPrefs = ['twitch', 'youtube', 'kick'];
    let userPrefs = defaultPrefs;

    const [profileRes, followsRes] = await Promise.all([
        supabaseClient.from('ltg_profiles').select('platform_prefs').eq('user_id', session.user.id).maybeSingle(),
        supabaseClient.from('ltg_channels_followed')
            .select(`channel_slug, ltg_channels (slug, display_name, live_data)`)
            .eq('user_id', session.user.id)
    ]);

    if (profileRes.data && profileRes.data.platform_prefs) userPrefs = profileRes.data.platform_prefs;
    const followedChannels = followsRes.data ? followsRes.data.map(f => f.ltg_channels).filter(c => c !== null) : [];

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

    let processedChannels = followedChannels.map(ch => ({ ...ch, route: getBestLiveRoute(ch) }));

	function sortAndRender() {
        processedChannels.sort((a, b) => {
            if (a.route.isLive && !b.route.isLive) return -1;
            if (!a.route.isLive && b.route.isLive) return 1;
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

            // Changed to tooltip-left and restricted tooltip text to displayName only
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