import {
  adminApproveTransaction,
  adminDeleteUser,
  adminGetAllUsers,
  adminGetTransactions,
  adminRejectTransaction,
  adminSearchUsers,
  adminUpdateBalance,
  formatMoney,
  formatNaira,
  toNaira,
} from "./auth-helpers.js";
import { isSupabaseConfigured } from "./supabase-config.js";
import { supabase } from "./supabase-client.js";

const DEFAULT_ADMIN_PASSWORD = "admin123";
const REFRESH_INTERVAL_MS = 30000;

const loginScreen = document.getElementById("login-screen");
const adminDashboard = document.getElementById("admin-dashboard");
const loginForm = document.getElementById("admin-login-form");
const loginError = document.getElementById("login-error");
const adminPasswordInput = document.getElementById("admin-password");

const logoutBtn = document.getElementById("logout-btn");
const statusMessage = document.getElementById("status-message");
const requestAlert = document.getElementById("request-alert");

const tabs = document.querySelectorAll("[data-admin-tab]");
const panels = document.querySelectorAll(".admin-panel");

const metricUsers = document.getElementById("metric-users");
const metricDeposits = document.getElementById("metric-deposits");
const metricWithdrawals = document.getElementById("metric-withdrawals");
const metricDepositValue = document.getElementById("metric-deposit-value");

const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const loadAllBtn = document.getElementById("load-all-btn");
const usersTbody = document.getElementById("users-tbody");
const depositsTbody = document.getElementById("deposits-tbody");
const withdrawalsTbody = document.getElementById("withdrawals-tbody");
const refreshRequestsBtn = document.getElementById("refresh-requests-btn");
const refreshWithdrawalsBtn = document.getElementById("refresh-withdrawals-btn");

const editModal = document.getElementById("edit-modal");
const editModalClose = document.getElementById("edit-modal-close");
const editModalCancel = document.getElementById("edit-modal-cancel");
const editBalanceForm = document.getElementById("edit-balance-form");
const editStatusMessage = document.getElementById("edit-status-message");
const editUserId = document.getElementById("edit-user-id");
const editUserName = document.getElementById("edit-user-name");
const balanceType = document.getElementById("balance-type");
const balanceAmount = document.getElementById("balance-amount");

const deleteModal = document.getElementById("delete-modal");
const deleteModalClose = document.getElementById("delete-modal-close");
const deleteModalCancel = document.getElementById("delete-modal-cancel");
const deleteUserInfo = document.getElementById("delete-user-info");
const deleteConfirmBtn = document.getElementById("delete-confirm-btn");

let currentUsers = [];
let currentDeposits = [];
let currentWithdrawals = [];
let knownPendingDepositIds = new Set();
let editingUserId = null;
let deletingUserId = null;
let refreshTimer = null;

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
  loginScreen.style.display = "grid";
  adminDashboard.style.display = "none";
}

function showAdminDashboard() {
  loginScreen.style.display = "none";
  adminDashboard.style.display = "block";
}

function displayStatus(message, type = "default") {
  statusMessage.innerHTML = message ? `<div class="status-message ${type}">${escapeHtml(message)}</div>` : "";
}

function showRequestAlert(message) {
  requestAlert.textContent = message;
  requestAlert.classList.add("show", "success");

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("USDT Mine", { body: message });
  }
}

function hideRequestAlert() {
  requestAlert.classList.remove("show", "success");
  requestAlert.textContent = "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPill(status) {
  const tone = String(status || "").toLowerCase();
  return `<span class="status-pill ${escapeHtml(tone)}">${escapeHtml(status || "-")}</span>`;
}

function userCell(record) {
  return `
    <div class="cell-stack">
      <strong>${escapeHtml(record.name || "-")}</strong>
      <span>@${escapeHtml(record.username || "-")}</span>
      <span class="muted">${escapeHtml(record.user_id_display || "-")}</span>
    </div>
  `;
}

function renderMetrics() {
  const pendingDeposits = currentDeposits.filter((item) => item.status === "Pending");
  const pendingWithdrawals = currentWithdrawals.filter((item) => item.status === "Pending");
  const pendingDepositValue = pendingDeposits.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  metricUsers.textContent = String(currentUsers.length);
  metricDeposits.textContent = String(pendingDeposits.length);
  metricWithdrawals.textContent = String(pendingWithdrawals.length);
  metricDepositValue.textContent = formatMoney(pendingDepositValue);
}

function renderUsersTable(users) {
  if (!users.length) {
    usersTbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">No users found</div></td></tr>`;
    return;
  }

  usersTbody.innerHTML = users
    .map(
      (user) => `
        <tr>
          <td>${userCell(user)}</td>
          <td>
            <div class="cell-stack">
              <span>${escapeHtml(user.email || "-")}</span>
              <span class="muted">${escapeHtml(user.user_id_display || "-")}</span>
            </div>
          </td>
          <td class="money-cell">${formatMoney(user.capital_balance || 0)}</td>
          <td class="money-cell">${formatMoney(user.profits_balance || 0)}</td>
          <td class="money-cell">${formatMoney(user.total_deposited || 0)}</td>
          <td>${statusPill(user.account_status || "Active")}</td>
          <td>${formatDate(user.created_at)}</td>
          <td>
            <div class="row-actions">
              <button class="admin-btn primary" type="button" onclick="editUserBalance('${user.id}', '${encodeURIComponent(
        user.user_id_display || "-"
      )}', '${encodeURIComponent(user.name || "-")}')">Edit</button>
              <button class="admin-btn danger" type="button" onclick="deleteUserAccount('${user.id}', '${encodeURIComponent(
        user.user_id_display || "-"
      )}', '${encodeURIComponent(user.name || "-")}')">Delete</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderTransactionRows(items, type) {
  const target = type === "deposit" ? depositsTbody : withdrawalsTbody;

  if (!items.length) {
    target.innerHTML = `<tr><td colspan="7"><div class="empty-state">No ${type} requests found</div></td></tr>`;
    return;
  }

  target.innerHTML = items
    .map((item) => {
      const bankDetails =
        type === "deposit"
          ? [
              `Bank: ${item.sender_bank_name || "-"}`,
              `Account: ${item.sender_account_number || "-"}`,
              `Name: ${item.sender_account_name || "-"}`,
            ]
          : [
              `Bank: ${item.withdrawal_bank_name || "-"}`,
              `Account: ${item.withdrawal_account_number || item.wallet_address || "-"}`,
              `Name: ${item.withdrawal_account_name || "-"}`,
            ];

      const actions =
        item.status === "Pending"
          ? `
            <div class="row-actions">
              <button class="admin-btn success" type="button" onclick="approveTransaction('${item.id}', '${type}')">Approve</button>
              <button class="admin-btn danger" type="button" onclick="rejectTransaction('${item.id}', '${type}')">Reject</button>
            </div>
          `
          : `<span class="muted">${item.admin_note ? escapeHtml(item.admin_note) : "No action available"}</span>`;

      return `
        <tr>
          <td>${userCell(item)}</td>
          <td>
            <div class="cell-stack">
              <strong class="money-cell">${formatMoney(item.amount || 0)}</strong>
              <span class="muted">${formatNaira(toNaira(item.amount || 0))}</span>
            </div>
          </td>
          <td>
            <div class="cell-stack">
              ${bankDetails.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
            </div>
          </td>
          <td>${escapeHtml(item.note || "-")}</td>
          <td>${statusPill(item.status)}</td>
          <td>${formatDate(item.created_at)}</td>
          <td>${actions}</td>
        </tr>
      `;
    })
    .join("");
}

async function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not available. Check supabase-config.js and refresh.");
  }
}

async function loadUsers() {
  await ensureSupabase();
  currentUsers = await adminGetAllUsers(1000, 0);
  renderUsersTable(currentUsers);
  renderMetrics();
}

async function loadRequests({ notify = false } = {}) {
  await ensureSupabase();

  const [deposits, withdrawals] = await Promise.all([
    adminGetTransactions("deposit", null, 200),
    adminGetTransactions("withdrawal", null, 200),
  ]);

  const pendingDepositIds = new Set(deposits.filter((item) => item.status === "Pending").map((item) => item.id));
  const newPendingCount = [...pendingDepositIds].filter((id) => !knownPendingDepositIds.has(id)).length;

  currentDeposits = deposits;
  currentWithdrawals = withdrawals;
  renderTransactionRows(currentDeposits, "deposit");
  renderTransactionRows(currentWithdrawals, "withdrawal");
  renderMetrics();

  if (notify && knownPendingDepositIds.size > 0 && newPendingCount > 0) {
    showRequestAlert(`${newPendingCount} new deposit request${newPendingCount === 1 ? "" : "s"} received.`);
  }

  knownPendingDepositIds = pendingDepositIds;
}

async function loadDashboard() {
  try {
    displayStatus("Loading admin data...", "default");
    await Promise.all([loadUsers(), loadRequests()]);
    displayStatus("Admin data loaded.", "success");
  } catch (error) {
    displayStatus(error.message || "Could not load admin data.", "error");
  }
}

async function searchUsers() {
  const query = searchInput.value.trim();

  if (!query) {
    await loadUsers();
    return;
  }

  try {
    displayStatus("Searching users...", "default");
    currentUsers = await adminSearchUsers(query, 100, 0);
    renderUsersTable(currentUsers);
    renderMetrics();
    displayStatus(`Found ${currentUsers.length} user${currentUsers.length === 1 ? "" : "s"}.`, "success");
  } catch (error) {
    displayStatus(error.message || "Could not search users.", "error");
  }
}

function startAutoRefresh() {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    loadRequests({ notify: true }).catch((error) => {
      displayStatus(error.message || "Could not refresh requests.", "error");
    });
  }, REFRESH_INTERVAL_MS);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = adminPasswordInput.value.trim();

  if (password.toLowerCase() !== DEFAULT_ADMIN_PASSWORD) {
    loginError.textContent = "Invalid password. The current default password is admin123.";
    loginError.style.display = "block";
    return;
  }

  setAdminLoggedIn(true);
  adminPasswordInput.value = "";
  loginError.style.display = "none";
  showAdminDashboard();

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  await loadDashboard();
  startAutoRefresh();
});

logoutBtn.addEventListener("click", () => {
  setAdminLoggedIn(false);
  window.clearInterval(refreshTimer);
  currentUsers = [];
  currentDeposits = [];
  currentWithdrawals = [];
  hideRequestAlert();
  showLoginScreen();
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetId = tab.dataset.adminTab;

    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    panels.forEach((panel) => panel.classList.toggle("active", panel.id === targetId));
  });
});

searchBtn.addEventListener("click", searchUsers);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchUsers();
  }
});

loadAllBtn.addEventListener("click", async () => {
  searchInput.value = "";
  await loadUsers();
  displayStatus("Loaded all users.", "success");
});

refreshRequestsBtn.addEventListener("click", async () => {
  await loadRequests();
  displayStatus("Deposit and withdrawal requests refreshed.", "success");
});

refreshWithdrawalsBtn.addEventListener("click", async () => {
  await loadRequests();
  displayStatus("Deposit and withdrawal requests refreshed.", "success");
});

window.editUserBalance = function (userId, displayId, name) {
  editingUserId = userId;
  editUserId.value = decodeURIComponent(displayId);
  editUserName.value = decodeURIComponent(name);
  balanceType.value = "capital";
  balanceAmount.value = "";
  editStatusMessage.innerHTML = "";
  editBalanceForm.querySelector("button[type=submit]").disabled = false;
  editModal.classList.add("active");
};

editModalClose.addEventListener("click", () => editModal.classList.remove("active"));
editModalCancel.addEventListener("click", () => editModal.classList.remove("active"));

editBalanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const amount = Number(balanceAmount.value);

  if (!amount || amount <= 0) {
    editStatusMessage.innerHTML = `<div class="status-message error">Enter a valid amount.</div>`;
    return;
  }

  const submitButton = editBalanceForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  editStatusMessage.innerHTML = `<div class="status-message">Updating balance...</div>`;

  try {
    await adminUpdateBalance(editingUserId, balanceType.value, amount);
    editStatusMessage.innerHTML = `<div class="status-message success">Balance updated.</div>`;
    await loadUsers();
    window.setTimeout(() => editModal.classList.remove("active"), 700);
  } catch (error) {
    editStatusMessage.innerHTML = `<div class="status-message error">${escapeHtml(error.message || "Could not update balance.")}</div>`;
    submitButton.disabled = false;
  }
});

window.deleteUserAccount = function (userId, displayId, name) {
  deletingUserId = userId;
  deleteUserInfo.value = `${decodeURIComponent(displayId)} - ${decodeURIComponent(name)}`;
  deleteConfirmBtn.disabled = false;
  deleteConfirmBtn.textContent = "Delete Permanently";
  deleteModal.classList.add("active");
};

deleteModalClose.addEventListener("click", () => deleteModal.classList.remove("active"));
deleteModalCancel.addEventListener("click", () => deleteModal.classList.remove("active"));

deleteConfirmBtn.addEventListener("click", async () => {
  if (!deletingUserId) {
    return;
  }

  deleteConfirmBtn.disabled = true;
  deleteConfirmBtn.textContent = "Deleting...";

  try {
    await adminDeleteUser(deletingUserId);
    deleteModal.classList.remove("active");
    displayStatus("User deleted.", "success");
    await loadDashboard();
  } catch (error) {
    displayStatus(error.message || "Could not delete user.", "error");
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = "Delete Permanently";
  }
});

window.approveTransaction = async function (transactionId, type) {
  const note = window.prompt(`Optional admin note for approving this ${type}:`, "") || "";

  try {
    displayStatus(`Approving ${type}...`, "default");
    await adminApproveTransaction(transactionId, note);
    hideRequestAlert();
    await loadDashboard();
    displayStatus(`${type === "deposit" ? "Deposit" : "Withdrawal"} approved.`, "success");
  } catch (error) {
    displayStatus(error.message || `Could not approve ${type}.`, "error");
  }
};

window.rejectTransaction = async function (transactionId, type) {
  const note = window.prompt(`Reason for rejecting this ${type}:`, "") || "";

  if (!window.confirm(`Reject this ${type} request?`)) {
    return;
  }

  try {
    displayStatus(`Rejecting ${type}...`, "default");
    await adminRejectTransaction(transactionId, note);
    await loadDashboard();
    displayStatus(`${type === "deposit" ? "Deposit" : "Withdrawal"} rejected.`, "success");
  } catch (error) {
    displayStatus(error.message || `Could not reject ${type}.`, "error");
  }
};

window.addEventListener("load", async () => {
  if (isAdminLoggedIn()) {
    showAdminDashboard();
    await loadDashboard();
    startAutoRefresh();
  } else {
    showLoginScreen();
  }
});
