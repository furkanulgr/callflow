import { useState } from "react";
import {
    Search, MapPin, Building2, Phone, Globe, Mail,
    Zap, Filter, ChevronDown, Loader2, CheckCircle2,
    Radio, Star, TrendingUp, Users
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useProduct } from "@/contexts/ProductContext";
import { useNavigate } from "react-router-dom";

/* ── Types ─────────────────────────────────────────────────── */
interface Lead {
    id: string;
    name: string;
    category: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    score: number;
    selected: boolean;
}

/* ── Mock sektörler ─────────────────────────────────────────── */
const SECTORS = [
    "Restoran", "Kafe", "Güzellik Salonu", "Berber", "Diş Kliniği",
    "Eczane", "Spor Salonu", "Oto Servis", "Otel", "Emlak",
    "Hukuk Bürosu", "Muhasebe", "Mimarlık", "İnşaat", "Tekstil",
];

const CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep"];

/* ══════════════════════════════════════════════════════════════ */
export const LeadFlowPage = () => {
    const { setProduct } = useProduct();
    const navigate = useNavigate();

    const [city, setCity]       = useState("İstanbul");
    const [sector, setSector]   = useState("Restoran");
    const [limit, setLimit]     = useState(20);
    const [searching, setSearching] = useState(false);
    const [leads, setLeads]     = useState<Lead[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    /* ── Fake search (n8n entegrasyonu sonra) ────────────────── */
    const handleSearch = async () => {
        setSearching(true);
        setLeads([]);
        setSelected(new Set());
        await new Promise(r => setTimeout(r, 2000));

        const mockLeads: Lead[] = Array.from({ length: limit }, (_, i) => ({
            id: `lead-${i}`,
            name: `${sector} İşletmesi ${i + 1}`,
            category: sector,
            phone: `+90 5${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 900 + 100)} ${Math.floor(Math.random() * 9000 + 1000)}`,
            email: Math.random() > 0.4 ? `info@isletme${i + 1}.com` : null,
            website: Math.random() > 0.5 ? `www.isletme${i + 1}.com` : null,
            address: `${city}, ${Math.floor(Math.random() * 20 + 1)}. Cadde No:${Math.floor(Math.random() * 100 + 1)}`,
            score: Math.floor(Math.random() * 60 + 40),
            selected: false,
        }));
        setLeads(mockLeads);
        setSearching(false);
    };

    /* ── Seç / kaldır ───────────────────────────────────────── */
    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selected.size === leads.length) setSelected(new Set());
        else setSelected(new Set(leads.map(l => l.id)));
    };

    /* ── Kampanyaya gönder ──────────────────────────────────── */
    const sendToCampaign = () => {
        const selectedLeads = leads.filter(l => selected.has(l.id));
        // Kampanya sayfasına geç ve leadleri aktar
        setProduct("callflow");
        navigate("/campaigns", { state: { importedLeads: selectedLeads } });
    };

    const selectedCount = selected.size;
    const totalLeads = leads.length;
    const withPhone = leads.filter(l => l.phone).length;
    const withEmail = leads.filter(l => l.email).length;

    /* ══════════════════════════════════════════════════════════ */
    return (
        <div className="min-h-screen bg-[#FAFAFC] p-6 md:p-8">
            <div className="max-w-[1300px] mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-7 h-7 rounded-lg bg-[#CCFF00] flex items-center justify-center">
                                <Zap className="w-4 h-4 text-slate-900" />
                            </div>
                            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">LeadFlow</h1>
                        </div>
                        <p className="text-sm text-slate-500">Google Maps'ten işletme verileri çek, CallFlow'a gönder</p>
                    </div>
                    {selectedCount > 0 && (
                        <button
                            onClick={sendToCampaign}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-[#CCFF00] rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 animate-in slide-in-from-right duration-200"
                        >
                            <Radio className="w-4 h-4" />
                            {selectedCount} Lead'i CallFlow'a Gönder →
                        </button>
                    )}
                </div>

                {/* Search Panel */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <Search className="w-4 h-4 text-[#CCFF00]" /> Lead Ara
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Şehir */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Şehir</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select value={city} onChange={e => setCity(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/30 focus:border-[#CCFF00]/50 appearance-none">
                                    {CITIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Sektör */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Sektör</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select value={sector} onChange={e => setSector(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#CCFF00]/30 focus:border-[#CCFF00]/50 appearance-none">
                                    {SECTORS.map(s => <option key={s}>{s}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Limit */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                                Lead Sayısı: <span className="text-slate-700">{limit}</span>
                            </label>
                            <input type="range" min={5} max={100} step={5} value={limit}
                                onChange={e => setLimit(Number(e.target.value))}
                                className="w-full h-2.5 accent-[#CCFF00] mt-3" />
                        </div>

                        {/* Ara butonu */}
                        <div className="flex items-end">
                            <button onClick={handleSearch} disabled={searching}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all",
                                    searching
                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                        : "bg-slate-900 text-[#CCFF00] hover:bg-slate-800 shadow-lg shadow-slate-900/10"
                                )}>
                                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                {searching ? "Aranıyor..." : "Ara"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                {totalLeads > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Toplam Lead", value: totalLeads,    icon: Users,       color: "text-slate-700", bg: "bg-slate-50" },
                            { label: "Telefon",      value: withPhone,    icon: Phone,       color: "text-emerald-600", bg: "bg-emerald-50" },
                            { label: "E-posta",      value: withEmail,    icon: Mail,        color: "text-blue-600", bg: "bg-blue-50" },
                            { label: "Seçili",       value: selectedCount, icon: CheckCircle2, color: "text-[#CCFF00]", bg: "bg-slate-900" },
                        ].map(s => (
                            <div key={s.label} className={cn("rounded-2xl border border-slate-100 p-4 flex items-center gap-3", s.bg === "bg-slate-900" ? "bg-slate-900 border-slate-800" : "bg-white shadow-sm")}>
                                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", s.bg)}>
                                    <s.icon className={cn("w-4 h-4", s.color)} />
                                </div>
                                <div>
                                    <p className={cn("text-xl font-bold", s.bg === "bg-slate-900" ? "text-[#CCFF00]" : s.color)}>{s.value}</p>
                                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", s.bg === "bg-slate-900" ? "text-slate-400" : "text-slate-400")}>{s.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Lead List */}
                {leads.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Table header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <input type="checkbox"
                                    checked={selectedCount === totalLeads && totalLeads > 0}
                                    onChange={toggleAll}
                                    className="w-4 h-4 accent-slate-900 rounded" />
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                    {city} · {sector} · {totalLeads} sonuç
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold">
                                <Filter className="w-3.5 h-3.5" /> Filtrele
                            </div>
                        </div>

                        {/* Leads */}
                        <div className="divide-y divide-slate-50">
                            {leads.map(lead => (
                                <div key={lead.id}
                                    onClick={() => toggleSelect(lead.id)}
                                    className={cn(
                                        "flex items-center gap-4 px-6 py-4 cursor-pointer transition-all",
                                        selected.has(lead.id)
                                            ? "bg-[#CCFF00]/5 border-l-2 border-l-[#CCFF00]"
                                            : "hover:bg-slate-50/80"
                                    )}>
                                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => {}}
                                        className="w-4 h-4 accent-slate-900 rounded flex-shrink-0" />

                                    {/* Avatar */}
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <Building2 className="w-4 h-4 text-slate-500" />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{lead.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{lead.address}</p>
                                    </div>

                                    {/* Contact info */}
                                    <div className="hidden md:flex items-center gap-4">
                                        {lead.phone && (
                                            <span className="flex items-center gap-1 text-xs text-slate-600 font-mono">
                                                <Phone className="w-3 h-3 text-emerald-500" /> {lead.phone}
                                            </span>
                                        )}
                                        {lead.email && (
                                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                                <Mail className="w-3 h-3 text-blue-400" /> {lead.email}
                                            </span>
                                        )}
                                        {lead.website && (
                                            <span className="flex items-center gap-1 text-xs text-slate-400">
                                                <Globe className="w-3 h-3" /> {lead.website}
                                            </span>
                                        )}
                                    </div>

                                    {/* Score */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                        <span className="text-xs font-bold text-slate-700">{lead.score}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!searching && leads.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-300 gap-4">
                        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
                            <MapPin className="w-10 h-10 text-slate-300" />
                        </div>
                        <div className="text-center">
                            <p className="text-base font-bold text-slate-400">Şehir ve sektör seç, ara</p>
                            <p className="text-sm text-slate-300 mt-1">Google Maps'ten işletmeler otomatik çekilir</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
