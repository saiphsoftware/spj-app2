import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { BucketProvider } from "@/context/BucketContext";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import HomePage from "@/pages/HomePage";
import BucketPage from "@/pages/BucketPage";
import EditorPage from "@/pages/EditorPage";
import PlayPage from "@/pages/PlayPage";
import ProfilePage from "@/pages/ProfilePage";
import StorePage from "@/pages/StorePage";
import CheckoutPage from "@/pages/CheckoutPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/home" component={HomePage} />
      <Route path="/" component={HomePage} />
      <Route path="/bucket" component={BucketPage} />
      <Route path="/edit/:id" component={EditorPage} />
      <Route path="/play/:id" component={PlayPage} />
      <Route path="/profile/:uid" component={ProfilePage} />
      <Route path="/store/checkout" component={CheckoutPage} />
      <Route path="/store" component={StorePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BucketProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </BucketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
