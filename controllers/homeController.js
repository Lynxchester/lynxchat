// Home Controller

exports.getHome = (req, res) => {
    res.render('index', { 
        title: 'Welcome'
    });
};
