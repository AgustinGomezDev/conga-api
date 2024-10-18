import { Card } from './card'

export class Deck {
    private cards: Card[] = [];

    constructor() {
        this.initializeDeck();
        this.shuffleDeck();
    }

    private initializeDeck() {
        const suits = ['oro', 'copa', 'basto', 'espada'] as const
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

        let i = 0

        for (const suit of suits) {
            for (const value of values) {
                this.cards.push({ id: i++, suit, value })
            }
        }

        this.cards.push({ id: i++, suit: 'comodin', value: 0 })
        this.cards.push({ id: i++, suit: 'comodin', value: 0 })
    }

    private shuffleDeck() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    public drawCard(): Card | null {
        return this.cards.length > 0 ? this.cards.pop() : null;
    }

    public dealCards(playersCount: number, cardsPerPlayer: number): Card[][] {
        const hands: Card[][] = [];

        for (let i = 0; i < playersCount; i++) {
            hands[i] = [];
            for (let j = 0; j < cardsPerPlayer; j++) {
                const card = this.drawCard();
                if (card) {
                    hands[i].push(card);
                }
            }
        }
        return hands;
    }
}