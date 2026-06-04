/* Admin Dashboard Frontend Logic */

const API_BASE = '/api';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAuth();
    await loadDashboard();
    loadIssues();
});

// Check if user is admin
async function checkAdminAuth() {
    try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            window.location.href = 'admin-login.html';
            return;
        }

        const response = await fetch(`${API_BASE}/admin/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            localStorage.removeItem('adminToken');
            window.location.href = 'admin-login.html';
        } else {
            const data = await response.json();
            document.getElementById('adminName').textContent = data.admin?.name || 'Admin';
        }
    } catch (error) {
        console.error('Auth error:', error);
        window.location.href = 'admin-login.html';
    }
}

// Load dashboard stats
async function loadDashboard() {
    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        console.log('🔐 Admin Token:', token ? '✓ Present' : '✗ Missing');
        
        let totalIssues = 0, resolved = 0, pending = 0, overdue = 0;
        let employees = 0, technicians = 0;

        // Fetch SLA metrics from new endpoint
        console.log('📊 Fetching SLA metrics...');
        const slaMetricsRes = await fetch(`${API_BASE}/sla/enhanced/metrics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (slaMetricsRes.ok) {
            const slaMetrics = await slaMetricsRes.json();
            console.log("✅ SLA Metrics loaded:", slaMetrics);
            document.getElementById('slaOnTime').textContent = slaMetrics.onTime || 0;
            document.getElementById('slaAtRisk').textContent = slaMetrics.atRisk || 0;
            document.getElementById('slaBreached').textContent = slaMetrics.breached || 0;
        } else {
            console.error('❌ SLA Metrics failed:', slaMetricsRes.status);
        }

        // Fetch issues stats
        console.log('📋 Fetching issues from:', `${API_BASE}/admin/issues`);
        const issuesRes = await fetch(`${API_BASE}/admin/issues`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Issues response status:', issuesRes.status);
        
        if (issuesRes.ok) {
            const issues = await issuesRes.json();
            console.log('✅ Issues raw data:', issues);
            
            totalIssues = issues.length;
            resolved = issues.filter(i => i.status === 'Closed' || i.status === 'Resolved' || i.status === 'resolved' || i.status === 'closed').length;
            pending = issues.filter(i => ['Received', 'Assigned', 'In Progress', 'open', 'assigned', 'in-progress'].includes(i.status)).length;
            overdue = issues.filter(i => i.slaBreached || i.isOverdue).length;
            console.log("✅ Issues stats - Total:", totalIssues, "Resolved:", resolved, "Pending:", pending, "Overdue:", overdue);
        } else {
            const error = await issuesRes.text();
            console.error("❌ Failed to load issues:", issuesRes.status, error);
        }

        // Fetch users stats
        console.log('👥 Fetching employees...');
        const employeesRes = await fetch(`${API_BASE}/admin/employees`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (employeesRes.ok) {
            const empData = await employeesRes.json();
            employees = empData.length;
            console.log("✅ Employees loaded:", employees, empData);
        } else {
            console.error("❌ Failed to load employees:", employeesRes.status, await employeesRes.text());
        }

        console.log('🔧 Fetching technicians...');
        const techniciansRes = await fetch(`${API_BASE}/admin/technicians`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (techniciansRes.ok) {
            const techData = await techniciansRes.json();
            technicians = techData.length;
            console.log("✅ Technicians loaded:", technicians, techData);
        } else {
            console.error("❌ Failed to load technicians:", techniciansRes.status, await techniciansRes.text());
        }

        // Update card values
        document.getElementById('totalIssues').textContent = totalIssues;
        document.getElementById('resolvedIssues').textContent = resolved;
        document.getElementById('pendingIssues').textContent = pending;
        document.getElementById('overdueIssues').textContent = overdue;
        document.getElementById('totalEmployees').textContent = employees;
        document.getElementById('totalTechnicians').textContent = technicians;
        document.getElementById('avgResponseTime').textContent = '2.5h';

        // Load at-risk issues
        loadAtRiskIssues();
        
        // Load breached SLAs
        loadBreachedSLAs();
        
        // Load workload summary
        loadWorkloadSummary();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Load at-risk issues
async function loadAtRiskIssues() {
    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/sla/risk/at-risk`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.error('Failed to load at-risk issues:', response.status);
            return;
        }

        const atRiskIssues = await response.json();
        console.log("⚠️ At-risk issues loaded:", atRiskIssues);
        
        const container = document.getElementById('atRiskIssuesContainer');
        if (!container) return;
        
        // Handle both array and object responses
        const issues = Array.isArray(atRiskIssues) ? atRiskIssues : (atRiskIssues.data || []);
        
        if (!issues || issues.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No issues at risk</p>';
            return;
        }

        container.innerHTML = issues.map(issue => `
            <div class="p-4 mb-3 bg-yellow-50 border-l-4 border-yellow-500 rounded">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-yellow-900">${issue.title}</h4>
                        <p class="text-sm text-yellow-700 mt-1">⚠️ ${Math.round(issue.percentageUsed)}% of deadline used</p>
                        <p class="text-xs text-yellow-600 mt-1">Assigned to: ${issue.assignedTechnician?.name || 'Unassigned'}</p>
                    </div>
                    <button onclick="viewIssue('${issue.id || issue._id}')" class="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700">
                        View
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading at-risk issues:', error);
    }
}

// Load technician workload summary
async function loadWorkloadSummary() {
    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/assignments/workload/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.error('Failed to load workload summary:', response.status);
            return;
        }

        const workloadData = await response.json();
        console.log("👥 Workload summary loaded:", workloadData);
        
        const container = document.getElementById('workloadSummaryContainer');
        if (!container) return;
        
        if (!workloadData.data || workloadData.data.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No technicians available</p>';
            return;
        }

        container.innerHTML = workloadData.data.map(tech => {
            const utilization = tech.utilizationPercentage || 0;
            const utilizationColor = utilization > 80 ? 'bg-red-200' : utilization > 60 ? 'bg-yellow-200' : 'bg-green-200';
            
            return `
                <div class="p-3 mb-3 border rounded-lg">
                    <div class="flex justify-between items-center mb-2">
                        <p class="font-semibold text-gray-900">${tech.name}</p>
                        <span class="px-2 py-1 rounded text-xs font-bold ${tech.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                            ${tech.isAvailable ? '🟢 Available' : '🔴 Busy'}
                        </span>
                    </div>
                    <div class="flex items-center justify-between">
                        <div class="flex-1 mr-3">
                            <div class="w-full bg-gray-300 rounded-full h-2">
                                <div class="${utilizationColor} h-2 rounded-full" style="width: ${utilization}%"></div>
                            </div>
                        </div>
                        <span class="text-xs font-bold text-gray-600">${utilization}%</span>
                    </div>
                    <p class="text-xs text-gray-600 mt-2">Active: ${tech.activeIssuesCount || 0} | Rating: ${(tech.rating || 0).toFixed(1)}⭐</p>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading workload summary:', error);
    }
}

// Load all issues
async function loadIssues() {
    try {
        const token = localStorage.getItem('adminToken');
        const issuesTable = document.getElementById('issuesTable');
        
        if (!issuesTable) {
            console.log('ℹ️ Issues table not found on this page');
            return;
        }

        const search = document.getElementById('issueSearch')?.value || '';
        const status = document.getElementById('statusFilter')?.value || '';
        const priority = document.getElementById('priorityFilter')?.value || '';

        let url = `${API_BASE}/admin/issues`;
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (status) params.append('status', status);
        if (priority) params.append('priority', priority);

        console.log("📦 Fetching issues from:", `${url}?${params}`);
        
        const response = await fetch(`${url}?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || 'Failed to load issues');
        }

        const issues = await response.json();
        console.log("✅ Issues loaded:", issues.length, issues);
        
        issuesTable.innerHTML = '';

        if (!issues || issues.length === 0) {
            issuesTable.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500">No issues found</td></tr>';
            return;
        }

        issues.forEach(issue => {
            const statusColor = {
                'Received': 'bg-blue-100 text-blue-800',
                'Assigned': 'bg-yellow-100 text-yellow-800',
                'In Progress': 'bg-purple-100 text-purple-800',
                'Resolved': 'bg-green-100 text-green-800',
                'Closed': 'bg-gray-100 text-gray-800',
                'open': 'bg-blue-100 text-blue-800',
                'assigned': 'bg-yellow-100 text-yellow-800',
                'in-progress': 'bg-purple-100 text-purple-800',
                'resolved': 'bg-green-100 text-green-800',
                'closed': 'bg-gray-100 text-gray-800'
            };

            const priorityColor = {
                'low': 'text-green-600',
                'medium': 'text-yellow-600',
                'high': 'text-orange-600',
                'critical': 'text-red-600',
                'Routine': 'text-green-600',
                'Risky': 'text-yellow-600',
                'Urgent': 'text-orange-600',
                'Critical': 'text-red-600'
            };

            const row = document.createElement('tr');
            row.className = 'border-b border-gray-200 hover:bg-gray-50';
            row.innerHTML = `
                <td class="py-3 px-4"><span class="font-mono text-sm">#${issue._id?.substr(-6) || 'N/A'}</span></td>
                <td class="py-3 px-4 font-semibold text-gray-900">${issue.title || 'N/A'}</td>
                <td class="py-3 px-4"><span class="px-3 py-1 rounded-full text-sm font-semibold ${statusColor[issue.status] || 'bg-gray-100 text-gray-800'}">${issue.status || 'N/A'}</span></td>
                <td class="py-3 px-4"><span class="font-semibold ${priorityColor[issue.priority] || 'text-gray-600'}">${issue.priority || 'N/A'}</span></td>
                <td class="py-3 px-4">${issue.assignedTechnician?.name || 'Unassigned'}</td>
                <td class="py-3 px-4"><button onclick="viewIssue('${issue._id}')" class="text-primary hover:text-primary/80 font-semibold">View</button></td>
            `;
            issuesTable.appendChild(row);
        });
    } catch (error) {
        console.error('❌ Error loading issues:', error);
        const issuesTable = document.getElementById('issuesTable');
        if (issuesTable) {
            issuesTable.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-red-500">Error loading issues: ' + error.message + '</td></tr>';
        }
    }
}

// Load breached SLAs
async function loadBreachedSLAs() {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/admin/breached-slas`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load breached SLAs');

        const breached = await response.json();
        const tbody = document.getElementById('slaBreachedTable');
        tbody.innerHTML = '';

        if (breached.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">No breached SLAs</td></tr>';
            return;
        }

        breached.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-200 hover:bg-gray-50';
            const overdueTime = Math.round((new Date() - new Date(item.dueDate)) / (1000 * 60 * 60));
            row.innerHTML = `
                <td class="py-3 px-4"><span class="font-mono text-sm">#${item.issueId?.substr(-6) || 'N/A'}</span></td>
                <td class="py-3 px-4 font-semibold text-gray-900">${item.issueTitle || 'N/A'}</td>
                <td class="py-3 px-4"><span class="font-semibold text-red-600">${overdueTime} hours</span></td>
                <td class="py-3 px-4"><button onclick="escalateIssueById('${item.issueId}')" class="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm font-semibold">Escalate</button></td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading breached SLAs:', error);
    }
}

// Load technicians for manual assignment modal
async function loadTechniciansForAssignment() {
    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/admin/technicians`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load technicians');

        const technicians = await response.json();
        const select = document.getElementById('assignmentTechnician');
        if (!select) return;

        select.innerHTML = '<option value="">Select Technician</option>';
        technicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech.id || tech._id;
            option.textContent = `${tech.name} (${tech.currentWorkload || 0}/${tech.maxCapacity || 10} tasks)`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading technicians:', error);
    }
}

// Open manual assignment modal
async function openManualAssignmentModal(issueId) {
    const modal = document.getElementById('manualAssignmentModal');
    if (!modal) {
        console.error('Manual assignment modal not found');
        return;
    }
    
    // Store issue ID for assignment
    window.selectedIssueId = issueId;
    document.getElementById('assignmentIssueId').value = issueId;
    
    // Load technicians
    await loadTechniciansForAssignment();
    
    // Show modal
    modal.style.display = 'flex';
}

// Close manual assignment modal
function closeManualAssignmentModal() {
    const modal = document.getElementById('manualAssignmentModal');
    if (modal) {
        modal.style.display = 'none';
        window.selectedIssueId = null;
    }
}

// Submit manual assignment
async function submitManualAssignment() {
    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        const issueId = document.getElementById('assignmentIssueId').value;
        const technicianId = document.getElementById('assignmentTechnician').value;
        const reason = document.getElementById('assignmentReason').value;

        if (!issueId || !technicianId) {
            alert('Please select both issue and technician');
            return;
        }

        const response = await fetch(`${API_BASE}/assignments/manual-assign/${issueId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                technicianId,
                reason: reason || 'Manual assignment by admin'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to assign issue');
        }

        alert('✅ Issue assigned successfully!');
        closeManualAssignmentModal();
        loadDashboard();
        loadIssues();
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error assigning issue: ' + error.message);
    }
}

// Auto-assign single issue
async function autoAssignIssue(issueId) {
    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        
        const response = await fetch(`${API_BASE}/assignments/auto-assign/${issueId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to auto-assign issue');
        }

        const result = await response.json();
        alert(`✅ Issue auto-assigned to ${result.assignedTechnician?.name || 'technician'}!`);
        loadDashboard();
        loadIssues();
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error auto-assigning issue: ' + error.message);
    }
}


// Bulk close issues
async function bulkClose() {
    try {
        const token = localStorage.getItem('adminToken');
        const issueIds = document.getElementById('bulkCloseIds').value.split(',').map(id => id.trim());
        const reason = document.getElementById('bulkCloseReason').value;

        if (!reason) {
            alert('Please provide a closure reason');
            return;
        }

        const response = await fetch(`${API_BASE}/admin/bulk-close`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ issueIds, reason })
        });

        if (!response.ok) throw new Error('Failed to close issues');

        alert(`Successfully closed ${issueIds.length} issues`);
        document.getElementById('bulkCloseIds').value = '';
        document.getElementById('bulkCloseReason').value = '';
        loadIssues();
    } catch (error) {
        console.error('Error:', error);
        alert('Error closing issues: ' + error.message);
    }
}

// Remove technici an assignment from issue (deallocate)
async function removeTechnicianAssignment() {
    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        const issueId = document.getElementById('removeIssueId').value.trim();
        const reason = document.getElementById('reassignReason').value.trim();

        if (!issueId) {
            alert('Please enter an Issue ID');
            return;
        }

        const response = await fetch(`${API_BASE}/assignments/deallocate/${issueId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                reason: reason || 'Reassignment by admin'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to remove assignment');
        }

        const result = await response.json();
        alert(result.message || '✅ Technician assignment removed successfully. Issue will be available for manual reassignment.');
        document.getElementById('removeIssueId').value = '';
        document.getElementById('reassignReason').value = '';
        loadDashboard();
        loadIssues();
    } catch (error) {
        console.error('Error:', error);
        alert('Error removing assignment: ' + error.message);
    }
}

// Export reports
async function exportReport(format) {
    try {
        const token = localStorage.getItem('adminToken');
        const status = document.getElementById('exportStatus')?.value || '';

        const response = await fetch(`${API_BASE}/admin/export?format=${format}&status=${status}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to export');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `issues-report.${format === 'csv' ? 'csv' : 'pdf'}`;
        a.click();
    } catch (error) {
        console.error('Error:', error);
        alert('Error exporting report: ' + error.message);
    }
}

// Escalate issues by priority
async function escalateIssues() {
    try {
        const token = localStorage.getItem('adminToken');
        const priority = document.getElementById('escalatePriority').value;

        if (!priority) {
            alert('Please select priority level');
            return;
        }

        const response = await fetch(`${API_BASE}/admin/escalate-by-priority`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ priority })
        });

        if (!response.ok) throw new Error('Failed to escalate');

        const result = await response.json();
        alert(`Escalated ${result.escalatedCount} issues`);
        loadIssues();
        loadDashboard();
    } catch (error) {
        console.error('Error:', error);
        alert('Error escalating issues: ' + error.message);
    }
}

// Escalate specific issue
async function escalateIssueById(issueId) {
    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/admin/escalate/${issueId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to escalate');

        alert('Issue escalated successfully');
        loadBreachedSLAs();
    } catch (error) {
        console.error('Error:', error);
        alert('Error escalating issue: ' + error.message);
    }
}

// Load users
async function loadUsers(role = 'employee') {
    try {
        const token = localStorage.getItem('adminToken');
        const endpoint = role === 'employee' ? `${API_BASE}/admin/employees` : `${API_BASE}/admin/technicians`;

        const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load users');

        const users = await response.json();
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = '';

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500">No users found</td></tr>';
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-200 hover:bg-gray-50';
            row.innerHTML = `
                <td class="py-3 px-4 font-semibold text-gray-900">${user.name}</td>
                <td class="py-3 px-4">${user.email}</td>
                <td class="py-3 px-4">${user.department || 'N/A'}</td>
                <td class="py-3 px-4"><span class="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">Active</span></td>
                <td class="py-3 px-4">
                    <button onclick="editUser('${user._id}')" class="text-primary hover:text-primary/80 mr-3">Edit</button>
                    <button onclick="deleteUser('${user._id}')" class="text-red-600 hover:text-red-800">Delete</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('usersTable').innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-500">Error loading users</td></tr>';
    }
}

// Setup auto-escalation
async function setupAutoEscalation() {
    try {
        const token = localStorage.getItem('adminToken');
        const hours = document.getElementById('escalateHours').value;

        if (!hours) {
            alert('Please enter hours');
            return;
        }

        const response = await fetch(`${API_BASE}/admin/setup-auto-escalation`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hoursBeforeEscalation: parseInt(hours) })
        });

        if (!response.ok) throw new Error('Failed to setup');

        alert('Auto-escalation configured successfully');
        document.getElementById('escalateHours').value = '';
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

// Setup critical auto-escalation
async function setupCriticalAutoEscalation() {
    try {
        const token = localStorage.getItem('adminToken');
        const hours = document.getElementById('escalateCriticalHours').value;

        if (!hours) {
            alert('Please enter hours');
            return;
        }

        const response = await fetch(`${API_BASE}/admin/setup-critical-escalation`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hoursBeforeEscalation: parseInt(hours) })
        });

        if (!response.ok) throw new Error('Failed to setup');

        alert('Critical auto-escalation configured successfully');
        document.getElementById('escalateCriticalHours').value = '';
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

// Modal Functions
function openUserModal() {
    document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
}

async function addUser(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.elements[0].value;
    const email = form.elements[1].value;
    const role = form.elements[2].value;
    const department = form.elements[3].value;

    try {
        const token = localStorage.getItem('adminToken');
        const endpoint = role === 'employee' ? '/api/employee/auth/signup' : '/api/technician/auth/signup';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password: 'temp123', department })
        });

        if (!response.ok) throw new Error('Failed to add user');

        alert('User added successfully');
        closeUserModal();
        loadUsers(role);
        form.reset();
    } catch (error) {
        console.error('Error:', error);
        alert('Error adding user: ' + error.message);
    }
}

// Save notification settings
async function saveNotificationSettings() {
    try {
        const token = localStorage.getItem('adminToken');
        // Implementation for saving notification preferences
        alert('Notification settings saved');
    } catch (error) {
        console.error('Error:', error);
        alert('Error saving settings');
    }
}

// Save general settings
async function saveSettings() {
    try {
        const token = localStorage.getItem('adminToken');
        const responseTime = document.getElementById('slaResponseTime').value;
        const resolutionTime = document.getElementById('slaResolutionTime').value;

        const response = await fetch(`${API_BASE}/admin/settings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ slaResponseTime: parseInt(responseTime), slaResolutionTime: parseInt(resolutionTime) })
        });

        if (!response.ok) throw new Error('Failed to save settings');

        alert('Settings saved successfully');
        document.getElementById('lastUpdated').textContent = new Date().toLocaleDateString();
    } catch (error) {
        console.error('Error:', error);
        alert('Error saving settings: ' + error.message);
    }
}

// Tab Navigation
function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.add('hidden'));
    const targetTab = document.getElementById(tabName);
    if (targetTab) targetTab.classList.remove('hidden');

    if (tabName === 'issues') loadIssues();
    if (tabName === 'users') loadUsers();
}

function switchUserTab(userType) {
    loadUsers(userType);
}

// Logout
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('adminToken');
        window.location.href = 'login.html';
    }
}

// View issue details
function viewIssue(issueId) {
    window.location.href = `issue-details.html?id=${issueId}&role=admin`;
}

// Edit user
function editUser(userId) {
    alert('Edit user functionality coming soon');
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`${API_BASE}/admin/user/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to delete user');

        alert('User deleted successfully');
        loadUsers();
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting user: ' + error.message);
    }
}

// Format date/time
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ===== PENDING REQUESTS MANAGEMENT =====
let allPendingRequests = [];
let filteredRequests = [];

// Load pending registration requests
async function loadPendingRequests() {
    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        
        const response = await fetch(`${API_BASE}/organization/pending-approvals`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch pending requests`);
        }

        const data = await response.json();
        
        // The response is now a simple array at data.data
        allPendingRequests = data.data || [];
        filteredRequests = allPendingRequests;
        
        // Count by type
        const employeeCount = allPendingRequests.filter(r => r.userRole === 'employee').length;
        const technicianCount = allPendingRequests.filter(r => r.userRole === 'technician').length;
        
        document.getElementById('allCount').textContent = allPendingRequests.length;
        document.getElementById('employeeCount').textContent = employeeCount;
        document.getElementById('technicianCount').textContent = technicianCount;

        displayPendingRequests(filteredRequests);
    } catch (error) {
        console.error('Error loading pending requests:', error);
        document.getElementById('pendingRequestsTable').innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-red-400">Error: ${error.message}</td>
            </tr>
        `;
    }
}

// Filter pending requests by role
function filterPendingRequests(filter) {
    if (filter === 'all') {
        filteredRequests = allPendingRequests;
    } else if (filter === 'employee') {
        filteredRequests = allPendingRequests.filter(r => r.userRole === 'employee');
    } else if (filter === 'technician') {
        filteredRequests = allPendingRequests.filter(r => r.userRole === 'technician');
    }
    displayPendingRequests(filteredRequests);
}

// Display pending requests in table
function displayPendingRequests(requests) {
    const table = document.getElementById('pendingRequestsTable');
    
    if (!requests || requests.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-gray-400">No pending requests</td>
            </tr>
        `;
        return;
    }

    const rows = requests.map(req => `
        <tr class="border-b border-white/10 hover:bg-white/5 transition-all">
            <td class="py-4 px-4 text-white font-semibold">${req.userName || 'N/A'}</td>
            <td class="py-4 px-4 text-gray-300">${req.userEmail || 'N/A'}</td>
            <td class="py-4 px-4">
                <span class="px-3 py-1 rounded-full text-sm font-semibold ${
                    req.userRole === 'employee' 
                        ? 'bg-blue-500/20 text-blue-300' 
                        : 'bg-purple-500/20 text-purple-300'
                }">
                    ${req.userRole === 'employee' ? '👤 Employee' : '🔧 Technician'}
                </span>
            </td>
            <td class="py-4 px-4 text-gray-300">${req.department || 'N/A'}</td>
            <td class="py-4 px-4 text-gray-400 text-sm">${formatDate(req.createdAt)}</td>
            <td class="py-4 px-4">
                <div class="flex gap-3">
                    <button onclick="approveRequest('${req._id}')" class="px-4 py-2 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 font-semibold transition-all hover:shadow-lg hover:shadow-green-500/20">
                        ✓ Approve
                    </button>
                    <button onclick="rejectRequest('${req._id}')" class="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 font-semibold transition-all hover:shadow-lg hover:shadow-red-500/20">
                        ✗ Reject
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    table.innerHTML = rows;
}

// Approve registration request
async function approveRequest(requestId) {
    if (!confirm('Are you sure you want to approve this registration request?')) return;

    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        
        const response = await fetch(`${API_BASE}/organization/approve/${requestId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to approve request');
        }

        const data = await response.json();
        alert('✓ Registration approved successfully!');
        loadPendingRequests();
    } catch (error) {
        console.error('Error approving request:', error);
        alert('Error approving request: ' + error.message);
    }
}

// Reject registration request
async function rejectRequest(requestId) {
    const reason = prompt('Please enter rejection reason (optional):');
    if (reason === null) return; // User cancelled

    try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        
        const response = await fetch(`${API_BASE}/organization/reject/${requestId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: reason || 'No reason provided' })
        });

        if (!response.ok) {
            throw new Error('Failed to reject request');
        }

        alert('✗ Registration rejected successfully!');
        loadPendingRequests();
    } catch (error) {
        console.error('Error rejecting request:', error);
        alert('Error rejecting request: ' + error.message);
    }
}

// Load pending requests when switching to that tab
document.addEventListener('DOMContentLoaded', () => {
    // Hook into switchTab to load pending requests when tab is clicked
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabName) {
        if (tabName === 'pending-requests') {
            loadPendingRequests();
        }
        return originalSwitchTab.call(this, tabName);
    };
});
