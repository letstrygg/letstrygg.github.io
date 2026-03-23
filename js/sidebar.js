document.addEventListener("DOMContentLoaded", async () => {
    const sidebar = document.getElementById('ltg-left-sidebar');
    if (!sidebar) return;

    // Prevent crash if variables aren't loaded
    const supabaseUrl = window.SUPABASE_URL;
    const supabaseKey = window.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;
    
    const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

    // 1. Check Auth Status
    const { data: authData } = await supabaseClient.auth.getSession();
    const session = authData.session;

    if (!session) {
        sidebar.style.display = 'none'; // Hide sidebar if logged out
        return;
    }

    sidebar.style.display = 'flex'; // Show sidebar

    // 2. Fetch User Preferences and Followed Channels
    const defaultPrefs = ['twitch', 'youtube', 'kick'];
    let userPrefs = defaultPrefs;

    const [profileRes, followsRes] = await Promise.all([
        supabaseClient.from('ltg_profiles').select('platform_prefs').eq('user_id', session.user.id).maybeSingle(),
        supabaseClient.from('ltg_channels_followed')
            .select(`
                channel_slug,
                ltg_channels (
                    slug,
                    display_name,
                    live_data
                )
            `)
            .eq('user_id', session.user.id)
    ]);

    if (profileRes.data && profileRes.data.platform_prefs) {
        userPrefs = profileRes.data.platform_prefs;
    }

    const followedChannels = followsRes.data ? followsRes.data.map(f => f.ltg_channels).filter(c => c !== null) : [];

    // 3. Routing Logic: Find the preferred active platform
    function getBestLiveRoute(channel) {
        const liveData = channel.live_data || {};
        if (!liveData.is_live || !Array.isArray(liveData.platforms) || liveData.platforms.length === 0) {
            return { isLive: false, platform: null, url: `/live/#twitch/${channel.slug}` }; // Default offline route
        }

        // Loop through user preferences in order. First match wins!
        for (const pref of userPrefs) {
            if (liveData.platforms.includes(pref)) {
                return { isLive: true, platform: pref, url: `/live/#${pref}/${channel.slug}` };
            }
        }

        // Fallback: If they are live, but not on a preferred platform, grab the first available
        const fallbackPlat = liveData.platforms[0];
        return { isLive: true, platform: fallbackPlat, url: `/live/#${fallbackPlat}/${channel.slug}` };
    }

    // 4. Sort Channels (Live on top, then alphabetical)
    const processedChannels = followedChannels.map(ch => {
        const route = getBestLiveRoute(ch);
        return { ...ch, route };
    });

    processedChannels.sort((a, b) => {
        if (a.route.isLive && !b.route.isLive) return -1;
        if (!a.route.isLive && b.route.isLive) return 1;
        const nameA = (a.display_name || a.slug).toLowerCase();
        const nameB = (b.display_name || b.slug).toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // 5. Render the Sidebar
    function renderSidebar() {
        sidebar.innerHTML = '';

        processedChannels.forEach(ch => {
            const displayName = ch.display_name || ch.slug;
            const firstLetter = displayName.charAt(0);
            
            // Expected image path
            const imgPath = `/assets/avatars/${ch.slug}/sm.webp`;
            
            // Status classes
            const statusClass = ch.route.isLive ? `live-${ch.route.platform}` : 'offline';
            const tooltipText = ch.route.isLive ? `${displayName} (Live on ${ch.route.platform})` : `${displayName} (Offline)`;

            // HTML Structure: The image has an onerror attribute that hides it if the file doesn't exist, revealing the initial underneath.
            const avatarHtml = `
                <a href="${ch.route.url}" class="sidebar-avatar-wrapper tooltip-right ${statusClass}" data-tooltip="${tooltipText}">
                    <div class="sidebar-avatar-fallback">${firstLetter}</div>
                    <img src="${imgPath}" class="sidebar-avatar-img" alt="${displayName}" onerror="this.style.display='none'">
                </a>
            `;

            sidebar.insertAdjacentHTML('beforeend', avatarHtml);
        });
    }

    renderSidebar();

    // 6. Realtime Updates (Optional but highly recommended)
    const sidebarChannel = supabaseClient.channel('sidebar_updates');
    sidebarChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ltg_channels' }, payload => {
        const updated = payload.new;
        const index = processedChannels.findIndex(c => c.slug === updated.slug);
        
        if (index !== -1) {
            processedChannels[index].live_data = updated.live_data;
            processedChannels[index].route = getBestLiveRoute(processedChannels[index]);
            
            // Resort and Re-render to bump them to the top if they went live
            processedChannels.sort((a, b) => {
                if (a.route.isLive && !b.route.isLive) return -1;
                if (!a.route.isLive && b.route.isLive) return 1;
                const nameA = (a.display_name || a.slug).toLowerCase();
                const nameB = (b.display_name || b.slug).toLowerCase();
                return nameA.localeCompare(nameB);
            });
            renderSidebar();
        }
    });
    sidebarChannel.subscribe();
});