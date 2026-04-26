import { supabase } from "./supabase-client.js";
import { friendlyAuthError, guardFirebase, setStatus, signOutUser } from "./auth-helpers.js";

const form = document.getElementById("update-password-form");
const statusElement = document.getElementById("update-password-status");
const submitButton = document.getElementById("update-password-submit");

let canResetPassword = false;

function activateRecoveryMode() {
  canResetPassword = true;
  setStatus(statusElement, "Recovery session detected. Enter your new password.", "success");
}

if (guardFirebase(statusElement)) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      activateRecoveryMode();
    }
  });

  window.setTimeout(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      activateRecoveryMode();
    }
  }, 400);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!guardFirebase(statusElement)) {
    return;
  }

  if (!canResetPassword) {
    setStatus(statusElement, "Open this page from the password reset email link.", "error");
    return;
  }

  const password = form.password.value;

  if (password.length < 6) {
    setStatus(statusElement, "Password must be at least 6 characters long.", "error");
    return;
  }

  submitButton.disabled = true;
  setStatus(statusElement, "Updating password...", "default");

  try {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      throw error;
    }

    await signOutUser();
    setStatus(statusElement, "Password updated successfully. Redirecting to login...", "success");
    window.setTimeout(() => {
      window.location.href = "login.html?reset=1";
    }, 1200);
  } catch (error) {
    setStatus(statusElement, friendlyAuthError(error), "error");
  } finally {
    submitButton.disabled = false;
  }
});
