import {
  accrueMiningProfits,
  formatMoney,
  getCurrentUser,
  getMinerPlan,
  getMinerPurchases,
  getMiningEarnings,
  guardFirebase,
  setStatus,
  startUserNotifications,
} from "./auth-helpers.js";

const EARNINGS_PREVIEW_COUNT = 1;

const statusElement = document.getElementById("my-miners-status");
const earningsHistoryList = document.getElementById("earnings-history-list");
const myMinersGrid = document.getElementById("my-miners-grid");
const todayEarnings = document.getElementById("today-earnings");
const totalEarnings = document.getElementById("total-earnings");
const activeMachines = document.getElementById("active-machines");
let earningsHistory = [];
let showAllEarningsHistory = false;

function formatDateLabel(value) {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function earningsMarkup(earning) {
  return `
    <article class="transaction-item">
      <div class="notification-main">
        <span class="notification-dot credited"></span>
        <h3>Mining Credit</h3>
        <p>${formatDateLabel(earning.earning_date)}</p>
      </div>
      <div class="transaction-meta">
        <strong>${formatMoney(earning.amount)}</strong>
        <span>Credited</span>
      </div>
    </article>
  `;
}

function renderEarningsHistory() {
  if (!earningsHistory.length) {
    earningsHistoryList.innerHTML = `<p class="empty-state">No notifications.</p>`;
    return;
  }

  const visibleItems = showAllEarningsHistory
    ? earningsHistory
    : earningsHistory.slice(0, EARNINGS_PREVIEW_COUNT);
  const showToggle = earningsHistory.length > EARNINGS_PREVIEW_COUNT;

  earningsHistoryList.innerHTML = `
    ${visibleItems.map(earningsMarkup).join("")}
    ${
      showToggle
        ? `<button class="text-toggle-button" id="earnings-history-toggle" type="button">${
            showAllEarningsHistory ? "Show less" : "Show more"
          }</button>`
        : ""
    }
  `;

  document.getElementById("earnings-history-toggle")?.addEventListener("click", () => {
    showAllEarningsHistory = !showAllEarningsHistory;
    renderEarningsHistory();
  });
}

function minerCardMarkup(purchase) {
  const plan = getMinerPlan(purchase.level);
  const progress = Math.min((Number(purchase.accrued_days || 0) / 30) * 100, 100);

  return `
    <article class="card-panel miner-machine-card ${purchase.status === "completed" ? "is-complete" : ""}">
      <div class="machine-top">
        <div>
          <span class="miner-level-badge">Level ${purchase.level}</span>
          <h3>${purchase.machine_name}</h3>
          <p>${plan ? formatMoney(plan.dailyProfit) : formatMoney(purchase.daily_profit)} daily output.</p>
        </div>
        <strong>${formatMoney(purchase.daily_profit)}/day</strong>
      </div>

      <div class="machine-visual">
        <span class="machine-scan"></span>
        <span class="machine-gridline gridline-one"></span>
        <span class="machine-gridline gridline-two"></span>
        <span class="machine-pulse pulse-one"></span>
        <span class="machine-pulse pulse-two"></span>
        <div class="mining-rig">
          <div class="rig-header">
            <span></span><span></span><span></span>
          </div>
          <div class="rig-screen">
            <span class="hash-readout">HASH RATE</span>
            <strong>${(Number(purchase.daily_profit || 0) * 418).toFixed(0)} TH/s</strong>
            <i></i>
          </div>
          <div class="gpu-row">
            <span class="gpu-card"><i></i><b></b></span>
            <span class="gpu-card"><i></i><b></b></span>
            <span class="gpu-card"><i></i><b></b></span>
            <span class="gpu-card"><i></i><b></b></span>
          </div>
          <div class="cooling-row">
            <span class="fan fan-left"></span>
            <span class="power-core"></span>
            <span class="fan fan-right"></span>
          </div>
          <span class="data-lane lane-one"></span>
          <span class="data-lane lane-two"></span>
          <span class="thermal-wave"></span>
        </div>
        <div class="energy-stack">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <span class="machine-spark spark-one"></span>
        <span class="machine-spark spark-two"></span>
        <span class="machine-spark spark-three"></span>
      </div>

      <div class="machine-progress">
        <div class="machine-progress-bar">
          <span style="width: ${progress}%"></span>
        </div>
        <div class="machine-progress-meta">
          <span>${purchase.accrued_days}/30 days mined</span>
          <span>${formatMoney(purchase.accrued_profit)} earned</span>
        </div>
      </div>

      <dl class="plan-metrics compact">
        <div>
          <dt>Cost</dt>
          <dd>${formatMoney(purchase.cost)}</dd>
        </div>
        <div>
          <dt>Total Target</dt>
          <dd>${formatMoney(purchase.total_return)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>${purchase.status}</dd>
        </div>
        <div>
          <dt>Started</dt>
          <dd>${formatDateLabel(purchase.started_on)}</dd>
        </div>
      </dl>
    </article>
  `;
}

async function renderMyMiners() {
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
  await accrueMiningProfits();
  const [purchases, earnings] = await Promise.all([getMinerPurchases(user.id), getMiningEarnings(user.id)]);

  const activeCount = purchases.filter((purchase) => purchase.status === "active").length;
  const totalEarned = purchases.reduce((sum, purchase) => sum + Number(purchase.accrued_profit || 0), 0);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCredit = earnings
    .filter((earning) => earning.earning_date === todayKey)
    .reduce((sum, earning) => sum + Number(earning.amount || 0), 0);

  todayEarnings.textContent = formatMoney(todayCredit);
  totalEarnings.textContent = formatMoney(totalEarned);
  activeMachines.textContent = String(activeCount);

  earningsHistory = earnings;
  showAllEarningsHistory = false;
  renderEarningsHistory();

  if (!purchases.length) {
    myMinersGrid.innerHTML = `
      <section class="card-panel miner-empty-card">
        <h3>No miners purchased yet</h3>
        <p>Activate a miner to begin.</p>
        <a class="btn btn-primary" href="miners.html">Open Mining</a>
      </section>
    `;
  } else {
    myMinersGrid.innerHTML = purchases.map(minerCardMarkup).join("");
  }

  setStatus(
    statusElement,
    "Online",
    "default"
  );
}

window.setTimeout(async () => {
  if (!guardFirebase(statusElement)) {
    return;
  }

  try {
    await renderMyMiners();
  } catch (error) {
    setStatus(statusElement, error.message || "Could not load your mining information.", "error");
    myMinersGrid.innerHTML = `
      <section class="card-panel miner-empty-card">
        <h3>Mining data could not load</h3>
        <p>Refresh and try again.</p>
      </section>
    `;
    earningsHistoryList.innerHTML = `<p class="empty-state">Unavailable.</p>`;
  }
}, 0);
