// Authentication middleware

exports.isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
};

exports.isGuest = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return next();
    }
    res.redirect('/chat');
};
