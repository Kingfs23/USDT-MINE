import { appSettings, isSupabaseConfigured } from "./supabase-config.js";
import { supabase } from "./supabase-client.js";

export const CONVERSION_RATE = 1500;

export const MINER_PLANS = [
  {
    level: 1,
    name: "Level 1 Starter Miner",
    cost: 10,
    totalReturn: 50,
    description: "Entry miner with stable 30-day daily earnings for new users.",
  },
  {
    level: 2,
    name: "Level 2 Growth Miner",
    cost: 25,
    totalReturn: 150,
    description: "Mid-tier miner with higher daily mining rewards over 30 days.",
  },
  {
    level: 3,
    name: "Level 3 Turbo Miner",
    cost: 50,
    totalReturn: 350,
    description: "Fast-yield miner designed for stronger compounding returns.",
  },
  {
    level: 4,
    name: "Level 4 Elite Miner",
    cost: 100,
    totalReturn: 500,
    description: "Premium miner with large daily credits and bigger 30-day output.",
  },
  {
    level: 5,
    name: "Level 5 Titan Miner",
    cost: 200,
    totalReturn: 1000,
    description: "Top-tier machine with the strongest daily earnings target in the catalog.",
  },
].map((plan) => ({
  ...plan,
  dailyProfit: Number((plan.totalReturn / 30).toFixed(4)),
}));

export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{4,20}$/.test(username.trim());
}

export function setStatus(target, message, tone = "default") {
  if (!target) {
    return;
  }

  target.textContent = message;
  target.dataset.tone = tone;
}

export function guardFirebase(statusElement) {
  if (isSupabaseConfigured && supabase) {
    return true;
  }

  setStatus(
    statusElement,
    "Supabase is not configured yet. Add your project URL and anon key in supabase-config.js before using auth.",
    "error"
  );

  return false;
}

export async function enableSessionPersistence() {
  return;
}

export function buildContinueUrl(pathname, params = {}) {
  if (!window.location.origin.startsWith("http")) {
    return undefined;
  }

  const url = new URL(pathname, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

export function buildActionCodeSettings(pathname, params = {}) {
  const url = buildContinueUrl(pathname, params);

  if (!url) {
    return undefined;
  }

  return {
    url,
    handleCodeInApp: false,
  };
}

export async function lookupEmailForIdentifier(identifier) {
  const value = identifier.trim();

  if (!value) {
    throw new Error("Enter your username or email address.");
  }

  if (value.includes("@")) {
    return value;
  }

  const { data, error } = await supabase.rpc("lookup_login_email", {
    username_input: normalizeUsername(value),
  });

  if (error || !data) {
    throw new Error("No account was found for that username.");
  }

  return data;
}

export async function usernameExists(username) {
  const { data, error } = await supabase.rpc("username_exists", {
    username_input: normalizeUsername(username),
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function getUserProfile(user) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  if (error) {
    return fallbackUserProfile(user);
  }

  if (data) {
    return data;
  }

  const { data: repairedProfile, error: repairError } = await supabase.rpc("ensure_user_profile");

  if (repairError) {
    return fallbackUserProfile(user);
  }

  return repairedProfile;
}

function fallbackUserProfile(user) {
  return {
    id: user.id,
    user_id_display: "-",
    name: user.user_metadata?.name || "",
    username: user.user_metadata?.username || "-",
    email: user.email || "",
    capital_balance: 0,
    profits_balance: 0,
    total_deposited: 0,
    total_withdrawn: 0,
    account_status: "Active",
    created_at: user.created_at || new Date().toISOString(),
  };
}

export async function createTransaction(userId, payload) {
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    type: payload.type,
    amount: payload.amount,
    network: payload.network,
    note: payload.note ?? null,
    wallet_address: payload.walletAddress ?? null,
    sender_bank_name: payload.senderBankName ?? null,
    sender_account_number: payload.senderAccountNumber ?? null,
    sender_account_name: payload.senderAccountName ?? null,
    withdrawal_bank_name: payload.withdrawalBankName ?? null,
    withdrawal_account_number: payload.withdrawalAccountNumber ?? null,
    withdrawal_account_name: payload.withdrawalAccountName ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function purchaseMinerPlan(level) {
  const { error } = await supabase.rpc("purchase_miner_plan", {
    p_level: level,
  });

  if (error) {
    throw error;
  }
}

export async function accrueMiningProfits() {
  const { data, error } = await supabase.rpc("accrue_mining_profits");

  if (error) {
    throw error;
  }

  return Number(data || 0);
}

export async function getTransactions(userId) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getMinerPurchases(userId) {
  const { data, error } = await supabase
    .from("miner_purchases")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getMiningEarnings(userId) {
  const { data, error } = await supabase
    .from("mining_earnings")
    .select("*")
    .eq("user_id", userId)
    .order("earning_date", { ascending: false })
    .limit(40);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export function summarizeTransactions(profile, transactions) {
  let pendingDeposits = 0;
  let pendingWithdrawals = 0;

  transactions.forEach((transaction) => {
    const amount = Number(transaction.amount || 0);

    if (transaction.status !== "Pending") {
      return;
    }

    if (transaction.type === "deposit") {
      pendingDeposits += amount;
    }

    if (transaction.type === "withdrawal") {
      pendingWithdrawals += amount;
    }
  });

  const totalBalance = Number(profile.capital_balance || 0) + Number(profile.profits_balance || 0);

  return {
    capitalBalance: Number(profile.capital_balance || 0),
    profitsBalance: Number(profile.profits_balance || 0),
    totalBalance,
    totalDeposited: Number(profile.total_deposited || 0),
    totalWithdrawn: Number(profile.total_withdrawn || 0),
    pendingDeposits,
    pendingWithdrawals,
  };
}

export function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: appSettings.currency,
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function formatNaira(amount) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

export function toNaira(amount) {
  return Number(amount || 0) * CONVERSION_RATE;
}

export function getMinerPlan(level) {
  return MINER_PLANS.find((plan) => plan.level === Number(level));
}

export function friendlyAuthError(error) {
  const message = String(error?.message || "");

  if (message.includes("User already registered")) {
    return "That email is already registered.";
  }

  if (message.includes("Email not confirmed")) {
    return "Your email is not verified yet. Check your inbox or resend the verification email.";
  }

  if (message.includes("Invalid login credentials")) {
    return "The username/email or password is incorrect.";
  }

  if (message.includes("Password should be at least")) {
    return "Use a stronger password with at least 6 characters.";
  }

  if (message.includes("Unable to validate email address")) {
    return "Enter a valid email address.";
  }

  return message || "Something went wrong. Please try again.";
}

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

export async function resendVerificationEmail(email) {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: buildContinueUrl("/verify-email.html"),
    },
  });

  if (error) {
    throw error;
  }
}

export async function requestPasswordReset(identifier) {
  const email = await lookupEmailForIdentifier(identifier);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildContinueUrl("/update-password.html", { recovery: "1" }),
  });

  if (error) {
    throw error;
  }

  return email;
}

export async function signOutUser() {
  await supabase.auth.signOut();
}

// ============ ADMIN FUNCTIONS ============

export async function adminGetUserByDisplayId(displayId) {
  const { data, error } = await supabase.rpc("admin_get_user_by_display_id", {
    p_display_id: displayId,
  });

  if (error) {
    throw error;
  }

  return data && data.length > 0 ? data[0] : null;
}

export async function adminSearchUsers(search, limit = 50, offset = 0) {
  const { data, error } = await supabase.rpc("admin_search_users", {
    p_search: search,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function adminGetAllUsers(limit = 50, offset = 0) {
  const { data, error } = await supabase.rpc("admin_get_all_users", {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function adminUpdateBalance(userId, balanceType, amount) {
  const { error } = await supabase.rpc("admin_update_balance", {
    p_user_id: userId,
    p_balance_type: balanceType,
    p_amount: amount,
  });

  if (error) {
    throw error;
  }
}

export async function adminGetTransactions(type, status = null, limit = 100) {
  const { data, error } = await supabase.rpc("admin_get_transactions", {
    p_type: type,
    p_status: status,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function adminApproveTransaction(transactionId, note = "") {
  const { error } = await supabase.rpc("admin_approve_transaction", {
    p_transaction_id: transactionId,
    p_admin_note: note,
  });

  if (error) {
    throw error;
  }
}

export async function adminRejectTransaction(transactionId, note = "") {
  const { error } = await supabase.rpc("admin_reject_transaction", {
    p_transaction_id: transactionId,
    p_admin_note: note,
  });

  if (error) {
    throw error;
  }
}

export async function adminDeleteUser(userId) {
  const { error } = await supabase.rpc("admin_delete_user", {
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }
}
