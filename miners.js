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
  showBrowserNotification,
  startUserNotifications,
} from "./auth-helpers.js";

const statusElement = document.getElementById("miners-status");
const grid = document.getElementById("miner-plan-grid");

function planCardMarkup(plan, balance) {
  const canAfford = balance >= plan.cost;
  return `
    <article class="card-panel miner-plan-card">
      <div class="miner-level-badge">Level ${plan.level}</div>
      <h3>${plan.name}</h3>
      <p>${formatMoney(plan.dailyProfit)} daily output.</p>
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
        ${canAfford ? "Activate Miner" : "Low Balance"}
      </button>
    </article>
  `;
}

async function renderPlans() {
  grid.innerHTML = MINER_PLANS.map((plan) => planCardMarkup(plan, 0)).join("");
  setStatus(statusElement, "Loading market...", "default");

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
      ? `Balance: ${formatMoney(profile.capital_balance || 0)}. History unavailable.`
      : `Capital: ${formatMoney(profile.capital_balance || 0)} | Profits: ${formatMoney(profile.profits_balance || 0)} | Active: ${activeCount}`,
    purchaseHistoryFailed ? "error" : "default"
  );

  grid.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", async () => {
      const level = Number(button.dataset.level);
      button.disabled = true;
      button.textContent = "Activating...";

      try {
        const currentUser = await getCurrentUser();

        if (!currentUser?.email_confirmed_at) {
          throw new Error("Verify your email before purchasing miners.");
        }

        await purchaseMinerPlan(level);
        setStatus(statusElement, `Level ${level} miner activated.`, "success");
        await showBrowserNotification("Miner activated", `Level ${level} miner is now producing daily profit.`);
        await renderPlans();
      } catch (error) {
        setStatus(statusElement, error.message || "Could not purchase the miner.", "error");
        button.disabled = false;
        button.textContent = "Activate Miner";
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
      error.message || "Market unavailable.",
      "error"
    );
  }
}, 0);
