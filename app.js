const STORAGE_KEY = 'flip7-scoreboard-spa-v2';
let state = loadState();
let currentScreen = state.players.length ? 'ranking' : 'participants';

const titles = { participants: 'Participantes', ranking: 'Ranking', round: 'Encerrar rodada' };
const colors = ['#8b5cf6', '#3b82f6', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#ef4444'];
const $ = (id) => document.getElementById(id);

function defaultState() { return { players: [], round: {}, history: [] }; }
function loadState() {
  try { return { ...defaultState(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }; }
  catch { return defaultState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()); }
function sortedPlayers() { return [...state.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)); }
function roundNumber() { return state.history.length + 1; }

function setScreen(screen) {
  if ((screen === 'ranking' || screen === 'round') && state.players.length === 0) screen = 'participants';
  currentScreen = screen;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(`${screen}Screen`).classList.add('active');
  $('screenTitle').textContent = titles[screen];
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.screen === screen));
  $('backBtn').style.visibility = screen === 'participants' ? 'hidden' : 'visible';
  render();
}

function render() { renderPlayers(); renderRanking(); renderRound(); }

function renderPlayers() {
  $('playersList').innerHTML = state.players.map((p, i) => `
    <div class="player-row">
      <div class="avatar" style="background:${colors[i % colors.length]}">👤</div>
      <div class="player-name">${escapeHtml(p.name)}</div>
      <button class="delete-btn" data-delete="${p.id}" aria-label="Remover ${escapeHtml(p.name)}">×</button>
    </div>`).join('');
  $('startGameBtn').disabled = state.players.length === 0;
}

function renderRanking() {
  $('roundNumber').textContent = `Rodada ${roundNumber()}`;
  $('undoBtn').disabled = state.history.length === 0;
  const players = sortedPlayers();
  const winner = players.find(p => p.score >= 200);
  const banner = $('winnerBanner');
  if (winner) {
    banner.textContent = `🏆 ${winner.name} chegou a ${winner.score} pontos!`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
  $('rankingList').innerHTML = players.length ? players.map((p, i) => `
    <div class="rank-card ${i === 0 ? 'first' : ''}">
      <div class="position">${i + 1}</div>
      <div class="player-name">${escapeHtml(p.name)}</div>
      <div class="points">${p.score}<span>pts</span></div>
    </div>`).join('') : '<p class="subtitle">Adicione participantes para começar.</p>';
}

function renderRound() {
  $('roundInputs').innerHTML = state.players.map((p, i) => {
    const round = state.round[p.id] || { points: '', busted: false };
    return `
      <div class="round-row">
        <div class="player-row-inline" style="display:flex;align-items:center;gap:12px;">
          <div class="avatar" style="background:${colors[i % colors.length]}">👤</div>
          <div class="player-name">${escapeHtml(p.name)}</div>
        </div>
        <input inputmode="numeric" pattern="[0-9]*" class="score-input" data-points="${p.id}" placeholder="0" value="${round.busted ? 0 : escapeHtml(String(round.points ?? ''))}" ${round.busted ? 'disabled' : ''}/>
        <button class="bust-btn ${round.busted ? 'active' : ''}" data-bust="${p.id}">Estourou</button>
      </div>`;
  }).join('');
}

function addPlayer() {
  const input = $('playerNameInput');
  const name = input.value.trim();
  if (!name) return;
  state.players.push({ id: uid(), name, score: 0 });
  input.value = '';
  saveState(); render(); input.focus();
}

function saveRound() {
  const snapshot = JSON.parse(JSON.stringify(state.players));
  const entries = state.players.map(p => {
    const round = state.round[p.id] || { points: 0, busted: false };
    const points = round.busted ? 0 : Math.max(0, Number(round.points || 0));
    return { id: p.id, name: p.name, points, busted: !!round.busted };
  });
  state.players = state.players.map(p => {
    const entry = entries.find(e => e.id === p.id);
    return { ...p, score: p.score + (entry?.points || 0) };
  });
  state.history.push({ at: new Date().toISOString(), before: snapshot, entries });
  state.round = {};
  saveState(); setScreen('ranking');
}

function undoRound() {
  const last = state.history.pop();
  if (!last) return;
  state.players = last.before;
  state.round = {};
  saveState(); render();
}

function resetGame() {
  if (!confirm('Começar uma nova partida e zerar tudo?')) return;
  state = defaultState();
  saveState(); setScreen('participants');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

document.addEventListener('click', (e) => {
  const deleteId = e.target.dataset.delete;
  const bustId = e.target.dataset.bust;
  const navScreen = e.target.closest('.nav-item')?.dataset.screen;
  if (deleteId) {
    state.players = state.players.filter(p => p.id !== deleteId);
    delete state.round[deleteId];
    saveState(); render();
  }
  if (bustId) {
    const current = state.round[bustId] || { points: '', busted: false };
    state.round[bustId] = { points: current.busted ? '' : 0, busted: !current.busted };
    saveState(); renderRound();
  }
  if (navScreen) setScreen(navScreen);
});

document.addEventListener('input', (e) => {
  const id = e.target.dataset.points;
  if (!id) return;
  state.round[id] = { ...(state.round[id] || {}), points: e.target.value.replace(/\D/g, ''), busted: false };
  saveState();
});

$('addPlayerForm').addEventListener('submit', e => { e.preventDefault(); addPlayer(); });
$('startGameBtn').addEventListener('click', () => setScreen('ranking'));
$('endRoundBtn').addEventListener('click', () => setScreen('round'));
$('saveRoundBtn').addEventListener('click', saveRound);
$('undoBtn').addEventListener('click', undoRound);
$('resetBtn').addEventListener('click', resetGame);
$('backBtn').addEventListener('click', () => setScreen(currentScreen === 'round' ? 'ranking' : 'participants'));

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
setScreen(currentScreen);
