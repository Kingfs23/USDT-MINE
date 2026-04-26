import { supabase } from "./supabase-client.js";
import {
  friendlyAuthError,
  getCurrentUser,
  guardFirebase,
  lookupEmailForIdentifier,
  setStatus,
} from "./auth-helpers.js";

const form = document.getElementById("login-form");
const identifierInput = document.getElementById("identifier");
const statusElement = document.getElementById("login-status");
const submitButton = document.getElementById("login-submit");

const params = new URLSearchParams(window.location.search);

if (params.get("email")) {
  identifierInput.value = params.get("email");
}

if (params.get("signup")) {
  setStatus(statusElement, "Signup complete. Verify your email, then log in.", "success");
}

if (params.get("verified")) {
  setStatus(statusElement, "Email verified successfully. You can log in now.", "success");
}

if (params.get("reset")) {
  setStatus(statusElement, "Password reset complete. Log in with your new password.", "success");
}

window.setTimeout(async () => {
  if (!guardFirebase(statusElement)) {
    return;
  }

  const user = await getCurrentUser();

  if (user) {
    window.location.href = "account.html";
  }
}, 0);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!guardFirebase(statusElement)) {
    return;
  }

  submitButton.disabled = true;
  setStatus(statusElement, "Signing you in...", "default");

  try {
    const password = form.password.value;
    const email = await lookupEmailForIdentifier(form.identifier.value);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    window.location.href = "account.html";
  } catch (error) {
    setStatus(statusElement, friendlyAuthError(error), "error");
  } finally {
    submitButton.disabled = false;
  }
});
