import { friendlyAuthError, guardFirebase, requestPasswordReset, setStatus } from "./auth-helpers.js";

const form = document.getElementById("reset-form");
const statusElement = document.getElementById("reset-status");
const submitButton = document.getElementById("reset-submit");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!guardFirebase(statusElement)) {
    return;
  }

  submitButton.disabled = true;
  setStatus(statusElement, "Sending password reset email...", "default");

  try {
    const email = await requestPasswordReset(form.identifier.value);
    setStatus(statusElement, `Password reset email sent to ${email}.`, "success");
  } catch (error) {
    setStatus(statusElement, friendlyAuthError(error), "error");
  } finally {
    submitButton.disabled = false;
  }
});
