import { Card } from './card';
import { Deck } from './deck'
import { Player } from './player'

export class Game {
    public players: Player[];
    private deck: Deck;
    private currentPlayerIndex: number;
    public maxPlayers: number;
    private lastPlayedCard: Card | null;
    private isActive: boolean;
    private scoreBoard: { [key: string]: number[] };

    constructor(maxPlayers: number) {
        this.deck = new Deck();
        this.players = [];
        this.maxPlayers = maxPlayers;
        this.currentPlayerIndex = 0;
        this.lastPlayedCard = null;
        this.scoreBoard = {};
    }

    public addPlayer(player: Player): boolean {
        if (this.players.length < this.maxPlayers) {
            this.players.push(player);
            this.scoreBoard[player.socketId] = [0]
            return true;
        }
        return false;
    }

    public removePlayer(socketId: string): boolean {
        const playerIndex = this.players.findIndex(player => player.socketId === socketId);

        if (playerIndex === -1) {
            return false;
        }

        // Ajustar el turno si el jugador que se elimina está antes del turno actual
        if (playerIndex <= this.currentPlayerIndex && this.players.length > 1) {
            this.currentPlayerIndex = (this.currentPlayerIndex - 1 + this.players.length) % this.players.length;
        }

        this.players.splice(playerIndex, 1);
        return true;
    }

    public dealCards() {
        const hands = this.deck.dealCards(this.players.length, 7);
        this.players.forEach((player, i) => player.setHand(hands[i]));
        // Inicializar el turno al repartir
        this.currentPlayerIndex = 0;

        this.isActive = true;
    }

    public playCard(player: Player, card: Card): boolean {
        if (!this.isActive) return false;

        const playerIndex = this.players.findIndex(p => p.socketId === player.socketId);

        // Verificar si es el turno del jugador
        if (playerIndex !== this.currentPlayerIndex) {
            return false;
        }


        // Intentar jugar la carta
        if (player.playCard(card)) {
            this.lastPlayedCard = card;
            this.advanceTurn();
            return true;
        }

        return false;
    }

    public drawCard(player: Player): boolean {
        if (!this.isActive) return false;

        const playerIndex = this.players.findIndex(p => p.socketId === player.socketId);

        // Verificar si es el turno del jugador
        if (playerIndex !== this.currentPlayerIndex) {
            return false;
        }

        const card = this.deck.drawCard();
        if (card) {
            player.drawCard(card);
            return true;
        }

        return false;
    }

    public drawLastPlayedCard(player: Player): boolean {
        if (!this.isActive) return;

        const playerIndex = this.players.findIndex(p => p.socketId === player.socketId);

        // Verificar si es el turno del jugador
        if (playerIndex !== this.currentPlayerIndex) {
            return false;
        }

        const lastPlayedCard = this.getLastPlayedCard()

        if (lastPlayedCard) {
            player.drawCard(lastPlayedCard)
            return true
        }

        return false
    }

    public setLastPlayedCardNull(): boolean {
        try {
            this.lastPlayedCard = null
            return true
        } catch (error) {
            return false
        }
    }

    public getLastPlayedCardNull(): Card | null {
        return this.lastPlayedCard
    }

    private advanceTurn(): void {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    public getTurn(): number {
        return this.currentPlayerIndex;
    }

    public getLastPlayedCard(): Card | null {
        return this.lastPlayedCard;
    }

    public isGameActive(): boolean {
        return this.isActive;
    }

    public getPlayerCount(): number {
        return this.players.length;
    }

    public endGame(closingPlayer: Player, closingCard: Card, combinedCards: Card[][], leftOverCard?: Card): boolean {
        const remainingPoints = leftOverCard ? leftOverCard.value : -10;
        if (remainingPoints > 5) {
            return false // the player can't have more than 5 points left
        }

        const isValid = this.validCombinations(combinedCards);
        if (!isValid) return false;


        this.isActive = false;
        return true;
    }

    private validCombinations(combinedCards: Card[][]): boolean {
        for (const combination of combinedCards) {
            if (this.isSet(combination)) { continue; }
            if (this.isSequence(combination)) { continue; }

            return false
        }

        return true
    }

    private isSet(cards: Card[]): boolean {
        const value = cards[0].value
        return cards.every(card => card.value === value);
    }

    private isSequence(cards: Card[]): boolean {
        const sortedCards = cards.slice().sort((a, b) => a.value - b.value)

        const suit = sortedCards[0].suit;
        for (let i = 1; i < sortedCards.length; i++) {
            if (sortedCards[i].suit !== suit || sortedCards[i].value !== sortedCards[i - 1].value + 1)
                return false;
        }

        return true
    }

    public pointsController(player: Player, combinedCards?: Card[][], leftOverCards?: Card[]): number {
        let totalPoints = 0;
        totalPoints += leftOverCards.reduce((sum, card) => sum + card.value, 0);

        for (const combination of combinedCards) {
            const isValidSet = this.isSet(combination);
            const isValidSequence = this.isSequence(combination);

            if (!isValidSet && !isValidSequence) {
                totalPoints += combination.reduce((sum, card) => sum + card.value, 0);
            }
        }

        if (this.scoreBoard[player.socketId]) {
            this.scoreBoard[player.socketId].push(totalPoints);
        } else {
            this.scoreBoard[player.socketId] = [totalPoints];
        }

        return totalPoints;
    }

    public getScoreboard() {
        return this.scoreBoard;
    }
}