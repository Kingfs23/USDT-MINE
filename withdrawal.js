import {
  CONVERSION_RATE,
  createTransaction,
  formatMoney,
  formatNaira,
  getCurrentUser,
  getTransactions,
  getUserProfile,
  guardFirebase,
  setStatus,
  toNaira,
} from "./auth-helpers.js";

const HISTORY_PREVIEW_COUNT = 3;

const form = document.getElementById("withdraw-form");
const statusElement = document.getElementById("withdraw-status");
const withdrawAmount = document.getElementById("withdraw-amount");
const withdrawNaira = document.getElementById("withdraw-naira");
const withdrawHistoryList = document.getElementById("withdraw-history-list");
let withdrawHistory = [];
let showAllWithdrawHistory = false;

function updateConversion() {
  withdrawNaira.textContent = formatNaira(toNaira(withdrawAmount.value));
}

withdrawAmount.addEventListener("input", updateConversion);

function withdrawalHistoryMarkup(transaction) {
  const amount = Number(transaction.amount || 0);
  const details = [
    transaction.withdrawal_bank_name,
    transaction.withdrawal_account_number || transaction.wallet_address,
    transaction.withdrawal_account_name,
  ]
    .filter(Boolean)
    .join(" | ");

  return `
    <article class="transaction-item">
      <div>
        <h3>Withdrawal Request</h3>
        <p>${[transaction.network, transaction.status].filter(Boolean).join(" | ")}</p>
      </div>
      <div class="transaction-meta">
        <strong>${formatMoney(amount)}</strong>
        <span>${formatNaira(toNaira(amount))} | ${transaction.note || details || "No extra details"}</span>
      </div>
    </article>
  `;
}

function renderWithdrawHistory() {
  if (!withdrawHistory.length) {
    withdrawHistoryList.innerHTML = `<p class="empty-state">No withdrawal requests yet.</p>`;
    return;
  }

  const visibleItems = showAllWithdrawHistory ? withdrawHistory : withdrawHistory.slice(0, HISTORY_PREVIEW_COUNT);
  const showToggle = withdrawHistory.length > HISTORY_PREVIEW_COUNT;

  withdrawHistoryList.innerHTML = `
    ${visibleItems.map(withdrawalHistoryMarkup).join("")}
    ${
      showToggle
        ? `<button class="text-toggle-button" id="withdraw-history-toggle" type="button">${
            showAllWithdrawHistory ? "Show less" : "Show more"
          }</button>`
        : ""
    }
  `;

  document.getElementById("withdraw-history-toggle")?.addEventListener("click", () => {
    showAllWithdrawHistory = !showAllWithdrawHistory;
    renderWithdrawHistory();
  });
}

async function loadWithdrawHistory() {
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

  const transactions = await getTransactions(user.id);
  withdrawHistory = transactions.filter((transaction) => transaction.type === "withdrawal");
  renderWithdrawHistory();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!guardFirebase(statusElement)) {
    return;
  }

  const submitButton = form.querySelector("button[type=submit]");
  submitButton.disabled = true;
  setStatus(statusElement, "Submitting withdrawal request...", "default");

  try {
    const user = await getCurrentUser();

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    if (!user.email_confirmed_at) {
      throw new Error("Verify your email before making withdrawal requests.");
    }

    const profile = await getUserProfile(user);
    const amount = Number(withdrawAmount.value);

    if (!amount || amount <= 0) {
      throw new Error("Enter a valid withdrawal amount.");
    }

    if (amount > Number(profile.profits_balance || 0)) {
      throw new Error("Withdrawal amount cannot be more than your current profits balance.");
    }

    await createTransaction(user.id, {
      type: "withdrawal",
      amount,
      network: "Bank Transfer",
      note: `Naira equivalent: ${formatNaira(toNaira(amount))}. Rate: $1 = NGN ${CONVERSION_RATE.toLocaleString(
        "en-US"
      )}`,
      withdrawalBankName: document.getElementById("withdraw-bank-name").value.trim(),
      withdrawalAccountNumber: document.getElementById("withdraw-account-number").value.trim(),
      withdrawalAccountName: document.getElementById("withdraw-account-name").value.trim(),
    });

    form.reset();
    updateConversion();
    setStatus(statusElement, "Withdrawal request submitted successfully.", "success");
    await loadWithdrawHistory();
    submitButton.disabled = false;
  } catch (error) {
    setStatus(statusElement, error.message || "Could not submit the withdrawal request.", "error");
    submitButton.disabled = false;
  }
});

window.setTimeout(() => {
  loadWithdrawHistory().catch((error) => {
    withdrawHistoryList.innerHTML = `<p class="empty-state">${error.message || "Could not load withdrawal history."}</p>`;
  });
}, 0);
