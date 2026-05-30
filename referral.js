import {
  formatMoney,
  getCurrentUser,
  getUserProfile,
  getUserReferrals,
  guardFirebase,
  setStatus,
  startUserNotifications,
} from "./auth-helpers.js";

const statusElement = document.getElementById("referral-status");
const referralLink = document.getElementById("referral-link");
const referralCode = document.getElementById("referral-code");
const referralCount = document.getElementById("referral-count");
const referralEarned = document.getElementById("referral-earned");
const referralList = document.getElementById("referral-list");
const copyButton = document.getElementById("copy-referral-link");
const params = new URLSearchParams(window.location.search);
const inboundReferralCode = params.get("ref")?.trim().toUpperCase() || "";
const REFERRAL_PREVIEW_COUNT = 1;

let currentLink = "";
let referralItems = [];
let showAllReferralItems = false;

function buildSignupReferralUrl(code) {
  const signupUrl = new URL("signup.html", window.location.href);
  signupUrl.searchParams.set("ref", code);
  return signupUrl.toString();
}

function referralMarkup(item) { 
  const status = item.status || "Credited";
  const tone = String(status).toLowerCase();

  return `
    <article class="transaction-item">
      <div class="notification-main">
        <span class="notification-dot ${tone}"></span>
        <h3>${item.name || item.username || "New user"}</h3>
        <p>@${item.username || "-"}</p>
      </div>
      <div class="transaction-meta">
        <strong>${formatMoney(item.bonus_amount || 0)}</strong>
        <span>${status}</span>
      </div>
    </article>
  `;
}

function renderReferralList() {
  if (!referralItems.length) {
    referralList.innerHTML = `<p class="empty-state">No notifications.</p>`;
    return;
  }

  const visibleItems = showAllReferralItems ? referralItems : referralItems.slice(0, REFERRAL_PREVIEW_COUNT);
  const showToggle = referralItems.length > REFERRAL_PREVIEW_COUNT;

  referralList.innerHTML = `
    ${visibleItems.map(referralMarkup).join("")}
    ${
      showToggle
        ? `<button class="text-toggle-button" id="referral-list-toggle" type="button">${
            showAllReferralItems ? "Show less" : "Show more"
          }</button>`
        : ""
    }
  `;

  document.getElementById("referral-list-toggle")?.addEventListener("click", () => {
    showAllReferralItems = !showAllReferralItems;
    renderReferralList();
  });
}

async function renderReferralPage() {
  const user = await getCurrentUser();

  if (!user) {
    if (inboundReferralCode) {
      localStorage.setItem("usdt-mine-referral-code", inboundReferralCode);
      window.location.href = buildSignupReferralUrl(inboundReferralCode);
      return;
    }

    window.location.href = "login.html";
    return;
  }

  if (!user.email_confirmed_at) {
    window.location.href = "account.html";
    return;
  }

  startUserNotifications(user.id);

  const [profile, referrals] = await Promise.all([getUserProfile(user), getUserReferrals()]);
  const code = profile.referral_code || profile.user_id_display || user.id.slice(0, 10).toUpperCase();
  currentLink = buildSignupReferralUrl(code);

  referralLink.textContent = currentLink;
  referralLink.href = currentLink;
  referralLink.target = "_blank";
  referralLink.rel = "noopener noreferrer";
  referralCode.textContent = code;
  referralCount.textContent = String(referrals.length);
  referralEarned.textContent = formatMoney(profile.referral_bonus_total || referrals.length * 2);
  referralItems = referrals;
  showAllReferralItems = false;
  renderReferralList();

  setStatus(statusElement, "Online", "default");
}

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentLink);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy Link";
    }, 1200);
  } catch {
    setStatus(statusElement, "Could not copy automatically. Select the link and copy it manually.", "error");
  }
});

window.setTimeout(async () => {
  if (!guardFirebase(statusElement)) {
    return;
  }

  try {
    await renderReferralPage();
  } catch (error) {
    setStatus(statusElement, error.message || "Could not load referral information.", "error");
  }
}, 0);
