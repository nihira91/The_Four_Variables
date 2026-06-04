/**
 * Progress Update Routes
 * Allow technicians to post updates and employees to view them
 */

const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progress.controller');
const protect = require('../middlewares/authmiddleware');

// 📝 ADD PROGRESS UPDATE (Technician only)
router.post('/add', protect, progressController.addProgressUpdate);

// 📋 GET PROGRESS UPDATES FOR ISSUE
router.get('/:issueId', protect, progressController.getProgressUpdates);

// 📄 GET FULL ISSUE WITH PROGRESS UPDATES
router.get('/issue/:issueId/full', protect, progressController.getIssueWithProgress);

// 🗑️ DELETE PROGRESS UPDATE (Only by technician who posted it)
router.delete('/update/:updateId/:issueId', protect, progressController.deleteProgressUpdate);

module.exports = router;
