# 🏁 TYPE RACE v2 — Multiplayer Typing Game

A major upgrade to the real-time multiplayer typing race game.

## What's New in v2

### 🏠 Room System
- **Private rooms** with shareable 5-character codes
- **Shareable URLs** — `/ABCDE` links directly to a room
- Multiple simultaneous rooms supported
- Automatic host transfer if host disconnects

### 👑 Host Controls
- Set number of rounds (3 / 5 / 7 / 10)
- Choose difficulty (Easy / Medium / Hard)
- Select game mode (Standard / Timed / Sudden Death / Teams)
- Choose phrase pack (Classic / Animals / Science / Movies)
- Kick players from lobby
- Force-start before countdown ends

### 🎮 Game Modes
| Mode | Description |
|------|-------------|
| **Standard** | Classic race — finish the phrase fastest |
| **Timed** | Type as many words as possible in 60 seconds |
| **Sudden Death** | Any typo must be deleted before you can continue |
| **Teams** | Red vs Blue — combined team score wins |

### ✨ Polish
- **Character highlighting** — green/red/caret as you type
- **Sudden Death shake** — visual error feedback
- **Confetti burst** on finish and game over
- **Lobby chat** + in-game chat sidebar
- **Real-time team progress bars** with team colors
- **Mobile-friendly** responsive layout

### 👤 Profiles & Achievements (localStorage)
Stats tracked per browser:
- Total races, wins, best WPM, average WPM
- WPM history sparkline

**10 Achievements:**
- ⚡ Speed Demon (80+ WPM)
- 🎯 Perfectionist (100% accuracy)
- 🏆 Podium (top 3 finish)
- 👑 Champion (win a race)
- 🏃 Marathoner (10 races)
- 💯 Century Club (100+ WPM)
- 📈 Consistent (avg 60+ WPM)
- 💀 Survivor (complete Sudden Death)
- 🤝 Team Player (win a team match)
- 🎩 Hat Trick (3 win streak)

### 🔁 Rematch
- Players vote to rematch after game over
- When all players vote, countdown restarts automatically

---

## Setup

```bash
npm install
npm start
# open http://localhost:3000
```

Share `http://your-server/ROOMCODE` for others to join directly.

## Phrase Packs

| Pack | Description |
|------|-------------|
| Classic | General knowledge phrases, various lengths |
| Animals | Animal facts and nature descriptions |
| Science | Scientific concepts and facts |
| Movies | Famous movie quote references |

Each pack has Easy, Medium, and Hard tiers.

## Tech Stack
- **Backend:** Node.js, Express, Socket.io, uuid
- **Frontend:** Vanilla HTML/CSS/JS
- **Fonts:** Bebas Neue + DM Mono (Google Fonts)
- **Storage:** localStorage (profiles/achievements)
- **Audio:** Web Audio API
