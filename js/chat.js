function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

// 1. GUARANTEE UI VISIBILITY
const chatSidebar = document.getElementById('chatSidebar');
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

// Filter Toggles
const timeToggle = document.getElementById('timeToggle');
const deletedToggle = document.getElementById('deletedToggle');
const globalToggle = document.getElementById('globalChatToggle');
const channelToggle = document.getElementById('channelChatToggle');

let isChatOpen = localStorage.getItem('chatOpen') !== 'false'; 
function updateChatVisibility() {
    if (isChatOpen) {
        chatSidebar.style.right = '0';
        openChatBtn.style.display = 'none';
        document.body.classList.add('chat-open-squish');
    } else {
        chatSidebar.style.right = '-350px';
        openChatBtn.style.display = 'flex';
        document.body.classList.remove('chat-open-squish');
    }
    localStorage.setItem('chatOpen', isChatOpen);
}
openChatBtn.addEventListener('click', () => { isChatOpen = true; updateChatVisibility(); });
closeChatBtn.addEventListener('click', () => { isChatOpen = false; updateChatVisibility(); });
updateChatVisibility();

// 2. SETTINGS POPUP MENU
const settingsBtn = document.getElementById('userSettingsBtn');
const settingsMenu = document.getElementById('userSettingsMenu');
const closeSettings = document.getElementById('closeSettingsMenu');

// Toggle Menu
settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'flex' : 'none';
});

// Close Menu
closeSettings.addEventListener('click', () => settingsMenu.style.display = 'none');
document.addEventListener('click', (e) => {
    if (!settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
        settingsMenu.style.display = 'none';
    }
});

// 3. TIMEZONE & FORMAT LOGIC
const formatSelect = document.getElementById('timeFormatSelect');
const tzLocalBtn = document.getElementById('tzLocalBtn');
const tzLtgBtn = document.getElementById('tzLtgBtn');

let useLtgTime = localStorage.getItem('chatUseLtgTime') === 'true';
formatSelect.value = localStorage.getItem('chatTimeFormat') || '24';

function updateTzToggleUI() {
    if (useLtgTime) {
        tzLtgBtn.style.background = '#e67e22'; // LTG Orange
        tzLtgBtn.style.color = '#fff';
        tzLtgBtn.style.fontWeight = 'bold';
        tzLocalBtn.style.background = 'transparent';
        tzLocalBtn.style.color = 'var(--text-muted)';
        tzLocalBtn.style.fontWeight = 'normal';
    } else {
        tzLocalBtn.style.background = '#3498db'; // Local Blue
        tzLocalBtn.style.color = '#fff';
        tzLocalBtn.style.fontWeight = 'bold';
        tzLtgBtn.style.background = 'transparent';
        tzLtgBtn.style.color = 'var(--text-muted)';
        tzLtgBtn.style.fontWeight = 'normal';
    }
}
updateTzToggleUI();

// Listeners instantly re-render timestamps
tzLocalBtn.addEventListener('click', () => {
    useLtgTime = false;
    localStorage.setItem('chatUseLtgTime', 'false');
    updateTzToggleUI();
    renderMessages();
});
tzLtgBtn.addEventListener('click', () => {
    useLtgTime = true;
    localStorage.setItem('chatUseLtgTime', 'true');
    updateTzToggleUI();
    renderMessages();
});
formatSelect.addEventListener('change', (e) => {
    localStorage.setItem('chatTimeFormat', e.target.value);
    renderMessages();
});

// The Master Format Engine
function formatTime(dateStr) {
    const d = new Date(dateStr);
    const use24h = (localStorage.getItem('chatTimeFormat') || '24') === '24';
    
    // "America/Phoenix" permanently anchors to UTC-7 regardless of Daylight Savings
    const tz = useLtgTime ? 'America/Phoenix' : Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Get the localized date (M/D/YY)
    const dateOpts = { timeZone: tz, year: '2-digit', month: 'numeric', day: 'numeric' };
    const msgDate = new Intl.DateTimeFormat('en-US', dateOpts).format(d);
    
    // To check if it's "today", we also need to get "now" in the requested timezone
    const nowDate = new Intl.DateTimeFormat('en-US', dateOpts).format(new Date());

    // Get the localized time
    const timeOpts = { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: use24h ? 'h23' : 'h12' };
    let timeStr = new Intl.DateTimeFormat('en-US', timeOpts).format(d);

    // Aesthetics: pad 24h hours (e.g., "09:05" instead of "9:05")
    if (use24h) {
        let parts = timeStr.split(':');
        if (parts[0].length === 1) parts[0] = '0' + parts[0];
        timeStr = parts.join(':');
    }

    if (msgDate === nowDate) return timeStr;
    
    // If not today, show "M/D" for current year, or "M/D/YY" for old years
    const msgYear = msgDate.split('/')[2];
    const nowYear = nowDate.split('/')[2];
    
    if (msgYear === nowYear) {
        const md = msgDate.split('/').slice(0, 2).join('/'); // "M/D"
        return `${md} ${timeStr}`;
    }
    return `${msgDate} ${timeStr}`;
}

// 4. TIMESTAMPS & GRABBER
let showTimestamps = localStorage.getItem('showTimestamps') === 'true';
timeToggle.classList.toggle('active-blue', showTimestamps);
if (showTimestamps) chatBox.classList.add('show-timestamps');

timeToggle.addEventListener('click', () => {
    showTimestamps = !showTimestamps;
    localStorage.setItem('showTimestamps', showTimestamps);
    timeToggle.classList.toggle('active-blue', showTimestamps);
    showTimestamps ? chatBox.classList.add('show-timestamps') : chatBox.classList.remove('show-timestamps');
});

grabTimeBtn.addEventListener('click', () => {
    if (typeof player !== 'undefined' && player && typeof player.getCurrentTime === 'function') {
        const time = player.getCurrentTime();
        const h = Math.floor(time / 3600);
        const m = Math.floor((time % 3600) / 60);
        const s = Math.floor(time % 60);
        
        let timeStr = h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
        chatInput.value += (chatInput.value.length > 0 && !chatInput.value.endsWith(' ') ? ' ' : '') + `(${timeStr}) `;
        chatInput.focus();
    } else {
        statusMessage.textContent = "Play video to grab time.";
        statusMessage.style.color = "#e74c3c";
        setTimeout(() => statusMessage.textContent = "", 2000);
    }
});

// 5. CHAT LOGIC & ROOM TOGGLES
// Grab variables from window that were set by Jekyll
const supabaseUrl = window.SUPABASE_URL;
const supabaseKey = window.SUPABASE_ANON_KEY;
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentSession = null;
let isAdmin = false;
let showDeleted = false; 
let chatMessagesData = []; 

deletedToggle.addEventListener('click', () => {
    if (!isAdmin) return;
    showDeleted = !showDeleted;
    deletedToggle.classList.toggle('active-red', showDeleted);
    renderMessages();
});

let showGlobalChat = localStorage.getItem('showGlobalChat') !== 'false';
let highlightChannelChat = localStorage.getItem('highlightChannelChat') === 'true';

let currentGame = 'general';
const pathParts = window.location.pathname.split('/game/');
if (pathParts.length > 1) currentGame = pathParts[1].split('/')[0] || 'general';

function updateToggleUI() {
    globalToggle.classList.toggle('active-green', showGlobalChat);
    
    if (currentGame !== 'general') {
        if (!showGlobalChat) {
            channelToggle.classList.remove('active-green');
            channelToggle.classList.add('disabled');
        } else {
            channelToggle.classList.toggle('active-green', highlightChannelChat);
            channelToggle.classList.remove('disabled');
        }
    }
}

globalToggle.addEventListener('click', () => {
    showGlobalChat = !showGlobalChat;
    localStorage.setItem('showGlobalChat', showGlobalChat);
    updateToggleUI();
    renderMessages();
});

if (currentGame !== 'general') {
    const formattedGameName = toTitleCase(currentGame.replace(/-/g, ' '));
    channelToggle.setAttribute('data-tooltip', 'Highlight ' + formattedGameName);
    channelToggle.style.display = 'inline-flex';
    
    channelToggle.addEventListener('click', () => {
        if (!showGlobalChat) return; 
        highlightChannelChat = !highlightChannelChat;
        localStorage.setItem('highlightChannelChat', highlightChannelChat);
        updateToggleUI();
        renderMessages();
    });
} else {
    channelToggle.style.display = 'none';
}
updateToggleUI(); 

async function login(provider) { await supabaseClient.auth.signInWithOAuth({ provider: provider, options: { redirectTo: window.location.origin + window.location.pathname }}); }
async function logout() { await supabaseClient.auth.signOut(); }
async function setDeletedState(id, state) { await supabaseClient.from('ltg_chat').update({ is_deleted: state }).eq('id', id); }

let authTimeout = null;
supabaseClient.auth.onAuthStateChange((event, session) => {
    clearTimeout(authTimeout);
    authTimeout = setTimeout(async () => {
        currentSession = session;
        if (session) {
            loginSection.style.display = 'none';
            inputSection.style.display = 'block';
            isAdmin = session.user.email === 'letstrygg@gmail.com';
            
            if (isAdmin) {
                deletedToggle.style.display = 'inline-flex';
            }
            
            const { data: profile } = await supabaseClient.from('ltg_profiles').select('username, color').eq('user_id', session.user.id).maybeSingle();
            if (profile) {
                userNameDisplay.textContent = profile.username;
                userColorPicker.value = profile.color;
            }
        } else {
            loginSection.style.display = 'block';
            inputSection.style.display = 'none';
            isAdmin = false;
            deletedToggle.style.display = 'none';
        }
        loadMessages(); 
    }, 100); 
});

userColorPicker.addEventListener('change', async (e) => {
    if (!currentSession) return;
    await supabaseClient.from('ltg_profiles').update({ color: e.target.value }).eq('user_id', currentSession.user.id);
    renderMessages(); 
});

async function loadMessages() {
    let query = supabaseClient.from('ltg_chat').select('*, ltg_profiles(username, color)').order('created_at', { ascending: true }).limit(100);
    const { data, error } = await query;
    if (error) { chatBox.innerHTML = `<span style="color:var(--text-muted);">Failed to load messages.</span>`; return; }
    
    chatMessagesData = data || [];
    renderMessages();
}

function renderMessages() {
    chatBox.innerHTML = ''; 
    let visibleCount = 0;

    chatMessagesData.forEach(row => {
        if (row.is_deleted) {
            if (!isAdmin || !showDeleted) return; 
        }
        
        const isChannelMsg = (row.channel === currentGame);

        if (currentGame !== 'general') {
            if (!isChannelMsg && !showGlobalChat) return; 
        } else {
            if (!showGlobalChat) return;
        }

        visibleCount++;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg' + (row.is_deleted ? ' msg-deleted' : '');
        
        if (isChannelMsg && currentGame !== 'general') {
            if (highlightChannelChat && showGlobalChat) {
                msgDiv.classList.add('msg-channel');
            }
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
            const isVideoUrl = row.url.includes('/episodes/') || row.url.includes('-ep-');
            const iconColor = isVideoUrl ? '#e74c3c' : 'var(--text-muted)';
            const iconName = isVideoUrl ? 'smart_display' : 'article';
            const tooltip = isVideoUrl ? 'Go to video' : 'Go to page';
            
            const isInternal = row.url.startsWith('/');
            const targetAttr = isInternal ? '' : 'target="_blank"';

            urlIconHtml = `<a href="${row.url}" ${targetAttr} data-tooltip="${tooltip}" class="tooltip-bottom" style="color: ${iconColor}; display: inline-flex; align-items: center; text-decoration: none; vertical-align: middle; margin: 0 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">${iconName}</span></a>`;
        }

        let formattedMessage = row.message;
        if (row.url) {
            const isCurrentPage = (row.url === window.location.pathname);
            const isInternal = row.url.startsWith('/');
            const targetAttr = isInternal ? '' : 'target="_blank"';
            
            formattedMessage = formattedMessage.replace(/\((\d{1,2}:\d{2}(?::\d{2})?)\)/g, (match, timeStr) => {
                let parts = timeStr.split(':').reverse();
                let seconds = 0;
                for (let i = 0; i < parts.length; i++) seconds += parseInt(parts[i]) * Math.pow(60, i);
                
                if (isCurrentPage && typeof window.triggerInPageJump === 'function') {
                    return `<a href="#" onclick="window.triggerInPageJump(${seconds}); return false;" class="yt-time-link">${timeStr}</a>`;
                } else {
                    return `<a href="${row.url}?t=${seconds}" ${targetAttr} class="yt-time-link">${timeStr}</a>`;
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
        chatBox.innerHTML = '<em style="color:var(--text-muted);">No messages found for selected filters.</em>';
    } else {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

const chatChannel = supabaseClient.channel('chat_updates');
chatChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'ltg_chat' }, payload => { loadMessages(); });
chatChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ltg_profiles' }, payload => { loadMessages(); });
chatChannel.subscribe();

sendBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text || !currentSession) return;
    sendBtn.disabled = true;
    
    const { error } = await supabaseClient.from('ltg_chat').insert([{ 
        message: text, 
        user_id: currentSession.user.id, 
        channel: currentGame,
        url: window.location.pathname 
    }]);
    
    if (!error) chatInput.value = ""; 
    sendBtn.disabled = false;
});
chatInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendBtn.click(); });