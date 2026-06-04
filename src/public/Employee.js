document.addEventListener("DOMContentLoaded", async () => {

  const token = localStorage.getItem("token");
  if (!token) {
    window.location.replace("login.html");
    return;
  }

  let issues = [];
  let currentUser = null;

  /* ================= PROFILE ================= */
  async function loadProfile() {
    try {
      const res = await fetch("http://localhost:5000/api/employee/auth/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Unauthorized");

      currentUser = await res.json();
      document.getElementById("welcomeName").textContent = currentUser.name;

    } catch (err) {
      console.error("Auth failed:", err);
      localStorage.removeItem("token");
      window.location.replace("login.html");
    }
  }

  /* ================= LOAD ISSUES (ENHANCED) ================= */
  async function loadIssues() {
    try {
      const res = await fetch("http://localhost:5000/api/employee/dashboard/issues", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        console.error(`API Error: ${res.status} ${res.statusText}`);
        return;
      }

      const data = await res.json();
      console.log("📊 Enhanced Issues fetched:", data);
      
      issues = data.data || [];
      console.log("✅ Issues count:", issues.length);

      updateStats();
      renderRecentActivity();
    } catch (err) {
      console.error("Load issues error:", err);
    }
  }

  /* ================= DASHBOARD STATS ================= */
  function updateStats() {
    const total = issues.length;
    const open = issues.filter(i => i.status === "open" || i.status === "assigned").length;
    const inProgress = issues.filter(i => i.status === "in-progress").length;
    const resolved = issues.filter(i => i.status === "resolved").length;

    console.log("📈 Stats:", { total, open, inProgress, resolved });

    const totalEl = document.getElementById("totalIssuesCount");
    const openEl = document.getElementById("openIssuesCount");
    const inProgressEl = document.getElementById("inProgressCount");
    const resolvedEl = document.getElementById("resolvedCount");

    if (totalEl) totalEl.textContent = total;
    if (openEl) openEl.textContent = open;
    if (inProgressEl) inProgressEl.textContent = inProgress;
    if (resolvedEl) resolvedEl.textContent = resolved;
  }

  /* ================= RECENT ACTIVITY (WITH TECHNICIAN & DEADLINE) ================= */
  function renderRecentActivity() {
    const container = document.getElementById("recentActivityContainer");
    if (!container) return;

    if (issues.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center py-12">No issues yet. Create one to get started!</p>';
      return;
    }

    container.innerHTML = issues.slice(0, 8).map(issue => {
      const statusColors = {
        'open': 'bg-yellow-100 text-yellow-800',
        'assigned': 'bg-blue-100 text-blue-800',
        'in-progress': 'bg-purple-100 text-purple-800',
        'resolved': 'bg-green-100 text-green-800',
        'closed': 'bg-gray-100 text-gray-800'
      };
      
      const statusClass = statusColors[issue.status] || 'bg-gray-100 text-gray-800';
      const date = new Date(issue.createdAt).toLocaleDateString();
      const time = new Date(issue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const technicianName = issue.assignedTechnician?.name || 'Unassigned';
      const technicianEmail = issue.assignedTechnician?.email || '';
      const technicianContact = issue.assignedTechnician?.contactNo || 'N/A';
      const technicianInitial = technicianName.charAt(0).toUpperCase();
      
      // Calculate time remaining
      let timeRemaining = '∞';
      let deadlineClass = 'text-gray-500';
      let isOverdue = false;
      
      if (issue.deadline) {
        const now = new Date();
        const deadline = new Date(issue.deadline);
        const diffMs = deadline - now;
        const diffMins = Math.ceil(diffMs / 60000);
        
        if (diffMins < 0) {
          timeRemaining = `OVERDUE: ${Math.abs(diffMins)} min`;
          deadlineClass = 'text-red-600 font-bold';
          isOverdue = true;
        } else if (diffMins < 60) {
          timeRemaining = `${diffMins} mins`;
          deadlineClass = 'text-orange-600 font-bold';
        } else if (diffMins < 1440) {
          const hours = Math.ceil(diffMins / 60);
          timeRemaining = `${hours}h`;
          deadlineClass = 'text-yellow-600';
        } else {
          const days = Math.ceil(diffMins / 1440);
          timeRemaining = `${days}d`;
          deadlineClass = 'text-green-600';
        }
      }
      
      return `
        <div class="p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:shadow-lg hover:from-primary/5 hover:to-secondary/5 transition border-l-4 border-primary cursor-pointer ${isOverdue ? 'border-red-500 bg-red-50' : ''}" onclick="showIssueDetails('${issue.id}')">
          <div class="flex justify-between items-start mb-3">
            <div class="flex-1">
              <h4 class="font-bold text-gray-900 text-lg">${issue.title}</h4>
              <p class="text-sm text-gray-600 mt-1">ID: #${issue.id.slice(-6)} | ${date} at ${time}</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-bold ${statusClass} capitalize ml-4 whitespace-nowrap">${issue.status}</span>
          </div>
          
          <!-- Progress Bar -->
          <div class="mb-3 mt-3">
            <div class="flex justify-between items-center mb-1">
              <span class="text-xs text-gray-600">Progress</span>
              <span class="text-xs font-bold text-gray-800">${issue.progress}%</span>
            </div>
            <div class="w-full bg-gray-300 rounded-full h-2">
              <div class="bg-blue-500 h-2 rounded-full" style="width: ${issue.progress}%"></div>
            </div>
          </div>
          
          <!-- Technician & Deadline Row -->
          <div class="flex justify-between items-center mt-4 pt-3 border-t border-gray-200 flex-wrap gap-2">
            <div class="flex items-center gap-3 flex-1 min-w-max">
              <div class="w-8 h-8 rounded-full ${issue.assignedTechnician ? 'bg-primary text-white' : 'bg-gray-300 text-gray-500'} flex items-center justify-center text-xs font-bold">
                ${technicianInitial}
              </div>
              <div>
                <p class="text-xs text-gray-600">Assigned To</p>
                <p class="font-semibold text-gray-900">${technicianName}</p>
                <p class="text-xs text-gray-500">${technicianEmail}</p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-600">Deadline</p>
              <p class="font-semibold ${deadlineClass}">${timeRemaining}</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ================= SHOW ISSUE DETAILS WITH ENHANCED INFO ================= */
  window.showIssueDetails = async (issueId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/employee/dashboard/issue/${issueId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        alert("Failed to fetch issue details");
        return;
      }

      const { issue } = await res.json();
      const modal = document.getElementById('issueModal');
      
      // Fill issue details
      document.getElementById('modalTitle').textContent = issue.title;
      document.getElementById('modalCategory').textContent = issue.issueType || '-';
      document.getElementById('modalPriority').textContent = issue.priority || '-';
      document.getElementById('modalDescription').textContent = issue.description || '-';
      document.getElementById('modalCreated').textContent = new Date(issue.createdAt).toLocaleDateString();
      document.getElementById('modalUpdated').textContent = new Date(issue.updatedAt).toLocaleDateString();
      
      // Technician Information
      const techName = issue.assignedTechnician?.name || 'Unassigned';
      const techEmail = issue.assignedTechnician?.email || '-';
      const techPhone = issue.assignedTechnician?.contactNo || '-';
      document.getElementById('modalTechnicianName').textContent = techName;
      document.getElementById('modalTechnicianEmail').innerHTML = `📧 ${techEmail}`;
      document.getElementById('modalTechnicianPhone').innerHTML = `📱 ${techPhone}`;
      
      // Deadline Information
      if (issue.deadline) {
        const deadline = new Date(issue.deadline);
        const now = new Date();
        const diffMs = deadline - now;
        const diffMins = Math.ceil(diffMs / 60000);
        
        let deadlineText = '';
        if (diffMins < 0) {
          deadlineText = `🚨 OVERDUE by ${Math.abs(diffMins)} minutes`;
        } else {
          deadlineText = `⏰ ${deadline.toLocaleDateString()} ${deadline.toLocaleTimeString()}`;
        }
        
        document.getElementById('modalDeadline').textContent = deadlineText;
      }
      
      // Progress Bar
      document.getElementById('modalProgressBar').style.width = issue.progress + '%';
      document.getElementById('modalProgressPercent').textContent = issue.progress + '%';
      
      // Status badge
      const statusColors = {
        'open': 'bg-yellow-100 text-yellow-800',
        'assigned': 'bg-blue-100 text-blue-800',
        'in-progress': 'bg-purple-100 text-purple-800',
        'resolved': 'bg-green-100 text-green-800',
        'closed': 'bg-gray-100 text-gray-800'
      };
      
      const statusEl = document.getElementById('modalStatus');
      if (statusEl) {
        statusEl.className = `px-4 py-2 rounded-full font-bold capitalize ${statusColors[issue.status] || 'bg-gray-100 text-gray-800'}`;
        statusEl.textContent = issue.status;
      }
      
      // Show rating button if resolved
      const ratingSection = document.getElementById('ratingSection');
      if (ratingSection) {
        if (issue.status === 'resolved' || issue.status === 'closed') {
          ratingSection.style.display = 'block';
          window.currentIssueId = issueId;
        } else {
          ratingSection.style.display = 'none';
        }
      }
      
      // Show modal
      if (modal) {
        modal.style.display = 'flex';
      }

    } catch (err) {
      console.error('Error fetching issue details:', err);
      alert('Error loading issue details');
    }
  };

  /* ================= RATE TECHNICIAN ================= */
  
  // Store current rating
  let currentRating = 0;
  
  window.setRating = (rating) => {
    currentRating = rating;
    document.getElementById('ratingValue').textContent = `${rating} star${rating !== 1 ? 's' : ''} selected`;
    
    // Update star display
    for (let i = 1; i <= 5; i++) {
      const star = document.getElementById(`star${i}`);
      if (i <= rating) {
        star.textContent = '⭐';
        star.style.transform = 'scale(1.2)';
      } else {
        star.textContent = '☆';
        star.style.transform = 'scale(1)';
      }
    }
  };
  
  window.submitRating = async () => {
    const issueId = window.currentIssueId;
    
    if (!issueId) {
      alert('Unable to identify current issue');
      return;
    }

    if (currentRating === 0) {
      alert('Please select a rating');
      return;
    }

    const review = document.getElementById('ratingReview')?.value.trim() || '';

    try {
      const res = await fetch(`http://localhost:5000/api/employee/dashboard/rate/${issueId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating: currentRating, review })
      });

      if (!res.ok) throw new Error('Failed to submit rating');

      alert('✅ Thank you for your rating!');
      
      // Reset rating UI
      currentRating = 0;
      document.getElementById('ratingReview').value = '';
      document.getElementById('ratingValue').textContent = 'Select rating';
      for (let i = 1; i <= 5; i++) {
        document.getElementById(`star${i}`).textContent = '☆';
        document.getElementById(`star${i}`).style.transform = 'scale(1)';
      }
      
      // Reload data
      loadIssues();
      
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to submit rating');
    }
  };

  /* ================= CLOSE MODAL ================= */
  const closeBtn = document.getElementById('closeModalBtn');
  const issueModal = document.getElementById('issueModal');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (issueModal) {
        issueModal.classList.add('hidden');
        issueModal.classList.remove('flex');
      }
    });
  }

  if (issueModal) {
    issueModal.addEventListener('click', (e) => {
      if (e.target.id === 'issueModal') {
        e.target.classList.add('hidden');
        e.target.classList.remove('flex');
      }
    });
  }

  /* ================= AUTO-REFRESH EVERY 5 SECONDS ================= */
  function startAutoRefresh() {
    setInterval(() => {
      loadIssues();
    }, 5000);
  }

  /* ================= LOGOUT ================= */
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.replace("login.html");
  });

  /* ================= INIT ================= */
  await loadProfile();
  await loadIssues();
  startAutoRefresh();

});
