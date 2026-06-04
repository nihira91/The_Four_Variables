const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Admin = require("../models/admin.model");

const authMiddleware = async (req, res, next) => {
  try {
    
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if it's an admin token
    if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded._id).select("-password");
      if (!admin) {
        return res.status(404).json({ message: "Admin not found." });
      }
      req.user = admin; // Attach admin to request
      req.userRole = 'admin';
    } else {
      // Regular user
      const user = await User.findById(decoded._id || decoded.id).select("-password");
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      req.user = user; // Attach user to request
      req.userRole = 'user';
    }

    next();

  } catch (error) {
    console.error("Auth Error:", error.message);
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

module.exports = authMiddleware;
