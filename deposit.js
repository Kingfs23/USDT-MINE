import {
  CONVERSION_RATE,
  createTransaction,
  formatMoney,
  formatNaira,
  getCurrentUser,
  guardFirebase,
  setStatus,
  toNaira,
} from "./auth-helpers.js";

const MERCHANT_BANK = {
  accountName: "USDT Mine",
  bankName: "Add your bank name in deposit.js",
  accountNumber: "0000000000",
};

const params = new URLSearchParams(window.location.search);
const amount = Number(params.get("amount") || 0);

const form = document.getElementById("bank-deposit-form");
const statusElement = document.getElementById("deposit-status");
const depositUsd = document.getElementById("deposit-usd");
const depositNgn = document.getElementById("deposit-ngn");
const depositRate = document.getElementById("deposit-rate");
const merchantAccountName = document.getElementById("merchant-account-name");
const merchantBankName = document.getElementById("merchant-bank-name");
const merchantAccountNumber = document.getElementById("merchant-account-number");

depositUsd.textContent = formatMoney(amount);
depositNgn.textContent = formatNaira(toNaira(amount));
depositRate.textContent = `$1 = NGN ${CONVERSION_RATE.toLocaleString("en-US")}`;
merchantAccountName.textContent = MERCHANT_BANK.accountName;
merchantBankName.textContent = `Bank name: ${MERCHANT_BANK.bankName}`;
merchantAccountNumber.textContent = `Account number: ${MERCHANT_BANK.accountNumber}`;

if (!amount || amount <= 0) {
  setStatus(statusElement, "Go back to the wallet page and enter a valid deposit amount first.", "error");
  form.querySelector("button[type=submit]").disabled = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!guardFirebase(statusElement)) {
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
    setStatus(statusElement, "Deposit submitted. Your balance will update after admin approval.", "success");
    window.setTimeout(() => {
      window.location.href = "wallet.html";
    }, 1400);
  } catch (error) {
    setStatus(statusElement, error.message || "Could not submit this deposit.", "error");
    submitButton.disabled = false;
  }
});
