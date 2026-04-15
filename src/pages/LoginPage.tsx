import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Phone, Loader2, AlertCircle } from "lucide-react";

type Mode = "login" | "signup";

export const LoginPage = () => {
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();

    const [mode, setMode] = useState<Mode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        if (mode === "login") {
            const { error } = await signIn(email, password);
            if (error) {
                setError("E-posta veya şifre hatalı.");
            } else {
                navigate("/", { replace: true });
            }
        } else {
            if (!fullName.trim()) {
                setError("Ad Soyad zorunludur.");
                setLoading(false);
                return;
            }
            const { error } = await signUp(email, password, fullName);
            if (error) {
                setError(error);
            } else {
                setSuccess("Kayıt başarılı! E-postanızı doğrulayın.");
                setMode("login");
            }
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#CCFF00]/5 blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-[#CCFF00] flex items-center justify-center">
                        <Phone className="w-5 h-5 text-slate-900" />
                    </div>
                    <div>
                        <span className="text-xl font-bold text-white">LUERA</span>
                        <span className="text-xl font-light text-slate-400 ml-1">CallFlow</span>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-1">
                        {mode === "login" ? "Hoş Geldiniz" : "Hesap Oluştur"}
                    </h2>
                    <p className="text-sm text-slate-400 mb-6">
                        {mode === "login"
                            ? "Hesabınıza giriş yapın"
                            : "Yeni bir LUERA hesabı oluşturun"}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === "signup" && (
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                                    Ad Soyad
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="Gökhan Yılmaz"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#CCFF00]/50 focus:ring-1 focus:ring-[#CCFF00]/30 transition-all"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                                E-posta
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="ornek@sirket.com"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#CCFF00]/50 focus:ring-1 focus:ring-[#CCFF00]/30 transition-all"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                                Şifre
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#CCFF00]/50 focus:ring-1 focus:ring-[#CCFF00]/30 transition-all"
                                required
                                minLength={6}
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 text-[#a3e635] text-sm">
                                ✓ {success}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#CCFF00] hover:bg-[#d4ff33] disabled:opacity-50 disabled:cursor-wait text-slate-900 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-slate-500">
                        {mode === "login" ? (
                            <>
                                Hesabınız yok mu?{" "}
                                <button onClick={() => { setMode("signup"); setError(null); }}
                                    className="text-[#CCFF00] hover:text-[#d4ff33] font-semibold transition-colors">
                                    Kayıt Ol
                                </button>
                            </>
                        ) : (
                            <>
                                Zaten hesabınız var mı?{" "}
                                <button onClick={() => { setMode("login"); setError(null); }}
                                    className="text-[#CCFF00] hover:text-[#d4ff33] font-semibold transition-colors">
                                    Giriş Yap
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
