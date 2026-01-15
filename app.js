const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lynxchat')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Session configuration
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'lynxchat-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/lynxchat'
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(sessionMiddleware);

// Make user available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);

// Socket.io middleware to share session
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// Socket.io for real-time chat
const Message = require('./models/Message');
const User = require('./models/User');
const Room = require('./models/Room');

const onlineUsers = new Map();
const activeGames = new Map(); // Moved outside to share between all connections

io.on('connection', (socket) => {
    const session = socket.request.session;
    
    if (!session.user) {
        socket.disconnect();
        return;
    }

    const userId = session.user._id;
    const username = session.user.username;
    
    console.log(`${username} connected`);
    onlineUsers.set(socket.id, { id: userId, username });

    // Join a room
    socket.on('join-room', async (roomId) => {
        socket.join(roomId);
        socket.currentRoom = roomId;
        
        // Get recent messages for the room
        const messages = await Message.find({ room: roomId })
            .populate('sender', 'username avatar')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        
        socket.emit('room-history', messages.reverse());
        
        // Notify room that user joined
        socket.to(roomId).emit('user-joined', { username, roomId });
    });

    // Handle chat message
    socket.on('chat-message', async (data) => {
        const { message, roomId } = data;
        
        if (!message || !roomId) return;

        try {
            const newMessage = new Message({
                content: message,
                sender: userId,
                room: roomId
            });
            await newMessage.save();

            const populatedMessage = await Message.findById(newMessage._id)
                .populate('sender', 'username avatar')
                .lean();

            io.to(roomId).emit('new-message', populatedMessage);
        } catch (error) {
            console.error('Error saving message:', error);
        }
    });

    // Leave room
    socket.on('leave-room', (roomId) => {
        socket.leave(roomId);
        socket.to(roomId).emit('user-left', { username, roomId });
    });

    // Typing indicator
    socket.on('typing', (roomId) => {
        socket.to(roomId).emit('user-typing', { username });
    });

    socket.on('stop-typing', (roomId) => {
        socket.to(roomId).emit('user-stop-typing', { username });
    });

    // ========== GAME SYSTEM ==========

    // Send game invite
    socket.on('game-invite', (data) => {
        const { targetUsername, roomId, gameType } = data;
        
        // Find target user's socket
        for (const [socketId, user] of onlineUsers.entries()) {
            if (user.username === targetUsername) {
                io.to(socketId).emit('game-invite-received', {
                    from: username,
                    fromSocketId: socket.id,
                    gameType,
                    roomId
                });
                socket.emit('game-invite-sent', { to: targetUsername });
                return;
            }
        }
        socket.emit('game-error', { message: 'User not found or offline' });
    });

    // Accept game invite
    socket.on('game-accept', (data) => {
        const { fromSocketId, gameType } = data;
        
        const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const gameState = {
            id: gameId,
            type: gameType,
            players: {
                X: fromSocketId,
                O: socket.id
            },
            playerNames: {
                X: onlineUsers.get(fromSocketId)?.username,
                O: username
            },
            board: Array(9).fill(null),
            currentTurn: 'X',
            winner: null,
            gameOver: false
        };
        
        activeGames.set(gameId, gameState);
        
        // Notify both players
        io.to(fromSocketId).emit('game-start', { 
            gameId, 
            gameState,
            yourSymbol: 'X',
            opponent: username
        });
        socket.emit('game-start', { 
            gameId, 
            gameState,
            yourSymbol: 'O',
            opponent: onlineUsers.get(fromSocketId)?.username
        });
    });

    // Decline game invite
    socket.on('game-decline', (data) => {
        const { fromSocketId } = data;
        io.to(fromSocketId).emit('game-declined', { by: username });
    });

    // Make a move
    socket.on('game-move', (data) => {
        const { gameId, position } = data;
        const game = activeGames.get(gameId);
        
        if (!game || game.gameOver) return;
        
        // Check if it's this player's turn
        const playerSymbol = game.players.X === socket.id ? 'X' : 'O';
        if (game.currentTurn !== playerSymbol) return;
        
        // Check if position is valid
        if (game.board[position] !== null) return;
        
        // Make the move
        game.board[position] = playerSymbol;
        game.currentTurn = playerSymbol === 'X' ? 'O' : 'X';
        
        // Check for winner
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];
        
        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (game.board[a] && game.board[a] === game.board[b] && game.board[a] === game.board[c]) {
                game.winner = playerSymbol;
                game.gameOver = true;
                break;
            }
        }
        
        // Check for draw
        if (!game.winner && game.board.every(cell => cell !== null)) {
            game.gameOver = true;
        }
        
        // Notify both players
        io.to(game.players.X).emit('game-update', { gameId, gameState: game });
        io.to(game.players.O).emit('game-update', { gameId, gameState: game });
        
        // Clean up finished game after delay
        if (game.gameOver) {
            setTimeout(() => activeGames.delete(gameId), 60000);
        }
    });

    // Forfeit/quit game
    socket.on('game-quit', (data) => {
        const { gameId } = data;
        const game = activeGames.get(gameId);
        
        if (!game) return;
        
        const playerSymbol = game.players.X === socket.id ? 'X' : 'O';
        game.winner = playerSymbol === 'X' ? 'O' : 'X';
        game.gameOver = true;
        game.forfeit = true;
        
        io.to(game.players.X).emit('game-update', { gameId, gameState: game });
        io.to(game.players.O).emit('game-update', { gameId, gameState: game });
        
        activeGames.delete(gameId);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`${username} disconnected`);
        onlineUsers.delete(socket.id);
        
        // Clean up any active games this player was in
        for (const [gameId, game] of activeGames.entries()) {
            if (game.players.X === socket.id || game.players.O === socket.id) {
                const opponentSocketId = game.players.X === socket.id ? game.players.O : game.players.X;
                game.winner = game.players.X === socket.id ? 'O' : 'X';
                game.gameOver = true;
                game.forfeit = true;
                game.disconnected = true;
                io.to(opponentSocketId).emit('game-update', { gameId, gameState: game });
                activeGames.delete(gameId);
            }
        }
        
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('user-left', { username });
        }
    });
});

// 404 Handler
app.use((req, res, next) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { title: 'Error', error: err });
});

// Start server
server.listen(PORT, () => {
    console.log(`Lynx Chat is running on http://localhost:${PORT}`);
});
