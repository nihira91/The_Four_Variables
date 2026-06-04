/* Admin Controller for FixFlow IMS */

const jwt = require('jsonwebtoken');

// Load nodemailer safely (optional)
let transporter;
try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER || 'your-email@gmail.com',
            pass: process.env.EMAIL_PASSWORD || 'your-password'
        }
    });
} catch (error) {
    console.log('⚠️ Nodemailer not available - email features disabled');
}

// Load models safely (may not be available immediately)
let Employee, Technician, Issue, TechnicianIssue, Notification, User;

try {
    User = require('../models/user.model');
    Employee = require('../models/user.model');
    Issue = require('../models/issue.model');
    Notification = require('../models/notifications.model');
    // Try to load technician model but don't fail if it doesn't exist
    try {
        TechnicianIssue = require('../models/issue.technician.model');
        Technician = require('../models/user.technician.model');
    } catch (e) {
        console.log('⚠️ Technician-specific models not available, using User model');
        Technician = User;
    }
} catch (error) {
    console.error('❌ Critical models failed to load:', error.message);
}

// Get admin profile
exports.getAdminProfile = async (req, res) => {
    try {
        const adminId = req.user._id;
        const admin = await Employee.findById(adminId).select('-password');
        
        if (!admin || admin.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        res.json({ admin });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
};

// Get all issues (admin view with all statuses)
exports.getAllIssues = async (req, res) => {
    try {
        if (!Issue) {
            return res.status(500).json({ error: 'Issue model not loaded' });
        }

        const { search, status, priority } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        if (status) query.status = status;
        if (priority) query.priority = priority;

        console.log('[GET_ALL_ISSUES] Query:', query);

        const issues = await Issue.find(query)
            .populate('createdBy', 'name email department')
            .populate('assignedTechnician', 'name email category')
            .sort({ createdAt: -1 });

        console.log("✅ Issues found:", issues.length);
        console.log('📋 Issue details:', issues.map(i => ({
          id: i._id,
          title: i.title,
          status: i.status,
          assignedTechnician: i.assignedTechnician?.name || 'Unassigned',
          createdAt: i.createdAt
        })));
        
        res.json(issues);
    } catch (error) {
        console.error('❌ Error fetching issues:', error);
        res.status(500).json({ error: 'Failed to fetch issues', details: error.message });
    }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
    try {
        const totalIssues = await Issue.countDocuments();
        const resolvedIssues = await Issue.countDocuments({ status: { $in: ['Resolved', 'Closed'] } });
        const pendingIssues = await Issue.countDocuments({ status: { $in: ['Received', 'Assigned', 'In Progress'] } });
        const overdueIssues = await Issue.countDocuments({ slaBreached: true });
        
        const totalEmployees = await Employee.countDocuments({ role: 'employee' });
        const totalTechnicians = await Technician.countDocuments();

        const avgResponseTime = Math.floor(Math.random() * 8) + 1; // Random for demo

        res.json({
            totalIssues,
            resolvedIssues,
            pendingIssues,
            overdueIssues,
            totalEmployees,
            totalTechnicians,
            avgResponseTime
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
};

// Bulk assign issues to technician
exports.bulkAssignIssues = async (req, res) => {
    try {
        const { issueIds, technicianId } = req.body;

        if (!issueIds || !technicianId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify technician exists
        const technician = await Technician.findById(technicianId);
        if (!technician) {
            return res.status(404).json({ error: 'Technician not found' });
        }

        // Update issues
        const result = await Issue.updateMany(
            { _id: { $in: issueIds } },
            { 
                assignedTo: technicianId,
                status: 'Assigned',
                assignedDate: new Date()
            }
        );

        // Send notifications to technician
        await Notification.create({
            userId: technicianId,
            type: 'bulk_assignment',
            message: `You have been assigned ${issueIds.length} issues`,
            issueIds: issueIds
        });

            // Send email if transporter available
            if (transporter) {
                await transporter.sendMail({
                    to: technician.email,
                    subject: 'Bulk Assignment - FixFlow IMS',
                    text: emailText
                });
            }

        res.json({ 
            success: true, 
            updatedCount: result.modifiedCount,
            message: `${result.modifiedCount} issues assigned successfully`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to bulk assign issues' });
    }
};

// Bulk close issues
exports.bulkCloseIssues = async (req, res) => {
    try {
        const { issueIds, reason } = req.body;

        if (!issueIds || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await Issue.updateMany(
            { _id: { $in: issueIds } },
            { 
                status: 'Closed',
                closureReason: reason,
                closedDate: new Date()
            }
        );

        // Notify employees
        const issues = await Issue.find({ _id: { $in: issueIds } }).select('employeeId');
        for (const issue of issues) {
            if (issue.employeeId) {
                await Notification.create({
                    userId: issue.employeeId,
                    type: 'issue_closed',
                    message: `Your issue has been closed. Reason: ${reason}`,
                    issueId: issue._id
                });
            }
        }

        res.json({ 
            success: true, 
            closedCount: result.modifiedCount,
            message: `${result.modifiedCount} issues closed successfully`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to close issues' });
    }
};

// Auto-assign unassigned issues to technicians based on priority, category, and availability
exports.autoAssignIssues = async (req, res) => {
    try {
        // Get all unassigned issues
        const unassignedIssues = await Issue.find({
            $or: [
                { assignedTechnician: null },
                { status: 'Received' }
            ]
        }).sort({ priority: -1, createdAt: 1 });

        if (unassignedIssues.length === 0) {
            return res.json({ 
                success: true, 
                message: 'No unassigned issues found',
                assignedCount: 0
            });
        }

        // Get all available technicians
        let technicians = [];
        
        if (Technician) {
            try {
                technicians = await Technician.find({ isActive: true }).select('_id name email skills category currentWorkload');
            } catch (err) {
                console.log("⚠️ Technician model query failed, trying Employee model");
            }
        }
        
        // Fallback to Employee model if Technician model is empty
        if (!technicians || technicians.length === 0) {
            technicians = await Employee.find({ role: 'technician', isActive: true }).select('_id name email skills category');
            console.log("📊 Auto-assignment: Found", technicians.length, "technicians from Employee model");
        } else {
            console.log("📊 Auto-assignment: Found", technicians.length, "technicians from Technician model");
        }
        
        if (technicians.length === 0) {
            return res.status(400).json({ error: 'No technicians available' });
        }

        let assignedCount = 0;

        for (const issue of unassignedIssues) {
            try {
                // Find best available technician
                let bestTechnician = null;
                let minWorkload = Infinity;

                for (const tech of technicians) {
                    // Calculate technician's current load
                    const assignedIssues = await Issue.countDocuments({
                        assignedTechnician: tech._id,
                        status: { $in: ['Assigned', 'In Progress'] }
                    });

                    // Prefer technicians with matching category/skills
                    let isMatch = false;
                    if (tech.category && issue.category && 
                        tech.category.toLowerCase().includes(issue.category.toLowerCase())) {
                        isMatch = true;
                    }
                    if (tech.skills && issue.category && 
                        tech.skills.some(skill => skill.toLowerCase().includes(issue.category.toLowerCase()))) {
                        isMatch = true;
                    }

                    // Prioritize: 1) Category match 2) Lowest workload 3) Critical issues get first available
                    const priority = issue.priority === 'critical' ? 0 : (isMatch ? 1 : 2);
                    
                    if (isMatch || assignedIssues < minWorkload) {
                        if (!bestTechnician || (isMatch && !bestTechnician.skills) || assignedIssues < minWorkload) {
                            bestTechnician = tech;
                            minWorkload = assignedIssues;
                        }
                    }
                }

                if (bestTechnician) {
                    // Assign issue to technician
                    issue.assignedTechnician = bestTechnician._id;
                    issue.status = 'Assigned';
                    issue.assignedDate = new Date();
                    await issue.save();

                    // Send notification to technician
                    await Notification.create({
                        userId: bestTechnician._id,
                        type: 'auto_assignment',
                        message: `New issue assigned: ${issue.title} (${issue.priority} priority)`,
                        issueId: issue._id
                    });

                    // Send email notification
                    if (transporter) {
                        await transporter.sendMail({
                            to: bestTechnician.email,
                            subject: `Auto-Assigned Issue: ${issue.title}`,
                            html: `<p>A new issue has been assigned to you: <strong>${issue.title}</strong></p>
                                   <p>Priority: <strong>${issue.priority}</strong></p>
                                   <p>Category: <strong>${issue.category || 'General'}</strong></p>`
                        });
                    }

                    assignedCount++;
                }
            } catch (error) {
                console.error(`Error assigning issue ${issue._id}:`, error);
                continue;
            }
        }

        res.json({
            success: true,
            message: `Auto-assigned ${assignedCount} issues successfully`,
            assignedCount
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to auto-assign issues' });
    }
};

// Remove technician assignment from an issue
exports.removeTechnicianAssignment = async (req, res) => {
    try {
        const { issueId } = req.params;
        const { reason } = req.body;

        const issue = await Issue.findById(issueId);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        if (!issue.assignedTechnician) {
            return res.status(400).json({ error: 'Issue is not assigned to any technician' });
        }

        const previousTechnicianId = issue.assignedTechnician;

        // Remove assignment
        issue.assignedTechnician = null;
        issue.status = 'Received';
        issue.reassignReason = reason || 'Removed by admin';
        issue.reassignDate = new Date();
        await issue.save();

        // Notify technician
        await Notification.create({
            userId: previousTechnicianId,
            type: 'assignment_removed',
            message: `Your assignment for issue "${issue.title}" has been removed. Reason: ${reason || 'Reassigned'}`,
            issueId: issue._id
        });

        // Notify employee
        if (issue.employeeId) {
            await Notification.create({
                userId: issue.employeeId,
                type: 'assignment_changed',
                message: `The technician assigned to your issue has been changed. A new technician will be assigned automatically.`,
                issueId: issue._id
            });
        }

        res.json({
            success: true,
            message: 'Technician assignment removed successfully. Issue will be auto-assigned shortly.'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to remove assignment' });
    }
};

// Export reports (CSV or PDF)
exports.exportReports = async (req, res) => {
    try {
        const { format, status } = req.query;
        let query = {};
        if (status) query.status = status;

        const issues = await Issue.find(query)
            .populate('employeeId', 'name email department')
            .populate('assignedTechnician', 'name email');

        if (format === 'csv') {
            const csv = convertToCSV(issues);
            res.header('Content-Type', 'text/csv');
            res.header('Content-Disposition', 'attachment; filename="issues-report.csv"');
            res.send(csv);
        } else if (format === 'pdf') {
            // Using a basic JSON response (integrate with PDF library like puppeteer/pdfkit)
            res.json({ success: true, data: issues, format: 'pdf' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to export report' });
    }
};

// Convert array to CSV format
function convertToCSV(data) {
    const headers = ['Issue ID', 'Title', 'Status', 'Priority', 'Reporter', 'Assigned To', 'Created Date', 'Closure Reason'];
    const rows = data.map(issue => [
        issue._id,
        issue.title,
        issue.status,
        issue.priority,
        issue.employeeId?.name || 'N/A',
        issue.assignedTechnician?.name || 'Unassigned',
        new Date(issue.createdAt).toLocaleDateString(),
        issue.closureReason || '-'
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
}

// Escalate issues by priority
exports.escalateByPriority = async (req, res) => {
    try {
        const { priority } = req.body;

        if (!['high', 'critical'].includes(priority)) {
            return res.status(400).json({ error: 'Invalid priority' });
        }

        // Find unresolved issues with specified priority
        const issues = await Issue.find({
            priority: priority,
            status: { $nin: ['Resolved', 'Closed'] }
        }).populate('assignedTechnician', 'email');

        for (const issue of issues) {
            // Mark as escalated
            issue.escalated = true;
            issue.escalationDate = new Date();
            await issue.save();

            // Send notification to assignee
            if (issue.assignedTechnician) {
                await Notification.create({
                    userId: issue.assignedTechnician._id,
                    type: 'escalation',
                    message: `Issue #${issue._id} has been escalated. Priority: ${priority}`,
                    issueId: issue._id
                });

            // Send email if transporter available
            if (transporter) {
                await transporter.sendMail({
                    to: issue.assignedTechnician.email,
                    subject: `ESCALATED: Issue #${issue._id.toString().substr(-6)} - FixFlow IMS`,
                    text: `Your assigned issue has been escalated due to high priority. Please address immediately.`
                });
            }
            }
        }

        res.json({ 
            success: true, 
            escalatedCount: issues.length,
            message: `${issues.length} issues escalated successfully`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to escalate issues' });
    }
};

// Escalate specific issue by ID
exports.escalateIssueById = async (req, res) => {
    try {
        const { issueId } = req.params;

        const issue = await Issue.findByIdAndUpdate(
            issueId,
            { 
                escalated: true, 
                escalationDate: new Date(),
                status: 'In Progress'
            },
            { new: true }
        ).populate('assignedTechnician', 'email');

        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        // Notify all admins about escalation
        await Notification.create({
            type: 'admin_escalation',
            message: `Issue #${issue._id} has been escalated`,
            issueId: issue._id
        });

        // Notify assignee
        if (issue.assignedTechnician) {
            await Notification.create({
                userId: issue.assignedTechnician._id,
                type: 'escalation',
                message: `Your issue #${issue._id.toString().substr(-6)} has been escalated by admin`,
                issueId: issue._id
            });

            // Send email if transporter available
            if (transporter) {
                await transporter.sendMail({
                    to: issue.assignedTechnician.email,
                    subject: `ESCALATED: Issue #${issue._id.toString().substr(-6)}`,
                    text: 'This issue has been marked as escalated by administrator.'
                });
            }
        }

        res.json({ success: true, issue });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to escalate issue' });
    }
};

// Get all employees
exports.getAllEmployees = async (req, res) => {
    try {
        if (!User) {
            return res.status(500).json({ error: 'User model not loaded' });
        }

        console.log('[GET_ALL_EMPLOYEES] Querying User model with role=employee');
        
        const employees = await User.find({ role: 'employee' })
            .select('-password')
            .sort({ createdAt: -1 });

        console.log('✅ Found', employees.length, 'employees');
        
        res.json(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees', details: error.message });
    }
};

// Get all technicians
exports.getAllTechnicians = async (req, res) => {
    try {
        if (!User) {
            return res.status(500).json({ error: 'User model not loaded' });
        }

        console.log('[GET_ALL_TECHNICIANS] Querying User model with role=technician');
        
        // Query technicians from User model with role = 'technician'
        const technicians = await User.find({ role: 'technician' })
            .select('-password')
            .sort({ createdAt: -1 });

        console.log('✅ Found', technicians.length, 'technicians');
        res.json(technicians);
    } catch (error) {
        console.error('Error fetching technicians:', error);
        res.status(500).json({ error: 'Failed to fetch technicians', details: error.message });
    }
};

// Delete user (employee or technician)
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Check role and delete accordingly
        let deleted = await Employee.findByIdAndDelete(userId);
        if (!deleted) {
            deleted = await Technician.findByIdAndDelete(userId);
        }

        if (!deleted) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

// Setup auto-escalation for issues not resolved within hours
exports.setupAutoEscalation = async (req, res) => {
    try {
        const { hoursBeforeEscalation } = req.body;

        if (!hoursBeforeEscalation || hoursBeforeEscalation < 1) {
            return res.status(400).json({ error: 'Invalid hours value' });
        }

        // This would be stored in a settings collection
        // For now, we'll run immediate check
        const timeThreshold = new Date(Date.now() - hoursBeforeEscalation * 60 * 60 * 1000);

        const issues = await Issue.find({
            status: { $nin: ['Resolved', 'Closed'] },
            createdAt: { $lt: timeThreshold },
            escalated: false
        });

        for (const issue of issues) {
            issue.escalated = true;
            issue.escalationDate = new Date();
            await issue.save();
        }

        res.json({ 
            success: true, 
            escalatedCount: issues.length,
            setting: hoursBeforeEscalation
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to setup auto-escalation' });
    }
};

// Setup critical auto-escalation
exports.setupCriticalAutoEscalation = async (req, res) => {
    try {
        const { hoursBeforeEscalation } = req.body;

        if (!hoursBeforeEscalation || hoursBeforeEscalation < 1) {
            return res.status(400).json({ error: 'Invalid hours value' });
        }

        const timeThreshold = new Date(Date.now() - hoursBeforeEscalation * 60 * 60 * 1000);

        const issues = await Issue.find({
            priority: 'critical',
            status: { $nin: ['Resolved', 'Closed'] },
            createdAt: { $lt: timeThreshold },
            escalated: false
        });

        for (const issue of issues) {
            issue.escalated = true;
            issue.escalationDate = new Date();
            await issue.save();
        }

        res.json({ 
            success: true, 
            escalatedCount: issues.length,
            setting: hoursBeforeEscalation
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to setup critical auto-escalation' });
    }
};

// Save admin settings
exports.saveSettings = async (req, res) => {
    try {
        const { slaResponseTime, slaResolutionTime } = req.body;

        // This would save to a Settings collection
        // For demo, we'll just acknowledge
        res.json({ 
            success: true,
            settings: {
                slaResponseTime,
                slaResolutionTime,
                updatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
};

// Get SLA metrics
exports.getSLAMetrics = async (req, res) => {
    try {
        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

        const onTime = await Issue.countDocuments({ 
            slaBreached: false,
            status: { $in: ['Resolved', 'Closed'] }
        });

        const atRisk = await Issue.countDocuments({
            slaBreached: false,
            status: { $nin: ['Resolved', 'Closed'] }
        });

        const breached = await Issue.countDocuments({ slaBreached: true });

        res.json({ onTime, atRisk, breached });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch SLA metrics' });
    }
};

// Get breached SLAs
exports.getBreachedSLAs = async (req, res) => {
    try {
        if (!Issue) {
            console.error('[GET_BREACHED_SLAS] Issue model not loaded');
            return res.status(500).json({ error: 'Issue model not loaded' });
        }

        const breached = await Issue.find({ 'sla.resolutionTimeBreached': true })
            .select('_id title deadline status sla')
            .sort({ deadline: 1 });

        console.log('[GET_BREACHED_SLAS] Found:', breached.length, 'breached issues');

        const formatted = breached.map(b => ({
            issueId: b._id,
            issueTitle: b.title,
            dueDate: b.deadline || b.createdAt,
            status: b.status,
            sla: b.sla
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Error fetching breached SLAs:', error);
        res.status(500).json({ error: 'Failed to fetch breached SLAs', details: error.message });
    }
};
