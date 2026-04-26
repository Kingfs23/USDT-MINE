import { supabase } from "./supabase-client.js";
import {
  createTransaction,
  formatMoney,
  getCurrentUser,
  getTransactions,
  getUserProfile,
  guardFirebase,
  resendVerificationEmail,
  setStatus,
  signOutUser,
  summarizeTransactions,
} from "./auth-helpers.js";

const dashboard = document.getElementById("dashboard");
const verifyGate = document.getElementById("verify-gate");
const verifyStatus = document.getElementById("verify-status");
const statusBanner = document.getElementById("account-status-banner");
const depositForm = document.getElementById("deposit-form");
const withdrawForm = document.getElementById("withdraw-form");
const transactionsList = document.getElementById("transactions-list");

const profileName = document.getElementById("profile-name");
const profileUsername = document.getElementById("profile-username");
const profileEmail = document.getElementById("profile-email");
const profileVerification = document.getElementById("profile-verification");
const balanceValue = document.getElementById("balance-value");
const pendingDeposits = document.getElementById("pending-deposits");
const pendingWithdrawals = document.getElementById("pending-withdrawals");
const accountStatus = document.getElementById("account-status");

function transactionMarkup(transaction) {
  const amount = formatMoney(transaction.amount);
  const typeLabel = transaction.type === "deposit" ? "Deposit" : "Withdrawal";
  const meta = [transaction.network, transaction.status].filter(Boolean).join(" | ");
  const note = transaction.note || transaction.wallet_address || "No extra details";

  return `
    <article class="transaction-item">
      <div>
        <h3>${typeLabel}</h3>
        <p>${meta}</p>
      </div>
      <div class="transaction-meta">
        <strong>${amount}</strong>
        <span>${note}</span>
      </div>
    </article>
  `;
}

async function renderDashboard(user) {
  const profile = await getUserProfile(user);
  const transactions = await getTransactions(user.id);
  const summary = summarizeTransactions(profile, transactions);

  profileName.textContent = profile.name || user.user_metadata?.name || "-";
  profileUsername.textContent = profile.username || "-";
  profileEmail.textContent = profile.email || user.email || "-";
  profileVerification.textContent = user.email_confirmed_at ? "Verified" : "Not verified";
  balanceValue.textContent = formatMoney(summary.balance);
  pendingDeposits.textContent = formatMoney(summary.pendingDeposits);
  pendingWithdrawals.textContent = formatMoney(summary.pendingWithdrawals);
  accountStatus.textContent = profile.account_status || "Active";

  if (!transactions.length) {
    transactionsList.innerHTML = `<p class="empty-state">No deposits or withdrawals yet.</p>`;
  } else {
    transactionsList.innerHTML = transactions.map(transactionMarkup).join("");
  }

  dashboard.classList.remove("hidden");
  verifyGate.classList.add("hidden");
  setStatus(
    statusBanner,
    "Deposits and withdrawals are created as account requests. Connect an admin/payment approval flow before production use.",
    "default"
  );
}

function showVerificationGate() {
  dashboard.classList.add("hidden");
  verifyGate.classList.remove("hidden");
  setStatus(
    verifyStatus,
    "Your account exists, but email verification is still pending. Verify your email to continue.",
    "default"
  );
}

window.setTimeout(async () => {
  if (!guardFirebase(statusBanner)) {
    return;
  }

  const user = await getCurrentUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (!user.email_confirmed_at) {
    showVerificationGate();
    return;
  }

  await renderDashboard(user);
}, 0);

document.getElementById("logout-button").addEventListener("click", async () => {
  await signOutUser();
  window.location.href = "login.html";
});

document.getElementById("gate-logout").addEventListener("click", async () => {
  await signOutUser();
  window.location.href = "login.html";
});

document.getElementById("resend-verification").addEventListener("click", async () => {
  try {
    const user = await getCurrentUser();
    await resendVerificationEmail(user.email);
    setStatus(verifyStatus, "Verification email sent. Check your inbox and then refresh this page.", "success");
  } catch (error) {
    setStatus(verifyStatus, error.message || "Could not resend verification email.", "error");
  }
});

depositForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = await getCurrentUser();

  if (!user || !user.email_confirmed_at) {
    showVerificationGate();
    return;
  }

  try {
    await createTransaction(user.id, {
      type: "deposit",
      amount: Number(document.getElementById("deposit-amount").value),
      network: document.getElementById("deposit-network").value,
      note: document.getElementById("deposit-note").value.trim(),
    });

    depositForm.reset();
    await renderDashboard(user);
    setStatus(statusBanner, "Deposit request submitted successfully.", "success");
  } catch (error) {
    setStatus(statusBanner, error.message || "Could not submit the deposit request.", "error");
  }
});

withdrawForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = await getCurrentUser();

  if (!user || !user.email_confirmed_at) {
    showVerificationGate();
    return;
  }

  const profile = await getUserProfile(user);
  const amount = Number(document.getElementById("withdraw-amount").value);

  if (amount > Number(profile.account_balance || 0)) {
    setStatus(statusBanner, "Withdrawal amount cannot be more than the current account balance.", "error");
    return;
  }

  try {
    await createTransaction(user.id, {
      type: "withdrawal",
      amount,
      network: document.getElementById("withdraw-network").value,
      walletAddress: document.getElementById("wallet-address").value.trim(),
    });

    withdrawForm.reset();
    await renderDashboard(user);
    setStatus(statusBanner, "Withdrawal request submitted successfully.", "success");
  } catch (error) {
    setStatus(statusBanner, error.message || "Could not submit the withdrawal request.", "error");
  }
});
