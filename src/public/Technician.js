console.log("🔧 Technician Dashboard Loaded");

const API_BASE = "http://localhost:5000/api";
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");
let allIssues = [];

// Check authentication
if (!token || !user.id) {
  alert("Please login first");
  window.location.href = "login.html";
}

// ==========================================
// REAL-TIME DATA LOADING
// ==========================================
async function loadDashboardData() {
  try {
    console.log("🔧 [DEBUG] Starting loadDashboardData...");
    console.log("🔑 Token:", token ? "✓ Present" : "✗ Missing");
    console.log("👤 User ID:", user?.id);
    
    // First load summary data
    const summaryResponse = await fetch(`${API_BASE}/technician/issues/dashboard/summary`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!summaryResponse.ok) {
      console.error("⚠️ Dashboard summary failed:", summaryResponse.status, summaryResponse.statusText);
      const errorText = await summaryResponse.text();
      console.error("Error response:", errorText);
    } else {
      const summaryData = await summaryResponse.json();
      console.log("📊 Dashboard summary loaded:", summaryData);
      
      // Update dashboard with technician info
      const techData = summaryData.technician || {};
      const techNameEl = document.querySelector('h2');
      if (techNameEl) {
        techNameEl.textContent = `Welcome, ${techData.name || user.name} 👨‍🔧`;
      }
    }

    // Then load assigned issues
    console.log("📦 Fetching assigned issues from:", `${API_BASE}/technician/issues/dashboard/assigned`);
    const response = await fetch(`${API_BASE}/technician/issues/dashboard/assigned`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    console.log("📡 Response status:", response.status);
    
    if (!response.ok) {
      console.error("❌ Failed to load issues:", response.status, response.statusText);
      const errorText = await response.text();
      console.error("Error details:", errorText);
      return;
    }

    const data = await response.json();
    console.log("✅ Issues loaded from API:", data);
    
    allIssues = data.data || [];
    console.log("📋 Total issues assigned:", allIssues.length);
    
    if (allIssues.length === 0) {
      console.warn("⚠️ No issues assigned to this technician");
    }
    
    allIssues.forEach(issue => {
      console.log("  - Issue:", {
        id: issue.id || issue._id,
        title: issue.title,
        status: issue.status,
        progress: issue.progress
      });
    });

    // Calculate statistics
    const tasksAssigned = allIssues.length;
    const tasksInProgress = allIssues.filter(i => i.status === 'in-progress').length;
    const completedTasks = allIssues.filter(i => i.status === 'resolved' || i.status === 'closed').length;
    const overdueTasks = allIssues.filter(i => i.isOverdue).length;

    // Update dashboard numbers
    updateDashboard(tasksAssigned, tasksInProgress, completedTasks, overdueTasks);
    
    // Display assigned issues
    displayAssignedIssues();

  } catch (error) {
    console.error("❌ Error loading dashboard data:", error);
    console.error("Stack:", error.stack);
  }
}

function updateDashboard(assigned, inProgress, completed, overdue) {
  // Update by element ID
  const assignedEl = document.getElementById('assignedCount');
  const inProgressEl = document.getElementById('inProgressCount');
  const completedEl = document.getElementById('completedCount');
  const overdueEl = document.getElementById('overdueCount');
  
  if (assignedEl) assignedEl.textContent = assigned;
  if (inProgressEl) inProgressEl.textContent = inProgress;
  if (completedEl) completedEl.textContent = completed;
  if (overdueEl) {
    overdueEl.textContent = overdue;
    if (overdue > 0) {
      overdueEl.parentElement.classList.add('ring-2', 'ring-red-500', 'animate-pulse');
    }
  }

  console.log(`✅ Dashboard updated: ${assigned} assigned, ${inProgress} in progress, ${completed} completed, ${overdue} overdue`);
}

// ==========================================
// DISPLAY ASSIGNED ISSUES WITH DEADLINE & PROGRESS
// ==========================================
function displayAssignedIssues() {
  const container = document.getElementById('activeTasksContainer');
  if (!container) {
    console.error("❌ activeTasksContainer not found!");
    return;
  }

  if (allIssues.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-12">No assigned issues at the moment</p>';
    return;
  }

  console.log("🎨 Rendering", allIssues.length, "issues");

  container.innerHTML = allIssues.map(issue => {
    const statusColors = {
      'open': 'bg-yellow-100 text-yellow-800',
      'assigned': 'bg-blue-100 text-blue-800',
      'in-progress': 'bg-purple-100 text-purple-800',
      'resolved': 'bg-green-100 text-green-800',
      'closed': 'bg-gray-100 text-gray-800'
    };
    
    const priorityColors = {
      'Critical': 'bg-red-50 text-red-700 border-l-4 border-red-500',
      'Urgent': 'bg-orange-50 text-orange-700 border-l-4 border-orange-500',
      'Routine': 'bg-yellow-50 text-yellow-700 border-l-4 border-yellow-500',
      'Risky': 'bg-purple-50 text-purple-700 border-l-4 border-purple-500'
    };

    const statusClass = statusColors[issue.status] || 'bg-gray-100 text-gray-800';
    const priorityClass = priorityColors[issue.priority] || 'bg-gray-50 text-gray-700 border-l-4 border-gray-500';
    
    // Safe date formatting
    let date = 'Unknown';
    if (issue.createdAt) {
      try {
        const d = new Date(issue.createdAt);
        if (!isNaN(d.getTime())) {
          date = d.toLocaleDateString();
        }
      } catch (e) {
        console.warn('Invalid createdAt date:', issue.createdAt);
      }
    }
    
    const issueId = issue.id || issue._id;
    
    // Deadline calculation
    let timeRemaining = '∞';
    let deadlineClass = 'text-gray-500';
    let isOverdue = issue.isOverdue || false;
    
    if (issue.deadline) {
      const now = new Date();
      const deadline = new Date(issue.deadline);
      const diffMs = deadline - now;
      const diffMins = Math.ceil(diffMs / 60000);
      
      if (diffMins < 0) {
        timeRemaining = `🚨 OVERDUE: ${Math.abs(diffMins)} min`;
        deadlineClass = 'text-red-600 font-bold animate-pulse';
        isOverdue = true;
      } else if (diffMins < 60) {
        timeRemaining = `⚠️ ${diffMins} mins`;
        deadlineClass = 'text-orange-600 font-bold';
      } else if (diffMins < 1440) {
        const hours = Math.ceil(diffMins / 60);
        timeRemaining = `⏰ ${hours}h`;
        deadlineClass = 'text-yellow-600';
      } else {
        const days = Math.ceil(diffMins / 1440);
        timeRemaining = `📅 ${days}d`;
        deadlineClass = 'text-green-600';
      }
    }
    
    // SLA STATUS BADGE
    const slaStatus = issue.sla?.responseStatus || 'pending';
    const slaBreached = issue.sla?.responseTimeBreached || false;
    const remainingTime = issue.sla?.responseTimeRemaining || 0;
    
    // Debug logging
    console.log(`[ISSUE] ${issue.title} - SLA:`, {
      status: slaStatus,
      breached: slaBreached,
      remaining: remainingTime,
      target: issue.sla?.responseTimeTarget,
      fullSLA: issue.sla
    });
    
    let slaColor = 'bg-gray-100 text-gray-700';
    let slaText = '⏳ No SLA';
    
    if (slaBreached) {
      slaColor = 'bg-red-100 text-red-700 border border-red-300 animate-pulse';
      slaText = `🚨 SLA BREACHED`;
    } else if (slaStatus === 'met') {
      slaColor = 'bg-green-100 text-green-700 border border-green-300';
      slaText = `✅ SLA MET`;
    } else if (slaStatus === 'pending' && remainingTime > 0) {
      if (remainingTime < (issue.sla?.responseTimeTarget || 60) * 0.25) {
        slaColor = 'bg-yellow-100 text-yellow-700 border border-yellow-300';
        slaText = `⚠️ AT RISK (${Math.round(remainingTime)}m)`;
      } else {
        slaColor = 'bg-blue-100 text-blue-700 border border-blue-300';
        slaText = `⏱️ ${Math.round(remainingTime)}m left`;
      }
    } else if (issue.sla?.responseTimeTarget) {
      slaColor = 'bg-blue-100 text-blue-700 border border-blue-300';
      slaText = `⏱️ ${issue.sla.responseTimeTarget}m target`;
    }
    
    return `
      <div class="p-6 rounded-xl shadow-lg ${priorityClass} hover:shadow-xl transition cursor-pointer viewDetailsBtn" data-issue-id="${issueId}" ${isOverdue ? 'style="border: 2px solid red;"' : ''}>
        <div class="flex justify-between items-start mb-3">
          <h4 class="font-bold text-lg">${issue.title}</h4>
          <span class="px-3 py-1 rounded-full text-xs font-bold ${statusClass} capitalize">${issue.status}</span>
        </div>
        
        <p class="text-sm mb-3 opacity-90">👤 ${issue.createdBy?.name || 'Unknown'} | 📞 ${issue.createdBy?.contactNo || 'N/A'}</p>
        
        <div class="flex gap-2 mb-4">
          <span class="px-2 py-1 bg-white/50 rounded text-xs font-medium">🏷️ ${issue.issueType || issue.category}</span>
          <span class="px-2 py-1 bg-white/50 rounded text-xs font-medium">⚡ ${issue.priority}</span>
        </div>
        
        <!-- Progress & Deadline Row -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p class="text-xs opacity-75 mb-1">Progress</p>
            <div class="w-full bg-white/30 rounded-full h-2">
              <div class="bg-white h-2 rounded-full" style="width: ${issue.progress || 0}%"></div>
            </div>
            <p class="text-xs opacity-75 mt-1">${issue.progress || 0}%</p>
          </div>
          <div class="text-right">
            <p class="text-xs opacity-75 mb-1">Deadline</p>
            <p class="font-bold ${deadlineClass} text-sm">${timeRemaining}</p>
          </div>
        </div>
        
        <!-- SLA Badge -->
        <div class="mb-4 px-3 py-2 rounded-lg text-xs font-bold ${slaColor}">
          ${slaText}
        </div>
        
        <p class="text-xs opacity-75 mb-4">📅 Created: ${date}</p>
        
        <button class="w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg transition font-medium text-sm">
          View Details →
        </button>
      </div>
    `;
  }).join('');
  
  // Add event listeners to all "View Details" cards
  console.log("🔗 Adding click listeners...");
  document.querySelectorAll('.viewDetailsBtn').forEach(card => {
    card.addEventListener('click', (e) => {
      const issueId = card.getAttribute('data-issue-id');
      console.log("🖱️ Card clicked! Issue ID:", issueId);
      viewIssueDetailsFetch(issueId);
    });
  });
}

// VIEW ISSUE DETAILS - FETCH NEW ENDPOINT
async function viewIssueDetailsFetch(issueId) {
  try {
    const response = await fetch(`${API_BASE}/technician/issues/dashboard/${issueId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!response.ok) {
      console.error('Failed to fetch issue details:', response.status);
      // Fall back to local data
      const localIssue = allIssues.find(i => (i.id || i._id) === issueId);
      if (localIssue) {
        viewIssueDetails(issueId);
      }
      return;
    }

    const { issue } = await response.json();
    console.log("📋 Fetched enhanced issue data:", issue);
    
    // Update local cache and show modal
    const localIndex = allIssues.findIndex(i => (i.id || i._id) === issueId);
    if (localIndex >= 0) {
      allIssues[localIndex] = issue;
    }
    
    viewIssueDetails(issueId);
    
  } catch (error) {
    console.error('Error fetching issue details:', error);
    // Fall back to local data
    viewIssueDetails(issueId);
  }
}

// ==========================================
// VIEW ISSUE DETAILS (MODAL) - UPDATED
// ==========================================
function viewIssueDetails(issueId) {
  console.log("👆 View Details clicked for issue:", issueId);
  
  const issue = allIssues.find(i => (i.id || i._id) === issueId);
  if (!issue) {
    console.error("❌ Issue not found:", issueId);
    alert("Issue not found");
    return;
  }

  const modal = document.getElementById('issueModal');
  if (!modal) {
    console.error("❌ Modal not found in DOM");
    return;
  }
  
  console.log("📋 Populating modal with issue data:", issue.title);
  
  // Store current issue ID globally  
  window.currentIssueId = issueId;
  
  try {
    // Fill issue details
    const modalTitle = document.getElementById('modalTitle');
    const modalCategory = document.getElementById('modalCategory');
    const modalPriority = document.getElementById('modalPriority');
    const modalLocation = document.getElementById('modalLocation');
    const modalDescription = document.getElementById('modalDescription');
    const modalCreated = document.getElementById('modalCreated');
    const modalStatus = document.getElementById('modalStatus');
    const reporterSection = document.getElementById('reporterSection');
    const timelineContainer = document.getElementById('timelineContainer');
    const completionSection = document.getElementById('completionSection');
    
    if (modalTitle) modalTitle.textContent = issue.title || 'N/A';
    if (modalCategory) modalCategory.textContent = issue.issueType || issue.category || 'N/A';
    if (modalPriority) modalPriority.textContent = issue.priority || 'N/A';
    if (modalLocation) modalLocation.textContent = issue.location || 'N/A';
    if (modalDescription) modalDescription.textContent = issue.description || 'N/A';
    if (modalCreated) modalCreated.textContent = new Date(issue.createdAt).toLocaleDateString();
    
    // Status badge
    if (modalStatus) {
      const statusColors = {
        'open': 'bg-yellow-100 text-yellow-800',
        'assigned': 'bg-blue-100 text-blue-800',
        'in-progress': 'bg-purple-100 text-purple-800',
        'resolved': 'bg-green-100 text-green-800',
        'closed': 'bg-gray-100 text-gray-800'
      };
      modalStatus.textContent = (issue.status || 'unknown').toUpperCase();
      modalStatus.className = `px-4 py-2 rounded-full font-bold text-sm capitalize ${statusColors[issue.status] || 'bg-gray-100 text-gray-800'}`;
    }
    
    // Reporter details
    if (reporterSection && issue.createdBy) {
      const reporter = issue.createdBy;
      reporterSection.innerHTML = `
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center text-white font-bold">
            ${(reporter.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p class="text-gray-400 text-sm">Reported By</p>
            <p class="text-white font-bold">${reporter.name || 'Unknown'}</p>
            <p class="text-gray-400 text-sm">📧 ${reporter.email || 'N/A'}</p>
          </div>
        </div>
      `;
    }
    
    // Timeline
    if (timelineContainer && issue.timeline && issue.timeline.length > 0) {
      timelineContainer.innerHTML = issue.timeline.map((entry, idx) => {
        const isLast = idx === issue.timeline.length - 1;
        return `
          <div class="flex gap-4">
            <div class="flex flex-col items-center">
              <div class="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm">
                ${idx + 1}
              </div>
              ${!isLast ? '<div class="w-1 h-8 bg-orange-500/20"></div>' : ''}
            </div>
            <div class="pb-4">
              <p class="font-bold text-white capitalize">${entry.status || 'Update'}</p>
              <p class="text-sm text-gray-400">${new Date(entry.timestamp).toLocaleString()}</p>
              ${entry.note ? `<p class="text-sm text-gray-300 mt-1">"${entry.note}"</p>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
    
    // Show completion section for in-progress issues
    if (completionSection) {
      if (issue.status === 'in-progress' || issue.status === 'assigned') {
        completionSection.style.display = 'block';
      } else {
        completionSection.style.display = 'none';
      }
    }
    
    // Show modal
    console.log("✅ Opening modal");
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
  } catch (error) {
    console.error("❌ Error populating modal:", error);
    alert("Error opening issue details: " + error.message);
  }
}

// ==========================================
// NAVIGATION
// ==========================================
function setupNavigation() {
  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  // Setup anchor links for navigation
  const navLinks = document.querySelectorAll('aside nav a');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href) {
        window.location.href = href;
      }
    });
  });
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  alert("Logged out successfully");
  window.location.href = "login.html";
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("🔧 Initializing Technician Dashboard...");
  
  // Modal close button handler
  const closeBtn = document.getElementById('closeModalBtn');
  const issueModal = document.getElementById('issueModal');
  
  if (closeBtn && issueModal) {
    closeBtn.addEventListener('click', () => {
      issueModal.classList.add('hidden');
      issueModal.classList.remove('flex');
      window.currentIssueId = null;
      console.log("✅ Modal closed via button");
    });
  } else {
    console.warn("⚠️ Close button or modal not found");
  }

  // Click outside modal to close
  if (issueModal) {
    issueModal.addEventListener('click', (e) => {
      if (e.target.id === 'issueModal') {
        e.target.classList.add('hidden');
        e.target.classList.remove('flex');
        window.currentIssueId = null;
        console.log("✅ Modal closed via overlay");
      }
    });
  }
  
  // Setup action buttons
  const updateProgressBtn = document.getElementById('updateProgressBtn');
  const addNoteBtn = document.getElementById('addNoteBtn');
  const completeBtn = document.getElementById('completeBtn');
  
  if (updateProgressBtn) {
    updateProgressBtn.addEventListener('click', updateProgress);
  }
  if (addNoteBtn) {
    addNoteBtn.addEventListener('click', addNote);
  }
  if (completeBtn) {
    completeBtn.addEventListener('click', completeIssue);
  }
  
  // Load data and setup navigation
  console.log("📦 Loading dashboard data...");
  loadDashboardData();
  
  console.log("🔗 Setting up navigation...");
  setupNavigation();
  
  // Reload data every 5 seconds
  setInterval(loadDashboardData, 5000);
  
  console.log("✅ Initialization complete!");
});

// ==========================================
// COMPLETE ISSUE - UPDATED WITH NEW ENDPOINT
// ==========================================
async function completeIssue() {
  const modal = document.getElementById('issueModal');
  
  // Find current issue - try multiple ways
  let currentIssue = null;
  const issueIdAttr = modal?.querySelector('[data-issue-id]')?.getAttribute('data-issue-id');
  
  if (window.currentIssueId) {
    currentIssue = allIssues.find(i => (i.id || i._id) === window.currentIssueId);
  } else if (issueIdAttr) {
    currentIssue = allIssues.find(i => (i.id || i._id) === issueIdAttr);
  }
  
  if (!currentIssue) {
    alert("Unable to identify current issue");
    return;
  }
  
  const note = document.getElementById('completionNote')?.value || 'Issue resolved';
  
  try {
    const issueId = currentIssue.id || currentIssue._id;
    const response = await fetch(`${API_BASE}/technician/issues/${issueId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        completionNotes: note
      })
    });
    
    if (!response.ok) throw new Error('Failed to complete issue');
    
    alert('✅ Issue marked as completed!');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    loadDashboardData();
  } catch (error) {
    console.error('Error completing issue:', error);
    alert('Error: ' + error.message);
  }
}

// ==========================================
// UPDATE PROGRESS
// ==========================================
async function updateProgress() {
  const progressSlider = document.getElementById('progressSlider');
  const progressMessage = document.getElementById('progressMessage');
  
  if (!progressSlider || !progressMessage) {
    alert('Progress form elements not found');
    return;
  }

  const progress = parseInt(progressSlider.value) || 0;
  const message = progressMessage.value.trim();

  if (!message) {
    alert('Please add an update message');
    return;
  }

  const currentIssue = window.currentIssueId ? allIssues.find(i => (i.id || i._id) === window.currentIssueId) : null;
  if (!currentIssue) {
    alert('Unable to identify current issue');
    return;
  }

  try {
    const issueId = currentIssue.id || currentIssue._id;
    const response = await fetch(`${API_BASE}/technician/issues/${issueId}/progress`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ progress, message })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Progress update failed:', response.status, data);
      throw new Error(data.error || data.details || 'Failed to update progress');
    }

    alert('✅ Progress updated!');
    progressSlider.value = 0;
    progressMessage.value = '';
    
    // Reload data
    loadDashboardData();
    
  } catch (error) {
    console.error('Error:', error);
    alert(`Failed to update progress: ${error.message}`);
  }
}

// ==========================================
// ADD NOTE
// ==========================================
async function addNote() {
  const noteInput = document.getElementById('noteInput');
  
  if (!noteInput) {
    alert('Note input not found');
    return;
  }

  const message = noteInput.value.trim();

  if (!message) {
    alert('Please enter a note');
    return;
  }

  const currentIssue = window.currentIssueId ? allIssues.find(i => (i.id || i._id) === window.currentIssueId) : null;
  if (!currentIssue) {
    alert('Unable to identify current issue');
    return;
  }

  try {
    const issueId = currentIssue.id || currentIssue._id;
    const response = await fetch(`${API_BASE}/technician/issues/${issueId}/note`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) throw new Error('Failed to add note');

    alert('✅ Note added!');
    noteInput.value = '';
    
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to add note');
  }
}
