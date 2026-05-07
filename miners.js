import {
  MINER_PLANS,
  accrueMiningProfits,
  formatMoney,
  getCurrentUser,
  getMinerPurchases,
  getUserProfile,
  guardFirebase,
  purchaseMinerPlan,
  setStatus,
} from "./auth-helpers.js";

const statusElement = document.getElementById("miners-status");
const grid = document.getElementById("miner-plan-grid");

function planCardMarkup(plan, balance) {
  const canAfford = balance >= plan.cost;
  return `
    <article class="card-panel miner-plan-card">
      <div class="miner-level-badge">Level ${plan.level}</div>
      <h3>${plan.name}</h3>
      <p>${plan.description}</p>
      <dl class="plan-metrics">
        <div>
          <dt>Investment</dt>
          <dd>${formatMoney(plan.cost)}</dd>
        </div>
        <div>
          <dt>Total Return</dt>
          <dd>${formatMoney(plan.totalReturn)}</dd>
        </div>
        <div>
          <dt>Daily Profit</dt>
          <dd>${formatMoney(plan.dailyProfit)}</dd>
        </div>
        <div>
          <dt>Cycle</dt>
          <dd>30 Days</dd>
        </div>
      </dl>
      <button class="btn ${canAfford ? "btn-primary" : "btn-outline"} form-submit" data-level="${plan.level}" ${
        canAfford ? "" : "disabled"
      }>
        ${canAfford ? "Purchase Miner" : "Insufficient Balance"}
      </button>
    </article>
  `;
}

async function renderPlans() {
  grid.innerHTML = MINER_PLANS.map((plan) => planCardMarkup(plan, 0)).join("");
  setStatus(statusElement, "Loading your wallet balance and mining plans...", "default");

  const user = await getCurrentUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (!user.email_confirmed_at) {
    window.location.href = "account.html";
    return;
  }

  try {
    await accrueMiningProfits();
  } catch (error) {
    console.warn("Mining accrual failed:", error);
  }

  const profile = await getUserProfile(user);
  let purchases = [];
  let purchaseHistoryFailed = false;

  try {
    purchases = await getMinerPurchases(user.id);
  } catch (error) {
    purchaseHistoryFailed = true;
  }

  grid.innerHTML = MINER_PLANS.map((plan) => planCardMarkup(plan, Number(profile.capital_balance || 0))).join("");

  const activeCount = purchases.filter((purchase) => purchase.status === "active").length;
  setStatus(
    statusElement,
    purchaseHistoryFailed
      ? `Plans loaded with your available balance: ${formatMoney(profile.capital_balance || 0)}. Miner purchase history could not load; run the latest Supabase schema if this continues.`
      : `Capital balance (for purchase): ${formatMoney(profile.capital_balance || 0)} | Profits balance: ${formatMoney(profile.profits_balance || 0)} | Active miners: ${activeCount} | Every miner credits daily profit for 30 days.`,
    purchaseHistoryFailed ? "error" : "default"
  );

  grid.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", async () => {
      const level = Number(button.dataset.level);
      button.disabled = true;
      button.textContent = "Purchasing...";

      try {
        const currentUser = await getCurrentUser();

        if (!currentUser?.email_confirmed_at) {
          throw new Error("Verify your email before purchasing miners.");
        }

        await purchaseMinerPlan(level);
        setStatus(statusElement, `Level ${level} miner purchased successfully. Daily mining has started.`, "success");
        await renderPlans();
      } catch (error) {
        setStatus(statusElement, error.message || "Could not purchase the miner.", "error");
        button.disabled = false;
        button.textContent = "Purchase Miner";
      }
    });
  });
}

window.setTimeout(async () => {
  if (!guardFirebase(statusElement)) {
    grid.innerHTML = MINER_PLANS.map((plan) => planCardMarkup(plan, 0)).join("");
    return;
  }

  try {
    await renderPlans();
  } catch (error) {
    grid.innerHTML = MINER_PLANS.map((plan) => planCardMarkup(plan, 0)).join("");
    setStatus(
      statusElement,
      error.message || "Could not load your wallet balance. Mining plans are shown below, but purchases are disabled until the database responds.",
      "error"
    );
  }
}, 0);
