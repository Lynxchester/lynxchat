const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { isAuthenticated } = require('../middleware/auth');

// All chat routes require authentication
router.use(isAuthenticated);

// Chat home - list of rooms
router.get('/', chatController.getChatHome);

// Create room page
router.get('/create-room', chatController.getCreateRoom);

// Create room POST
router.post('/create-room', chatController.postCreateRoom);

// Join room
router.post('/join-room/:roomId', chatController.joinRoom);

// Leave room
router.post('/leave-room/:roomId', chatController.leaveRoom);

// Chat room
router.get('/room/:roomId', chatController.getChatRoom);

// Get public rooms
router.get('/public-rooms', chatController.getPublicRooms);

module.exports = router;
