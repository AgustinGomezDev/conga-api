// import { Card } from './card';
// import { Deck } from './deck'
// import { Player } from './player'

// export class Game {
//     public id: string;
//     public players: Player[];
//     private deck: Deck;
//     private currentPlayerIndex: number = 0;
//     public maxPlayers: number;

//     constructor(maxPlayers: number) {
//         this.deck = new Deck();
//         this.players = []
//         this.maxPlayers = maxPlayers;
//         this.id = crypto.randomUUID();
//     }

//     public addPlayer(player: Player): boolean {
//         if (this.players.length < this.maxPlayers) {
//             this.players.push(player);
//             return true;
//         }
//         return false;
//     }

//     public removePlayer(socketId: string): boolean {
//         const playerIndex = this.players.findIndex(player => player.socketId === socketId);

//         if (playerIndex === -1) {
//             return false; // Jugador no encontrado
//         }

//         // Remover el jugador del array
//         this.players.splice(playerIndex, 1);
//     }


//     public dealCards() {
//         const hands = this.deck.dealCards(this.players.length, 7);
//         this.players.forEach((player, i) => player.setHand(hands[i]));
//     }

//     public nextTurn(play: string, args?: Card) {
//         const currentPlayer = this.players[this.currentPlayerIndex];
//         switch (play) {
//             case 'play': {
//                 const canPlay = currentPlayer.playCard(args || null)
//                 if (canPlay) {
//                     this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length
//                 }
//                 break;
//             }
//             case 'draw': {
//                 currentPlayer.drawCard(this.deck.drawCard())
//                 break;
//             }
//             case 'end': {
//                 break;
//             }
//         }
//     }

//     public getTurn(): number {
//         return this.currentPlayerIndex
//     }
// }

// ---------------

import { Card } from './card';
import { Deck } from './deck'
import { Player } from './player'

export class Game {
    public players: Player[];
    private deck: Deck;
    private currentPlayerIndex: number;
    public maxPlayers: number;
    private lastPlayedCard: Card | null;

    constructor(maxPlayers: number) {
        this.deck = new Deck();
        this.players = [];
        this.maxPlayers = maxPlayers;
        this.currentPlayerIndex = 0;
        this.lastPlayedCard = null;
    }

    public addPlayer(player: Player): boolean {
        if (this.players.length < this.maxPlayers) {
            this.players.push(player);
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
    }

    public playCard(player: Player, card: Card): boolean {
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

    public drawLastPlayedCard(player: Player) : boolean {
        const playerIndex = this.players.findIndex(p => p.socketId === player.socketId);
        
        // Verificar si es el turno del jugador
        if (playerIndex !== this.currentPlayerIndex) {
            return false;
        }

        const lastPlayedCard = this.getLastPlayedCard()

        if(lastPlayedCard){
            player.drawCard(lastPlayedCard)
            return true
        }

        return false
    }

    public setLastPlayedCardNull() : boolean {
        try {
            this.lastPlayedCard = null
            return true
        } catch (error) {
            return false
        }
    }

    public getLastPlayedCardNull() : Card | null {
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
        return this.players.length >= 2;
    }

    public getPlayerCount(): number {
        return this.players.length;
    }
}

