import {
  createTransaction,
  formatMoney,
  formatNaira,
  getCurrentUser,
  guardFirebase,
  setStatus,
  toNaira,
} from "./auth-helpers.js";

const DEPOSIT_DRAFT_KEY = "usdt-mine-deposit-draft";

const MERCHANT_BANK = {
  accountName: "USDT Mine",
  bankName: "Add your bank name in deposit-transfer.js",
  accountNumber: "0000000000",
};

const statusElement = document.getElementById("transfer-status");
const confirmButton = document.getElementById("confirm-transfer");
const copyButton = document.getElementById("copy-account-number");
const transferNgn = document.getElementById("transfer-ngn");
const transferUsd = document.getElementById("transfer-usd");
const merchantAccountNumber = document.getElementById("merchant-account-number");
const merchantBankName = document.getElementById("merchant-bank-name");
const merchantAccountName = document.getElementById("merchant-account-name");
const senderSummary = document.getElementById("sender-summary");

function getDraft() {
  try {
    return JSON.parse(sessionStorage.getItem(DEPOSIT_DRAFT_KEY) || "null");
  } catch {
    return null;
  }
}

const draft = getDraft();

if (!draft?.amount) {
  setStatus(statusElement, "No deposit details found. Start from the deposit page.", "error");
  confirmButton.disabled = true;
} else {
  transferNgn.textContent = formatNaira(toNaira(draft.amount));
  transferUsd.textContent = formatMoney(draft.amount);
  merchantAccountNumber.textContent = MERCHANT_BANK.accountNumber;
  merchantBankName.textContent = MERCHANT_BANK.bankName;
  merchantAccountName.textContent = MERCHANT_BANK.accountName;
  senderSummary.textContent = [draft.senderBankName, draft.senderAccountNumber, draft.senderAccountName]
    .filter(Boolean)
    .join(" | ");
}

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(MERCHANT_BANK.accountNumber);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 1200);
  } catch {
    setStatus(statusElement, "Could not copy account number. Select and copy it manually.", "error");
  }
});

confirmButton.addEventListener("click", async () => {
  if (!guardFirebase(statusElement)) {
    return;
  }

  if (!draft?.amount) {
    setStatus(statusElement, "No deposit details found. Start from the deposit page.", "error");
    return;
  }

  confirmButton.disabled = true;
  setStatus(statusElement, "Submitting deposit for admin approval...", "default");

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
      amount: Number(draft.amount),
      network: "Bank Transfer",
      note: draft.note,
      senderBankName: draft.senderBankName,
      senderAccountNumber: draft.senderAccountNumber,
      senderAccountName: draft.senderAccountName,
    });

    sessionStorage.removeItem(DEPOSIT_DRAFT_KEY);
    setStatus(statusElement, "Deposit submitted. Your balance will update after admin approval.", "success");
    window.setTimeout(() => {
      window.location.href = "wallet.html";
    }, 1400);
  } catch (error) {
    setStatus(statusElement, error.message || "Could not submit this deposit.", "error");
    confirmButton.disabled = false;
  }
});
