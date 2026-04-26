const emailInput = document.getElementById("email");
const statusMessage = document.getElementById("status-message");
const authPanel = document.getElementById("auth-panel");
const authSubmit = document.getElementById("auth-submit");
const actionButtons = document.querySelectorAll("[data-auth-action]");

let currentAction = "signup";

function setMessage(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "rgba(255, 154, 154, 0.92)" : "rgba(206, 247, 219, 0.82)";
}

function setCurrentAction(action) {
  currentAction = action;
  authSubmit.textContent = action === "signup" ? "Create" : "Login";
  emailInput.placeholder =
    action === "signup" ? "Enter email to create account" : "Enter email or username to login";
}

function goToAuthPage(action, value = "") {
  const target = action === "signup" ? "signup.html" : "login.html";
  const url = new URL(target, window.location.href);

  if (value && value.includes("@")) {
    url.searchParams.set("email", value);
  }

  window.location.href = url.toString();
}

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setCurrentAction(button.dataset.authAction);
    goToAuthPage(button.dataset.authAction, emailInput.value.trim());
  });
});

authPanel.addEventListener("submit", (event) => {
  event.preventDefault();

  const value = emailInput.value.trim();

  if (!value) {
    setMessage("Please enter your email address to continue.", true);
    emailInput.focus();
    return;
  }

  goToAuthPage(currentAction, value);
});

setMessage("Auth pages are ready. Sign up to create an account or log in to open the dashboard.");
