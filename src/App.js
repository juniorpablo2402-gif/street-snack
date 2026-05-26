/* eslint-disable */
import { useState, useEffect, useCallback, createContext, useContext } from "react"; // eslint-disable-line
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://udgbxqnaocsroeadmbgh.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkZ2J4cW5hb2Nzcm9lYWRtYmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjU5MzAsImV4cCI6MjA5NDI0MTkzMH0.WWXiOc-hBcbFnloTkoHIKUxhtbjobHa33UU3rmoSSsk";
const CLOUDINARY_CLOUD = "de8r01l8w"; // eslint-disable-line no-unused-vars
const WHATSAPP_NUM  = "2250172164177"; // numéro pour envoyer commandes
const WHATSAPP_RECEIVE = "2250104489636"; // numéro pour recevoir
const WAVE_LINK     = "https://pay.wave.com/m/M_ci_JT9OY4oad86d/c/ci";
const VENDOR_CODE   = "Lelama225";
const APP_URL       = window.location.href.split("?")[0];

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── THEME CONTEXT ───────────────────────────────────────────────────────────
const ThemeCtx = createContext({ dark: true, toggle: () => {} });
const useTheme = () => useContext(ThemeCtx);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fp = p => (p||0).toLocaleString("fr-FR") + " FCFA";
const ft = ts => new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fd = ts => new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const ORDER_STATUSES = {
  pending:   { label: "En attente",      color: "#ff9500", bg: "#1f1200", icon: "⏳" },
  confirmed: { label: "Confirmée",       color: "#4fc3f7", bg: "#001f2e", icon: "✅" },
  preparing: { label: "En préparation",  color: "#a78bfa", bg: "#1a0f2e", icon: "👨‍🍳" },
  ready:     { label: "Prête !",         color: "#25D366", bg: "#0d1f0d", icon: "🔔" },
  delivered: { label: "Livrée",          color: "#888",    bg: "#111",    icon: "🎉" },
};
const STEPS_LIST  = ["pending","confirmed","preparing","ready","delivered"];
const NEXT_STATUS = { pending:"confirmed", confirmed:"preparing", preparing:"ready", ready:"delivered" };
const NEXT_LABEL  = { pending:"✅ Confirmer", confirmed:"👨‍🍳 Préparer", preparing:"🔔 Prête !", ready:"🎉 Livrée" };

// ─── PDF REÇU ─────────────────────────────────────────────────────────────────
async function generateReceiptPDF(order, items) {
  const doc = new jsPDF({ unit: "mm", format: [80, 160] });
  let y = 10;
  doc.setFontSize(14); doc.setFont("helvetica","bold");
  doc.text("THE STREET SNACK", 40, y, { align: "center" }); y += 6;
  doc.setFontSize(8); doc.setFont("helvetica","normal");
  doc.text("Fast-food • Commande rapide", 40, y, { align: "center" }); y += 8;
  doc.setLineWidth(0.3); doc.line(5, y, 75, y); y += 5;
  doc.setFontSize(9); doc.setFont("helvetica","bold");
  doc.text(`Commande #${order.id}`, 5, y); y += 5;
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  doc.text(`Client : ${order.client_name}`, 5, y); y += 4;
  doc.text(`Date   : ${fd(order.created_at)} ${ft(order.created_at)}`, 5, y); y += 4;
  doc.text(`Mode   : ${order.order_type === "table" ? `Table ${order.table_number}` : "À emporter"}`, 5, y); y += 4;
  doc.text(`Paiem. : ${order.payment_method === "wave" ? "🌊 Wave" : "💵 Espèces"}`, 5, y); y += 6;
  doc.line(5, y, 75, y); y += 5;
  doc.setFont("helvetica","bold"); doc.setFontSize(8);
  doc.text("Article", 5, y); doc.text("Qté", 45, y); doc.text("Prix", 62, y); y += 4;
  doc.line(5, y, 75, y); y += 4;
  doc.setFont("helvetica","normal");
  items.forEach(it => {
    const name = it.name.length > 22 ? it.name.substring(0,22)+"…" : it.name;
    doc.text(name, 5, y);
    doc.text(`${it.quantity}`, 47, y);
    doc.text(fp(it.price * it.quantity), 62, y); y += 5;
  });
  doc.line(5, y, 75, y); y += 5;
  doc.setFont("helvetica","bold"); doc.setFontSize(10);
  doc.text("TOTAL", 5, y); doc.text(fp(order.total), 62, y); y += 8;
  doc.setFontSize(7); doc.setFont("helvetica","italic");
  doc.text("Merci pour votre commande !", 40, y, { align: "center" }); y += 4;
  doc.text("The Street Snack — Abidjan", 40, y, { align: "center" });
  doc.save(`recu-commande-${order.id}.pdf`);
}

// ─── QR CODE GENERATOR ───────────────────────────────────────────────────────
async function generateQR(tableNum) {
  const url = `${APP_URL}?table=${tableNum}`;
  return await QRCode.toDataURL(url, { width: 256, margin: 2, color: { dark: "#000", light: "#fff" } });
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = ORDER_STATUSES[status] || ORDER_STATUSES.pending;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}`, borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {s.icon} {s.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SPLASH SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 2000);
    const t3 = setTimeout(() => onDone(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1000, opacity: phase === 2 ? 0 : 1, transition: "opacity 0.8s" }}>
      <div style={{ width: 120, height: 120, borderRadius: "50%", background: "linear-gradient(135deg,#ff6b00,#ff9500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, transform: phase >= 1 ? "scale(1)" : "scale(0.2)", opacity: phase >= 1 ? 1 : 0, transition: "transform 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s", boxShadow: "0 0 80px rgba(255,107,0,0.6)" }}>🔥</div>
      <div style={{ marginTop: 20, fontSize: 28, fontWeight: 900, letterSpacing: 3, color: "#fff", opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.5s 0.2s, transform 0.5s 0.2s" }}>THE STREET SNACK</div>
      <div style={{ marginTop: 6, fontSize: 13, color: "#ff9500", letterSpacing: 2, opacity: phase >= 1 ? 1 : 0, transition: "opacity 0.5s 0.5s" }}>Fast-food • Commande rapide</div>
      <div style={{ marginTop: 40, width: 160, height: 3, background: "#2a2a2a", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "linear-gradient(90deg,#ff6b00,#ff9500)", borderRadius: 3, width: phase >= 1 ? "100%" : "0%", transition: "width 1.8s ease" }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH — CONNEXION / INSCRIPTION
// ══════════════════════════════════════════════════════════════════════════════
function AuthScreen({ onAuth, onVendor }) {
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [taps, setTaps]       = useState(0);
  const [showVendor, setShowVendor] = useState(false);
  const [vCode, setVCode]     = useState("");
  const [vErr, setVErr]       = useState(false);

  const handleLogoTap = () => {
    const n = taps + 1; setTaps(n);
    if (n >= 5) { setShowVendor(true); setTaps(0); }
    setTimeout(() => setTaps(c => Math.max(0, c-1)), 2000);
  };

  const handleAuth = async () => {
    setErr(""); setLoading(true);
    if (!name.trim()) { setErr("Entrez votre prénom."); setLoading(false); return; }
    if (!phone.trim() || phone.replace(/\D/g,"").length < 8) { setErr("Numéro WhatsApp invalide."); setLoading(false); return; }
    // Chercher si le client existe déjà
    const { data: existing } = await sb.from("profiles").select("*").eq("phone", phone.replace(/\s/g,"")).maybeSingle();
    if (existing) {
      // Client connu — mise à jour du nom et connexion directe
      await sb.from("profiles").update({ name }).eq("phone", phone.replace(/\s/g,""));
      onAuth({ ...existing, name });
    } else {
      // Nouveau client — création du profil sans auth Supabase
      const newId = crypto.randomUUID();
      const { data: profile, error } = await sb.from("profiles").insert({ id: newId, name, phone: phone.replace(/\s/g,""), role: "client" }).select().single();
      if (error) { setErr("Erreur. Réessayez."); setLoading(false); return; }
      onAuth(profile);
    }
    setLoading(false);
  };

  const loginVendor = () => {
    if (vCode === VENDOR_CODE) { onVendor(); setShowVendor(false); }
    else setVErr(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {showVendor && (
        <div style={S.modalOverlay}>
          <div style={S.modal}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
            <div style={S.modalTitle}>Espace Vendeur</div>
            <input style={{ ...S.input, marginBottom: 8 }} type="password" placeholder="Code secret" value={vCode} onChange={e => setVCode(e.target.value)} onKeyDown={e => e.key === "Enter" && loginVendor()} />
            {vErr && <div style={{ color: "#ff4444", fontSize: 12, marginBottom: 8 }}>Code incorrect ❌</div>}
            <button style={S.primaryBtn} onClick={loginVendor}>Accéder</button>
            <button style={S.ghostBtn} onClick={() => { setShowVendor(false); setVCode(""); setVErr(false); }}>Annuler</button>
          </div>
        </div>
      )}

      <div onClick={handleLogoTap} style={{ width: 90, height: 90, borderRadius: "50%", background: "linear-gradient(135deg,#ff6b00,#ff9500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, marginBottom: 16, boxShadow: "0 0 50px rgba(255,107,0,0.4)", cursor: "pointer", userSelect: "none", transform: taps > 0 ? "scale(0.9)" : "scale(1)", transition: "transform 0.1s" }}>🔥</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: 2, marginBottom: 4 }}>THE STREET SNACK</div>
      <div style={{ fontSize: 12, color: "#ff9500", marginBottom: 32, letterSpacing: 1 }}>Entrez pour commander 🍖</div>

      <div style={{ width: "100%", maxWidth: 360, background: "#1a1a1a", borderRadius: 20, padding: 28, border: "1px solid #2a2a2a" }}>
        <div style={S.fieldGroup}>
          <label style={S.label}>👤 Prénom *</label>
          <input style={S.input} placeholder="Ex : Moussa" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>📱 Numéro WhatsApp *</label>
          <input style={S.input} placeholder="Ex : 0102030405" value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
        </div>
        {err && <div style={{ color: "#ff4444", fontSize: 12, marginBottom: 12 }}>⚠️ {err}</div>}
        <button style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1 }} onClick={handleAuth} disabled={loading}>
          {loading ? "⏳ Chargement..." : "🚀 Accéder au menu"}
        </button>
      </div>

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUIVI COMMANDE CLIENT
// ══════════════════════════════════════════════════════════════════════════════
function OrderTracking({ orderId, onBack }) {
  const [order, setOrder]   = useState(null);
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const { dark } = useTheme();
  const t = dark ? D : L;

  const fetchOrder = useCallback(async () => {
    const { data: o } = await sb.from("orders").select("*").eq("id", orderId).single();
    const { data: its } = await sb.from("order_items").select("*").eq("order_id", orderId);
    if (o) setOrder(o);
    if (its) setItems(its);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    const channel = sb.channel(`order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        payload => { setOrder(payload.new); })
      .subscribe();
    return () => sb.removeChannel(channel);
  }, [fetchOrder, orderId]);

  const GLOVO_STEPS = [
    { key: "pending",    icon: "🛎️", label: "Commande reçue",    desc: "Votre commande est en attente de confirmation",  color: "#f59e0b", bg: "#1a1200" },
    { key: "confirmed",  icon: "✅", label: "Commande acceptée", desc: "Le restaurant a accepté votre commande !",        color: "#4fc3f7", bg: "#001f2e" },
    { key: "preparing",  icon: "👨‍🍳", label: "En préparation",   desc: "On prépare votre commande, encore un peu...",    color: "#a78bfa", bg: "#1a0a2e" },
    { key: "ready",      icon: "🔔", label: "Prête !",            desc: "Votre commande est prête ! Venez la récupérer.", color: "#25D366", bg: "#0a2e12" },
    { key: "delivered",  icon: "🎉", label: "Livrée",            desc: "Merci et à bientôt ! Bon appétit 🍖",            color: "#ff9500", bg: "#1a0a00" },
  ];

  const currentStep = GLOVO_STEPS.find(s => s.key === order?.status) || GLOVO_STEPS[0];
  const currentIdx  = GLOVO_STEPS.findIndex(s => s.key === order?.status);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⏳</div>
        <div style={{ color:"#888" }}>Chargement...</div>
      </div>
    </div>
  );

  return (
    <div style={{ ...S.root, background: t.bg }}>
      <div style={S.header}>
        <div style={S.logoRow}>
          <span style={S.logoEmoji}>🔥</span>
          <div><div style={S.logoName}>THE STREET SNACK</div><div style={S.logoTagline}>Suivi de commande #{orderId}</div></div>
          <button onClick={onBack} style={S.exitBtn}>✕</button>
        </div>
      </div>

      <div style={S.content}>

        {/* Carte statut principal style Glovo */}
        <div style={{ background: currentStep.bg, border: `2px solid ${currentStep.color}`, borderRadius: 24, padding: "28px 20px", textAlign: "center", marginBottom: 20, transition: "all 0.5s" }}>
          <div style={{ fontSize: 64, marginBottom: 12, lineHeight: 1 }}>{currentStep.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: currentStep.color, marginBottom: 8 }}>{currentStep.label}</div>
          <div style={{ fontSize: 14, color: "#aaa", lineHeight: 1.5 }}>{currentStep.desc}</div>
          {order?.status === "ready" && (
            <div style={{ marginTop: 16, background: "rgba(37,211,102,0.15)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#25D366", fontWeight: 600 }}>
              📍 {order?.order_type === "table" ? `Table ${order?.table_number}` : "Récupérez votre commande au comptoir"}
            </div>
          )}
        </div>

        {/* Barre de progression style Glovo */}
        <div style={{ background: t.card, borderRadius: 16, padding: "16px 12px", marginBottom: 16, border: `1px solid ${t.border}` }}>
          <div style={{ position: "relative", paddingTop: 8 }}>
            {/* Ligne de fond */}
            <div style={{ position: "absolute", top: 20, left: "8%", right: "8%", height: 4, background: t.border, borderRadius: 4 }} />
            {/* Ligne de progression */}
            <div style={{ position: "absolute", top: 20, left: "8%", height: 4, borderRadius: 4, background: "linear-gradient(90deg, #ff6b00, #ff9500)", transition: "width 0.8s ease", width: currentIdx === 0 ? "0%" : `${(currentIdx / (GLOVO_STEPS.length - 1)) * 84}%` }} />
            <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
              {GLOVO_STEPS.map((step, i) => (
                <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: i <= currentIdx ? "#ff6b00" : t.border, border: `3px solid ${i <= currentIdx ? "#ff9500" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, transition: "all 0.4s", boxShadow: i === currentIdx ? "0 0 12px rgba(255,107,0,0.6)" : "none" }}>
                    {i < currentIdx ? "✓" : i === currentIdx ? <span style={{ fontSize: 10 }}>●</span> : ""}
                  </div>
                  <div style={{ fontSize: 8, color: i <= currentIdx ? "#ff9500" : "#555", marginTop: 5, textAlign: "center", lineHeight: 1.2, maxWidth: 50 }}>
                    {step.label.split(" ")[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Récap commande */}
        <div style={{ background: t.card, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#ff9500", marginBottom: 10 }}>📋 Commande #{orderId}</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>👤 {order?.client_name}</span>
            <span>{order?.order_type === "table" ? `🪑 Table ${order?.table_number}` : "🛍️ À emporter"}</span>
            <span>💳 {order?.payment_method === "wave" ? "🌊 Wave" : "💵 Espèces"}</span>
          </div>
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8, color: t.text, padding: "6px 0", borderBottom: `1px solid ${t.border}` }}>
              <span style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "#ff9500", fontWeight: 700 }}>{it.quantity}×</span>
                <span>{it.name}</span>
              </span>
              <span style={{ color: "#ff9500", fontWeight: 600 }}>{fp(it.price * it.quantity)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15, color: t.text, marginTop: 8 }}>
            <span>Total</span><span style={{ color: "#ff9500" }}>{fp(order?.total)}</span>
          </div>
        </div>

        {order?.status === "delivered" && (
          <button style={{ ...S.primaryBtn, background: "#1a1a2e", border: "1px solid #4fc3f7", color: "#4fc3f7" }}
            onClick={() => generateReceiptPDF(order, items)}>
            📄 Télécharger le reçu PDF
          </button>
        )}

        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: "#444" }}>
          🔄 Mis à jour automatiquement en temps réel
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ESPACE VENDEUR COMPLET
// ══════════════════════════════════════════════════════════════════════════════
function VendorDashboard({ onExit }) {
  const [tab, setTab]         = useState("orders");
  const [orders, setOrders]   = useState([]);
  const [menu, setMenu]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("active");
  const [qrTable, setQrTable] = useState(null);
  const [qrImg, setQrImg]     = useState("");
  const [statsRange, setStatsRange] = useState("week"); // day | week | month
  const { dark, toggle } = useTheme();
  const t = dark ? D : L;

  const fetchOrders = useCallback(async () => {
    const { data } = await sb.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  }, []);

  const fetchMenu = useCallback(async () => {
    const { data } = await sb.from("menu_items").select("*").order("category").order("sort_order");
    if (data) setMenu(data);
  }, []);

  useEffect(() => {
    fetchOrders(); fetchMenu();
    const channel = sb.channel("vendor-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();
    return () => sb.removeChannel(channel);
  }, [fetchOrders, fetchMenu]);

  const updStatus = async (order, ns) => {
    await sb.from("orders").update({ status: ns }).eq("id", order.id);
    setOrders(p => p.map(o => o.id === order.id ? { ...o, status: ns } : o));
    // Notif WhatsApp si prête
    if (ns === "ready") {
      let msg = `🔔 *Votre commande est prête !*\n👤 ${order.client_name}\n💰 ${fp(order.total)}\nVenez la récupérer au comptoir.`;
      window.open(`https://wa.me/${order.client_phone?.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  const updStock = async (id, qty) => {
    await sb.from("menu_items").update({ stock: Math.max(0, qty) }).eq("id", id);
    setMenu(p => p.map(m => m.id === id ? { ...m, stock: Math.max(0, qty) } : m));
  };

  const toggleAvailable = async (id, val) => {
    await sb.from("menu_items").update({ available: val }).eq("id", id);
    setMenu(p => p.map(m => m.id === id ? { ...m, available: val } : m));
  };

  const showQR = async (num) => {
    setQrTable(num);
    const img = await generateQR(num);
    setQrImg(img);
  };

  const downloadQR = () => {
    const a = document.createElement("a");
    a.href = qrImg; a.download = `qr-table-${qrTable}.png`; a.click();
  };

  // Calcul stats
  const now = new Date();
  const rangeStart = new Date(now);
  if (statsRange === "day") rangeStart.setHours(0,0,0,0);
  else if (statsRange === "week") rangeStart.setDate(now.getDate() - 7);
  else rangeStart.setDate(now.getDate() - 30);

  const statsOrders = orders.filter(o => new Date(o.created_at) >= rangeStart);
  const delivered   = statsOrders.filter(o => o.status === "delivered");
  const revenue     = delivered.reduce((s, o) => s + (o.total || 0), 0);
  const avgOrder    = delivered.length ? Math.round(revenue / delivered.length) : 0;

  // Articles les plus commandés
  const itemCount = {};
  statsOrders.forEach(o => (o.order_items || []).forEach(it => {
    itemCount[it.name] = (itemCount[it.name] || 0) + it.quantity;
  }));
  const topItems = Object.entries(itemCount).sort((a,b) => b[1]-a[1]).slice(0, 5);

  const filtered = orders.filter(o =>
    filter === "active" ? o.status !== "delivered" :
    filter === "done"   ? o.status === "delivered" : true
  );
  const pending = orders.filter(o => o.status === "pending").length;

  const categories = [...new Set(menu.map(m => m.category))];

  return (
    <div style={{ ...S.root, background: t.bg, color: t.text }}>
      {/* QR Modal */}
      {qrTable && (
        <div style={S.modalOverlay}>
          <div style={{ ...S.modal, background: t.card }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>📱 QR Code — Table {qrTable}</div>
            {qrImg && <img src={qrImg} style={{ width: 200, height: 200, borderRadius: 12, marginBottom: 12 }} />}
            <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Scannez pour accéder directement au menu</div>
            <button style={S.primaryBtn} onClick={downloadQR}>⬇️ Télécharger PNG</button>
            <button style={S.ghostBtn} onClick={() => setQrTable(null)}>Fermer</button>
          </div>
        </div>
      )}

      <div style={{ ...S.header, background: "linear-gradient(135deg,#1a1a2e,#16213e)" }}>
        <div style={S.logoRow}>
          <span style={S.logoEmoji}>🏪</span>
          <div><div style={S.logoName}>Espace Vendeur</div><div style={S.logoTagline}>The Street Snack</div></div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={toggle} style={{ ...S.exitBtn, fontSize: 18 }}>{dark ? "☀️" : "🌙"}</button>
            <button onClick={onExit} style={S.exitBtn}>✕</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: t.card, borderBottom: `1px solid ${t.border}`, overflowX: "auto" }}>
        {[["orders","📋 Commandes"],["stats","📊 Stats"],["menu","🍽️ Menu"],["qr","📱 QR Tables"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, minWidth: 80, padding: "12px 8px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "transparent", color: tab === k ? "#ff9500" : "#666", borderBottom: tab === k ? "2px solid #ff6b00" : "2px solid transparent", whiteSpace: "nowrap" }}>
            {l}{k === "orders" && pending > 0 && <span style={{ background: "#ff6b00", color: "#fff", borderRadius: 999, fontSize: 10, padding: "1px 5px", marginLeft: 4 }}>{pending}</span>}
          </button>
        ))}
      </div>

      <div style={S.content}>

        {/* ── COMMANDES ── */}
        {tab === "orders" && (
          <>
            <div style={S.statsRow}>
              <div style={{ ...S.statBox, background: t.card, border: `1px solid ${t.border}` }}><div style={S.statNum}>{orders.length}</div><div style={S.statLabel}>Total</div></div>
              <div style={{ ...S.statBox, background: t.card, borderColor: "#ff6b00" }}><div style={{ ...S.statNum, color: "#ff6b00" }}>{pending}</div><div style={S.statLabel}>En attente</div></div>
              <div style={{ ...S.statBox, background: t.card, borderColor: "#25D366" }}><div style={{ ...S.statNum, color: "#25D366", fontSize: 11 }}>{fp(orders.filter(o=>o.status==="delivered").reduce((s,o)=>s+o.total,0))}</div><div style={S.statLabel}>CA total</div></div>
            </div>
            <div style={S.toggleRow}>
              {[["active","⏳ En cours"],["done","✅ Livrées"],["all","Toutes"]].map(([k,l]) => (
                <button key={k} onClick={() => setFilter(k)} style={{ ...S.toggleBtn, ...(filter===k?S.toggleActive:{}), background: t.card, color: filter===k?"#ff6b00":t.muted, fontSize: 12 }}>{l}</button>
              ))}
            </div>
            <button style={{ ...S.ghostBtn, marginBottom: 12 }} onClick={fetchOrders}>🔄 Actualiser</button>

            {loading && <div style={{ color: "#555", textAlign: "center", padding: 40 }}>Chargement...</div>}
            {!loading && filtered.length === 0 && <div style={{ textAlign: "center", padding: 60 }}><div style={{ fontSize: 48 }}>🍽️</div><div style={{ color: "#555" }}>Aucune commande</div></div>}

            {filtered.map(order => (
              <div key={order.id} style={{ background: t.card, borderRadius: 14, padding: 14, marginBottom: 12, border: `1px solid ${t.border}`, borderLeft: order.status==="pending"?"3px solid #ff6b00":order.status==="ready"?"3px solid #25D366":`1px solid ${t.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: t.text }}>👤 {order.client_name}</span>
                    {order.client_phone && <span style={{ background: "#0d2020", color: "#4fc3f7", borderRadius: 6, padding: "2px 7px", fontSize: 11 }}>📱 {order.client_phone}</span>}
                    {order.order_type==="table" ? <span style={{ background: "#1f1200", color: "#ff9500", borderRadius: 6, padding: "2px 7px", fontSize: 11 }}>🪑 T.{order.table_number}</span> : <span style={{ background: "#1f2a1f", color: "#25D366", borderRadius: 6, padding: "2px 7px", fontSize: 11 }}>🛍️ Emporter</span>}
                    <span style={{ background: "#0d1f2a", color: "#4fc3f7", borderRadius: 6, padding: "2px 7px", fontSize: 11 }}>{order.payment_method==="wave"?"🌊 Wave":"💵 Espèces"}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <span style={{ fontSize: 11, color: "#666" }}>{ft(order.created_at)}</span>
                </div>
                {(order.order_items||[]).map((it,i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3, color: t.muted }}>
                    <span>{it.quantity}× {it.name}</span><span style={{ color: "#ff9500" }}>{fp(it.price*it.quantity)}</span>
                  </div>
                ))}
                {order.note && <div style={{ fontSize: 12, color: "#888", background: t.bg, borderRadius: 8, padding: "5px 10px", margin: "6px 0" }}>📝 {order.note}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: "#ff9500" }}>💰 {fp(order.total)}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {NEXT_STATUS[order.status] && (
                      <button style={{ background: "#1f1200", color: "#ff9500", border: "1px solid #ff6b00", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontWeight: 700 }} onClick={() => updStatus(order, NEXT_STATUS[order.status])}>
                        {NEXT_LABEL[order.status]}
                      </button>
                    )}
                    <button style={{ background: "#1f2a1f", color: "#25D366", border: "1px solid #25D366", borderRadius: 8, padding: "6px 8px", fontSize: 12, cursor: "pointer" }} onClick={() => generateReceiptPDF(order, order.order_items||[])}>📄</button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── STATISTIQUES ── */}
        {tab === "stats" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[["day","Aujourd'hui"],["week","7 jours"],["month","30 jours"]].map(([k,l]) => (
                <button key={k} onClick={() => setStatsRange(k)} style={{ flex: 1, padding: "9px", borderRadius: 10, border: `2px solid ${statsRange===k?"#ff6b00":t.border}`, background: statsRange===k?"#1f1200":t.card, color: statsRange===k?"#ff9500":t.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{l}</button>
              ))}
            </div>

            <div style={S.statsRow}>
              <div style={{ ...S.statBox, background: t.card, border: `1px solid ${t.border}` }}><div style={{ ...S.statNum, fontSize: 14 }}>{fp(revenue)}</div><div style={S.statLabel}>Chiffre d'affaires</div></div>
              <div style={{ ...S.statBox, background: t.card, border: `1px solid ${t.border}` }}><div style={S.statNum}>{delivered.length}</div><div style={S.statLabel}>Livrées</div></div>
              <div style={{ ...S.statBox, background: t.card, border: `1px solid ${t.border}` }}><div style={{ ...S.statNum, fontSize: 13 }}>{fp(avgOrder)}</div><div style={S.statLabel}>Panier moyen</div></div>
            </div>

            <div style={{ background: t.card, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#ff9500", marginBottom: 12 }}>🏆 Articles les plus commandés</div>
              {topItems.length === 0 && <div style={{ color: "#555", fontSize: 13 }}>Pas encore de données</div>}
              {topItems.map(([name, qty], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", marginBottom: 10, gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{name}</div>
                    <div style={{ height: 6, background: t.border, borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "#ff6b00", borderRadius: 3, width: `${(qty / (topItems[0]?.[1] || 1)) * 100}%`, transition: "width 0.5s" }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#ff9500" }}>{qty}x</span>
                </div>
              ))}
            </div>

            <div style={{ background: t.card, borderRadius: 14, padding: 16, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#ff9500", marginBottom: 10 }}>💳 Répartition paiements</div>
              {["especes","wave"].map(pm => {
                const count = statsOrders.filter(o => o.payment_method === pm).length;
                const pct   = statsOrders.length ? Math.round((count/statsOrders.length)*100) : 0;
                return (
                  <div key={pm} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: t.text, marginBottom: 4 }}>
                      <span>{pm==="wave"?"🌊 Wave":"💵 Espèces"}</span><span>{count} cmd ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: t.border, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: pm==="wave"?"#00a3e0":"#25D366", width: `${pct}%`, transition: "width 0.5s", borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── MENU / STOCK ── */}
        {tab === "menu" && (
          <>
            <div style={{ fontSize: 13, color: t.muted, marginBottom: 14 }}>Gérez le stock et la disponibilité des articles.</div>
            {categories.map(cat => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={S.catTitle}>{cat}</div>
                {menu.filter(m => m.category === cat).map(item => {
                  const low = item.stock <= 3, out = item.stock === 0;
                  return (
                    <div key={item.id} style={{ background: out?"#1a0505":low?"#1a1200":t.card, borderRadius: 12, padding: "10px 12px", marginBottom: 8, border: `1px solid ${out?"#ff4444":low?"#ff9500":t.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 13, color: t.text }}>{item.name}</span>
                          <span style={{ fontSize: 11, color: out?"#ff4444":low?"#ff9500":"#888", marginLeft: 8 }}>{out?"⛔ Épuisé":low?`⚠️ ${item.stock} restants`:`✅ ${item.stock}`}</span>
                        </div>
                        <button onClick={() => toggleAvailable(item.id, !item.available)} style={{ background: item.available?"#0d1f0d":"#2a0d0d", color: item.available?"#25D366":"#ff4444", border: `1px solid ${item.available?"#25D366":"#ff4444"}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
                          {item.available?"Actif":"Masqué"}
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button style={{ ...S.qtyBtn }} onClick={() => updStock(item.id, item.stock-1)}>−</button>
                        <input type="number" value={item.stock} onChange={e => updStock(item.id, parseInt(e.target.value)||0)} style={{ width: 54, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, textAlign: "center", fontSize: 15, fontWeight: 700, padding: "4px 0" }} />
                        <button style={{ ...S.qtyBtn, ...S.addBtn }} onClick={() => updStock(item.id, item.stock+1)}>+</button>
                        <button style={{ ...S.qtyBtn, background: "#1a2a1a", color: "#25D366", width: 38, fontSize: 11 }} onClick={() => updStock(item.id, item.stock+10)}>+10</button>
                        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#ff9500" }}>{fp(item.price)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}

        {/* ── QR TABLES ── */}
        {tab === "qr" && (
          <>
            <div style={{ fontSize: 13, color: t.muted, marginBottom: 14 }}>Génère et télécharge le QR code pour chaque table. Le client scanne et accède directement au menu.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {Array.from({ length: 20 }, (_, i) => i+1).map(n => (
                <button key={n} onClick={() => showQR(n)} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 20 }}>📱</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>T.{n}</span>
                </button>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP PRINCIPALE — MENU CLIENT
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [dark, setDark]     = useState(true);
  const [appState, setApp]  = useState("splash"); // splash | auth | menu | checkout | confirm | tracking | vendor
  const [user, setUser]     = useState(null);
  const [menu, setMenu]     = useState([]);
  const [cart, setCart]     = useState({});
  const [orderType, setOT]  = useState("table");
  const [tableNum, setTN]   = useState("");
  const [note, setNote]     = useState("");
  const [payMethod, setPM]  = useState("especes");
  const [trackId, setTrackId] = useState(null);
  const [trackInput, setTI]   = useState("");
  const [submitting, setSub]  = useState(false);
  const t = dark ? D : L;

  // Lire table depuis URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tbl = params.get("table");
    if (tbl) { setTN(tbl); setOT("table"); }
  }, []);

  // Charger menu depuis Supabase
  useEffect(() => {
    sb.from("menu_items").select("*").eq("available", true).order("category").order("sort_order")
      .then(({ data }) => { if (data) setMenu(data); });
  }, []);

  const cartItems  = Object.values(cart);
  const totalQty   = cartItems.reduce((s,i) => s+i.qty, 0);
  const totalPrice = cartItems.reduce((s,i) => s+i.qty*i.price, 0);

  const addItem = item => {
    if (item.stock === 0) return;
    setCart(p => ({ ...p, [item.id]: { ...item, qty: (p[item.id]?.qty||0)+1 } }));
  };
  const remItem = id => setCart(p => {
    const u = { ...p };
    if (u[id]?.qty > 1) u[id] = { ...u[id], qty: u[id].qty-1 };
    else delete u[id];
    return u;
  });

  const categories = [...new Set(menu.map(m => m.category))];

  const sendOrder = async () => {
    if (orderType === "table" && !tableNum.trim()) { alert("Numéro de table requis."); return; }
    setSub(true);

    const { data: order, error } = await sb.from("orders").insert({
      client_id:      user?.id || null,
      client_name:    user?.name || "Client",
      client_phone:   user?.phone || "",
      table_number:   orderType === "table" ? parseInt(tableNum) : null,
      order_type:     orderType,
      payment_method: payMethod,
      payment_status: payMethod === "wave" ? "pending" : "confirmed",
      status:         "pending",
      note,
      total:          totalPrice,
    }).select().single();

    if (error || !order) { alert("Erreur lors de la commande."); setSub(false); return; }

    await sb.from("order_items").insert(
      cartItems.map(i => ({ order_id: order.id, menu_item_id: i.id, name: i.name, price: i.price, quantity: i.qty }))
    );

    // Notif WhatsApp automatique au VENDEUR
    const lignes = cartItems.map(i => `  • ${i.qty}× ${i.name} — ${fp(i.qty*i.price)}`).join("\n");
    const msg = `🔥 NOUVELLE COMMANDE #${order.id}\n\n👤 ${user?.name || "Client"} | 📱 ${user?.phone || ""}\n${orderType === "table" ? `🪑 Table ${tableNum}` : "🛍️ À emporter"}\n💳 ${payMethod === "wave" ? "Wave" : "Espèces"}\n\n${lignes}\n\n💰 TOTAL : ${fp(totalPrice)}${note ? `\n📝 Note : ${note}` : ""}`;
    window.open(`https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`, "_blank");

    if (payMethod === "wave") window.open(WAVE_LINK, "_blank");

    setTrackId(order.id);
    setSub(false);
    setApp("tracking");
  };

  const reset = () => { setCart({}); setNote(""); setPM("especes"); setTrackId(null); setApp("menu"); };

  // ── ROUTING ──
  if (appState === "splash") return <ThemeCtx.Provider value={{ dark, toggle: ()=>setDark(p=>!p) }}><SplashScreen onDone={() => setApp("auth")} /></ThemeCtx.Provider>;

  return (
    <ThemeCtx.Provider value={{ dark, toggle: () => setDark(p => !p) }}>
      {appState === "auth"     && <AuthScreen onAuth={u => { setUser(u); setApp("menu"); }} onVendor={() => setApp("vendor")} />}
      {appState === "vendor"   && <VendorDashboard onExit={() => setApp(user ? "menu" : "auth")} />}
      {appState === "tracking" && <OrderTracking orderId={trackId} onBack={() => setApp("menu")} />}

      {["menu","checkout","confirm"].includes(appState) && (
        <div style={{ ...S.root, background: t.bg, color: t.text }}>

          {/* Header */}
          <div style={S.header}>
            <div style={S.logoRow}>
              <span style={S.logoEmoji}>🔥</span>
              <div><div style={S.logoName}>THE STREET SNACK</div><div style={S.logoTagline}>{user ? `Bonjour ${user.name} 👋` : "Fast-food • Commande rapide"}</div></div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={() => setDark(p=>!p)} style={{ ...S.exitBtn, fontSize: 18, background: "rgba(255,255,255,0.15)" }}>{dark?"☀️":"🌙"}</button>
                {user && <button onClick={() => { setUser(null); setApp("auth"); }} style={S.exitBtn} title="Déconnexion">🚪</button>}
              </div>
            </div>
          </div>

          {/* ── MENU ── */}
          {appState === "menu" && (
            <>
              <div style={S.content}>
                {/* Suivi */}
                <div style={{ background: t.card, borderRadius: 14, padding: 14, marginBottom: 20, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#4fc3f7", marginBottom: 8 }}>🔍 Suivre une commande</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input style={{ ...S.input, flex: 1, padding: "10px 12px", fontSize: 13, background: t.bg, border: `1px solid ${t.border}`, color: t.text }} placeholder="ID de commande" value={trackInput} onChange={e => setTI(e.target.value)} type="number" />
                    <button style={{ background: "#0d1f2e", border: "1px solid #4fc3f7", color: "#4fc3f7", borderRadius: 10, padding: "0 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }} onClick={() => { if(trackInput){ setTrackId(Number(trackInput)); setApp("tracking"); } }}>Suivre</button>
                  </div>
                </div>

                {categories.map(cat => (
                  <div key={cat} style={{ marginBottom: 24 }}>
                    <div style={S.catTitle}>{cat}</div>
                    <div style={S.itemsGrid}>
                      {menu.filter(m => m.category === cat).map(item => {
                        const qty = cart[item.id]?.qty || 0;
                        const out = item.stock === 0;
                        return (
                          <div key={item.id} style={{ ...S.card, background: t.card, border: `1px solid ${t.border}`, ...(out?{opacity:0.4,filter:"grayscale(1)"}:{}) }}>
                            {item.image_url && <img src={item.image_url} alt={item.name} style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
                            <div style={S.cardTop}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ ...S.itemName, color: t.text }}>{item.name}</div>
                                {out && <span style={{ background: "#ff4444", color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "2px 5px" }}>ÉPUISÉ</span>}
                              </div>
                              <div style={S.itemDesc}>{item.description}</div>
                            </div>
                            <div style={S.cardBottom}>
                              <div style={S.itemPrice}>{fp(item.price)}</div>
                              <div style={S.qtyRow}>
                                {qty > 0 && !out && <><button style={S.qtyBtn} onClick={() => remItem(item.id)}>−</button><span style={S.qtyNum}>{qty}</span></>}
                                {!out && <button style={{ ...S.qtyBtn, ...S.addBtn }} onClick={() => addItem(item)}>+</button>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {totalQty > 0 && (
                <div style={S.cartBar} onClick={() => setApp("checkout")}>
                  <div style={S.cartBadge}>{totalQty}</div>
                  <span style={S.cartText}>Voir ma commande</span>
                  <span style={S.cartPrice}>{fp(totalPrice)}</span>
                </div>
              )}
            </>
          )}

          {/* ── CHECKOUT ── */}
          {appState === "checkout" && (
            <div style={S.content}>
              <div style={S.sectionTitle}>🧾 Récapitulatif</div>
              <div style={S.toggleRow}>
                <button style={{ ...S.toggleBtn, background: t.card, ...(orderType==="table"?S.toggleActive:{}) }} onClick={() => setOT("table")}>🪑 Table</button>
                <button style={{ ...S.toggleBtn, background: t.card, ...(orderType==="emporter"?S.toggleActive:{}) }} onClick={() => setOT("emporter")}>🛍️ À emporter</button>
              </div>
              {orderType === "table" && (
                <div style={S.fieldGroup}>
                  <label style={{ ...S.label, color: t.muted }}>Numéro de table *</label>
                  <input style={{ ...S.input, background: t.card, border: `1px solid ${t.border}`, color: t.text }} placeholder="Ex : 5" value={tableNum} onChange={e => setTN(e.target.value)} />
                </div>
              )}
              <div style={{ background: t.card, borderRadius: 14, padding: 14, marginBottom: 16, border: `1px solid ${t.border}` }}>
                {cartItems.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                      <button style={{ background: t.border, border: "none", color: t.text, borderRadius: 6, width: 24, height: 24, fontSize: 14, cursor: "pointer" }} onClick={() => remItem(item.id)}>−</button>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#ff9500", minWidth: 20 }}>{item.qty}×</span>
                      <button style={{ background: t.border, border: "none", color: t.text, borderRadius: 6, width: 24, height: 24, fontSize: 14, cursor: "pointer" }} onClick={() => addItem(item)}>+</button>
                      <span style={{ fontSize: 13, flex: 1, color: t.text }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: "nowrap" }}>{fp(item.qty*item.price)}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, color: t.text }}>
                  <span>Total</span><span style={{ color: "#ff9500", fontSize: 16 }}>{fp(totalPrice)}</span>
                </div>
              </div>
              <div style={S.fieldGroup}>
                <label style={{ ...S.label, color: t.muted }}>Mode de paiement *</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[{id:"especes",label:"💵 Espèces",desc:"Sur place"},{id:"wave",label:"🌊 Wave",desc:"Mobile Money"}].map(pm => (
                    <button key={pm.id} onClick={() => setPM(pm.id)} style={{ flex: 1, background: payMethod===pm.id?(pm.id==="wave"?"#001f2e":"#0d1f0d"):t.card, border: `2px solid ${payMethod===pm.id?(pm.id==="wave"?"#00a3e0":"#4caf50"):t.border}`, borderRadius: 12, padding: "12px 10px", cursor: "pointer", textAlign: "left", color: t.text }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{pm.label}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{pm.desc}</div>
                    </button>
                  ))}
                </div>
                {payMethod === "wave" && (
                  <div style={{ marginTop: 10, background: "#001f2e", border: "1px solid #00a3e0", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#7dd3f7" }}>
                    🌊 Vous serez redirigé vers Wave pour payer <strong>{fp(totalPrice)}</strong>. Le vendeur vérifiera le paiement avant de préparer votre commande.
                  </div>
                )}
              </div>
              <div style={S.fieldGroup}>
                <label style={{ ...S.label, color: t.muted }}>Instructions spéciales</label>
                <textarea style={{ ...S.input, resize: "vertical", background: t.card, border: `1px solid ${t.border}`, color: t.text }} placeholder="Sans oignon, extra sauce..." value={note} onChange={e => setNote(e.target.value)} rows={3} />
              </div>
              <button style={{ ...S.primaryBtn, background: payMethod==="wave"?"linear-gradient(135deg,#0072bc,#00a3e0)":"#25D366", opacity: submitting ? 0.7 : 1 }} onClick={sendOrder} disabled={submitting}>
                {submitting ? "⏳ Envoi..." : payMethod==="wave" ? "🌊 Payer avec Wave & Commander" : "✅ Confirmer ma commande"}
              </button>
              <button style={S.ghostBtn} onClick={() => setApp("menu")}>← Retour au menu</button>
            </div>
          )}

          {/* ── CONFIRM ── */}
          {appState === "confirm" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 10, color: "#25D366" }}>Commande envoyée !</div>
              <div style={{ fontSize: 14, color: "#888", marginBottom: 20, lineHeight: 1.7 }}>
                {payMethod === "wave" ? "Vérifiez que votre paiement Wave a été effectué.\nLe vendeur confirme après réception." : "Règlement en espèces sur place."}<br />
                Nous préparons votre commande !
              </div>
              {trackId && (
                <div style={{ background: t.card, border: "1px solid #4fc3f7", borderRadius: 14, padding: 18, marginBottom: 20, width: "100%", boxSizing: "border-box" }}>
                  <div style={{ fontSize: 13, color: "#4fc3f7", marginBottom: 8 }}>🔍 Suivez votre commande en direct</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: t.text, letterSpacing: 3 }}>#{trackId}</div>
                  <button style={{ ...S.primaryBtn, background: "#0d1f2e", color: "#4fc3f7", border: "1px solid #4fc3f7", marginTop: 12, marginBottom: 0 }} onClick={() => setApp("tracking")}>
                    📡 Suivi en temps réel
                  </button>
                </div>
              )}
              <button style={S.ghostBtn} onClick={reset}>Passer une nouvelle commande</button>
            </div>
          )}

        </div>
      )}
    </ThemeCtx.Provider>
  );
}

// ─── THÈMES ──────────────────────────────────────────────────────────────────
const D = { bg:"#0f0f0f", card:"#1a1a1a", border:"#2a2a2a", text:"#f0f0f0", muted:"#888" };
const L = { bg:"#f5f5f5", card:"#ffffff", border:"#e0e0e0", text:"#111111", muted:"#666666" };

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  root:{ fontFamily:"'Sora','Segoe UI',sans-serif", minHeight:"100vh", paddingBottom:100 },
  header:{ background:"linear-gradient(135deg,#ff6b00,#ff9500)", padding:"18px 16px", position:"sticky", top:0, zIndex:10, boxShadow:"0 4px 20px rgba(255,107,0,0.4)" },
  logoRow:{ display:"flex", alignItems:"center", gap:12 },
  logoEmoji:{ fontSize:32, cursor:"pointer", userSelect:"none" },
  logoName:{ fontSize:18, fontWeight:900, letterSpacing:1, color:"#fff" },
  logoTagline:{ fontSize:11, color:"rgba(255,255,255,0.85)", marginTop:1 },
  exitBtn:{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:8, width:34, height:34, fontSize:14, cursor:"pointer" },
  content:{ padding:"16px 12px" },
  catTitle:{ fontSize:15, fontWeight:700, color:"#ff9500", marginBottom:10, paddingBottom:6, borderBottom:"1px solid #2a2a2a" },
  itemsGrid:{ display:"flex", flexDirection:"column", gap:10 },
  card:{ borderRadius:14, padding:"12px 14px", display:"flex", alignItems:"flex-end", gap:10 },
  cardTop:{ flex:1 },
  itemName:{ fontWeight:700, fontSize:14, marginBottom:3 },
  itemDesc:{ fontSize:11, color:"#888", lineHeight:1.4 },
  cardBottom:{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, minWidth:86 },
  itemPrice:{ fontSize:13, fontWeight:700, color:"#ff9500", whiteSpace:"nowrap" },
  qtyRow:{ display:"flex", alignItems:"center", gap:6 },
  qtyBtn:{ background:"#2a2a2a", border:"none", color:"#fff", borderRadius:8, width:28, height:28, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  addBtn:{ background:"#ff6b00" },
  qtyNum:{ fontSize:15, fontWeight:700, minWidth:16, textAlign:"center" },
  cartBar:{ position:"fixed", bottom:16, left:12, right:12, background:"#ff6b00", borderRadius:16, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", boxShadow:"0 8px 30px rgba(255,107,0,0.5)", zIndex:99 },
  cartBadge:{ background:"#fff", color:"#ff6b00", borderRadius:999, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13 },
  cartText:{ fontWeight:700, fontSize:15, color:"#fff", flex:1, marginLeft:10 },
  cartPrice:{ fontWeight:800, fontSize:14, color:"#fff" },
  sectionTitle:{ fontSize:18, fontWeight:800, marginBottom:16, color:"#ff9500" },
  toggleRow:{ display:"flex", gap:10, marginBottom:16 },
  toggleBtn:{ flex:1, padding:"10px", borderRadius:12, border:"2px solid #2a2a2a", color:"#888", fontWeight:600, fontSize:14, cursor:"pointer" },
  toggleActive:{ border:"2px solid #ff6b00", color:"#ff6b00", background:"#1f1200" },
  fieldGroup:{ marginBottom:14 },
  label:{ display:"block", fontSize:13, color:"#aaa", marginBottom:6 },
  input:{ width:"100%", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:10, padding:"12px 14px", color:"#fff", fontSize:15, boxSizing:"border-box", outline:"none" },
  primaryBtn:{ width:"100%", background:"#ff6b00", color:"#fff", border:"none", borderRadius:14, padding:"14px", fontSize:15, fontWeight:700, cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxSizing:"border-box" },
  ghostBtn:{ width:"100%", background:"transparent", color:"#888", border:"1px solid #2a2a2a", borderRadius:14, padding:"12px", fontSize:14, cursor:"pointer", marginBottom:8, boxSizing:"border-box" },
  statsRow:{ display:"flex", gap:10, marginBottom:16 },
  statBox:{ flex:1, borderRadius:12, padding:"12px 8px", textAlign:"center", border:"1px solid #2a2a2a" },
  statNum:{ fontSize:18, fontWeight:800, color:"#fff" },
  statLabel:{ fontSize:10, color:"#888", marginTop:2 },
  modalOverlay:{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:24 },
  modal:{ background:"#1a1a1a", borderRadius:18, padding:24, width:"100%", maxWidth:320, textAlign:"center", border:"1px solid #2a2a2a" },
  modalTitle:{ fontSize:18, fontWeight:700, marginBottom:16, color:"#fff" },
};
