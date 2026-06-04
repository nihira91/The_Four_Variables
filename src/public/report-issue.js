console.log("📝 report-issue.js LOADED");

// Check authentication
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

if (!token || !user.id) {
  alert("Please login first");
  window.location.href = "login.html";
}

// DOM Elements
const issueForm = document.getElementById("issueForm");
const issueTitle = document.getElementById("issueTitle");
const issueDesc = document.getElementById("issueDesc");
const issueLocation = document.getElementById("issueLocation");
const issueCategory = document.getElementById("issueCategory");
const issuePriority = document.getElementById("issuePriority");
const priorityButtons = document.querySelectorAll(".priority-btn");

// 🤖 AI Suggestion Elements
const getSuggestionsBtn = document.getElementById("getSuggestionsBtn");
const suggestionsPanel = document.getElementById("suggestionsPanel");
const suggestedCategory = document.getElementById("suggestedCategory");
const suggestedPriority = document.getElementById("suggestedPriority");
const suggestedReasoning = document.getElementById("suggestedReasoning");
const confidenceScore = document.getElementById("confidenceScore");
const acceptSuggestionBtns = document.querySelectorAll(".accept-suggestion");

let currentSuggestion = null;

// 🤖 GET AI SUGGESTIONS
getSuggestionsBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  const title = issueTitle.value.trim();
  const description = issueDesc.value.trim();

  if (!title || !description) {
    alert("Please enter issue title and description first");
    return;
  }

  // Show loading state
  getSuggestionsBtn.disabled = true;
  getSuggestionsBtn.innerHTML = "⏳ AI Analyzing (Hugging Face)...";

  try {
    const response = await fetch("http://localhost:5000/api/employee/issues/categorize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        description
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log("✅ AI Suggestion received:", data.suggestion);
      
      // Store suggestion
      currentSuggestion = data.suggestion;

      // Update UI
      suggestedCategory.textContent = currentSuggestion.category;
      suggestedPriority.textContent = currentSuggestion.priority;
      suggestedReasoning.textContent = currentSuggestion.reasoning;
      confidenceScore.textContent = `Confidence: ${currentSuggestion.confidence}%`;

      // Show panel with animation
      suggestionsPanel.classList.remove("hidden");
      suggestionsPanel.style.animation = "slideIn 0.3s ease-out";

    } else {
      alert("Could not get suggestions: " + (data.message || "Unknown error"));
    }
  } catch (error) {
    console.error("❌ Error getting suggestions:", error);
    alert("Server error: " + error.message);
  } finally {
    // Reset button
    getSuggestionsBtn.disabled = false;
    getSuggestionsBtn.innerHTML = "🤖 Get AI Suggestions";
  }
});

// ✓ ACCEPT SUGGESTION
acceptSuggestionBtns.forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    
    const type = btn.dataset.type;

    if (type === "category") {
      issueCategory.value = currentSuggestion.category;
      console.log("✅ Category suggestion accepted:", currentSuggestion.category);
    } else if (type === "priority") {
      issuePriority.value = currentSuggestion.priority;
      
      // Update priority button UI
      priorityButtons.forEach(b => {
        b.classList.remove("ring-2", "ring-offset-2", "ring-primary");
        b.style.opacity = "0.7";
      });
      
      const targetBtn = Array.from(priorityButtons).find(b => b.dataset.priority === currentSuggestion.priority);
      if (targetBtn) {
        targetBtn.classList.add("ring-2", "ring-offset-2", "ring-primary");
        targetBtn.style.opacity = "1";
      }
      
      console.log("✅ Priority suggestion accepted:", currentSuggestion.priority);
    }

    // Show confirmation
    btn.innerHTML = "✓ Accepted!";
    btn.classList.add("opacity-100", "bg-green-200", "text-green-700");
    btn.classList.remove("bg-blue-100", "text-blue-700", "bg-orange-100", "text-orange-700", "hover:bg-blue-200", "hover:bg-orange-200");
    btn.disabled = true;

    setTimeout(() => {
      btn.innerHTML = type === "category" ? "✓ Accept" : "✓ Accept";
      btn.classList.remove("opacity-100", "bg-green-200", "text-green-700");
      btn.classList.add("bg-blue-100", "text-blue-700", "hover:bg-blue-200");
      if (type === "priority") {
        btn.classList.remove("bg-blue-100", "text-blue-700", "hover:bg-blue-200");
        btn.classList.add("bg-orange-100", "text-orange-700", "hover:bg-orange-200");
      }
      btn.disabled = false;
    }, 1500);
  });
});

// Priority Button Handler
priorityButtons.forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    
    // Remove active state from all buttons
    priorityButtons.forEach(b => {
      b.classList.remove("ring-2", "ring-offset-2", "ring-primary");
      b.style.opacity = "0.7";
    });
    
    // Add active state to clicked button
    btn.classList.add("ring-2", "ring-offset-2", "ring-primary");
    btn.style.opacity = "1";
    
    // Set hidden input value
    issuePriority.value = btn.dataset.priority;
    console.log("✅ Priority selected:", btn.dataset.priority);
  });
});

// Form Submit Handler
issueForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = issueTitle.value.trim();
  const description = issueDesc.value.trim();
  const location = issueLocation.value.trim();
  const category = issueCategory.value.trim();
  const priority = issuePriority.value.trim();

  // Validation
  if (!title) {
    alert("Please enter issue title");
    return;
  }

  if (!description) {
    alert("Please enter issue description");
    return;
  }

  if (!location) {
    alert("Please enter issue location");
    return;
  }

  if (!category) {
    alert("Please select a category");
    return;
  }

  if (!priority) {
    alert("Please select a priority level");
    return;
  }

  console.log("📤 Creating issue with data:", {
    title,
    description,
    location,
    category,
    priority
  });

  try {
    // Submit issue to backend
    const response = await fetch("http://localhost:5000/api/employee/issues/issue/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        description,
        location,
        category,
        priority,
        images: []
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Issue created successfully:", data);
      
      // Show success message
      alert("✅ Issue reported successfully!\n\nThe issue has been assigned to a technician in the " + category + " category.");
      
      // Reset form
      issueForm.reset();
      issuePriority.value = "";
      priorityButtons.forEach(b => {
        b.classList.remove("ring-2", "ring-offset-2", "ring-primary");
        b.style.opacity = "0.7";
      });
      
      // Hide suggestions panel
      suggestionsPanel.classList.add("hidden");
      currentSuggestion = null;
      
      // Redirect to my-issues page after 2 seconds
      setTimeout(() => {
        window.location.href = "my-issues.html";
      }, 2000);
    } else {
      console.error("❌ Error creating issue:", data);
      alert("Error: " + (data.message || "Failed to create issue"));
    }
  } catch (error) {
    console.error("❌ Network error:", error);
    alert("Server error: " + error.message);
  }
});

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);

console.log("✅ report-issue.js initialized successfully");
