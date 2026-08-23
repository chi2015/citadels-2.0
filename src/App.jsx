import React, { useRef, useReducer, useCallback, useState, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Game } from './game/Game.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function sortBy(arr, prop) {
  return [...arr].sort((a, b) => (a[prop] > b[prop] ? 1 : a[prop] < b[prop] ? -1 : 0));
}

// Built-districts count icon — a small citadel/skyline silhouette. There's no
// spare cell for this in the sprite-new.png sheet (see the sprite header
// comment in style.css), so it's a plain inline SVG instead, sized/colored to
// match the gold-coin and card-back icons via .icon-districts in style.css.
function DistrictsIcon() {
  return (
    <svg className="icon-districts" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
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

// Card/character wrapper that shows a description tooltip on hover/focus.
// The tooltip text is portaled to <body> and positioned with getBoundingClientRect,
// rather than nested + absolutely positioned inside the wrapper: card rows scroll
// horizontally (overflow-x: auto), and setting overflow-x forces overflow-y to
// compute to `auto` too — which clipped the old nested tooltip against the row's
// own box the moment it grew taller than the row's padding (i.e. almost always).
// Portaling escapes that clip entirely. The position is a one-time snapshot taken
// on hover/focus (not live-tracked), so any scroll — including the card row's own
// horizontal scroll — just dismisses the tooltip rather than letting it drift.
function Tooltip({ text, className = '', children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!pos) return;
    const hide = () => setPos(null);
    // capture:true so this also catches scrolls on descendant elements (e.g. the
    // horizontally-scrolling card row itself), which don't bubble as scroll events.
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
    const half = 115; // half of .tooltiptext's 230px width
    const left = Math.min(Math.max(rect.left + rect.width / 2, half + 4), window.innerWidth - half - 4);
    // Flip below the card when there isn't roughly enough room above for a tooltip
    // (sticky header + a few lines of text) — e.g. the top-most "Choose character" row.
    const below = rect.top < 150;
    setPos({ left, top: below ? rect.bottom + 10 : rect.top - 10, below });
  };
  const hide = () => setPos(null);

  return (
    <div
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
        >
          {text}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Start screen ────────────────────────────────────────────────────────────

function StartScreen({ game, onStart, onSetExtended, onRandomExtended,
  gameName, setGameName, yourName, setYourName, robotName, setRobotName,
  extendedChars, setExtendedChars }) {

  const handleSubmit = (e) => {
    e.preventDefault();
    const extended = Object.keys(extendedChars).filter(k => extendedChars[k]).map(Number);
    onStart(gameName, yourName, robotName, extended);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="start-block">
        <div className="sprite crown start-crown" />
        <div className="start-subblock">
          <div className="start-head-block"><h2>2 players: You vs Robot</h2></div>
          <div className="input-block">
            <label>Game name:</label>
            <input type="text" value={gameName} onChange={e => setGameName(e.target.value)} />
          </div>
          <div className="input-block">
            <label>Your name:</label>
            <input type="text" value={yourName} onChange={e => setYourName(e.target.value)} />
          </div>
          <div className="input-block">
            <label>Robot name:</label>
            <input type="text" value={robotName} onChange={e => setRobotName(e.target.value)} />
          </div>
          <div className="game-type-block">
            <p>Game type:</p>
            <div className="input-radio-block">
              <input type="radio" value="classic" name="game_type" id="rb_classic"
                checked={!game.is_extended}
                onChange={() => onSetExtended(false)} />
              <label htmlFor="rb_classic">Classic</label>
            </div>
            <div className="input-radio-block">
              <input type="radio" value="extended" name="game_type" id="rb_extended"
                checked={!!game.is_extended}
                onChange={() => onSetExtended(true)} />
              <label htmlFor="rb_extended">Extended</label>
            </div>
          </div>
          {game.is_extended && (
            <div className="extended_characters_block">
              <p>Extended characters*:</p>
              <button type="button" onClick={onRandomExtended}>Random choice</button>
              {[
                [1, 'Witch'], [2, 'Tax collector'], [3, 'Wizard'], [4, 'Emperor'],
                [5, 'Abbot'], [6, 'Alchemist'], [7, 'Navigator'], [8, 'Diplomat']
              ].map(([n, label]) => (
                <div className="ext_cb_block" key={n}>
                  <input type="checkbox" id={`cb_ext_${n}`} checked={!!extendedChars[n]}
                    onChange={e => setExtendedChars(prev => ({ ...prev, [n]: e.target.checked }))} />
                  <label htmlFor={`cb_ext_${n}`}>{label}</label>
                </div>
              ))}
            </div>
          )}
          {game.is_extended && (
            <p className="notice">*Notice: the game becomes disbalanced when count of extended characters is more than two</p>
          )}
          <div className="start-button-block">
            <button type="submit">Start</button>
          </div>
          <div className="start-footer-block">
            <div className="game-version">Version: {game.version}</div>
            <div className="game-rules">
              <a href="https://images-cdn.fantasyflightgames.com/filer_public/f2/e7/f2e74a36-bed7-4a38-aff4-c2e968a1c369/citadels-rules-english.pdf" target="_blank" rel="noopener noreferrer">Game rules</a>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

// ─── Character list (for a player's chosen characters) ──────────────────────

// Characters accumulate one per round for the whole game, and must all stay
// visible on a single row with no scrolling. .character-block (the flex-row
// item) is allowed to shrink below its natural 180px once there's no more
// room; .character-block-scale (its one child, kept at native 180px) is
// visually scaled down to match via a CSS transform driven by a container
// query unit — see the .character-block-scale rule in style.css for why
// this is done as a transform rather than resizing the sprite directly.
function CharactersList({ characters, hide }) {
  return (
    <div className="characters-list">
      {characters.map((character, i) => {
        if (hide && !character.revealed) {
          return (
            <div className="character-block" key={i}>
              <div className="character-block-scale">
                <div className="character-notes" />
                <div className="sprite card" />
              </div>
            </div>
          );
        }
        return (
          <Tooltip className="character-block" text={character.desc} key={i}>
            <div className="character-block-scale">
              <div className="character-notes">
                {character.isAssassinated && 'assassinated'}
                {character.isRobbed && 'robbed'}
                {character.isBewitched && 'bewitched'}
              </div>
              <div className={`sprite ${character.pic_class} card-item${character.is_current ? ' current' : ''}`} />
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─── Player board (profile + districts) ─────────────────────────────────────

function PlayerBoard({ player, hide, currentCharacter, game, onDestroy, onSwap, boardClass }) {
  // Chosen characters accumulate one per round for the whole game and must all
  // stay visible with no scrolling (see .characters-list / .character-block in
  // style.css). .profile's width needs to grow to fit them, so its flex-basis
  // is computed here from the actual count — CSS alone can't count children.
  const charCount = Math.max(player.characters.length, 1);
  const charsFlexBasis = `${charCount * 180 + (charCount - 1) * 8 + 16}px`; // N cards + gaps + row padding

  return (
    <div className={`board ${boardClass}`}>
      <div className="profile" style={{ '--char-flex-basis': charsFlexBasis }}>
        <div className="profile-head">
          <div className="profile-name">{player.name}</div>
          <div className="profile-crown">
            {player.has_crown && <div className="sprite crown" />}
          </div>
        </div>
        <CharactersList characters={player.characters} hide={hide} />
        <div className="resources">
          <div className="rs-block">
            <div className="resource-pic"><div className="sprite gold" aria-hidden="true" /></div>
            {/* UI ONLY: aria-live so screen readers announce gold changes */}
            <div className="resource-count" aria-live="polite" aria-label={`${player.coins} gold`}>{player.coins}</div>
          </div>
          <div className="rs-block">
            <div className="resource-pic"><div className="sprite faceup" aria-hidden="true" /></div>
            {/* UI ONLY: aria-live so screen readers announce card count changes */}
            <div className="resource-count" aria-live="polite" aria-label={`${player.cards.length} cards`}>{player.cards.length}</div>
          </div>
          <div className="rs-block">
            <div className="resource-pic"><DistrictsIcon /></div>
            {/* UI ONLY: aria-live so screen readers announce built-district count changes */}
            <div className="resource-count" aria-live="polite" aria-label={`${player.districts.length} districts built`}>{player.districts.length}</div>
          </div>
        </div>
      </div>
      <div className="districts">
        <div className="cards-list districts-list">
          {player.districts.map((district, i) => {
            const isWarlord = currentCharacter && currentCharacter.isWarlordAndHuman;
            const isDiplomat = currentCharacter && currentCharacter.isDiplomatAndHuman;
            const onClick = (isWarlord && onDestroy) ? () => onDestroy(district)
              : (isDiplomat && onSwap) ? () => onSwap(district)
                : undefined;
            return (
              <Tooltip text={district.desc} key={i}>
                <div className={`sprite ${district.name} card-item${onClick ? ' card-item-clickable' : ''}`}
                  onClick={onClick} />
              </Tooltip>
            );
          })}
        </div>
        <div className="score-block">
          <div className="score">Score: {player.score}</div>
          {player.hasAllColours && (
            <div style={{ margin: '0 5px 2px 0' }}>
              <span style={{ color: '#ff0000' }}>C</span>
              <span style={{ color: '#ffcc00' }}>O</span>
              <span style={{ color: '#009933' }}>L</span>
              <span style={{ color: '#0000ff' }}>O</span>
              <span style={{ color: '#9900ff' }}>R</span>
            </div>
          )}
          {player.hasMuseum && player.cards_under_museum > 0 && (
            <div style={{ margin: '0 5px 2px 0' }}>Cards under museum: {player.cards_under_museum}</div>
          )}
          {player.closed && (
            <div style={{ margin: '0 5px 2px 0' }}>
              <span style={{ color: player.closed_first ? 'white' : 'black' }}>Closed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Action panel (choose/discard/action for one player) ─────────────────────

function ActionPanel({ game, isPlayer1, update }) {
  const player = isPlayer1 ? game.player1 : game.player2;
  const enemy = isPlayer1 ? game.player2 : game.player1;
  const blocked = isPlayer1 ? game.player1Blocked : game.player2Blocked;
  const cc = game.currentCharacter;

  const act = (fn) => { fn(); update(); game.checkAutoPlay(); };

  if (!game.characters) return null;

  return (
    <>
      {/* Choose phase */}
      {game.phazeIsChoose && (
        <div className="phaze-block">
          <p>Choose character:</p>
          <div className="cards-list">
            {game.characters.content.filter(c => c.inRound).map((character, i) => (
              <Tooltip text={character.desc} key={i}>
                <div className={`sprite ${character.pic_class} card-item card-item-clickable`}
                  onClick={() => act(() => { player.takeCharacter(character); game.changePhaze(); })} />
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* Discard phase */}
      {game.phazeIsDiscard && (
        <div className="phaze-block discard-block">
          <p>Discard character:</p>
          <div className="cards-list">
            {game.characters.content.filter(c => c.inRound).map((character, i) => (
              <div className={`sprite ${character.pic_class} card-item card-item-clickable`}
                key={i}
                onClick={() => act(() => { player.discardCharacter(character); game.changePhaze(); })} />
            ))}
          </div>
        </div>
      )}

      {/* Action phase */}
      {game.phazeIsAction && cc && (
        <>
          {!blocked && cc.isAssassin && !cc.assassinated && (
            <>
              <p>Choose character to assassinate</p>
              <div className="cards-list">
                {game.characters.content.filter(c => !c.isAssassin).map((character, i) => (
                  <div className={`sprite ${character.pic_class} card-item card-item-clickable`}
                    key={i}
                    onClick={() => act(() => cc.assassinate(character))} />
                ))}
              </div>
            </>
          )}
          {!blocked && cc.isWitch && !cc.bewitched && (
            <>
              <p>Choose character to bewitch</p>
              <div className="cards-list">
                {game.characters.content.filter(c => !c.isWitch).map((character, i) => (
                  <div className={`sprite ${character.pic_class} card-item card-item-clickable`}
                    key={i}
                    onClick={() => act(() => cc.bewitch(character))} />
                ))}
              </div>
            </>
          )}
          {!blocked && cc.isThief && !cc.robbed && (
            <>
              <p>Choose character to rob</p>
              <div className="cards-list">
                {game.characters.content.filter(c =>
                  !c.isAssassin && !c.isWitch && !c.isThief && !c.isAssassinated && !c.isBewitched
                ).map((character, i) => (
                  <div className={`sprite ${character.pic_class} card-item card-item-clickable`}
                    key={i}
                    onClick={() => act(() => cc.rob(character))} />
                ))}
              </div>
            </>
          )}
          {!blocked && cc.isWizard && !cc.stole && enemy.cards.length > 0 && (
            <>
              <p>Choose {enemy.name}&apos;s card to steal:</p>
              <div className="cards-list">
                {enemy.cards.map((card, i) => (
                  <Tooltip text={card.desc} key={i}>
                    <div className={`sprite ${card.name} card-item card-item-clickable`}
                      onClick={() => act(() => cc.stealCard(enemy, card))} />
                  </Tooltip>
                ))}
              </div>
            </>
          )}
          {!blocked && cc.isEmperor && !enemy.on_coronation && !cc.coronated && (
            <button onClick={() => act(() => cc.coronate(game, enemy))}>
              Coronate {enemy.name}
            </button>
          )}
          {player.exploding && (
            <>
              <p>Choose enemy district to explode</p>
              <div className="cards-list">
                {enemy.districts.map((district, i) => (
                  <div className={`sprite ${district.name} card-item card-item-clickable`}
                    key={i}
                    onClick={() => act(() => player.explodeArmory(game, district))} />
                ))}
              </div>
            </>
          )}
          {player.using_lighthouse && (
            <>
              <p>Choose card to take</p>
              <div className="lighthouse-cards">
                {game.deck.content.filter(c => c.inDeck).map((card, i) => (
                  <Tooltip text={card.desc} key={i}>
                    <div className={`sprite ${card.name} card-item card-item-clickable`}
                      onClick={() => act(() => player.lighthouseTake(card))} />
                  </Tooltip>
                ))}
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="actions-block">
            {!cc.taking && cc.canTake && (
              <>
                <button onClick={() => act(() => cc.takeCoins(game))}>Take 2 coins</button>
                <button onClick={() => act(() => cc.chooseCard(game))}>Choose cards</button>
              </>
            )}
            {enemy.hasBallroom && enemy.has_crown && !cc.isBewitched && !cc.isAssassinated && !cc.thanked && (
              <button onClick={() => act(() => cc.thanksYourExcellency())}>Thanks, your Excellency!</button>
            )}
            {!blocked && player.hasWorkshop && !cc.isWitch && !cc.used_workshop && (
              <button onClick={() => act(() => cc.useWorkshop(game))}>Pay 2 coins for 3 cards</button>
            )}
            {!blocked && player.can_use_belltower && (
              <button onClick={() => act(() => player.ringTheBell(game))}>Ring the bell</button>
            )}
            {!blocked && player.can_use_lighthouse && !player.using_lighthouse && (
              <button onClick={() => act(() => player.useLighthouse())}>Lighthouse</button>
            )}
            {!blocked && player.hasArmory && !player.exploding && (
              <button onClick={() => act(() => player.onExplode())}>Explode armory</button>
            )}
            {!blocked && cc.isMagician && !cc.did_magic && (
              <div className="magic-buttons">
                <button onClick={() => act(() => cc.exchange_cards(game, enemy))}>Exchange cards</button>
                {' or '}
                <button onClick={() => act(() => cc.chooseToDiscard())}>Discard cards</button>
              </div>
            )}
            {!blocked && cc.isNavigator && !cc.navigated && (
              <div className="magic-buttons">
                <button onClick={() => act(() => cc.take4Coins())}>Take 4 coins</button>
                <button onClick={() => act(() => cc.take4Cards(game))}>Take 4 cards</button>
              </div>
            )}
            {!blocked && cc.isColor && cc.canTake && !cc.took_income && (
              <button onClick={() => act(() => cc.takeIncome())}>Take income</button>
            )}
            {cc.took > 0 && !game.deck.cards_on_choose && !game.deck.card_on_graveyard && !cc.choosed_to_discard && (
              <button onClick={() => act(() => cc.endTurn(game))}>End turn</button>
            )}
          </div>

          {/* Warlord / Diplomat hints */}
          {!blocked && cc.isWarlord && !cc.destroyed && (
            <p>Click to enemy district to destroy</p>
          )}
          {!blocked && cc.isDiplomat && !cc.swapped && (
            <p>
              {player.districtOnSwap ? 'Click to enemy district you want to get' :
                enemy.districtOnSwap ? 'Click to your district you want to give' :
                  'Click to your or enemy district you want to swap'}
            </p>
          )}
          {cc.took > 0 && !game.deck.cards_on_choose && cc.can_build && (
            <p>Click to one of your cards to build</p>
          )}

          {/* Card selection from deck */}
          {game.deck.cards_on_choose && (
            <>
              <p>Choose card to take:</p>
              <div className="cards-list">
                {game.deck.content.filter(c => c.onChoose).map((card, i) => (
                  <Tooltip text={card.desc} key={i}>
                    <div className={`sprite ${card.name} card-item card-item-clickable`}
                      onClick={() => act(() => cc.takeCard(game, card))} />
                  </Tooltip>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

// ─── Player hand cards ────────────────────────────────────────────────────────

function PlayerCards({ game, isPlayer1, update }) {
  const player = isPlayer1 ? game.player1 : game.player2;
  const isActive = isPlayer1 ? game.youActivePlayer : game.robotActivePlayer;
  const playerBlocked = isPlayer1 ? game.player1Blocked : game.player2Blocked;
  const cc = game.currentCharacter;
  const act = (fn) => { fn(); update(); game.checkAutoPlay(); };

  return (
    <div className="districts-block">
      <p>{isPlayer1 ? 'Your cards:' : 'Robot cards:'}</p>
      {isActive && cc && cc.choosed_to_discard && <p>Choose cards to discard</p>}
      <div className="cards-list">
        {player.cards.map((card, i) => (
          <Tooltip className="card-block" text={card.desc} key={i}>
            {/* Checkbox for discard */}
            {isActive && cc && cc.choosed_to_discard && (
              <input type="checkbox" checked={!!card.isChecked}
                onChange={e => act(() => { card.isChecked = e.target.checked; })} />
            )}
            {/* Lab / Museum buttons */}
            {!cc?.choosed_to_discard && isActive && game.phazeIsAction && cc && (
              <>
                {player.hasLab && !playerBlocked && !cc.isWitch && !cc.used_lab && (
                  <button onClick={() => act(() => cc.useLab(card))}>Lab</button>
                )}
                {player.hasMuseum && !playerBlocked && !cc.isWitch && !cc.used_museum && (
                  <button onClick={() => act(() => cc.underMuseum(game, card))}>Museum</button>
                )}
              </>
            )}
            {/* Build actions */}
            {card.onWizard ? (
              <>
                <div className="character-notes">wizard</div>
                <div className={`sprite ${card.name} card-item card-item-clickable`}
                  onClick={() => act(() => cc && cc.wizardBuild(game, card))} />
              </>
            ) : (
              <div
                className={`sprite ${card.name} card-item${isActive && cc && !cc.choosed_to_discard ? ' card-item-clickable' : ''}`}
                onClick={isActive && cc && !cc.choosed_to_discard ? () => act(() => cc.build(game, card)) : undefined}
              />
            )}
          </Tooltip>
        ))}
      </div>
      {isActive && cc && cc.choosed_to_discard && (
        <button className="discard-button" onClick={() => act(() => cc.discardCards(game))}>Discard</button>
      )}
    </div>
  );
}

// ─── Graveyard prompt ────────────────────────────────────────────────────────

function GraveyardPrompt({ game, player, update }) {
  const act = (fn) => { fn(); update(); game.checkAutoPlay(); };
  const card = game.deck.card_on_graveyard;
  if (!player.hasGraveyard || !card || !player.coins) return null;
  return (
    <>
      <p>Do you want to pay 1 coin for taking this card?</p>
      <Tooltip text={card.desc}>
        <div className={`sprite ${card.name} card-item`} />
      </Tooltip>
      <button onClick={() => act(() => player.useGraveyard(game, true))}>Yes</button>
      <button onClick={() => act(() => player.useGraveyard(game, false))}>No</button>
    </>
  );
}

// ─── Coronation prompt ───────────────────────────────────────────────────────

function CoronationPrompt({ game, player, update }) {
  const act = (fn) => { fn(); update(); game.checkAutoPlay(); };
  if (!player.on_coronation || game.phazeIsEnd) return null;
  return (
    <div className="magic-buttons">
      <button onClick={() => act(() => player.giveCoinForCrown(game))}>Give coin for crown</button>
      <button onClick={() => act(() => player.giveCardForCrown(game))}>Give card for crown</button>
    </div>
  );
}

// ─── Game board ───────────────────────────────────────────────────────────────

function GameBoard({ game, update }) {
  // UI ONLY: controls visibility of the game log on mobile
  const [logOpen, setLogOpen] = useState(false);
  const act = (fn) => { fn(); update(); game.checkAutoPlay(); };
  const cc = game.currentCharacter;

  const handleDestroy = (targetPlayer) => (district) => {
    act(() => {
      if (targetPlayer === game.activePlayer) return;
      if (game.activePlayer === game.player1 && game.player1Blocked) return;
      if (game.activePlayer === game.player2 && game.player2Blocked) return;
      if (game.activePlayer.is_robot && game.automatic) return;
      if (cc && cc.isWarlord) cc.destroy(game, targetPlayer, district);
    });
  };

  const handleSwap = (district) => {
    act(() => {
      const player_to = game.activePlayer === game.player2 ? game.player1 : game.player2;
      if (game.activePlayer === game.player1 && game.player1Blocked) return;
      if (game.activePlayer === game.player2 && game.player2Blocked) return;
      if (game.activePlayer.is_robot && game.automatic) return;
      if (cc && cc.isDiplomat) cc.swap(game, player_to, district);
    });
  };

  return (
    <>
      {/* Head block */}
      <div className="head-block">
        <div className="title-block">
          <h1>Game: {game.name}</h1>
          <h3>(to {game.player1.districts_to_close} districts)</h3>
        </div>
        {/* .head-phase is its own grid item (not nested in .title-block) so its
            dynamic, sometimes-long status text — which can wrap to another
            line on narrow screens — has its own row and can never grow into
            the finish button's reserved column. See .head-block in style.css. */}
        {!game.phazeIsEnd && (
          <h2 className="head-phase">
            Phaze: {game.phaze}.{' '}
            {game.phazeIsAction && cc && <>King summons {cc.name}. </>}
            {!game.player1.on_coronation && !game.player2.on_coronation && (
              <>
                {game.activePlayer.name}&apos;s turn
                {game.automatic && game.activePlayer.is_robot && game.activePlayer.time > 0 &&
                  ` (0:0${game.activePlayer.time})`}
              </>
            )}
            {game.player1.on_coronation && <>{game.player1.name}&apos;s turn</>}
            {game.player2.on_coronation && <>{game.player2.name}&apos;s turn</>}
          </h2>
        )}
        {game.phazeIsEnd && <h2 className="head-phase">Game finished! The winner is {game.winner}</h2>}
        {!game.phazeIsEnd && (
          <button className="finish" onClick={() => game.finish()}>Finish game</button>
        )}
        {game.phazeIsEnd && (
          <button className="restart" onClick={() => act(() => game.restart())}>Start new game</button>
        )}
      </div>

      {/* Player 1 action panel */}
      {!game.hidePlayer1Cards && game.youActivePlayer && (
        <ActionPanel game={game} isPlayer1={true} update={update} />
      )}

      {/* Player 1 graveyard prompt */}
      {!game.hidePlayer1Cards && (
        <GraveyardPrompt game={game} player={game.player1} update={update} />
      )}

      {/* Player 1 coronation */}
      {game.player1.on_coronation && !game.phazeIsEnd && (
        <CoronationPrompt game={game} player={game.player1} update={update} />
      )}

      {/* Player 1 hand */}
      {!game.hidePlayer1Cards && (
        <PlayerCards game={game} isPlayer1={true} update={update} />
      )}

      {/* Player 1 board */}
      <PlayerBoard
        player={game.player1}
        hide={game.hidePlayer1Cards}
        currentCharacter={cc}
        game={game}
        onDestroy={handleDestroy(game.player1)}
        onSwap={handleSwap}
        boardClass="board-1"
      />

      {/* Player 2 board */}
      <PlayerBoard
        player={game.player2}
        hide={game.hidePlayer2Cards}
        currentCharacter={cc}
        game={game}
        onDestroy={handleDestroy(game.player2)}
        onSwap={handleSwap}
        boardClass="board-2"
      />

      {/* Player 2 (robot) section */}
      {!game.hidePlayer2Cards && (
        <>
          {game.player2.hasGraveyard && game.deck.card_on_graveyard && game.player2.coins > 0 && (
            <GraveyardPrompt game={game} player={game.player2} update={update} />
          )}
          {game.player2.on_coronation && !game.phazeIsEnd && (
            <CoronationPrompt game={game} player={game.player2} update={update} />
          )}
          <PlayerCards game={game} isPlayer1={false} update={update} />
          {game.robotActivePlayer && (
            <ActionPanel game={game} isPlayer1={false} update={update} />
          )}
        </>
      )}

      {/* Game notes — collapsible on mobile via UI ONLY state */}
      <p className="notes-head">
        Game notes
        {/* UI ONLY: toggle button shown via CSS only on mobile */}
        <button
          className="log-toggle"
          onClick={() => setLogOpen(v => !v)}
          aria-expanded={logOpen}
          aria-label={logOpen ? 'Hide game notes' : 'Show game notes'}
        >
          {logOpen ? '▲' : '▼'}
        </button>
      </p>
      <div className={`gamenotes-block${logOpen ? ' log-open' : ''}`}>
        {game.characters && game.characters.content.map((character, i) => (
          <span key={i}>
            {character.isAssassinated && <>{character.name} is assassinated<br /></>}
            {character.isBewitched && <>{character.name} is bewitched<br /></>}
            {character.isRobbed && <>{character.name} is robbed<br /></>}
          </span>
        ))}
      </div>
    </>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const gameRef = useRef(null);
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  const [gameName, setGameName] = useState('');
  const [yourName, setYourName] = useState('');
  const [robotName, setRobotName] = useState('');
  const [extendedChars, setExtendedChars] = useState({ 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false, 8: false });

  if (!gameRef.current) {
    const g = new Game();
    if (localStorage.getItem('game')) {
      g.load(localStorage.getItem('game'));
    }
    gameRef.current = g;
  }

  const game = gameRef.current;

  const update = useCallback(() => forceUpdate(), []);

  useEffect(() => {
    game.notifyUI = update;
    return () => { game.notifyUI = null; };
  }, [game, update]);

  // After loading a saved game, trigger auto-play if needed
  useEffect(() => {
    if (!game.phazeIsStart) game.checkAutoPlay();
  }, []);

  const handleStart = (gameName_, yourName_, robotName_, extended) => {
    if (game.is_extended && !extended.length) {
      game.showError('You should choose at least one extended character');
      return;
    }
    const namesArr = { 'Game name': gameName_, 'Your name': yourName_, 'Robot name': robotName_ };
    for (const [key, val] of Object.entries(namesArr)) {
      if (val && !val.match(/^[0-9A-Za-z_ -]+$/)) {
        game.showError(key + ' can contain only the characters: 0-9, A-Z, a-z, _, -, and spaces');
        return;
      }
    }
    if (yourName_ && robotName_ && yourName_ === robotName_) {
      game.showError('Your name and robot name should not be the same');
      return;
    }
    game.start(gameName_ || 'New Game', yourName_ || 'Human', robotName_ || 'Robot', extended);
    update();
    game.checkAutoPlay();
  };

  const handleSetExtended = (val) => {
    game.is_extended = val;
    update();
  };

  const handleRandomExtended = () => {
    const gen_arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const ext_cnt = Math.random() < 0.5 ? 6 : 7;
    for (let i = 0; i < ext_cnt; i++) gen_arr.splice(Math.floor(Math.random() * gen_arr.length), 1);
    const newExt = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false, 8: false };
    gen_arr.forEach(n => { newExt[n] = true; });
    setExtendedChars(newExt);
  };

  return (
    <div className="main-block">
      {game.phazeIsStart ? (
        <StartScreen
          game={game}
          onStart={handleStart}
          onSetExtended={handleSetExtended}
          onRandomExtended={handleRandomExtended}
          gameName={gameName} setGameName={setGameName}
          yourName={yourName} setYourName={setYourName}
          robotName={robotName} setRobotName={setRobotName}
          extendedChars={extendedChars} setExtendedChars={setExtendedChars}
        />
      ) : (
        <GameBoard game={game} update={update} />
      )}
    </div>
  );
}
