import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { CampaignsPage } from "@/pages/CampaignsPage";
import { LiveCallsPage } from "@/pages/LiveCallsPage";
import { ResultsPage } from "@/pages/ResultsPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { WhatsAppPage } from "@/pages/WhatsAppPage";
import { SettingsPage } from "@/pages/SettingsPage";

const App = () => (
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="campaigns" element={<CampaignsPage />} />
                <Route path="live" element={<LiveCallsPage />} />
                <Route path="results" element={<ResultsPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="whatsapp" element={<WhatsAppPage />} />
                <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </BrowserRouter>
);

export default App;
