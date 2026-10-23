const state = {
  cards: [], deck: 'all', reviewOnly: false, order: [], index: 0,
  flipped: false, mastered: new Set(), search: '', indexOpen: false
};
const $ = (id) => document.getElementById(id);
const labels = { idiom: '成語', word: '古今異義' };
const progressImport = new URLSearchParams(location.hash.slice(1)).get('progress');

try {
  const saved = JSON.parse(localStorage.getItem('wenyan-mastered') || '[]');
  if (Array.isArray(saved)) state.mastered = new Set(saved.filter((value) => typeof value === 'string'));
} catch { /* Studying still works when local storage is unavailable. */ }

function save() {
  try { localStorage.setItem('wenyan-mastered', JSON.stringify([...state.mastered])); } catch { /* private browsing */ }
}
function deckCards() { return state.cards.filter((card) => state.deck === 'all' || card.kind === state.deck); }
function currentCard() { return state.cards.find((card) => card.id === state.order[state.index]); }
function resetFlipForNewCard() {
  const surface = $('flashcard');
  surface.classList.add('no-flip-transition');
  requestAnimationFrame(() => requestAnimationFrame(() => surface.classList.remove('no-flip-transition')));
}
function rebuildOrder(preserveId = null) {
  resetFlipForNewCard();
  state.order = deckCards().filter((card) => !state.reviewOnly || !state.mastered.has(card.id)).map((card) => card.id);
  state.index = Math.max(0, state.order.indexOf(preserveId));
  state.flipped = false;
  render();
}

function render() {
  const scoped = deckCards();
  $('mastered-count').textContent = `${scoped.filter((card) => state.mastered.has(card.id)).length} / ${scoped.length}`;
  document.querySelectorAll('.deck-tab').forEach((button) => {
    const active = button.dataset.deck === state.deck;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const card = currentCard();
  $('study-ui').classList.toggle('is-hidden', !card);
  $('study-empty').classList.toggle('is-hidden', !!card);
  if (card) {
    const idiom = card.kind === 'idiom';
    const surface = $('flashcard');
    surface.classList.toggle('is-idiom', idiom);
    surface.classList.toggle('is-word', !idiom);
    surface.classList.toggle('is-long', idiom && card.meaning.length > 61);
    surface.classList.toggle('is-long-answer', !idiom && card.meaning.length > 17);
    surface.classList.toggle('is-flipped', state.flipped);
    surface.setAttribute('aria-pressed', String(state.flipped));
    surface.setAttribute('aria-label', state.flipped ? '重看題目' : '顯示答案');
    surface.querySelector('.card-front').setAttribute('aria-hidden', String(state.flipped));
    surface.querySelector('.card-back').setAttribute('aria-hidden', String(!state.flipped));

    $('front-label').textContent = idiom ? '看解釋，想成語' : '說出古義';
    $('front-number').textContent = card.number;
    $('front-content').textContent = idiom ? card.meaning : card.term;
    $('back-label').textContent = idiom ? '成語答案' : `${card.term}的古義`;
    $('back-number').textContent = card.number;
    $('answer-main').textContent = idiom ? card.term : card.meaning;
    $('answer-support').textContent = idiom ? '' : card.example || '';
    $('answer-support').classList.toggle('is-hidden', idiom || !card.example);
    $('answer-reference').textContent = idiom ? '' : card.reference || '';
    $('answer-reference').classList.toggle('is-hidden', idiom || !card.reference);
    $('card-position').textContent = `${String(state.index + 1).padStart(2, '0')} / ${String(state.order.length).padStart(2, '0')}`;
    $('reveal-btn').classList.toggle('is-hidden', state.flipped);
    $('grade-actions').classList.toggle('is-hidden', !state.flipped);
  }
  if (state.indexOpen) renderIndex();
}

function renderIndex() {
  const q = state.search.trim().toLocaleLowerCase();
  const shown = deckCards().filter((card) => !q || `${card.term} ${card.meaning}`.toLocaleLowerCase().includes(q));
  $('index-count').textContent = String(shown.length);
  $('index-empty').classList.toggle('is-hidden', shown.length > 0);
  const list = $('card-list');
  list.replaceChildren(...shown.map((card) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `index-card${currentCard()?.id === card.id ? ' is-current' : ''}`;
    button.setAttribute('aria-label', `${labels[card.kind]} ${card.number}：${card.term}${state.mastered.has(card.id) ? '，已記住' : ''}`);
    const main = document.createElement('span'); main.className = 'index-card-main';
    const number = document.createElement('span'); number.className = 'index-card-number'; number.textContent = String(card.number).padStart(2, '0');
    const term = document.createElement('span'); term.className = 'index-card-term'; term.textContent = card.term;
    const status = document.createElement('span'); status.className = 'index-card-status'; status.textContent = state.mastered.has(card.id) ? '✓' : '';
    main.append(number, term); button.append(main, status);
    button.addEventListener('click', () => {
      if (state.reviewOnly && state.mastered.has(card.id)) { $('review-only').checked = false; state.reviewOnly = false; }
      rebuildOrder(card.id);
      closeIndex(false);
      $('flashcard').focus({ preventScroll: true });
    });
    return button;
  }));
}

function openIndex() {
  state.indexOpen = true;
  $('index-overlay').classList.remove('is-hidden');
  $('index-open').setAttribute('aria-expanded', 'true');
  document.body.classList.add('dialog-open');
  renderIndex();
  $('search').focus();
}
function closeIndex(returnFocus = true) {
  state.indexOpen = false;
  $('index-overlay').classList.add('is-hidden');
  $('index-open').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('dialog-open');
  if (returnFocus) $('index-open').focus();
}
function flip() {
  if (!currentCard()) return;
  state.flipped = !state.flipped;
  render();
}
function move(delta) {
  if (!state.order.length) return;
  resetFlipForNewCard();
  state.index = (state.index + delta + state.order.length) % state.order.length;
  state.flipped = false;
  render();
}
function rate(known) {
  if (!state.flipped) return;
  const card = currentCard();
  if (!card) return;
  if (known) state.mastered.add(card.id); else state.mastered.delete(card.id);
  save();
  if (state.reviewOnly && known) {
    const nextId = state.order[state.index + 1] || state.order[0];
    rebuildOrder(nextId === card.id ? null : nextId);
  } else move(1);
}

document.querySelectorAll('.deck-tab').forEach((button) => button.addEventListener('click', () => { state.deck = button.dataset.deck; rebuildOrder(); }));
$('review-only').addEventListener('change', (event) => { state.reviewOnly = event.target.checked; rebuildOrder(currentCard()?.id); });
$('show-all-btn').addEventListener('click', () => { $('review-only').checked = false; state.reviewOnly = false; rebuildOrder(); });
$('shuffle-btn').addEventListener('click', () => {
  resetFlipForNewCard();
  for (let i = state.order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [state.order[i], state.order[j]] = [state.order[j], state.order[i]]; }
  state.index = 0; state.flipped = false; render();
});
$('flashcard').addEventListener('click', flip);
$('reveal-btn').addEventListener('click', flip);
$('prev-btn').addEventListener('click', () => move(-1));
$('next-btn').addEventListener('click', () => move(1));
$('again-btn').addEventListener('click', () => rate(false));
$('known-btn').addEventListener('click', () => rate(true));
$('index-open').addEventListener('click', openIndex);
$('index-close').addEventListener('click', () => closeIndex());
$('index-scrim').addEventListener('click', () => closeIndex());
$('search').addEventListener('input', (event) => { state.search = event.target.value; renderIndex(); });
document.addEventListener('keydown', (event) => {
  if (state.indexOpen) {
    if (event.key === 'Escape') { event.preventDefault(); closeIndex(); }
    return;
  }
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (event.code === 'Space' && (document.activeElement === document.body || document.activeElement === $('flashcard'))) { event.preventDefault(); flip(); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
  else if (event.key === '1') rate(false);
  else if (event.key === '2') rate(true);
});

fetch('cards.json').then((response) => { if (!response.ok) throw new Error('cards'); return response.json(); }).then((cards) => {
  if (!Array.isArray(cards) || cards.length !== 79) throw new Error('card count');
  state.cards = cards;
  if (progressImport) {
    const validIds = new Set(cards.map((card) => card.id));
    progressImport.split(',').filter((id) => validIds.has(id)).forEach((id) => state.mastered.add(id));
    save();
    history.replaceState(null, '', location.pathname + location.search);
  }
  $('study-loading').classList.add('is-hidden');
  rebuildOrder();
}).catch(() => { $('study-loading').classList.add('is-hidden'); $('study-error').classList.remove('is-hidden'); });
