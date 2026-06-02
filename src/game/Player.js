export class Player {
  constructor(data = {}) {
    this.name = data.name || '';
    this.is_robot = data.is_robot || false;
    this.time = 0;
    this.has_crown = data.has_crown || false;
    this.closed_first = data.closed_first || false;
    this.districts_to_close = data.districts_to_close || 8;
    this.coins = data.coins !== undefined ? data.coins : 2;
    this.cards_under_museum = data.cards_under_museum || 0;
    this.on_coronation = data.on_coronation || false;
    this.on_graveyard = data.on_graveyard || false;
    this.can_use_belltower = data.can_use_belltower || false;
    this.can_use_lighthouse = data.can_use_lighthouse || false;
    this.using_lighthouse = data.using_lighthouse || false;
    this.exploding = data.exploding || false;
    this.possible_characters = data.possible_characters || [];
    // arrays populated externally
    this.cards = [];
    this.characters = [];
    this.districts = [];
  }

  get closed() { return this.districts.length >= this.districts_to_close; }

  get districtOnSwap() {
    return this.districts.filter(d => d.status === 'on_swap').length;
  }

  get hasAllColours() {
    const colors = this.districts.filter(d => d.color).map(d => d.color);
    return new Set(colors).size >= 5;
  }

  get score() {
    let ret = 0;
    this.districts.forEach(d => { ret += d.cost; });
    ret += this.hasDistrict('fountain') *
      (this.districts.filter(d => d.color === 'purple').length
       + this.districts.filter(d => d.color === 'city').length
       - this.hasDistrict('fountain'));
    ret += this.hasDistrict('treasury') * this.coins;
    ret += this.hasDistrict('maproom') * this.cards.length;
    ret += this.hasDistrict('museum') * this.cards_under_museum;
    if (this.hasDistrict('dragongate')) ret += 2;
    if (this.hasDistrict('university')) ret += 2;
    if (this.hasAllColours) ret += 3;
    if (this.closed) ret += 2;
    if (this.closed_first) ret += 2;
    return ret;
  }

  get hasWorkshop() { return !!this.hasDistrict('workshop'); }
  get hasLab() { return !!this.hasDistrict('lab'); }
  get hasGraveyard() { return !!this.hasDistrict('graveyard'); }
  get hasArmory() { return !!this.hasDistrict('armory'); }
  get hasMuseum() { return !!this.hasDistrict('museum'); }
  get hasLighthouse() { return !!this.hasDistrict('lighthouse'); }
  get hasBallroom() { return !!this.hasDistrict('ballroom'); }

  hasDistrict(name) {
    return this.districts.filter(d => d.name === name).length;
  }

  giveCoinForCrown(game) {
    const emperor = game.characters.content.find(c => c.name === 'Emperor');
    const emperor_owner = emperor.handle_player;
    this.coins--;
    emperor_owner.coins++;
    emperor.coronated = true;
    game.setCrownTo(this);
    this.on_coronation = false;
  }

  giveCardForCrown(game) {
    const emperor = game.characters.content.find(c => c.name === 'Emperor');
    const emperor_owner = emperor.handle_player;
    if (this.cards.length) {
      const n = Math.floor(Math.random() * this.cards.length);
      const given_card = this.cards[n];
      given_card.player = emperor_owner;
      this.cards.splice(n, 1);
      emperor_owner.cards.push(given_card);
    }
    emperor.coronated = true;
    game.setCrownTo(this);
    this.on_coronation = false;
  }

  useLighthouse() {
    if (this.can_use_lighthouse) this.using_lighthouse = true;
  }

  lighthouseTake(card) {
    if (this.using_lighthouse) {
      card.status = 'in_hand';
      card.player = this;
      this.cards.push(card);
      this.using_lighthouse = false;
      this.can_use_lighthouse = false;
    }
  }

  ringTheBell(game) {
    if (this.can_use_belltower) {
      game.player1.districts_to_close = 7;
      game.player2.districts_to_close = 7;
      this.can_use_belltower = false;
    }
  }

  cancelRing(game) {
    game.player1.districts_to_close = 8;
    game.player2.districts_to_close = 8;
  }

  onExplode() {
    if (this.hasArmory) this.exploding = true;
  }

  explodeArmory(game, district) {
    if (!this.exploding) return;
    const armory = this.districts.find(d => d.name === 'armory');
    if (!armory) return;
    armory.status = 'destroyed';
    armory.player = null;
    const ai = this.districts.indexOf(armory);
    if (ai > -1) this.districts.splice(ai, 1);
    district.status = 'destroyed';
    if (district.player) {
      const district_owner = district.player;
      const di = district_owner.districts.indexOf(district);
      if (di > -1) district_owner.districts.splice(di, 1);
      if (district.name === 'belltower') district_owner.cancelRing(game);
      if (district_owner.districts.length < district_owner.districts_to_close) {
        district_owner.closed_first = false;
        if (this.districts.length < this.districts_to_close) {
          this.closed_first = false;
          game.first_full_city = false;
        }
      }
    }
    district.player = null;
    this.exploding = false;
  }

  useGraveyard(game, pay) {
    if (!this.hasGraveyard) return;
    if (this.coins < 1) return;
    const card = game.deck.card_on_graveyard;
    if (pay) {
      this.coins--;
      this.cards.push(card);
    }
    this.on_graveyard = false;
    card.status = pay ? 'in_hand' : 'destroyed';
    card.player = pay ? this : null;
  }

  takeCharacter(character) {
    if (character && character.status === 'in_round') {
      this.characters.push(character);
      character.status = 'in_hand';
      character.player = this;
      this.addToPossibleCharacters(character);
    }
  }

  discardCharacter(character) {
    if (character && character.status === 'in_round') {
      character.status = 'discarded';
      this.addToPossibleCharacters(character);
    }
  }

  addToPossibleCharacters(character) {
    this.possible_characters.push(character.number);
  }

  serialize() {
    return {
      name: this.name,
      is_robot: this.is_robot,
      has_crown: this.has_crown,
      coins: this.coins,
      closed_first: this.closed_first,
      on_coronation: this.on_coronation,
      on_graveyard: this.on_graveyard,
      districts_to_close: this.districts_to_close,
      can_use_belltower: this.can_use_belltower,
      can_use_lighthouse: this.can_use_lighthouse,
      using_lighthouse: this.using_lighthouse,
      exploding: this.exploding,
      cards_under_museum: this.cards_under_museum,
      possible_characters: this.possible_characters
    };
  }
}
