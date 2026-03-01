/* ══════════════════════════════════════════════════════════════
   game.js — TURBO TYPER client
══════════════════════════════════════════════════════════════ */
'use strict';

const socket = io();

// ── DOM shortcuts ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

// Screens
const screens = {
  landing: $('screen-landing'),
  lobby:   $('screen-lobby'),
  game:    $('screen-game'),
  gameover:$('screen-gameover'),
};

// Landing
const nickInput       = $('nick-input');
const btnCreate       = $('btn-create');
const btnJoin         = $('btn-join');
const roomCodeInput   = $('room-code-input');
const nickError       = $('nick-error');

// Lobby
const lobCode         = $('lob-code');
const lobCount        = $('lob-count');
const lobPlayerList   = $('lob-player-list');
const lobCountdown    = $('lob-countdown');
const lobCountdownNum = $('lob-countdown-num');
const lobWaiting      = $('lob-waiting');
const btnCopyCode     = $('btn-copy-code');
const hostSettings    = $('host-settings');
const guestSettings   = $('guest-settings');
const guestSettingsDisp = $('guest-settings-display');
const btnForceStart   = $('btn-force-start');
const modeExplain     = $('mode-explain');
const modeExplainText = $('mode-explain-text');
const chatMessages    = $('chat-messages');
const chatInput       = $('chat-input');
const btnChatSend     = $('btn-chat-send');

// Game
const gRound          = $('g-round');
const gTotal          = $('g-total');
const gTimerEl        = $('g-timer');
const modeTag         = $('mode-tag');
const teamsBar        = $('teams-bar');
const teamRedScore    = $('team-red-score');
const teamBlueScore   = $('team-blue-score');
const progressWrap    = $('g-progress');
const phraseBox       = $('phrase-display');
const wpmDisplay      = $('wpm-display');
const accDisplay      = $('acc-display');
const charDisplay     = $('char-display');
const typingInput     = $('typing-input');
const sdMsg           = $('sudden-death-msg');
const breakOverlay    = $('break-overlay');
const breakNum        = $('break-num');
const breakLb         = $('break-lb');
const gLeaderboard    = $('g-leaderboard');
const gChatMessages   = $('g-chat-messages');
const gChatInput      = $('g-chat-input');
const gBtnChatSend    = $('g-btn-chat-send');

// Gameover
const goFinalLb       = $('go-final-lb');
const goTeamResult    = $('go-team-result');
const goAchievements  = $('go-achievements');
const goAchList       = $('go-ach-list');
const btnRematch      = $('btn-rematch');
const btnNewRoom      = $('btn-new-room');
const rematchStatus   = $('rematch-status');

// ── Client state ──────────────────────────────────────────────
let myNickname    = '';
let isHost        = false;
let roomCode      = '';
let currentPhrase = '';
let roundStartTime = null;
let hasSubmitted  = false;
let gameMode      = 'standard';
let timedDuration = 60;
let timedRemaining = 60;
let roundTimerInterval = null;

// ── Screens ───────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  // Scroll top on mobile
  window.scrollTo(0, 0);
}

// ── Landing ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Profile.render();

  // Check URL for room code
  const pathCode = window.location.pathname.replace('/', '').trim().toUpperCase();
  if (pathCode.length === 5) roomCodeInput.value = pathCode;

  // Pre-fill last nickname
  const savedProfile = Profile.load();
  if (savedProfile.nickname) nickInput.value = savedProfile.nickname;
});

btnCreate.addEventListener('click', () => {
  const nick = getNick();
  if (!nick) return;
  socket.emit('create_room', { nickname: nick });
});

btnJoin.addEventListener('click', doJoin);
roomCodeInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });
nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });

function doJoin() {
  const nick = getNick();
  if (!nick) return;
  const code = roomCodeInput.value.trim().toUpperCase();
  if (!code || code.length !== 5) { nickError.textContent = 'Enter a 5-character room code.'; return; }
  socket.emit('join_room', { roomCode: code, nickname: nick });
}

function getNick() {
  const nick = nickInput.value.trim().slice(0, 20);
  if (!nick) { nickError.textContent = 'Enter a nickname first.'; return null; }
  nickError.textContent = '';
  return nick;
}

// ── Lobby setup ───────────────────────────────────────────────
function setupLobby(state, amHost) {
  myNickname = nickInput.value.trim().slice(0, 20);
  isHost     = amHost;
  roomCode   = state.code;

  lobCode.textContent = roomCode;
  window.history.replaceState({}, '', `/${roomCode}`);

  renderPlayerList(state.players);
  renderChatHistory(state.chat || []);
  updateSettings(state.settings);
  syncLobbyPhase(state);

  hostSettings.classList.toggle('hidden', !isHost);
  guestSettings.classList.toggle('hidden', isHost);

  showScreen('lobby');
}

function syncLobbyPhase(state) {
  if (state.phase === 'countdown') {
    lobCountdown.classList.remove('hidden');
    lobCountdownNum.textContent = state.countdownValue;
    lobWaiting.classList.add('hidden');
  } else if (state.phase === 'lobby') {
    const enough = state.players.length >= state.minPlayers;
    lobCountdown.classList.toggle('hidden', !enough);
    lobWaiting.classList.toggle('hidden', enough || state.isSinglePlayer);
    if (enough) lobCountdownNum.textContent = state.countdownValue;
  }
}

// ── Room code copy ────────────────────────────────────────────
btnCopyCode.addEventListener('click', () => {
  const url = `${location.origin}/${roomCode}`;
  navigator.clipboard.writeText(url).then(() => {
    btnCopyCode.textContent = '✓';
    setTimeout(() => btnCopyCode.textContent = '⎘', 1500);
  });
});

// ── Host controls ─────────────────────────────────────────────
function setupSegControl(id, key) {
  const ctrl = $(id);
  if (!ctrl) return;
  ctrl.querySelectorAll('.seg').forEach(btn => {
    btn.addEventListener('click', () => {
      ctrl.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const settings = { [key]: btn.dataset.val };
      socket.emit('host_settings', settings);
      if (key === 'mode') handleModeChange(btn.dataset.val);
    });
  });
}
setupSegControl('seg-rounds', 'totalRounds');
setupSegControl('seg-diff',   'difficulty');
setupSegControl('seg-mode',   'mode');
setupSegControl('seg-pack',   'phrasePack');
setupSegControl('seg-timed',  'timedDuration');

function handleModeChange(mode) {
  const timedRow = $('row-timed-dur');
  if (timedRow) timedRow.style.display = mode === 'timed' ? 'flex' : 'none';
  updateModeExplain(mode);
}

const MODE_DESCRIPTIONS = {
  standard:    '🏁 Classic race — type the phrase as fast and accurately as possible.',
  timed:       '⏱ Timed sprint — type as many words as you can before the clock hits zero.',
  sudden_death:'💀 Sudden Death — make a mistake and you must delete back to the error before continuing.',
  teams:       '🤝 Teams — players are split into Red and Blue. Combined team WPM determines the winner.',
};

function updateModeExplain(mode) {
  if (MODE_DESCRIPTIONS[mode]) {
    modeExplainText.textContent = MODE_DESCRIPTIONS[mode];
    modeExplain.classList.remove('hidden');
  }
}

btnForceStart.addEventListener('click', () => socket.emit('host_start'));

function updateSettings(settings) {
  if (!settings) return;
  // Update segmented controls for host
  syncSeg('seg-rounds', String(settings.totalRounds));
  syncSeg('seg-diff',   settings.difficulty);
  syncSeg('seg-mode',   settings.mode);
  syncSeg('seg-pack',   settings.phrasePack);
  syncSeg('seg-timed',  String(settings.timedDuration));

  const timedRow = $('row-timed-dur');
  if (timedRow) timedRow.style.display = settings.mode === 'timed' ? 'flex' : 'none';
  updateModeExplain(settings.mode);

  // Guest display
  if (guestSettingsDisp) {
    guestSettingsDisp.innerHTML = [
      ['MODE',       settings.mode?.toUpperCase().replace('_',' ')],
      ['DIFFICULTY', settings.difficulty?.toUpperCase()],
      ['ROUNDS',     settings.totalRounds],
      ['PHRASES',    settings.phrasePack?.toUpperCase()],
    ].map(([k,v]) => `<div class="sd-item"><span class="sd-key">${k}</span><span class="sd-val">${v}</span></div>`).join('');
  }
}

function syncSeg(id, val) {
  const ctrl = $(id);
  if (!ctrl) return;
  ctrl.querySelectorAll('.seg').forEach(b => b.classList.toggle('active', b.dataset.val === val));
}

// ── Player list ───────────────────────────────────────────────
function renderPlayerList(players) {
  lobPlayerList.innerHTML = '';
  lobCount.textContent = `(${players.length})`;
  players.forEach(p => {
    const li = document.createElement('li');
    const teamClass = p.team ? `team-${p.team}` : '';
    li.className = `${p.isHost ? 'is-host' : ''} ${teamClass}`;
    li.innerHTML = `
      <span>${esc(p.nickname)}${p.isHost ? ' <span class="pl-badge">HOST</span>' : ''}${p.team ? ` <span style="color:var(--${p.team}-team)">▌</span>` : ''}</span>
      <span class="pl-score">${p.totalScore}pts</span>`;

    // Host kick button
    if (isHost && p.nickname !== myNickname) {
      const kick = document.createElement('button');
      kick.textContent = '✕';
      kick.className = 'btn-secondary btn-sm';
      kick.style.cssText = 'padding:.1rem .4rem;font-size:.6rem;margin-left:.5rem';
      kick.addEventListener('click', () => socket.emit('host_kick', { nickname: p.nickname }));
      li.appendChild(kick);
    }
    lobPlayerList.appendChild(li);
  });
}

// ── Chat ──────────────────────────────────────────────────────
function sendChat(inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;
  socket.emit('chat', { text });
  inputEl.value = '';
}
btnChatSend.addEventListener('click',   () => sendChat(chatInput));
chatInput.addEventListener('keydown',   e => { if (e.key === 'Enter') sendChat(chatInput); });
gBtnChatSend.addEventListener('click',  () => sendChat(gChatInput));
gChatInput.addEventListener('keydown',  e => { if (e.key === 'Enter') sendChat(gChatInput); });

function appendChat(msg, el) {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="chat-nick">${esc(msg.nickname)}:</span> <span class="chat-text">${esc(msg.text)}</span>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  // Keep max 80 messages in DOM
  while (el.children.length > 80) el.removeChild(el.firstChild);
}

function renderChatHistory(msgs) {
  chatMessages.innerHTML = '';
  msgs.forEach(m => appendChat(m, chatMessages));
}

// ── Phrase rendering ──────────────────────────────────────────
function renderPhrase(phrase, typed = '', sudden = false) {
  phraseBox.innerHTML = '';
  for (let i = 0; i < phrase.length; i++) {
    const span = document.createElement('span');
    span.className = 'ch';
    span.textContent = phrase[i] === ' ' ? '\u00a0' : phrase[i];
    if (i < typed.length) {
      span.classList.add(typed[i] === phrase[i] ? 'correct' : 'wrong');
    } else if (i === typed.length) {
      span.classList.add('caret');
    }
    phraseBox.appendChild(span);
  }
}

// ── Live stats ────────────────────────────────────────────────
function updateLiveStats(typed) {
  const elapsed = roundStartTime ? (Date.now() - roundStartTime) / 1000 : 0;
  const wpm = elapsed > 0.5 ? Math.round((typed.length / 5) / (elapsed / 60)) : 0;
  wpmDisplay.textContent = `${wpm} WPM`;

  let correct = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] === currentPhrase[i]) correct++;
  }
  const acc = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;
  accDisplay.textContent = `${acc}%`;
  charDisplay.textContent = `${typed.length}/${currentPhrase.length}`;
}

// ── Progress bars ─────────────────────────────────────────────
function ensureProgressBar(nickname, team) {
  const sid = sanitize(nickname);
  if ($(`pb-${sid}`)) return;
  const row = document.createElement('div');
  row.className = 'pb-row'; row.id = `pb-${sid}`;
  const fillClass = team ? `pb-fill team-${team}` : 'pb-fill';
  row.innerHTML = `
    <span class="pb-name">${esc(nickname)}</span>
    <div class="pb-track"><div class="${fillClass}" id="pbf-${sid}"></div></div>
    <span class="pb-pct" id="pbp-${sid}">0%</span>
    <span class="pb-done" id="pbd-${sid}"></span>`;
  progressWrap.appendChild(row);
}

function setProgress(nickname, pct, done = false) {
  const sid = sanitize(nickname);
  const fill = $(`pbf-${sid}`);
  const pctEl = $(`pbp-${sid}`);
  const doneEl = $(`pbd-${sid}`);
  if (fill) fill.style.width = `${pct}%`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (doneEl) doneEl.textContent = done ? '✓' : '';
}

// ── Leaderboard renderers ─────────────────────────────────────
function renderSideLeaderboard(lb) {
  gLeaderboard.innerHTML = '';
  lb.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = `sl-row rank-${i+1}`;
    div.innerHTML = `
      <div class="sl-name">${esc(p.nickname)}</div>
      <div class="sl-stats">
        <span class="sl-pts">${p.totalScore}pts</span>
        <span class="sl-wpm">${p.wpm}wpm</span>
      </div>`;
    gLeaderboard.appendChild(div);
  });
}

function renderBreakLeaderboard(lb) {
  breakLb.innerHTML = `<div class="card-label" style="margin-bottom:.5rem">ROUND RESULTS</div>`;
  lb.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'blb-row';
    row.innerHTML = `
      <span class="blb-rank">#${i+1}</span>
      <span class="blb-name">${esc(p.nickname)}</span>
      <span class="blb-pts">+${p.roundScore}</span>
      <span class="blb-total">TOTAL ${p.totalScore}</span>`;
    breakLb.appendChild(row);
  });
}

function renderFinalLeaderboard(lb) {
  goFinalLb.innerHTML = '';
  lb.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = `go-lb-row${i === 0 ? ' go-first' : ''}`;
    const medals = ['🥇','🥈','🥉'];
    row.innerHTML = `
      <span class="go-rank">${i < 3 ? medals[i] : i+1}</span>
      <span class="go-name">${esc(p.nickname)}</span>
      <div class="go-score-wrap">
        <div class="go-score">${p.totalScore}</div>
        <div class="go-score-lbl">POINTS · ${p.wpm}WPM</div>
      </div>`;
    goFinalLb.appendChild(row);
  });
}

// ── Round timer display ───────────────────────────────────────
function startRoundClock() {
  clearInterval(roundTimerInterval);
  roundTimerInterval = setInterval(() => {
    if (!roundStartTime) return;
    gTimerEl.textContent = Math.floor((Date.now() - roundStartTime) / 1000);
  }, 500);
}
function stopRoundClock() {
  clearInterval(roundTimerInterval);
  roundTimerInterval = null;
}

// ── Typing input ──────────────────────────────────────────────
typingInput.addEventListener('input', () => {
  if (!currentPhrase || hasSubmitted) return;
  const typed = typingInput.value;

  // Sudden death: if most recent char is wrong, delete it
  if (gameMode === 'sudden_death') {
    const last = typed.length - 1;
    if (last >= 0 && typed[last] !== currentPhrase[last]) {
      phraseBox.classList.add('shake');
      setTimeout(() => phraseBox.classList.remove('shake'), 300);
      typingInput.value = typed.slice(0, -1);
      playSound('wrong');
      return;
    }
  }

  renderPhrase(currentPhrase, typed, gameMode === 'sudden_death');
  updateLiveStats(typed);
  socket.emit('progress', { typed });

  // Auto-submit when phrase complete (not timed mode)
  if (gameMode !== 'timed' && typed.length >= currentPhrase.length) {
    submitResult(typed);
  }
});

// Timed mode: submit on each phrase completion, reset for next phrase
let timedWordsBuffer = '';
typingInput.addEventListener('keydown', e => {
  if (gameMode !== 'timed') return;
  // Space after last word triggers word count
});

function submitResult(typed) {
  if (hasSubmitted) return;
  hasSubmitted = true;
  typingInput.disabled = true;
  socket.emit('submit_result', { typed });
  playSound('finish');
  // Confetti for self
  Confetti.burst(window.innerWidth / 2, window.innerHeight * .4, 50);
}

// ── Audio ─────────────────────────────────────────────────────
let _actx = null;
function getActx() { return _actx || (_actx = new (window.AudioContext || window.webkitAudioContext)()); }

function playSound(type) {
  try {
    const ctx = getActx();
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime;
    switch (type) {
      case 'start':
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(660, t+.08);
        osc.frequency.setValueAtTime(880, t+.16);
        g.gain.setValueAtTime(.18, t);
        g.gain.exponentialRampToValueAtTime(.001, t+.35);
        osc.start(t); osc.stop(t+.35); break;
      case 'finish':
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1100, t+.1);
        g.gain.setValueAtTime(.15, t);
        g.gain.exponentialRampToValueAtTime(.001, t+.3);
        osc.start(t); osc.stop(t+.3); break;
      case 'wrong':
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, t);
        g.gain.setValueAtTime(.08, t);
        g.gain.exponentialRampToValueAtTime(.001, t+.1);
        osc.start(t); osc.stop(t+.1); break;
      case 'end':
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.setValueAtTime(440, t+.15);
        g.gain.setValueAtTime(.15, t);
        g.gain.exponentialRampToValueAtTime(.001, t+.4);
        osc.start(t); osc.stop(t+.4); break;
      case 'gameover':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, t);
        osc.frequency.exponentialRampToValueAtTime(70, t+.6);
        g.gain.setValueAtTime(.2, t);
        g.gain.exponentialRampToValueAtTime(.001, t+.7);
        osc.start(t); osc.stop(t+.7); break;
    }
  } catch {}
}

// ── Rematch / New room ────────────────────────────────────────
btnRematch.addEventListener('click', () => {
  socket.emit('rematch_vote');
  btnRematch.disabled = true;
  btnRematch.textContent = 'VOTED ✓';
});

btnNewRoom.addEventListener('click', () => window.location.reload());

// ══════════════════════════════════════════════════════════════
// SOCKET EVENTS
// ══════════════════════════════════════════════════════════════

socket.on('room_created', state => {
  myNickname = nickInput.value.trim().slice(0, 20);
  setupLobby(state, true);
  updateModeExplain(state.settings.mode);
});

socket.on('room_joined', state => {
  myNickname = nickInput.value.trim().slice(0, 20);
  setupLobby(state, state.hostId === socket.id);
  syncLobbyPhase(state);
});

socket.on('join_error', ({ msg }) => {
  nickError.textContent = msg;
});

socket.on('player_joined', ({ nickname, players }) => {
  renderPlayerList(players);
});

socket.on('player_left', ({ nickname, players }) => {
  renderPlayerList(players);
  const row = $(`pb-${sanitize(nickname)}`);
  if (row) row.remove();
});

socket.on('you_are_host', () => {
  isHost = true;
  hostSettings.classList.remove('hidden');
  guestSettings.classList.add('hidden');
});

socket.on('host_changed', ({ nickname }) => {
  // Update host badge in list
});

socket.on('settings_updated', ({ settings }) => {
  updateSettings(settings);
  gameMode = settings.mode;
  timedDuration = settings.timedDuration;
});

socket.on('countdown_start', ({ value }) => {
  lobCountdown.classList.remove('hidden');
  lobWaiting.classList.add('hidden');
  lobCountdownNum.textContent = value;
});

socket.on('countdown_tick', ({ value }) => {
  lobCountdownNum.textContent = value;
  if (value <= 3) playSound('start');
});

socket.on('waiting_for_players', () => {
  lobCountdown.classList.add('hidden');
  lobWaiting.classList.remove('hidden');
});

socket.on('round_start', ({ round, totalRounds, phrase, mode, timedDuration: td }) => {
  currentPhrase   = phrase;
  gameMode        = mode;
  timedDuration   = td || 60;
  timedRemaining  = timedDuration;
  hasSubmitted    = false;
  roundStartTime  = Date.now();

  gRound.textContent = round;
  gTotal.textContent = totalRounds;
  modeTag.textContent = mode.replace('_',' ').toUpperCase();

  progressWrap.innerHTML = '';
  breakOverlay.classList.add('hidden');
  sdMsg.classList.toggle('hidden', mode !== 'sudden_death');
  teamsBar.classList.toggle('hidden', mode !== 'teams');

  const timerLabel = $('g-timer-label');
  if (mode === 'timed') {
    timerLabel.textContent = '⏱ ';
    gTimerEl.textContent   = timedDuration;
  } else {
    gTimerEl.textContent = '0';
  }

  renderPhrase(phrase);
  wpmDisplay.textContent = '0 WPM';
  accDisplay.textContent = '100%';
  charDisplay.textContent = `0/${phrase.length}`;

  typingInput.value    = '';
  typingInput.disabled = false;
  typingInput.focus();

  showScreen('game');
  startRoundClock();
  playSound('start');
});

socket.on('timed_tick', ({ value }) => {
  timedRemaining = value;
  gTimerEl.textContent = value;
  // In timed mode, submit live progress every tick
  if (gameMode === 'timed' && !hasSubmitted) {
    socket.emit('submit_result', { typed: typingInput.value });
    // Don't mark hasSubmitted — timed mode collects ongoing
    hasSubmitted = false; // keep live
  }
});

socket.on('player_progress', ({ nickname, progress, team }) => {
  ensureProgressBar(nickname, team);
  setProgress(nickname, progress);
});

socket.on('player_finished', ({ nickname, wpm, accuracy, team }) => {
  ensureProgressBar(nickname, team);
  setProgress(nickname, 100, true);
  playSound('finish');
});

socket.on('round_end', ({ leaderboard }) => {
  stopRoundClock();
  renderSideLeaderboard(leaderboard);
  renderBreakLeaderboard(leaderboard);
  typingInput.disabled = true;
  playSound('end');
});

socket.on('break_start', ({ value }) => {
  breakNum.textContent = value;
  breakOverlay.classList.remove('hidden');
});

socket.on('break_tick', ({ value }) => {
  breakNum.textContent = value;
});

socket.on('chat_message', msg => {
  appendChat(msg, chatMessages);
  appendChat(msg, gChatMessages);
});

socket.on('game_over', ({ leaderboard, teamScores, mode }) => {
  stopRoundClock();
  typingInput.disabled = true;
  breakOverlay.classList.add('hidden');

  renderFinalLeaderboard(leaderboard);

  // Teams result
  if (mode === 'teams' && teamScores) {
    const winner = teamScores.red > teamScores.blue ? '🔴 RED WINS' : teamScores.blue > teamScores.red ? '🔵 BLUE WINS' : '🤝 TIE';
    goTeamResult.textContent = winner;
    goTeamResult.classList.remove('hidden');
  } else {
    goTeamResult.classList.add('hidden');
  }

  // Record profile stats
  const myEntry = leaderboard.find(p => p.nickname === myNickname);
  if (myEntry) {
    const { newAchs } = Profile.record({
      nickname:    myNickname,
      leaderboard,
      myWpm:       myEntry.wpm,
      myAccuracy:  myEntry.accuracy,
      mode,
    });
    if (newAchs.length) {
      goAchievements.classList.remove('hidden');
      goAchList.innerHTML = '';
      newAchs.forEach(id => {
        const ach = Profile.ACHIEVEMENTS.find(a => a.id === id);
        if (!ach) return;
        const el = document.createElement('div');
        el.className = 'go-ach-item';
        el.textContent = ach.label;
        goAchList.appendChild(el);
      });
    } else {
      goAchievements.classList.add('hidden');
    }
  }

  btnRematch.disabled   = false;
  btnRematch.textContent = 'VOTE REMATCH';
  rematchStatus.textContent = '';

  showScreen('gameover');
  Confetti.celebration();
  playSound('gameover');
});

socket.on('rematch_vote', ({ votes, total, nickname }) => {
  rematchStatus.textContent = `${nickname} voted to rematch · ${votes}/${total}`;
});

socket.on('rematch_start', state => {
  goTeamResult.classList.add('hidden');
  goAchievements.classList.add('hidden');
  progressWrap.innerHTML = '';
  setupLobby(state, isHost);
  updateSettings(state.settings);
});

socket.on('kicked', () => {
  alert('You were kicked from the room.');
  window.location.reload();
});

// ── Utils ─────────────────────────────────────────────────────
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function sanitize(str) {
  return String(str).replace(/[^a-zA-Z0-9]/g, '_');
}
