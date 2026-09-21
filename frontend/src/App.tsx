import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";

function LoginRoute() {
  const navigate = useNavigate();
  return <Login onSuccess={() => navigate("/dashboard", { replace: true })} />;
}

function SignupRoute() {
  const navigate = useNavigate();
  return <Signup onSuccess={() => navigate("/dashboard", { replace: true })} />;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/signup" element={<SignupRoute />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
