import {
  CONVERSION_RATE,
  accrueMiningProfits,
  formatMoney,
  getCurrentUser,
  getTransactions,
  guardFirebase,
  setStatus,
  startUserNotifications,
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
  const status = transaction.status || "Pending";
  const tone = String(status).toLowerCase();

  return `
    <article class="transaction-item">
      <div class="notification-main">
        <span class="notification-dot ${tone}"></span>
        <h3>${transaction.type === "deposit" ? "Deposit" : "Withdrawal"}</h3>
        <p>${transaction.network || "Wallet"}</p>
      </div>
      <div class="transaction-meta">
        <strong>${formatMoney(amount)}</strong>
        <span>${status}</span>
      </div>
    </article>
  `;
}

function renderHistory() {
  if (!walletTransactions.length) {
    walletHistoryList.innerHTML = `<p class="empty-state">No notifications.</p>`;
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

  const transactions = await getTransactions(user.id);
  walletTransactions = transactions;

  walletStatus.textContent = "Online";
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
