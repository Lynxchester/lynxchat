const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Login page
router.get('/login', authController.getLogin);

// Register page
router.get('/register', authController.getRegister);

// Login POST
router.post('/login', authController.postLogin);

// Register POST
router.post('/register', authController.postRegister);

// Logout
router.get('/logout', authController.logout);

module.exports = router;
