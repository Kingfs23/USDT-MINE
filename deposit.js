import {
  CONVERSION_RATE,
  formatMoney,
  formatNaira,
  getCurrentUser,
  getTransactions,
  guardFirebase,
  setStatus,
  startUserNotifications,
  toNaira,
} from "./auth-helpers.js";

const HISTORY_PREVIEW_COUNT = 1;
const DEPOSIT_DRAFT_KEY = "usdt-mine-deposit-draft";

const params = new URLSearchParams(window.location.search);
const initialAmount = Number(params.get("amount") || 0);

const form = document.getElementById("bank-deposit-form");
const amountInput = document.getElementById("deposit-amount");
const statusElement = document.getElementById("deposit-status");
const depositUsd = document.getElementById("deposit-usd");
const depositNgn = document.getElementById("deposit-ngn");
const depositRate = document.getElementById("deposit-rate");
const depositHistoryList = document.getElementById("deposit-history-list");
let depositHistory = [];
let showAllDepositHistory = false;

function updateAmountDisplay() {
  const amount = Number(amountInput.value || 0);
  depositUsd.textContent = formatMoney(amount);
  depositNgn.textContent = formatNaira(toNaira(amount));
}

if (initialAmount > 0) {
  amountInput.value = initialAmount;
}

depositRate.textContent = `$1 = NGN ${CONVERSION_RATE.toLocaleString("en-US")}`;
updateAmountDisplay();
amountInput.addEventListener("input", updateAmountDisplay);

function depositHistoryMarkup(transaction) {
  const amount = Number(transaction.amount || 0);
  const details = [transaction.sender_bank_name, transaction.sender_account_number, transaction.sender_account_name]
    .filter(Boolean)
    .join(" | ");

  return `
    <article class="transaction-item">
      <div>
        <h3>Deposit Request</h3>
        <p>${[transaction.network, transaction.status].filter(Boolean).join(" | ")}</p>
      </div>
      <div class="transaction-meta">
        <strong>${formatMoney(amount)}</strong>
        <span>${formatNaira(toNaira(amount))} | ${transaction.note || details || "No extra details"}</span>
      </div>
    </article>
  `;
}

function renderDepositHistory() {
  if (!depositHistory.length) {
    depositHistoryList.innerHTML = `<p class="empty-state">No deposit requests yet.</p>`;
    return;
  }

  const visibleItems = showAllDepositHistory ? depositHistory : depositHistory.slice(0, HISTORY_PREVIEW_COUNT);
  const showToggle = depositHistory.length > HISTORY_PREVIEW_COUNT;

  depositHistoryList.innerHTML = `
    ${visibleItems.map(depositHistoryMarkup).join("")}
    ${
      showToggle
        ? `<button class="text-toggle-button" id="deposit-history-toggle" type="button">${
            showAllDepositHistory ? "Show less" : "Show more"
          }</button>`
        : ""
    }
  `;

  document.getElementById("deposit-history-toggle")?.addEventListener("click", () => {
    showAllDepositHistory = !showAllDepositHistory;
    renderDepositHistory();
  });
}

async function loadDepositHistory() {
  if (!guardFirebase(statusElement)) {
    return;
  }

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
  const transactions = await getTransactions(user.id);
  depositHistory = transactions.filter((transaction) => transaction.type === "deposit");
  renderDepositHistory();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!guardFirebase(statusElement)) {
    return;
  }

  const amount = Number(amountInput.value || 0);

  if (!amount || amount <= 0) {
    setStatus(statusElement, "Enter a valid deposit amount.", "error");
    return;
  }

  try {
    const user = await getCurrentUser();

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    if (!user.email_confirmed_at) {
      throw new Error("Verify your email before making deposit requests.");
    }

    const draft = {
      amount,
      note: document.getElementById("deposit-note").value.trim(),
      senderBankName: document.getElementById("sender-bank-name").value.trim(),
      senderAccountNumber: document.getElementById("sender-account-number").value.trim(),
      senderAccountName: document.getElementById("sender-account-name").value.trim(),
      createdAt: new Date().toISOString(),
    };

    sessionStorage.setItem(DEPOSIT_DRAFT_KEY, JSON.stringify(draft));
    startUserNotifications(user.id);
    window.location.href = "deposit-transfer.html";
  } catch (error) {
    setStatus(statusElement, error.message || "Could not continue to transfer.", "error");
  }
});

window.setTimeout(() => {
  loadDepositHistory().catch((error) => {
    depositHistoryList.innerHTML = `<p class="empty-state">${error.message || "Could not load deposit history."}</p>`;
  });
}, 0);
