// Utility: sort an array by a property, returning a new array
export function sortBy(arr, prop) {
  return [...arr].sort((a, b) => (a[prop] > b[prop] ? 1 : a[prop] < b[prop] ? -1 : 0));
}

export class Character {
  constructor() {
    this.player = null;
    this.handle_player = null;
    this.took = 0;
    this.taking = false;
    this.built = 0;
    this.max_build = 1;
    this.used_workshop = false;
    this.used_lab = false;
    this.used_museum = false;
    this.thanked = false;
    this.is_current = false;
    this.status = 'in_round'; // in_round, in_hand, discarded
    this.pic_class = '';
    this.state = 'normal'; // normal, assassinated, robbed, bewitched
    this.revealed = false;
    // subclass identifiers
    this.isAssassin = false;
    this.isThief = false;
    this.isMagician = false;
    this.isColor = false;
    this.isWarlord = false;
    this.isWitch = false;
    this.isWizard = false;
    this.isEmperor = false;
    this.isNavigator = false;
    this.isDiplomat = false;
  }

  get canTake() { return true; }
  get can_build() { return this.built < this.max_build; }
  get inRound() { return this.status === 'in_round'; }
  get isAssassinated() { return this.state === 'assassinated'; }
  get isRobbed() { return this.state === 'robbed'; }
  get isBewitched() { return this.state === 'bewitched'; }
  get isWarlordAndHuman() { return this.name === 'Warlord' && this.player && !this.player.is_robot; }
  get isDiplomatAndHuman() { return this.name === 'Diplomat' && this.player && !this.player.is_robot; }

  reveal(game) {
    this.revealed = true;
    if (this.state === 'assassinated' || this.status === 'discarded') {
      if (!this.player || !this.player.hasDistrict('hospital')) {
        this.endTurn(game);
        return;
      }
    }
    if (this.state === 'robbed') {
      const thiefChar = game.characters.content.find(c => c.name === 'Thief');
      const thief_owner = thiefChar ? thiefChar.handle_player : null;
      if (thief_owner) {
        const coins = this.player.coins;
        this.player.coins = 0;
        thief_owner.coins += coins;
      }
    }
    this.handle_player = this.player;
    game.activePlayer = this.handle_player;
    this.is_current = true;
  }

  takeCoins(game) {
    if (this.took || this.taking) return;
    this.taking = true;
    this.handle_player.coins += 2;
    this.took = 1 + this.handle_player.hasDistrict('library');
    this.checkAssassinated(game);
    this.checkBewitched(game);
    this.checkThanked(game);
  }

  chooseCard(game) {
    if (this.took || this.taking) return;
    this.taking = true;
    const deck_content = game.deck.content;
    const cards_to_choose = this.handle_player.hasDistrict('observatory') ? 3 : 2;

    for (let j = 0; j < cards_to_choose; j++) {
      let chosen = false;
      while (!chosen) {
        const n = Math.floor(Math.random() * deck_content.length);
        const card = deck_content[n];
        if (card.status === 'in_deck') {
          card.status = 'on_choice';
          card.player = this.handle_player;
          chosen = true;
        }
      }
    }

    if (1 + this.handle_player.hasDistrict('library') === cards_to_choose) {
      const cards_on_choice = deck_content.filter(c => c.status === 'on_choice');
      for (let k = 0; k < cards_on_choice.length; k++) {
        this.takeCard(game, cards_on_choice[k]);
      }
    }
  }

  takeCard(game, card) {
    if (card && card.status === 'on_choice' && card.player === this.handle_player) {
      card.status = 'in_hand';
      this.handle_player.cards.push(card);
    }
    this.took++;
    if (this.took === 1 + this.handle_player.hasDistrict('library')) {
      game.deck.content.filter(c => c.status === 'on_choice').forEach(c => {
        c.status = 'in_deck';
        c.player = null;
      });
      this.checkAssassinated(game);
      this.checkBewitched(game);
      this.checkThanked(game);
    }
  }

  build(game, card) {
    if (this.built === this.max_build) return;
    if (!this.took || game.deck.cards_on_choose) return;
    if (card.status !== 'in_hand') return;
    if (card.player !== this.handle_player) return;

    const build_cost = card.cost - (this.handle_player.hasDistrict('factory') && card.color === 'purple' ? 1 : 0);
    if (build_cost > this.handle_player.coins) {
      game.showError("You don't have enough coins to build this district");
      return;
    }
    if (this.handle_player.districts.filter(d => d.name === card.name).length > this.handle_player.hasDistrict('quarry')) {
      game.showError("You can't build dublicate district");
      return;
    }

    card.status = 'built';
    if (card.name === 'belltower') this.handle_player.can_use_belltower = true;
    if (card.name === 'lighthouse') this.handle_player.can_use_lighthouse = true;
    this.handle_player.districts.push(card);
    game.checkFirstClosed(this.handle_player);
    this.handle_player.coins -= build_cost;
    this.built++;
    const idx = this.handle_player.cards.indexOf(card);
    if (idx > -1) this.handle_player.cards.splice(idx, 1);
  }

  endTurn(game) {
    if (this.status === 'in_hand') this.payTax(game);
    if (this.handle_player && !this.handle_player.coins && this.handle_player.hasDistrict('poorhouse'))
      this.handle_player.coins = 1;
    if (this.handle_player && !this.handle_player.cards.length && this.handle_player.hasDistrict('park'))
      game.drawCards(this.handle_player, 2);
    if (this.handle_player && this.handle_player.can_use_belltower)
      this.handle_player.can_use_belltower = false;
    if (this.handle_player && this.handle_player.using_lighthouse)
      this.handle_player.using_lighthouse = false;
    if (this.handle_player && this.handle_player.can_use_lighthouse)
      this.handle_player.can_use_lighthouse = false;
    if (this.handle_player && this.handle_player.exploding)
      this.handle_player.exploding = false;
    this.is_current = false;
    game.nextCharacter();
  }

  payTax(game) {
    const tax = game.characters.content.find(c => c.name === 'Tax');
    if (tax && tax.status === 'in_hand') {
      if (tax.state === 'assassinated') return;
      const tax_owner = tax[this.isAssassin ? 'player' : 'handle_player'];
      if (tax_owner === this.handle_player) return;
      if (!this.built) return;
      if (!this.handle_player.coins) return;
      this.handle_player.coins--;
      tax_owner.coins++;
    }
  }

  checkBewitched(game) {
    if (this.state === 'bewitched') {
      const witchChar = game.characters.content.find(c => c.name === 'Witch');
      const witch_owner = witchChar ? witchChar.player : null;
      if (witch_owner) {
        this.handle_player = witch_owner;
        game.activePlayer = witch_owner;
      }
    }
  }

  checkAssassinated(game) {
    if (this.state === 'assassinated') this.endTurn(game);
  }

  checkThanked(game) {
    if (this.state === 'bewitched') return;
    const ballroom = game.deck.content.find(c => c.name === 'ballroom');
    if (ballroom && ballroom.status === 'built') {
      const ballroom_owner = ballroom.player;
      if (ballroom_owner !== this.player && ballroom_owner.has_crown && !this.thanked)
        this.endTurn(game);
    }
  }

  useWorkshop(game) {
    if (!this.handle_player.hasWorkshop) return;
    if (this.used_workshop) return;
    if (this.handle_player.coins < 2) { game.showError('Not enough coins'); return; }
    this.handle_player.coins -= 2;
    game.drawCards(this.handle_player, 3);
    this.used_workshop = true;
  }

  useLab(card) {
    if (!this.handle_player.hasLab) return;
    if (this.used_lab) return;
    if ((card.status === 'in_hand' || card.status === 'on_wizard') && card.player === this.handle_player) {
      card.status = 'in_lab';
      card.player = null;
      const idx = this.handle_player.cards.indexOf(card);
      if (idx > -1) this.handle_player.cards.splice(idx, 1);
      this.handle_player.coins++;
      this.used_lab = true;
    }
  }

  underMuseum(game, card) {
    if (!this.handle_player.hasMuseum) return;
    if (this.used_museum) return;
    if (card.status !== 'in_hand' && card.status !== 'on_wizard') return;
    if (card.player !== this.handle_player) return;
    card.status = 'in_museum';
    const idx = this.handle_player.cards.indexOf(card);
    if (idx > -1) this.handle_player.cards.splice(idx, 1);
    card.player = null;
    game.player1.cards_under_museum++;
    game.player2.cards_under_museum++;
    this.used_museum = true;
  }

  resetParams() {
    this.player = null;
    this.handle_player = null;
    this.took = 0;
    this.taking = false;
    this.revealed = false;
    this.built = 0;
    this.state = 'normal';
    this.status = 'in_round';
    this.used_workshop = false;
    this.used_lab = false;
    this.used_museum = false;
    this.thanked = false;
  }

  thanksYourExcellency() {
    this.thanked = true;
  }

  serialize() {
    return {
      player: this.player ? this.player.name : null,
      handle_player: this.handle_player ? this.handle_player.name : null,
      revealed: this.revealed,
      took: this.took,
      taking: this.taking,
      built: this.built,
      used_workshop: this.used_workshop,
      used_lab: this.used_lab,
      used_museum: this.used_museum,
      status: this.status,
      state: this.state,
      thanked: this.thanked,
      is_current: this.is_current
    };
  }
}

export class Assassin extends Character {
  constructor() {
    super();
    this.name = 'Assassin';
    this.desc = 'Assassin. May select a character to Assassinate. That character loses their turn.';
    this.isAssassin = true;
    this.number = 1;
    this.pic_class = 'character1';
    this.assassinated = false;
  }
  assassinate(character) {
    if (this.assassinated) return;
    if (character.isAssassin) return;
    character.state = 'assassinated';
    this.assassinated = true;
  }
  resetParams() { super.resetParams(); this.assassinated = false; }
  serialize() { return { ...super.serialize(), assassinated: this.assassinated }; }
}

export class Thief extends Character {
  constructor() {
    super();
    this.name = 'Thief';
    this.desc = 'Thief. May select a character to steal from. At the start of their turn, the Thief takes their gold.';
    this.isThief = true;
    this.number = 2;
    this.pic_class = 'character2';
    this.robbed = false;
  }
  rob(character) {
    if (this.robbed) return;
    if (character.number === 1 || character.isThief) return;
    if (character.state === 'assassinated' || character.state === 'bewitched') return;
    character.state = 'robbed';
    this.robbed = true;
  }
  resetParams() { super.resetParams(); this.robbed = false; }
  serialize() { return { ...super.serialize(), robbed: this.robbed }; }
}

export class Magician extends Character {
  constructor() {
    super();
    this.name = 'Magician';
    this.desc = 'Magician. May either exchange hands with another player, or swap cards in his hand for cards from the deck.';
    this.isMagician = true;
    this.number = 3;
    this.pic_class = 'character3';
    this.did_magic = false;
    this.choosed_to_discard = false;
    this.discarded = false;
  }
  exchange_cards(game, player) {
    if (this.did_magic) return;
    const cards_in_hand = game.deck.content.filter(c => c.status === 'in_hand');
    for (let j = 0; j < cards_in_hand.length; j++) {
      const card = cards_in_hand[j];
      if (card.player === player) {
        card.player = this.handle_player;
        this.handle_player.cards.push(card);
        const idx = player.cards.indexOf(card);
        if (idx > -1) player.cards.splice(idx, 1);
      } else if (card.player === this.handle_player) {
        card.player = player;
        player.cards.push(card);
        const idx = this.handle_player.cards.indexOf(card);
        if (idx > -1) this.handle_player.cards.splice(idx, 1);
      }
    }
    this.did_magic = true;
  }
  chooseToDiscard() {
    if (this.did_magic) return;
    this.choosed_to_discard = true;
    this.did_magic = true;
  }
  discardCards(game) {
    if (!this.choosed_to_discard || this.discarded) return;
    const deck_content = game.deck.content;
    const checked_cards = deck_content.filter(c => c.isChecked);
    game.drawCards(this.handle_player, checked_cards.length);
    checked_cards.forEach(item => {
      item.isChecked = false;
      item.status = 'in_deck';
      item.player = null;
      const idx = this.handle_player.cards.indexOf(item);
      if (idx > -1) this.handle_player.cards.splice(idx, 1);
    });
    this.choosed_to_discard = false;
    this.discarded = true;
  }
  resetParams() {
    super.resetParams();
    this.did_magic = false;
    this.choosed_to_discard = false;
    this.discarded = false;
  }
  serialize() {
    return { ...super.serialize(), did_magic: this.did_magic, choosed_to_discard: this.choosed_to_discard, discarded: this.discarded };
  }
}

export class ColourCharacter extends Character {
  constructor() {
    super();
    this.isColor = true;
    this.took_income = false;
    this.color = '';
  }
  takeIncome() {
    if (this.took_income) return;
    this.handle_player.districts.forEach(d => {
      if (d.color === this.color) this.handle_player.coins++;
    });
    this.handle_player.coins += this.handle_player.hasDistrict('school');
    this.took_income = true;
  }
  resetParams() { super.resetParams(); this.took_income = false; }
  serialize() { return { ...super.serialize(), took_income: this.took_income }; }
}

export class King extends ColourCharacter {
  constructor() {
    super();
    this.name = 'King';
    this.desc = 'King. Receives income for Noble (yellow) Districts. Also gets first choice of characters during the next turn.';
    this.number = 4;
    this.color = 'yellow';
    this.pic_class = 'character4';
  }
  reveal(game) {
    if (this.status === 'in_hand') game.setCrownTo(this.player);
    super.reveal(game);
  }
}

export class Bishop extends ColourCharacter {
  constructor() {
    super();
    this.name = 'Bishop';
    this.desc = 'Bishop. Receives income from Religious (blue) Districts. His Buildings cannot be Destroyed by the Warlord or swapped by the Diplomat.';
    this.number = 5;
    this.color = 'blue';
    this.pic_class = 'character5';
  }
}

export class Merchant extends ColourCharacter {
  constructor() {
    super();
    this.name = 'Merchant';
    this.desc = 'Merchant. Receives income from Trade (green) Districts. Also receives one gold at the start of his turn.';
    this.number = 6;
    this.color = 'green';
    this.pic_class = 'character6';
  }
  takeCoins(game) {
    if (this.took) return;
    super.takeCoins(game);
    if (this.is_current) this.handle_player.coins++;
  }
  takeCard(game, card) {
    super.takeCard(game, card);
    if (this.is_current && this.took === 1 + this.player.hasDistrict('library'))
      this.handle_player.coins++;
  }
}

export class Architect extends Character {
  constructor() {
    super();
    this.name = 'Architect';
    this.desc = 'Architect. Receives 2 additional cards when he takes his 2 gold or 1 card. Can build up to 3 Districts per turn.';
    this.number = 7;
    this.pic_class = 'character7';
    this.max_build = 3;
  }
  takeCoins(game) {
    if (this.took) return;
    super.takeCoins(game);
    if (this.is_current) this._take2Cards(game);
  }
  takeCard(game, card) {
    super.takeCard(game, card);
    if (this.is_current && this.took === 1 + this.player.hasDistrict('library'))
      this._take2Cards(game);
  }
  _take2Cards(game) { game.drawCards(this.handle_player, 2); }
}

export class Warlord extends ColourCharacter {
  constructor() {
    super();
    this.name = 'Warlord';
    this.desc = 'Warlord. Receives income from Military (red) Districts. At the end of his turn, he may destroy a District for the cost of that District -1 gold.';
    this.isWarlord = true;
    this.number = 8;
    this.pic_class = 'character8';
    this.color = 'red';
    this.destroyed = false;
  }
  destroy(game, player_to, district) {
    if (this.destroyed) return;
    if (player_to.closed) {
      game.showError("You can't destroy district in the city with " + player_to.districts_to_close + ' or more districts');
      return;
    }
    if (district.name === 'keep') { game.showError('Keep can not be destroyed'); return; }
    const bishop = game.characters.content.find(c => c.name === 'Bishop');
    if (bishop && bishop.state !== 'assassinated' && bishop.handle_player === player_to) {
      game.showError("You can't destroy Bishop's district"); return;
    }
    const destroyCost = district.cost + player_to.hasDistrict('greatwall') - (district.name === 'greatwall' ? 1 : 0) - 1;
    if (destroyCost > this.handle_player.coins) {
      game.showError('You have not enough coins to destroy this district'); return;
    }
    if (district.status === 'built' && district.player === player_to) {
      this.handle_player.coins -= (district.cost + player_to.hasDistrict('greatwall') - (district.name === 'greatwall' ? 1 : 0) - 1);
      const idx = player_to.districts.indexOf(district);
      if (idx > -1) player_to.districts.splice(idx, 1);
      const canGraveyard = player_to.hasGraveyard && player_to.coins;
      district.status = canGraveyard ? 'on_graveyard' : 'destroyed';
      if (canGraveyard) player_to.on_graveyard = true;
      if (district.name === 'belltower') player_to.cancelRing(game);
      district.player = null;
      this.destroyed = true;
    }
  }
  resetParams() { super.resetParams(); this.destroyed = false; }
  serialize() { return { ...super.serialize(), destroyed: this.destroyed }; }
}

// --- Extended characters ---

export class Witch extends Character {
  constructor() {
    super();
    this.name = 'Witch';
    this.desc = 'Witch. Can Bewitch a character of her choice, playing part of her turn with the chosen character skills.';
    this.isWitch = true;
    this.number = 1;
    this.pic_class = 'character11';
    this.max_build = 0;
    this.bewitched = false;
  }
  bewitch(character) {
    if (this.bewitched) return;
    if (character.isWitch) return;
    character.state = 'bewitched';
    this.bewitched = true;
  }
  resetParams() { super.resetParams(); this.bewitched = false; }
  serialize() { return { ...super.serialize(), bewitched: this.bewitched }; }
}

export class TaxCollector extends Character {
  constructor() {
    super();
    this.name = 'Tax';
    this.desc = 'Tax Collector. Each other player that builds at least one District in her turn, gives one gold to the Tax Collector.';
    this.number = 2;
    this.pic_class = 'character12';
  }
}

export class Wizard extends Character {
  constructor() {
    super();
    this.name = 'Wizard';
    this.desc = 'Wizard. Can choose a card from the hand of another player. Then, he can choose to put in his hand or to build it, regardless of the normal building in this turn.';
    this.isWizard = true;
    this.number = 3;
    this.pic_class = 'character13';
    this.stole = false;
    this.wizard_built = false;
  }
  stealCard(player, card) {
    if (this.stole) return;
    card.status = 'on_wizard';
    card.player = this.handle_player;
    const idx = player.cards.indexOf(card);
    if (idx > -1) player.cards.splice(idx, 1);
    this.handle_player.cards.push(card);
    this.stole = true;
  }
  wizardBuild(game, card) {
    if (this.wizard_built) return;
    if (card.status !== 'on_wizard') return;
    if (card.player !== this.handle_player) return;
    const build_cost = card.cost - (this.handle_player.hasDistrict('factory') && card.color === 'purple' ? 1 : 0);
    if (build_cost > this.handle_player.coins) {
      game.showError("You don't have enough coins to build this district"); return;
    }
    card.status = 'built';
    this.handle_player.districts.push(card);
    this.handle_player.coins -= build_cost;
    this.wizard_built = true;
    const idx = this.handle_player.cards.indexOf(card);
    if (idx > -1) this.handle_player.cards.splice(idx, 1);
    game.checkFirstClosed(this.handle_player);
  }
  endTurn(game) {
    if (this.status === 'in_hand' && this.state !== 'assassinated') {
      this.handle_player.cards.forEach(card => { card.status = 'in_hand'; });
    }
    super.endTurn(game);
  }
  resetParams() { super.resetParams(); this.stole = false; this.wizard_built = false; }
  serialize() { return { ...super.serialize(), stole: this.stole, wizard_built: this.wizard_built }; }
}

export class Emperor extends ColourCharacter {
  constructor() {
    super();
    this.name = 'Emperor';
    this.desc = 'Emperor. Receives income from Noble (gold) Districts. You must give the Crown to another player, who has to pay you a gold piece or a card (your choice).';
    this.isEmperor = true;
    this.number = 4;
    this.color = 'yellow';
    this.pic_class = 'character14';
    this.coronated = false;
  }
  get canTake() { return this.coronated || this.state === 'bewitched'; }
  coronate(game, player) {
    if (player !== this.handle_player) {
      if (!player.coins) {
        player.giveCardForCrown(game);
        this.coronated = true;
      } else if (!player.cards.length) {
        player.giveCoinForCrown(game);
        this.coronated = true;
      } else {
        player.on_coronation = true;
      }
    }
  }
  resetParams() { super.resetParams(); this.coronated = false; }
  serialize() { return { ...super.serialize(), coronated: this.coronated }; }
}

export class Abbot extends ColourCharacter {
  constructor() {
    super();
    this.name = 'Abbot';
    this.desc = 'Abbot. Receives income from Religious (blue) Districts. The most rich player must give him a gold piece.';
    this.number = 5;
    this.color = 'blue';
    this.pic_class = 'character15';
  }
  reveal(game) {
    if (this.state === 'assassinated' || this.status === 'discarded' || this.state === 'bewitched') {
      super.reveal(game);
    } else {
      super.reveal(game);
      this.stealCoin(game);
    }
  }
  checkBewitched(game) {
    super.checkBewitched(game);
    if (this.state === 'bewitched') this.stealCoin(game);
  }
  stealCoin(game) {
    const handle_player = this.handle_player;
    const player_from = handle_player === game.player2 ? game.player1 : game.player2;
    if (player_from.coins > handle_player.coins) {
      player_from.coins--;
      handle_player.coins++;
    }
  }
}

export class Alchemist extends Character {
  constructor() {
    super();
    this.name = 'Alchemist';
    this.desc = 'Alchemist. He receives the total cost of a District after building it.';
    this.number = 6;
    this.pic_class = 'character16';
  }
  build(game, card) {
    if (this.built === this.max_build) return;
    const coins_to_return = card.cost - (this.handle_player.hasDistrict('factory') && card.color === 'purple' ? 1 : 0);
    super.build(game, card);
    if (this.built) this.handle_player.coins += coins_to_return;
  }
}

export class Navigator extends Character {
  constructor() {
    super();
    this.name = 'Navigator';
    this.desc = 'Navigator. You can take 4 gold or 4 cards. You cannot build.';
    this.isNavigator = true;
    this.number = 7;
    this.max_build = 0;
    this.pic_class = 'character17';
    this.navigated = false;
  }
  take4Cards(game) {
    if (this.navigated) return;
    game.drawCards(this.handle_player, 4);
    this.navigated = true;
  }
  take4Coins() {
    if (this.navigated) return;
    this.handle_player.coins += 4;
    this.navigated = true;
  }
  resetParams() { super.resetParams(); this.navigated = false; }
  serialize() { return { ...super.serialize(), navigated: this.navigated }; }
}

export class Diplomat extends ColourCharacter {
  constructor() {
    super();
    this.name = 'Diplomat';
    this.desc = "Diplomat. Receives income from Military (red) Districts. He can swap a District he owns for one of other player's (except the Bishop), paying them the difference.";
    this.isDiplomat = true;
    this.number = 8;
    this.color = 'red';
    this.pic_class = 'character18';
    this.swapped = false;
  }
  swap(game, player, district) {
    if (this.swapped) return;
    if (player === this.handle_player) return;
    if (district.status === 'on_swap') return;
    if (district.player.districts.filter(d => d.status === 'on_swap').length) return;
    district.status = 'on_swap';
    const myOnSwap = this.handle_player.districts.filter(d => d.status === 'on_swap').length;
    const theirOnSwap = player.districts.filter(d => d.status === 'on_swap').length;
    if (!myOnSwap || !theirOnSwap) return;

    const your_district = this.handle_player.districts.find(d => d.status === 'on_swap');
    const enemy_district = player.districts.find(d => d.status === 'on_swap');

    if (player.closed) {
      game.showError("You can't swap district in the city with " + player.districts_to_close + ' or more districts');
    } else if (enemy_district.name === 'keep') {
      game.showError('Keep can not be swapped');
    } else if (player.characters.find(c => c.name === 'Bishop') &&
      player.characters.find(c => c.name === 'Bishop').state !== 'assassinated' &&
      player.characters.find(c => c.name === 'Bishop').handle_player === player) {
      game.showError('You cannot swap with Bishop');
    } else if (enemy_district.cost + player.hasDistrict('greatwall') - (enemy_district.name === 'greatwall' ? 1 : 0) >
      your_district.cost + this.handle_player.coins) {
      game.showError('Not enough coins to swap this district');
    } else if (player.districts.filter(d => d.name === your_district.name).length > player.hasDistrict('quarry') ||
      this.handle_player.districts.filter(d => d.name === enemy_district.name).length > this.handle_player.hasDistrict('quarry')) {
      game.showError('You cannot swap dublicate districts');
    } else {
      let compensation = 0;
      const enemy_cost = enemy_district.cost + player.hasDistrict('greatwall') - (enemy_district.name === 'greatwall' ? 1 : 0);
      if (enemy_cost > your_district.cost)
        compensation = enemy_cost - your_district.cost;
      this.handle_player.coins -= compensation;
      player.coins += compensation;
      const ei = player.districts.indexOf(enemy_district);
      if (ei > -1) player.districts.splice(ei, 1);
      player.districts.push(your_district);
      const yi = this.handle_player.districts.indexOf(your_district);
      if (yi > -1) this.handle_player.districts.splice(yi, 1);
      this.handle_player.districts.push(enemy_district);
      your_district.player = player;
      enemy_district.player = this.handle_player;
      if (your_district.name === 'city') your_district.color = 'purple';
      if (enemy_district.name === 'city') enemy_district.color = 'purple';
      this.swapped = true;
    }
    your_district.status = 'built';
    enemy_district.status = 'built';
  }
  resetParams() { super.resetParams(); this.swapped = false; }
  serialize() { return { ...super.serialize(), swapped: this.swapped }; }
}
