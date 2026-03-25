import { StatsCalc } from './statsCalc.js';

export const UI = {
    Dashboard: function(global, avg, adv, opts) {
        const {
            itemCount = 0, 
            itemIcon = "sports_esports", 
            itemLabel = "Total Items", 
            groupLabel = "PER ITEM",
            hideGroupAvg = false
        } = opts;

        let html = `
  <div class="dash-panel" id="main-dashboard">
    <div class="dash-row" style="padding-top: 0;">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">TOTALS:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="${itemLabel}"><span class="material-symbols-outlined" style="color: var(--text); font-size: 18px;">${itemIcon}</span> <span id="val-tot-items">${itemCount}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Videos"><span class="material-symbols-outlined red" style="font-size: 18px;">video_library</span> <span id="val-tot-vids">${StatsCalc.formatNum(global.total_videos)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Views"><span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> <span id="val-tot-views">${StatsCalc.formatNum(global.total_views)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Likes"><span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> <span id="val-tot-likes">${StatsCalc.formatNum(global.total_likes)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Comments"><span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> <span id="val-tot-comms">${StatsCalc.formatNum(global.total_comments)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Total Duration"><span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> <span id="val-tot-dur">${StatsCalc.formatDur(global.total_duration)}</span></div>
    </div>`;

        if (!hideGroupAvg) {
            html += `
    <div class="dash-row">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">${groupLabel}:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Videos vs ${groupLabel}"><span class="material-symbols-outlined red" style="font-size: 18px;">video_library</span> <span id="val-avg-vid">${StatsCalc.formatNum(avg.items)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Views vs ${groupLabel}"><span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> <span id="val-avg-view">${StatsCalc.formatNum(avg.views)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Likes vs ${groupLabel}"><span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> <span id="val-avg-like">${StatsCalc.formatNum(avg.likes)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Comments vs ${groupLabel}"><span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> <span id="val-avg-comm">${StatsCalc.formatNum(avg.comments)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Duration vs ${groupLabel}"><span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> <span id="val-avg-dur">${StatsCalc.formatDur(avg.duration)}</span></div>
    </div>`;
        }

        html += `
    <div class="dash-row">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">PER VID:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Views per Video"><span class="material-symbols-outlined blue" style="font-size: 18px;">visibility</span> <span id="val-pv-view">${StatsCalc.formatNum(avg.viewsPerVid)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Likes per Video"><span class="material-symbols-outlined green" style="font-size: 18px;">thumb_up</span> <span id="val-pv-like">${StatsCalc.formatNum(avg.likesPerVid)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Comments per Video"><span class="material-symbols-outlined orange" style="font-size: 18px;">chat_bubble</span> <span id="val-pv-comm">${StatsCalc.formatNum(avg.commentsPerVid)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Avg Duration per Video"><span class="material-symbols-outlined purple" style="font-size: 18px;">schedule</span> <span id="val-pv-dur">${StatsCalc.formatDur(avg.durPerVid)}</span></div>
    </div>

    <div class="dash-row" style="gap: 20px;">
      <div class="dash-stat" style="color: var(--gray); font-weight: bold; min-width: 90px;">ANALYTICS:</div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Age of filtered content"><strong style="margin-right: 4px;">Age:</strong> <span id="val-adv-age">${StatsCalc.formatAge(adv.age)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Days since last upload"><strong style="margin-right: 4px;">Inactive:</strong> <span id="val-adv-dead">${StatsCalc.formatAge(adv.dead)}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Views generated per day"><strong style="margin-right: 4px;">Vel:</strong> <span class="blue" id="val-adv-vel">${adv.vel}/d</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Overall Trending Score"><strong style="margin-right: 4px;">Heat:</strong> <span class="red" id="val-adv-heat">${adv.heat}</span></div>
      <div class="dash-stat tooltip-trigger" data-tooltip="Overall Hidden Gem Score"><strong style="margin-right: 4px;">Gem:</strong> <span class="orange" id="val-adv-gem">${adv.gem}</span></div>
    </div>
  </div>`;

        return html;
    },

    FilterControls: function() {
        return `
<div class="panel" style="margin-bottom: 20px; gap: 15px;">
    <div class="flex-row">
        <div style="position: relative; flex: 1;">
            <input type="text" id="gameSearch" class="input" placeholder="Search...">
            <span id="clearSearch" class="material-symbols-outlined hidden" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--gray);" onclick="clearSearchInput()">close</span>
        </div>
        <div class="flex-row" style="gap: 10px;">
            <button class="btn btn-gray" id="btn-tags-toggle" onclick="toggleTagPanel()">
                <span class="material-symbols-outlined">sell</span> Tags
            </button>
        </div>
    </div>

    <div class="btn-group flex-wrap">
        <button class="btn btn-green active" id="btn-recent" onclick="sortGrid('recent')"><span class="material-symbols-outlined">psychiatry</span> New</button>
        <button class="btn btn-blue" id="btn-popular" onclick="sortGrid('popular')"><span class="material-symbols-outlined">visibility</span> Views</button>
        <button class="btn btn-purple" id="btn-length" onclick="sortGrid('length')"><span class="material-symbols-outlined">schedule</span> Duration</button>
        <button class="btn btn-orange" id="btn-vpv" onclick="sortGrid('vpv')"><span class="material-symbols-outlined">mode_heat</span> VPV</button>
        <button class="btn btn-blue" id="btn-vel" onclick="sortGrid('vel')"><span class="material-symbols-outlined">speed</span> Velocity</button>
        <button class="btn btn-red" id="btn-heat" onclick="sortGrid('heat')"><span class="material-symbols-outlined">local_fire_department</span> Heat</button>
        <button class="btn btn-yellow" id="btn-gem" onclick="sortGrid('gem')"><span class="material-symbols-outlined">diamond</span> Gem</button>
    </div>
</div>
<div id="tag-filters" class="panel hidden" style="flex-direction: row; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; padding: 12px;"></div>`;
    },

    GridCard: function(base, stats, adv, avg, opts) {
        const { contextAvg = "Channel Avg", ctaText = "View Directory", hideDeltas = false } = opts;
        
        // Helper string to cleanly blank out deltas when requested
        const delta = (actual, average, isDur) => hideDeltas ? '' : StatsCalc.formatDelta(actual, average, isDur);

        return `
  <div class="panel filterable-card flush-all" data-channel="${base.targetSlug}" data-title="${base.title.toLowerCase()}" data-tags="${base.tagsStr}" 
       data-updated="${adv.maxLast}" data-episodes="${stats.epCount}" data-views="${stats.totalViews}" data-likes="${stats.totalLikes}" data-comments="${stats.totalComments}" data-duration="${stats.totalDuration}" data-vpv="${stats.vpv}" data-firstpub="${adv.minFirst}" data-vel="${adv.vel}" data-heat="${adv.heat}" data-gem="${adv.gem}">
      <a href="${base.url}" class="inner-panel interactive flush-all" style="border: none;">
        <img src="${base.thumbUrl}" alt="${base.title}" loading="lazy" onerror="this.onerror=null; this.src='/assets/img/default-thumbnail.jpg';">
        <div style="padding: 15px; display: flex; flex-direction: column;">
            <div class="flex-between divider-bottom">
              <strong class="label">${base.title}</strong>
              <span class="card-status ${base.superTitleColor}">${base.superTitle}</span>
            </div>
            <div class="flex-between flex-wrap text-sm">
              <span title="Videos" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Videos vs ${contextAvg}"><span class="material-symbols-outlined red">video_library</span> ${StatsCalc.formatNum(stats.epCount)} ${delta(stats.epCount, avg.items)}</span>
              <span title="Views" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Views vs ${contextAvg}"><span class="material-symbols-outlined blue">visibility</span> ${StatsCalc.formatNum(stats.totalViews)} ${delta(stats.totalViews, avg.views)}</span>
              <span title="Likes" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Likes vs ${contextAvg}"><span class="material-symbols-outlined green">thumb_up</span> ${StatsCalc.formatNum(stats.totalLikes)} ${delta(stats.totalLikes, avg.likes)}</span>
              <span title="Comments" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Comments vs ${contextAvg}"><span class="material-symbols-outlined orange">chat_bubble</span> ${StatsCalc.formatNum(stats.totalComments)} ${delta(stats.totalComments, avg.comments)}</span>
              <span title="Duration" class="tooltip-trigger flex-row gap-sm" data-tooltip="Total Duration vs ${contextAvg}"><span class="material-symbols-outlined purple">schedule</span> ${StatsCalc.formatDur(stats.totalDuration)} ${delta(stats.totalDuration, avg.duration, true)}</span>
            </div>
            <div class="flex-between flex-wrap text-sm divider-top-dashed">
              <span title="Views per Video" class="tooltip-trigger flex-row gap-sm" data-tooltip="Views per Video vs ${contextAvg}"><span class="material-symbols-outlined blue">visibility</span> ${StatsCalc.formatNum(stats.vpv)} ${delta(stats.vpv, avg.viewsPerVid)}</span>
              <span title="Likes per Video" class="tooltip-trigger flex-row gap-sm" data-tooltip="Likes per Video vs ${contextAvg}"><span class="material-symbols-outlined green">thumb_up</span> ${StatsCalc.formatNum(stats.lpv)} ${delta(stats.lpv, avg.likesPerVid)}</span>
              <span title="Comments per Video" class="tooltip-trigger flex-row gap-sm" data-tooltip="Comments per Video vs ${contextAvg}"><span class="material-symbols-outlined orange">chat_bubble</span> ${StatsCalc.formatNum(stats.cpv)} ${delta(stats.cpv, avg.commentsPerVid)}</span>
              <span title="Duration per Video" class="tooltip-trigger flex-row gap-sm" data-tooltip="Duration per Video vs ${contextAvg}"><span class="material-symbols-outlined purple">schedule</span> ${StatsCalc.formatDur(stats.dpv)} ${delta(stats.dpv, avg.durPerVid, true)}</span>
            </div>
            <div class="flex-row flex-wrap gap-md text-sm text-muted divider-top-dashed">
              <span class="tooltip-trigger" data-tooltip="Age of content"><strong>Age:</strong> ${StatsCalc.formatAge(adv.age)}</span>
              <span class="tooltip-trigger" data-tooltip="Time between first and last video"><strong>Span:</strong> ${StatsCalc.formatAge(adv.span)}</span>
              <span class="tooltip-trigger" data-tooltip="Days since last upload"><strong>Inactive:</strong> ${StatsCalc.formatAge(adv.dead)}</span>
              <span class="tooltip-trigger" data-tooltip="Views generated per day"><strong>Vel:</strong> <span class="blue">${adv.vel}/d</span></span>
              <span class="tooltip-trigger" data-tooltip="Trending Score"><strong>Heat:</strong> <span class="red">${adv.heat}</span></span>
              <span class="tooltip-trigger" data-tooltip="Hidden Gem Score"><strong>Gem:</strong> <span class="orange">${adv.gem}</span></span>
            </div>
            <div class="flex-between text-sm text-bold text-muted divider-top hover-color-blue" style="margin-bottom: 0;">
              ${ctaText} <span class="material-symbols-outlined hover-opacity" style="font-size: 18px;">arrow_forward</span>
            </div>
        </div>
      </a>
  </div>\n`;
    },
	
	TagCard: function(base, stats, adv, opts) {
        const { ctaText = "Browse Tag" } = opts || {};
        return `
  <div class="panel filterable-card flush-all" data-title="${base.title.toLowerCase()}"
       data-episodes="${base.seriesCount}" data-views="${stats.totalViews}" data-likes="${stats.totalLikes}" data-comments="${stats.totalComments}" data-duration="${stats.totalDuration}" data-vpv="0" data-vel="${adv.vel}" data-heat="${adv.heat}" data-gem="${adv.gem}">
      <a href="${base.url}" class="inner-panel interactive flush-all" style="border: none;">
          <div style="padding: 20px; background: var(--bg3); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <h2 style="margin: 0; font-size: 1.4rem; color: var(--text);">${base.title} <span style="color: var(--gray); font-size: 1rem; font-weight: normal;">(${base.seriesCount})</span></h2>
          </div>
          <div style="padding: 20px; display: flex; flex-direction: column; gap: 15px;">
              <div class="flex-between flex-wrap text-sm">
                  <span title="Total Views" class="tooltip-trigger flex-row gap-sm"><span class="material-symbols-outlined blue">visibility</span> ${StatsCalc.formatNum(stats.totalViews)}</span>
                  <span title="Total Likes" class="tooltip-trigger flex-row gap-sm"><span class="material-symbols-outlined green">thumb_up</span> ${StatsCalc.formatNum(stats.totalLikes)}</span>
                  <span title="Total Duration" class="tooltip-trigger flex-row gap-sm"><span class="material-symbols-outlined purple">schedule</span> ${StatsCalc.formatDur(stats.totalDuration)}</span>
              </div>
              <div class="flex-row flex-wrap gap-md text-sm text-muted divider-top-dashed">
                  <span class="tooltip-trigger" data-tooltip="Views generated per day"><strong>Vel:</strong> <span class="blue">${adv.vel}/d</span></span>
                  <span class="tooltip-trigger" data-tooltip="Trending Score"><strong>Heat:</strong> <span class="red">${adv.heat}</span></span>
                  <span class="tooltip-trigger" data-tooltip="Hidden Gem Score"><strong>Gem:</strong> <span class="orange">${adv.gem}</span></span>
              </div>
              <div class="flex-between text-sm text-bold text-muted divider-top hover-color-blue" style="margin-bottom: 0;">
                  ${ctaText} <span class="material-symbols-outlined hover-opacity" style="font-size: 18px;">arrow_forward</span>
              </div>
          </div>
      </a>
  </div>\n`;
    },

    EpisodeCard: function(base, stats, adv, avg, opts) {
        const { contextAvg = "Season Avg", ctaText = "Watch Episode", hideDeltas = false } = opts;
        
        // Helper string to cleanly blank out deltas when requested
        const delta = (actual, average, isDur) => hideDeltas ? '' : StatsCalc.formatDelta(actual, average, isDur);

        return `
  <div class="panel filterable-card flush-all" data-title="${base.title.toLowerCase()}" data-tags="${base.tagsStr}" 
       data-updated="${adv.rawDate}" data-episodes="1" data-views="${stats.views}" data-likes="${stats.likes}" data-comments="${stats.comments}" data-duration="${stats.duration}" data-vpv="${stats.views}" data-firstpub="${adv.rawDate}" data-vel="${adv.vel}" data-heat="${adv.heat}" data-gem="${adv.gem}">
      <a href="${base.url}" class="inner-panel interactive flush-all" style="border: none;">
        <img src="${base.thumbUrl}" alt="${base.title}" loading="lazy" onerror="this.onerror=null; this.src='/assets/img/default-thumbnail.jpg';">
        <div style="padding: 15px; display: flex; flex-direction: column;">
            <div class="flex-between divider-bottom">
              <strong class="label" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 8px;">${base.title}</strong>
              <span class="card-status ${base.superTitleColor}">${base.superTitle}</span>
            </div>
            <div class="flex-between flex-wrap text-sm">
              <span title="Views" class="tooltip-trigger flex-row gap-sm" data-tooltip="Views vs ${contextAvg}"><span class="material-symbols-outlined blue">visibility</span> ${StatsCalc.formatNum(stats.views)} ${delta(stats.views, avg.viewsPerVid)}</span>
              <span title="Likes" class="tooltip-trigger flex-row gap-sm" data-tooltip="Likes vs ${contextAvg}"><span class="material-symbols-outlined green">thumb_up</span> ${StatsCalc.formatNum(stats.likes)} ${delta(stats.likes, avg.likesPerVid)}</span>
              <span title="Comments" class="tooltip-trigger flex-row gap-sm" data-tooltip="Comments vs ${contextAvg}"><span class="material-symbols-outlined orange">chat_bubble</span> ${StatsCalc.formatNum(stats.comments)} ${delta(stats.comments, avg.commentsPerVid)}</span>
              <span title="Duration" class="tooltip-trigger flex-row gap-sm" data-tooltip="Duration vs ${contextAvg}"><span class="material-symbols-outlined purple">schedule</span> ${StatsCalc.formatDur(stats.duration)} ${delta(stats.duration, avg.durPerVid, true)}</span>
            </div>
            <div class="flex-row flex-wrap gap-md text-sm text-muted divider-top-dashed">
              <span class="tooltip-trigger" data-tooltip="Age of Video"><strong>Age:</strong> ${StatsCalc.formatAge(adv.age)}</span>
              <span class="tooltip-trigger" data-tooltip="Views generated per day"><strong>Vel:</strong> <span class="blue">${adv.vel}/d</span></span>
              <span class="tooltip-trigger" data-tooltip="Trending Score"><strong>Heat:</strong> <span class="red">${adv.heat}</span></span>
              <span class="tooltip-trigger" data-tooltip="Hidden Gem Score"><strong>Gem:</strong> <span class="orange">${adv.gem}</span></span>
            </div>
            <div class="flex-between text-sm text-bold text-muted divider-top hover-color-blue" style="margin-bottom: 0;">
              ${ctaText} <span class="material-symbols-outlined hover-opacity" style="font-size: 18px;">play_circle</span>
            </div>
        </div>
      </a>
  </div>\n`;
    }
};