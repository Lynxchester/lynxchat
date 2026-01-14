// Lynx Chat - Real-time Chat Client

document.addEventListener('DOMContentLoaded', () => {
    // Toggle members sidebar
    const toggleMembersBtn = document.getElementById('toggleMembers');
    const closeMembersBtn = document.getElementById('closeMembers');
    const membersSidebar = document.getElementById('membersSidebar');

    if (toggleMembersBtn && membersSidebar) {
        toggleMembersBtn.addEventListener('click', () => {
            membersSidebar.classList.toggle('active');
        });
    }

    if (closeMembersBtn && membersSidebar) {
        closeMembersBtn.addEventListener('click', () => {
            membersSidebar.classList.remove('active');
        });
    }

    // Open game select modal
    const openGameSelectBtn = document.getElementById('openGameSelect');
    const selectPlayerModal = document.getElementById('selectPlayerModal');
    const closeSelectPlayerModalBtn = document.getElementById('closeSelectPlayerModal');

    if (openGameSelectBtn && selectPlayerModal) {
        openGameSelectBtn.addEventListener('click', () => {
            selectPlayerModal.style.display = 'flex';
        });
    }

    if (closeSelectPlayerModalBtn && selectPlayerModal) {
        closeSelectPlayerModalBtn.addEventListener('click', () => {
            selectPlayerModal.style.display = 'none';
        });
    }

    // Close modal when clicking outside
    if (selectPlayerModal) {
        selectPlayerModal.addEventListener('click', (e) => {
            if (e.target === selectPlayerModal) {
                selectPlayerModal.style.display = 'none';
            }
        });
    }
});

// Initialize Socket.io connection for chat rooms
if (typeof io !== 'undefined' && typeof roomId !== 'undefined') {
    const socket = io();
    const chatMessages = document.getElementById('chatMessages');
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const typingIndicator = document.getElementById('typingIndicator');
    const selectPlayerModal = document.getElementById('selectPlayerModal');

    let typingTimeout;
    let isTyping = false;

    // Join room on connect
    socket.emit('join-room', roomId);

    // Receive room history
    socket.on('room-history', (messages) => {
        chatMessages.innerHTML = '';
        messages.forEach(msg => renderMessage(msg));
        scrollToBottom();
    });

    // Receive new message
    socket.on('new-message', (message) => {
        renderMessage(message);
        scrollToBottom();
    });

    // User joined notification
    socket.on('user-joined', (data) => {
        showSystemMessage(`${data.username} joined the chat`);
    });

    // User left notification
    socket.on('user-left', (data) => {
        showSystemMessage(`${data.username} left the chat`);
    });

    // Typing indicator
    socket.on('user-typing', (data) => {
        typingIndicator.style.display = 'block';
        typingIndicator.querySelector('.typing-text').textContent = `${data.username} is typing...`;
    });

    socket.on('user-stop-typing', (data) => {
        typingIndicator.style.display = 'none';
    });

    // Send message
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        
        if (message) {
            socket.emit('chat-message', { message, roomId });
            messageInput.value = '';
            
            // Stop typing indicator
            socket.emit('stop-typing', roomId);
            isTyping = false;
        }
    });

    // Typing indicator
    messageInput.addEventListener('input', () => {
        if (!isTyping) {
            isTyping = true;
            socket.emit('typing', roomId);
        }

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            isTyping = false;
            socket.emit('stop-typing', roomId);
        }, 1000);
    });

    // Render a message
    function renderMessage(msg) {
        const isOwn = msg.sender._id === currentUser._id;
        const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageHtml = `
            <div class="message ${isOwn ? 'own' : ''}">
                <img src="${msg.sender.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(msg.sender.username) + '&background=6366f1&color=fff'}" 
                     alt="${msg.sender.username}" 
                     class="message-avatar">
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-username">${msg.sender.username}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-bubble">${escapeHtml(msg.content)}</div>
                </div>
            </div>
        `;
        
        chatMessages.insertAdjacentHTML('beforeend', messageHtml);
    }

    // Show system message
    function showSystemMessage(text) {
        const msgHtml = `
            <div class="system-message" style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 0.5rem;">
                ${text}
            </div>
        `;
        chatMessages.insertAdjacentHTML('beforeend', msgHtml);
        scrollToBottom();
    }

    // Scroll to bottom of messages
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== GAME SYSTEM ==========
    const gameInviteModal = document.getElementById('gameInviteModal');
    const gameModal = document.getElementById('gameModal');
    const gameBoard = document.getElementById('gameBoard');
    const gameStatus = document.getElementById('gameStatus');
    const gameCells = document.querySelectorAll('.game-cell');
    
    let currentGame = null;
    let mySymbol = null;
    let pendingInvite = null;

    // Helper function to send game invite
    function sendGameInvite(targetUsername) {
        socket.emit('game-invite', { 
            targetUsername, 
            roomId, 
            gameType: 'tictactoe' 
        });
        showSystemMessage(`Game invite sent to ${targetUsername}`);
        if (selectPlayerModal) {
            selectPlayerModal.style.display = 'none';
        }
    }

    // Invite to play button clicks (in members sidebar)
    document.querySelectorAll('.game-invite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            sendGameInvite(btn.dataset.username);
        });
    });

    // Invite buttons in player select modal
    document.querySelectorAll('.invite-player-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            sendGameInvite(btn.dataset.username);
        });
    });

    // Game invite sent confirmation
    socket.on('game-invite-sent', (data) => {
        showSystemMessage(`Waiting for ${data.to} to accept...`);
    });

    // Game invite received
    socket.on('game-invite-received', (data) => {
        pendingInvite = data;
        document.getElementById('inviteMessage').textContent = 
            `${data.from} wants to play Tic-Tac-Toe with you!`;
        gameInviteModal.style.display = 'flex';
    });

    // Accept invite button
    document.getElementById('acceptInvite')?.addEventListener('click', () => {
        if (pendingInvite) {
            socket.emit('game-accept', { 
                fromSocketId: pendingInvite.fromSocketId, 
                gameType: pendingInvite.gameType 
            });
            gameInviteModal.style.display = 'none';
            pendingInvite = null;
        }
    });

    // Decline invite button
    document.getElementById('declineInvite')?.addEventListener('click', () => {
        if (pendingInvite) {
            socket.emit('game-decline', { fromSocketId: pendingInvite.fromSocketId });
            gameInviteModal.style.display = 'none';
            pendingInvite = null;
        }
    });

    // Close invite modal
    document.getElementById('closeInviteModal')?.addEventListener('click', () => {
        if (pendingInvite) {
            socket.emit('game-decline', { fromSocketId: pendingInvite.fromSocketId });
        }
        gameInviteModal.style.display = 'none';
        pendingInvite = null;
    });

    // Game declined
    socket.on('game-declined', (data) => {
        showSystemMessage(`${data.by} declined your game invite`);
    });

    // Game error
    socket.on('game-error', (data) => {
        showSystemMessage(`Game error: ${data.message}`);
    });

    // Game start
    socket.on('game-start', (data) => {
        currentGame = data.gameId;
        mySymbol = data.yourSymbol;
        
        document.getElementById('playerX').textContent = data.gameState.playerNames.X;
        document.getElementById('playerO').textContent = data.gameState.playerNames.O;
        
        updateGameBoard(data.gameState);
        gameModal.style.display = 'flex';
        showSystemMessage(`Game started with ${data.opponent}!`);
    });

    // Game update
    socket.on('game-update', (data) => {
        updateGameBoard(data.gameState);
    });

    // Update game board UI
    function updateGameBoard(gameState) {
        gameCells.forEach((cell, index) => {
            cell.textContent = gameState.board[index] || '';
            cell.className = 'game-cell';
            if (gameState.board[index]) {
                cell.classList.add(gameState.board[index].toLowerCase());
            }
        });

        // Update status
        if (gameState.gameOver) {
            if (gameState.forfeit) {
                gameStatus.textContent = gameState.winner === mySymbol ? 
                    '🎉 Opponent forfeited! You win!' : '😔 You forfeited!';
            } else if (gameState.winner) {
                gameStatus.textContent = gameState.winner === mySymbol ? 
                    '🎉 You win!' : '😔 You lose!';
            } else {
                gameStatus.textContent = "🤝 It's a draw!";
            }
            gameStatus.classList.add('game-over');
        } else {
            gameStatus.textContent = gameState.currentTurn === mySymbol ? 
                "Your turn" : "Opponent's turn";
            gameStatus.classList.remove('game-over');
        }
    }

    // Cell click handler
    gameCells.forEach(cell => {
        cell.addEventListener('click', () => {
            if (!currentGame) return;
            const index = parseInt(cell.dataset.index);
            socket.emit('game-move', { gameId: currentGame, position: index });
        });
    });

    // Quit game button
    document.getElementById('quitGame')?.addEventListener('click', () => {
        if (currentGame && confirm('Are you sure you want to forfeit?')) {
            socket.emit('game-quit', { gameId: currentGame });
        }
    });

    // Close game modal
    document.getElementById('closeGameModal')?.addEventListener('click', () => {
        if (currentGame) {
            if (confirm('Leave the game? This will count as a forfeit if the game is still in progress.')) {
                socket.emit('game-quit', { gameId: currentGame });
                gameModal.style.display = 'none';
                currentGame = null;
                mySymbol = null;
                // Reset board
                gameCells.forEach(cell => {
                    cell.textContent = '';
                    cell.className = 'game-cell';
                });
            }
        } else {
            gameModal.style.display = 'none';
        }
    });
}
