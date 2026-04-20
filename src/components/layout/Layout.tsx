import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
    LayoutDashboard, Radio, ListChecks,
    CalendarDays, MessageSquare, Settings, ChevronLeft,
    ChevronRight, Menu, Bell, X, BrainCircuit, BarChart3,
    ArrowUpRight,
} from "lucide-react";
import { cn } from "@/utils/cn";

/* ── Nav items ────────────────────────────────────────────── */
const navItems = [
    { to: "/",          icon: LayoutDashboard, label: "Dashboard",     end: true },
    { to: "/agents",    icon: BrainCircuit,    label: "AI Asistanlar"  },
    { to: "/campaigns", icon: Radio,           label: "Kampanyalar"    },
    { to: "/results",   icon: ListChecks,      label: "Sonuçlar"       },
    { to: "/calendar",  icon: CalendarDays,    label: "Takvim"         },
    { to: "/whatsapp",  icon: MessageSquare,   label: "WhatsApp"       },
    // { to: "/usage",     icon: BarChart3,       label: "Kullanım"       },
];

/* ══════════════════════════════════════════════════════════════ */
export const Layout = () => {
    const [collapsed, setCollapsed]   = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    return (
        <div className="min-h-screen bg-background">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100">
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="font-bold text-lg text-gray-900">LUERA CallFlow</span>
                </div>
            </div>

            {/* Mobile Backdrop */}
            {mobileOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)} />
            )}

            {/* ── SIDEBAR ── */}
            <aside className={cn(
                "fixed top-0 bottom-0 bg-white/80 backdrop-blur-xl border-r border-gray-100 z-50 transition-all duration-300 ease-in-out",
                "md:translate-x-0",
                mobileOpen ? "translate-x-0 w-64 left-0" : "-translate-x-full left-0",
                "md:left-0",
                collapsed ? "md:w-20" : "md:w-64"
            )}>
                {/* ── Logo ── */}
                <div className="relative p-5 border-b border-gray-100">
                    <div className={cn("flex items-center justify-between", collapsed && "md:justify-center")}>
                        {(!collapsed || mobileOpen) && (
                            <div className="flex items-baseline gap-2">
                                <h1 className="text-2xl font-bold text-gray-900">LUERA</h1>
                                <span className="text-sm font-medium text-gray-400">CallFlow</span>
                            </div>
                        )}
                        {collapsed && !mobileOpen && (
                            <span className="text-2xl font-bold text-gray-900">L</span>
                        )}

                        {/* Mobile Close */}
                        <button onClick={() => setMobileOpen(false)} className="md:hidden p-1 rounded-lg hover:bg-gray-100 text-gray-500">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Desktop Collapse Toggle */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={cn(
                            "absolute -right-3 top-6 w-6 h-6 rounded-full",
                            "bg-white border border-gray-200 shadow-sm",
                            "hidden md:flex items-center justify-center",
                            "hover:bg-gray-50 transition-colors text-gray-400 hover:text-gray-600"
                        )}
                    >
                        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-3 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <NavLink key={item.to} to={item.to} end={item.end}
                                className={({ isActive }) => cn(
                                    "relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                                    collapsed && !mobileOpen ? "justify-center px-3" : "",
                                    isActive
                                        ? "bg-[#CCFF00]/10 text-gray-900 font-medium"
                                        : "text-gray-500 hover:bg-gray-100/80 hover:text-gray-900"
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#CCFF00] rounded-r-full" />
                                        )}
                                        <Icon size={20} className={cn(isActive && "text-gray-900")} />
                                        {(!collapsed || mobileOpen) && <span>{item.label}</span>}
                                    </>
                                )}
                            </NavLink>
                        );
                    })}

                    {/* Divider + Settings */}
                    <div className="pt-4 mt-4 border-t border-gray-100">
                        <NavLink to="/settings"
                            className={({ isActive }) => cn(
                                "relative w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                                collapsed && !mobileOpen ? "justify-center px-3" : "",
                                isActive
                                    ? "bg-[#CCFF00]/10 text-gray-900 font-medium"
                                    : "text-gray-500 hover:bg-gray-100/80 hover:text-gray-900"
                            )}
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#CCFF00] rounded-r-full" />}
                                    <Settings size={20} />
                                    {(!collapsed || mobileOpen) && <span>Ayarlar</span>}
                                </>
                            )}
                        </NavLink>
                    </div>
                </nav>

                {/* User Profile */}
                <div className="absolute bottom-0 w-full p-4 border-t border-gray-100 bg-white/50">

                    {/* LeadFlow Button */}
                    <a
                        href="http://localhost:5174"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                            "flex items-center gap-2 mb-3 px-2 py-1.5 rounded-xl",
                            "hover:bg-gray-100 transition-all duration-200 group",
                            collapsed && !mobileOpen ? "justify-center" : ""
                        )}
                    >
                        <div className={cn("flex items-baseline gap-2 flex-1", collapsed && !mobileOpen && "flex-none")}>
                            <span className="text-2xl font-bold text-gray-900">LUERA</span>
                            {(!collapsed || mobileOpen) && (
                                <span className="text-sm font-medium text-gray-400 group-hover:text-gray-600 transition-colors">LeadFlow</span>
                            )}
                        </div>
                        {(!collapsed || mobileOpen) && (
                            <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                        )}
                    </a>

                    <div className={cn(
                        "flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer",
                        collapsed && !mobileOpen ? "justify-center" : ""
                    )}>
                        <div className="w-10 h-10 rounded-full bg-[#CCFF00] flex items-center justify-center shadow-md flex-shrink-0">
                            <span className="font-bold text-gray-900 text-sm">G</span>
                        </div>
                        {(!collapsed || mobileOpen) && (
                            <>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-semibold text-gray-900">Gökhan</p>
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        Premium
                                    </p>
                                </div>
                                <button className="relative p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-500 flex-shrink-0">
                                    <Bell size={16} />
                                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#CCFF00] border-2 border-white" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </aside>

            {/* ── MAIN ── */}
            <main className={cn(
                "transition-all duration-300",
                collapsed ? "md:ml-20" : "md:ml-64",
                "p-4 md:p-6"
            )}>
                <Outlet />
            </main>
        </div>
    );
};
