export class Card {
  constructor(data = {}) {
    this.name = data.name || '';
    this.desc = data.desc || data.name || '';
    this.color = data.color || '';
    this.pic = data.pic || '';
    this.cost = data.cost || 0;
    this.status = data.status || 'in_deck';
    this.player = data.player || null;
    this.isChecked = data.isChecked || false;
  }

  get onChoose() { return this.status === 'on_choice'; }
  get onWizard() { return this.status === 'on_wizard'; }
  get inDeck() { return this.status === 'in_deck'; }

  serialize() {
    return {
      name: this.name,
      desc: this.desc,
      color: this.color,
      pic: this.pic,
      cost: this.cost,
      status: this.status,
      player: this.player ? this.player.name : null
    };
  }
}
