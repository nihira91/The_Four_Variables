/* Profession Type Controller */

const ProfessionType = require('../models/professionType.model');
const User = require('../models/user.model');

/**
 * Create new Profession Type
 * Admin only endpoint
 */
exports.createProfessionType = async (req, res) => {
  try {
    const { name, description, skills } = req.body;
    const adminId = req.user._id;

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Profession name is required' });
    }

    // Check if already exists
    const existingType = await ProfessionType.findOne({ name: name.trim() });
    if (existingType) {
      return res.status(400).json({ error: 'Profession type already exists' });
    }

    // Create new profession type
    const professionType = new ProfessionType({
      name: name.trim(),
      description: description || null,
      skills: skills || [],
      createdBy: adminId,
      isActive: true
    });

    await professionType.save();

    res.status(201).json({
      message: 'Profession type created successfully',
      data: professionType
    });
  } catch (error) {
    console.error('Error creating profession type:', error);
    res.status(500).json({ error: 'Failed to create profession type' });
  }
};

/**
 * Get all Profession Types
 */
exports.getAllProfessionTypes = async (req, res) => {
  try {
    const { isActive } = req.query;
    
    let query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const professionTypes = await ProfessionType.find(query)
      .populate('createdBy', 'name email role')
      .sort('-createdAt');

    res.json({
      total: professionTypes.length,
      data: professionTypes
    });
  } catch (error) {
    console.error('Error fetching profession types:', error);
    res.status(500).json({ error: 'Failed to fetch profession types' });
  }
};

/**
 * Get single Profession Type
 */
exports.getProfessionType = async (req, res) => {
  try {
    const { id } = req.params;

    const professionType = await ProfessionType.findById(id)
      .populate('createdBy', 'name email role');

    if (!professionType) {
      return res.status(404).json({ error: 'Profession type not found' });
    }

    res.json(professionType);
  } catch (error) {
    console.error('Error fetching profession type:', error);
    res.status(500).json({ error: 'Failed to fetch profession type' });
  }
};

/**
 * Update Profession Type
 * Admin only
 */
exports.updateProfessionType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, skills, isActive } = req.body;

    const professionType = await ProfessionType.findById(id);
    if (!professionType) {
      return res.status(404).json({ error: 'Profession type not found' });
    }

    // Check if new name already exists
    if (name && name !== professionType.name) {
      const existing = await ProfessionType.findOne({ name: name.trim() });
      if (existing) {
        return res.status(400).json({ error: 'Profession name already exists' });
      }
    }

    // Update fields
    if (name) professionType.name = name.trim();
    if (description !== undefined) professionType.description = description;
    if (skills) professionType.skills = skills;
    if (isActive !== undefined) professionType.isActive = isActive;

    await professionType.save();

    res.json({
      message: 'Profession type updated successfully',
      data: professionType
    });
  } catch (error) {
    console.error('Error updating profession type:', error);
    res.status(500).json({ error: 'Failed to update profession type' });
  }
};

/**
 * Delete Profession Type
 * Admin only
 * Soft delete - set isActive to false
 */
exports.deleteProfessionType = async (req, res) => {
  try {
    const { id } = req.params;

    const professionType = await ProfessionType.findById(id);
    if (!professionType) {
      return res.status(404).json({ error: 'Profession type not found' });
    }

    // Check if any technician uses this profession type
    const techniciansCount = await User.countDocuments({
      professionType: id,
      role: 'technician'
    });

    if (techniciansCount > 0) {
      return res.status(400).json({
        error: `Cannot delete. ${techniciansCount} technician(s) are using this profession type`,
        techniciansCount
      });
    }

    // Soft delete
    professionType.isActive = false;
    await professionType.save();

    res.json({ message: 'Profession type deleted successfully' });
  } catch (error) {
    console.error('Error deleting profession type:', error);
    res.status(500).json({ error: 'Failed to delete profession type' });
  }
};

/**
 * Add skill to Profession Type
 */
exports.addSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const { skill } = req.body;

    if (!skill || !skill.trim()) {
      return res.status(400).json({ error: 'Skill is required' });
    }

    const professionType = await ProfessionType.findById(id);
    if (!professionType) {
      return res.status(404).json({ error: 'Profession type not found' });
    }

    // Check if skill already exists
    if (professionType.skills.includes(skill.trim())) {
      return res.status(400).json({ error: 'Skill already exists' });
    }

    professionType.skills.push(skill.trim());
    await professionType.save();

    res.json({
      message: 'Skill added successfully',
      data: professionType
    });
  } catch (error) {
    console.error('Error adding skill:', error);
    res.status(500).json({ error: 'Failed to add skill' });
  }
};

/**
 * Remove skill from Profession Type
 */
exports.removeSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const { skill } = req.body;

    if (!skill || !skill.trim()) {
      return res.status(400).json({ error: 'Skill is required' });
    }

    const professionType = await ProfessionType.findByIdAndUpdate(
      id,
      { $pull: { skills: skill.trim() } },
      { new: true }
    );

    if (!professionType) {
      return res.status(404).json({ error: 'Profession type not found' });
    }

    res.json({
      message: 'Skill removed successfully',
      data: professionType
    });
  } catch (error) {
    console.error('Error removing skill:', error);
    res.status(500).json({ error: 'Failed to remove skill' });
  }
};

/**
 * Get Technicians by Profession Type
 */
exports.getTechniciansByProfession = async (req, res) => {
  try {
    const { id } = req.params;

    const technicians = await User.find({
      professionType: id,
      role: 'technician'
    }).select('name email skills isAvailable currentWorkload maxCapacity rating');

    res.json({
      professionTypeId: id,
      total: technicians.length,
      data: technicians
    });
  } catch (error) {
    console.error('Error fetching technicians:', error);
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
};
