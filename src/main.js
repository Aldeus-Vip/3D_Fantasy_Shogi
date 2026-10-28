import { Game } from './shogi/game.js';
import { toKIF } from './shogi/kif.js';
import { SENTE } from './shogi/constants.js';
import { MODEL_SETS, SET_IDS } from './sets/index.js';
import { BoardView } from './view/boardView.js';
import { preloadSet } from './view/pieceFactory.js';
import { Clock } from './game/clock.js';
import { Sound } from './audio/sound.js';
import { t, setLang, getLang } from './ui/i18n.js';

const $ = (sel) => document.querySelector(sel);

// ---------- 設定(ブラウザに保存) ----------
const SETTINGS_KEY = 'fantasy-shogi-settings';
const settings = {
  effects: 'full', labels: true, sfx: 0.35, bgm: 0.12, lang: 'ja', set0: 'dragon', set1: 'undead',
  timeMode: 'none', mainMinutes: 10, byoyomi: 30,
};
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
} catch { /* 保存領域が使えなくても既定値で動く */ }
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 無視 */ }
}

// ---------- 状態 ----------
const view = new BoardView($('#stage'));
const sound = new Sound();
sound.setSfxVolume(settings.sfx);
sound.setBgmVolume(settings.bgm);
view.setShowLabels(settings.labels);

let game = new Game();
let clock = new Clock();
let selection = null; // { kind: 'square', x, y } | { kind: 'hand', type }
let busy = false;
let viewOwner = SENTE;
let startedAt = new Date();

// ---------- ダイアログ ----------
function ask(dialog) {
  return new Promise((resolve) => {
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
    dialog.showModal();
  });
}

async function confirmBox(message) {
  const d = $('#confirmDialog');
  d.querySelector('.message').textContent = message;
  return (await ask(d)) === 'ok';
}

function banner(text, color = '#ff2020') {
  const b = $('#banner');
  b.textContent = text;
  b.style.textShadow = `0 0 18px ${color}, 0 0 4px #000`;
  b.classList.remove('show');
  void b.offsetWidth; // アニメーションを再始動
  b.classList.add('show');
}

const sideName = (owner) => t(owner === SENTE ? 'sente' : 'gote');

// ---------- 対局 ----------
async function newGame() {
  busy = true;
  await Promise.all([preloadSet(settings.set0), preloadSet(settings.set1)]);
  clock.stop();
  game = new Game();
  clock = new Clock({ mode: settings.timeMode, mainSeconds: settings.mainMinutes * 60, byoyomi: settings.byoyomi });
  clock.onTimeout = (owner) => {
    if (game.result) return;
    game.timeout(owner);
    endGame();
  };
  view.setIds = [settings.set0, settings.set1];
  view.sync(game.position);
  selection = null;
  startedAt = new Date();
  busy = false;
  clock.start(game.turn);
  refresh();
}

function legalForSelection() {
  if (!selection) return [];
  return game.legalMoves().filter((m) => (selection.kind === 'hand'
    ? m.drop && m.piece === selection.type
    : !m.drop && m.from[0] === selection.x && m.from[1] === selection.y));
}

function refresh() {
  const pos = game.position;
  const last = game.lastMove;
  const targets = [...new Map(legalForSelection().map((m) => [m.to.join(), m.to])).values()];
  view.setHighlights({
    selected: selection?.kind === 'square' ? [selection.x, selection.y] : null,
    handSelected: selection?.kind === 'hand' ? { owner: pos.turn, type: selection.type } : null,
    targets,
    last: last ? [last.from, last.to].filter(Boolean) : [],
    check: pos.isInCheck(pos.turn) ? pos.findKing(pos.turn) : null,
  });
  refreshHud();
}

function refreshHud() {
  for (const owner of [0, 1]) {
    const el = $(`#player${owner}`);
    el.classList.toggle('active', !game.result && game.turn === owner);
    el.querySelector('.set-name').textContent = MODEL_SETS[view.setIds[owner]].name[getLang()];
    el.querySelector('.clock').textContent = clock.display(owner, t('byoyomiLabel'));
  }
  $('#turn').textContent = game.result ? '' : t('turn', { side: sideName(game.turn) });
  $('[data-action="undo"]').disabled = busy || game.records.length === 0;
  for (const a of ['resign', 'declare']) $(`[data-action="${a}"]`).disabled = busy || !!game.result;
}

async function handleClick(pick) {
  sound.ensure();
  if (busy || game.result || !pick) return;
  const pos = game.position;
  const me = pos.turn;

  if (pick.kind === 'hand') {
    const same = selection?.kind === 'hand' && selection.type === pick.type;
    selection = pick.owner === me && pos.hands[me][pick.type] && !same ? { kind: 'hand', type: pick.type } : null;
    refresh();
    return;
  }

  const { x, y } = pick;
  const candidates = legalForSelection().filter((m) => m.to[0] === x && m.to[1] === y);
  if (candidates.length) {
    let move = candidates[0];
    if (candidates.length > 1) {
      const answer = await ask($('#promoteDialog'));
      if (!answer) return;
      move = candidates.find((m) => m.promote === (answer === 'yes'));
    }
    await play(move);
    return;
  }

  const p = pos.get(x, y);
  const same = selection?.kind === 'square' && selection.x === x && selection.y === y;
  selection = p && p.owner === me && !same ? { kind: 'square', x, y } : null;
  refresh();
}

async function play(move) {
  busy = true;
  selection = null;
  const seconds = clock.stop();
  const record = game.play(move, seconds);
  if (!record) {
    busy = false;
    refresh();
    return;
  }
  refresh();
  $('#skip').hidden = settings.effects === 'none';

  if (record.move.drop) sound.summon();
  if (record.move.captured) setTimeout(() => sound.capture(), settings.effects === 'full' ? 350 : 0);
  await view.playMove(record, settings.effects);
  sound.move();
  if (record.move.promote) sound.promote();

  if (record.givesCheck && !game.result) {
    sound.check();
    banner(t('check'));
    await view.playCheck(game.position.findKing(game.turn), settings.effects);
  }
  view.animator.endSkip();
  $('#skip').hidden = true;
  busy = false;
  if (game.result) endGame();
  else clock.start(game.turn);
  refresh();
}

async function endGame() {
  clock.stop();
  refresh();
  const { winner, reason } = game.result;
  const headline = winner === null ? t('draw') : t('winner', { side: sideName(winner) });
  sound.end();
  banner(headline, '#f2c94c');
  await new Promise((r) => setTimeout(r, 900));
  const d = $('#resultDialog');
  d.querySelector('.headline').textContent = headline;
  d.querySelector('.reason').textContent = t(`reason_${reason}`);
  const answer = await ask(d);
  if (answer === 'kif') saveKif();
  if (answer === 'new') openNewGame();
}

function saveKif() {
  const name = (o) => `${sideName(o)}(${MODEL_SETS[view.setIds[o]].name[getLang()]})`;
  const text = toKIF(game, { senteName: name(0), goteName: name(1), startedAt });
  const blob = new Blob(['﻿', text], { type: 'text/plain;charset=utf-8' });
  const d = startedAt;
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fantasy_shogi_${stamp}.kif`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function undo() {
  if (busy || !game.records.length) return;
  clock.stop();
  game.undo();
  selection = null;
  view.sync(game.position);
  clock.start(game.turn);
  refresh();
}

// ---------- 新規対局・設定ダイアログ ----------
function fillSetOptions(select, value) {
  select.innerHTML = '';
  for (const id of SET_IDS) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = MODEL_SETS[id].name[getLang()];
    select.appendChild(o);
  }
  select.value = value;
}

async function openNewGame() {
  const d = $('#newGameDialog');
  const f = d.querySelector('form');
  fillSetOptions(f.set0, settings.set0);
  fillSetOptions(f.set1, settings.set1);
  f.timeMode.value = settings.timeMode;
  f.mainMinutes.value = settings.mainMinutes;
  f.byoyomi.value = settings.byoyomi;
  if ((await ask(d)) !== 'start') return;
  Object.assign(settings, {
    set0: f.set0.value,
    set1: f.set1.value,
    timeMode: f.timeMode.value,
    mainMinutes: Math.max(0, Number(f.mainMinutes.value) || 0),
    byoyomi: Math.max(5, Number(f.byoyomi.value) || 30),
  });
  saveSettings();
  await newGame();
}

function openSettings() {
  const d = $('#settingsDialog');
  const f = d.querySelector('form');
  f.effects.value = settings.effects;
  f.labels.checked = settings.labels;
  f.sfx.value = settings.sfx;
  f.bgm.value = settings.bgm;
  f.lang.value = settings.lang;
  d.showModal();
}

function bindSettings() {
  const f = $('#settingsDialog form');
  f.addEventListener('input', () => {
    settings.effects = f.effects.value;
    settings.labels = f.labels.checked;
    settings.sfx = Number(f.sfx.value);
    settings.bgm = Number(f.bgm.value);
    if (settings.lang !== f.lang.value) {
      settings.lang = f.lang.value;
      setLang(settings.lang);
    }
    view.setShowLabels(settings.labels);
    sound.ensure();
    sound.setSfxVolume(settings.sfx);
    sound.setBgmVolume(settings.bgm);
    saveSettings();
    refreshHud();
  });
}

// ---------- 入力 ----------
function bindInput() {
  const canvas = view.renderer.domElement;
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    // ドラッグ(視点回転)はクリック扱いしない
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) handleClick(view.pick(e));
    down = null;
  });

  const actions = {
    newGame: openNewGame,
    undo,
    resign: async () => {
      if (busy || game.result) return;
      if (!(await confirmBox(t('confirmResign', { side: sideName(game.turn) })))) return;
      game.resign();
      endGame();
    },
    declare: async () => {
      if (busy || game.result) return;
      if (!(await confirmBox(t('confirmDeclare', { side: sideName(game.turn) })))) return;
      game.declareWin();
      endGame();
    },
    saveKif,
    flip: () => {
      viewOwner = 1 - viewOwner;
      view.flipCamera(viewOwner);
    },
    settings: openSettings,
  };
  document.querySelectorAll('#toolbar [data-action]').forEach((b) => {
    b.addEventListener('click', () => {
      sound.ensure();
      actions[b.dataset.action]();
    });
  });
  $('#skip').addEventListener('click', () => view.animator.skip());
  $('#fast').addEventListener('change', (e) => { view.animator.speed = e.target.checked ? 2.5 : 1; });
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' && busy) view.animator.skip();
  });
}

// ---------- 起動 ----------
setLang(settings.lang);
bindSettings();
bindInput();
setInterval(() => {
  clock.tick();
  refreshHud();
}, 200);
newGame();

// 動作確認用のフック(ブラウザのコンソールや自動テストから使う)
window.__shogi = { view, handleClick, getGame: () => game, isBusy: () => busy };
