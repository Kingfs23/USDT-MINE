import {
  accrueMiningProfits,
  formatMoney,
  getCurrentUser,
  getMinerPlan,
  getMinerPurchases,
  getMiningEarnings,
  guardFirebase,
  setStatus,
} from "./auth-helpers.js";

const EARNINGS_PREVIEW_COUNT = 3;

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
      <div>
        <h3>Daily Mining Credit</h3>
        <p>${formatDateLabel(earning.earning_date)}</p>
      </div>
      <div class="transaction-meta">
        <strong>${formatMoney(earning.amount)}</strong>
        <span>Credited from an active miner</span>
      </div>
    </article>
  `;
}

function renderEarningsHistory() {
  if (!earningsHistory.length) {
    earningsHistoryList.innerHTML = `<p class="empty-state">No daily mining earnings yet. Purchase a miner to start the 30-day cycle.</p>`;
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
          <p>${plan?.description || "30-day mining machine with daily profit."}</p>
        </div>
        <strong>${formatMoney(purchase.daily_profit)}/day</strong>
      </div>

      <div class="machine-visual">
        <span class="machine-scan"></span>
        <span class="machine-orbit orbit-one"></span>
        <span class="machine-orbit orbit-two"></span>
        <div class="machine-core">
          <span class="core-glow"></span>
          <span class="fan fan-left"></span>
          <span class="fan fan-right"></span>
          <span class="chip-matrix">
            <i></i><i></i><i></i><i></i><i></i><i></i>
          </span>
          <span class="hash-stream hash-one"></span>
          <span class="hash-stream hash-two"></span>
          <span class="hash-stream hash-three"></span>
          <span class="signal signal-one"></span>
          <span class="signal signal-two"></span>
          <span class="signal signal-three"></span>
        </div>
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
        <p>Open the mining page to purchase a Level 1-5 miner and start daily profit generation.</p>
        <a class="btn btn-primary" href="miners.html">Go to Mining Page</a>
      </section>
    `;
  } else {
    myMinersGrid.innerHTML = purchases.map(minerCardMarkup).join("");
  }

  setStatus(
    statusElement,
    "Active miners credit daily profit across the 30-day cycle until each machine reaches its target return.",
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
        <p>Check that the Supabase schema has been run and then refresh this page.</p>
      </section>
    `;
    earningsHistoryList.innerHTML = `<p class="empty-state">No earnings could be loaded right now.</p>`;
  }
}, 0);
