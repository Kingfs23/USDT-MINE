import { supabase } from "./supabase-client.js";
import {
  buildContinueUrl,
  friendlyAuthError,
  guardFirebase,
  isValidUsername,
  setStatus,
  usernameExists,
} from "./auth-helpers.js";

const form = document.getElementById("signup-form");
const statusElement = document.getElementById("signup-status");
const submitButton = document.getElementById("signup-submit");
const emailInput = document.getElementById("email");

const params = new URLSearchParams(window.location.search);
const prefillsEmail = params.get("email");

if (prefillsEmail) {
  emailInput.value = prefillsEmail;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!guardFirebase(statusElement)) {
    return;
  }

  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (name.length < 2) {
    setStatus(statusElement, "Enter your full name.", "error");
    return;
  }

  if (!isValidUsername(username)) {
    setStatus(
      statusElement,
      "Username must be 4-20 characters and can only contain letters, numbers, and underscores.",
      "error"
    );
    return;
  }

  if (password.length < 6) {
    setStatus(statusElement, "Password must be at least 6 characters long.", "error");
    return;
  }

  submitButton.disabled = true;
  setStatus(statusElement, "Creating your account...", "default");

  try {
    if (await usernameExists(username)) {
      throw new Error("That username is already taken.");
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          username,
        },
        emailRedirectTo: buildContinueUrl("/verify-email.html"),
      },
    });

    if (error) {
      throw error;
    }

    await supabase.auth.signOut();

    setStatus(
      statusElement,
      "Account created. Check your email for the verification link, then log in.",
      "success"
    );

    window.setTimeout(() => {
      window.location.href = `login.html?signup=1&email=${encodeURIComponent(email)}`;
    }, 1400);
  } catch (error) {
    setStatus(statusElement, friendlyAuthError(error), "error");
  } finally {
    submitButton.disabled = false;
  }
});
