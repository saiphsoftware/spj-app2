import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthContextValue {
  token: string | null;
  setToken: (token: string | null) => void;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  setToken: () => {},
  isLoggedIn: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("spotjiggy_token"));

  const setToken = (t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem("spotjiggy_token", t);
    else localStorage.removeItem("spotjiggy_token");
  };

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, setToken, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
