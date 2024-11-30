import { Card } from './card';
import { Deck } from './deck'
import { Player } from './player'

export class Game {
    public players: Player[];
    private deck: Deck;
    private currentPlayerIndex: number;
    public maxPlayers: number;
    private lastPlayedCard: Card | null;
    private isGameStarted: boolean;
    private isGamePaused: boolean;
    private scoreBoard: { [key: string]: number[] };

    constructor(maxPlayers: number) {
        this.players = [];
        this.maxPlayers = maxPlayers;
        this.currentPlayerIndex = 0;
        this.lastPlayedCard = null;
        this.scoreBoard = {};
        this.isGamePaused = false;
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
        if (this.isGamePaused) this.isGamePaused = false;
        this.deck = new Deck();
        const hands = this.deck.dealCards(this.players.length, 7);
        this.players.forEach((player, i) => player.setHand(hands[i]));
        // Inicializar el turno al repartir
        this.currentPlayerIndex = 0;

        this.isGameStarted = true;
    }

    public playCard(player: Player, card: Card): boolean {
        if (!this.isGameStarted) return false;

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
        if (!this.isGameStarted) return false;

        const playerIndex = this.players.findIndex(p => p.socketId === player.socketId);

        // Verificar si es el turno del jugador
        if (playerIndex !== this.currentPlayerIndex) {
            return false;
        }

        const card = this.deck.drawCard();
        if (!card) {
            const playerHands = [];
            for (const player of this.players) {
                playerHands.push(player.getHand())
            }
            this.deck.resetDeck(playerHands);
        } else {
            player.drawCard(card);
            return true;
        }

        return false;
    }

    public drawLastPlayedCard(player: Player): boolean {
        if (!this.isGameStarted) return;

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

    public getIsGameStarted(): boolean {
        return this.isGameStarted;
    }

    public getIsGamePaused(): boolean {
        return this.isGamePaused;
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


        this.isGamePaused = true;
        return true;
    }

    private validCombinations(combinedCards: Card[][]): boolean {
        for (const combination of combinedCards) {
            if (combination.length === 0) continue;
            if (this.isSet(combination)) { continue; }
            if (this.isSequence(combination)) { continue; }

            return false
        }

        return true
    }

    private isSet(cards: Card[]): boolean {
        if(cards.length < 2) return false;
        const value = cards[0].value

        for (const card of cards) {
            if (card.value === 0) card.value = value
        }
        const validCombination = cards.every(card => card.value === value);

        return validCombination;
    }

    private isSequence(cards: Card[]): boolean {
        if(cards.length < 2) return false;

        const sortedCards = cards.slice().sort((a, b) => a.value - b.value)

        const suit = sortedCards.find(card => card.suit !== 'comodin')?.suit;
        let expectedValue = sortedCards[0].value;

        if (expectedValue === 0) expectedValue = sortedCards[1].value - 1

        for (const card of sortedCards) {
            if (card.suit === 'comodin') {
                expectedValue++;
                continue;
            }

            if (card.suit !== suit || card.value !== expectedValue) {
                return false;
            }

            expectedValue++;
        }

        return true;
    }

    public otherPlayersCards(combinedCards?: Card[][]): boolean {
        if(combinedCards[0].length > 1 || combinedCards[1].length > 1){
            const isValid = this.validCombinations(combinedCards);
            if (!isValid) return false;
        }   
        return true
    }

    public pointsController(player: Player, combinedCards?: Card[][], leftOverCards?: Card[]): number {
        let totalPoints = 0;

        if (leftOverCards && leftOverCards[0] !== null) {
            totalPoints += leftOverCards.reduce((sum, card) => sum + card.value, 0);
        }

        if (leftOverCards && leftOverCards[0] === null) {
            totalPoints = totalPoints - 10;
        }

        if (combinedCards && combinedCards[0].length > 0) {
            for (const combination of combinedCards) {
                if (combination.length === 0) continue;
                const isValidSet = this.isSet(combination);
                const isValidSequence = this.isSequence(combination);

                if (!isValidSet && !isValidSequence) {
                    totalPoints += combination.reduce((sum, card) => sum + card.value, 0);
                }
            }
        }

        if (this.scoreBoard[player.socketId]) {
            const lastScore = this.scoreBoard[player.socketId]?.[this.scoreBoard[player.socketId].length - 1] || 0;
            this.scoreBoard[player.socketId].push(totalPoints + lastScore);
            if (totalPoints + lastScore > 100) {
                this.removePlayer(player.socketId)
            }
        } else {
            this.scoreBoard[player.socketId] = [totalPoints];
        }

        return totalPoints;
    }

    public getScoreboard() {
        return this.scoreBoard;
    }

    public orderCards(socketId: string, newHand: Card[]): boolean {
        const player = this.players.find(p => p.socketId === socketId);
        
        if (!player) {
            console.log('Jugador no encontrado con socketId:', socketId);
            return false;
        }
    
        const currentHand = player.getHand();
    
        const isSameCards = newHand.length === currentHand.length &&
            newHand.every(card => currentHand.some(c => c.id === card.id));
    
        if (!isSameCards) {
            return false;
        }
    
        player.setHand(newHand);
        return true;
    }
}