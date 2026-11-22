
import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate } from "react-router-dom";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import App from "./App";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import AdminPanel from "./pages/AdminPanel";
import TestPage from "./pages/TestPage";

function HomeRedirect() {
  const access = localStorage.getItem("access");
  const refresh = localStorage.getItem("refresh");

  return access || refresh
    ? <Navigate to="/dashboard" replace />
    : <App />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeRedirect />,
  },
  {
    path: "/reading/:testId/full",
    element: <TestPage />,
  },
  {
    path: "/reading/:testId/passage/:passageNumber",
    element: <TestPage />,
  },
    {
      path: "/admin",
      element: <Admin />,
    },
    {
      path: "/admin/panel",
      element: <AdminPanel />,
    },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
