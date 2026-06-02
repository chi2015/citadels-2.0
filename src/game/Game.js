import Swal from 'sweetalert2';
import { Player } from './Player.js';
import { Deck } from './Deck.js';
import { Characters } from './Characters.js';
import { Strategy } from './Strategy.js';

export class Game {
  constructor() {
    this.name = 'new game';
    this.version = '1.1.2';
    this.player1 = null;
    this.player2 = null;
    this.player1_strategy = null;
    this.player2_strategy = null;
    this.activePlayer = null;
    this.deck = null;
    this.characters = null;
    this.currentCharacter = null;
    this.first_full_city = false;
    this.automatic = true;
    this.hide_robot_cards = true;
    this.winner = '';
    this.is_extended = false;
    this.extended = [];
    this.phaze = 'start';
    this.notifyUI = null; // set by React to trigger re-render

    this._bindUnload();
  }

  _bindUnload() {
    window.addEventListener('beforeunload', () => { this.save(); });
  }

  get phazeIsStart() { return this.phaze === 'start'; }
  get phazeIsChoose() { return this.phaze === 'choose'; }
  get phazeIsDiscard() { return this.phaze === 'discard'; }
  get phazeIsAction() { return this.phaze === 'action'; }
  get phazeIsEnd() { return this.phaze === 'end'; }

  get youActivePlayer() { return this.activePlayer === this.player1; }
  get robotActivePlayer() { return this.activePlayer === this.player2; }

  get hidePlayer1Cards() {
    return this.automatic && this.hide_robot_cards && this.player1 && this.player1.is_robot;
  }
  get hidePlayer2Cards() {
    return this.automatic && this.hide_robot_cards && this.player2 && this.player2.is_robot;
  }

  get player1Blocked() {
    if (!this.currentCharacter) return false;
    return (
      (this.currentCharacter.state === 'bewitched' &&
        this.currentCharacter.player === this.player1 &&
        this.activePlayer === this.player1) ||
      (this.currentCharacter.state === 'assassinated' &&
        this.currentCharacter.player === this.player1) ||
      (this.player2 && this.player2.hasBallroom &&
        this.player2.has_crown &&
        this.currentCharacter.state !== 'bewitched' &&
        !this.currentCharacter.thanked)
    );
  }

  get player2Blocked() {
    if (!this.currentCharacter) return false;
    return (
      (this.currentCharacter.state === 'bewitched' &&
        this.currentCharacter.player === this.player2 &&
        this.activePlayer === this.player2) ||
      (this.currentCharacter.state === 'assassinated' &&
        this.currentCharacter.player === this.player2) ||
      (this.player1 && this.player1.hasBallroom &&
        this.player1.has_crown &&
        this.currentCharacter.state !== 'bewitched' &&
        !this.currentCharacter.thanked)
    );
  }

  setWinner() {
    if (this.player1.score > this.player2.score) this.winner = this.player1.name;
    else if (this.player1.score < this.player2.score) this.winner = this.player2.name;
    else this.winner = this.player1.name + ', ' + this.player2.name;
  }

  setFirstPlayer() {
    this.activePlayer = Math.random() < 0.5 ? this.player1 : this.player2;
  }

  setStrategy() {
    if (this.player2 && this.player2.is_robot) {
      if (!this.player2_strategy) {
        this.player2_strategy = new Strategy({ game: this, player: this.player2, notifyUI: () => this.notifyUI?.() });
      } else {
        this.player2_strategy.player = this.player2;
        this.player2_strategy.enemy = this.player1;
        this.player2_strategy.notifyUI = () => this.notifyUI?.();
        this.player2_strategy.resetTimer();
      }
    }
    if (this.player1 && this.player1.is_robot) {
      if (!this.player1_strategy) {
        this.player1_strategy = new Strategy({ game: this, player: this.player1, notifyUI: () => this.notifyUI?.() });
      } else {
        this.player1_strategy.player = this.player1;
        this.player1_strategy.enemy = this.player2;
        this.player1_strategy.notifyUI = () => this.notifyUI?.();
        this.player1_strategy.resetTimer();
      }
    }
  }

  setCrownTo(player) {
    const old_crown_owner = this.player1.has_crown ? this.player1 : this.player2;
    this.player1.has_crown = false;
    this.player2.has_crown = false;
    player.has_crown = true;
    if (old_crown_owner !== player) {
      if (this.player1.hasDistrict('throneroom')) this.player1.coins++;
      if (this.player2.hasDistrict('throneroom')) this.player2.coins++;
    }
  }

  start(name, player1_name, player2_name, extended) {
    this.name = name;
    this.extended = extended;
    this.player1 = new Player({ name: player1_name });
    this.player2 = new Player({ name: player2_name, is_robot: true });

    if (this.automatic) this.setStrategy();

    this.setFirstPlayer();
    this.activePlayer.has_crown = true;

    this.deck = new Deck({ extended: this.extended });
    this.drawCards(this.player1, 4);
    this.drawCards(this.player2, 4);

    this.currentCharacter = null;
    this.characters = new Characters({ extended: this.extended });
    this.resetCharacters();
    this.phaze = 'choose';
  }

  finish() {
    Swal.fire({
      title: 'Finishing game',
      text: 'Are you sure you want to finish this game?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes',
      cancelButtonText: 'No',
      customClass: { confirmButton: 'btn btn-success', cancelButton: 'btn btn-danger' },
      buttonsStyling: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.setWinner();
        this.currentCharacter = null;
        this.phaze = 'end';
        this.notifyUI?.();
      }
    });
  }

  restart() {
    this.first_full_city = false;
    this.winner = '';
    this.extended = [];
    this.phaze = 'start';
    this.notifyUI?.();
  }

  showError(text) {
    if (!this.activePlayer || !this.activePlayer.is_robot) {
      Swal.fire('Error', text, 'error');
    }
  }

  save() {
    if (['choose', 'discard', 'action'].includes(this.phaze)) {
      localStorage.setItem('game', JSON.stringify(this.serialize()));
    }
  }

  load(gameData) {
    const game = JSON.parse(gameData);
    this.name = game.name;
    this.first_full_city = game.first_full_city;
    this.phaze = game.phaze;
    this.extended = game.extended;
    this.player1 = new Player(game.player1);
    this.player2 = new Player(game.player2);
    this.setStrategy();

    const gamePlayers = [this.player1, this.player2];
    this.activePlayer = gamePlayers.find(p => p.name === game.activePlayer) || null;

    this.deck = new Deck({ init_deck: game.deck, extended: game.extended });
    this.deck.content.forEach(card => {
      if (card.player) {
        const owner = gamePlayers.find(p => p.name === card.player);
        card.player = owner || null;
        if (owner) {
          if (card.status === 'in_hand' || card.status === 'on_wizard') owner.cards.push(card);
          if (card.status === 'built' || card.status === 'on_swap') owner.districts.push(card);
        }
      }
    });

    this.characters = new Characters({ extended: game.extended });
    this.characters.content.forEach(character => {
      const char_data = game.characters[character.number];
      if (!char_data) return;
      for (const key in char_data) {
        if (key !== 'player' && key !== 'handle_player') character[key] = char_data[key];
      }
      if (char_data.player) {
        const owner = gamePlayers.find(p => p.name === char_data.player);
        const handle = gamePlayers.find(p => p.name === char_data.handle_player);
        character.player = owner || null;
        character.handle_player = handle || null;
        if (owner) owner.characters.push(character);
      }
    });

    this.currentCharacter = game.currentCharacter
      ? this.characters.content.find(c => c.number === game.currentCharacter) || null
      : null;

    localStorage.removeItem('game');
  }

  serialize() {
    const charactersArr = [];
    this.characters.content.forEach(c => { charactersArr[c.number] = c.serialize(); });
    return {
      name: this.name,
      player1: this.player1.serialize(),
      player2: this.player2.serialize(),
      activePlayer: this.activePlayer ? this.activePlayer.name : null,
      currentCharacter: this.currentCharacter ? this.currentCharacter.number : null,
      first_full_city: this.first_full_city,
      phaze: this.phaze,
      extended: this.extended,
      characters: charactersArr,
      deck: this.deck.content.map(c => c.serialize())
    };
  }

  drawCards(player, count) {
    for (let j = 0; j < count; j++) this.drawCard(player);
  }

  drawCard(player, name) {
    const deck_content = this.deck.content;
    let draw = false;
    while (!draw) {
      let card;
      if (name) card = deck_content.find(c => c.name === name);
      else card = deck_content[Math.floor(Math.random() * deck_content.length)];
      if (card && card.status === 'in_deck') {
        card.status = 'in_hand';
        card.player = player;
        player.cards.push(card);
        draw = true;
      }
    }
  }

  toggleActivePlayer() {
    if (this.activePlayer === this.player1) this.activePlayer = this.player2;
    else if (this.activePlayer === this.player2) this.activePlayer = this.player1;
  }

  changePhaze() {
    const characters_rest = this.characters.content.filter(c => c.status === 'in_round').length;
    switch (characters_rest) {
      case 6: case 4: case 2:
        this.toggleActivePlayer();
        this.phaze = 'choose';
        break;
      case 5: case 3:
        this.phaze = 'discard';
        break;
      case 1: {
        const last_character = this.characters.content.find(c => c.status === 'in_round');
        last_character.status = 'discarded';
        this.activePlayer.addToPossibleCharacters(last_character);
        this.phaze = 'action';
        this.nextCharacter();
        break;
      }
    }
  }

  checkFirstClosed(player) {
    if (this.first_full_city) return;
    if (player.closed) {
      this.first_full_city = true;
      player.closed_first = true;
    }
  }

  nextCharacter() {
    const character = this.currentCharacter;
    let n = !character ? 0 : character.number;
    if (n === 8) {
      this.currentCharacter = null;
      if (this.first_full_city) {
        this.phaze = 'end';
        this.setWinner();
      } else {
        this.phaze = 'choose';
        this.activePlayer = this.player1.has_crown ? this.player1 : this.player2;
        const cityCard = this.deck.content.find(c => c.name === 'city');
        if (cityCard && cityCard.status === 'built') cityCard.color = 'city';
      }
      this.resetCharacters();
      return;
    }
    n++;
    this.currentCharacter = this.characters.content.find(c => c.number === n) || null;
    if (this.currentCharacter) this.currentCharacter.reveal(this);
  }

  resetCharacters() {
    const characters = this.characters.content;
    characters.forEach(c => c.resetParams());
    this.player1.characters = [];
    this.player2.characters = [];
    this.player1.possible_characters = [];
    this.player2.possible_characters = [];
    const d = Math.floor(Math.random() * characters.length);
    characters[d].status = 'discarded';
    this.activePlayer.addToPossibleCharacters(characters[d]);
  }

  checkAutoPlay() {
    if (!this.automatic) return;
    const strategy = this.player2_strategy || this.player1_strategy;
    if (!strategy) return;
    const robotPlayer = strategy.player;

    if (robotPlayer.on_coronation || robotPlayer.on_graveyard) {
      strategy.execStrategy(1000);
      return;
    }
    // Also check enemy (player1) graveyard/coronation for completeness
    const enemy = strategy.enemy;
    if (enemy && (enemy.on_graveyard || enemy.on_coronation)) {
      strategy.execStrategy(1000);
      return;
    }

    if (this.activePlayer !== robotPlayer) return;

    if (this.phaze === 'choose' || this.phaze === 'discard') {
      strategy.execStrategy(3000);
    } else if (this.phaze === 'action' && this.currentCharacter && this.currentCharacter.player === robotPlayer) {
      strategy.execStrategy(5000);
    }
  }
}
