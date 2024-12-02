import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { Game } from './game/game'
import { Player } from './game/player'

interface ServerState {
    games: Record<string, Game>;
    players: Record<string, Player>;
}

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: 'https://jugaralaconga.vercel.app/',
        methods: ['GET', 'POST'],
        credentials: true,
    }
})
const port: number = 3000

// Estado del servidor
const state: ServerState = {
    games: {},
    players: {}
};

let gameIdCounter = 0;

// Middleware para manejar errores
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.get('/', (req, res) => {
    res.send({ status: 'Server is running' });
});

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    const getCurrentGame = () => {
        return Object.values(state.games).find(g =>
            g.players.some(p => p.socketId === socket.id)
        );
    };

    let currentGameId: number | null = null;

    socket.on('createGame', (maxPlayers: number) => {
        try {
            if (getCurrentGame()) {
                throw new Error('Ya estás en una sala de juego.');
            }

            currentGameId = gameIdCounter++;
            const game = new Game(maxPlayers);
            const player = new Player(socket.id);

            game.addPlayer(player);
            state.games[currentGameId] = game;
            state.players[socket.id] = player;

            socket.join(`game-${currentGameId}`);
            socket.emit('gameCreated', {
                gameId: currentGameId,
                playersCount: game.players.length,
                maxPlayers
            });
        } catch (error) {
            socket.emit('error', error instanceof Error ? error.message : 'Error al crear el juego');
        }
    });

    socket.on('joinGame', (gameId: number) => {
        try {
            const game = state.games[gameId];
            if (!game) {
                throw new Error('Juego no encontrado.');
            }

            if (game.players.length >= game.maxPlayers) {
                throw new Error('El juego está lleno.');
            }

            currentGameId = gameId;

            const player = new Player(socket.id);
            game.addPlayer(player);
            state.players[socket.id] = player;

            socket.join(`game-${currentGameId}`);

            io.to(`game-${currentGameId}`).emit('updatePlayers', {
                playersCount: game.players.length,
                maxPlayers: game.maxPlayers
            });

            if (game.players.length === game.maxPlayers) {
                game.dealCards();
                game.players.forEach((p, index) => {
                    io.to(p.socketId).emit('gameStarted', {
                        hand: p.getHand(),
                        playerIndex: index,
                        gameId: currentGameId,
                        scoreBoard: game.getScoreboard()
                    });
                });
                io.to(`game-${currentGameId}`).emit('turn', game.getTurn());
            }
        } catch (error) {
            socket.emit('error', error instanceof Error ? error.message : 'Error al unirse al juego');
        }
    });

    socket.on('playCard', (cardId: number) => {
        try {
            const player = state.players[socket.id];
            const game = getCurrentGame();

            if (!player || !game) {
                throw new Error('No estás en ningún juego.');
            }

            const cardToPlay = player.getHand().find(card => card.id === cardId);
            if (!cardToPlay) {
                throw new Error('Carta no válida.');
            }

            if (game.playCard(player, cardToPlay)) {
                io.to(`game-${currentGameId}`).emit('cardPlayed', {
                    playerId: socket.id,
                    card: cardToPlay,
                    lastPlayedCard: game.getLastPlayedCard()
                });

                game.players.forEach(p => {
                    io.to(p.socketId).emit('updateHand', p.getHand());
                });

                io.to(`game-${currentGameId}`).emit('gameState', {
                    currentTurn: game.getTurn(),
                    playersCount: game.getPlayerCount(),
                    isGameStarted: game.getIsGameStarted(),
                    lastPlayedCard: game.getLastPlayedCard()
                });
            } else {
                throw new Error('No puedes jugar en este momento.');
            }
        } catch (error) {
            socket.emit('error', error instanceof Error ? error.message : 'Error al jugar la carta');
        }
    });

    socket.on('drawCard', () => {
        try {
            const player = state.players[socket.id];
            const game = getCurrentGame();

            if (!player || !game) {
                throw new Error('No estás en ningún juego.');
            }

            if (player.getHand().length >= 8) {
                throw new Error('No puedes robar más cartas (máximo 8).');
            }

            if (game.drawCard(player)) {
                socket.emit('updateHand', player.getHand());

                io.to(`game-${currentGameId}`).emit('turn', game.getTurn());

                io.to(`game-${currentGameId}`).emit('playerDrewCard', {
                    playerId: socket.id,
                    handSize: player.getHand().length
                });

                io.to(`game-${currentGameId}`).emit('gameState', {
                    currentTurn: game.getTurn(),
                    playersCount: game.getPlayerCount(),
                    isGameStarted: game.getIsGameStarted(),
                    lastPlayedCard: game.getLastPlayedCard()
                });
            } else {
                throw new Error('No puedes robar carta en este momento.');
            }
        } catch (error) {
            socket.emit('error', error instanceof Error ? error.message : 'Error al robar carta');
        }
    });

    socket.on('drawLastPlayedCard', () => {
        try {
            const player = state.players[socket.id];
            const game = getCurrentGame();

            if (!player || !game) {
                throw new Error('No estás en ningún juego.');
            }

            if (player.getHand().length >= 8) {
                throw new Error('No puedes robar más cartas (máximo 8).');
            }

            if (game.drawLastPlayedCard(player)) {

                socket.emit('updateHand', player.getHand());

                io.to(`game-${currentGameId}`).emit('turn', game.getTurn());

                io.to(`game-${currentGameId}`).emit('playerDrewCard', {
                    playerId: socket.id,
                    handSize: player.getHand().length
                });


                game.setLastPlayedCardNull()

                io.to(`game-${currentGameId}`).emit('gameState', {
                    currentTurn: game.getTurn(),
                    playersCount: game.getPlayerCount(),
                    isGameStarted: game.getIsGameStarted(),
                    lastPlayedCard: game.getLastPlayedCard()
                });
            } else {
                throw new Error('No puedes robar carta en este momento.');
            }
        } catch (error) {
            socket.emit('error', error instanceof Error ? error.message : 'Error al robar carta');
        }
    })

    socket.on('endGame', (closingCard, combinedCards, leftOverCard) => {
        const player = state.players[socket.id];
        const game = getCurrentGame();

        if (!player || !game) {
            throw new Error('No estás en ningún juego.');
        }

        if (game.endGame(player, closingCard, combinedCards, leftOverCard)) {
            game.pointsController(player, combinedCards, [leftOverCard]);

            socket.broadcast.emit('getOtherPlayersPoints')

            io.to(`game-${currentGameId}`).emit('gameEnded', {
                currentTurn: game.getTurn(),
                playersCount: game.getPlayerCount(),
                isGameStarted: game.getIsGameStarted(),
                isGamePaused: game.getIsGamePaused(),
                lastPlayedCard: game.getLastPlayedCard(),
                scoreBoard: game.getScoreboard(),
                closerPlayerCards: {
                    closingCard,
                    leftOverCards: [leftOverCard],
                    combinedCards
                }
            })
        } else {
            socket.emit('error', 'Error al terminar juego');
        }
    })

    socket.on('otherPlayersCards', (leftOverCards?, combinedCards?) => {
        const player = state.players[socket.id];
        const game = getCurrentGame();

        if(game.otherPlayersCards(combinedCards)) {
            game.pointsController(player, combinedCards, leftOverCards)
            io.to(`game-${currentGameId}`).emit('gameEnded', {
                currentTurn: game.getTurn(),
                playersCount: game.getPlayerCount(),
                isGameStarted: game.getIsGameStarted(),
                isGamePaused: game.getIsGamePaused(),
                lastPlayedCard: game.getLastPlayedCard(),
                scoreBoard: game.getScoreboard(),
                closerPlayerCards: {},
                closedPlayerCards: {
                    leftOverCards,
                    combinedCards
                }
            })
            socket.emit('error', 'Cartas enviadas')
        } else {
            socket.emit('error', 'Error al enviar cartas.')
        }
    })

    socket.on('reDealCards', (gameId: number) => {
        const game = getCurrentGame();

        game.dealCards()
        game.players.forEach((p, index) => {
            io.to(p.socketId).emit('gameStarted', {
                hand: p.getHand(),
                playerIndex: index,
                gameId,
                scoreBoard: game.getScoreboard()
            });
            io.to(`game-${gameId}`).emit('resetGame', {
                currentTurn: game.getTurn(),
                isGamePaused: game.getIsGamePaused()
            });
        })
    })

    socket.on('reOrderCards', (socketId: string, newHand) => {
        const game = getCurrentGame();
        game.orderCards(socketId, newHand)
    })


    socket.on('disconnect', () => {
        const game = getCurrentGame();
        if (game) {
            io.to(`game-${currentGameId}`).emit('playerDisconnected', {
                message: 'Un jugador se ha desconectado',
                playerId: socket.id
            });

            game.removePlayer(socket.id);
            if (game.players.length === 0) {
                delete state.games[currentGameId];
            }
        }

        delete state.players[socket.id];
        console.log('Usuario desconectado:', socket.id);
    });
});

server.listen(port, () => {
    console.log(`Servidor ejecutándose en: http://localhost:${port}`);
});