import {
  CONVERSION_RATE,
  createTransaction,
  formatMoney,
  formatNaira,
  getCurrentUser,
  getTransactions,
  guardFirebase,
  setStatus,
  toNaira,
} from "./auth-helpers.js";

const HISTORY_PREVIEW_COUNT = 3;

const MERCHANT_BANK = {
  accountName: "USDT Mine",
  bankName: "Add your bank name in deposit.js",
  accountNumber: "0000000000",
};

const params = new URLSearchParams(window.location.search);
const initialAmount = Number(params.get("amount") || 0);

const form = document.getElementById("bank-deposit-form");
const amountInput = document.getElementById("deposit-amount");
const statusElement = document.getElementById("deposit-status");
const depositUsd = document.getElementById("deposit-usd");
const depositNgn = document.getElementById("deposit-ngn");
const depositRate = document.getElementById("deposit-rate");
const merchantAccountName = document.getElementById("merchant-account-name");
const merchantBankName = document.getElementById("merchant-bank-name");
const merchantAccountNumber = document.getElementById("merchant-account-number");
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
merchantAccountName.textContent = MERCHANT_BANK.accountName;
merchantBankName.textContent = `Bank name: ${MERCHANT_BANK.bankName}`;
merchantAccountNumber.textContent = `Account number: ${MERCHANT_BANK.accountNumber}`;
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

  const submitButton = form.querySelector("button[type=submit]");
  submitButton.disabled = true;
  setStatus(statusElement, "Submitting deposit request...", "default");

  try {
    const user = await getCurrentUser();

    if (!user) {
      window.location.href = "login.html";
      return;
    }

    if (!user.email_confirmed_at) {
      throw new Error("Verify your email before making deposit requests.");
    }

    await createTransaction(user.id, {
      type: "deposit",
      amount,
      network: "Bank Transfer",
      note: document.getElementById("deposit-note").value.trim(),
      senderBankName: document.getElementById("sender-bank-name").value.trim(),
      senderAccountNumber: document.getElementById("sender-account-number").value.trim(),
      senderAccountName: document.getElementById("sender-account-name").value.trim(),
    });

    form.reset();
    updateAmountDisplay();
    setStatus(statusElement, "Deposit submitted. Your balance will update after admin approval.", "success");
    await loadDepositHistory();
    submitButton.disabled = false;
  } catch (error) {
    setStatus(statusElement, error.message || "Could not submit this deposit.", "error");
    submitButton.disabled = false;
  }
});

window.setTimeout(() => {
  loadDepositHistory().catch((error) => {
    depositHistoryList.innerHTML = `<p class="empty-state">${error.message || "Could not load deposit history."}</p>`;
  });
}, 0);
