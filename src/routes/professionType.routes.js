/* Profession Type Routes */

const express = require('express');
const router = express.Router();
const professionTypeController = require('../controllers/professionType.controller');
const verifyToken = require('../middlewares/authmiddleware');
const { adminAuthCheck } = require('../middlewares/adminAuthCheck');

// Middleware to verify admin
const verifyAdmin = [verifyToken, adminAuthCheck];

/**
 * @route POST /api/profession-types
 * @desc Create new profession type
 * @access Admin only
 */
router.post('/', verifyAdmin, professionTypeController.createProfessionType);

/**
 * @route GET /api/profession-types
 * @desc Get all profession types
 * @access Public (but can add filter for active only)
 */
router.get('/', professionTypeController.getAllProfessionTypes);

/**
 * @route GET /api/profession-types/:id
 * @desc Get single profession type
 * @access Public
 */
router.get('/:id', professionTypeController.getProfessionType);

/**
 * @route PUT /api/profession-types/:id
 * @desc Update profession type
 * @access Admin only
 */
router.put('/:id', verifyAdmin, professionTypeController.updateProfessionType);

/**
 * @route DELETE /api/profession-types/:id
 * @desc Delete profession type (soft delete)
 * @access Admin only
 */
router.delete('/:id', verifyAdmin, professionTypeController.deleteProfessionType);

/**
 * @route POST /api/profession-types/:id/skills
 * @desc Add skill to profession type
 * @access Admin only
 */
router.post('/:id/skills', verifyAdmin, professionTypeController.addSkill);

/**
 * @route DELETE /api/profession-types/:id/skills
 * @desc Remove skill from profession type
 * @access Admin only
 */
router.delete('/:id/skills', verifyAdmin, professionTypeController.removeSkill);

/**
 * @route GET /api/profession-types/:id/technicians
 * @desc Get all technicians of a profession type
 * @access Admin, Technicians
 */
router.get('/:id/technicians', verifyToken, professionTypeController.getTechniciansByProfession);

module.exports = router;
