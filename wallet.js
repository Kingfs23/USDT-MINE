import {
  CONVERSION_RATE,
  accrueMiningProfits,
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

const walletStatus = document.getElementById("wallet-status");
const walletHistoryList = document.getElementById("wallet-history-list");
const depositForm = document.getElementById("deposit-form");
const withdrawForm = document.getElementById("withdraw-form");
const depositAmount = document.getElementById("deposit-amount");
const withdrawAmount = document.getElementById("withdraw-amount");
const depositNaira = document.getElementById("deposit-naira");
const withdrawNaira = document.getElementById("withdraw-naira");
const conversionRateText = document.getElementById("conversion-rate-text");

conversionRateText.textContent = `$1 = NGN ${CONVERSION_RATE.toLocaleString("en-US")}`;

function transactionMarkup(transaction) {
  const amount = Number(transaction.amount || 0);
  const nairaValue = formatNaira(toNaira(amount));
  const note = transaction.note || transaction.wallet_address || "No extra details";

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

function updateConversion(input, target) {
  const value = Number(input.value || 0);
  target.textContent = formatNaira(toNaira(value));
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

  await accrueMiningProfits();
  const [profile, transactions] = await Promise.all([getUserProfile(user), getTransactions(user.id)]);

  walletStatus.textContent = `Capital Balance (Deposit): ${formatMoney(
    profile.capital_balance || 0
  )} | Profits Balance (Withdrawal): ${formatMoney(profile.profits_balance || 0)} | Conversion rate: NGN ${CONVERSION_RATE.toLocaleString("en-US")} per $1`;
  walletStatus.dataset.tone = "default";

  if (!transactions.length) {
    walletHistoryList.innerHTML = `<p class="empty-state">No deposit or withdrawal requests yet.</p>`;
  } else {
    walletHistoryList.innerHTML = transactions.map(transactionMarkup).join("");
  }
}

depositAmount.addEventListener("input", () => updateConversion(depositAmount, depositNaira));
withdrawAmount.addEventListener("input", () => updateConversion(withdrawAmount, withdrawNaira));

depositForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!guardFirebase(walletStatus)) {
    return;
  }

  try {
    const user = await getCurrentUser();
    if (!user.email_confirmed_at) {
      throw new Error("Verify your email before making deposit requests.");
    }

    await createTransaction(user.id, {
      type: "deposit",
      amount: Number(depositAmount.value),
      network: document.getElementById("deposit-network").value,
      note: `${document.getElementById("deposit-note").value.trim()} | Naira equivalent: ${formatNaira(
        toNaira(depositAmount.value)
      )}`,
    });

    depositForm.reset();
    updateConversion(depositAmount, depositNaira);
    await renderWallet();
    setStatus(walletStatus, "Deposit request submitted successfully.", "success");
  } catch (error) {
    setStatus(walletStatus, error.message || "Could not submit the deposit request.", "error");
  }
});

withdrawForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!guardFirebase(walletStatus)) {
    return;
  }

  try {
    const user = await getCurrentUser();
    if (!user.email_confirmed_at) {
      throw new Error("Verify your email before making withdrawal requests.");
    }

    const profile = await getUserProfile(user);
    const amount = Number(withdrawAmount.value);

    if (amount > Number(profile.profits_balance || 0)) {
      throw new Error("Withdrawal amount cannot be more than your current profits balance. Mining profits can only be withdrawn.");
    }

    await createTransaction(user.id, {
      type: "withdrawal",
      amount,
      network: document.getElementById("withdraw-network").value,
      walletAddress: `${document.getElementById("wallet-address").value.trim()} | Naira equivalent: ${formatNaira(
        toNaira(amount)
      )}`,
    });

    withdrawForm.reset();
    updateConversion(withdrawAmount, withdrawNaira);
    await renderWallet();
    setStatus(walletStatus, "Withdrawal request submitted successfully.", "success");
  } catch (error) {
    setStatus(walletStatus, error.message || "Could not submit the withdrawal request.", "error");
  }
});

window.setTimeout(async () => {
  if (!guardFirebase(walletStatus)) {
    return;
  }

  await renderWallet();

  const params = new URLSearchParams(window.location.search);
  const action = params.get("action");

  if (action === "withdraw") {
    document.getElementById("withdraw-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}, 0);
