import { supabase } from "./supabase-client.js";
import {
  friendlyAuthError,
  getCurrentUser,
  guardFirebase,
  lookupEmailForIdentifier,
  resendVerificationEmail,
  setStatus,
} from "./auth-helpers.js";

const form = document.getElementById("login-form");
const identifierInput = document.getElementById("identifier");
const statusElement = document.getElementById("login-status");
const submitButton = document.getElementById("login-submit");
const resendVerificationButton = document.getElementById("resend-verification");
let pendingVerificationEmail = "";

const params = new URLSearchParams(window.location.search);

if (params.get("email")) {
  identifierInput.value = params.get("email");
}

if (params.get("signup")) {
  setStatus(statusElement, "Signup complete. Verify your email, then log in.", "success");
  pendingVerificationEmail = params.get("email") || "";
  resendVerificationButton.classList.remove("hidden");
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

  try {
    const user = await getCurrentUser();

    if (user?.email_confirmed_at) {
      window.location.href = "account.html";
      return;
    }

    if (user && !user.email_confirmed_at) {
      pendingVerificationEmail = user.email || pendingVerificationEmail;
      await supabase.auth.signOut();
      resendVerificationButton.classList.remove("hidden");
      setStatus(statusElement, "Your email is not verified yet. Check your inbox or resend the verification email.", "error");
    }
  } catch (error) {
    await supabase.auth.signOut();
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
    const {
      data: { user },
      error,
    } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (!user?.email_confirmed_at) {
      await supabase.auth.signOut();
      pendingVerificationEmail = email;
      resendVerificationButton.classList.remove("hidden");
      throw new Error("Your email is not verified yet. Check your inbox for the verification link before logging in.");
    }

    window.location.href = "account.html";
  } catch (error) {
    setStatus(statusElement, friendlyAuthError(error), "error");
  } finally {
    submitButton.disabled = false;
  }
});

resendVerificationButton.addEventListener("click", async () => {
  if (!guardFirebase(statusElement)) {
    return;
  }

  resendVerificationButton.disabled = true;
  setStatus(statusElement, "Sending verification email...", "default");

  try {
    const email = pendingVerificationEmail || (await lookupEmailForIdentifier(form.identifier.value));
    await resendVerificationEmail(email);
    pendingVerificationEmail = email;
    setStatus(statusElement, `Verification email sent to ${email}.`, "success");
  } catch (error) {
    setStatus(statusElement, friendlyAuthError(error), "error");
  } finally {
    resendVerificationButton.disabled = false;
  }
});
