/* Admin Authentication Controller */

const jwt = require('jsonwebtoken');

// Load Admin model safely
let Admin;
try {
    Admin = require('../models/admin.model');
} catch (error) {
    console.log('⚠️ Admin model not yet available');
}

// Admin Signup (Super Admin only)
exports.adminSignup = async (req, res) => {
    try {
        if (!Admin) {
            return res.status(503).json({ error: 'Service unavailable - Admin model not loaded' });
        }

        const { name, email, password, organization, adminCode } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Validate admin code (simple validation - can be enhanced)
        const validAdminCode = process.env.ADMIN_REGISTRATION_CODE || 'ADMIN123';
        if (adminCode !== validAdminCode) {
            return res.status(400).json({ error: 'Invalid admin registration code' });
        }

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create new admin
        const admin = new Admin({
            name,
            email,
            password,
            organization: organization || 'Default Organization',
            department: 'Administration'
        });

        await admin.save();

        // AUTO-CREATE ORGANIZATION for the admin - wrapped in try-catch
        try {
            const Organization = require('../models/organization.model');
            
            let org = await Organization.findOne({ 
                organizationName: { $regex: `^${admin.organization}$`, $options: 'i' } 
            });

            if (!org) {
                org = new Organization({
                    organizationName: admin.organization,
                    email: admin.email,
                    adminId: admin._id,
                    status: 'approved',
                    isVerified: true,
                    isActive: true
                });
                await org.save();
            } else {
                // If organization exists but not linked, link it now
                if (!org.adminId) {
                    org.adminId = admin._id;
                    org.status = 'approved';
                    org.isActive = true;
                    await org.save();
                }
            }
        } catch (orgError) {
            console.warn('Warning: Could not create/link organization:', orgError.message);
            // Don't fail admin creation if organization linking fails
        }

        // Generate JWT token
        const token = jwt.sign(
            { _id: admin._id, email: admin.email, role: 'admin' },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        res.status(201).json({
            success: true,
            message: 'Admin account created successfully',
            token,
            admin: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                organization: admin.organization,
                role: admin.role
            }
        });
    } catch (error) {
        console.error('Error in admin signup:', error);
        res.status(500).json({ error: 'Failed to create admin account', details: error.message });
    }
};

// Admin Login
exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find admin
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if account is locked
        if (admin.isAccountLocked()) {
            const remainingTime = Math.ceil((admin.lockedUntil - new Date()) / 60000);
            return res.status(403).json({ 
                error: `Account is locked. Try again after ${remainingTime} minutes`
            });
        }

        // Check if account is active
        if (!admin.isActive) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        // Verify password
        const isPasswordValid = await admin.comparePassword(password);
        if (!isPasswordValid) {
            await admin.handleFailedLoginAttempt();
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update successful login
        await admin.handleLoginAttempt();

        // Generate JWT token
        const token = jwt.sign(
            { _id: admin._id, email: admin.email, role: 'admin' },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            admin: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
                department: admin.department
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

// Get Admin Profile
exports.getAdminProfile = async (req, res) => {
    try {
        const adminId = req.user._id;
        const admin = await Admin.findById(adminId).select('-password');
        
        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        res.json({ admin });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

// Update Admin Profile
exports.updateAdminProfile = async (req, res) => {
    try {
        const adminId = req.user._id;
        const { name, department, profileImage } = req.body;

        const admin = await Admin.findByIdAndUpdate(
            adminId,
            { name, department, profileImage },
            { new: true }
        ).select('-password');

        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        res.json({ success: true, admin });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

// Change Password
exports.changePassword = async (req, res) => {
    try {
        const adminId = req.user._id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        // Verify old password
        const isPasswordValid = await admin.comparePassword(oldPassword);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update password
        admin.password = newPassword;
        await admin.save();

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

// Logout
exports.adminLogout = async (req, res) => {
    try {
        // Token invalidation can be handled on frontend by clearing the token
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
};

// Get all admins (Super Admin only)
exports.getAllAdmins = async (req, res) => {
    try {
        const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
        res.json({ admins });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch admins' });
    }
};

// Deactivate admin account
exports.deactivateAdmin = async (req, res) => {
    try {
        const { adminId } = req.params;

        const admin = await Admin.findByIdAndUpdate(
            adminId,
            { isActive: false },
            { new: true }
        ).select('-password');

        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        res.json({ success: true, message: 'Admin deactivated' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to deactivate admin' });
    }
};

// Grant admin permissions
exports.updateAdminPermissions = async (req, res) => {
    try {
        const { adminId } = req.params;
        const { permissions } = req.body;

        const admin = await Admin.findByIdAndUpdate(
            adminId,
            { permissions },
            { new: true }
        ).select('-password');

        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        res.json({ success: true, admin });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update permissions' });
    }
};
