/* Admin Role Middleware */

const Admin = require('../models/admin.model'); /* optional - can be added later */

// Verify admin role
exports.adminAuthCheck = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Check if user is admin in Admin collection
        const admin = await Admin.findById(userId);

        if (!admin) {
            return res.status(403).json({ error: 'Unauthorized - Admin access required' });
        }

        if (!admin.isActive) {
            return res.status(403).json({ error: 'Admin account is deactivated' });
        }

        // Attach admin to request
        req.admin = admin;
        next();
    } catch (error) {
        console.error('Error:', error);
        res.status(403).json({ error: 'Admin verification failed' });
    }
};

// Check specific admin permission
exports.checkPermission = (permission) => {
    return async (req, res, next) => {
        try {
            if (!req.admin) {
                return res.status(403).json({ error: 'Admin not found in request' });
            }

            if (!req.admin.permissions || !req.admin.permissions.includes(permission)) {
                return res.status(403).json({ error: `Insufficient permissions for: ${permission}` });
            }

            next();
        } catch (error) {
            console.error('Error:', error);
            res.status(403).json({ error: 'Permission check failed' });
        }
    };
};

// Super Admin only access
exports.superAdminOnly = async (req, res, next) => {
    try {
        if (!req.admin) {
            return res.status(403).json({ error: 'Admin not found in request' });
        }

        if (req.admin.role !== 'super_admin') {
            return res.status(403).json({ error: 'Super Admin access required' });
        }

        next();
    } catch (error) {
        console.error('Error:', error);
        res.status(403).json({ error: 'Authorization failed' });
    }
};
