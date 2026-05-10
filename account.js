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

const ACTIVITY_PREVIEW_COUNT = 3;

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
let accountActivityItems = [];
let showAllAccountActivity = false;

function setText(target, value) {
  if (target) {
    target.textContent = value;
  }
}

function activityMarkup(item) {
  const title = item.kind === "earning" ? "Daily Mining Profit" : item.type === "deposit" ? "Deposit" : "Withdrawal";
  const meta = item.kind === "earning" ? item.dateLabel : [item.network, item.status].filter(Boolean).join(" | ");
  const bankDetails =
    item.type === "deposit"
      ? [item.sender_bank_name, item.sender_account_number, item.sender_account_name]
      : [item.withdrawal_bank_name, item.withdrawal_account_number || item.wallet_address, item.withdrawal_account_name];
  const note =
    item.kind === "earning"
      ? "Credited from active miner plan"
      : item.note || bankDetails.filter(Boolean).join(" | ") || "No extra details";

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

function renderAccountActivity() {
  if (!accountActivityItems.length) {
    transactionsList.innerHTML = `<p class="empty-state">No wallet requests or mining earnings yet.</p>`;
    return;
  }

  const visibleItems = showAllAccountActivity
    ? accountActivityItems
    : accountActivityItems.slice(0, ACTIVITY_PREVIEW_COUNT);
  const showToggle = accountActivityItems.length > ACTIVITY_PREVIEW_COUNT;

  transactionsList.innerHTML = `
    ${visibleItems.map(activityMarkup).join("")}
    ${
      showToggle
        ? `<button class="text-toggle-button" id="account-activity-toggle" type="button">${
            showAllAccountActivity ? "Show less" : "Show more"
          }</button>`
        : ""
    }
  `;

  document.getElementById("account-activity-toggle")?.addEventListener("click", () => {
    showAllAccountActivity = !showAllAccountActivity;
    renderAccountActivity();
  });
}

async function renderDashboard(user) {
  try {
    await accrueMiningProfits();
  } catch (error) {
    console.warn("Mining accrual failed:", error);
  }

  const profile = await getUserProfile(user);
  const [transactionsResult, purchasesResult, earningsResult] = await Promise.allSettled([
    getTransactions(user.id),
    getMinerPurchases(user.id),
    getMiningEarnings(user.id),
  ]);
  const transactions = transactionsResult.status === "fulfilled" ? transactionsResult.value : [];
  const purchases = purchasesResult.status === "fulfilled" ? purchasesResult.value : [];
  const earnings = earningsResult.status === "fulfilled" ? earningsResult.value : [];
  const partialLoadFailed = [transactionsResult, purchasesResult, earningsResult].some(
    (result) => result.status === "rejected"
  );

  const summary = summarizeTransactions(profile, transactions);
  const activeMiners = purchases.filter((purchase) => purchase.status === "active").length;
  const totalMiningEarned = purchases.reduce((sum, purchase) => sum + Number(purchase.accrued_profit || 0), 0);

  setText(profileName, profile.name || user.user_metadata?.name || "-");
  setText(profileUsername, profile.username || "-");
  setText(profileEmail, profile.email || user.email || "-");
  setText(profileVerification, user.email_confirmed_at ? "Verified" : "Not verified");
  setText(capitalBalanceValue, formatMoney(summary.capitalBalance));
  setText(profitsBalanceValue, formatMoney(summary.profitsBalance));
  setText(pendingDeposits, formatMoney(summary.pendingDeposits));
  setText(activeMinersCount, String(activeMiners));
  setText(miningEarnedValue, formatMoney(totalMiningEarned));

  accountActivityItems = [
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
  ].sort((left, right) => right.createdAt - left.createdAt);

  showAllAccountActivity = false;
  renderAccountActivity();

  dashboard.classList.remove("hidden");
  verifyGate.classList.add("hidden");
  setStatus(
    statusBanner,
    partialLoadFailed
      ? "Your profile loaded, but some wallet or mining records could not load. Run the latest supabase-schema.sql in Supabase if this continues."
      : "Deposit and withdrawal requests are handled on the wallet page, while miner profits are credited daily across the 30-day cycle.",
    partialLoadFailed ? "error" : "default"
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
    dashboard.classList.remove("hidden");
    verifyGate.classList.add("hidden");
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
    dashboard.classList.remove("hidden");
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
