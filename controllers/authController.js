const User = require('../models/User');
const Room = require('../models/Room');

// GET Login page
exports.getLogin = (req, res) => {
    if (req.session.user) {
        return res.redirect('/chat');
    }
    res.render('auth/login', { 
        title: 'Login - Lynx Chat',
        error: null
    });
};

// GET Register page
exports.getRegister = (req, res) => {
    if (req.session.user) {
        return res.redirect('/chat');
    }
    res.render('auth/register', { 
        title: 'Register - Lynx Chat',
        error: null
    });
};

// POST Login
exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.render('auth/login', {
                title: 'Login - Lynx Chat',
                error: 'Please fill in all fields'
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.render('auth/login', {
                title: 'Login - Lynx Chat',
                error: 'Invalid email or password'
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.render('auth/login', {
                title: 'Login - Lynx Chat',
                error: 'Invalid email or password'
            });
        }

        // Update user status
        user.status = 'online';
        await user.save();

        // Set session
        req.session.user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.getAvatar()
        };

        res.redirect('/chat');
    } catch (error) {
        console.error('Login error:', error);
        res.render('auth/login', {
            title: 'Login - Lynx Chat',
            error: 'An error occurred. Please try again.'
        });
    }
};

// POST Register
exports.postRegister = async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // Validate input
        if (!username || !email || !password || !confirmPassword) {
            return res.render('auth/register', {
                title: 'Register - Lynx Chat',
                error: 'Please fill in all fields'
            });
        }

        if (password !== confirmPassword) {
            return res.render('auth/register', {
                title: 'Register - Lynx Chat',
                error: 'Passwords do not match'
            });
        }

        if (password.length < 6) {
            return res.render('auth/register', {
                title: 'Register - Lynx Chat',
                error: 'Password must be at least 6 characters'
            });
        }

        if (username.length < 3 || username.length > 20) {
            return res.render('auth/register', {
                title: 'Register - Lynx Chat',
                error: 'Username must be between 3 and 20 characters'
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { username }]
        });

        if (existingUser) {
            return res.render('auth/register', {
                title: 'Register - Lynx Chat',
                error: 'Username or email already exists'
            });
        }

        // Create user
        const user = new User({
            username,
            email: email.toLowerCase(),
            password,
            status: 'online'
        });

        await user.save();

        // Auto-join the General room if it exists
        let generalRoom = await Room.findOne({ name: 'General', type: 'public' });
        if (!generalRoom) {
            // Create General room if it doesn't exist
            generalRoom = new Room({
                name: 'General',
                description: 'Welcome to Lynx Chat! This is the general discussion room.',
                type: 'public',
                creator: user._id,
                members: [user._id],
                admins: [user._id]
            });
            await generalRoom.save();
        } else {
            generalRoom.members.push(user._id);
            await generalRoom.save();
        }

        user.rooms.push(generalRoom._id);
        await user.save();

        // Set session
        req.session.user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.getAvatar()
        };

        res.redirect('/chat');
    } catch (error) {
        console.error('Register error:', error);
        res.render('auth/register', {
            title: 'Register - Lynx Chat',
            error: 'An error occurred. Please try again.'
        });
    }
};

// Logout
exports.logout = async (req, res) => {
    try {
        if (req.session.user) {
            await User.findByIdAndUpdate(req.session.user._id, { status: 'offline' });
        }
        req.session.destroy();
        res.redirect('/');
    } catch (error) {
        console.error('Logout error:', error);
        res.redirect('/');
    }
};
