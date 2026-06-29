const STORAGE_KEY = 'flip7-spa-v3-fixed';
const colors = ['#ffcc00','#8a3ffc','#ff7426','#2583ff','#e9499c','#24c45a','#b0b7c9'];
let state = loadState();
let roundDraft = {};
let lastFeedback = null;

function defaultState(){return {players:[],started:false,round:1,history:[],champions:[],gameEnded:false};}
function loadState(){try{return {...defaultState(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY))||{})};}catch(e){return defaultState();}}
function saveState(){localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateRoundPill();}
function uid(){return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random());}
function scoreOf(id){return state.history.reduce((sum,r)=>sum+(Number(r.scores[id])||0),0);}
function sortedPlayers(){return [...state.players].sort((a,b)=>scoreOf(b.id)-scoreOf(a.id));}
function roundNumber(){return state.history.length+1;}
function championCandidate(){const over=sortedPlayers().filter(p=>scoreOf(p.id)>=200); return over.length?over[0]:null;}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function formatDate(iso){return new Intl.DateTimeFormat('pt-BR').format(new Date(iso));}
function updateRoundPill(){document.getElementById('roundPill').textContent = `Rodada ${roundNumber()}`;}

function go(screen){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(screen).classList.add('active');
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.go===screen));
  if(screen==='ranking') renderRanking();
  if(screen==='players') renderPlayers();
  if(screen==='round') renderRoundInputs();
  if(screen==='history') renderHistory();
  if(screen==='champions') renderChampions();
}

function renderPlayers(){
  const list=document.getElementById('playersList');
  list.innerHTML='';
  if(!state.players.length){list.innerHTML='<p class="helper">Nenhum participante ainda.</p>';return;}
  state.players.forEach((p,i)=>{
    const row=document.createElement('div');
    row.className='player-row';
    row.innerHTML=`<div class="avatar" style="background:${colors[i%colors.length]}">●</div><span>${escapeHtml(p.name)}</span><button aria-label="remover">×</button>`;
    row.querySelector('button').onclick=()=>{state.players=state.players.filter(x=>x.id!==p.id);saveState();renderPlayers();};
    list.appendChild(row);
  });
}

function renderRanking(){
  const list=document.getElementById('rankingList');
  list.innerHTML='';
  if(!state.players.length){list.innerHTML='<p class="helper">Adicione participantes para começar.</p>';return;}
  sortedPlayers().forEach((p,i)=>{
    const s=scoreOf(p.id), diff=s-200;
    const card=document.createElement('div');
    card.className='rank-card '+(i===0?'leader':'');
    card.innerHTML=`
      <div class="pos">${i+1}</div>
      <div class="avatar" style="background:${colors[i%colors.length]}">●</div>
      <div class="rank-name">${escapeHtml(p.name)}</div>
      <div class="rank-score">${s}<small>(${diff>=0?`+${diff}`:diff})</small></div>`;
    list.appendChild(card);
  });
}

function renderRoundInputs(){
  document.getElementById('roundSubtitle').textContent=`Rodada ${roundNumber()}`;
  const box=document.getElementById('roundInputs');
  box.innerHTML='';
  roundDraft={};
  state.players.forEach((p,i)=>{
    roundDraft[p.id]={points:'',bust:false};
    const row=document.createElement('div');
    row.className='round-line';
    row.innerHTML=`
      <div class="avatar" style="background:${colors[i%colors.length]}">●</div>
      <div class="round-name">${escapeHtml(p.name)}</div>
      <input inputmode="numeric" pattern="[0-9]*" placeholder="0" />
      <button class="bomb" aria-label="estourou">💣</button>`;
    const input=row.querySelector('input');
    const bomb=row.querySelector('.bomb');
    input.oninput=()=>{roundDraft[p.id].points=input.value;if(input.value && Number(input.value)>0){roundDraft[p.id].bust=false;bomb.classList.remove('active');}};
    bomb.onclick=()=>{roundDraft[p.id].bust=!roundDraft[p.id].bust;bomb.classList.toggle('active',roundDraft[p.id].bust);if(roundDraft[p.id].bust){input.value='0';roundDraft[p.id].points='0';}};
    box.appendChild(row);
  });
}

function saveRound(){
  if(!state.players.length)return;
  const beforeLeader=sortedPlayers()[0];
  const scores={};
  state.players.forEach(p=>{const d=roundDraft[p.id]||{};scores[p.id]=d.bust?0:Math.max(0,Number(d.points)||0);});
  state.history.push({round:roundNumber(),date:new Date().toISOString(),scores});
  saveState();
  const afterLeader=sortedPlayers()[0];
  const champ=championCandidate();
  if(champ){
    lastFeedback={type:'champion',player:champ,score:scoreOf(champ.id)};
  }else if(beforeLeader && afterLeader && beforeLeader.id!==afterLeader.id){
    lastFeedback={type:'newLeader',player:afterLeader,score:scoreOf(afterLeader.id)};
  }else{
    lastFeedback={type:'sameLeader',player:afterLeader,score:scoreOf(afterLeader.id)};
  }
  renderFeedback();
  go('feedback');
}

function renderFeedback(){
  const title=document.getElementById('feedbackTitle');
  const text=document.getElementById('feedbackText');
  const card=document.getElementById('feedbackCard');
  const finish=document.getElementById('finishGameBtn');
  const p=lastFeedback.player;
  if(lastFeedback.type==='champion'){
    document.getElementById('feedbackIcon').textContent='🏆';
    title.textContent='Temos um campeão!';
    text.textContent='Maior pontuação acima de 200 é campeã.';
    finish.classList.remove('hidden');
  } else if(lastFeedback.type==='newLeader'){
    document.getElementById('feedbackIcon').textContent='👑';
    title.textContent='Nova liderança!';
    text.textContent=`${p.name} assumiu o primeiro lugar.`;
    finish.classList.add('hidden');
  } else {
    document.getElementById('feedbackIcon').textContent='👑';
    title.textContent='Líder mantido!';
    text.textContent=`${p.name} continua na liderança.`;
    finish.classList.add('hidden');
  }
  card.innerHTML=`<div class="big-name">${escapeHtml(p.name)}</div><div class="big-score">${lastFeedback.score}</div><div>pontos</div>`;
}

function finishGame(){
  const champ=championCandidate();
  if(!champ)return;
  state.champions.unshift({id:uid(),playerName:champ.name,score:scoreOf(champ.id),date:new Date().toISOString(),round:state.history.length});
  state.gameEnded=true;
  saveState();
  renderChampions();
  go('champions');
}

function renderHistory(){
  const table=document.getElementById('historyTable');
  if(!state.history.length){table.innerHTML='<tr><td>Nenhuma rodada salva.</td></tr>';return;}
  const players=state.players;
  const header=`<tr><th>Rodada</th>${players.map(p=>`<th>${escapeHtml(p.name)}</th>`).join('')}</tr>`;
  const body=[...state.history].reverse().map(r=>`<tr><td>${r.round}</td>${players.map(p=>`<td>${r.scores[p.id]===0?'💣':r.scores[p.id]??0}</td>`).join('')}</tr>`).join('');
  const foot=`<tr><th>Total</th>${players.map(p=>`<th>${scoreOf(p.id)}</th>`).join('')}</tr>`;
  table.innerHTML=header+body+foot;
}

function renderChampions(){
  const box=document.getElementById('championsList');
  box.innerHTML='';
  if(!state.champions.length){box.innerHTML='<p class="helper">Nenhuma partida finalizada ainda.</p>';return;}
  state.champions.forEach((c,i)=>{
    const div=document.createElement('div');
    div.className='champ-card '+(i===0?'first':'');
    div.innerHTML=`<div class="medal">${i===0?'🏆':(i+1)+'º'}</div><div><div class="champ-name">${escapeHtml(c.playerName)}</div><div class="champ-meta">${formatDate(c.date)} · Rodada ${c.round}</div></div><div class="champ-score">${c.score}</div>`;
    box.appendChild(div);
  });
}

function newGame(keepPlayers=true){
  state.history=[];
  state.started=keepPlayers && state.players.length>0;
  state.gameEnded=false;
  saveState();
  closeMenu();
  go(state.started?'ranking':'players');
}

function clearScoreData(){
  const champions=state.champions||[];
  state={...defaultState(), champions};
  roundDraft={};
  lastFeedback=null;
  saveState();
  closeMenu();
  go('players');
}

function openMenu(){document.getElementById('menuPanel').classList.remove('hidden');}
function closeMenu(){document.getElementById('menuPanel').classList.add('hidden');}

function undo(){
  if(!state.history.length)return;
  state.history.pop();
  state.gameEnded=false;
  saveState();
  renderRanking();
}

function addPlayer(){
  const input=document.getElementById('playerNameInput');
  const name=input.value.trim();
  if(!name)return;
  state.players.push({id:uid(),name});
  input.value='';
  saveState();
  renderPlayers();
}

window.addEventListener('DOMContentLoaded',()=>{
  updateRoundPill();
  document.getElementById('addPlayerBtn').onclick=addPlayer;
  document.getElementById('playerNameInput').addEventListener('keydown',e=>{if(e.key==='Enter')addPlayer();});
  document.getElementById('startGameBtn').onclick=()=>{if(!state.players.length)return;state.started=true;saveState();go('ranking');};
  document.getElementById('endRoundBtn').onclick=()=>go('round');
  document.getElementById('historyBtn').onclick=()=>go('history');
  document.getElementById('undoBtn').onclick=undo;
  document.getElementById('saveRoundBtn').onclick=saveRound;
  document.getElementById('feedbackRankingBtn').onclick=()=>go('ranking');
  document.getElementById('feedbackHistoryBtn').onclick=()=>go('history');
  document.getElementById('finishGameBtn').onclick=finishGame;
  document.getElementById('championsNewGameBtn').onclick=()=>newGame(true);
  document.getElementById('menuBtn').onclick=openMenu;
  document.getElementById('menuCloseBtn').onclick=closeMenu;
  document.getElementById('menuPanel').addEventListener('click',e=>{if(e.target.id==='menuPanel')closeMenu();});
  document.getElementById('menuNewGameBtn').onclick=()=>newGame(true);
  document.getElementById('menuClearScoreBtn').onclick=()=>{if(confirm('Limpar placar, jogadores e rodadas? O histórico de campeões será mantido.')) clearScoreData();};
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));}
  go(state.started?'ranking':'players');
});
