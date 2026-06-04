/* Admin Authentication Routes */

const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const verifyToken = require('../middlewares/authmiddleware');

// Auth Routes
router.post('/signup', adminAuthController.adminSignup);
router.post('/login', adminAuthController.adminLogin);
router.post('/logout', verifyToken, adminAuthController.adminLogout);

// Profile Routes
router.get('/profile', verifyToken, adminAuthController.getAdminProfile);
router.put('/profile', verifyToken, adminAuthController.updateAdminProfile);
router.post('/change-password', verifyToken, adminAuthController.changePassword);

// Admin Management Routes (Super Admin)
router.get('/all', verifyToken, adminAuthController.getAllAdmins);
router.put('/deactivate/:adminId', verifyToken, adminAuthController.deactivateAdmin);
router.put('/permissions/:adminId', verifyToken, adminAuthController.updateAdminPermissions);

module.exports = router;
