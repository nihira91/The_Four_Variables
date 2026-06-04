const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.signupEmployee = async (req, res) => {
  try {
    const { name, email, password, organizationId, organizationName, department, floor, contactNo } = req.body;
    const Organization = require('../models/organization.model');
    const RegistrationRequest = require('../models/registrationRequest.model');

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Name, email, and password are required" 
      });
    }

    if (!organizationId && !organizationName) {
      return res.status(400).json({ 
        success: false,
        message: "Either organizationId or organizationName is required" 
      });
    }

    let organization;

    // CASE 1: OrganizationId provided (selecting existing)
    if (organizationId) {
      organization = await Organization.findById(organizationId);
      
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      if (organization.status !== 'approved' || !organization.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Organization is not active. Registration not allowed.'
        });
      }
    } 
    // CASE 2: OrganizationName provided (writing/searching)
    else {
      // Check if organization exists
      organization = await Organization.findOne({ 
        organizationName: { $regex: `^${organizationName}$`, $options: 'i' } 
      });

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'This organization does not exist. Please select from available organizations or contact your organization admin.'
        });
      }

      // If organization exists but not active
      if (!organization.isActive && organization.status !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Organization is pending verification. Admin has not registered yet.'
        });
      }
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: "Email already exists" 
      });
    }

    // Create user (initially inactive)
    const employee = await User.create({
      name,
      email,
      password,
      role: "employee",
      organizationId: organization._id,
      department: department || null,
      floor: floor || null,
      contactNo: contactNo || null,
      isActive: false  // Initially inactive until admin approval
    });

    // Create registration request
    await RegistrationRequest.create({
      organizationId: organization._id,
      userId: employee._id,
      userRole: 'employee',
      userName: name,
      userEmail: email,
      department: department || null,
      floor: floor || null,
      status: 'pending'
    });

    return res.status(201).json({
      success: true,
      message: "Registration request submitted successfully. Waiting for admin approval.",
      data: {
        user: {
          id: employee._id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          organizationId: organization._id,
          organizationName: organization.organizationName
        },
        status: 'pending_approval'
      }
    });
  } catch (error) {
    console.error("Employee signup error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Server error during signup", 
      error: error.message 
    });
  }
};



exports.loginEmployee = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email, role: 'employee' });
    if (!user)
      return res.status(404).json({ message: "Employee not found" });

    // Check if account is active (approved by admin)
    if (!user.isActive) {
      return res.status(403).json({ 
        message: "Your account is pending admin approval. Please wait for approval." 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,          
        department: user.department,
        floor: user.floor,
        deskId: user.deskId,
        organizationId: user.organizationId
      }
    });

  } catch (err) {
    console.error('loginEmployee error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.getEmployeeProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(400).json({message: 'Employee not found'});
    res.status(200).json(user);
  } catch (err) {
    console.error('getEmployeeProfile error:', err);
    res.status(500).json({ message: 'server error'});
  }
};