import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { TaskProvider } from "@/contexts/TaskContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Auth } from "@/pages/Auth";
import { Onboarding } from "@/pages/Onboarding";
import { Dashboard } from "@/pages/Dashboard";
import { StudyPlan } from "@/pages/StudyPlan";
import { ConceptExplainer } from "@/pages/ConceptExplainer";
import { FocusZone } from "@/pages/FocusZone";
import { AICounselor } from "@/pages/AICounselor";
import { StudyTogether } from "@/pages/StudyTogether";
import Profile from "@/pages/Profile";
import Videos from "@/pages/Videos";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// Auth-required wrapper
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

// Redirect if already authenticated
const AuthRoute = () => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <Auth />;
};

// Wrapper component to handle home route logic inside Router context
const HomeRoute = () => {
  const { user } = useUser();
  
  if (user?.onboardingComplete) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Onboarding />;
};

// Wrapper component for protected routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  
  if (!user?.onboardingComplete) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/auth" element={<AuthRoute />} />
      <Route path="/" element={<RequireAuth><HomeRoute /></RequireAuth>} />
      <Route element={<RequireAuth><ProtectedRoute><AppLayout /></ProtectedRoute></RequireAuth>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/study-plan" element={<StudyPlan />} />
        <Route path="/learn" element={<ConceptExplainer />} />
        <Route path="/focus" element={<FocusZone />} />
        <Route path="/progress" element={<Dashboard />} />
        <Route path="/counselor" element={<AICounselor />} />
        <Route path="/study-together" element={<StudyTogether />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <LanguageProvider>
          <AuthProvider>
            <UserProvider>
              <TaskProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <AppRoutes />
                </TooltipProvider>
              </TaskProvider>
            </UserProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
