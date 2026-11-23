import React, { useRef, useReducer, useCallback, useState, useEffect, useContext, createContext } from 'react';
import { createPortal } from 'react-dom';
import { Game } from './game/Game.js';

// ═══════════════════════════════════════════════════════════════════════════
// Static data & pure helpers (UI only — nothing here mutates game state)
// ═══════════════════════════════════════════════════════════════════════════

const COLOR_LABEL = {
  yellow: 'Noble', blue: 'Religious', green: 'Trade', red: 'Military', purple: 'Unique', city: 'Unique'
};

// Extended characters and the classic character each one replaces.
const EXTENDED_CHARS = [
  { n: 1, name: 'Witch', pic: 'character11', replaces: 'Assassin' },
  { n: 2, name: 'Tax Collector', pic: 'character12', replaces: 'Thief' },
  { n: 3, name: 'Wizard', pic: 'character13', replaces: 'Magician' },
  { n: 4, name: 'Emperor', pic: 'character14', replaces: 'King' },
  { n: 5, name: 'Abbot', pic: 'character15', replaces: 'Bishop' },
  { n: 6, name: 'Alchemist', pic: 'character16', replaces: 'Merchant' },
  { n: 7, name: 'Navigator', pic: 'character17', replaces: 'Architect' },
  { n: 8, name: 'Diplomat', pic: 'character18', replaces: 'Warlord' }
];

const RULES_URL = 'https://images-cdn.fantasyflightgames.com/filer_public/f2/e7/f2e74a36-bed7-4a38-aff4-c2e968a1c369/citadels-rules-english.pdf';

// Card/character descriptions are "Name. Rules text." — split them apart.
function splitDesc(desc = '') {
  const i = desc.indexOf('. ');
  if (i < 0) return [desc.replace(/\.$/, ''), ''];
  return [desc.slice(0, i), desc.slice(i + 2)];
}

const districtName = card => splitDesc(card.desc)[0] || card.name;
const characterName = c => splitDesc(c.desc)[0] || c.name;

function districtInfo(card) {
  const [title, desc] = splitDesc(card.desc);
  return {
    sprite: card.name,
    title: title || card.name,
    meta: `Cost ${card.cost} · ${COLOR_LABEL[card.color] || 'District'}`,
    desc
  };
}

function characterInfo(c) {
  const [title, desc] = splitDesc(c.desc);
  return { sprite: c.pic_class, title: `${c.number}. ${title}`, meta: 'Character', desc };
}

// Mirrors the cost rule in Character.build() (Factory discounts purple districts).
const buildCost = (player, card) =>
  card.cost - (player.hasDistrict('factory') && card.color === 'purple' ? 1 : 0);

// Mirrors the duplicate rule in Character.build() (Quarry allows one duplicate).
const isDuplicate = (player, card) =>
  player.districts.filter(d => d.name === card.name).length > player.hasDistrict('quarry');

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const canHover = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(hover: hover)').matches
  : true;

// Mirrors the checks in Warlord.destroy() so impossible targets can be dimmed up front.
function warlordTarget(game, attacker, owner, d) {
  const cost = d.cost + owner.hasDistrict('greatwall') - (d.name === 'greatwall' ? 1 : 0) - 1;
  if (owner.closed) return { ok: false, why: 'City complete' };
  if (d.name === 'keep') return { ok: false, why: 'Indestructible' };
  const bishop = game.characters.content.find(c => c.name === 'Bishop');
  if (bishop && bishop.state !== 'assassinated' && bishop.handle_player === owner) {
    return { ok: false, why: 'Bishop protects' };
  }
  if (cost > attacker.coins) return { ok: false, why: `Costs ${cost}`, cost };
  return { ok: true, cost };
}

// Mirrors the checks in Diplomat.swap() for the enemy-side district.
function diplomatTarget(swapper, owner, d) {
  if (owner.closed) return { ok: false, why: 'City complete' };
  if (d.name === 'keep') return { ok: false, why: "Can't be swapped" };
  const bishop = owner.characters.find(c => c.name === 'Bishop');
  if (bishop && bishop.state !== 'assassinated' && bishop.handle_player === owner) {
    return { ok: false, why: 'Bishop protects' };
  }
  const theirCost = d.cost + owner.hasDistrict('greatwall') - (d.name === 'greatwall' ? 1 : 0);
  const mine = swapper.districts.find(x => x.status === 'on_swap');
  if (mine) {
    if (theirCost > mine.cost + swapper.coins) return { ok: false, why: "Can't afford" };
    const pay = Math.max(0, theirCost - mine.cost);
    return { ok: true, label: pay ? `Swap · pay ${pay}` : 'Swap' };
  }
  return { ok: true, label: 'Swap' };
}

// Mirrors Player.score so the total can be explained line by line.
function scoreRows(p) {
  const rows = [['Districts', p.districts.reduce((s, d) => s + d.cost, 0)]];
  const fountain = p.hasDistrict('fountain');
  if (fountain) {
    const purple = p.districts.filter(d => d.color === 'purple' || d.color === 'city').length;
    rows.push(['Fountain of Wishes', fountain * (purple - fountain)]);
  }
  if (p.hasDistrict('treasury')) rows.push(['Imperial Treasury (gold)', p.coins]);
  if (p.hasDistrict('maproom')) rows.push(['Map Room (cards)', p.cards.length]);
  if (p.hasDistrict('museum')) rows.push(['Museum', p.cards_under_museum]);
  if (p.hasDistrict('dragongate')) rows.push(['Dragon Gate', 2]);
  if (p.hasDistrict('university')) rows.push(['University', 2]);
  if (p.hasAllColours) rows.push(['All 5 colours', 3]);
  if (p.closed) rows.push(['Complete city', 2]);
  if (p.closed_first) rows.push(['First to complete', 2]);
  return rows;
}

function scoreBadges(p) {
  const out = [];
  if (p.hasAllColours) out.push({ text: 'All 5 colours +3', tone: 'gold' });
  if (p.closed_first) out.push({ text: 'First complete +4', tone: 'gold' });
  else if (p.closed) out.push({ text: 'Complete +2', tone: 'gold' });
  if (p.hasMuseum && p.cards_under_museum > 0) out.push({ text: `Museum ×${p.cards_under_museum}`, tone: 'muted' });
  return out;
}

const graveyardPendingFor = (game, p) =>
  !!(p.hasGraveyard && game.deck.card_on_graveyard && p.coins > 0);

// Who is expected to act right now.
function turnState(game) {
  const p1 = game.player1;
  const p2 = game.player2;
  if (game.phazeIsEnd) return { human: false, robot: false };
  const humanPending = p1.on_coronation || graveyardPendingFor(game, p1);
  const robot = !humanPending && (p2.on_coronation || p2.on_graveyard ||
    (game.robotActivePlayer && game.automatic));
  const human = !robot && (game.youActivePlayer || humanPending);
  return { human, robot };
}

// ═══════════════════════════════════════════════════════════════════════════
// Event log — derived by diffing snapshots of game state between renders
// (every engine change is followed by a notifyUI/update re-render).
// ═══════════════════════════════════════════════════════════════════════════

let logSeq = 0;

const LOG_KEY = 'gameLog';

function loadLog() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOG_KEY));
    if (!Array.isArray(saved)) return [];
    // Continue numbering after the restored entries so React keys stay unique.
    logSeq = saved.reduce((m, e) => Math.max(m, e.id || 0), logSeq);
    return saved;
  } catch {
    return [];
  }
}

function takeSnapshot(game) {
  const s = { phase: game.phaze };
  if (!game.player1 || !game.characters) return s;
  s.p1 = game.player1;
  s.active = game.activePlayer;
  s.players = [game.player1, game.player2].map(p => ({
    p, coins: p.coins, cards: p.cards.length, districts: [...p.districts],
    crown: p.has_crown, toClose: p.districts_to_close, closed: p.closed
  }));
  s.chars = game.characters.content.map(c => ({ c, state: c.state, status: c.status, owner: c.player }));
  s.cc = game.currentCharacter;
  s.ccHandle = game.currentCharacter ? game.currentCharacter.handle_player : null;
  return s;
}

function describeChanges(prev, cur, game) {
  const out = [];
  if (!prev || !prev.players || !cur.players || prev.p1 !== cur.p1) return out;
  const p1 = game.player1;
  const who = p => (p === p1 ? 'You' : p.name);
  const whose = p => (p === p1 ? 'your' : `${p.name}’s`);
  const actor = prev.phase === 'action' ? prev.ccHandle : prev.active;

  const res = new Map(cur.players.map(cp => [cp.p, []]));   // gold / cards
  const acts = new Map(cur.players.map(cp => [cp.p, []]));  // everything else
  const act = (p, t) => { if (p && acts.has(p)) acts.get(p).push(t); };

  // Character picks, discards and ability targets
  prev.chars.forEach((pc, i) => {
    const nc = cur.chars[i];
    const nm = characterName(pc.c);
    if (pc.status === 'in_round' && nc.status === 'in_hand' && nc.owner) {
      act(nc.owner, nc.owner === p1 ? `picked the ${nm}` : 'picked a character');
    }
    if (prev.phase === 'discard' && pc.status === 'in_round' && nc.status === 'discarded' && prev.active) {
      act(prev.active, prev.active === p1 ? `discarded the ${nm} face-down` : 'discarded a character face-down');
    }
    if (pc.state === 'normal' && nc.state !== 'normal' && actor) {
      const verb = { assassinated: 'assassinated', robbed: 'chose to rob', bewitched: 'bewitched' }[nc.state];
      if (verb) act(actor, `${verb} the ${nm}`);
    }
  });

  // Districts, gold, cards, crown
  const prevOwner = new Map();
  prev.players.forEach(pp => pp.districts.forEach(d => prevOwner.set(d, pp.p)));
  const curOwner = new Map();
  cur.players.forEach(cp => cp.districts.forEach(d => curOwner.set(d, cp.p)));

  cur.players.forEach((cp, i) => {
    const pp = prev.players[i];
    const p = cp.p;
    const hadFactory = pp.districts.some(d => d.name === 'factory');
    let builtCost = 0;
    let builtCount = 0;
    cp.districts.forEach(d => {
      if (pp.districts.includes(d)) return;
      const from = prevOwner.get(d);
      if (from && from !== p) act(p, `got ${districtName(d)} in a swap`);
      else {
        builtCount++;
        builtCost += d.cost - (hadFactory && d.color === 'purple' ? 1 : 0);
        act(p, `built ${districtName(d)}`);
      }
    });
    pp.districts.forEach(d => {
      if (curOwner.has(d)) return;
      if (d.name === 'armory' && p === actor) act(p, 'blew up the Powderhouse');
      else if (actor && actor !== p) act(actor, `destroyed ${whose(p)} ${districtName(d)}`);
      else act(p, `lost ${districtName(d)}`);
    });
    const gold = cp.coins - pp.coins + builtCost;
    if (gold) res.get(p).push(gold > 0 ? `+${gold} gold` : `−${-gold} gold`);
    const cards = cp.cards - pp.cards + builtCount;
    if (cards) res.get(p).push(cards > 0 ? `+${plural(cards, 'card')}` : `−${plural(-cards, 'card')}`);
    if (!pp.crown && cp.crown) act(p, 'took the crown');
    if (!pp.closed && cp.closed) act(p, p === p1 ? 'completed your city' : 'completed their city');
  });

  const order = actor ? [actor, ...cur.players.map(x => x.p).filter(p => p !== actor)] : cur.players.map(x => x.p);
  order.forEach(p => {
    const list = [...(res.get(p) || []), ...(acts.get(p) || [])];
    if (!list.length) return;
    const playing = prev.phase === 'action' && prev.cc && prev.ccHandle === p ? ` (${characterName(prev.cc)})` : '';
    out.push({ kind: p === p1 ? 'you' : 'robot', text: `${who(p)}${playing}: ${list.join(' · ')}` });
  });

  const was = prev.players[0].toClose;
  const now = cur.players[0].toClose;
  if (was !== now) {
    out.push({
      kind: 'call',
      text: now < was
        ? `The Bell Tower rang — the game now ends at ${now} districts`
        : `The Bell Tower fell — the game ends at ${now} districts again`
    });
  }

  // Characters called (including ones skipped in the same step)
  if (prev.phase === 'action' || cur.phase === 'action') {
    const prevNum = prev.phase === 'action' && prev.cc ? prev.cc.number : 0;
    const inAction = cur.phase === 'action' && cur.cc;
    const curNum = inAction ? cur.cc.number : 9;
    if (curNum !== prevNum) {
      for (let n = prevNum + 1; n < curNum && n <= 8; n++) {
        const pc = prev.chars.find(x => x.c.number === n);
        if (!pc) continue;
        const nm = characterName(pc.c);
        if (pc.status === 'discarded' || !pc.owner) out.push({ kind: 'call', text: `${n}. ${nm} — not in play` });
        else if (pc.state === 'assassinated') out.push({ kind: 'call', text: `${n}. ${nm} (${who(pc.owner)}) — assassinated, turn lost` });
        else out.push({ kind: 'call', text: `${n}. ${nm} (${who(pc.owner)}) — turn over` });
      }
      if (inAction) {
        const c = cur.cc;
        const owner = c.player;
        let text = `${c.number}. ${characterName(c)} is called — ${owner ? (owner === p1 ? 'your turn' : `${owner.name}’s turn`) : 'not in play'}`;
        if (c.state === 'robbed') text += ' · the Thief takes their gold';
        if (c.state === 'bewitched') text += ' · bewitched';
        out.push({ kind: 'call', text });
      }
    }
  }

  if (prev.phase === 'action' && cur.phase === 'choose') {
    const crown = cur.players.find(x => x.crown);
    out.push({ kind: 'round', text: `New round — ${crown ? (crown.p === p1 ? 'you hold' : `${crown.p.name} holds`) : 'nobody holds'} the crown` });
  }
  if (prev.phase !== 'end' && cur.phase === 'end') {
    out.push({
      kind: 'round',
      text: game.winner.includes(',') ? 'Game over — it’s a draw'
        : `Game over — ${game.winner === p1.name ? 'you win' : `${game.winner} wins`}`
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Icons — inline SVG (the sprite-sheet versions have opaque white mattes)
// ═══════════════════════════════════════════════════════════════════════════

function CoinIcon() {
  return (
    <svg className="icon icon-coin" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <circle className="coin-rim" cx="18" cy="18" r="15" />
      <circle className="coin-face" cx="18" cy="18" r="11.5" />
      <path className="coin-mark" d="M18 10.5l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z" />
    </svg>
  );
}

function CrownIcon({ className = '' }) {
  return (
    <svg className={`icon icon-crown ${className}`.trim()} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <path d="M5 26 3.5 12l8 6.5L18 8l6.5 10.5 8-6.5L31 26z" />
      <rect x="5" y="27.5" width="26" height="4" rx="1.2" />
      <circle cx="3.5" cy="10.5" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="32.5" cy="10.5" r="2.2" />
    </svg>
  );
}

function CardsIcon() {
  return (
    <svg className="icon icon-cards" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <rect className="cards-back" x="6" y="5" width="17" height="24" rx="2.5" transform="rotate(-12 14.5 17)" />
      <rect className="cards-front" x="13" y="7" width="17" height="24" rx="2.5" />
      <path className="cards-mark" d="M21.5 13.5l3.2 5.5-3.2 5.5-3.2-5.5z" />
    </svg>
  );
}

function DistrictsIcon() {
  return (
    <svg className="icon icon-districts" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <rect x="4" y="30" width="28" height="3" />
      <rect x="6" y="16" width="6" height="14" />
      <polygon points="6,16 9,11 12,16" />
      <rect x="15" y="10" width="6" height="20" />
      <polygon points="15,10 18,4 21,10" />
      <rect x="24" y="16" width="6" height="14" />
      <polygon points="24,16 27,11 30,16" />
    </svg>
  );
}

function Dots() {
  return <span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tooltip — portaled to <body> so scrolling card rows can't clip it. The
// position is a one-time snapshot; any scroll/resize just dismisses it.
// ═══════════════════════════════════════════════════════════════════════════

function Tooltip({ text, className = '', children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!pos) return;
    const hide = () => setPos(null);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [pos]);

  const show = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const half = 120;
    const left = Math.min(Math.max(rect.left + rect.width / 2, half + 4), window.innerWidth - half - 4);
    const below = rect.top < 170;
    setPos({ left, top: below ? rect.bottom + 10 : rect.top - 10, below });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      className={`tooltip ${className}`.trim()}
      onMouseEnter={text ? show : undefined}
      onMouseLeave={text ? hide : undefined}
      onFocus={text ? show : undefined}
      onBlur={text ? hide : undefined}
    >
      {children}
      {text && pos && createPortal(
        <div
          className={`tooltiptext${pos.below ? ' tooltip-below' : ''}`}
          style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
          role="tooltip"
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  );
}

function CardTip({ info }) {
  return (
    <>
      <strong className="tip-title">{info.title}</strong>
      <span className="tip-meta">{info.meta}</span>
      {info.desc && <span className="tip-desc">{info.desc}</span>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Cards
// ═══════════════════════════════════════════════════════════════════════════

const ViewerContext = createContext(() => {});

// A sprite cell rendered at any size: the sprite math is calibrated for a
// 180×240 box, so the sprite stays at that size and is scaled down with a
// transform; the outer box takes the scaled size (via --s, set per size class).
function CardFace({ sprite, back = false }) {
  if (back) {
    return (
      <span className="cardface cardback" aria-hidden="true">
        <svg viewBox="0 0 60 80" focusable="false">
          <rect x="5" y="5" width="50" height="70" rx="5" className="cb-frame" />
          <path d="M30 22l9 18-9 18-9-18z" className="cb-gem" />
          <circle cx="30" cy="40" r="3.5" className="cb-dot" />
        </svg>
      </span>
    );
  }
  return (
    <span className="cardface" aria-hidden="true">
      <span className={`sprite ${sprite}`} />
    </span>
  );
}

// Every card is a real <button>. Primary click = onClick (or open the large
// view when the card has no action). Long-press / right-click = large view.
function Card({
  info, back = false, size = 'md', onClick, disabled = false, onDisabledClick,
  variant = '', badge, note, selected, toggle = false, current = false, isNew = false, label
}) {
  const openViewer = useContext(ViewerContext);
  const timer = useRef(null);
  const longFired = useRef(false);
  const start = useRef(null);

  const clear = () => { clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);

  const inspect = () => { if (!back && info) openViewer(info); };

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    longFired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clear();
    timer.current = setTimeout(() => { longFired.current = true; timer.current = null; inspect(); }, 450);
  };
  const onPointerMove = (e) => {
    if (!timer.current || !start.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
  };
  const onContextMenu = (e) => { e.preventDefault(); inspect(); };

  const handleClick = () => {
    if (longFired.current) { longFired.current = false; return; }
    if (disabled) { if (onDisabledClick) onDisabledClick(); return; }
    if (onClick) onClick();
    else inspect();
  };

  const classes = [
    'card', `card-${size}`, variant,
    onClick && !disabled ? 'is-interactive' : '',
    disabled ? 'is-disabled' : '',
    selected ? 'is-selected' : '',
    current ? 'is-current' : '',
    isNew ? 'is-new' : ''
  ].filter(Boolean).join(' ');

  const tip = !back && info && canHover ? <CardTip info={info} /> : null;
  const ariaLabel = label || (back ? 'Hidden character' : info ? `${info.title}, ${info.meta}` : 'Card');

  return (
    <Tooltip text={tip} className="card-wrap">
      <button
        type="button"
        className={classes}
        aria-label={ariaLabel + (badge ? ` — ${badge.text}` : '')}
        aria-disabled={disabled || undefined}
        aria-pressed={toggle ? !!selected : undefined}
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={clear}
        onPointerCancel={clear}
        onPointerLeave={clear}
        onContextMenu={onContextMenu}
      >
        {note && <span className="card-note">{note}</span>}
        <CardFace sprite={info && info.sprite} back={back} />
        {badge && <span className={`card-badge badge-${badge.tone || 'muted'}`}>{badge.text}</span>}
        {(variant.includes('is-discard') || variant.includes('is-target')) && (
          <span className="card-mark" aria-hidden="true">{variant.includes('is-target') ? '⌖' : '✕'}</span>
        )}
      </button>
    </Tooltip>
  );
}

function CardViewer({ info, onClose }) {
  const closeRef = useRef(null);
  const openedAt = useRef(0);

  useEffect(() => {
    if (!info) return undefined;
    openedAt.current = Date.now();
    const prevFocus = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };
  }, [info]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!info) return null;
  const scale = Math.max(0.8, Math.min(1.8, (window.innerWidth - 48) / 180, (window.innerHeight - 280) / 240));
  // Ignore the click that ends the long-press which opened the viewer.
  const onBackdrop = () => { if (Date.now() - openedAt.current > 400) onClose(); };

  return createPortal(
    <div className="viewer-backdrop" onClick={onBackdrop}>
      <div className="viewer" role="dialog" aria-modal="true" aria-labelledby="viewer-title" onClick={e => e.stopPropagation()}>
        <span className="cardface viewer-face" style={{ '--s': scale }} aria-hidden="true">
          <span className={`sprite ${info.sprite}`} />
        </span>
        <div className="viewer-text">
          <h2 id="viewer-title">{info.title}</h2>
          <p className="viewer-meta">{info.meta}</p>
          {info.desc && <p className="viewer-desc">{info.desc}</p>}
        </div>
        <button ref={closeRef} type="button" className="btn-quiet" onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body
  );
}

// Remembers when each item first appeared, so newly built districts can glow.
function useNewTracker(items) {
  const ref = useRef(null);
  const now = Date.now();
  if (!ref.current) ref.current = new Map(items.map(i => [i, 0]));
  const seen = ref.current;
  items.forEach(i => { if (!seen.has(i)) seen.set(i, now); });
  for (const k of [...seen.keys()]) if (!items.includes(k)) seen.delete(k);
  return item => now - (seen.get(item) || 0) < 2500;
}

// ═══════════════════════════════════════════════════════════════════════════
// Player stats, score
// ═══════════════════════════════════════════════════════════════════════════

function Stat({ icon, value, suffix = '', label }) {
  const prev = useRef(value);
  const [pops, setPops] = useState([]);

  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (!d) return;
    const id = ++logSeq;
    setPops(p => [...p, { id, d }]);
    setTimeout(() => setPops(p => p.filter(x => x.id !== id)), 1500);
  }, [value]);

  return (
    <span className="stat" title={label}>
      {icon}
      <span className="stat-val">{value}{suffix && <small>{suffix}</small>}</span>
      <span className="sr-only">{label}</span>
      {pops.map(p => (
        <span key={p.id} className={`pop ${p.d > 0 ? 'pop-up' : 'pop-down'}`} aria-hidden="true">
          {p.d > 0 ? `+${p.d}` : `−${-p.d}`}
        </span>
      ))}
    </span>
  );
}

function ScoreChip({ player }) {
  const rows = scoreRows(player);
  const tip = (
    <span className="score-tip">
      <strong className="tip-title">Score breakdown</strong>
      {rows.map(([k, v]) => (
        <span className="score-row" key={k}><span>{k}</span><span>{v}</span></span>
      ))}
      <span className="score-row score-total"><span>Total</span><span>{player.score}</span></span>
    </span>
  );
  return (
    <Tooltip text={tip} className="score-wrap">
      <button
        type="button"
        className="score-chip"
        aria-label={`Score ${player.score}: ${rows.map(([k, v]) => `${k} ${v}`).join(', ')}`}
      >
        <span aria-hidden="true">★</span> {player.score}
      </button>
    </Tooltip>
  );
}

function PlayerStats({ player }) {
  return (
    <div className="stats">
      <Stat icon={<CoinIcon />} value={player.coins} label={`${player.coins} gold`} />
      <Stat icon={<CardsIcon />} value={player.cards.length} label={`${plural(player.cards.length, 'card')} in hand`} />
      <Stat
        icon={<DistrictsIcon />}
        value={player.districts.length}
        suffix={`/${player.districts_to_close}`}
        label={`${player.districts.length} of ${player.districts_to_close} districts built`}
      />
      <ScoreChip player={player} />
      {scoreBadges(player).map(b => (
        <span key={b.text} className={`badge badge-${b.tone}`}>{b.text}</span>
      ))}
    </div>
  );
}

function stateNote(c) {
  if (c.isAssassinated) return 'Assassinated';
  if (c.isRobbed) return 'Robbed';
  if (c.isBewitched) return 'Bewitched';
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Start screen
// ═══════════════════════════════════════════════════════════════════════════

function StartScreen({ game, onStart, onSetExtended, onRandomExtended, error,
  gameName, setGameName, yourName, setYourName, robotName, setRobotName,
  extendedChars, setExtendedChars }) {

  const selected = Object.values(extendedChars).filter(Boolean).length;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Only extended games use extended characters (toggles may still be set
    // from before switching back to Classic).
    const extended = game.is_extended
      ? Object.keys(extendedChars).filter(k => extendedChars[k]).map(Number)
      : [];
    onStart(gameName, yourName, robotName, extended);
  };

  return (
    <form onSubmit={handleSubmit} className="start-form">
      <div className="start-block">
        <CrownIcon className="start-crown" />
        <div className="start-subblock">
          <div className="start-head-block"><h2>2 players: You vs Robot</h2></div>
          <div className="input-grid">
            <label htmlFor="in_game">Game name</label>
            <input id="in_game" type="text" value={gameName} placeholder="New Game" onChange={e => setGameName(e.target.value)} />
            <label htmlFor="in_you">Your name</label>
            <input id="in_you" type="text" value={yourName} placeholder="Human" onChange={e => setYourName(e.target.value)} />
            <label htmlFor="in_robot">Robot name</label>
            <input id="in_robot" type="text" value={robotName} placeholder="Robot" onChange={e => setRobotName(e.target.value)} />
          </div>
          <fieldset className="game-type-block">
            <legend>Game type</legend>
            <div className="segmented">
              <input type="radio" value="classic" name="game_type" id="rb_classic"
                checked={!game.is_extended} onChange={() => onSetExtended(false)} />
              <label htmlFor="rb_classic">Classic</label>
              <input type="radio" value="extended" name="game_type" id="rb_extended"
                checked={!!game.is_extended} onChange={() => onSetExtended(true)} />
              <label htmlFor="rb_extended">Extended</label>
            </div>
          </fieldset>
          {game.is_extended && (
            <fieldset className="extended-block">
              <legend>Extended characters</legend>
              <div className="extended-head">
                <span className={`ext-counter${selected > 2 ? ' is-warn' : ''}${selected === 0 ? ' is-empty' : ''}`} aria-live="polite">
                  {selected === 0 ? 'Pick at least one'
                    : selected > 2 ? `${selected} selected — more than 2 makes the game unbalanced`
                      : `${selected} selected`}
                </span>
                <button type="button" className="btn-quiet btn-small" onClick={onRandomExtended}>Random</button>
              </div>
              <div className="ext-grid">
                {EXTENDED_CHARS.map(ch => (
                  <button
                    type="button"
                    key={ch.n}
                    className={`ext-toggle${extendedChars[ch.n] ? ' is-on' : ''}`}
                    aria-pressed={!!extendedChars[ch.n]}
                    aria-label={`${ch.name}, replaces ${ch.replaces}`}
                    onClick={() => setExtendedChars(prev => ({ ...prev, [ch.n]: !prev[ch.n] }))}
                  >
                    <span className="card-xs ext-face"><CardFace sprite={ch.pic} /></span>
                    <span className="ext-name">{ch.name}</span>
                    <span className="ext-swap">↔ {ch.replaces}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="start-button-block">
            <button type="submit" className="btn-primary btn-large">Start</button>
          </div>
          <div className="start-footer-block">
            <div className="game-version">Version {game.version}</div>
            <a href={RULES_URL} target="_blank" rel="noopener noreferrer">Game rules</a>
          </div>
        </div>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Game board pieces
// ═══════════════════════════════════════════════════════════════════════════

function getPrompt(game, handMode) {
  const p1 = game.player1;
  const p2 = game.player2;
  const cc = game.currentCharacter;
  const ts = turnState(game);

  if (game.phazeIsEnd) {
    const draw = game.winner.includes(',');
    return {
      who: 'end', label: 'Game over',
      title: draw ? 'It’s a draw!' : game.winner === p1.name ? 'You win!' : `${game.winner} wins`,
      sub: `Final score — you ${p1.score} · ${p2.name} ${p2.score}`
    };
  }

  if (ts.robot) {
    let sub = '';
    if (p2.on_coronation) sub = 'Deciding how to pay for the crown';
    else if (p2.on_graveyard) sub = 'Deciding whether to rescue a district from the graveyard';
    else if (game.phazeIsChoose) sub = 'Choosing a character';
    else if (game.phazeIsDiscard) sub = 'Discarding a character face-down';
    else if (cc) sub = `Playing the ${characterName(cc)}`;
    return { who: 'robot', label: `${p2.name}’s turn`, title: `${p2.name} is thinking`, thinking: true, sub };
  }

  const label = game.phazeIsAction && cc ? `Your turn · ${characterName(cc)}` : 'Your turn';
  const you = (title, sub) => ({ who: 'you', label, title, sub });

  if (p1.on_coronation) return you('Pay the Emperor for the crown', 'Give 1 gold or 1 card');
  if (graveyardPendingFor(game, p1)) {
    return you(`Pay 1 gold to keep your ${districtName(game.deck.card_on_graveyard)}?`, 'It goes back into your hand');
  }
  if (game.phazeIsChoose) return you('Pick a character for this round', `${p2.name} picks from what you leave`);
  if (game.phazeIsDiscard) return you('Discard one character face-down', 'Nobody can play it this round');
  if (!game.phazeIsAction || !cc) return you('Your move', '');

  const blocked = game.player1Blocked;
  if (handMode === 'lab') return you('Laboratory: pick a card to discard for 1 gold', 'Or cancel');
  if (handMode === 'museum') return you('Museum: pick a card to place under the Museum', 'Each card is worth 1 point at the end');
  if (cc.choosed_to_discard) return you('Select cards to swap for new ones', 'Then press Discard');
  if (game.deck.cards_on_choose) return you('Pick a card to keep', 'The rest go back to the deck');
  if (p1.using_lighthouse) return you('Lighthouse: pick any card from the deck', '');
  if (p1.exploding) return you(`Powderhouse: pick a ${p2.name} district to blow up`, 'Your Powderhouse is destroyed too');
  if (p2.hasBallroom && p2.has_crown && !cc.isBewitched && !cc.isAssassinated && !cc.thanked) {
    return you('Say “Thanks, your Excellency!” first', `${p2.name}’s Ballroom: forget and you lose your turn`);
  }

  const tasks = [];
  if (!blocked && cc.isEmperor && !cc.coronated && !p2.on_coronation) tasks.push(`Give the crown to ${p2.name}`);
  if (!blocked && cc.isAssassin && !cc.assassinated) tasks.push('Pick a character to assassinate');
  if (!blocked && cc.isWitch && !cc.bewitched) tasks.push('Pick a character to bewitch');
  if (!blocked && cc.isThief && !cc.robbed) tasks.push('Pick a character to rob');
  if (!blocked && cc.isWizard && !cc.stole && p2.cards.length > 0) tasks.push(`Steal one of ${p2.name}’s cards`);
  if (!cc.taking && cc.canTake) tasks.push('Take 2 gold or draw cards');
  if (!blocked && cc.isNavigator && !cc.navigated) tasks.push('Take 4 gold or 4 cards');
  if (cc.took > 0 && cc.can_build && !blocked) {
    const any = p1.cards.some(c => c.status === 'in_hand' && !isDuplicate(p1, c) && buildCost(p1, c) <= p1.coins);
    if (any) tasks.push('Build a district from your hand');
  }
  if (!blocked && cc.isWarlordAndHuman && !cc.destroyed && p2.districts.length) tasks.push(`Destroy a ${p2.name} district (optional)`);
  if (!blocked && cc.isDiplomatAndHuman && !cc.swapped) {
    tasks.push(p1.districtOnSwap ? `Now pick the ${p2.name} district you want`
      : p2.districtOnSwap ? 'Now pick your district to give'
        : 'Swap districts: pick yours or theirs (optional)');
  }
  if (cc.isBewitched && cc.player === p1 && blocked) {
    return you(tasks[0] || 'End your turn', `Your ${characterName(cc)} is bewitched — the Witch plays the rest of this turn`);
  }
  if (!tasks.length) return you('End your turn', cc.took > 0 ? 'Nothing else to do' : '');
  return you(tasks[0], tasks.slice(1).join(' · '));
}

function PromptBar({ prompt }) {
  return (
    <div className={`prompt prompt-${prompt.who}`} role="status" aria-live="polite">
      <div className="prompt-who">{prompt.label}</div>
      <div className="prompt-title">
        {prompt.title}{prompt.thinking && <Dots />}
      </div>
      {prompt.sub && <div className="prompt-sub">{prompt.sub}</div>}
    </div>
  );
}

function CharacterTrack({ game }) {
  const chars = [...game.characters.content].sort((a, b) => a.number - b.number);
  const cc = game.currentCharacter;
  const inAction = game.phazeIsAction && cc;
  return (
    <ol className="track" aria-label="Characters in calling order">
      {chars.map(c => {
        const called = inAction && c.number < cc.number;
        const current = inAction && cc === c;
        let owner = '';
        let ownerClass = '';
        if (c.player === game.player1) { owner = 'You'; ownerClass = 'owner-you'; }
        else if (c.revealed && (c.status === 'discarded' || !c.player)) { owner = 'Not in play'; ownerClass = 'owner-none'; }
        else if (c.revealed && c.player) { owner = c.player.name; ownerClass = 'owner-robot'; }
        const st = stateNote(c);
        const name = characterName(c);
        const desc = [name, owner, st, current ? 'now playing' : called ? 'already called' : ''].filter(Boolean).join(', ');
        return (
          <li
            key={c.number}
            className={['track-item', called && 'is-called', current && 'is-current', ownerClass, st && `st-${st.toLowerCase()}`].filter(Boolean).join(' ')}
            aria-current={current ? 'step' : undefined}
            title={desc}
          >
            <span className="track-portrait card-track"><CardFace sprite={c.pic_class} /></span>
            <span className="track-text" aria-hidden="true">
              <span className="track-num">{c.number}</span>
              <span className="track-name">{name}</span>
            </span>
            {owner && (
              <span className="track-owner" aria-hidden="true">
                {ownerClass === 'owner-none'
                  ? <><span className="owner-long">Not in play</span><span className="owner-short">Out</span></>
                  : owner}
              </span>
            )}
            {st && <span className="track-state" aria-hidden="true">{st === 'Assassinated' ? '☠' : st === 'Robbed' ? '$' : '✦'}</span>}
            <span className="sr-only">{c.number}. {desc}</span>
          </li>
        );
      })}
    </ol>
  );
}

function GameLog({ log }) {
  const [open, setOpen] = useState(false);
  const latest = log[log.length - 1];
  return (
    <aside className={`log${open ? ' is-open' : ''}`} aria-label="Game log">
      <button type="button" className="log-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="log-head-title">Log</span>
        <span className="log-latest">{latest ? latest.text : 'Nothing yet'}</span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      <h2 className="log-title">Game log</h2>
      <ol className="log-list" aria-live="polite">
        {!log.length && <li className="log-empty">Moves will appear here.</li>}
        {[...log].reverse().map(e => (
          <li key={e.id} className={`log-${e.kind}`}>{e.text}</li>
        ))}
      </ol>
    </aside>
  );
}

function RobotStrip({ game, active, destroyTargets }) {
  const p = game.player2;
  const hide = game.hidePlayer2Cards;
  const isNew = useNewTracker(p.districts);
  return (
    <section className={`robot-strip${active ? ' is-active' : ''}`} aria-label={`${p.name}’s board`}>
      <div className="strip-head">
        <h2 className="player-name">{p.name}</h2>
        {p.has_crown && <span className="crown-badge" title="Holds the crown"><CrownIcon /><span className="sr-only">holds the crown</span></span>}
        {active && <span className="thinking-chip">Thinking<Dots /></span>}
        <PlayerStats player={p} />
      </div>
      <div className="strip-body">
        <div className="strip-chars" aria-label={`${p.name}’s characters`}>
          {p.characters.map((c, i) => (hide && !c.revealed
            ? <Card key={i} back size="xs" />
            : <Card key={i} info={characterInfo(c)} size="xs" current={c.is_current} note={stateNote(c)} />
          ))}
        </div>
        <div className="strip-districts" aria-label={`${p.name}’s city`}>
          {p.districts.length ? p.districts.map((d, i) => (
            <Card
              key={i}
              info={districtInfo(d)}
              size="xs"
              isNew={isNew(d)}
              selected={d.status === 'on_swap'}
              variant={destroyTargets ? 'is-muted-thumb' : ''}
            />
          )) : <span className="empty-note">No districts yet</span>}
        </div>
      </div>
    </section>
  );
}

function MyCity({ game, active, onSwapOwn }) {
  const p = game.player1;
  const isNew = useNewTracker(p.districts);
  return (
    <section className={`my-city${active ? ' is-active' : ''}`} aria-label="Your city">
      <div className="strip-head">
        <h2 className="player-name">{p.name} <span className="player-sub">· your city</span></h2>
        {p.has_crown && <span className="crown-badge" title="You hold the crown"><CrownIcon /><span className="sr-only">holds the crown</span></span>}
        <PlayerStats player={p} />
      </div>
      <div className="city-body">
        <div className="city-chars" aria-label="Your characters this round">
          {p.characters.length ? p.characters.map((c, i) => (
            <Card key={i} info={characterInfo(c)} size="sm" current={c.is_current} note={stateNote(c)} />
          )) : <span className="empty-note">No character yet</span>}
        </div>
        <div className="city-districts">
          {p.districts.length ? p.districts.map((d, i) => {
            const swappable = onSwapOwn && !p.districtOnSwap;
            return (
              <Card
                key={i}
                info={districtInfo(d)}
                size="sm"
                isNew={isNew(d)}
                selected={d.status === 'on_swap'}
                variant={swappable ? 'is-target' : ''}
                badge={swappable ? { text: 'Give', tone: 'danger' } : d.status === 'on_swap' ? { text: 'Selected', tone: 'gold' } : null}
                onClick={swappable ? () => onSwapOwn(d) : undefined}
              />
            );
          }) : <div className="empty-slot">No districts yet — build from your hand</div>}
        </div>
      </div>
    </section>
  );
}

function CardRow({ children, wrap = true, className = '' }) {
  return <div className={`card-row${wrap ? ' wrap' : ''} ${className}`.trim()}>{children}</div>;
}

function EndSummary({ game, onRestart }) {
  const players = [game.player1, game.player2];
  return (
    <div className="end-summary">
      <div className="end-tables">
        {players.map(p => (
          <table key={p.name} className="end-table">
            <caption>{p === game.player1 ? `${p.name} (you)` : p.name}</caption>
            <tbody>
              {scoreRows(p).map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}
              <tr className="end-total"><th scope="row">Total</th><td>{p.score}</td></tr>
            </tbody>
          </table>
        ))}
      </div>
      <button type="button" className="btn-primary btn-large" onClick={onRestart}>Start new game</button>
    </div>
  );
}

// ─── Hand ────────────────────────────────────────────────────────────────────

function Hand({ game, waiting, handMode, setHandMode, hint, showHint, act }) {
  const p1 = game.player1;
  const cc = game.currentCharacter;
  const mine = game.youActivePlayer && game.phazeIsAction && cc && cc.handle_player === p1;
  const blocked = game.player1Blocked;
  const magicDiscard = mine && cc.choosed_to_discard;
  const buildMode = mine && !blocked && cc.took > 0 && !game.deck.cards_on_choose && cc.can_build && !cc.choosed_to_discard && !handMode;
  const checked = p1.cards.filter(c => c.isChecked).length;

  const cardProps = (card) => {
    const info = districtInfo(card);
    const cost = buildCost(p1, card);
    const base = { info, label: `${info.title}, cost ${card.cost}, ${COLOR_LABEL[card.color] || 'district'}` };

    if (magicDiscard) {
      return {
        ...base, toggle: true, selected: !!card.isChecked, variant: 'is-discard-select',
        onClick: () => act(() => { card.isChecked = !card.isChecked; })
      };
    }
    if (handMode === 'lab') {
      return {
        ...base, variant: 'is-discard', badge: { text: '+1 gold', tone: 'good' },
        onClick: () => { setHandMode(null); act(() => cc.useLab(card)); }
      };
    }
    if (handMode === 'museum') {
      return {
        ...base, variant: 'is-pick', badge: { text: 'Under Museum', tone: 'gold' },
        onClick: () => { setHandMode(null); act(() => cc.underMuseum(game, card)); }
      };
    }
    if (card.onWizard) {
      if (mine && cc.isWizard && !cc.wizard_built) {
        if (cost > p1.coins) {
          const text = `Need ${cost - p1.coins} more gold`;
          return { ...base, note: 'Stolen', disabled: true, badge: { text, tone: 'muted' }, onDisabledClick: () => showHint(`${info.title} costs ${cost} — you need ${cost - p1.coins} more gold.`) };
        }
        return { ...base, note: 'Stolen', variant: 'is-action', badge: { text: `Build now · ${cost}`, tone: 'gold' }, onClick: () => act(() => cc.wizardBuild(game, card)) };
      }
      return { ...base, note: 'Stolen' };
    }
    if (isDuplicate(p1, card)) {
      return {
        ...base, disabled: true, badge: { text: 'Already built', tone: 'muted' },
        onDisabledClick: () => showHint(`You already have ${info.title} in your city.`)
      };
    }
    if (buildMode) {
      if (cost > p1.coins) {
        const need = cost - p1.coins;
        return {
          ...base, disabled: true, badge: { text: `Need ${need} more gold`, tone: 'muted' },
          onDisabledClick: () => showHint(`${info.title} costs ${cost} — you need ${need} more gold.`)
        };
      }
      return { ...base, variant: 'is-action', badge: { text: `Build · ${cost}`, tone: 'gold' }, onClick: () => act(() => cc.build(game, card)) };
    }
    return base;
  };

  return (
    <section className={`hand-dock${waiting ? ' is-waiting' : ''}`} aria-label="Your hand">
      <div className="hand-head">
        <h2>Your hand <span className="hand-count">({p1.cards.length})</span></h2>
        {handMode && (
          <button type="button" className="btn-quiet btn-small" onClick={() => setHandMode(null)}>Cancel</button>
        )}
        {magicDiscard && (
          <button type="button" className="btn-danger btn-small" onClick={() => act(() => cc.discardCards(game))}>
            {checked ? `Discard ${plural(checked, 'card')}` : 'Keep all cards'}
          </button>
        )}
        <span className="hand-tip">{canHover ? 'Right-click' : 'Long-press'} a card to read it</span>
      </div>
      <div className="hand-hint" role="alert" aria-live="assertive">
        {hint && <span key={hint.id} className="hint-bubble">{hint.text}</span>}
      </div>
      <div className="hand-cards">
        {p1.cards.length
          ? p1.cards.map((card, i) => <Card key={i} size="md" {...cardProps(card)} />)
          : <div className="empty-slot">No cards in hand</div>}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Game board
// ═══════════════════════════════════════════════════════════════════════════

function GameBoard({ game, update, log }) {
  const [handModeRaw, setHandMode] = useState(null);
  const [hint, setHint] = useState(null);
  const hintTimer = useRef(null);
  const act = (fn) => { fn(); update(); game.checkAutoPlay(); };

  const showHint = useCallback((text) => {
    clearTimeout(hintTimer.current);
    setHint({ text, id: ++logSeq });
    hintTimer.current = setTimeout(() => setHint(null), 4000);
  }, []);

  // Route engine error messages to the inline hint instead of a popup.
  useEffect(() => {
    game.onError = showHint;
    return () => { game.onError = null; clearTimeout(hintTimer.current); };
  }, [game, showHint]);

  const p1 = game.player1;
  const p2 = game.player2;
  const cc = game.currentCharacter;
  const ts = turnState(game);
  const myAction = ts.human && game.youActivePlayer && game.phazeIsAction && cc;
  const blocked = game.player1Blocked;

  const labAvail = myAction && cc.handle_player === p1 && p1.hasLab && !blocked && !cc.isWitch && !cc.used_lab && !cc.choosed_to_discard && p1.cards.length > 0;
  const museumAvail = myAction && cc.handle_player === p1 && p1.hasMuseum && !blocked && !cc.isWitch && !cc.used_museum && !cc.choosed_to_discard && p1.cards.length > 0;
  const handMode = handModeRaw === 'lab' && labAvail ? 'lab' : handModeRaw === 'museum' && museumAvail ? 'museum' : null;

  const prompt = getPrompt(game, handMode);

  const handleDestroy = (district) => {
    act(() => {
      if (game.activePlayer !== p1 || game.player1Blocked) return;
      if (cc && cc.isWarlord) cc.destroy(game, p2, district);
    });
  };
  const handleSwap = (district) => {
    act(() => {
      if (game.activePlayer !== p1 || game.player1Blocked) return;
      if (cc && cc.isDiplomat) cc.swap(game, p2, district);
    });
  };

  const warlordMode = myAction && !blocked && cc.isWarlordAndHuman && !cc.destroyed && p2.districts.length > 0;
  const diplomatMode = myAction && !blocked && cc.isDiplomatAndHuman && !cc.swapped;
  const armoryMode = myAction && p1.exploding;

  // ── centre content ──
  let choice = null;
  if (game.phazeIsEnd) {
    choice = <EndSummary game={game} onRestart={() => act(() => game.restart())} />;
  } else if (ts.human && p1.on_coronation) {
    choice = (
      <div className="btn-row">
        <button type="button" className="btn-primary" disabled={!p1.coins} onClick={() => act(() => p1.giveCoinForCrown(game))}>Give 1 gold</button>
        <button type="button" className="btn-primary" disabled={!p1.cards.length} onClick={() => act(() => p1.giveCardForCrown(game))}>Give a random card</button>
      </div>
    );
  } else if (ts.human && graveyardPendingFor(game, p1)) {
    const card = game.deck.card_on_graveyard;
    choice = (
      <div className="graveyard-prompt">
        <Card info={districtInfo(card)} size="lg" />
        <div className="btn-row">
          <button type="button" className="btn-primary" onClick={() => act(() => p1.useGraveyard(game, true))}>Pay 1 gold</button>
          <button type="button" className="btn-quiet" onClick={() => act(() => p1.useGraveyard(game, false))}>Let it go</button>
        </div>
      </div>
    );
  } else if (ts.human && game.phazeIsChoose) {
    choice = (
      <CardRow>
        {game.characters.content.filter(c => c.inRound).map(c => (
          <Card key={c.number} info={characterInfo(c)} size="lg" variant="is-action" label={`Pick ${characterName(c)}`}
            onClick={() => act(() => { p1.takeCharacter(c); game.changePhaze(); })} />
        ))}
      </CardRow>
    );
  } else if (ts.human && game.phazeIsDiscard) {
    choice = (
      <CardRow>
        {game.characters.content.filter(c => c.inRound).map(c => (
          <Card key={c.number} info={characterInfo(c)} size="lg" variant="is-discard" label={`Discard ${characterName(c)}`}
            onClick={() => act(() => { p1.discardCharacter(c); game.changePhaze(); })} />
        ))}
      </CardRow>
    );
  } else if (myAction) {
    const parts = [];
    const charTargets = (filterSelf, isValid, onPick, verb) => (
      <CardRow key={verb}>
        {game.characters.content.filter(filterSelf).map(c => {
          const ok = isValid(c);
          return (
            <Card key={c.number} info={characterInfo(c)} size="lg" variant="is-target"
              disabled={!ok} label={`${verb} ${characterName(c)}`}
              badge={ok ? null : { text: 'Not allowed', tone: 'muted' }}
              onDisabledClick={() => showHint(`You can’t ${verb.toLowerCase()} the ${characterName(c)}.`)}
              onClick={() => act(() => onPick(c))} />
          );
        })}
      </CardRow>
    );

    if (!blocked && cc.isAssassin && !cc.assassinated) {
      parts.push(charTargets(c => !c.isAssassin, () => true, c => cc.assassinate(c), 'Assassinate'));
    }
    if (!blocked && cc.isWitch && !cc.bewitched) {
      parts.push(charTargets(c => !c.isWitch, () => true, c => cc.bewitch(c), 'Bewitch'));
    }
    if (!blocked && cc.isThief && !cc.robbed) {
      parts.push(charTargets(
        c => !c.isThief,
        c => c.number !== 1 && !c.isAssassinated && !c.isBewitched,
        c => cc.rob(c), 'Rob'
      ));
    }
    if (!blocked && cc.isWizard && !cc.stole && p2.cards.length > 0) {
      parts.push(
        <CardRow key="wizard">
          {p2.cards.map((card, i) => (
            <Card key={i} info={districtInfo(card)} size="lg" variant="is-target" label={`Steal ${districtName(card)}`}
              onClick={() => act(() => cc.stealCard(p2, card))} />
          ))}
        </CardRow>
      );
    }
    if (game.deck.cards_on_choose) {
      parts.push(
        <CardRow key="draw">
          {game.deck.content.filter(c => c.onChoose).map((card, i) => {
            const dup = isDuplicate(p1, card);
            return (
              <Card key={i} info={districtInfo(card)} size="lg" variant="is-action" label={`Keep ${districtName(card)}`}
                badge={dup ? { text: 'Already built', tone: 'muted' } : { text: `Cost ${card.cost}`, tone: 'gold' }}
                onClick={() => act(() => cc.takeCard(game, card))} />
            );
          })}
        </CardRow>
      );
    }
    if (p1.using_lighthouse) {
      parts.push(
        <CardRow key="lighthouse" className="scroll-box">
          {game.deck.content.filter(c => c.inDeck).map((card, i) => (
            <Card key={i} info={districtInfo(card)} size="sm" variant="is-action" label={`Take ${districtName(card)}`}
              onClick={() => act(() => p1.lighthouseTake(card))} />
          ))}
        </CardRow>
      );
    }
    if (warlordMode || armoryMode || diplomatMode) {
      parts.push(
        <div key="targets" className="target-panel">
          <h3 className="panel-title">{p2.name}’s city</h3>
          <CardRow>
            {p2.districts.length ? p2.districts.map((d, i) => {
              let t;
              let onClick;
              if (armoryMode) { t = { ok: true, label: 'Blow up' }; onClick = () => act(() => p1.explodeArmory(game, d)); }
              else if (warlordMode) {
                const w = warlordTarget(game, p1, p2, d);
                t = { ok: w.ok, label: w.ok ? (w.cost ? `Destroy · ${w.cost}` : 'Destroy · free') : w.why };
                onClick = () => handleDestroy(d);
              } else {
                const dt = diplomatTarget(p1, p2, d);
                const locked = p2.districtOnSwap && d.status !== 'on_swap';
                t = locked ? { ok: false, label: 'Pick yours' } : d.status === 'on_swap' ? { ok: false, label: 'Selected' } : dt;
                onClick = () => handleSwap(d);
              }
              return (
                <Card key={i} info={districtInfo(d)} size="sm" variant="is-target"
                  selected={d.status === 'on_swap'}
                  disabled={!t.ok}
                  badge={{ text: t.label || t.why, tone: t.ok ? 'danger' : 'muted' }}
                  label={`${t.ok ? 'Target' : 'Can’t target'} ${districtName(d)}`}
                  onDisabledClick={() => showHint(`${districtName(d)}: ${t.label || t.why}.`)}
                  onClick={onClick} />
              );
            }) : <span className="empty-note">No districts to target</span>}
          </CardRow>
        </div>
      );
    }

    // Action buttons
    const btns = [];
    if (!cc.taking && cc.canTake) {
      btns.push(<button key="coins" type="button" className="btn-primary" onClick={() => act(() => cc.takeCoins(game))}>Take 2 gold</button>);
      btns.push(<button key="cards" type="button" className="btn-primary" onClick={() => act(() => cc.chooseCard(game))}>Draw cards</button>);
    }
    if (p2.hasBallroom && p2.has_crown && !cc.isBewitched && !cc.isAssassinated && !cc.thanked) {
      btns.push(<button key="thanks" type="button" className="btn-primary" onClick={() => act(() => cc.thanksYourExcellency())}>Thanks, your Excellency!</button>);
    }
    if (!blocked && cc.isEmperor && !p2.on_coronation && !cc.coronated) {
      btns.push(<button key="crown" type="button" className="btn-primary" onClick={() => act(() => cc.coronate(game, p2))}>Give the crown to {p2.name}</button>);
    }
    if (!blocked && cc.isNavigator && !cc.navigated) {
      btns.push(<button key="n4g" type="button" className="btn-primary" onClick={() => act(() => cc.take4Coins())}>Take 4 gold</button>);
      btns.push(<button key="n4c" type="button" className="btn-primary" onClick={() => act(() => cc.take4Cards(game))}>Take 4 cards</button>);
    }
    if (!blocked && cc.isColor && cc.canTake && !cc.took_income) {
      const n = p1.districts.filter(d => d.color === cc.color).length + p1.hasDistrict('school');
      btns.push(<button key="income" type="button" onClick={() => act(() => cc.takeIncome())}>Take income (+{n})</button>);
    }
    if (!blocked && cc.isMagician && !cc.did_magic) {
      btns.push(<button key="mx" type="button" onClick={() => act(() => cc.exchange_cards(game, p2))}>Swap hands with {p2.name}</button>);
      btns.push(<button key="md" type="button" onClick={() => act(() => cc.chooseToDiscard())}>Redraw some cards</button>);
    }
    if (!blocked && p1.hasWorkshop && !cc.isWitch && !cc.used_workshop) {
      btns.push(<button key="ws" type="button" onClick={() => act(() => cc.useWorkshop(game))}>Workshop: 2 gold → 3 cards</button>);
    }
    if (labAvail) {
      btns.push(<button key="lab" type="button" aria-pressed={handMode === 'lab'} onClick={() => setHandMode(handMode === 'lab' ? null : 'lab')}>Laboratory: discard for 1 gold</button>);
    }
    if (museumAvail) {
      btns.push(<button key="mus" type="button" aria-pressed={handMode === 'museum'} onClick={() => setHandMode(handMode === 'museum' ? null : 'museum')}>Museum: store a card</button>);
    }
    if (!blocked && p1.can_use_belltower) {
      btns.push(<button key="bell" type="button" onClick={() => act(() => p1.ringTheBell(game))}>Ring the bell (end at 7)</button>);
    }
    if (!blocked && p1.can_use_lighthouse && !p1.using_lighthouse) {
      btns.push(<button key="lh" type="button" onClick={() => act(() => p1.useLighthouse())}>Lighthouse: pick from deck</button>);
    }
    if (!blocked && p1.hasArmory && !p1.exploding) {
      btns.push(<button key="arm" type="button" className="btn-danger" onClick={() => act(() => p1.onExplode())}>Blow up Powderhouse</button>);
    }
    if (cc.took > 0 && !game.deck.cards_on_choose && !game.deck.card_on_graveyard && !cc.choosed_to_discard) {
      btns.push(<button key="end" type="button" className="btn-end" onClick={() => { setHandMode(null); act(() => cc.endTurn(game)); }}>End turn</button>);
    }

    choice = (
      <>
        {parts}
        {btns.length > 0 && <div className="btn-row">{btns}</div>}
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">
          <h1>{game.name}</h1>
          <span className="topbar-sub">Game ends at {p1.districts_to_close} districts</span>
        </div>
        {!game.phazeIsEnd
          ? <button type="button" className="btn-quiet btn-small finish" onClick={() => game.finish()}>Finish game</button>
          : <button type="button" className="btn-primary btn-small" onClick={() => act(() => game.restart())}>New game</button>}
      </header>

      <RobotStrip game={game} active={ts.robot} destroyTargets={warlordMode || armoryMode || diplomatMode} />

      <section className={`center who-${prompt.who}${ts.robot ? ' is-waiting' : ''}`} aria-label="Current turn">
        <PromptBar prompt={prompt} />
        <CharacterTrack game={game} />
        <div className="center-main">{choice}</div>
      </section>

      <MyCity game={game} active={ts.human} onSwapOwn={diplomatMode && !p1.districtOnSwap ? handleSwap : null} />

      <Hand
        game={game}
        waiting={!ts.human}
        handMode={handMode}
        setHandMode={setHandMode}
        hint={hint}
        showHint={showHint}
        act={act}
      />

      <GameLog log={log} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// App root
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  const gameRef = useRef(null);
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  const [gameName, setGameName] = useState('');
  const [yourName, setYourName] = useState('');
  const [robotName, setRobotName] = useState('');
  const [extendedChars, setExtendedChars] = useState({ 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false, 8: false });
  const [startError, setStartError] = useState('');
  const [viewing, setViewing] = useState(null);
  const [gameKey, setGameKey] = useState(0);
  const snapRef = useRef(null);

  if (!gameRef.current) {
    const g = new Game();
    if (localStorage.getItem('game')) g.load(localStorage.getItem('game'));
    gameRef.current = g;
  }
  const game = gameRef.current;
  const update = useCallback(() => forceUpdate(), []);

  // Restore the log of a resumed game; a fresh game starts with an empty log.
  const [log, setLog] = useState(() => (game.phazeIsStart ? [] : loadLog()));

  useEffect(() => {
    try {
      if (game.phazeIsStart) localStorage.removeItem(LOG_KEY);
      else localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch { /* storage unavailable or full — log just won't persist */ }
  }, [log, game.phazeIsStart]);

  useEffect(() => {
    game.notifyUI = update;
    return () => { game.notifyUI = null; };
  }, [game, update]);

  useEffect(() => {
    if (!game.phazeIsStart) game.checkAutoPlay();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the event log by diffing game state after every render.
  useEffect(() => {
    const cur = takeSnapshot(game);
    const prev = snapRef.current;
    snapRef.current = cur;
    if (!prev) return;
    if (prev.phase === 'start' && cur.phase !== 'start' && cur.players) {
      const crown = cur.players.find(x => x.crown);
      setLog([{ id: ++logSeq, kind: 'round', text: `New game — ${crown && crown.p === game.player1 ? 'you hold' : `${game.player2.name} holds`} the crown` }]);
      return;
    }
    const events = describeChanges(prev, cur, game);
    if (events.length) setLog(l => [...l, ...events.map(e => ({ ...e, id: ++logSeq }))].slice(-200));
  });

  const handleStart = (gameName_, yourName_, robotName_, extended) => {
    if (game.is_extended && !extended.length) {
      setStartError('Choose at least one extended character.');
      return;
    }
    const namesArr = { 'Game name': gameName_, 'Your name': yourName_, 'Robot name': robotName_ };
    for (const [key, val] of Object.entries(namesArr)) {
      if (val && !val.match(/^[0-9A-Za-z_ -]+$/)) {
        setStartError(`${key} can only contain letters, digits, spaces, _ and -.`);
        return;
      }
    }
    if (yourName_ && robotName_ && yourName_ === robotName_) {
      setStartError('Your name and the robot’s name must be different.');
      return;
    }
    setStartError('');
    game.start(gameName_ || 'New Game', yourName_ || 'Human', robotName_ || 'Robot', extended);
    setGameKey(k => k + 1);
    update();
    game.checkAutoPlay();
  };

  const handleSetExtended = (val) => {
    game.is_extended = val;
    update();
  };

  const handleRandomExtended = () => {
    const genArr = [1, 2, 3, 4, 5, 6, 7, 8];
    const extCnt = Math.random() < 0.5 ? 6 : 7;
    for (let i = 0; i < extCnt; i++) genArr.splice(Math.floor(Math.random() * genArr.length), 1);
    const newExt = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false, 8: false };
    genArr.forEach(n => { newExt[n] = true; });
    setExtendedChars(newExt);
  };

  const closeViewer = useCallback(() => setViewing(null), []);

  return (
    <ViewerContext.Provider value={setViewing}>
      <div className={`main-block${game.phazeIsStart ? ' is-start' : ''}`}>
        {game.phazeIsStart ? (
          <StartScreen
            game={game}
            onStart={handleStart}
            onSetExtended={handleSetExtended}
            onRandomExtended={handleRandomExtended}
            error={startError}
            gameName={gameName} setGameName={setGameName}
            yourName={yourName} setYourName={setYourName}
            robotName={robotName} setRobotName={setRobotName}
            extendedChars={extendedChars} setExtendedChars={setExtendedChars}
          />
        ) : (
          <GameBoard key={gameKey} game={game} update={update} log={log} />
        )}
      </div>
      <CardViewer info={viewing} onClose={closeViewer} />
    </ViewerContext.Provider>
  );
}
