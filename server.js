'use strict';

const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const path      = require('path');
const { v4: uuidv4 } = require('uuid');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Catch-all: serve index for any unknown path (room code URLs)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULTS = {
  MIN_PLAYERS:        2,
  TOTAL_ROUNDS:       5,
  PRE_GAME_COUNTDOWN: 15,
  BREAK_DURATION:     20,
  ROUND_TIMEOUT:      90,
  TIMED_DURATION:     60,   // seconds for timed mode
};

// ─── Phrase Packs ─────────────────────────────────────────────────────────────
const PHRASE_PACKS = {
  classic: {
    label: 'Classic',
    easy: [
      "The cat sat on the mat and looked at the hat",
      "Dogs like to run and play in the park every day",
      "She sells sea shells by the sea shore near the waves",
      "A big red bus drove past the old brick school",
      "The sun is bright and the sky is very blue today",
    ],
    medium: [
      "The quick brown fox jumps over the lazy dog near the river",
      "Typing speed is a skill that improves with consistent daily practice",
      "A journey of a thousand miles begins with a single step forward",
      "The best way to predict the future is to invent it yourself",
      "Success is not final and failure is not fatal it is the courage to continue",
      "In the middle of every difficulty lies opportunity waiting to be discovered",
    ],
    hard: [
      "Programming is the art of telling another human what one wants the computer to do",
      "Simplicity is the ultimate sophistication in both design and code architecture",
      "The internet is becoming the town square for the global village of tomorrow morning",
      "Software architecture requires balancing technical constraints with business requirements efficiently",
      "Extraordinary claims require extraordinary evidence before they can be accepted as scientific fact",
    ],
  },
  animals: {
    label: 'Animals',
    easy: [
      "The lazy lion slept under the warm afternoon sun all day long",
      "Penguins waddle across the ice and slide on their round bellies",
      "A fluffy rabbit hopped through the green garden eating fresh carrots",
      "The tiny kitten chased a ball of yarn around the living room",
      "Baby ducks followed their mother across the pond in a neat line",
    ],
    medium: [
      "Elephants are the largest land animals and they never forget a face",
      "The hummingbird beats its wings over fifty times every single second it flies",
      "Dolphins communicate with each other using a series of clicks and whistles",
      "A pride of lions rested lazily under the shade of the acacia tree",
      "Wolves howl at the moon to communicate with the rest of their pack",
    ],
    hard: [
      "The migratory patterns of monarch butterflies span thousands of kilometers across the continent",
      "Octopuses possess three hearts two gill hearts and one systemic heart that pumps blue blood",
      "Cheetahs can accelerate from zero to over one hundred kilometers per hour in just three seconds",
      "The archerfish knocks insects off branches by shooting precise jets of water from below the surface",
    ],
  },
  science: {
    label: 'Science',
    easy: [
      "Water is made of two hydrogen atoms and one oxygen atom bonded together",
      "Plants use sunlight water and carbon dioxide to make their own food",
      "The Earth orbits the Sun once every three hundred sixty five days approximately",
      "Sound travels through air as invisible waves of pressure moving outward",
    ],
    medium: [
      "Gravity is the force that attracts objects with mass toward one another across space",
      "The speed of light in a vacuum is approximately three hundred thousand kilometers per second",
      "DNA carries the genetic instructions for the development and function of all living organisms",
      "Photosynthesis converts light energy into chemical energy stored in glucose molecules within plant cells",
      "Atoms are the basic building blocks of matter and consist of protons neutrons and electrons",
    ],
    hard: [
      "Quantum entanglement allows particles to instantaneously influence each other regardless of the distance separating them",
      "The second law of thermodynamics states that entropy in an isolated system always increases over time",
      "Tectonic plates move at roughly the same rate as human fingernails grow each year across the surface",
      "Bioluminescence occurs when living organisms produce and emit light through chemical reactions within their cells",
    ],
  },
  movies: {
    label: 'Movie Quotes',
    easy: [
      "To infinity and beyond is what Buzz Lightyear always says with enthusiasm",
      "Just keep swimming just keep swimming that is what Dory always says",
      "May the force be with you is a classic line from Star Wars",
      "There is no place like home is what Dorothy says in the Wizard of Oz",
    ],
    medium: [
      "Life is like a box of chocolates you never know what you are gonna get",
      "With great power comes great responsibility as Uncle Ben told a young Peter Parker",
      "Why so serious said the Joker to Batman with a wide and wicked grin",
      "To boldly go where no man has gone before was the mission of the Enterprise",
    ],
    hard: [
      "Elementary my dear Watson is a phrase popularly attributed to Sherlock Holmes though he never quite said it",
      "You cannot handle the truth was shouted by Colonel Jessup during the dramatic courtroom scene in the film",
      "I am going to make him an offer he cannot refuse is the most memorable line from The Godfather",
    ],
  },
};

// ─── Room Management ──────────────────────────────────────────────────────────
const rooms = new Map(); // roomCode → roomState

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createRoom(hostSocketId) {
  let code;
  do { code = generateRoomCode(); } while (rooms.has(code));

  const room = {
    code,
    hostId: hostSocketId,
    phase: 'lobby',          // lobby|countdown|round|break|gameover
    players: {},             // socketId → player obj
    settings: {
      totalRounds:  DEFAULTS.TOTAL_ROUNDS,
      difficulty:   'medium',
      mode:         'standard',  // standard|timed|sudden_death|teams
      phrasePack:   'classic',
      timedDuration: DEFAULTS.TIMED_DURATION,
    },
    teams: { red: [], blue: [] },
    teamScores: { red: 0, blue: 0 },
    currentRound:   0,
    currentPhrase:  '',
    roundStartTime: null,
    countdownValue: DEFAULTS.PRE_GAME_COUNTDOWN,
    breakValue:     DEFAULTS.BREAK_DURATION,
    timedValue:     DEFAULTS.TIMED_DURATION,
    countdownTimer: null,
    breakTimer:     null,
    roundTimer:     null,
    timedTimer:     null,
    chat:           [],      // recent chat messages
    rematchVotes:   new Set(),
    usedPhrases:    new Set(),
  };
  rooms.set(code, room);
  return room;
}

function deleteRoom(code) {
  const room = rooms.get(code);
  if (room) {
    clearRoomTimers(room);
    rooms.delete(code);
  }
}

function clearRoomTimers(room) {
  clearInterval(room.countdownTimer);
  clearInterval(room.breakTimer);
  clearTimeout(room.roundTimer);
  clearInterval(room.timedTimer);
  room.countdownTimer = null;
  room.breakTimer     = null;
  room.roundTimer     = null;
  room.timedTimer     = null;
}

function roomHasPlayers(room) {
  return Object.keys(room.players).length > 0;
}

function getRoomPlayerCount(room) {
  return Object.keys(room.players).length;
}

function isSinglePlayer(room) {
  return getRoomPlayerCount(room) === 1;
}

// ─── Player Factory ────────────────────────────────────────────────────────────
function makePlayer(nickname, team = null) {
  return {
    nickname,
    team,            // 'red'|'blue'|null
    totalScore: 0,
    roundScore: 0,
    finished:   false,
    finishTime: null,
    correct:    0,
    accuracy:   0,
    wpm:        0,
    timedWords: 0,
    timedChars: 0,
  };
}

// ─── Phrase Selection ─────────────────────────────────────────────────────────
function getPhrase(room) {
  const pack  = PHRASE_PACKS[room.settings.phrasePack] || PHRASE_PACKS.classic;
  const diff  = room.settings.difficulty;
  const pool  = pack[diff] || pack.medium;
  const avail = pool.filter(p => !room.usedPhrases.has(p));
  const list  = avail.length > 0 ? avail : pool; // recycle if exhausted
  const phrase = list[Math.floor(Math.random() * list.length)];
  room.usedPhrases.add(phrase);
  return phrase;
}

// ─── Score / Stats Calculations ───────────────────────────────────────────────
function calcPoints(timeSec, accuracy, phraseLen) {
  if (accuracy < 0.5) return 0;
  const wpm = Math.round((phraseLen / 5) / (timeSec / 60));
  return Math.max(0, Math.round(wpm * accuracy));
}

function calcWPM(chars, seconds) {
  if (seconds <= 0) return 0;
  return Math.round((chars / 5) / (seconds / 60));
}

// ─── Leaderboard Helpers ──────────────────────────────────────────────────────
function getLeaderboard(room) {
  return Object.values(room.players)
    .map(p => ({
      nickname:   p.nickname,
      team:       p.team,
      roundScore: p.roundScore,
      totalScore: p.totalScore,
      wpm:        p.wpm,
      accuracy:   Math.round(p.accuracy * 100),
      finished:   p.finished,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

function getLobbyData(room) {
  return Object.values(room.players).map(p => ({
    nickname:   p.nickname,
    team:       p.team,
    totalScore: p.totalScore,
    isHost:     room.hostId === getSocketIdByNickname(room, p.nickname),
  }));
}

function getSocketIdByNickname(room, nickname) {
  return Object.entries(room.players).find(([, p]) => p.nickname === nickname)?.[0];
}

function assignTeams(room) {
  const ids = Object.keys(room.players);
  room.teams = { red: [], blue: [] };
  ids.forEach((id, i) => {
    const t = i % 2 === 0 ? 'red' : 'blue';
    room.teams[t].push(id);
    room.players[id].team = t;
  });
  room.teamScores = { red: 0, blue: 0 };
}

// ─── Emit to Room ─────────────────────────────────────────────────────────────
function toRoom(room, event, data) {
  io.to(room.code).emit(event, data);
}

// ─── State Sync ───────────────────────────────────────────────────────────────
function buildStateSync(room) {
  return {
    code:           room.code,
    phase:          room.phase,
    players:        getLobbyData(room),
    leaderboard:    getLeaderboard(room),
    currentRound:   room.currentRound,
    totalRounds:    room.settings.totalRounds,
    phrase:         room.currentPhrase,
    countdownValue: room.countdownValue,
    breakValue:     room.breakValue,
    timedValue:     room.timedValue,
    settings:       room.settings,
    teams:          room.teams,
    teamScores:     room.teamScores,
    chat:           room.chat.slice(-30),
    minPlayers:     DEFAULTS.MIN_PLAYERS,
    isSinglePlayer: isSinglePlayer(room),
  };
}

// ─── Pre-game Countdown ───────────────────────────────────────────────────────
function startPreGameCountdown(room) {
  if (room.phase !== 'lobby') return;
  room.phase          = 'countdown';
  room.countdownValue = DEFAULTS.PRE_GAME_COUNTDOWN;
  toRoom(room, 'countdown_start', { value: room.countdownValue });

  room.countdownTimer = setInterval(() => {
    room.countdownValue--;
    toRoom(room, 'countdown_tick', { value: room.countdownValue });
    if (room.countdownValue <= 0) {
      clearInterval(room.countdownTimer);
      room.countdownTimer = null;
      const needed = isSinglePlayer(room) ? 1 : DEFAULTS.MIN_PLAYERS;
      if (getRoomPlayerCount(room) >= needed) {
        beginGame(room);
      } else {
        room.phase = 'lobby';
        toRoom(room, 'waiting_for_players', { needed: DEFAULTS.MIN_PLAYERS });
      }
    }
  }, 1000);
}

function beginGame(room) {
  room.currentRound = 0;
  room.usedPhrases  = new Set();
  // Reset all scores
  Object.values(room.players).forEach(p => { p.totalScore = 0; });
  if (room.settings.mode === 'teams') assignTeams(room);
  startRound(room);
}

// ─── Round ────────────────────────────────────────────────────────────────────
function startRound(room) {
  room.currentRound++;
  room.currentPhrase  = getPhrase(room);
  room.roundStartTime = Date.now();
  room.phase          = 'round';

  Object.values(room.players).forEach(p => {
    p.finished   = false;
    p.finishTime = null;
    p.roundScore = 0;
    p.correct    = 0;
    p.accuracy   = 0;
    p.wpm        = 0;
    p.timedWords = 0;
    p.timedChars = 0;
  });

  toRoom(room, 'round_start', {
    round:       room.currentRound,
    totalRounds: room.settings.totalRounds,
    phrase:      room.currentPhrase,
    mode:        room.settings.mode,
    timedDuration: room.settings.timedDuration,
  });

  if (room.settings.mode === 'timed') {
    // Timed mode: tick down, then auto-end
    room.timedValue = room.settings.timedDuration;
    room.timedTimer = setInterval(() => {
      room.timedValue--;
      toRoom(room, 'timed_tick', { value: room.timedValue });
      if (room.timedValue <= 0) {
        clearInterval(room.timedTimer);
        room.timedTimer = null;
        finishRound(room);
      }
    }, 1000);
  } else {
    // Auto-end after timeout
    room.roundTimer = setTimeout(() => finishRound(room), DEFAULTS.ROUND_TIMEOUT * 1000);
  }
}

// ─── Player submits typing ────────────────────────────────────────────────────
function handleSubmit(room, socketId, typed) {
  const player = room.players[socketId];
  if (!player || player.finished || room.phase !== 'round') return;

  const phrase    = room.currentPhrase;
  const timeSec   = (Date.now() - room.roundStartTime) / 1000;
  let correct = 0;

  if (room.settings.mode === 'timed') {
    // Timed mode: count words/chars typed correctly so far
    const words = typed.trim().split(/\s+/).filter(Boolean);
    player.timedWords = words.length;
    player.timedChars = typed.length;
    player.wpm        = calcWPM(typed.length, room.settings.timedDuration - room.timedValue + timeSec);
    player.roundScore = player.timedWords;
    player.totalScore += player.roundScore;
    player.accuracy   = 1;
    player.finished   = true;
  } else {
    for (let i = 0; i < Math.min(typed.length, phrase.length); i++) {
      if (typed[i] === phrase[i]) correct++;
    }
    player.correct    = correct;
    player.accuracy   = phrase.length > 0 ? correct / phrase.length : 0;
    player.wpm        = calcWPM(phrase.length, timeSec);
    player.roundScore = calcPoints(timeSec, player.accuracy, phrase.length);
    player.totalScore += player.roundScore;
    player.finished   = true;
    player.finishTime = timeSec;
  }

  // Update team scores
  if (room.settings.mode === 'teams' && player.team) {
    room.teamScores[player.team] = Object.values(room.players)
      .filter(p => p.team === player.team)
      .reduce((s, p) => s + p.totalScore, 0);
  }

  toRoom(room, 'player_finished', {
    nickname: player.nickname,
    wpm:      player.wpm,
    accuracy: Math.round(player.accuracy * 100),
    team:     player.team,
  });

  const allDone = Object.values(room.players).every(p => p.finished);
  if (allDone) finishRound(room);
}

function finishRound(room) {
  if (room.phase !== 'round') return;
  room.phase = 'break';
  clearTimeout(room.roundTimer);
  clearInterval(room.timedTimer);
  room.roundTimer = null;
  room.timedTimer = null;

  // Mark DNF players
  Object.values(room.players).forEach(p => {
    if (!p.finished) { p.finished = true; p.roundScore = 0; }
  });

  const lb = getLeaderboard(room);

  if (room.currentRound >= room.settings.totalRounds) {
    room.phase = 'gameover';
    room.rematchVotes = new Set();
    toRoom(room, 'game_over', {
      leaderboard: lb,
      teamScores:  room.teamScores,
      mode:        room.settings.mode,
    });
  } else {
    toRoom(room, 'round_end', { leaderboard: lb, round: room.currentRound });
    startBreak(room);
  }
}

function startBreak(room) {
  room.breakValue = DEFAULTS.BREAK_DURATION;
  toRoom(room, 'break_start', { value: room.breakValue });

  room.breakTimer = setInterval(() => {
    room.breakValue--;
    toRoom(room, 'break_tick', { value: room.breakValue });
    if (room.breakValue <= 0) {
      clearInterval(room.breakTimer);
      room.breakTimer = null;
      startRound(room);
    }
  }, 1000);
}

// ─── Rematch ──────────────────────────────────────────────────────────────────
function handleRematchVote(room, socketId) {
  if (room.phase !== 'gameover') return;
  room.rematchVotes.add(socketId);
  const total   = getRoomPlayerCount(room);
  const votes   = room.rematchVotes.size;
  toRoom(room, 'rematch_vote', { votes, total, nickname: room.players[socketId]?.nickname });

  if (votes >= total) {
    clearRoomTimers(room);
    room.phase        = 'lobby';
    room.currentRound = 0;
    room.usedPhrases  = new Set();
    room.rematchVotes = new Set();
    Object.values(room.players).forEach(p => { p.totalScore = 0; });
    toRoom(room, 'rematch_start', buildStateSync(room));
    setTimeout(() => startPreGameCountdown(room), 2000);
  }
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
function handleChat(room, socketId, text) {
  const player = room.players[socketId];
  if (!player) return;
  const msg = {
    nickname: player.nickname,
    text:     text.trim().slice(0, 200),
    ts:       Date.now(),
  };
  room.chat.push(msg);
  if (room.chat.length > 100) room.chat.shift();
  toRoom(room, 'chat_message', msg);
}

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', socket => {

  // Helper: find player's room
  function getMyRoom() {
    for (const [, r] of rooms) {
      if (r.players[socket.id]) return r;
    }
    return null;
  }

  // ── Create Room ──
  socket.on('create_room', ({ nickname }) => {
    if (!nickname?.trim()) return;
    const room = createRoom(socket.id);
    socket.join(room.code);
    room.players[socket.id] = makePlayer(nickname.trim().slice(0, 20));
    socket.emit('room_created', { code: room.code, ...buildStateSync(room) });
  });

  // ── Join Room ──
  socket.on('join_room', ({ roomCode, nickname }) => {
    if (!nickname?.trim() || !roomCode) return;
    const code = roomCode.toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) { socket.emit('join_error', { msg: 'Room not found.' }); return; }
    if (room.phase !== 'lobby' && room.phase !== 'countdown') {
      socket.emit('join_error', { msg: 'Game already in progress.' }); return;
    }
    // Duplicate nickname check
    const taken = Object.values(room.players).some(p => p.nickname.toLowerCase() === nickname.trim().toLowerCase());
    if (taken) { socket.emit('join_error', { msg: 'Nickname already taken in this room.' }); return; }

    socket.join(code);
    room.players[socket.id] = makePlayer(nickname.trim().slice(0, 20));

    const isHost = room.hostId === socket.id;
    socket.emit('room_joined', { isHost, ...buildStateSync(room) });
    toRoom(room, 'player_joined', {
      nickname: nickname.trim(),
      players:  getLobbyData(room),
    });

    // Auto-start countdown when minimum players reached and no countdown running
    if (room.phase === 'lobby' && getRoomPlayerCount(room) >= DEFAULTS.MIN_PLAYERS) {
      startPreGameCountdown(room);
    }
  });

  // ── Host: update settings ──
  socket.on('host_settings', (settings) => {
    const room = getMyRoom();
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
    if (settings.totalRounds)    room.settings.totalRounds    = Math.min(10, Math.max(1, +settings.totalRounds));
    if (settings.difficulty)     room.settings.difficulty     = settings.difficulty;
    if (settings.mode)           room.settings.mode           = settings.mode;
    if (settings.phrasePack)     room.settings.phrasePack     = settings.phrasePack;
    if (settings.timedDuration)  room.settings.timedDuration  = Math.min(120, Math.max(15, +settings.timedDuration));
    toRoom(room, 'settings_updated', { settings: room.settings });
  });

  // ── Host: force start ──
  socket.on('host_start', () => {
    const room = getMyRoom();
    if (!room || room.hostId !== socket.id) return;
    if (room.phase === 'lobby' && getRoomPlayerCount(room) >= 1) {
      clearInterval(room.countdownTimer);
      room.countdownTimer = null;
      beginGame(room);
    } else if (room.phase === 'countdown') {
      clearInterval(room.countdownTimer);
      room.countdownTimer = null;
      beginGame(room);
    }
  });

  // ── Host: kick player ──
  socket.on('host_kick', ({ nickname }) => {
    const room = getMyRoom();
    if (!room || room.hostId !== socket.id) return;
    const targetId = getSocketIdByNickname(room, nickname);
    if (!targetId || targetId === socket.id) return;
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.emit('kicked');
      targetSocket.leave(room.code);
    }
    delete room.players[targetId];
    toRoom(room, 'player_left', { nickname, players: getLobbyData(room) });
  });

  // ── Submit Result ──
  socket.on('submit_result', ({ typed }) => {
    const room = getMyRoom();
    if (!room || typeof typed !== 'string') return;
    handleSubmit(room, socket.id, typed);
  });

  // ── Progress ──
  socket.on('progress', ({ typed }) => {
    const room = getMyRoom();
    if (!room || room.phase !== 'round') return;
    const player = room.players[socket.id];
    if (!player) return;
    const pct = Math.round((typed.length / room.currentPhrase.length) * 100);
    toRoom(room, 'player_progress', { nickname: player.nickname, progress: Math.min(pct, 100), team: player.team });
  });

  // ── Chat ──
  socket.on('chat', ({ text }) => {
    const room = getMyRoom();
    if (!room || !text?.trim()) return;
    handleChat(room, socket.id, text);
  });

  // ── Rematch Vote ──
  socket.on('rematch_vote', () => {
    const room = getMyRoom();
    if (!room) return;
    handleRematchVote(room, socket.id);
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    const room = getMyRoom();
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;
    const nickname = player.nickname;
    delete room.players[socket.id];

    // Transfer host if needed
    if (room.hostId === socket.id) {
      const newHostId = Object.keys(room.players)[0];
      if (newHostId) {
        room.hostId = newHostId;
        io.to(newHostId).emit('you_are_host');
        toRoom(room, 'host_changed', { nickname: room.players[newHostId].nickname });
      }
    }

    toRoom(room, 'player_left', { nickname, players: getLobbyData(room) });

    // Check if round can end
    if (room.phase === 'round') {
      const allDone = Object.values(room.players).every(p => p.finished);
      if (allDone && getRoomPlayerCount(room) > 0) finishRound(room);
    }

    if (!roomHasPlayers(room)) deleteRoom(room.code);
  });
});

// ─── Server ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🏁 TypeRace v2 → http://localhost:${PORT}`));