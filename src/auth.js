
export function saveAuth(tokens, user) {
  localStorage.setItem("access", tokens.access);
  localStorage.setItem("refresh", tokens.refresh);
  localStorage.setItem("user", JSON.stringify(user));

  // Cookie ichida faqat username saqlaymiz.
  // Parolni cookie yoki localStorage ichida saqlamang.
  document.cookie =
    `username=${encodeURIComponent(user.username)}; Path=/; Max-Age=604800; SameSite=Lax`;
}

export function clearAuth() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("user");

  document.cookie =
    "username=; Path=/; Max-Age=0; SameSite=Lax";
}
