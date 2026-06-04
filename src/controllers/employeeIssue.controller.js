console.log("🟡 employeeIssue.controller loaded");
const { getIO } = require("../socket");

const Issue = require('../models/issue.model');
const User = require('../models/user.model');
const { assignTechnicianToIssue, unassignTechnicianFromIssue } = require('../services/issueAssignment.service');
const { initializeSLA, recordFirstResponse, recordResolution, calculateRemainingTime } = require('../services/sla.service');
const { categorizeIssue } = require('../services/aiCategorization.service');

exports.createIssue = async (req, res) => {
  try {
    const { title, description, category, priority, location, images = [] } = req.body;

    if (!title || !description || !category || !location) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const issue = await Issue.create({
      title,
      description,
      category,
      priority: priority || "Routine",
      location,
      images,
      createdBy: req.user._id,        
      status: "open",                 
      timeline: [
        {
          status: "open",
          timestamp: new Date()
        }
      ]
    });

    // ✅ INITIALIZE SLA TRACKING
    await initializeSLA(issue._id, issue.priority);

    // 🔥 AUTO-ASSIGN TECHNICIAN BASED ON CATEGORY & AVAILABILITY
    const assignmentResult = await assignTechnicianToIssue(issue._id);
    if (assignmentResult.success) {
      console.log(`✅ Issue ${issue._id} assigned to ${assignmentResult.technician.name}`);
      const io = require("../socket").getIO();
      // Notify technician about new assignment
      io.to(`technician_${assignmentResult.technician._id}`).emit("newIssueAssigned", {
        issueId: issue._id,
        title: issue.title,
        category: issue.category,
        priority: issue.priority
      });
    } else {
      console.log(`⚠️ Could not auto-assign issue: ${assignmentResult.message}`);
    }

    // 🔄 FETCH UPDATED ISSUE WITH SLA DATA
    const updatedIssue = await Issue.findById(issue._id)
      .populate('assignedTechnician', 'name email category currentWorkload');

    const io = require("../socket").getIO();
    io.to(`employee_${req.user.id}`).emit("issueCreated", updatedIssue);

    res.status(201).json({
      message: "Issue created successfully",
      issue: updatedIssue,
      assignment: assignmentResult
    });

  } catch (err) {
    console.error("createIssue error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.getEmployeeIssues = async (req, res) => {
  try {
    console.log("🟢 getEmployeeIssues HIT");
    console.log("req.user =", req.user);

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { status, category, page = 1, limit = 20 } = req.query;

    const filter = { createdBy: req.user.id };
    if (status) filter.status = status;
    if (category) filter.category = category;

    const issues = await Issue.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("assignedTechnician", "name email category currentWorkload");

    res.status(200).json({ issues });
  } catch (err) {
    console.error("getEmployeeIssues error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.getSingleIssue = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email category currentWorkload');

    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    // Ensure employee only accesses own issue
    if (issue.createdBy._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    res.status(200).json({ issue });
  } catch (err) {
    console.error('getSingleIssue error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateIssueStatus = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    // ✅ RECORD FIRST RESPONSE when status changes from open to assigned/in-progress
    if ((issue.status === 'open' || issue.status === 'assigned') && 
        (status === 'in-progress' || status === 'assigned')) {
      if (!issue.sla.firstResponseTime) {
        await recordFirstResponse(issueId);
      }
    }

    // ✅ RECORD RESOLUTION when issue is resolved/closed
    if ((status === 'resolved' || status === 'closed') && !issue.sla.resolvedTime) {
      await recordResolution(issueId);
    }

    // Update issue
    issue.status = status;
    issue.timeline.push({
      status,
      timestamp: new Date()
    });

    // If issue is resolved or closed, unassign technician
    if (status === 'resolved' || status === 'closed') {
      const unassignResult = await unassignTechnicianFromIssue(issueId);
      console.log(`Unassignment result: ${unassignResult.message}`);
    }

    await issue.save();

    // 🔥 REAL-TIME EMIT
    const io = require("../socket").getIO();
    io.to(`employee_${issue.createdBy}`).emit("issueUpdated", {
      issueId: issue._id,
      status: issue.status
    });

    res.status(200).json({
      message: "Issue status updated",
      issue
    });

  } catch (err) {
    console.error("updateIssueStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
/**
 * Get all live issues (unresolved) in the system
 * Used for the Live Issues page - shows all issues regardless of who created them
 */
exports.getAllLiveIssues = async (req, res) => {
  try {
    const { status = ['open', 'assigned', 'inprogress'], category, page = 1, limit = 20 } = req.query;

    // Parse status - can be comma-separated string
    const statusArray = typeof status === 'string' ? status.split(',') : status;

    const filter = { status: { $in: statusArray } };
    if (category) filter.category = category;

    const issues = await Issue.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("createdBy", "name email")
      .populate("assignedTechnician", "name email category");

    res.status(200).json({ issues });
  } catch (err) {
    console.error("getAllLiveIssues error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * 🤖 AI CATEGORIZATION ENDPOINT
 * Analyzes issue title and description to suggest category and priority
 * Uses Hugging Face NLP with keyword fallback
 */
exports.getAICategorization = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ 
        message: "Title and description are required" 
      });
    }

    // Get AI suggestions (now async with Hugging Face)
    const result = await categorizeIssue(title, description);

    if (!result.success) {
      return res.status(400).json({
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      suggestion: result.suggestion
    });

  } catch (err) {
    console.error("getAICategorization error:", err);
    res.status(500).json({ message: "Server error" });
  }
};