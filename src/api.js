import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("auth/login/") &&
      !originalRequest.url?.includes("auth/register/") &&
      !originalRequest.url?.includes("auth/refresh/")
    ) {
      originalRequest._retry = true;

      const refresh = localStorage.getItem("refresh");

      if (refresh) {
        try {
          const response = await axios.post(
            `${BASE_URL}auth/refresh/`,
            { refresh }
          );

          const newAccess = response.data.access;

          localStorage.setItem("access", newAccess);

          originalRequest.headers.Authorization =
            `Bearer ${newAccess}`;

          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem("access");
          localStorage.removeItem("refresh");
          localStorage.removeItem("user");

          document.cookie =
            "username=; Path=/; Max-Age=0; SameSite=Lax";

          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }

          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;