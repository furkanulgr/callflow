import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/layout/Layout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CampaignsPage } from "@/pages/CampaignsPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { LiveCallsPage } from "@/pages/LiveCallsPage";
import { ResultsPage } from "@/pages/ResultsPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { WhatsAppPage } from "@/pages/WhatsAppPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { LiveTestPage } from "@/pages/LiveTestPage";
import { UsagePage } from "@/pages/UsagePage";

const App = () => (
    <BrowserRouter>
        <AuthProvider>
            <Routes>
                {/* Public */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/test" element={<LiveTestPage />} />

                {/* Protected */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<DashboardPage />} />
                        <Route path="agents" element={<AgentsPage />} />
                        <Route path="campaigns" element={<CampaignsPage />} />
                        <Route path="live" element={<LiveCallsPage />} />
                        <Route path="results" element={<ResultsPage />} />
                        <Route path="calendar" element={<CalendarPage />} />
                        <Route path="whatsapp" element={<WhatsAppPage />} />
                        <Route path="usage" element={<UsagePage />} />
                        <Route path="settings" element={<SettingsPage />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AuthProvider>
    </BrowserRouter>
);

export default App;
