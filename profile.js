/* ══════════════════════════════════════════════════════════════
   profile.js — localStorage profile, stats & achievements
══════════════════════════════════════════════════════════════ */

const ACHIEVEMENTS = [
  { id:'speed_demon',    label:'⚡ Speed Demon',    desc:'Achieve 80+ WPM in a round',           check: s => s.maxWpm >= 80    },
  { id:'perfectionist',  label:'🎯 Perfectionist',  desc:'Finish a round with 100% accuracy',     check: s => s.perfect >= 1    },
  { id:'podium',         label:'🏆 Podium',         desc:'Finish in the top 3',                   check: s => s.podiums >= 1    },
  { id:'champion',       label:'👑 Champion',       desc:'Win a race',                            check: s => s.wins >= 1       },
  { id:'marathoner',     label:'🏃 Marathoner',     desc:'Complete 10 races',                     check: s => s.races >= 10     },
  { id:'century',        label:'💯 Century Club',   desc:'Score 100+ WPM',                        check: s => s.maxWpm >= 100   },
  { id:'consistent',     label:'📈 Consistent',     desc:'Average 60+ WPM over 5 races',          check: s => s.avgWpm >= 60    },
  { id:'survivor',       label:'💀 Survivor',       desc:'Complete a Sudden Death round',         check: s => s.suddenDeathRounds >= 1 },
  { id:'team_player',    label:'🤝 Team Player',    desc:'Win a Teams match',                     check: s => s.teamWins >= 1   },
  { id:'hat_trick',      label:'🎩 Hat Trick',      desc:'Win 3 races in a row',                  check: s => s.winStreak >= 3  },
];

const PROFILE_KEY = 'typerace_profile_v2';

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return createProfile();
}

function createProfile() {
  return {
    nickname:           '',
    races:              0,
    wins:               0,
    podiums:            0,
    totalWpm:           0,
    maxWpm:             0,
    avgWpm:             0,
    perfect:            0,          // 100% accuracy rounds
    suddenDeathRounds:  0,
    teamWins:           0,
    winStreak:          0,
    currentStreak:      0,
    unlockedAchievements: [],
    wpmHistory:         [],         // last 20 WPMs
  };
}

function saveProfile(profile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
}

// Returns newly unlocked achievement ids
function checkAchievements(profile) {
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(a => {
    if (!profile.unlockedAchievements.includes(a.id) && a.check(profile)) {
      profile.unlockedAchievements.push(a.id);
      newlyUnlocked.push(a.id);
    }
  });
  return newlyUnlocked;
}

// Called after a race with final leaderboard
function recordRaceResult({ nickname, leaderboard, myWpm, myAccuracy, mode }) {
  const profile = loadProfile();
  profile.nickname = nickname;

  const myEntry = leaderboard.find(p => p.nickname === nickname);
  const rank    = leaderboard.findIndex(p => p.nickname === nickname) + 1;

  profile.races++;
  if (myWpm > 0) {
    profile.wpmHistory.push(myWpm);
    if (profile.wpmHistory.length > 20) profile.wpmHistory.shift();
    profile.totalWpm += myWpm;
    profile.avgWpm    = Math.round(profile.totalWpm / profile.races);
    profile.maxWpm    = Math.max(profile.maxWpm, myWpm);
  }
  if (myAccuracy === 100) profile.perfect++;
  if (rank <= 3)          profile.podiums++;
  if (rank === 1) {
    profile.wins++;
    profile.currentStreak++;
    profile.winStreak = Math.max(profile.winStreak, profile.currentStreak);
  } else {
    profile.currentStreak = 0;
  }
  if (mode === 'sudden_death') profile.suddenDeathRounds++;

  const newAchs = checkAchievements(profile);
  saveProfile(profile);
  return { profile, newAchs };
}

function renderProfileStrip() {
  const profile = loadProfile();
  if (!profile.races) return;

  const strip = document.getElementById('profile-strip');
  const stats  = document.getElementById('profile-stats');
  const achRow = document.getElementById('achievement-row');
  if (!strip || !stats || !achRow) return;

  strip.classList.remove('hidden');

  stats.innerHTML = `
    <div class="p-stat"><div class="p-stat-val">${profile.races}</div><div class="p-stat-lbl">RACES</div></div>
    <div class="p-stat"><div class="p-stat-val">${profile.wins}</div><div class="p-stat-lbl">WINS</div></div>
    <div class="p-stat"><div class="p-stat-val">${profile.maxWpm}</div><div class="p-stat-lbl">BEST WPM</div></div>
    <div class="p-stat"><div class="p-stat-val">${profile.avgWpm}</div><div class="p-stat-lbl">AVG WPM</div></div>
  `;

  // Sparkline
  if (profile.wpmHistory.length > 1) {
    const sparkSvg = buildSparkline(profile.wpmHistory, 100, 28);
    stats.innerHTML += `<div class="p-stat" style="flex:1;min-width:100px"><div style="padding-top:4px">${sparkSvg}</div><div class="p-stat-lbl">WPM HISTORY</div></div>`;
  }

  achRow.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const unlocked = profile.unlockedAchievements.includes(a.id);
    const div = document.createElement('div');
    div.className = `ach-badge${unlocked ? '' : ' locked'}`;
    div.title     = a.desc;
    div.textContent = a.label;
    achRow.appendChild(div);
  });
}

function buildSparkline(data, w = 100, h = 28) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${points}" stroke="#f7e142" stroke-width="1.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${points.split(' ').at(-1).split(',')[0]}" cy="${points.split(' ').at(-1).split(',')[1]}" r="2.5" fill="#f7e142"/>
  </svg>`;
}

// Expose globally
window.Profile = { load: loadProfile, save: saveProfile, record: recordRaceResult, render: renderProfileStrip, ACHIEVEMENTS };
