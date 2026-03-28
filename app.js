'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

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

let setupState = {
  numPlayers: 4,
  numRounds:  5,
  names: [],
};

let game = null;

// ─── Setup helpers ───────────────────────────────────────────────────────────

function saveSetupNames() {
  for (let i = 0; i < setupState.numPlayers; i++) {
    const el = document.getElementById('pname-' + i);
    if (el) setupState.names[i] = el.value.trim();
  }
}

function onPlayersChange(v) {
  saveSetupNames();
  setupState.numPlayers = +v;
  const val = document.getElementById('playersVal');
  if (val) val.textContent = v;
  const container = document.getElementById('playerNames');
  if (container) {
    container.innerHTML = buildNameInputs(+v);
    for (let i = 0; i < +v; i++) {
      const el = document.getElementById('pname-' + i);
      if (el && setupState.names[i]) el.value = setupState.names[i];
    }
  }
}

function onRoundsChange(v) {
  setupState.numRounds = +v;
  const val = document.getElementById('roundsVal');
  if (val) val.textContent = v;
}

function buildNameInputs(n) {
  return Array.from({ length: n }, function(_, i) {
    return '<div class="player-name-input">'
      + '<div class="player-number">' + (i + 1) + '</div>'
      + '<input type="text" id="pname-' + i + '" placeholder="Joueur ' + (i + 1) + '" '
      + 'maxlength="20" autocomplete="off" autocorrect="off" autocapitalize="words">'
      + '</div>';
  }).join('');
}

function startGame() {
  saveSetupNames();
  const names = [];
  for (let i = 0; i < setupState.numPlayers; i++) {
    const n = (setupState.names[i] || '').trim();
    names.push(n.length > 0 ? n : 'Joueur ' + (i + 1));
  }

  game = {
    players:               names.map(function(name) { return { name: name, score: 0 }; }),
    totalRounds:           setupState.numRounds,
    currentRound:          1,
    question:              '',
    answers:               [],   // [{playerIndex, text}] shuffled after collection
    votes:                 {},   // votes[answerIdx][playerIdx] = guessedPlayerIdx
    phase:                 PHASE.QUESTION,
    currentAnswerPlayerIdx: 0,
    currentAnswerIdx:      0,
    currentVoterPos:       0,    // position within eligible voters array
    usedQuestions:         new Set(),
    selectedVote:          null,
    roundDeltas:           [],
  };

  pickQuestion();
  render();
}

// ─── Game flow ───────────────────────────────────────────────────────────────

function pickQuestion() {
  const available = QUESTIONS
    .map(function(q, i) { return { q: q, i: i }; })
    .filter(function(item) { return !game.usedQuestions.has(item.i); });

  const pool = available.length > 0 ? available : QUESTIONS.map(function(q, i) { return { q: q, i: i }; });
  const pick = pool[Math.floor(Math.random() * pool.length)];
  game.usedQuestions.add(pick.i);
  game.question = pick.q;
}

function startAnswers() {
  game.phase = PHASE.ANSWER_TURN;
  game.currentAnswerPlayerIdx = 0;
  game.answers = [];
  render();
}

function submitAnswer() {
  const input = document.getElementById('answerInput');
  const text  = input ? input.value.trim() : '';

  if (!text) {
    if (input) {
      input.classList.add('error');
      input.placeholder = 'Tu dois entrer une reponse !';
      input.focus();
    }
    return;
  }

  game.answers.push({ playerIndex: game.currentAnswerPlayerIdx, text: text });
  game.currentAnswerPlayerIdx++;

  if (game.currentAnswerPlayerIdx >= game.players.length) {
    shuffleArray(game.answers);
    game.phase            = PHASE.VOTE_COLLECT;
    game.currentAnswerIdx = 0;
    game.currentVoterPos  = 0;
    game.votes            = {};
  }

  render();
}

function selectVote(playerIdx) {
  game.selectedVote = playerIdx;

  document.querySelectorAll('.vote-btn').forEach(function(btn) {
    btn.classList.remove('selected');
  });
  const btn = document.getElementById('vote-btn-' + playerIdx);
  if (btn) btn.classList.add('selected');

  const confirm = document.getElementById('confirmVoteBtn');
  if (confirm) {
    confirm.removeAttribute('disabled');
  }
}

function confirmVote() {
  if (game.selectedVote === null) return;

  const answerIdx = game.currentAnswerIdx;
  const eligible  = getEligibleVoters(answerIdx);
  const voterIdx  = eligible[game.currentVoterPos];

  if (!game.votes[answerIdx]) game.votes[answerIdx] = {};
  game.votes[answerIdx][voterIdx] = game.selectedVote;

  game.selectedVote = null;
  game.currentVoterPos++;

  if (game.currentVoterPos >= eligible.length) {
    game.phase = PHASE.VOTE_REVEAL;
  }

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
  computeRoundScores();
  game.phase = PHASE.ROUND_RESULTS;
  render();
}

function computeRoundScores() {
  game.roundDeltas = game.players.map(function() { return 0; });

  game.answers.forEach(function(answer, answerIdx) {
    const authorIdx  = answer.playerIndex;
    const eligible   = getEligibleVoters(answerIdx);
    const answerVotes = game.votes[answerIdx] || {};

    eligible.forEach(function(voterIdx) {
      const guessedIdx = answerVotes[voterIdx];
      if (guessedIdx === authorIdx) {
        game.roundDeltas[voterIdx] += 1;
      } else {
        game.roundDeltas[authorIdx] += 2;
      }
    });
  });

  game.roundDeltas.forEach(function(delta, i) {
    game.players[i].score += delta;
  });
}

function nextRound() {
  game.currentRound++;
  game.answers               = [];
  game.votes                 = {};
  game.currentAnswerPlayerIdx = 0;
  game.currentAnswerIdx      = 0;
  game.currentVoterPos       = 0;
  game.roundDeltas           = [];
  pickQuestion();
  game.phase = PHASE.QUESTION;
  render();
}

function showFinalResults() {
  game.phase = PHASE.FINAL_RESULTS;
  render();
}

function resetGame() {
  game = null;
  render();
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function getEligibleVoters(answerIdx) {
  const authorIdx = game.answers[answerIdx].playerIndex;
  return game.players
    .map(function(_, i) { return i; })
    .filter(function(i) { return i !== authorIdx; });
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sortedPlayers() {
  return game.players
    .map(function(p, i) { return { name: p.name, score: p.score, idx: i }; })
    .sort(function(a, b) { return b.score - a.score; });
}

function rankLabel(rank) {
  if (rank === 0) return '<span style="color:#fbbf24;font-size:1.1rem">1</span>';
  if (rank === 1) return '<span style="color:#94a3b8;font-size:1.1rem">2</span>';
  if (rank === 2) return '<span style="color:#cd7c3a;font-size:1.1rem">3</span>';
  return '<span style="color:var(--text-muted)">' + (rank + 1) + '</span>';
}

function roundBadgeHTML(current, total) {
  return '<div class="round-badge-row"><span class="round-badge">Manche '
    + current + ' / ' + total + '</span></div>';
}

function progressDotsHTML(current, total) {
  let html = '<div class="progress-row">';
  for (let i = 0; i < total; i++) {
    const cls = i < current ? 'done' : i === current ? 'active' : '';
    html += '<div class="progress-dot ' + cls + '"></div>';
  }
  html += '</div>';
  return html;
}

// ─── Render dispatcher ───────────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  if (!app) return;

  if (!game) {
    renderSetup(app);
    return;
  }

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
  const n = setupState.numPlayers;
  const r = setupState.numRounds;

  app.innerHTML = '<div class="screen">'
    + '<div class="logo-block">'
    +   '<h1>Bluff & Co</h1>'
    +   '<p class="subtitle">Le jeu du bluff et de la deduction — qui va tromper qui ?</p>'
    + '</div>'

    + '<div class="slider-container">'
    +   '<div class="slider-label">'
    +     '<span>Nombre de joueurs</span>'
    +     '<span class="slider-value" id="playersVal">' + n + '</span>'
    +   '</div>'
    +   '<input type="range" min="2" max="20" value="' + n + '" '
    +     'oninput="onPlayersChange(this.value)">'
    + '</div>'

    + '<div class="slider-container">'
    +   '<div class="slider-label">'
    +     '<span>Nombre de manches</span>'
    +     '<span class="slider-value" id="roundsVal">' + r + '</span>'
    +   '</div>'
    +   '<input type="range" min="1" max="10" value="' + r + '" '
    +     'oninput="onRoundsChange(this.value)">'
    + '</div>'

    + '<p class="section-title">Prenoms des joueurs</p>'
    + '<div class="player-names" id="playerNames">'
    +   buildNameInputs(n)
    + '</div>'

    + '<div class="spacer"></div>'
    + '<button class="btn btn-primary" onclick="startGame()">Lancer la partie</button>'
    + '</div>';

  for (let i = 0; i < n; i++) {
    const el = document.getElementById('pname-' + i);
    if (el && setupState.names[i]) el.value = setupState.names[i];
  }
}

// ── Question screen ──

function renderQuestion(app) {
  app.innerHTML = '<div class="screen">'
    + roundBadgeHTML(game.currentRound, game.totalRounds)
    + '<div class="spacer"></div>'
    + '<p class="question-label">Question du tour</p>'
    + '<p class="question-text">' + esc(game.question) + '</p>'
    + '<div class="spacer"></div>'
    + '<p class="hint-text">Chaque joueur va repondre en secret.<br>Bluffez, trompez, survivez !</p>'
    + '<button class="btn btn-primary" onclick="startAnswers()">Commencer les reponses</button>'
    + '</div>';
}

// ── Answer turn screen ──

function renderAnswerTurn(app) {
  const { currentAnswerPlayerIdx, players, question, currentRound, totalRounds } = game;
  const player = players[currentAnswerPlayerIdx];

  app.innerHTML = '<div class="screen">'
    + roundBadgeHTML(currentRound, totalRounds)
    + progressDotsHTML(currentAnswerPlayerIdx, players.length)

    + '<div class="player-turn-card">'
    +   '<div class="player-turn-name">' + esc(player.name) + '</div>'
    +   '<div class="player-turn-subtitle">Tourne l\'ecran vers toi !</div>'
    + '</div>'

    + '<p class="answer-question-hint">"' + esc(question) + '"</p>'

    + '<textarea id="answerInput" placeholder="Ta reponse secrete..." '
    +   'autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false"></textarea>'

    + '<div class="spacer"></div>'

    + '<button class="btn btn-primary" onclick="submitAnswer()" style="margin-top:16px">'
    +   'Valider ma reponse'
    + '</button>'
    + '</div>';

  setTimeout(function() {
    const el = document.getElementById('answerInput');
    if (el) el.focus();
  }, 120);
}

// ── Vote collect screen ──

function renderVoteCollect(app) {
  const { currentAnswerIdx, currentVoterPos, players, answers, currentRound, totalRounds } = game;
  const answer   = answers[currentAnswerIdx];
  const eligible = getEligibleVoters(currentAnswerIdx);
  const voterIdx = eligible[currentVoterPos];
  const voter    = players[voterIdx];

  // Build vote buttons (exclude nobody — all players shown, author can be guessed)
  const voteButtons = players.map(function(p, i) {
    return '<button class="vote-btn" id="vote-btn-' + i + '" onclick="selectVote(' + i + ')">'
      + esc(p.name)
      + '</button>';
  }).join('');

  app.innerHTML = '<div class="screen">'
    + roundBadgeHTML(currentRound, totalRounds)
    + progressDotsHTML(currentAnswerIdx, answers.length)

    + '<div class="answer-card">'
    +   '<p class="answer-counter">Reponse ' + (currentAnswerIdx + 1) + ' / ' + answers.length + '</p>'
    +   '<p class="answer-text">' + esc(answer.text) + '</p>'
    + '</div>'

    + '<div class="player-turn-card" style="margin-bottom:16px">'
    +   '<div class="player-turn-name">' + esc(voter.name) + '</div>'
    +   '<div class="player-turn-subtitle">Qui a ecrit cette reponse ?</div>'
    + '</div>'

    + '<div class="vote-grid">' + voteButtons + '</div>'

    + '<div class="spacer"></div>'

    + '<button class="btn btn-primary" id="confirmVoteBtn" onclick="confirmVote()" disabled>'
    +   'Confirmer mon vote'
    + '</button>'
    + '</div>';
}

// ── Vote reveal screen ──

function renderVoteReveal(app) {
  const { currentAnswerIdx, answers, players, votes, currentRound, totalRounds } = game;
  const answer     = answers[currentAnswerIdx];
  const authorIdx  = answer.playerIndex;
  const author     = players[authorIdx];
  const eligible   = getEligibleVoters(currentAnswerIdx);
  const answerVotes = votes[currentAnswerIdx] || {};

  const results = eligible.map(function(voterIdx) {
    const guessedIdx = answerVotes[voterIdx];
    const correct    = (guessedIdx === authorIdx);
    return { voterIdx: voterIdx, guessedIdx: guessedIdx, correct: correct };
  });

  const fooled      = results.filter(function(r) { return !r.correct; }).length;
  const authorPts   = fooled * 2;

  const resultRows  = results.map(function(r) {
    const label  = r.correct ? 'Bonne reponse !' : 'Pensait a ' + esc(players[r.guessedIdx].name);
    const points = r.correct ? '+1 pt' : '0 pt';
    return '<div class="reveal-row ' + (r.correct ? 'correct' : 'wrong') + '">'
      + '<span>' + esc(players[r.voterIdx].name) + '</span>'
      + '<span style="display:flex;align-items:center;gap:8px">'
      +   '<span style="opacity:.7;font-size:.8rem">' + label + '</span>'
      +   '<span class="points">' + points + '</span>'
      + '</span>'
      + '</div>';
  }).join('');

  const isLast     = (currentAnswerIdx >= answers.length - 1);
  const nextAction = isLast
    ? 'onclick="endVoting()">Voir les scores'
    : 'onclick="nextAnswer()">Reponse suivante';

  app.innerHTML = '<div class="screen">'
    + roundBadgeHTML(currentRound, totalRounds)
    + progressDotsHTML(currentAnswerIdx, answers.length)

    + '<div class="answer-card">'
    +   '<p class="answer-counter">Reponse ' + (currentAnswerIdx + 1) + ' / ' + answers.length + '</p>'
    +   '<p class="answer-text">' + esc(answer.text) + '</p>'
    + '</div>'

    + '<div class="reveal-author-card">'
    +   '<p class="reveal-label">Ecrit par</p>'
    +   '<p class="reveal-author-name">' + esc(author.name) + '</p>'
    +   (authorPts > 0
          ? '<p class="reveal-author-points">' + fooled + ' personne(s) trompee(s) → +' + authorPts + ' pts</p>'
          : '<p class="reveal-author-points">Tout le monde a devine — 0 pt</p>')
    + '</div>'

    + '<div class="reveal-results">' + resultRows + '</div>'

    + '<div class="spacer"></div>'
    + '<button class="btn btn-primary" ' + nextAction + '</button>'
    + '</div>';
}

// ── Round results screen ──

function renderRoundResults(app) {
  const { currentRound, totalRounds, roundDeltas } = game;
  const sorted     = sortedPlayers();
  const isLastRound = (currentRound >= totalRounds);

  const items = sorted.map(function(p, rank) {
    const delta = roundDeltas[p.idx] || 0;
    return '<div class="leaderboard-item rank-' + (rank + 1) + '">'
      + '<div class="leaderboard-rank">' + rankLabel(rank) + '</div>'
      + '<div class="leaderboard-name">' + esc(p.name) + '</div>'
      + (delta > 0 ? '<div class="leaderboard-delta">+' + delta + '</div>' : '')
      + '<div class="leaderboard-score">' + p.score + ' pts</div>'
      + '</div>';
  }).join('');

  const nextAction = isLastRound
    ? 'onclick="showFinalResults()">Voir le resultat final'
    : 'onclick="nextRound()">Manche suivante';

  app.innerHTML = '<div class="screen">'
    + '<div style="margin-bottom:8px">'
    +   '<span class="round-badge">Manche ' + currentRound + ' / ' + totalRounds + '</span>'
    + '</div>'
    + '<h2 style="margin-bottom:22px">Scores</h2>'
    + '<div class="leaderboard">' + items + '</div>'
    + '<div class="spacer"></div>'
    + '<button class="btn btn-primary" ' + nextAction + '</button>'
    + '</div>';
}

// ── Final results screen ──

function renderFinalResults(app) {
  const sorted = sortedPlayers();
  const winner = sorted[0];

  const items = sorted.map(function(p, rank) {
    return '<div class="leaderboard-item rank-' + (rank + 1) + '">'
      + '<div class="leaderboard-rank">' + rankLabel(rank) + '</div>'
      + '<div class="leaderboard-name">' + esc(p.name) + '</div>'
      + '<div class="leaderboard-score">' + p.score + ' pts</div>'
      + '</div>';
  }).join('');

  app.innerHTML = '<div class="screen">'
    + '<div class="final-winner-card">'
    +   '<p class="winner-label">Gagnant</p>'
    +   '<p class="winner-name">' + esc(winner.name) + '</p>'
    +   '<p class="winner-score">' + winner.score + ' points</p>'
    + '</div>'
    + '<h2 style="margin-bottom:18px">Classement final</h2>'
    + '<div class="leaderboard">' + items + '</div>'
    + '<div class="spacer"></div>'
    + '<button class="btn btn-secondary" onclick="resetGame()">Nouvelle partie</button>'
    + '</div>';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

render();
