const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

/* ============================
   TECHNICIAN SIGNUP (Basic Info Only)
============================ */
exports.signupTechnician = async (req, res) => {
  try {
    const { name, email, password, contactNo, organizationId, organizationName } = req.body;
    const Organization = require("../models/organization.model");
    const RegistrationRequest = require("../models/registrationRequest.model");

    if (!name || !email || !password || !contactNo) {
      return res.status(400).json({ 
        success: false,
        message: "Name, email, contact no., and password are required" 
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

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        success: false,
        message: "Email already exists" 
      });
    }

    const technician = await User.create({
      name,
      email,
      password, // hashed by model pre-save hook
      contactNo,
      organizationId: organization._id,
      role: "technician",
      profileCompleted: false,  // Flag to indicate incomplete profile
      isActive: false  // Initially inactive until admin approval
    });

    // Create registration request
    await RegistrationRequest.create({
      organizationId: organization._id,
      userId: technician._id,
      userRole: 'technician',
      userName: name,
      userEmail: email,
      status: 'pending'
    });

    // Generate token for redirect to profile completion (will work after approval)
    const token = jwt.sign(
      { id: technician._id, role: technician.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      success: true,
      message: "Registration request submitted successfully. Waiting for admin approval.",
      token,
      data: {
        user: {
          id: technician._id,
          name: technician.name,
          email: technician.email,
          role: technician.role,
          organizationId: organization._id,
          organizationName: organization.organizationName
        },
        status: 'pending_approval'
      }
    });

  } catch (error) {
    console.error("Technician signup error:", error);
    return res.status(500).json({ message: "Server error during signup", error: error.message });
  }
};

/* ============================
   TECHNICIAN PROFILE COMPLETION
============================ */
exports.completeProfile = async (req, res) => {
  try {
    const { category, maxCapacity } = req.body;
    const technicianId = req.user.id;

    if (!category) {
      return res.status(400).json({ message: "Category is required" });
    }

    const technician = await User.findByIdAndUpdate(
      technicianId,
      {
        category,
        maxCapacity: maxCapacity || 10,
        profileCompleted: true,
        isAvailable: true
      },
      { new: true }
    ).select("-password");

    return res.status(200).json({
      message: "Profile completed successfully",
      user: technician
    });

  } catch (error) {
    console.error("Profile completion error:", error);
    return res.status(500).json({ message: "Server error during profile completion" });
  }
};

/* ============================
   TECHNICIAN LOGIN
============================ */
exports.loginTechnician = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: "technician" });
    if (!user) {
      return res.status(404).json({ message: "Technician not found" });
    }

    // Check if account is active (approved by admin)
    if (!user.isActive) {
      return res.status(403).json({ 
        message: "Your account is pending admin approval. Please wait for approval." 
      });
    }

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Technician login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        category: user.category,
        profileCompleted: user.profileCompleted,
        organizationId: user.organizationId
      }
    });

  } catch (error) {
    console.error("Error logging in technician:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};

/* ============================
   TECHNICIAN PROFILE (GET)
============================ */
exports.getTechnicianProfile = async (req, res) => {
  try {
    const technician = await User.findById(req.user.id).select("-password");

    if (!technician) {
      return res.status(404).json({ message: "Technician not found" });
    }

    return res.status(200).json(technician);

  } catch (error) {
    console.error("Error fetching technician profile:", error);
    return res.status(500).json({ message: "Server error fetching profile" });
  }
};
