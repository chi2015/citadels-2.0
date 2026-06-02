import {
  Assassin, Thief, Magician, King, Bishop, Merchant, Architect, Warlord,
  Witch, TaxCollector, Wizard, Emperor, Abbot, Alchemist, Navigator, Diplomat
} from './Character.js';

export class Characters {
  constructor(config = {}) {
    this.extended = config.extended || [];
    this.content = [];
    const c = this.content;
    c.push(this._inExtended(1) ? new Witch() : new Assassin());
    c.push(this._inExtended(2) ? new TaxCollector() : new Thief());
    c.push(this._inExtended(3) ? new Wizard() : new Magician());
    c.push(this._inExtended(4) ? new Emperor() : new King());
    c.push(this._inExtended(5) ? new Abbot() : new Bishop());
    c.push(this._inExtended(6) ? new Alchemist() : new Merchant());
    c.push(this._inExtended(7) ? new Navigator() : new Architect());
    c.push(this._inExtended(8) ? new Diplomat() : new Warlord());
  }

  _inExtended(number) {
    return this.extended.includes(number);
  }
}
