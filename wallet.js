import {
  CONVERSION_RATE,
  accrueMiningProfits,
  formatMoney,
  formatNaira,
  getCurrentUser,
  getTransactions,
  getUserProfile,
  guardFirebase,
  setStatus,
  startUserNotifications,
  toNaira,
} from "./auth-helpers.js";

const HISTORY_PREVIEW_COUNT = 1;

const walletStatus = document.getElementById("wallet-status");
const walletHistoryList = document.getElementById("wallet-history-list");
const conversionRateText = document.getElementById("conversion-rate-text");

let walletTransactions = [];
let showAllHistory = false;

conversionRateText.textContent = `$1 = NGN ${CONVERSION_RATE.toLocaleString("en-US")}`;

function transactionMarkup(transaction) {
  const amount = Number(transaction.amount || 0);
  const nairaValue = formatNaira(toNaira(amount));
  const bankDetails =
    transaction.type === "deposit"
      ? [transaction.sender_bank_name, transaction.sender_account_number, transaction.sender_account_name]
      : [
          transaction.withdrawal_bank_name,
          transaction.withdrawal_account_number || transaction.wallet_address,
          transaction.withdrawal_account_name,
        ];
  const note = transaction.note || bankDetails.filter(Boolean).join(" | ") || "No extra details";

  return `
    <article class="transaction-item">
      <div>
        <h3>${transaction.type === "deposit" ? "Deposit Request" : "Withdrawal Request"}</h3>
        <p>${[transaction.network, transaction.status].filter(Boolean).join(" | ")}</p>
      </div>
      <div class="transaction-meta">
        <strong>${formatMoney(amount)}</strong>
        <span>${nairaValue} | ${note}</span>
      </div>
    </article>
  `;
}

function renderHistory() {
  if (!walletTransactions.length) {
    walletHistoryList.innerHTML = `<p class="empty-state">No deposit or withdrawal requests yet.</p>`;
    return;
  }

  const visibleItems = showAllHistory ? walletTransactions : walletTransactions.slice(0, HISTORY_PREVIEW_COUNT);
  const showToggle = walletTransactions.length > HISTORY_PREVIEW_COUNT;

  walletHistoryList.innerHTML = `
    ${visibleItems.map(transactionMarkup).join("")}
    ${
      showToggle
        ? `<button class="text-toggle-button" id="wallet-history-toggle" type="button">${
            showAllHistory ? "Show less" : "Show more"
          }</button>`
        : ""
    }
  `;

  document.getElementById("wallet-history-toggle")?.addEventListener("click", () => {
    showAllHistory = !showAllHistory;
    renderHistory();
  });
}

async function renderWallet() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (!user.email_confirmed_at) {
    window.location.href = "account.html";
    return;
  }

  startUserNotifications(user.id);
  try {
    await accrueMiningProfits();
  } catch (error) {
    console.warn("Mining accrual failed:", error);
  }

  const [profile, transactions] = await Promise.all([getUserProfile(user), getTransactions(user.id)]);
  walletTransactions = transactions;

  walletStatus.textContent = `Capital Balance: ${formatMoney(
    profile.capital_balance || 0
  )} | Profits Balance: ${formatMoney(profile.profits_balance || 0)} | Conversion rate: NGN ${CONVERSION_RATE.toLocaleString(
    "en-US"
  )} per $1`;
  walletStatus.dataset.tone = "default";
  renderHistory();
}

window.setTimeout(async () => {
  if (!guardFirebase(walletStatus)) {
    return;
  }

  try {
    await renderWallet();
  } catch (error) {
    setStatus(walletStatus, error.message || "Could not load wallet information.", "error");
  }
}, 0);
