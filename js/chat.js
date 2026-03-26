function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

// 1. GUARANTEE UI VISIBILITY
const chatPanel = document.getElementById('chatPanel');
const openChatBtn = document.getElementById('openChatBtn');
const closeChatBtn = document.getElementById('closeChatBtn');
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const statusMessage = document.getElementById('statusMessage');
const loginSection = document.getElementById('loginSection');
const inputSection = document.getElementById('inputSection');
const userNameDisplay = document.getElementById('userNameDisplay');
const userColorPicker = document.getElementById('userColor');
const grabTimeBtn = document.getElementById('grabTimeBtn');
const onlineBadge = document.getElementById('chat-online-count');
const onlineBadgeExpanded = document.getElementById('chat-online-count-expanded');
const expandedOnlineContainer = document.getElementById('expanded-online-container');

// Filter Toggles
const timeToggle = document.getElementById('timeToggle');
const deletedToggle = document.getElementById('deletedToggle');
const globalToggle = document.getElementById('globalChatToggle');
const channelToggle = document.getElementById('channelChatToggle');
const topicToggle = document.getElementById('topicChatToggle'); 

let isChatOpen = true; // Default open for all devices on fresh load

// --- PREVENT RESIZE LAYOUT SHIFT ANIMATION ---
let resizeTimer;
window.addEventListener('resize', () => {
    // 1. Instantly kill the transition via inline style (overrides CSS without !important)
    if (chatPanel) chatPanel.style.transition = 'none';
    
    // 2. Clear the timer if they are still dragging the window
    clearTimeout(resizeTimer);
    
    // 3. Put the transition back 150ms after they stop resizing
    resizeTimer = setTimeout(() => {
        if (chatPanel) chatPanel.style.transition = ''; 
    }, 150); 
});

function updateChatVisibility() {
    if (!chatPanel || !openChatBtn) return;
    
    if (isChatOpen) {
        document.body.classList.add('chat-open-squish');
        openChatBtn.style.display = 'none';
        
        const unreadDot = document.getElementById('chat-unread-dot');
        if (unreadDot) unreadDot.style.display = 'none';
        
        // NEW: Mobile Mutual Exclusivity. If Chat opens on mobile, close the Sidebar.
        if (window.innerWidth <= 768 && window.ltgSidebar && window.ltgSidebar.isOpen) {
            window.ltgSidebar.toggle(false);
        }
        
    } else {
        document.body.classList.remove('chat-open-squish');
        openChatBtn.style.display = 'flex';
    }
    localStorage.setItem('chatOpen', isChatOpen);
}

if (openChatBtn) openChatBtn.addEventListener('click', () => { isChatOpen = true; updateChatVisibility(); });
if (closeChatBtn) closeChatBtn.addEventListener('click', () => { isChatOpen = false; updateChatVisibility(); });
updateChatVisibility();

// 2. SETTINGS POPUP MENU
const settingsBtn = document.getElementById('userSettingsBtn');
const settingsMenu = document.getElementById('userSettingsMenu');
const closeSettings = document.getElementById('closeSettingsMenu');

if (settingsBtn && settingsMenu) {
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'flex' : 'none';
    });
}
if (closeSettings && settingsMenu) {
    closeSettings.addEventListener('click', () => settingsMenu.style.display = 'none');
}
document.addEventListener('click', (e) => {
    if (settingsMenu && settingsBtn && !settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
        settingsMenu.style.display = 'none';
    }
});

// 3. TIMEZONE & FORMAT LOGIC
const formatSelect = document.getElementById('timeFormatSelect');
const tzLocalBtn = document.getElementById('tzLocalBtn');
const tzLtgBtn = document.getElementById('tzLtgBtn');

let useLtgTime = localStorage.getItem('chatUseLtgTime') === 'true';
if (formatSelect) formatSelect.value = localStorage.getItem('chatTimeFormat') || '24';

function updateTzToggleUI() {
    if (!tzLtgBtn || !tzLocalBtn) return;
    if (useLtgTime) {
        tzLtgBtn.style.background = '#e67e22'; 
        tzLtgBtn.style.color = '#fff';
        tzLtgBtn.style.fontWeight = 'bold';
        tzLocalBtn.style.background = 'transparent';
        tzLocalBtn.style.color = 'var(--text-muted)';
        tzLocalBtn.style.fontWeight = 'normal';
    } else {
        tzLocalBtn.style.background = '#3498db'; 
        tzLocalBtn.style.color = '#fff';
        tzLocalBtn.style.fontWeight = 'bold';
        tzLtgBtn.style.background = 'transparent';
        tzLtgBtn.style.color = 'var(--text-muted)';
        tzLtgBtn.style.fontWeight = 'normal';
    }
}
updateTzToggleUI();

if (tzLocalBtn) {
    tzLocalBtn.addEventListener('click', () => {
        useLtgTime = false;
        localStorage.setItem('chatUseLtgTime', 'false');
        updateTzToggleUI();
        renderMessages();
    });
}
if (tzLtgBtn) {
    tzLtgBtn.addEventListener('click', () => {
        useLtgTime = true;
        localStorage.setItem('chatUseLtgTime', 'true');
        updateTzToggleUI();
        renderMessages();
    });
}
if (formatSelect) {
    formatSelect.addEventListener('change', (e) => {
        localStorage.setItem('chatTimeFormat', e.target.value);
        renderMessages();
    });
}

function formatTime(dateStr) {
    const d = new Date(dateStr);
    const use24h = (localStorage.getItem('chatTimeFormat') || '24') === '24';
    const tz = useLtgTime ? 'America/Phoenix' : Intl.DateTimeFormat().resolvedOptions().timeZone;

    const dateOpts = { timeZone: tz, year: '2-digit', month: 'numeric', day: 'numeric' };
    const msgDate = new Intl.DateTimeFormat('en-US', dateOpts).format(d);
    const nowDate = new Intl.DateTimeFormat('en-US', dateOpts).format(new Date());

    const timeOpts = { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: use24h ? 'h23' : 'h12' };
    let timeStr = new Intl.DateTimeFormat('en-US', timeOpts).format(d);

    if (use24h) {
        let parts = timeStr.split(':');
        if (parts[0].length === 1) parts[0] = '0' + parts[0];
        timeStr = parts.join(':');
    }

    if (msgDate === nowDate) return timeStr;
    
    const msgYear = msgDate.split('/')[2];
    const nowYear = nowDate.split('/')[2];
    
    if (msgYear === nowYear) {
        const md = msgDate.split('/').slice(0, 2).join('/'); 
        return `${md} ${timeStr}`;
    }
    return `${msgDate} ${timeStr}`;
}

// 4. TIMESTAMPS & GRABBER
let showTimestamps = localStorage.getItem('showTimestamps') === 'true';
if (timeToggle) {
    timeToggle.classList.toggle('active-blue', showTimestamps);
    if (showTimestamps && chatBox) chatBox.classList.add('show-timestamps');

    timeToggle.addEventListener('click', () => {
        showTimestamps = !showTimestamps;
        localStorage.setItem('showTimestamps', showTimestamps);
        timeToggle.classList.toggle('active-blue', showTimestamps);
        if (chatBox) showTimestamps ? chatBox.classList.add('show-timestamps') : chatBox.classList.remove('show-timestamps');
    });
}

if (grabTimeBtn && chatInput) {
    grabTimeBtn.addEventListener('click', () => {
        if (typeof player !== 'undefined' && player && typeof player.getCurrentTime === 'function') {
            const time = player.getCurrentTime();
            const h = Math.floor(time / 3600);
            const m = Math.floor((time % 3600) / 60);
            const s = Math.floor(time % 60);
            
            let timeStr = h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
            
            // REVERTED: Just insert the clean, human-readable timestamp!
            chatInput.value += (chatInput.value.length > 0 && !chatInput.value.endsWith(' ') ? ' ' : '') + `(${timeStr}) `;
            chatInput.focus();
        } else if (statusMessage) {
            statusMessage.textContent = "Play video to grab time.";
            statusMessage.style.color = "#e74c3c";
            setTimeout(() => statusMessage.textContent = "", 2000);
        }
    });
}

// Singleton Initialization
if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && !window.supabaseClient) {
    window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}
const supabaseClient = window.supabaseClient;

let currentSession = null;
let isAdmin = false;
let showDeleted = false; 
let chatMessagesData = []; 

if (deletedToggle) {
    deletedToggle.addEventListener('click', () => {
        if (!isAdmin) return;
        showDeleted = !showDeleted;
        deletedToggle.classList.toggle('active-red', showDeleted);
        renderMessages();
    });
}

// --- DYNAMIC ROUTING & FILTERING STATE ---
let currentGame = 'general';
let currentTopic = null;
let filterLevel = parseInt(localStorage.getItem('chatFilterLevel')) || 1; 

// --- CACHE DISPLAY NAMES FOR TOOLTIPS ---
let channelMap = {};
async function loadChannelMap() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('ltg_channels').select('slug, display_name');
    if (data) {
        data.forEach(ch => {
            // Uses display_name if available, otherwise TitleCases the slug
            channelMap[ch.slug] = ch.display_name || toTitleCase(ch.slug);
        });
    }
}
loadChannelMap();

function parseRoute() {
    const path = window.location.pathname;
    if (path.startsWith('/game/')) {
        const pathParts = path.split('/game/');
        if (pathParts.length > 1) currentGame = pathParts[1].split('/')[0] || 'general';
        currentTopic = null;
    } else if (path.startsWith('/live')) {
        currentGame = 'live';
        const hash = window.location.hash.substring(1); 
        if (hash && hash.includes('/')) {
            currentTopic = hash.split('/')[1]; 
        } else {
            currentTopic = null;
        }
    } else if (path.startsWith('/yt') || path.startsWith('/youtube')) { 
        currentGame = 'youtube_vod'; 
        currentTopic = window.location.hash.substring(1); // The topic is just the Video ID
    } else {
        currentGame = 'general';
        currentTopic = null;
    }
}
parseRoute();

window.addEventListener('hashchange', () => {
    parseRoute();
    updateToggleUI();
    renderMessages();
});
window.addEventListener('topicChanged', (e) => { 
    currentTopic = e.detail;
    updateToggleUI();
    renderMessages();
});

function updateToggleUI() {
    // Tier 1: Global Level
    if (globalToggle) {
        globalToggle.classList.remove('disabled'); // Ensure it's always clickable
        globalToggle.classList.toggle('active-green', filterLevel === 1);
    }
    
    // Tier 2: Channel Level (/game/ or /live)
    if (channelToggle) {
        if (currentGame !== 'general') {
            channelToggle.style.display = 'inline-flex';
            channelToggle.classList.remove('disabled'); // Ensure it's always clickable
            
            // CASCADING HIGHLIGHT: Active if Global (1) or Channel (2)
            channelToggle.classList.toggle('active-green', filterLevel <= 2);
            
            if (channelToggle.firstElementChild) {
                channelToggle.firstElementChild.textContent = currentGame === 'live' ? 'live_tv' : 'sports_esports';
            }
            channelToggle.setAttribute('data-tooltip', currentGame === 'live' ? 'All Live Streams' : toTitleCase(currentGame.replace(/-/g, ' ')) + ' Chat');
        } else {
            channelToggle.style.display = 'none';
        }
    }

    // Tier 3: Topic Level (Specific streamer hash)
    if (topicToggle) {
        if (currentTopic) {
            topicToggle.style.display = 'inline-flex';
            topicToggle.classList.remove('disabled'); // Ensure it's always clickable
            
            // CASCADING HIGHLIGHT: Active if Global (1), Channel (2), or Topic (3)
            topicToggle.classList.toggle('active-green', filterLevel <= 3);
            
            topicToggle.setAttribute('data-tooltip', toTitleCase(currentTopic) + ' Chat');
        } else {
            topicToggle.style.display = 'none';
            if (filterLevel === 3) {
                filterLevel = 2; // Fallback if hash is cleared
                localStorage.setItem('chatFilterLevel', filterLevel);
            }
        }
    }
}

if (globalToggle) globalToggle.addEventListener('click', () => { filterLevel = 1; localStorage.setItem('chatFilterLevel', filterLevel); updateToggleUI(); renderMessages(); });
if (channelToggle) channelToggle.addEventListener('click', () => { filterLevel = 2; localStorage.setItem('chatFilterLevel', filterLevel); updateToggleUI(); renderMessages(); });
if (topicToggle) topicToggle.addEventListener('click', () => { filterLevel = 3; localStorage.setItem('chatFilterLevel', filterLevel); updateToggleUI(); renderMessages(); });

updateToggleUI(); 

async function login(provider) { if(supabaseClient) await supabaseClient.auth.signInWithOAuth({ provider: provider, options: { redirectTo: window.location.origin + window.location.pathname }}); }
async function logout() { if(supabaseClient) await supabaseClient.auth.signOut(); }
async function setDeletedState(id, state) { if(supabaseClient) await supabaseClient.from('ltg_chat').update({ is_deleted: state }).eq('id', id); }

let authTimeout = null;
if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        clearTimeout(authTimeout);
        authTimeout = setTimeout(async () => {
            currentSession = session;
            if (session) {
                if(loginSection) loginSection.style.display = 'none';
                if(inputSection) inputSection.style.display = 'block';
                isAdmin = session.user.email === 'letstrygg@gmail.com';
                
                if (isAdmin && deletedToggle) deletedToggle.style.display = 'inline-flex';
                
                const { data: profile } = await supabaseClient.from('ltg_profiles').select('username, color').eq('user_id', session.user.id).maybeSingle();
                if (profile) {
                    if(userNameDisplay) userNameDisplay.textContent = profile.username;
                    if (userColorPicker) userColorPicker.value = profile.color;
                }
            } else {
                if(loginSection) loginSection.style.display = 'block';
                if(inputSection) inputSection.style.display = 'none';
                isAdmin = false;
                if (deletedToggle) deletedToggle.style.display = 'none';
            }
            loadMessages(); 
        }, 100); 
    });
}

if (userColorPicker) {
    userColorPicker.addEventListener('change', async (e) => {
        if (!currentSession || !supabaseClient) return;
        await supabaseClient.from('ltg_profiles').update({ color: e.target.value }).eq('user_id', currentSession.user.id);
        renderMessages(); 
    });
}

async function loadMessages() {
    if (!supabaseClient) return;
    let query = supabaseClient.from('ltg_chat').select('*, ltg_profiles(username, color)').order('created_at', { ascending: true }).limit(100);
    const { data, error } = await query;
    if (error && chatBox) { chatBox.innerHTML = `<span style="color:var(--text-muted);">Failed to load messages.</span>`; return; }
    
    chatMessagesData = data || [];
    renderMessages();
}

function renderMessages() {
    if (!chatBox) return;
    chatBox.innerHTML = ''; 
    let visibleCount = 0;

    chatMessagesData.forEach(row => {
        if (row.is_deleted && (!isAdmin || !showDeleted)) return; 
        
        // Tiered Filtering
        if (filterLevel === 2 && row.channel !== currentGame) return;
        if (filterLevel === 3 && (row.channel !== currentGame || row.topic !== currentTopic)) return;

        visibleCount++;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg' + (row.is_deleted ? ' msg-deleted' : '');
        
        if (filterLevel === 1) {
            if (currentTopic && row.topic === currentTopic) {
                msgDiv.classList.add('msg-channel');
            } else if (!currentTopic && currentGame !== 'general' && row.channel === currentGame) {
                msgDiv.classList.add('msg-channel');
            }
        } else if (filterLevel === 2 && currentTopic && row.topic === currentTopic) {
            msgDiv.classList.add('msg-channel'); 
        }
        
        let adminHtml = '';
        if (isAdmin) {
            adminHtml = row.is_deleted 
                ? `<button class="admin-btn" title="Restore" onclick="setDeletedState(${row.id}, false)">♻️</button>`
                : `<button class="admin-btn" title="Delete" onclick="setDeletedState(${row.id}, true)">🗑️</button>`;
        }

        const profile = row.ltg_profiles || {};
        const displayName = profile.username || 'Anon';
        const displayColor = profile.color || '#ffffff';

        let urlIconHtml = '';
        if (row.url) {
            const url = row.url.toLowerCase();
            
            // 1. Categorize the URL
            const isTwitch = url.includes('#twitch') || url.includes('twitch.tv');
            const isKick = url.includes('#kick') || url.includes('kick.com');
            const isYoutubeLive = url.includes('#youtube') || url.includes('/live');
            const isVideo = url.includes('/episodes/') || url.includes('-ep-');

            // 2. NEW: Use the Channel Map to get the Display Name!
            let tooltipName = row.topic ? (channelMap[row.topic] || toTitleCase(row.topic)) : 'Video';
            
            // 3. Set Defaults
            let iconColor = 'var(--gray)';
            let iconName = 'article';
            let tooltip = `Go to ${tooltipName} page`;

            // 4. Apply Specific Branding & Formats
            if (isTwitch) {
                iconColor = 'var(--purple)'; iconName = 'sensors'; tooltip = `Twitch ${tooltipName} Live`;
            } else if (isKick) {
                iconColor = 'var(--green)'; iconName = 'sensors'; tooltip = `Kick ${tooltipName} Live`;
            } else if (isYoutubeLive) {
                iconColor = 'var(--red)'; iconName = 'sensors'; tooltip = `YouTube ${tooltipName} Live`;
            } else if (isVideo || url.includes('/yt/#')) {
                iconColor = 'var(--red)'; iconName = 'smart_display'; tooltip = `Go to Video`;
            }
            
            const isInternal = row.url.startsWith('/');
            const targetAttr = isInternal ? '' : 'target="_blank"';

            urlIconHtml = `<a href="${row.url}" ${targetAttr} data-tooltip="${tooltip}" class="tooltip-bottom" style="color: ${iconColor}; display: inline-flex; align-items: center; text-decoration: none; vertical-align: middle; margin: 0 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">${iconName}</span></a>`;
        }

        let formattedMessage = row.message;
        if (row.url) {
            const currentFullUrl = window.location.pathname + window.location.hash;
            const isCurrentPage = (row.url === currentFullUrl);
            const isInternal = row.url.startsWith('/');
            const targetAttr = isInternal ? '' : 'target="_blank"';
            
            // NEW: Regex catches the time AND the hidden VOD ID (if it exists)
            formattedMessage = formattedMessage.replace(/\((\d{1,2}:\d{2}(?::\d{2})?)(?:\|([a-zA-Z0-9_-]{11}))?\)/g, (match, timeStr, explicitVodId) => {
                let parts = timeStr.split(':').reverse();
                let seconds = 0;
                for (let i = 0; i < parts.length; i++) seconds += parseInt(parts[i]) * Math.pow(60, i);
                
                const currentPermId = typeof window.getPermanentVideoId === 'function' ? window.getPermanentVideoId() : null;
                const isMatchingVod = explicitVodId && currentPermId === explicitVodId;

                // Jump in-page if they are on the same page OR currently watching the matched VOD
                if ((isCurrentPage || isMatchingVod) && typeof window.triggerInPageJump === 'function') {
                    return `<a href="javascript:void(0);" onclick="window.triggerInPageJump(${seconds});" class="yt-time-link">${timeStr}</a>`;
                } else {
                    let timeUrl = '';
                    
                    if (explicitVodId) {
                        // Point the timestamp explicitly to the permanent VOD player
                        timeUrl = `/yt/?t=${seconds}#${explicitVodId}`;
                    } else {
                        // Fallback logic for standard URLs
                        if (row.url.includes('#')) {
                            const urlParts = row.url.split('#');
                            const separator = urlParts[0].includes('?') ? '&' : '?';
                            timeUrl = `${urlParts[0]}${separator}t=${seconds}#${urlParts.slice(1).join('#')}`;
                        } else {
                            const separator = row.url.includes('?') ? '&' : '?';
                            timeUrl = `${row.url}${separator}t=${seconds}`;
                        }
                    }
                    return `<a href="${timeUrl}" ${targetAttr} class="yt-time-link">${timeStr}</a>`;
                }
            });
        }

        msgDiv.innerHTML = `
            <span class="chat-timestamp">${formatTime(row.created_at)}</span>
            <div style="flex-grow: 1;">
                <strong style="color: ${displayColor};">${displayName}</strong>${urlIconHtml}: 
                ${formattedMessage}
            </div>
            ${adminHtml}
        `;
        chatBox.appendChild(msgDiv);
    });

    if (visibleCount === 0) {
        chatBox.innerHTML = '<em style="color:var(--gray);">No messages found for selected filters.</em>';
    } else {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

if (supabaseClient) {
    const chatChannel = supabaseClient.channel('chat_updates');
    chatChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'ltg_chat' }, payload => { 
        loadMessages(); 
        
        // If a new message arrives AND the chat is closed, show the red dot
        if (payload.eventType === 'INSERT' && !isChatOpen) {
            const unreadDot = document.getElementById('chat-unread-dot');
            if (unreadDot) unreadDot.style.display = 'block';
        }
    });
    chatChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ltg_profiles' }, payload => { loadMessages(); });
    chatChannel.subscribe();

// === SUPABASE PRESENCE (LIVE VIEWER COUNT) ===
    const presenceChannel = supabaseClient.channel('global_presence');
    
    // Create a persistent browser ID for anonymous users so multiple tabs = 1 viewer
    let deviceId = localStorage.getItem('ltg_device_id');
    if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem('ltg_device_id', deviceId);
    }

    presenceChannel.on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const uniqueUsers = new Set();
        
        for (const key in newState) {
            newState[key].forEach(state => {
                if (state.user_id) uniqueUsers.add(state.user_id);
            });
        }
        
        const totalOnline = uniqueUsers.size; 
        
        // 1. Update the collapsed bubble badge
        if (onlineBadge) {
            if (totalOnline > 0) {
                onlineBadge.innerText = totalOnline;
                onlineBadge.style.display = 'inline-block';
            } else {
                onlineBadge.style.display = 'none';
            }
        }

        // 2. Update the expanded chat bottom-right tracker
        if (onlineBadgeExpanded && expandedOnlineContainer) {
            if (totalOnline > 0) {
                onlineBadgeExpanded.innerText = totalOnline;
                expandedOnlineContainer.style.display = 'flex';
            } else {
                expandedOnlineContainer.style.display = 'none';
            }
        }
    });

    presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
                // Use Supabase user ID if logged in, otherwise use local browser ID
                user_id: currentSession ? currentSession.user.id : deviceId,
                online_at: new Date().toISOString()
            });
        }
    });
}

if (sendBtn && chatInput) {
    sendBtn.addEventListener('click', async () => {
        const rawText = chatInput.value.trim();
        let dbText = rawText; 
        
        if (!rawText || !currentSession || !supabaseClient) return;
        
        sendBtn.disabled = true;
        chatInput.value = ""; // Clear immediately for instant response
        
        let msgUrl = window.location.pathname + window.location.hash;

        // --- 1. OPTIMISTIC UI (The "Fake" Message) ---
        const tempDiv = document.createElement('div');
        tempDiv.className = 'chat-msg';
        
        // Mirror the Channel Highlighting logic
        if (filterLevel === 1) {
            if (currentTopic || currentGame !== 'general') tempDiv.classList.add('msg-channel');
        } else if (filterLevel === 2 && currentTopic) {
            tempDiv.classList.add('msg-channel');
        }
        
        const tempName = userNameDisplay ? userNameDisplay.textContent : 'You';
        const tempColor = userColorPicker ? userColorPicker.value : '#ffffff';
        const timeStr = formatTime(new Date().toISOString());
        
        // Mirror the URL Icon logic
        let urlLower = msgUrl.toLowerCase();
        let isTwitch = urlLower.includes('#twitch') || urlLower.includes('twitch.tv');
        let isKick = urlLower.includes('#kick') || urlLower.includes('kick.com');
        let isYoutubeLive = urlLower.includes('#youtube') || urlLower.includes('/live');
        let isVideo = urlLower.includes('/episodes/') || urlLower.includes('-ep-') || urlLower.includes('/yt/#');

        let tooltipName = currentTopic ? (typeof channelMap !== 'undefined' && channelMap[currentTopic] ? channelMap[currentTopic] : toTitleCase(currentTopic)) : 'Video';
        let iconColor = 'var(--gray)', iconName = 'article', tooltip = `Go to ${tooltipName} page`;

        if (isTwitch) { iconColor = 'var(--purple)'; iconName = 'sensors'; tooltip = `Twitch ${tooltipName} Live`; } 
        else if (isKick) { iconColor = 'var(--green)'; iconName = 'sensors'; tooltip = `Kick ${tooltipName} Live`; } 
        else if (isYoutubeLive) { iconColor = 'var(--red)'; iconName = 'sensors'; tooltip = `YouTube ${tooltipName} Live`; } 
        else if (isVideo) { iconColor = 'var(--red)'; iconName = 'smart_display'; tooltip = `Go to Video`; }

        let urlIconHtml = `<a href="${msgUrl}" data-tooltip="${tooltip}" class="tooltip-bottom" style="color: ${iconColor}; display: inline-flex; align-items: center; text-decoration: none; vertical-align: middle; margin: 0 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">${iconName}</span></a>`;

        let displayHtml = rawText.replace(/\((\d{1,2}:\d{2}(?::\d{2})?)\)/g, `<a href="javascript:void(0);" class="yt-time-link">$1</a>`);

        // Apply 80% opacity ONLY to the message text span
        tempDiv.innerHTML = `
            <span class="chat-timestamp">${timeStr}</span>
            <div style="flex-grow: 1;">
                <strong style="color: ${tempColor};">${tempName}</strong>${urlIconHtml}: 
                <span class="optimistic-text" style="opacity: 0.8;">${displayHtml}</span>
            </div>
        `;
        chatBox.appendChild(tempDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        // ---------------------------------------------
        
        // 2. THE API HEIST
        if (currentGame === 'live' && window.location.hash.includes('youtube')) {
            if (typeof window.getPermanentVideoId === 'function') {
                const permId = window.getPermanentVideoId();
                if (permId) {
                    dbText = dbText.replace(/\((\d{1,2}:\d{2}(?::\d{2})?)\)/g, `($1|${permId})`);
                }
            }
        }
        
        // 3. SEND TO DATABASE
        const { error } = await supabaseClient.from('ltg_chat').insert([{ 
            message: dbText, 
            user_id: currentSession.user.id, 
            channel: currentGame,
            topic: currentTopic,
            url: msgUrl 
        }]);
        
        // 4. ERROR HANDLING
        if (error) {
            const optText = tempDiv.querySelector('.optimistic-text');
            if (optText) {
                optText.style.color = '#e74c3c';
                optText.style.opacity = '1';
                optText.innerHTML = `<em>Message failed to send. Please try again.</em>`;
            }
            chatInput.value = rawText; 
        }
        
        sendBtn.disabled = false;
        chatInput.focus();
    });
    chatInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendBtn.click(); });
}

// GLOBAL CHAT HOTKEY ('C')
document.addEventListener('keydown', function(e) {
    const activeElement = document.activeElement;
    const isInput = activeElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) || activeElement.isContentEditable);
    if (isInput) return; 

    // NEW: Ignore if the user is holding Ctrl (Windows), Cmd (Mac), or Alt
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        isChatOpen = !isChatOpen;
        updateChatVisibility();
    }
});