// /js/watch_player.js

var templateVideoId = window.ltgPlayerConfig ? window.ltgPlayerConfig.videoId : '';
var isDynamicPage = (templateVideoId === '');
var activeVideoId = templateVideoId;
var liveChannelId = null;
var resolvedLiveVodId = null; // NEW: Holds the permanent ID of the livestream
var activePlayerPlatform = 'youtube'; 

var storageKey, originalSavedTime, urlParams, urlTime, isPreviewing, startTime, player, saveInterval;

const actionOverlay = document.getElementById('action-overlay');
const actionOverlayIcon = document.getElementById('action-overlay-icon');
const actionOverlayText = document.getElementById('action-overlay-text');
let actionTimeout;

function showActionOverlay(iconName, textString) {
    actionOverlayIcon.innerText = iconName;
    if (textString) {
        actionOverlayText.innerText = textString;
        actionOverlayText.style.display = 'inline';
    } else {
        actionOverlayText.style.display = 'none';
    }
    
    actionOverlay.classList.add('show');
    clearTimeout(actionTimeout);
    actionTimeout = setTimeout(() => { actionOverlay.classList.remove('show'); }, 800);
}

const shortcutsOverlay = document.getElementById('shortcuts-overlay');
const controlsBtn = document.getElementById('controls-btn');
const closeShortcutsBtn = document.getElementById('close-shortcuts-btn');

function toggleShortcuts() {
    if(!shortcutsOverlay) return;
    shortcutsOverlay.style.display = (shortcutsOverlay.style.display === 'none' || shortcutsOverlay.style.display === '') ? 'flex' : 'none';
}

if(controlsBtn) controlsBtn.addEventListener('click', toggleShortcuts);
if(closeShortcutsBtn) closeShortcutsBtn.addEventListener('click', toggleShortcuts);
if(shortcutsOverlay) shortcutsOverlay.addEventListener('click', function(e) { if (e.target === shortcutsOverlay) toggleShortcuts(); });

var allowedSpeeds = [0.25, 0.5, 1, 1.25, 1.5, 2];
var currentSpeed = parseFloat(localStorage.getItem('yt_playback_speed')) || 1;
if (!allowedSpeeds.includes(currentSpeed)) currentSpeed = 1;

function updateSpeedUI() {
    document.querySelectorAll('.speed-dot').forEach(dot => {
        if (parseFloat(dot.getAttribute('data-speed')) === currentSpeed) dot.classList.add('active');
        else dot.classList.remove('active');
    });
}

function applySpeed(speed) {
    let isSpeedingUp = (speed > currentSpeed);
    currentSpeed = speed;
    localStorage.setItem('yt_playback_speed', currentSpeed);
    updateSpeedUI();
    
    if (player && typeof player.setPlaybackRate === 'function') player.setPlaybackRate(currentSpeed);
    showActionOverlay(isSpeedingUp ? 'fast_forward' : 'fast_rewind', currentSpeed + 'x');
}

document.querySelectorAll('.speed-dot').forEach(dot => {
    dot.addEventListener('click', function() { applySpeed(parseFloat(this.getAttribute('data-speed'))); });
});

function handleVolume(delta) {
    if (!player || typeof player.getVolume !== 'function') return;
    if (player.isMuted()) player.unMute();

    let newVol = player.getVolume() + delta;
    newVol = Math.max(0, Math.min(newVol, 100)); 
    
    player.setVolume(newVol);
    showActionOverlay(delta > 0 ? 'volume_up' : 'volume_down', Math.round(newVol) + '%');
}

let seekAccumulator = 0;
let seekTimeout;
const seekOverlayLeft = document.getElementById('seek-overlay-left');
const seekOverlayRight = document.getElementById('seek-overlay-right');

function handleSeek(seconds) {
    if (!player || typeof player.getCurrentTime !== 'function') return;

    if (Math.sign(seconds) !== Math.sign(seekAccumulator) && seekAccumulator !== 0) seekAccumulator = 0;
    seekAccumulator += seconds;

    let newTime = player.getCurrentTime() + seconds;
    if (newTime < 0) newTime = 0;
    if (newTime > player.getDuration()) newTime = player.getDuration();
    
    player.seekTo(newTime, true);

    if (seekAccumulator > 0) {
        if(seekOverlayRight) { seekOverlayRight.innerText = '+' + seekAccumulator + ' >'; seekOverlayRight.classList.add('show'); }
        if(seekOverlayLeft) seekOverlayLeft.classList.remove('show');
    } else {
        if(seekOverlayLeft) { seekOverlayLeft.innerText = '< ' + Math.abs(seekAccumulator); seekOverlayLeft.classList.add('show'); }
        if(seekOverlayRight) seekOverlayRight.classList.remove('show');
    }

    clearTimeout(seekTimeout);
    seekTimeout = setTimeout(() => {
        seekAccumulator = 0;
        if(seekOverlayLeft) seekOverlayLeft.classList.remove('show');
        if(seekOverlayRight) seekOverlayRight.classList.remove('show');
    }, 750);
}

document.addEventListener('keydown', function(e) {
    const activeElement = document.activeElement;
    const isInput = activeElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) || activeElement.isContentEditable);
    if (isInput) return; 

    if (e.key.toLowerCase() === 'f') { toggleTheater(); return; }
    if (e.key.toLowerCase() === 's') { toggleShortcuts(); return; }
    if (e.key.toLowerCase() === 'c') {
        const chatOpenBtn = document.getElementById('openChatBtn');
        const chatCloseBtn = document.getElementById('closeChatBtn');
        if (document.body.classList.contains('chat-open-squish')) {
            if (chatCloseBtn) chatCloseBtn.click();
        } else {
            if (chatOpenBtn) chatOpenBtn.click();
        }
        return;
    }

    if (activePlayerPlatform !== 'youtube') return;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault(); 
    }

    if (e.shiftKey) {
        if (e.key === '>' || e.key === '.') {
            let idx = allowedSpeeds.indexOf(currentSpeed);
            if (idx >= 0 && idx < allowedSpeeds.length - 1) applySpeed(allowedSpeeds[idx + 1]);
        } 
        else if (e.key === '<' || e.key === ',') {
            let idx = allowedSpeeds.indexOf(currentSpeed);
            if (idx > 0) applySpeed(allowedSpeeds[idx - 1]);
        }
        return;
    }

    if (!player || typeof player.getPlayerState !== 'function') return;

    switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
            player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo();
            showActionOverlay(player.getPlayerState() === 1 ? 'pause' : 'play_arrow', '');
            break;
        case 'arrowleft': handleSeek(-5); break;
        case 'arrowright': handleSeek(5); break;
        case 'j': handleSeek(-10); break;
        case 'l': handleSeek(10); break;
        case 'm':
            if (player.isMuted()) {
                player.unMute();
                showActionOverlay('volume_up', 'Unmuted');
            } else {
                player.mute();
                showActionOverlay('volume_off', 'Muted');
            }
            break;
        case 'arrowup': handleVolume(5); break;
        case 'arrowdown': handleVolume(-5); break;
        default:
            if (e.key >= '0' && e.key <= '9') {
                const duration = player.getDuration();
                if (duration) {
                    let percentNum = parseInt(e.key) * 10;
                    showActionOverlay('schedule', `Jump to ${percentNum}%`);
                    window.triggerInPageJump(duration * (percentNum / 100));
                }
            }
            break;
    }
});

updateSpeedUI();

function setupPlayerData(vidId) {
    activeVideoId = vidId;
    resolvedLiveVodId = null; // Reset on new load
    storageKey = 'yt_resume_' + activeVideoId;
    originalSavedTime = parseFloat(localStorage.getItem(storageKey)) || 0;
    urlParams = new URLSearchParams(window.location.search);
    urlTime = urlParams.get('t') ? parseFloat(urlParams.get('t')) : null;
    isPreviewing = urlTime !== null && originalSavedTime > 0 && Math.abs(urlTime - originalSavedTime) > 5;
    startTime = urlTime !== null ? urlTime : originalSavedTime;
}

if (!isDynamicPage) {
    activePlayerPlatform = 'youtube';
    setupPlayerData(templateVideoId);
    injectYouTubeAPI();
}

window.startDynamicPlayer = function(vidId) {
    activePlayerPlatform = 'youtube';
    liveChannelId = null;
    setupPlayerData(vidId);
    injectYouTubeAPI();
    
    const copyBtn = document.getElementById('copy-time-btn');
    if (copyBtn) copyBtn.style.display = 'inline-flex';
};

window.startDynamicLivePlayer = function(platform, streamId) {
    activePlayerPlatform = platform;
    resolvedLiveVodId = null; // Reset
    const target = document.getElementById('stream-embed-target');
    const speedControls = document.getElementById('speed-control-container');
    const controlsBtn = document.getElementById('controls-btn');
    const copyBtn = document.getElementById('copy-time-btn');

    if (platform === 'youtube') {
        liveChannelId = streamId;
        activeVideoId = null; 
        
        // EVERYTHING stays visible for YouTube Live now
        if(speedControls) speedControls.style.display = 'flex';
        if(controlsBtn) controlsBtn.style.display = 'inline-flex';
        if(copyBtn) copyBtn.style.display = 'inline-flex'; 

        target.innerHTML = '<iframe id="ytplayer" src="https://www.youtube.com/embed/live_stream?channel=' + streamId + '&enablejsapi=1&rel=0&modestbranding=1&autoplay=1" frameborder="0" allowfullscreen style="width: 100%; height: 100%;"></iframe>';
        injectYouTubeAPI();
    } else {
        if(speedControls) speedControls.style.display = 'none';
        if(controlsBtn) controlsBtn.style.display = 'none';
        if(copyBtn) copyBtn.style.display = 'none';

        if (player && typeof player.destroy === 'function') {
            try { player.destroy(); } catch(e){}
            player = null;
        }

        if (platform === 'twitch') {
            const hostname = window.location.hostname || 'letstrygg.com';
            target.innerHTML = '<iframe src="https://player.twitch.tv/?channel=' + streamId + '&parent=' + hostname + '&parent=localhost&autoplay=true" frameborder="0" allowfullscreen scrolling="no" style="width: 100%; height: 100%;"></iframe>';
        } else if (platform === 'kick') {
            target.innerHTML = '<iframe src="https://player.kick.com/' + streamId + '" frameborder="0" allowfullscreen scrolling="no" style="width: 100%; height: 100%;"></iframe>';
        }
    }
};

function injectYouTubeAPI() {
    if (window.YT && window.YT.Player) {
         onYouTubeIframeAPIReady(); 
    } else {
         var tag = document.createElement('script');
         tag.src = "https://www.youtube.com/iframe_api";
         var firstScriptTag = document.getElementsByTagName('script')[0];
         firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
}

function onYouTubeIframeAPIReady() {
  if (!activeVideoId && !liveChannelId) return;
  var iframe = document.getElementById('ytplayer');
  
  if (activeVideoId && iframe) {
      iframe.src = "https://www.youtube.com/embed/" + activeVideoId + "?enablejsapi=1&rel=0&modestbranding=1&fs=1&autoplay=1&start=" + Math.floor(startTime);
  }
  
  player = new YT.Player('ytplayer', { events: { 'onStateChange': onPlayerStateChange } });
}

function onPlayerStateChange(event) {
  if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
      window.focus();
      document.activeElement.blur();
  }

  if (event.data === 1) { // PLAYING
      
      // NEW: THE API HEIST!
      // If we are on a livestream, extract the permanent VOD ID immediately
      if (liveChannelId && !resolvedLiveVodId) {
          const videoData = player.getVideoData();
          if (videoData && videoData.video_id) {
              resolvedLiveVodId = videoData.video_id;
              
              // Migrate the storage key so saving works seamlessly
              storageKey = 'yt_resume_' + resolvedLiveVodId;
              originalSavedTime = parseFloat(localStorage.getItem(storageKey)) || 0;
              
              // If they actually had a saved time for this VOD, show the resume button!
              if (originalSavedTime > 0) {
                  updateResumeButtonUI(originalSavedTime);
              }
          }
      }

      player.setPlaybackRate(currentSpeed);
      if (!saveInterval) {
          saveInterval = setInterval(function() {
              // We can now save progress for activeVideoId OR a resolvedLiveVodId
              if (!isPreviewing && (activeVideoId || resolvedLiveVodId)) {
                  localStorage.setItem(storageKey, player.getCurrentTime());
              }
          }, 5000);
      }
  } else {
      clearInterval(saveInterval);
      saveInterval = null;
  }

  if (event.data === 0) { // ENDED
      if (activeVideoId || resolvedLiveVodId) localStorage.removeItem(storageKey);
      const nextEpisodeUrl = window.ltgPlayerConfig ? window.ltgPlayerConfig.nextUrl : '';
      if (!isDynamicPage && nextEpisodeUrl && nextEpisodeUrl.trim() !== "") {
           window.location.href = nextEpisodeUrl;
      }
  }
}

const resumeBtn = document.getElementById('resume-btn');
const resumeText = document.getElementById('resume-time-text');

function updateResumeButtonUI(timeVal) {
    if(!resumeBtn || !resumeText) return;
    resumeBtn.style.display = 'inline-flex';
    resumeBtn.classList.remove('pulse-once');
    void resumeBtn.offsetWidth; 
    resumeBtn.classList.add('pulse-once');
    let h = Math.floor(timeVal / 3600);
    let m = Math.floor((timeVal % 3600) / 60);
    let s = Math.floor(timeVal % 60);
    resumeText.innerText = 'Resume ' + (h > 0 ? h + ':' + m.toString().padStart(2,'0') + ':' + s.toString().padStart(2,'0') : m + ':' + s.toString().padStart(2,'0'));
}

if (resumeBtn) {
    resumeBtn.addEventListener('click', function() {
        isPreviewing = false; 
        player.seekTo(originalSavedTime, true);
        resumeBtn.style.display = 'none';
        // FIXED: Preserves the hash (e.g., #youtube/jorbs) so you don't get kicked to /live/
        history.replaceState(null, '', window.location.pathname + window.location.hash); 
    });
}

if (isPreviewing) updateResumeButtonUI(originalSavedTime);

window.triggerInPageJump = function(targetSeconds) {
    if (typeof player === 'undefined' || !player || typeof player.getCurrentTime !== 'function') return;
    
    // We can jump if we have a standard ID OR a resolved live ID
    if (!isPreviewing && (activeVideoId || resolvedLiveVodId)) {
        originalSavedTime = player.getCurrentTime();
        isPreviewing = true;
    }
    player.seekTo(targetSeconds, true);
    if (activeVideoId || resolvedLiveVodId) updateResumeButtonUI(originalSavedTime);
};

const copyBtn = document.getElementById('copy-time-btn');
if (copyBtn) {
    copyBtn.addEventListener('click', function() {
        // NEW: Future-Proof Timestamp generation
        // Uses the active ID, or the extracted permanent VOD ID if on a livestream
        const targetId = activeVideoId || resolvedLiveVodId;

        if (player && player.getCurrentTime && targetId) {
            const t = Math.floor(player.getCurrentTime());
            const url = "https://youtu.be/" + targetId + "?t=" + t + "s";
            navigator.clipboard.writeText(url).then(() => {
                const icon = document.getElementById('copy-icon');
                if(icon) icon.innerText = 'check'; 
                copyBtn.setAttribute('data-tooltip', 'Copied!');
                setTimeout(() => { 
                    if(icon) icon.innerText = 'link'; 
                    copyBtn.setAttribute('data-tooltip', 'Copy Timestamp');
                }, 2000);
            });
        }
    });
}

const wrapper = document.getElementById('player-wrapper');
const tIcon = document.getElementById('theater-icon');
const tBtn = document.getElementById('theater-btn');
const tExitOverlay = document.getElementById('theater-exit-overlay');
const tExitBtn = document.getElementById('theater-exit-btn');
let idleTimer;

function resetIdleTimer() {
    if (wrapper && wrapper.classList.contains('theater-active')) {
        if(tExitOverlay) tExitOverlay.style.opacity = '1';
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => { if(tExitOverlay) tExitOverlay.style.opacity = '0'; }, 2000); 
    }
}

if(wrapper) {
    wrapper.addEventListener('mousemove', resetIdleTimer);
    wrapper.addEventListener('touchstart', resetIdleTimer);
    wrapper.addEventListener('mouseleave', () => {
        clearTimeout(idleTimer);
        if (wrapper.classList.contains('theater-active') && tExitOverlay) tExitOverlay.style.opacity = '0'; 
    });
}

function toggleTheater() {
    if(!wrapper) return;
    const isTheater = wrapper.classList.toggle('theater-active');
    if (isTheater) {
        document.body.style.overflow = 'hidden';
        if(tIcon) tIcon.innerText = 'close_fullscreen'; 
        if(tBtn) tBtn.setAttribute('data-tooltip', "Exit Theater 'F'");
        if(tExitOverlay) {
            tExitOverlay.style.display = 'block';
            setTimeout(() => { tExitOverlay.style.opacity = '1'; resetIdleTimer(); }, 10);
        }
    } else {
        document.body.style.overflow = '';
        if(tIcon) tIcon.innerText = 'width_full'; 
        if(tBtn) tBtn.setAttribute('data-tooltip', "Theater Mode 'F'");
        if(tExitOverlay) {
            tExitOverlay.style.opacity = '0';
            setTimeout(() => { tExitOverlay.style.display = 'none'; }, 300); 
        }
        clearTimeout(idleTimer);
    }
}

if(tBtn) tBtn.addEventListener('click', toggleTheater);
if(tExitBtn) tExitBtn.addEventListener('click', toggleTheater);