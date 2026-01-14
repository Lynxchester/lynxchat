const Room = require('../models/Room');
const User = require('../models/User');
const Message = require('../models/Message');

// GET Chat Home - List of user's rooms
exports.getChatHome = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id).populate({
            path: 'rooms',
            populate: {
                path: 'lastMessage',
                populate: { path: 'sender', select: 'username' }
            }
        });

        res.render('chat/home', {
            title: 'Chat - Lynx Chat',
            rooms: user.rooms || []
        });
    } catch (error) {
        console.error('Get chat home error:', error);
        res.render('error', { title: 'Error', error });
    }
};

// GET Create Room page
exports.getCreateRoom = (req, res) => {
    res.render('chat/create-room', {
        title: 'Create Room - Lynx Chat',
        error: null
    });
};

// POST Create Room
exports.postCreateRoom = async (req, res) => {
    try {
        const { name, description, type } = req.body;
        const userId = req.session.user._id;

        if (!name || name.trim().length === 0) {
            return res.render('chat/create-room', {
                title: 'Create Room - Lynx Chat',
                error: 'Room name is required'
            });
        }

        // Check if room with same name exists
        const existingRoom = await Room.findOne({ name: name.trim() });
        if (existingRoom) {
            return res.render('chat/create-room', {
                title: 'Create Room - Lynx Chat',
                error: 'A room with this name already exists'
            });
        }

        const room = new Room({
            name: name.trim(),
            description: description?.trim() || '',
            type: type || 'public',
            creator: userId,
            members: [userId],
            admins: [userId]
        });

        await room.save();

        // Add room to user's rooms
        await User.findByIdAndUpdate(userId, {
            $push: { rooms: room._id }
        });

        res.redirect(`/chat/room/${room._id}`);
    } catch (error) {
        console.error('Create room error:', error);
        res.render('chat/create-room', {
            title: 'Create Room - Lynx Chat',
            error: 'An error occurred. Please try again.'
        });
    }
};

// Join Room
exports.joinRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.session.user._id;

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // Check if already a member
        if (room.members.includes(userId)) {
            return res.redirect(`/chat/room/${roomId}`);
        }

        // Add user to room
        room.members.push(userId);
        await room.save();

        // Add room to user's rooms
        await User.findByIdAndUpdate(userId, {
            $push: { rooms: room._id }
        });

        res.redirect(`/chat/room/${roomId}`);
    } catch (error) {
        console.error('Join room error:', error);
        res.redirect('/chat');
    }
};

// Leave Room
exports.leaveRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.session.user._id;

        // Remove user from room
        await Room.findByIdAndUpdate(roomId, {
            $pull: { members: userId, admins: userId }
        });

        // Remove room from user's rooms
        await User.findByIdAndUpdate(userId, {
            $pull: { rooms: roomId }
        });

        res.redirect('/chat');
    } catch (error) {
        console.error('Leave room error:', error);
        res.redirect('/chat');
    }
};

// GET Chat Room
exports.getChatRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.session.user._id;

        const room = await Room.findById(roomId)
            .populate('members', 'username avatar status')
            .populate('creator', 'username');

        if (!room) {
            return res.status(404).render('404', { title: 'Room Not Found' });
        }

        // Check if user is a member (for private rooms)
        if (room.type === 'private' && !room.members.some(m => m._id.toString() === userId.toString())) {
            return res.status(403).render('error', { 
                title: 'Access Denied', 
                error: { message: 'You are not a member of this room' }
            });
        }

        // Get user's rooms for sidebar
        const user = await User.findById(userId).populate('rooms');

        res.render('chat/room', {
            title: `${room.name} - Lynx Chat`,
            room,
            userRooms: user.rooms || []
        });
    } catch (error) {
        console.error('Get chat room error:', error);
        res.render('error', { title: 'Error', error });
    }
};

// GET Public Rooms
exports.getPublicRooms = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const publicRooms = await Room.find({ type: 'public' })
            .populate('creator', 'username')
            .sort({ createdAt: -1 });

        // Get user's room IDs
        const user = await User.findById(userId);
        const userRoomIds = user.rooms.map(r => r.toString());

        res.render('chat/public-rooms', {
            title: 'Public Rooms - Lynx Chat',
            rooms: publicRooms,
            userRoomIds
        });
    } catch (error) {
        console.error('Get public rooms error:', error);
        res.render('error', { title: 'Error', error });
    }
};
