import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, useGetMe } from "@workspace/api-client-react";

export interface AuthUser {
  sub: string;
  name: string;
  avatar: string;
  type: "site" | "google";
  created: number;
  remainingPuzzles?: number | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoggedIn: boolean;
  setUser: (user: AuthUser) => void;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoggedIn: false,
  setUser: () => {},
  clearSession: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 30_000,
    },
  });
  const [user, setUserState] = useState<AuthUser | null>(null);

  useEffect(() => {
    localStorage.removeItem("spotjiggy_token");
  }, []);

  useEffect(() => {
    const status = (error as { status?: number } | null)?.status;
    if (status === 401) setUserState(null);
    else if (data) setUserState(data as AuthUser);
  }, [data, error]);

  const setUser = (authenticatedUser: AuthUser) => {
    setUserState(authenticatedUser);
    queryClient.setQueryData(getGetMeQueryKey(), authenticatedUser);
  };

  const clearSession = () => {
    setUserState(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, setUser, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
