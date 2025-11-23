import { useState } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return isLoggedIn ? (
    <Dashboard onLogout={() => setIsLoggedIn(false)} />
  ) : (
    <Login onLogin={() => setIsLoggedIn(true)} />
  );
};

export default Index;
