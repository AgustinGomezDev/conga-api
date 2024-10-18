import { Card } from './card'

export class Player {
    private hand: Card[] = [];
    public socketId: string;

    constructor(socketId: string) {
        this.socketId = socketId;
    }

    public setHand(cards: Card[]) {
        this.hand = cards
    }

    public getHand(): Card[] {
        return this.hand
    }

    public getSocketId(): string {
        return this.socketId;
    }

    public playCard(card: Card): boolean {
        if (this.hand.length < 8) return false;

        const index = this.hand.findIndex(c => c.id === card.id);
        if (index !== -1) {
            this.hand.splice(index, 1)
            return true
        }
        return false
    }

    public drawCard(card: Card) {
        this.hand.push(card);
    }
}