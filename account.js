import {
  accrueMiningProfits,
  formatMoney,
  getCurrentUser,
  getMinerPurchases,
  getMiningEarnings,
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
const transactionsList = document.getElementById("transactions-list");

const profileName = document.getElementById("profile-name");
const profileUsername = document.getElementById("profile-username");
const profileEmail = document.getElementById("profile-email");
const profileVerification = document.getElementById("profile-verification");
const capitalBalanceValue = document.getElementById("capital-balance-value");
const profitsBalanceValue = document.getElementById("profits-balance-value");
const pendingDeposits = document.getElementById("pending-deposits");
const activeMinersCount = document.getElementById("active-miners-count");
const miningEarnedValue = document.getElementById("mining-earned-value");

function activityMarkup(item) {
  const title = item.kind === "earning" ? "Daily Mining Profit" : item.type === "deposit" ? "Deposit" : "Withdrawal";
  const meta = item.kind === "earning" ? item.dateLabel : [item.network, item.status].filter(Boolean).join(" | ");
  const note =
    item.kind === "earning"
      ? "Credited from active miner plan"
      : item.note || item.wallet_address || "No extra details";

  return `
    <article class="transaction-item">
      <div>
        <h3>${title}</h3>
        <p>${meta}</p>
      </div>
      <div class="transaction-meta">
        <strong>${formatMoney(item.amount)}</strong>
        <span>${note}</span>
      </div>
    </article>
  `;
}

function formatDateLabel(value) {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function renderDashboard(user) {
  await accrueMiningProfits();

  const [profile, transactions, purchases, earnings] = await Promise.all([
    getUserProfile(user),
    getTransactions(user.id),
    getMinerPurchases(user.id),
    getMiningEarnings(user.id),
  ]);

  const summary = summarizeTransactions(profile, transactions);
  const activeMiners = purchases.filter((purchase) => purchase.status === "active").length;
  const totalMiningEarned = purchases.reduce((sum, purchase) => sum + Number(purchase.accrued_profit || 0), 0);

  profileName.textContent = profile.name || user.user_metadata?.name || "-";
  profileUsername.textContent = profile.username || "-";
  profileEmail.textContent = profile.email || user.email || "-";
  profileVerification.textContent = user.email_confirmed_at ? "Verified" : "Not verified";
  capitalBalanceValue.textContent = formatMoney(summary.capitalBalance);
  profitsBalanceValue.textContent = formatMoney(summary.profitsBalance);
  pendingDeposits.textContent = formatMoney(summary.pendingDeposits);
  activeMinersCount.textContent = String(activeMiners);
  miningEarnedValue.textContent = formatMoney(totalMiningEarned);

  const mergedActivity = [
    ...transactions.map((transaction) => ({
      kind: "transaction",
      ...transaction,
      createdAt: new Date(transaction.created_at).getTime(),
    })),
    ...earnings.map((earning) => ({
      kind: "earning",
      amount: earning.amount,
      dateLabel: formatDateLabel(earning.earning_date),
      createdAt: new Date(earning.created_at).getTime(),
    })),
  ]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 12);

  if (!mergedActivity.length) {
    transactionsList.innerHTML = `<p class="empty-state">No wallet requests or mining earnings yet.</p>`;
  } else {
    transactionsList.innerHTML = mergedActivity.map(activityMarkup).join("");
  }

  dashboard.classList.remove("hidden");
  verifyGate.classList.add("hidden");
  setStatus(
    statusBanner,
    "Deposit and withdrawal requests are handled on the wallet page, while miner profits are credited daily across the 30-day cycle.",
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

  try {
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
  } catch (error) {
    dashboard.classList.add("hidden");
    verifyGate.classList.add("hidden");
    setStatus(statusBanner, error.message || "Could not load your account information.", "error");
  }
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
