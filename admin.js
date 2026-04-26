import {
  adminGetUserByDisplayId,
  adminGetAllUsers,
  adminUpdateBalance,
  adminDeleteUser,
  formatMoney,
} from "./auth-helpers.js";
import { supabase } from "./supabase-client.js";

// DEFAULT ADMIN PASSWORD - CHANGE THIS IN PRODUCTION!
const DEFAULT_ADMIN_PASSWORD = "admin123";

const loginScreen = document.getElementById("login-screen");
const adminDashboard = document.getElementById("admin-dashboard");
const loginForm = document.getElementById("admin-login-form");
const loginError = document.getElementById("login-error");
const adminPasswordInput = document.getElementById("admin-password");

const logoutBtn = document.getElementById("logout-btn");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const loadAllBtn = document.getElementById("load-all-btn");
const statusMessage = document.getElementById("status-message");
const usersTbody = document.getElementById("users-tbody");
const pagination = document.getElementById("pagination");

// Edit Modal
const editModal = document.getElementById("edit-modal");
const editModalClose = document.getElementById("edit-modal-close");
const editModalCancel = document.getElementById("edit-modal-cancel");
const editBalanceForm = document.getElementById("edit-balance-form");
const editStatusMessage = document.getElementById("edit-status-message");
const editUserId = document.getElementById("edit-user-id");
const editUserName = document.getElementById("edit-user-name");
const balanceType = document.getElementById("balance-type");
const balanceAmount = document.getElementById("balance-amount");

// Delete Modal
const deleteModal = document.getElementById("delete-modal");
const deleteModalClose = document.getElementById("delete-modal-close");
const deleteModalCancel = document.getElementById("delete-modal-cancel");
const deleteUserInfo = document.getElementById("delete-user-info");
const deleteConfirmBtn = document.getElementById("delete-confirm-btn");

let currentUsers = [];
let currentPage = 0;
const itemsPerPage = 10;
let editingUserId = null;
let deletingUserId = null;

// Check if admin is logged in
function isAdminLoggedIn() {
  return localStorage.getItem("admin-logged-in") === "true";
}

function setAdminLoggedIn(logged) {
  if (logged) {
    localStorage.setItem("admin-logged-in", "true");
  } else {
    localStorage.removeItem("admin-logged-in");
  }
}

function showLoginScreen() {
  loginScreen.style.display = "flex";
  adminDashboard.style.display = "none";
}

function showAdminDashboard() {
  loginScreen.style.display = "none";
  adminDashboard.style.display = "block";
}

// Handle login
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const password = adminPasswordInput.value.trim();

  if (password === DEFAULT_ADMIN_PASSWORD) {
    setAdminLoggedIn(true);
    adminPasswordInput.value = "";
    loginError.style.display = "none";
    showAdminDashboard();
    loadAllUsers();
  } else {
    loginError.textContent = "Invalid password";
    loginError.style.display = "block";
  }
});

// Handle logout
logoutBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to logout?")) {
    setAdminLoggedIn(false);
    currentUsers = [];
    currentPage = 0;
    usersTbody.innerHTML = "";
    pagination.innerHTML = "";
    statusMessage.innerHTML = "";
    showLoginScreen();
  }
});

function displayStatus(message, type = "default") {
  statusMessage.innerHTML = `<div class="status-message ${type}">${message}</div>`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderUsersTable(users) {
  if (!users || users.length === 0) {
    usersTbody.innerHTML = '<tr><td colspan="10"><div class="empty-state">No users found</div></td></tr>';
    return;
  }

  usersTbody.innerHTML = users
    .map(
      (user) => `
    <tr>
      <td class="user-id">${user.user_id_display}</td>
      <td>${user.name || "-"}</td>
      <td>${user.username || "-"}</td>
      <td>${user.email || "-"}</td>
      <td class="balance-cell">${formatMoney(user.capital_balance || 0)}</td>
      <td class="balance-cell">${formatMoney(user.profits_balance || 0)}</td>
      <td class="balance-cell">${formatMoney(user.total_deposited || 0)}</td>
      <td>${user.account_status || "Active"}</td>
      <td>${formatDate(user.created_at)}</td>
      <td class="action-buttons">
        <button class="action-btn btn-edit" onclick="editUserBalance('${user.id}', '${user.user_id_display}', '${user.name.replace(/'/g, "\\'")}')">Edit</button>
        <button class="action-btn btn-delete" onclick="deleteUserAccount('${user.id}', '${user.user_id_display}', '${user.name.replace(/'/g, "\\'")}')">Delete</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function renderPagination(total) {
  const pages = Math.ceil(total / itemsPerPage);

  let html = "";
  for (let i = 0; i < pages; i++) {
    const isActive = i === currentPage;
    html += `
      <button 
        ${isActive ? 'class="active"' : ""} 
        ${i >= pages ? "disabled" : ""} 
        onclick="goToPage(${i})"
      >
        Page ${i + 1}
      </button>
    `;
  }

  pagination.innerHTML = html;
}

function displayUserPage() {
  const start = currentPage * itemsPerPage;
  const end = start + itemsPerPage;
  const pageUsers = currentUsers.slice(start, end);
  renderUsersTable(pageUsers);
  renderPagination(currentUsers.length);
}

window.goToPage = function (page) {
  currentPage = page;
  displayUserPage();
};

async function loadAllUsers() {
  try {
    displayStatus("Loading users...", "default");
    currentUsers = await adminGetAllUsers(1000, 0);
    currentPage = 0;
    displayUserPage();
    displayStatus(`Loaded ${currentUsers.length} users`, "success");
  } catch (error) {
    displayStatus(`Error loading users: ${error.message}`, "error");
  }
}

async function searchUserById() {
  const displayId = searchInput.value.trim().toUpperCase();

  if (!displayId) {
    displayStatus("Please enter a User ID", "error");
    return;
  }

  try {
    displayStatus("Searching...", "default");
    const user = await adminGetUserByDisplayId(displayId);

    if (!user) {
      displayStatus(`No user found with ID: ${displayId}`, "error");
      currentUsers = [];
      currentPage = 0;
      renderUsersTable([]);
      pagination.innerHTML = "";
      return;
    }

    currentUsers = [user];
    currentPage = 0;
    displayUserPage();
    displayStatus(`Found user: ${user.name}`, "success");
  } catch (error) {
    displayStatus(`Error searching user: ${error.message}`, "error");
  }
}

searchBtn.addEventListener("click", searchUserById);
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    searchUserById();
  }
});

loadAllBtn.addEventListener("click", loadAllUsers);

// Edit Balance Modal Logic
window.editUserBalance = function (userId, displayId, name) {
  editingUserId = userId;
  editUserId.value = displayId;
  editUserName.value = name;
  balanceType.value = "capital";
  balanceAmount.value = "";
  editStatusMessage.innerHTML = "";
  editModal.classList.add("active");
};

editModalClose.addEventListener("click", () => {
  editModal.classList.remove("active");
});

editModalCancel.addEventListener("click", () => {
  editModal.classList.remove("active");
});

editBalanceForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const amount = Number(balanceAmount.value);
  const type = balanceType.value;

  if (isNaN(amount) || amount <= 0) {
    editStatusMessage.innerHTML = '<div class="status-message error">Please enter a valid amount</div>';
    return;
  }

  try {
    editBalanceForm.querySelector("button[type=submit]").disabled = true;
    editStatusMessage.innerHTML = '<div class="status-message">Updating balance...</div>';

    await adminUpdateBalance(editingUserId, type, amount);

    editStatusMessage.innerHTML = `<div class="status-message success">Balance updated successfully!</div>`;

    setTimeout(() => {
      editModal.classList.remove("active");
      loadAllUsers();
    }, 1000);
  } catch (error) {
    editStatusMessage.innerHTML = `<div class="status-message error">Error: ${error.message}</div>`;
    editBalanceForm.querySelector("button[type=submit]").disabled = false;
  }
});

// Delete User Modal Logic
window.deleteUserAccount = function (userId, displayId, name) {
  deletingUserId = userId;
  deleteUserInfo.value = `${displayId} - ${name}`;
  deleteModal.classList.add("active");
};

deleteModalClose.addEventListener("click", () => {
  deleteModal.classList.remove("active");
});

deleteModalCancel.addEventListener("click", () => {
  deleteModal.classList.remove("active");
});

deleteConfirmBtn.addEventListener("click", async () => {
  if (!deletingUserId) return;

  try {
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = "Deleting...";

    await adminDeleteUser(deletingUserId);

    displayStatus("User deleted successfully!", "success");
    deleteModal.classList.remove("active");
    loadAllUsers();
  } catch (error) {
    alert(`Error deleting user: ${error.message}`);
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = "Delete Permanently";
  }
});

// Initialize on page load
window.addEventListener("load", () => {
  if (isAdminLoggedIn()) {
    showAdminDashboard();
    loadAllUsers();
  } else {
    showLoginScreen();
  }
});
