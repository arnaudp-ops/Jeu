'use strict';

// ─── Phases ──────────────────────────────────────────────────────────────────

const PHASE = {
  SETUP:         'setup',
  QUESTION:      'question',
  ANSWER_TURN:   'answer_turn',
  VOTE_COLLECT:  'vote_collect',
  VOTE_REVEAL:   'vote_reveal',
  ROUND_RESULTS: 'round_results',
  FINAL_RESULTS: 'final_results',
};

// ─── State ───────────────────────────────────────────────────────────────────

let setup = { numPlayers: 4, numRounds: 5, names: [] };
let game  = null;

// ─── Setup ───────────────────────────────────────────────────────────────────

function saveNames() {
  for (let i = 0; i < setup.numPlayers; i++) {
    const el = document.getElementById('pn' + i);
    if (el) setup.names[i] = el.value.trim();
  }
}

function onPlayersChange(v) {
  saveNames();
  setup.numPlayers = +v;
  const val = document.getElementById('pVal');
  if (val) val.textContent = v;
  const list = document.getElementById('pList');
  if (list) {
    list.innerHTML = nameInputsHTML(+v);
    for (let i = 0; i < +v; i++) {
      const el = document.getElementById('pn' + i);
      if (el && setup.names[i]) el.value = setup.names[i];
    }
  }
}

function onRoundsChange(v) {
  setup.numRounds = +v;
  const val = document.getElementById('rVal');
  if (val) val.textContent = v;
}

function nameInputsHTML(n) {
  return Array.from({ length: n }, function(_, i) {
    return '<div class="player-row">'
      + '<div class="player-avatar">' + (i + 1) + '</div>'
      + '<input type="text" id="pn' + i + '" placeholder="Joueur ' + (i + 1) + '" '
      + 'maxlength="20" autocomplete="off" autocorrect="off" autocapitalize="words">'
      + '</div>';
  }).join('');
}

function startGame() {
  saveNames();
  const players = [];
  for (let i = 0; i < setup.numPlayers; i++) {
    const n = (setup.names[i] || '').trim();
    players.push({ name: n || 'Joueur ' + (i + 1), score: 0 });
  }
  game = {
    players,
    totalRounds:          setup.numRounds,
    currentRound:         1,
    question:             '',
    answers:              [],
    votes:                {},
    phase:                PHASE.QUESTION,
    currentAnswerPlayer:  0,
    currentAnswerIdx:     0,
    currentVoterPos:      0,
    usedQuestions:        new Set(),
    selectedVote:         null,
    roundDeltas:          [],
  };
  pickQuestion();
  render();
}

// ─── Question ────────────────────────────────────────────────────────────────

function pickQuestion() {
  const pool = QUESTIONS
    .map(function(q, i) { return { q, i }; })
    .filter(function(x) { return !game.usedQuestions.has(x.i); });
  const src  = pool.length ? pool : QUESTIONS.map(function(q, i) { return { q, i }; });
  const pick = src[Math.floor(Math.random() * src.length)];
  game.usedQuestions.add(pick.i);
  game.question = pick.q;
}

function skipQuestion() {
  pickQuestion();
  render();
}

function startAnswers() {
  game.phase              = PHASE.ANSWER_TURN;
  game.currentAnswerPlayer = 0;
  game.answers            = [];
  render();
}

// ─── Answers ─────────────────────────────────────────────────────────────────

function submitAnswer() {
  const input = document.getElementById('ansInput');
  const text  = input ? input.value.trim() : '';
  if (!text) {
    if (input) {
      input.classList.add('error');
      input.placeholder = 'Entre une reponse !';
      input.focus();
    }
    return;
  }
  game.answers.push({ playerIndex: game.currentAnswerPlayer, text });
  game.currentAnswerPlayer++;
  if (game.currentAnswerPlayer >= game.players.length) {
    shuffle(game.answers);
    game.phase           = PHASE.VOTE_COLLECT;
    game.currentAnswerIdx = 0;
    game.currentVoterPos  = 0;
    game.votes            = {};
  }
  render();
}

// ─── Voting ──────────────────────────────────────────────────────────────────

function eligibleVoters(answerIdx) {
  const author = game.answers[answerIdx].playerIndex;
  return game.players.map(function(_, i) { return i; }).filter(function(i) { return i !== author; });
}

function selectVote(idx) {
  game.selectedVote = idx;
  document.querySelectorAll('.vote-btn').forEach(function(b) { b.classList.remove('selected'); });
  const b = document.getElementById('vb' + idx);
  if (b) b.classList.add('selected');
  const btn = document.getElementById('confirmBtn');
  if (btn) btn.removeAttribute('disabled');
}

function confirmVote() {
  if (game.selectedVote === null) return;
  const aIdx    = game.currentAnswerIdx;
  const voters  = eligibleVoters(aIdx);
  const voterIdx = voters[game.currentVoterPos];
  if (!game.votes[aIdx]) game.votes[aIdx] = {};
  game.votes[aIdx][voterIdx] = game.selectedVote;
  game.selectedVote = null;
  game.currentVoterPos++;
  if (game.currentVoterPos >= voters.length) game.phase = PHASE.VOTE_REVEAL;
  render();
}

function nextAnswer() {
  game.currentAnswerIdx++;
  game.currentVoterPos = 0;
  game.selectedVote    = null;
  game.phase           = PHASE.VOTE_COLLECT;
  render();
}

function endVoting() {
  computeScores();
  game.phase = PHASE.ROUND_RESULTS;
  render();
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function computeScores() {
  game.roundDeltas = game.players.map(function() { return 0; });
  game.answers.forEach(function(ans, aIdx) {
    const author  = ans.playerIndex;
    const voters  = eligibleVoters(aIdx);
    const aVotes  = game.votes[aIdx] || {};
    voters.forEach(function(voterIdx) {
      if (aVotes[voterIdx] === author) {
        game.roundDeltas[voterIdx] += 1;
      } else {
        game.roundDeltas[author]   += 2;
      }
    });
  });
  game.roundDeltas.forEach(function(d, i) { game.players[i].score += d; });
}

// ─── Round / Game flow ───────────────────────────────────────────────────────

function nextRound() {
  game.currentRound++;
  game.answers             = [];
  game.votes               = {};
  game.currentAnswerPlayer  = 0;
  game.currentAnswerIdx    = 0;
  game.currentVoterPos     = 0;
  game.roundDeltas         = [];
  game.selectedVote        = null;
  pickQuestion();
  game.phase = PHASE.QUESTION;
  render();
}

function showFinal() {
  game.phase = PHASE.FINAL_RESULTS;
  render();
}

function resetGame() {
  game = null;
  render();
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sorted() {
  return game.players
    .map(function(p, i) { return { name: p.name, score: p.score, idx: i }; })
    .sort(function(a, b) { return b.score - a.score; });
}

function rankClass(r) {
  return r === 0 ? 'r1' : r === 1 ? 'r2' : r === 2 ? 'r3' : '';
}

function rankNum(r) {
  return r === 0 ? '<span style="color:var(--gold)">' + (r+1) + '</span>'
       : r === 1 ? '<span style="color:#94a3b8">'   + (r+1) + '</span>'
       : r === 2 ? '<span style="color:#cd7c3a">'   + (r+1) + '</span>'
       : '<span style="color:var(--text-muted);font-size:.85rem">' + (r+1) + '</span>';
}

function roundChip() {
  return '<div class="round-chip"><div class="round-chip-dot"></div>'
    + 'Manche ' + game.currentRound + ' / ' + game.totalRounds
    + '</div>';
}

function progressBar(current, total) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return '<div class="progress-bar-wrap">'
    + '<div class="progress-bar-fill" style="width:' + pct + '%"></div>'
    + '</div>';
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  if (!game) { renderSetup(app); return; }
  switch (game.phase) {
    case PHASE.QUESTION:      renderQuestion(app);      break;
    case PHASE.ANSWER_TURN:   renderAnswerTurn(app);    break;
    case PHASE.VOTE_COLLECT:  renderVoteCollect(app);   break;
    case PHASE.VOTE_REVEAL:   renderVoteReveal(app);    break;
    case PHASE.ROUND_RESULTS: renderRoundResults(app);  break;
    case PHASE.FINAL_RESULTS: renderFinalResults(app);  break;
  }
}

// ─── Screens ─────────────────────────────────────────────────────────────────

function renderSetup(app) {
  const n = setup.numPlayers, r = setup.numRounds;
  app.innerHTML = '<div class="screen">'
    + '<div class="logo-block"><h1>Bluff & Co</h1>'
    + '<p class="subtitle">Bluffez, trompez, deduisez.<br>Qui va tromper tout le monde ?</p></div>'

    + '<div class="slider-wrap">'
    +   '<div class="slider-row"><span>Joueurs</span><span class="slider-pill" id="pVal">' + n + '</span></div>'
    +   '<input type="range" min="2" max="20" value="' + n + '" oninput="onPlayersChange(this.value)">'
    + '</div>'

    + '<div class="slider-wrap">'
    +   '<div class="slider-row"><span>Manches</span><span class="slider-pill" id="rVal">' + r + '</span></div>'
    +   '<input type="range" min="1" max="10" value="' + r + '" oninput="onRoundsChange(this.value)">'
    + '</div>'

    + '<p class="label-xs" style="margin-bottom:12px">Prenoms</p>'
    + '<div class="player-list" id="pList">' + nameInputsHTML(n) + '</div>'

    + '<div class="spacer"></div>'
    + '<button class="btn btn-primary" onclick="startGame()">Lancer la partie</button>'
    + '</div>';

  for (let i = 0; i < n; i++) {
    const el = document.getElementById('pn' + i);
    if (el && setup.names[i]) el.value = setup.names[i];
  }
}

// ── Question ──

function renderQuestion(app) {
  app.innerHTML = '<div class="screen">'
    + roundChip()
    + '<div class="spacer"></div>'
    + '<p class="question-eyebrow">Question du tour</p>'
    + '<p class="question-text">' + esc(game.question) + '</p>'
    + '<div class="spacer"></div>'
    + '<p class="subtitle" style="text-align:center;margin-bottom:20px">'
    +   'Chaque joueur repond en secret. Qui va bluffer le mieux ?'
    + '</p>'
    + '<button class="btn btn-primary" style="margin-bottom:10px" onclick="startAnswers()">Commencer les reponses</button>'
    + '<button class="btn btn-ghost" onclick="skipQuestion()">Changer de question</button>'
    + '</div>';
}

// ── Answer turn ──

function renderAnswerTurn(app) {
  const { currentAnswerPlayer, players, question, currentRound, totalRounds } = game;
  const p = players[currentAnswerPlayer];
  app.innerHTML = '<div class="screen">'
    + roundChip()
    + progressBar(currentAnswerPlayer, players.length)

    + '<div class="turn-banner">'
    +   '<div class="turn-name">' + esc(p.name) + '</div>'
    +   '<div class="turn-sub">Tourne l\'ecran vers toi !</div>'
    + '</div>'

    + '<p class="answer-hint">"' + esc(question) + '"</p>'
    + '<textarea id="ansInput" placeholder="Ta reponse secrete..." '
    +   'autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false"></textarea>'

    + '<div class="spacer"></div>'
    + '<button class="btn btn-primary" style="margin-top:16px" onclick="submitAnswer()">Valider ma reponse</button>'
    + '</div>';

  setTimeout(function() {
    const el = document.getElementById('ansInput');
    if (el) el.focus();
  }, 150);
}

// ── Vote collect ──

function renderVoteCollect(app) {
  const { currentAnswerIdx, currentVoterPos, players, answers, currentRound, totalRounds } = game;
  const answer  = answers[currentAnswerIdx];
  const voters  = eligibleVoters(currentAnswerIdx);
  const voter   = players[voters[currentVoterPos]];

  const btns = players.map(function(p, i) {
    return '<button class="vote-btn" id="vb' + i + '" onclick="selectVote(' + i + ')">'
      + esc(p.name) + '</button>';
  }).join('');

  app.innerHTML = '<div class="screen">'
    + roundChip()
    + progressBar(currentAnswerIdx, answers.length)

    + '<div class="answer-card">'
    +   '<p class="answer-eyebrow">Reponse ' + (currentAnswerIdx+1) + ' / ' + answers.length + '</p>'
    +   '<p class="answer-body">' + esc(answer.text) + '</p>'
    + '</div>'

    + '<div class="turn-banner" style="margin-bottom:16px">'
    +   '<div class="turn-name">' + esc(voter.name) + '</div>'
    +   '<div class="turn-sub">Qui a ecrit ca ?</div>'
    + '</div>'

    + '<div class="vote-grid">' + btns + '</div>'
    + '<div class="spacer"></div>'
    + '<button class="btn btn-primary" id="confirmBtn" onclick="confirmVote()" disabled>'
    +   'Confirmer mon vote'
    + '</button>'
    + '</div>';
}

// ── Vote reveal ──

function renderVoteReveal(app) {
  const { currentAnswerIdx, answers, players, votes } = game;
  const answer    = answers[currentAnswerIdx];
  const authorIdx = answer.playerIndex;
  const author    = players[authorIdx];
  const voters    = eligibleVoters(currentAnswerIdx);
  const aVotes    = votes[currentAnswerIdx] || {};

  const results = voters.map(function(vi) {
    const guessed = aVotes[vi];
    return { vi, guessed, hit: guessed === authorIdx };
  });

  const fooled    = results.filter(function(r) { return !r.hit; }).length;
  const authorPts = fooled * 2;
  const isLast    = currentAnswerIdx >= answers.length - 1;

  const rows = results.map(function(r) {
    const who   = players[r.guessed] ? esc(players[r.guessed].name) : '?';
    const label = r.hit ? 'Bonne reponse' : 'A cru que c\'etait ' + who;
    const pts   = r.hit ? '+1' : '0';
    return '<div class="result-row ' + (r.hit ? 'hit' : 'miss') + '">'
      + '<span>' + esc(players[r.vi].name) + '</span>'
      + '<span class="sub">' + label + '</span>'
      + '<span class="result-pts">' + pts + ' pt' + (r.hit ? '' : '') + '</span>'
      + '</div>';
  }).join('');

  const authorLine = authorPts > 0
    ? fooled + ' personne(s) trompee(s) &rarr; +' + authorPts + ' pts'
    : 'Tout le monde a devine &mdash; 0 pt';

  app.innerHTML = '<div class="screen">'
    + roundChip()
    + progressBar(currentAnswerIdx, answers.length)

    + '<div class="answer-card">'
    +   '<p class="answer-eyebrow">Reponse ' + (currentAnswerIdx+1) + ' / ' + answers.length + '</p>'
    +   '<p class="answer-body">' + esc(answer.text) + '</p>'
    + '</div>'

    + '<div class="reveal-card">'
    +   '<p class="reveal-eyebrow">Ecrit par</p>'
    +   '<p class="reveal-name">' + esc(author.name) + '</p>'
    +   '<p class="reveal-author-pts">' + authorLine + '</p>'
    + '</div>'

    + '<div class="result-list">' + rows + '</div>'
    + '<div class="spacer"></div>'
    + '<button class="btn btn-primary" onclick="' + (isLast ? 'endVoting()' : 'nextAnswer()') + '">'
    +   (isLast ? 'Voir les scores' : 'Reponse suivante')
    + '</button>'
    + '</div>';
}

// ── Round results ──

function renderRoundResults(app) {
  const { currentRound, totalRounds, roundDeltas } = game;
  const list    = sorted();
  const isLast  = currentRound >= totalRounds;

  const rows = list.map(function(p, rank) {
    const d = roundDeltas[p.idx] || 0;
    return '<div class="board-row ' + rankClass(rank) + '">'
      + '<div class="board-rank">' + rankNum(rank) + '</div>'
      + '<div class="board-name">' + esc(p.name) + '</div>'
      + (d > 0 ? '<div class="board-delta">+' + d + '</div>' : '')
      + '<div class="board-score">' + p.score + ' pts</div>'
      + '</div>';
  }).join('');

  app.innerHTML = '<div class="screen">'
    + '<div style="margin-bottom:24px">'
    +   '<div class="round-chip"><div class="round-chip-dot"></div>Manche ' + currentRound + ' / ' + totalRounds + '</div>'
    + '</div>'
    + '<h2 style="margin-bottom:18px">Scores</h2>'
    + '<div class="board">' + rows + '</div>'
    + '<div class="spacer"></div>'
    + '<button class="btn btn-primary" onclick="' + (isLast ? 'showFinal()' : 'nextRound()') + '">'
    +   (isLast ? 'Voir le resultat final' : 'Manche suivante')
    + '</button>'
    + '</div>';
}

// ── Final results ──

function renderFinalResults(app) {
  const list   = sorted();
  const winner = list[0];

  const rows = list.map(function(p, rank) {
    return '<div class="board-row ' + rankClass(rank) + '">'
      + '<div class="board-rank">' + rankNum(rank) + '</div>'
      + '<div class="board-name">' + esc(p.name) + '</div>'
      + '<div class="board-score">' + p.score + ' pts</div>'
      + '</div>';
  }).join('');

  app.innerHTML = '<div class="screen">'
    + '<div class="winner-card">'
    +   '<p class="winner-eyebrow">Gagnant</p>'
    +   '<p class="winner-name">' + esc(winner.name) + '</p>'
    +   '<p class="winner-pts">' + winner.score + ' points</p>'
    + '</div>'
    + '<h2 style="margin-bottom:16px">Classement final</h2>'
    + '<div class="board">' + rows + '</div>'
    + '<div class="spacer"></div>'
    + '<button class="btn btn-ghost" onclick="resetGame()">Nouvelle partie</button>'
    + '</div>';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
render();
