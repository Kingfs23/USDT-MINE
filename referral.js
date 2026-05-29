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

let currentLink = "";

function referralMarkup(item) { 
  return `
    <article class="transaction-item">
      <div>
        <h3>${item.name || item.username || "New user"}</h3>
        <p>@${item.username || "-"} | ${item.status}</p>
      </div>
      <div class="transaction-meta">
        <strong>${formatMoney(item.bonus_amount || 0)}</strong>
        <span>${item.email || "Email hidden"} | ${new Date(item.created_at).toLocaleDateString("en-US")}</span>
      </div>
    </article>
  `;
}

async function renderReferralPage() {
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

  const [profile, referrals] = await Promise.all([getUserProfile(user), getUserReferrals()]);
  const code = profile.referral_code || profile.user_id_display || user.id.slice(0, 10).toUpperCase();
  const currentUrl = new URL(window.location.href);
  currentUrl.pathname = currentUrl.pathname.replace(/referral\.html$/, "signup.html");
  currentUrl.search = "";
  currentUrl.hash = "";
  currentUrl.searchParams.set("ref", code);
  currentLink = currentUrl.toString();

  referralLink.textContent = currentLink;
  referralLink.href = currentLink;
  referralLink.target = "_blank";
  referralLink.rel = "noopener noreferrer";
  referralCode.textContent = code;
  referralCount.textContent = String(referrals.length);
  referralEarned.textContent = formatMoney(profile.referral_bonus_total || referrals.length * 2);
  referralList.innerHTML = referrals.length
    ? referrals.map(referralMarkup).join("")
    : `<p class="empty-state">No referrals yet. Share your link to start earning capital balance.</p>`;

  setStatus(statusElement, "$2.00 referral bonuses are added to capital balance and can be used to purchase miners.", "default");
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
