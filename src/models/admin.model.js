/* Admin Authentication Model */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        default: 'admin',
        enum: ['admin', 'super_admin']
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        default: null  // null for super_admin, required for admin
    },
    department: {
        type: String,
        default: 'Administration'
    },
    organization: {
        type: String,
        default: 'Default Organization',
        trim: true
    },
    permissions: {
        type: [String],
        default: [
            'view_all_issues',
            'manage_users',
            'bulk_operations',
            'escalate_issues',
            'manage_settings',
            'view_reports'
        ]
    },
    profileImage: {
        type: String,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: null
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    accountLocked: {
        type: Boolean,
        default: false
    },
    lockedUntil: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Hash password before saving
adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
        const hashedPassword = await bcrypt.hash(this.password, 10);
        this.password = hashedPassword;
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare passwords
adminSchema.methods.comparePassword = async function(password) {
    try {
        return await bcrypt.compare(password, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to handle login attempt
adminSchema.methods.handleLoginAttempt = async function() {
    // Reset attempts on successful login
    if (this.loginAttempts > 0 || this.accountLocked) {
        this.loginAttempts = 0;
        this.accountLocked = false;
        this.lockedUntil = null;
        this.lastLogin = new Date();
        return this.save();
    }
    this.lastLogin = new Date();
    return this.save();
};

// Method to handle failed login attempt
adminSchema.methods.handleFailedLoginAttempt = async function() {
    this.loginAttempts += 1;

    // Lock account after 5 failed attempts for 30 minutes
    if (this.loginAttempts >= 5) {
        this.accountLocked = true;
        this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }

    return this.save();
};

// Method to check if account is locked
adminSchema.methods.isAccountLocked = function() {
    return this.accountLocked && this.lockedUntil && this.lockedUntil > new Date();
};

// Method to unlock account
adminSchema.methods.unlockAccount = async function() {
    this.accountLocked = false;
    this.lockedUntil = null;
    this.loginAttempts = 0;
    return this.save();
};

module.exports = mongoose.model('Admin', adminSchema);
