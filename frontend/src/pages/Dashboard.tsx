import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2 m-0">Dashboard</h1>
        <button type="button" className="btn btn-outline-secondary" onClick={handleLogout}>
          Log out
        </button>
      </div>
      <p>Signed in as {user?.name} ({user?.email}).</p>
    </div>
  );
}

export default Dashboard;
