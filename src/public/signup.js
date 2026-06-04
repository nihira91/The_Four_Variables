console.log("🔥 CORRECT signup.js LOADED 🔥");

const form = document.getElementById("signupForm");
const nameField = document.getElementById("name");
const emailField = document.getElementById("email");
const organizationField = document.getElementById("organizationId");
const selectOrgDiv = document.getElementById("selectOrgDiv");
const writeOrgDiv = document.getElementById("writeOrgDiv");
const organizationNameField = document.getElementById("organizationName");
const selectOrgError = document.getElementById("selectOrgError");
const writeOrgError = document.getElementById("writeOrgError");
const generalOrgError = document.getElementById("generalOrgError");
const contactField = document.getElementById("contactNo");
const contactDiv = document.getElementById("contactDiv");
const passwordField = document.getElementById("password");
const confirmField = document.getElementById("confirmPassword");
const pwError = document.getElementById("pwError");

// Toggle between Select and Write organization modes
function toggleOrgMode() {
  const mode = document.querySelector('input[name="orgMode"]:checked').value;
  
  if (mode === "select") {
    selectOrgDiv.classList.remove("hidden");
    writeOrgDiv.classList.add("hidden");
    organizationField.required = true;
    organizationNameField.required = false;
  } else {
    selectOrgDiv.classList.add("hidden");
    writeOrgDiv.classList.remove("hidden");
    organizationField.required = false;
    organizationNameField.required = true;
  }
  
  // Clear errors
  selectOrgError.classList.add("hidden");
  writeOrgError.classList.add("hidden");
  generalOrgError.classList.add("hidden");
}

// Load organizations on page load
window.addEventListener("load", async () => {
  try {
    const response = await fetch("http://localhost:5000/api/organization/list");
    const data = await response.json();
    
    if (data.success && data.organizations) {
      data.organizations.forEach(org => {
        const option = document.createElement("option");
        option.value = org._id;
        option.textContent = org.name;
        organizationField.appendChild(option);
      });
    }
  } catch (err) {
    console.error("Failed to load organizations:", err);
  }
});

// Toggle contact field visibility based on role
function toggleContactField() {
  const role = document.querySelector('input[name="role"]:checked').value;
  if (role === "technician") {
    contactDiv.classList.remove("hidden");
    contactField.required = true;
  } else {
    contactDiv.classList.add("hidden");
    contactField.required = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const mode = document.querySelector('input[name="orgMode"]:checked').value;
  let organizationId = null;
  let organizationName = null;

  // Validate organization selection
  if (mode === "select") {
    organizationId = organizationField.value.trim();
    if (!organizationId) {
      selectOrgError.classList.remove("hidden");
      return;
    }
    selectOrgError.classList.add("hidden");
  } else {
    organizationName = organizationNameField.value.trim();
    if (!organizationName) {
      writeOrgError.classList.remove("hidden");
      return;
    }
    writeOrgError.classList.add("hidden");
  }

  generalOrgError.classList.add("hidden");

  // Validate password
  const password = passwordField.value.trim();
  const confirm = confirmField.value.trim();
  const pwRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{6,}$/;

  if (password !== confirm || !pwRegex.test(password)) {
    pwError.classList.remove("hidden");
    return;
  }
  pwError.classList.add("hidden");

  const role = document.querySelector('input[name="role"]:checked').value;

  const API_URL =
    role === "technician"
      ? "http://localhost:5000/api/technician/auth/signup"
      : "http://localhost:5000/api/employee/auth/signup";

  // Build request body
  const requestBody = {
    name: nameField.value.trim(),
    email: emailField.value.trim(),
    password,
    role
  };

  // Add organization identifier
  if (organizationId) {
    requestBody.organizationId = organizationId;
  } else {
    requestBody.organizationName = organizationName;
  }

  // Add contact number for technicians
  if (role === "technician") {
    requestBody.contactNo = contactField.value.trim();
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message || "Account created! Waiting for admin approval...");
      window.location.href = "login.html";
    } else {
      if (data.message) {
        alert(data.message);
      } else {
        generalOrgError.classList.remove("hidden");
      }
    }
  } catch (err) {
    console.error(err);
    alert("Server not responding. Please try again.");
  }
});
