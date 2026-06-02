import { Card } from './Card.js';

const EXTENDED_DECK_DATA = [
  { name: 'lighthouse', desc: 'Lighthouse. When you play the lighthouse in your city, look through the district cards deck, choose one card and place it in your hand, then reshuffle the deck.', color: 'purple', pic: 'lighthouse.jpg', cost: 3 },
  { name: 'museum', desc: 'Museum. On your turn, you may place one district card from your hand, face down, under the Museum. At the end of the game, you score 1 extra victory point for each card under the Museum.', color: 'purple', pic: 'museum.jpg', cost: 4 },
  { name: 'poorhouse', desc: 'Poorhouse. If you have no gold at the end of your turn, get 1 gold from the bank.', color: 'purple', pic: 'poorhouse.jpg', cost: 4 },
  { name: 'belltower', desc: 'Tower Bell. When you play the Tower Bell in your city, you may shorten the game and decide that it will end at the end of the turn in which a player builds one less district than the specified in the game. You can do this even if the Tower Bell is your last district. If the Tower bell is later destroyed by the Warlord, end conditions go back to normal.', color: 'purple', pic: 'belltower.jpg', cost: 5 },
  { name: 'factory', desc: "Factory. The building cost for any other purple building you build in your city is reduced by one. This doesn´t affect the price paid by the Warlord to destroy it.", color: 'purple', pic: 'factory.jpg', cost: 5 },
  { name: 'quarry', desc: "Quarry. Allows you to build Districts named as others you've already built.", color: 'purple', pic: 'quarry.jpg', cost: 5 },
  { name: 'fountain', desc: 'Fountain of Wishes. At the end of the game, the Fountain of Wishes gives you 5 points, plus one more for every other purple District you have built.', color: 'purple', pic: 'fountain.jpg', cost: 5 },
  { name: 'ballroom', desc: "Ball room. When you have the crown, all other players must say 'Thanks, your Excellency' after you call his character. If a player forgets and starts his turn without saying it, he loses his turn.", color: 'purple', pic: 'ballroom.jpg', cost: 6 },
  { name: 'park', desc: 'Park. If you have no card in hand at the end of your turn, draw two cards from the drawing pile.', color: 'purple', pic: 'park.jpg', cost: 6 },
  { name: 'hospital', desc: 'Hospital. If you are assassinated, you still take two gold or draw two cards and discard one when comes your turn, but that\'s all you do this turn.', color: 'purple', pic: 'hospital.jpg', cost: 6 },
  { name: 'throneroom', desc: 'Throne Hall. Every time the crown moves from a player to another, you receive 1 gold from the bank.', color: 'purple', pic: 'throneroom.jpg', cost: 6 },
  { name: 'armory', desc: 'Powderhouse. During your turn, you can destroy the powderhouse and destroy another district card of your choice in any player\'s city.', color: 'purple', pic: 'armory.jpg', cost: 3 },
  { name: 'treasury', desc: 'Imperial Treasury. At the end of the game, you score 1 victory point bonus for each coin in your hand.', color: 'purple', pic: 'treasury.jpg', cost: 4 },
  { name: 'maproom', desc: 'Map Room. At the end of the game, you score 1 victory point bonus for each card in your hand.', color: 'purple', pic: 'maproom.jpg', cost: 5 }
];

export class Deck {
  constructor(config = {}) {
    this.content = [];
    this.extended = config.extended || [];

    if (config.init_deck) {
      config.init_deck.forEach(d => this.content.push(new Card(d)));
    } else {
      this._initDefaultDeck();
      if (this.extended.length) this._initExtendedDeck();
    }
  }

  get cards_on_choose() {
    return this.content.filter(c => c.status === 'on_choice').length > 0;
  }

  get card_on_graveyard() {
    return this.content.find(c => c.status === 'on_graveyard') || null;
  }

  inExtended(number) {
    return this.extended.includes(number);
  }

  _add(count, data) {
    for (let i = 0; i < count; i++) this.content.push(new Card(data));
  }

  _initDefaultDeck() {
    this._add(5, { name: 'domain', desc: 'Manor', color: 'yellow', pic: 'domain.jpg', cost: 3 });
    this._add(4, { name: 'castle', desc: 'Castle', color: 'yellow', pic: 'castle.jpg', cost: 4 });
    this._add(3, { name: 'palace', desc: 'Palace', color: 'yellow', pic: 'palace.jpg', cost: 5 });
    this._add(3, { name: 'temple', desc: 'Temple', color: 'blue', pic: 'temple.jpg', cost: 1 });
    this._add(3, { name: 'church', desc: 'Church', color: 'blue', pic: 'church.jpg', cost: 2 });
    this._add(3, { name: 'monastery', desc: 'Monastery', color: 'blue', pic: 'monastery.jpg', cost: 3 });
    this._add(2, { name: 'cathedral', desc: 'Cathedral', color: 'blue', pic: 'cathedral.jpg', cost: 5 });
    this._add(5, { name: 'tavern', desc: 'Tavern', color: 'green', pic: 'tavern.jpg', cost: 1 });
    this._add(3, { name: 'store', desc: 'Trading Post', color: 'green', pic: 'store.jpg', cost: 2 });
    this._add(4, { name: 'market', desc: 'Market', color: 'green', pic: 'market.jpg', cost: 2 });
    this._add(3, { name: 'warehouse', desc: 'Docks', color: 'green', pic: 'warehouse.jpg', cost: 3 });
    this._add(3, { name: 'harbour', desc: 'Harbor', color: 'green', pic: 'harbour.jpg', cost: 4 });
    this._add(2, { name: 'townhall', desc: 'Town Hall', color: 'green', pic: 'townhall.jpg', cost: 5 });
    this._add(3, { name: 'watchtower', desc: 'Watchtower', color: 'red', pic: 'watchtower.jpg', cost: 1 });
    this._add(3, { name: 'prison', desc: 'Prison', color: 'red', pic: 'prison.jpg', cost: 2 });
    this._add(3, { name: 'barracks', desc: 'Battlefield', color: 'red', pic: 'barracks.jpg', cost: 3 });
    this._add(2, { name: 'fortress', desc: 'Fortress', color: 'red', pic: 'fortress.jpg', cost: 5 });
    this._add(2, { name: 'keep', desc: 'Keep. The Keep cannot be destroyed by the Warlord.', color: 'purple', pic: 'keep.jpg', cost: 3 });
    this.content.push(new Card({ name: 'city', desc: 'Miracle Courtyard. At the end of the game, the Miracle Courtyard counts as a colour of your choice.', color: 'purple', pic: 'city.jpg', cost: 2 }));
    this.content.push(new Card({ name: 'observatory', desc: 'Observatory. If you choose to draw cards at the begining of your turn, you may pick three cards, keep one of your choice and place the two others at the bottom the deck.', color: 'purple', pic: 'observatory.jpg', cost: 5 }));
    this.content.push(new Card({ name: 'lab', desc: 'Laboratory. Once per turn, you may discard a District card from your hand and get a gold piece in return.', color: 'purple', pic: 'lab.jpg', cost: 5 }));
    this.content.push(new Card({ name: 'workshop', desc: 'Workshop. Once per turn, you may pay 3 gold to draw 3 cards.', color: 'purple', pic: 'workshop.jpg', cost: 5 }));
    this.content.push(new Card({ name: 'library', desc: 'Library. If you choose to draw cards at the begining of your turn, you keep the two cards you have drawn.', color: 'purple', pic: 'library.jpg', cost: 6 }));
    this.content.push(new Card({ name: 'school', desc: 'School of Magic. For the purposes of income, the School of Magic is considered to be the colour of your choice.', color: 'purple', pic: 'school.jpg', cost: 6 }));
    this.content.push(new Card({ name: 'greatwall', desc: 'Great Wall. The cost to swap or destroy your Districts is increased by one.', color: 'purple', pic: 'greatwall.jpg', cost: 6 }));
    this.content.push(new Card({ name: 'dragongate', desc: "Dragon Gate. This is a sign of prestige - the kingdom has not seen a dragon in over 1000 years. It costs 6 gold to build, but it's worth 8 points at the end of the game.", color: 'purple', pic: 'dragongate.jpg', cost: 6 }));
    this.content.push(new Card({ name: 'university', desc: "University. This is a sign of prestige - nobody ever understood what it's for. It costs 6 gold to build, but it's worth 8 points at the end of the game.", color: 'purple', pic: 'university.jpg', cost: 6 }));
    if (!this.inExtended(8)) {
      this.content.push(new Card({ name: 'graveyard', desc: 'Graveyard. When the Warlord destroys a District, you may pay a gold piece to take the destroyed District into your hand. You cannot do this if you are the Warlord.', color: 'purple', pic: 'graveyard.jpg', cost: 5 }));
    }
  }

  _initExtendedDeck() {
    const deck = this.content;
    const pool = EXTENDED_DECK_DATA;
    for (let i = 0; i < 3; i++) {
      let chosen = false;
      while (!chosen) {
        const n = Math.floor(Math.random() * pool.length);
        if (!deck.find(c => c.name === pool[n].name)) {
          if (pool[n].name !== 'hospital' || !this.inExtended(1)) {
            chosen = true;
            deck.push(new Card(pool[n]));
          }
        }
      }
    }
  }
}
