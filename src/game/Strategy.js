import { sortBy } from './Character.js';

export class Strategy {
  constructor(config = {}) {
    this.game = config.game;
    this.player = config.player;
    this.notifyUI = config.notifyUI || (() => {});
    this.enemy = this.game.player2 === this.player ? this.game.player1 : this.game.player2;
    this.timer_interval = null;
    this.timeout = null;
  }

  resetTimer() {
    clearInterval(this.timer_interval);
    clearTimeout(this.timeout);
    this.timer_interval = null;
    this.timeout = null;
  }

  execStrategy(time) {
    clearInterval(this.timer_interval);
    clearTimeout(this.timeout);
    this.player.time = Math.floor(time / 1000);
    this.timer_interval = setInterval(() => {
      this.player.time = this.player.time > 0 ? this.player.time - 1 : 0;
      this.notifyUI();
    }, 1000);
    this.timeout = setTimeout(() => {
      clearInterval(this.timer_interval);
      this.timer_interval = null;
      this.timeout = null;
      this.strategy();
      this.notifyUI();
      this.game.checkAutoPlay();
    }, time);
  }

  strategy() {
    if (this.player.on_coronation) this.coronationStrategy();
    if (this.player.on_graveyard) this.graveyardStrategy();
    if (this.game.activePlayer !== this.player) return;
    if (this.game.phaze === 'choose') this.chooseStrategy();
    else if (this.game.phaze === 'discard') this.discardStrategy();
    else if (this.game.phaze === 'action') this.actionStrategy();
  }

  isPossibleEnemyCharacter(number) {
    return this.enemy.possible_characters.includes(number);
  }

  kingChance() {
    if (this.game.characters.content.find(c => c.name === 'Witch')) return 0;
    if (this.game.characters.content.find(c => c.name === 'Navigator')) return 0.6;
    return 0.3;
  }

  dangerCharacters() {
    let characters = this.game.characters.content.filter(c => c.player !== this.player);
    const danger_characters = [];
    const in_round = ['choose', 'discard'].includes(this.game.phaze);
    if (in_round) characters = characters.filter(c => c.status === 'in_round');

    const push = (c) => { if (c && !danger_characters.includes(c)) danger_characters.push(c); return danger_characters; };

    if (characters.find(c => c.number === 1))
      push(characters.find(c => c.number === 1));
    if (in_round && this.player.has_crown && characters.find(c => c.name === 'Thief') && this.enemy.coins > 2)
      push(characters.find(c => c.name === 'Thief'));
    if (characters.find(c => c.name === 'Warlord') && this.warlordIsDangerous() && (in_round || this.isPossibleEnemyCharacter(8)))
      push(characters.find(c => c.name === 'Warlord'));
    if (in_round && this.player.has_crown && characters.find(c => c.name === 'Magician') && this.enemy.cards.length > this.player.cards.length + 2)
      push(characters.find(c => c.name === 'Magician'));
    if ((this.player.coins > 2 ||
      (this.player.characters.find(c => c.name === 'Magician') && this.magicianIsUseful()) ||
      (in_round && (this.player.characters.find(c => c.name === 'Witch') || this.player.characters.find(c => c.name === 'Alchemist') || this.player.characters.find(c => c.name === 'Architect')) && this.player.characters.length === 2))
      && characters.find(c => c.name === 'Thief') && (in_round || this.isPossibleEnemyCharacter(2)))
      push(characters.find(c => c.name === 'Thief'));
    if ((!this.player.characters.find(c => c.name === 'Bishop') || !this.player.has_crown) &&
      this.hasUsefulDistricts(this.player, true) && !this.player.closed &&
      characters.find(c => c.name === 'Diplomat') && (in_round || this.isPossibleEnemyCharacter(8)))
      push(characters.find(c => c.name === 'Diplomat'));
    if (Math.random() >= 0.5 && this.enemy.cards.length < 3 &&
      this.player.cards.length > 1 && this.player.cards.length > this.enemy.cards.length &&
      characters.find(c => c.name === 'Magician') && (in_round || this.isPossibleEnemyCharacter(3)))
      push(characters.find(c => c.name === 'Magician'));
    if (!this.endOfGame() && this.enemy.coins > 3 && characters.find(c => c.name === 'Alchemist') && (in_round || this.isPossibleEnemyCharacter(6)))
      push(characters.find(c => c.name === 'Alchemist'));
    if (this.enemy.coins > 3 && characters.find(c => c.name === 'Architect') && (in_round || this.isPossibleEnemyCharacter(7)))
      push(characters.find(c => c.name === 'Architect'));
    if (this.enemy.coins > 3 && characters.find(c => c.name === 'Wizard') && this.enemy.cards.length && this.player.cards.length && (in_round || this.isPossibleEnemyCharacter(3)))
      push(characters.find(c => c.name === 'Wizard'));
    if (this.enemy.districts.filter(d => d.color === 'green').length + this.enemy.hasDistrict('school') > 2 - +!!this.enemy.cards.length && characters.find(c => c.name === 'Merchant') && (in_round || this.isPossibleEnemyCharacter(6)))
      push(characters.find(c => c.name === 'Merchant'));
    if (this.enemy.districts.filter(d => d.color === 'blue').length + this.enemy.hasDistrict('school') > 2 - +!!this.enemy.cards.length && characters.find(c => c.number === 5) && (in_round || this.isPossibleEnemyCharacter(5)))
      push(characters.find(c => c.number === 5));
    if (in_round && characters.find(c => c.name === 'King') && !this.endOfGame() && (in_round || this.isPossibleEnemyCharacter(4)))
      push(characters.find(c => c.name === 'King'));
    if (characters.find(c => c.number === 4) && this.enemy.districts.filter(d => d.color === 'yellow').length + this.enemy.hasDistrict('school') > 2 - +!!this.enemy.cards.length && (in_round || this.isPossibleEnemyCharacter(4)))
      push(characters.find(c => c.number === 4));
    if (this.player.has_crown && this.player.characters.find(c => c.number === 8) && characters.find(c => c.name === 'Bishop') && (in_round || this.isPossibleEnemyCharacter(5)))
      push(characters.find(c => c.name === 'Bishop'));
    if (this.player.characters.find(c => c.name === 'Witch') && in_round && this.isPossibleEnemyCharacter(8) && characters.find(c => c.name === 'Bishop'))
      push(characters.find(c => c.name === 'Bishop'));
    if (!this.enemy.cards.length && characters.find(c => c.name === 'Architect') && (in_round || this.isPossibleEnemyCharacter(7)))
      push(characters.find(c => c.name === 'Architect'));
    if (characters.find(c => c.name === 'Navigator') && (this.enemy.hasDistrict('treasury') || this.enemy.hasDistrict('maproom')) && this.isPossibleEnemyCharacter(7))
      push(characters.find(c => c.name === 'Navigator'));
    if (in_round && this.enemy.coins > 2 && characters.find(c => c.name === 'Thief'))
      push(characters.find(c => c.name === 'Thief'));
    if (in_round && this.enemy.cards.length > this.player.cards.length + 2 && characters.find(c => c.name === 'Magician'))
      push(characters.find(c => c.name === 'Magician'));
    if (!in_round && characters.find(c => c.name === 'Wizard') && this.player.cards.length === 1 && this.isPossibleEnemyCharacter(3))
      push(characters.find(c => c.name === 'Wizard'));
    if (!in_round && characters.find(c => c.name === 'Emperor') && !this.player.coins && this.player.cards.length && this.isPossibleEnemyCharacter(4))
      push(characters.find(c => c.name === 'Emperor'));
    if (!in_round && characters.find(c => c.name === 'Tax') && this.game.currentCharacter && this.game.currentCharacter.built && this.player.coins < 3 && this.isPossibleEnemyCharacter(2))
      push(characters.find(c => c.name === 'Tax'));
    if (characters.find(c => c.number === 6) && Math.random() >= 0.5 && (in_round || this.isPossibleEnemyCharacter(6)))
      push(characters.find(c => c.number === 6));

    return danger_characters.slice(0, 2);
  }

  dangerCharacter(in_round) {
    in_round = in_round || false;
    const danger_characters = this.dangerCharacters();
    const danger_chance = this.game.characters.content.find(c => c.name === 'Witch') &&
      this.isPossibleEnemyCharacter(1) && danger_characters.length &&
      danger_characters[0].name !== 'King' ? 0.35 :
      (!danger_characters.find(c => c.name === 'King') && danger_characters.length &&
        danger_characters[0].name === 'Warlord' &&
        this.game.characters.content.filter(c => c.status === 'in_round').filter(c => c.name === 'Bishop').length ? 0.4 : 0.5);

    if (this.game.phaze === 'choose') {
      const king = in_round ? danger_characters.find(c => c.name === 'King') && Math.random() < this.kingChance() : 0;
      switch (danger_characters.length) {
        case 0: return this.randomCharacter();
        case 1: return king ? danger_characters.find(c => c.name === 'King') : (Math.random() < danger_chance ? danger_characters[0] : this.randomCharacter());
        case 2: return king ? danger_characters.find(c => c.name === 'King') : (Math.random() < danger_chance ? danger_characters[0] : danger_characters[1]);
      }
    }
    return danger_characters.length > 0 ? danger_characters[0] : this.randomCharacter();
  }

  magicianIsUseful() {
    const a = this.enemy.cards.length;
    let b = this.player.cards.length + 1;
    if (this.player.characters.filter(c => c.name === 'Assassin').length) b--;
    if (this.player.characters.filter(c => c.number === 2).length) b--;
    const c = this.player.cards.filter(c => c.cost === 1).length + this.player.cards.filter(c => c.cost === 2).length;
    const d = this.player.cards.filter(c => c.cost === 3).length > 1 && this.player.coins > 1;
    if (c > 1 || d) b--;
    return a > b;
  }

  warlordIsDangerous() {
    if (this.enemy.score === 0 && this.player.score === 0) return false;
    if (this.player.has_crown && this.player.characters.find(c => c.name === 'Bishop')) return false;
    if (this.player.closed) return false;
    if (this.enemy.coins < 2 && this.enemy.districts.filter(d => d.color === 'red').length < 1 &&
      this.player.districts.filter(d => d.cost === 1).length < 1 && !this.player.hasDistrict('greatwall')) return false;
    if (this.enemy.coins + this.enemy.districts.filter(d => d.color === 'red').length + this.enemy.hasDistrict('school') <
      this.player.score - this.enemy.score + this.player.coins + this.player.hasDistrict('greatwall') - 1) return false;
    if (this.player.districts.length >= this.enemy.districts.length + 2) return false;
    return true;
  }

  usefulCharacter() {
    const characters = this.game.characters.content.filter(c => c.status === 'in_round');
    if (characters.find(c => c.number === 1)) return characters.find(c => c.number === 1);
    if ((this.enemy.coins > 2 || (this.player.coins > 3 && !this.player.characters.find(c => c.number === 1))) && characters.find(c => c.name === 'Thief'))
      return characters.find(c => c.name === 'Thief');
    if (Math.random() > 0.6 && this.enemy.cards.length < 3 && this.player.cards.length > 1 && this.player.cards.length > this.enemy.cards.length && characters.find(c => c.name === 'Magician') && !this.player.characters.find(c => c.number === 1))
      return characters.find(c => c.name === 'Magician');
    if (this.player.coins > 3 && characters.find(c => c.name === 'Architect')) return characters.find(c => c.name === 'Architect');
    if (this.player.coins > 2 && this.player.cards.length && !this.hasAllDublicates() && characters.find(c => c.name === 'Alchemist') && !this.endOfGame())
      return characters.find(c => c.name === 'Alchemist');
    if (this.player.coins > 3 && characters.find(c => c.name === 'Wizard') && this.enemy.cards.length > 1 && this.player.cards.length > 1)
      return characters.find(c => c.name === 'Wizard');
    if (this.isUsefulColor('green', 0) && characters.find(c => c.name === 'Merchant')) return characters.find(c => c.name === 'Merchant');
    if (this.isUsefulColor('red', 1) && characters.find(c => c.number === 8)) return characters.find(c => c.number === 8);
    if (characters.find(c => c.name === 'Magician') && this.magicianIsUseful()) return characters.find(c => c.name === 'Magician');
    if (this.isUsefulColor('blue', 1) && characters.find(c => c.number === 5)) return characters.find(c => c.number === 5);
    if (this.isUsefulColor('yellow', 1) && characters.find(c => c.name === 'King')) return characters.find(c => c.name === 'King');
    if (this.isPossibleEnemyCharacter(8) && characters.find(c => c.name === 'Bishop') && this.isUsefulColor('blue', 0) && this.game.characters.content.find(c => c.name === 'Warlord'))
      return characters.find(c => c.name === 'Bishop');
    if ((!this.player.cards.length || this.hasAllDublicates()) && characters.find(c => c.name === 'Architect')) return characters.find(c => c.name === 'Architect');
    if ((!this.player.cards.length || this.hasAllDublicates()) && characters.find(c => c.name === 'Wizard') && this.enemy.cards.length > 1) return characters.find(c => c.name === 'Wizard');
    if (this.hasUsefulDistricts(this.enemy, !!characters.find(c => c.name === 'Diplomat')) && !this.endOfGame() && characters.find(c => c.number === 8))
      return characters.find(c => c.number === 8);
    if (((this.player.possible_characters.includes(4) && this.player.coins < 4) || this.player.hasDistrict('treasury') || this.player.hasDistrict('maproom')) && characters.find(c => c.name === 'Navigator'))
      return characters.find(c => c.name === 'Navigator');
    if (characters.find(c => c.name === 'Merchant')) return characters.find(c => c.name === 'Merchant');
    return null;
  }

  isUsefulColor(color, min_cnt) {
    return this.player.districts.filter(d => d.color === color).length > min_cnt ||
      this.player.cards.filter(c => c.color === color).length > min_cnt;
  }

  randomCharacter() {
    let characters = this.game.characters.content.filter(c => c.status === 'in_round');
    if ((this.player.has_crown || this.endOfGame()) && !this.player.characters.find(c => c.number === 8))
      characters = characters.filter(c => c.name !== 'Navigator');
    return characters[Math.floor(Math.random() * characters.length)];
  }

  chooseStrategy() {
    const char = (this.player.has_crown || this.player.characters.find(c => c.number === 1)) &&
      (!this.game.characters.content.find(c => c.name === 'Thief') || !this.isPossibleEnemyCharacter(2))
      ? (this.usefulCharacter() || this.randomCharacter())
      : this.dangerCharacter(true);
    this.player.takeCharacter(char);
    this.game.changePhaze();
  }

  discardStrategy() {
    this.player.discardCharacter(this.dangerCharacter(true));
    this.game.changePhaze();
  }

  checkWillRobbed() {
    const chars_sorted = sortBy(this.player.characters, 'number');
    const second = chars_sorted[1];
    if (!second) return false;
    if (this.game.currentCharacter !== second && second.state === 'robbed') {
      let will_robbed = true;
      if (this.game.currentCharacter.state === 'normal' && this.game.currentCharacter.can_build) {
        this.player.cards.forEach(card => {
          if (this.player.hasDistrict(card.name) <= this.player.hasDistrict('quarry')) {
            if (this.enoughCoinsToBuild(card)) will_robbed = false;
          }
        });
      }
      return will_robbed;
    }
    return false;
  }

  checkChooseCard() {
    const cc = this.game.currentCharacter;
    if (cc.name === 'Witch' && this.player.coins < 3)
      return this.game.characters.content.find(c => c.name === 'Thief') && this.isPossibleEnemyCharacter(2) && Math.random() < 0.5;
    if (this.checkWillRobbed()) return true;
    if (cc.name === 'Thief' && cc.state === 'bewitched') return true;
    if (this.player.characters.find(c => c.name === 'Architect') &&
      ['assassinated', 'bewitched'].indexOf(this.player.characters.find(c => c.name === 'Architect').state) < 0 &&
      this.player.coins < 9 &&
      (cc.name !== 'Alchemist' || cc.state !== 'normal' || !this.player.coins)) return false;
    if (this.game.first_full_city && this.player.hasDistrict('treasury')) return false;
    if (this.game.first_full_city && this.player.hasDistrict('maproom')) return true;
    if (cc.name === 'Magician' && (this.enemy.cards.length || this.hasAllDublicates()) && this.player.coins <= 6) return false;
    if (cc.name === 'Wizard' && this.enemy.cards.length && this.player.coins <= 6) return false;

    const chars_sorted = sortBy(this.player.characters, 'number');
    const second = chars_sorted[1];
    if (second && cc !== second && this.player.characters.find(c => c.name === 'Magician') && (this.enemy.cards.length || this.hasAllDublicates()) && this.player.coins <= 6) return false;
    if (second && cc !== second && this.player.characters.find(c => c.name === 'Wizard') && this.enemy.cards.length > 1 && this.player.coins <= 6) return false;
    if (cc.number < 3 && (!this.player.cards.length || this.hasAllDublicates()) && this.player.coins < 2 && this.isPossibleEnemyCharacter(3) &&
      (this.game.characters.content.find(c => c.name === 'Wizard') || this.enemy.cards.length < 2)) return false;
    if (!this.player.cards.length || this.hasAllDublicates()) return true;
    if (this.endOfGame() && second && (second === cc || ['assassinated', 'bewitched'].indexOf(second.state) > -1) &&
      cc.name !== 'Navigator' && (() => {
        let ret = true;
        this.player.cards.forEach(card => { if (this.enoughCoinsToBuild(card)) ret = false; });
        return ret;
      })()) return true;

    let player_cards = sortBy(this.player.cards, 'cost');
    player_cards.forEach(card => {
      if (this.player.hasDistrict(card.name) > this.player.hasDistrict('quarry'))
        player_cards = player_cards.filter(c => c.name !== card.name);
    });
    if (!player_cards.length) return true;

    if (cc.name === 'Alchemist' && cc.state === 'normal' && this.player.coins) {
      if (this.player.coins + 2 < player_cards[0].cost) return true;
      if (this.player.coins > player_cards[player_cards.length - 1].cost + 1 && player_cards[player_cards.length - 1].cost < 5) return true;
    }
    if ((player_cards.length === 1 || this.endOfGame()) && this.player.coins > player_cards[player_cards.length - 1].cost + 1) return true;
    return false;
  }

  cardToTake() {
    let cards_on_choice = this.game.deck.content.filter(c => c.status === 'on_choice');
    const random_card = cards_on_choice[Math.floor(Math.random() * cards_on_choice.length)];
    const cc = this.game.currentCharacter;

    cards_on_choice.forEach(card => {
      if (this.player.hasDistrict(card.name) > this.player.hasDistrict('quarry'))
        cards_on_choice = cards_on_choice.filter(c => c.name !== card.name);
      if (cc.name === 'Witch' || cc.name === 'Navigator') return;
      if (!this.enoughCoinsToBuild(card))
        cards_on_choice = cards_on_choice.filter(c => c.name !== card.name);
    });

    const chars_sorted = sortBy(this.player.characters, 'number');
    const second = chars_sorted[1];

    if (cards_on_choice.length > 0 && this.endOfGame())
      return sortBy(cards_on_choice, 'cost')[cards_on_choice.length - 1];
    if (cc.isColor && cards_on_choice.find(c => c.color === cc.color) && this.player.coins < 6)
      return cards_on_choice.find(c => c.color === cc.color);
    if (second && cc !== second && second.isColor && cards_on_choice.find(c => c.color === second.color))
      return cards_on_choice.find(c => c.color === second.color);
    if (cards_on_choice.length > 0)
      return sortBy(cards_on_choice, 'cost')[cards_on_choice.length - 1];
    return random_card;
  }

  enoughCoinsToBuild(card) {
    const cc = this.game.currentCharacter;
    let cost_to_build = card.cost;
    if (this.player.hasDistrict('factory') && card.color === 'purple') cost_to_build--;
    let coins_to_get = this.player.coins + 2;
    if (cc.name === 'Merchant') coins_to_get++;
    if (cc.isColor) coins_to_get += this.player.districts.filter(d => d.color === cc.color).length + this.player.hasDistrict('school');
    return cost_to_build <= coins_to_get;
  }

  endOfGame() {
    return this.player.districts.length >= this.player.districts_to_close - 1 ||
      this.enemy.districts.length >= this.enemy.districts_to_close - 1;
  }

  actionStrategy() {
    const cc = this.game.currentCharacter;
    cc.thanksYourExcellency();
    let to_use_workshop = false;

    if (cc.name === 'Emperor' && !cc.coronated && !['bewitched', 'assassinated'].includes(cc.state)) {
      cc.coronate(this.game, this.enemy);
      if (this.enemy.on_coronation) return;
    }

    this.destroyArmoryStrategy();

    if (this.checkChooseCard()) {
      if (this.player.hasWorkshop && (cc.number > 2 || !this.game.characters.content.find(c => c.name === 'Magician') || !this.isPossibleEnemyCharacter(3))) {
        cc.takeCoins(this.game);
        to_use_workshop = true;
      } else {
        cc.chooseCard(this.game);
        while (cc.took < 1 + this.player.hasDistrict('library'))
          cc.takeCard(this.game, this.cardToTake());
      }
    } else {
      cc.takeCoins(this.game);
    }

    if (cc !== this.game.currentCharacter) return;

    if (cc.name === 'Emperor' && !cc.coronated) {
      cc.coronate(this.game, this.enemy);
      if (this.enemy.on_coronation) return;
    }

    if (cc.name === 'Witch') {
      this.bewitchStrategy();
      cc.endTurn(this.game);
      return;
    }

    if (cc.state === 'bewitched' && cc.handle_player !== this.player) return;

    if (cc.isMagician) this.magicianStrategy(true);

    if (to_use_workshop) cc.useWorkshop(this.game);

    if (cc.name === 'Navigator') {
      this.navigatorStrategy();
      cc.endTurn(this.game);
      return;
    }

    if (this.checkWillUseAlchemist()) {
      this.specialBuildStrategy();
      if (cc.isAssassin) this.assassinStrategy();
      if (cc.isThief) this.thiefStrategy();
      if (cc.isMagician) this.magicianStrategy(true);
      if (cc.isWizard) this.wizardStrategy();
      cc.endTurn(this.game);
      return;
    }

    let user_cards = sortBy(this.player.cards, 'cost');

    if (user_cards.find(c => c.name === 'school')) cc.build(this.game, user_cards.find(c => c.name === 'school'));

    if (cc.isColor && !this.endOfGame() && this.player.coins < 6) {
      const color_cards = user_cards.filter(c => c.color === cc.color);
      for (let i = color_cards.length - 1; i >= 0; i--) cc.build(this.game, color_cards[i]);
    }

    if (cc.isColor && !this.checkWillRobbed()) cc.takeIncome();

    const chars_sorted = sortBy(this.player.characters, 'number');
    const second = chars_sorted[1];
    if (second && cc.number < second.number && second.isColor &&
      !['assassinated', 'bewitched'].includes(second.state) && !this.endOfGame() && this.player.coins < 6) {
      user_cards = sortBy(this.player.cards, 'cost');
      const color_cards2 = user_cards.filter(c => c.color === second.color);
      for (let i = color_cards2.length - 1; i >= 0; i--) cc.build(this.game, color_cards2[i]);
    }

    user_cards = sortBy(this.player.cards, 'cost');
    if (!this.endOfGame() && user_cards.length) {
      for (let i = user_cards.length - 1; i >= 0; i--) {
        const card = ['Architect', 'Wizard', 'Warlord', 'Diplomat'].includes(cc.name) && this.player.coins < user_cards[user_cards.length - 1].cost * 2
          ? user_cards[user_cards.length - 1 - i]
          : user_cards[i];
        cc.build(this.game, card);
      }
    }

    if (cc.isMagician) this.magicianStrategy();

    user_cards = sortBy(this.player.cards, 'cost');
    for (let i = user_cards.length - 1; i >= 0; i--) cc.build(this.game, user_cards[i]);

    if (this.player.hasDistrict('lighthouse')) this.lighthouseStrategy();

    if (this.player.hasLab && !this.checkWillRobbed() && (this.hasAllDublicates() || this.player.cards.length > 1)) {
      const lab_card = sortBy(this.player.cards, 'cost')[cc.name === 'Architect' || cc.name === 'Wizard' ? this.player.cards.length - 1 : 0];
      cc.useLab(lab_card);
    }

    if (this.player.hasMuseum && (this.hasAllDublicates() || this.player.cards.length > 1 || this.endOfGame())) {
      const mus_card = sortBy(this.player.cards, 'cost')[cc.name === 'Architect' || cc.name === 'Wizard' ? this.player.cards.length - 1 : 0];
      cc.underMuseum(this.game, mus_card);
    }

    user_cards = sortBy(this.player.cards, 'cost');
    for (let i = user_cards.length - 1; i >= 0; i--) cc.build(this.game, user_cards[i]);

    if (cc.isAssassin) this.assassinStrategy();
    if (cc.isThief) this.thiefStrategy();
    if (cc.isWizard) this.wizardStrategy();
    if (cc.isDiplomat) this.diplomatStrategy();
    if (cc.isWarlord) this.warlordStrategy();

    if (this.player.hasArmory) this.armoryStrategy();

    if (this.player.hasDistrict('belltower') &&
      this.player.districts.length > this.enemy.districts.length + (this.enemy.has_crown ? 1 : 0) &&
      (sortBy(this.enemy.characters, 'number')[1]?.revealed ||
        this.enemy.districts.length < this.enemy.districts_to_close - 2))
      this.player.ringTheBell(this.game);

    if (!this.enemy.on_graveyard) cc.endTurn(this.game);
  }

  hasAllDublicates() {
    if (!this.player.cards.length) return false;
    let has = true;
    this.player.cards.forEach(card => {
      if (this.player.hasDistrict(card.name) <= this.player.hasDistrict('quarry')) has = false;
    });
    return has;
  }

  hasUsefulDistricts(player, is_diplomat) {
    if (!player.districts.length) return false;
    if (player.hasDistrict('armory') || player.hasDistrict('treasury') || player.hasDistrict('museum')) return true;
    if (is_diplomat) return player.districts.filter(d => d.cost === 5).length > 0 || player.districts.filter(d => d.cost === 6).length > 0;
    return player.districts.filter(d => d.cost === 1).length > 0 ||
      player.districts.filter(d => d.cost === 2).length > 0 ||
      player.districts.filter(d => d.cost === 3).length > 0;
  }

  assassinStrategy() {
    let possible_characters = [...this.enemy.possible_characters];
    let r = 0.5, chase_king = true;
    if (this.game.characters.content.find(c => c.name === 'Navigator') && this.enemy.districts.length >= 4) {
      const idx = possible_characters.indexOf(7);
      if (idx > -1) possible_characters.splice(idx, 1);
      r = 0.25; chase_king = false;
    }
    const rn = possible_characters[Math.floor(Math.random() * possible_characters.length)];
    const random_character = this.game.characters.content.find(c => c.number === rn);
    const kingChar = this.game.characters.content.find(c => c.name === 'King');
    const char_to_assassinate = chase_king && kingChar && this.isPossibleEnemyCharacter(4) && !this.endOfGame() && Math.random() >= 0.5
      ? kingChar
      : (Math.random() < r ? (this.dangerCharacter() || random_character) : random_character);
    this.game.currentCharacter.assassinate(char_to_assassinate);
  }

  bewitchStrategy() {
    let possible_characters = [...this.enemy.possible_characters];
    if (this.game.characters.content.find(c => c.name === 'Navigator') && this.enemy.districts.length >= 4) {
      const idx = possible_characters.indexOf(7);
      if (idx > -1) possible_characters.splice(idx, 1);
    }
    const rn = possible_characters[Math.floor(Math.random() * possible_characters.length)];
    const random_character = this.game.characters.content.find(c => c.number === rn);
    const char_to_bewitch = Math.random() < 0.33 ? (this.dangerCharacter() || random_character) : random_character;
    this.game.currentCharacter.bewitch(char_to_bewitch);
  }

  thiefStrategy() {
    let possible_characters = [...this.enemy.possible_characters];
    const reject = this.enemy.characters.find(c => c.number === 1) ||
      this.game.characters.content.find(c => c.state === 'assassinated') ||
      this.game.characters.content.find(c => c.state === 'bewitched');
    if (reject) {
      const idx = possible_characters.indexOf(reject.number);
      if (idx > -1) possible_characters.splice(idx, 1);
    }
    const rn = possible_characters[Math.floor(Math.random() * possible_characters.length)];
    this.game.currentCharacter.rob(this.game.characters.content.find(c => c.number === rn));
  }

  magicianStrategy(check_built) {
    const cc = this.game.currentCharacter;
    if (check_built) check_built = check_built && !cc.built;
    if (this.player.hasLab && ((this.player.cards.length === 1 && this.enemy.cards.length) || this.hasAllDublicates()))
      cc.useLab(this.player.cards[0]);

    if (this.player.cards.length === 0 ||
      (this.enemy.cards.length > this.player.cards.length + 1 - this.player.cards.length * (this.hasAllDublicates() ? 1 : 0) &&
        (!check_built || this.hasAllDublicates()))) {
      if (this.player.hasLab && this.player.cards.length === 1) cc.useLab(this.player.cards[0]);
      if (this.player.hasMuseum && this.player.cards.length === 1) cc.underMuseum(this.game, this.player.cards[0]);
      cc.exchange_cards(this.game, this.enemy);
    } else {
      this.player.cards.forEach(card => {
        if (this.player.hasDistrict(card.name) > this.player.hasDistrict('quarry') ||
          (this.endOfGame() && card.cost - (this.player.hasDistrict('factory') && card.color === 'purple' ? 1 : 0) > this.player.coins)) {
          cc.chooseToDiscard();
          card.isChecked = true;
        }
      });
      cc.discardCards(this.game);
    }
  }

  wizardStrategy() {
    if (this.enemy.cards.length) {
      const enemy_cards = sortBy(this.enemy.cards, 'cost');
      for (let j = enemy_cards.length - 1; j >= 0; j--) {
        if (enemy_cards[j].cost <= this.player.coins) {
          this.game.currentCharacter.stealCard(this.enemy, enemy_cards[j]);
          this.game.currentCharacter.wizardBuild(this.game, enemy_cards[j]);
        }
      }
      if (!this.game.currentCharacter.wizard_built)
        this.game.currentCharacter.stealCard(this.enemy, enemy_cards[Math.floor(Math.random() * enemy_cards.length)]);
    }
  }

  navigatorStrategy() {
    let take4cards = false;
    if (this.checkWillRobbed()) take4cards = true;
    if (!this.player.has_crown && this.game.characters.content.find(c => c.name === 'Thief') && this.game.characters.content.find(c => c.name === 'Wizard') && !this.player.characters.find(c => c.number === 8) && !this.game.first_full_city)
      take4cards = true;
    if (this.player.hasDistrict('maproom') && (this.game.characters.content.find(c => c.name === 'Wizard') || this.game.first_full_city))
      take4cards = true;
    if (take4cards) this.game.currentCharacter.take4Cards(this.game);
    else this.game.currentCharacter.take4Coins();
  }

  warlordStrategy() {
    const enemy_districts = sortBy(this.enemy.districts.filter(d => d.name !== 'keep'), 'cost');
    if (!enemy_districts.length) return;
    const player_coins = this.player.coins;
    for (let coins = Math.round(player_coins / 2); coins <= player_coins; coins++)
      for (let i = enemy_districts.length - 1; i >= 0; i--)
        if (enemy_districts[i].cost - 1 + this.enemy.hasDistrict('greatwall') - (enemy_districts[i].name === 'greatwall' ? 1 : 0) <= coins) {
          this.game.currentCharacter.destroy(this.game, this.enemy, enemy_districts[i]);
          return;
        }
  }

  diplomatStrategy() {
    const cc = this.game.currentCharacter;
    if (this.enemy.hasDistrict('dragongate') || this.enemy.hasDistrict('university') || this.enemy.hasDistrict('school') || this.enemy.hasDistrict('hospital')) {
      const give = this.player.districts.filter(d => !['university', 'dragongate', 'school', 'hospital', 'armory'].includes(d.name));
      const giveSorted = sortBy(give, 'cost');
      cc.swap(this.game, this.enemy, giveSorted[giveSorted.length - 1]);
      cc.swap(this.game, this.enemy,
        this.enemy.districts.find(d => d.name === 'dragongate') ||
        this.enemy.districts.find(d => d.name === 'university') ||
        this.enemy.districts.find(d => d.name === 'school') ||
        this.enemy.districts.find(d => d.name === 'hospital'));
      if (cc.swapped) return;
    }
    if (this.enemy.hasDistrict('armory')) {
      const cheapest = sortBy(this.player.districts, 'cost')[0];
      cc.swap(this.game, this.enemy, cheapest);
      cc.swap(this.game, this.enemy, this.enemy.districts.find(d => d.name === 'armory'));
      if (cc.swapped) return;
    }
    let min_swap = (!this.player.has_crown || !this.game.characters.content.find(c => c.name === 'Thief')) && !this.endOfGame();
    const player_districts = sortBy(this.player.districts.filter(d => d.color !== 'purple' && d.color !== 'city'), 'cost');
    const enemy_districts = sortBy(this.enemy.districts.filter(d => d.name !== 'keep'), 'cost');
    for (let i = 0; i < player_districts.length; i++)
      for (let j = enemy_districts.length - 1; j >= 0; j--) {
        if (enemy_districts[j].cost > player_districts[i].cost &&
          (!min_swap || enemy_districts[j].cost === player_districts[i].cost + 1)) {
          cc.swap(this.game, this.enemy, player_districts[i]);
          cc.swap(this.game, this.enemy, enemy_districts[j]);
        }
        if (cc.swapped) return;
      }
  }

  coronationStrategy() {
    if (this.hasAllDublicates()) this.player.giveCardForCrown(this.game);
    else this.player.giveCoinForCrown(this.game);
  }

  graveyardStrategy() {
    const card_on_graveyard = this.game.deck.card_on_graveyard;
    let pay = true;
    this.player.cards.forEach(card => { if (card_on_graveyard && card_on_graveyard.name === card.name) pay = false; });
    this.player.useGraveyard(this.game, pay);
  }

  lighthouseStrategy() {
    const cc = this.game.currentCharacter;
    const cards_in_deck = this.game.deck.content.filter(c => c.status === 'in_deck');
    let card_to_take = null;

    if (cc.name === 'Architect' && this.player.coins && this.player.coins < 6) {
      const cards_to_take = cards_in_deck.filter(c => c.cost === this.player.coins);
      cards_to_take.forEach(card => { if (!this.player.hasDistrict(card.name)) card_to_take = card; });
    }

    if (!card_to_take) {
      const priority = ['armory', 'workshop', 'lab', 'school', 'library', 'hospital', 'university', 'dragongate', 'city', 'park'];
      const contenders = [];
      priority.forEach(name => { const c = cards_in_deck.find(c => c.name === name); if (c) contenders.push(c); });
      card_to_take = contenders[Math.floor(Math.random() * contenders.length)] || null;
    }

    this.player.useLighthouse();
    if (card_to_take) this.player.lighthouseTake(card_to_take);
  }

  armoryStrategy() {
    const cc = this.game.currentCharacter;
    const enemy = this.enemy;
    let district_to_explode = null;
    if (enemy.hasDistrict('dragongate') || enemy.hasDistrict('university'))
      district_to_explode = enemy.districts.find(d => d.name === 'dragongate') || enemy.districts.find(d => d.name === 'university');
    else if (this.endOfGame() && !this.player.closed) {
      const sorted = sortBy(enemy.districts, 'cost');
      district_to_explode = sorted[sorted.length - 1];
    } else if (enemy.districts.filter(d => d.cost === 6).length) {
      district_to_explode = enemy.districts.filter(d => d.cost === 6)[0];
    }
    if (district_to_explode) {
      this.player.onExplode();
      this.player.explodeArmory(this.game, district_to_explode);
    }
  }

  destroyArmoryStrategy() {
    if (!this.enemy.hasDistrict('armory')) return;
    const cc = this.game.currentCharacter;
    if (cc.name !== 'Warlord') return;
    if (['bewitched', 'assassinated'].includes(cc.state)) return;
    if (this.player.districts.filter(d => d.color === 'red').length > 1) cc.takeIncome();
    else if (this.player.coins < 2) cc.takeCoins(this.game);
    cc.destroy(this.game, this.enemy, this.enemy.districts.find(d => d.name === 'armory'));
  }

  checkWillUseAlchemist() {
    if (!this.game.characters.content.find(c => c.name === 'Alchemist')) return false;
    if (this.game.currentCharacter.number > 5) return false;
    if (this.endOfGame()) return false;
    return !!this.player.characters.filter(c => c.state === 'normal').find(c => c.name === 'Alchemist');
  }

  specialBuildStrategy() {
    if (this.hasAllDublicates()) return;
    let user_cards = sortBy(this.player.cards, 'cost');
    user_cards.forEach(card => {
      if (this.player.hasDistrict(card.name) > this.player.hasDistrict('quarry'))
        user_cards = user_cards.filter(c => c.name !== card.name);
    });
    if (!user_cards.length) return;
    if (user_cards.length > 1 || (user_cards.length === 1 && this.player.coins < user_cards[0].cost + 4)) {
      const coins_can_pay = this.player.coins + 2 - user_cards[user_cards.length - 1].cost;
      let built = false;
      for (let j = user_cards.length - 2; j >= 0; j--) {
        if (!built && user_cards[j].cost <= coins_can_pay) {
          this.game.currentCharacter.build(this.game, user_cards[j]);
          built = true;
        }
      }
    }
    if (this.game.currentCharacter.isColor) this.game.currentCharacter.takeIncome();
  }
}
