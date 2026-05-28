/* eslint-disable */
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://udgbxqnaocsroeadmbgh.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkZ2J4cW5hb2Nzcm9lYWRtYmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjU5MzAsImV4cCI6MjA5NDI0MTkzMH0.WWXiOc-hBcbFnloTkoHIKUxhtbjobHa33UU3rmoSSsk";
const APP_URL       = window.location.href.split("?")[0];

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── THÈMES (définis tôt pour être accessibles partout) ───────────────────────
const D = { bg:"#0f0f0f", card:"#1a1a1a", border:"#2a2a2a", text:"#f0f0f0", muted:"#888" };
const L = { bg:"#f5f5f5", card:"#ffffff", border:"#e0e0e0", text:"#111111", muted:"#666666" };

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
// AUTH — STYLE GLOVO
// ══════════════════════════════════════════════════════════════════════════════
function AuthScreen({ onAuth }) {
  const [name, setName]   = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState("");
  const [step, setStep]   = useState("name"); // name | phone

  const goNext = () => {
    if (!name.trim() || name.trim().length < 2) { setErr("Entrez votre prénom (min. 2 caractères)"); return; }
    setErr(""); setStep("phone");
  };

  const handleAuth = async () => {
    setErr(""); setLoading(true);
    if (!phone.trim() || phone.replace(/\D/g,"").length < 8) { setErr("Numéro invalide (min. 8 chiffres)"); setLoading(false); return; }
    const cleanPhone = phone.replace(/\s/g,"");
    const { data: existing } = await sb.from("profiles").select("*").eq("phone", cleanPhone).maybeSingle();
    if (existing) {
      await sb.from("profiles").update({ name }).eq("phone", cleanPhone);
      onAuth({ ...existing, name });
    } else {
      const { data: profile, error } = await sb.from("profiles").insert({ id: crypto.randomUUID(), name, phone: cleanPhone, role: "client" }).select().single();
      if (error) { setErr("Erreur. Réessayez."); setLoading(false); return; }
      onAuth(profile);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0f0f0f", display:"flex", flexDirection:"column" }}>
      {/* Header orange style Glovo */}
      <div style={{ background:"linear-gradient(160deg,#ff6b00 0%,#ff9500 100%)", padding:"48px 24px 32px", textAlign:"center" }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, margin:"0 auto 16px", backdropFilter:"blur(10px)" }}>🔥</div>
        <div style={{ fontSize:24, fontWeight:900, color:"#fff", letterSpacing:1, marginBottom:4 }}>THE STREET SNACK</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.85)" }}>Fast-food • Commande rapide</div>
      </div>

      {/* Formulaire */}
      <div style={{ flex:1, background:"#0f0f0f", borderRadius:"24px 24px 0 0", marginTop:-20, padding:"32px 24px" }}>
        {step === "name" ? (
          <>
            <div style={{ fontSize:22, fontWeight:800, color:"#fff", marginBottom:6 }}>Bonjour ! 👋</div>
            <div style={{ fontSize:14, color:"#888", marginBottom:28 }}>Comment tu t'appelles ?</div>
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && goNext()}
              placeholder="Ton prénom"
              style={{ width:"100%", background:"#1a1a1a", border:`2px solid ${err?"#ff4444":name?"#ff6b00":"#2a2a2a"}`, borderRadius:14, padding:"16px", color:"#fff", fontSize:18, fontWeight:600, boxSizing:"border-box", outline:"none", marginBottom:12 }}
            />
            {err && <div style={{ color:"#ff4444", fontSize:13, marginBottom:12 }}>⚠️ {err}</div>}
            <button onClick={goNext} style={{ width:"100%", background:"#ff6b00", color:"#fff", border:"none", borderRadius:14, padding:"16px", fontSize:16, fontWeight:700, cursor:"pointer", boxShadow:"0 6px 20px rgba(255,107,0,0.35)" }}>
              Continuer →
            </button>
          </>
        ) : (
          <>
            <button onClick={() => { setStep("name"); setErr(""); }} style={{ background:"transparent", border:"none", color:"#888", fontSize:14, cursor:"pointer", marginBottom:20, padding:0, display:"flex", alignItems:"center", gap:6 }}>
              ← Retour
            </button>
            <div style={{ fontSize:22, fontWeight:800, color:"#fff", marginBottom:6 }}>Ton numéro 📱</div>
            <div style={{ fontSize:14, color:"#888", marginBottom:28 }}>Pour retrouver tes commandes</div>
            <input
              autoFocus
              value={phone}
              onChange={e => { setPhone(e.target.value); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && handleAuth()}
              placeholder="Ex : 0102030405"
              type="tel"
              style={{ width:"100%", background:"#1a1a1a", border:`2px solid ${err?"#ff4444":phone?"#ff6b00":"#2a2a2a"}`, borderRadius:14, padding:"16px", color:"#fff", fontSize:18, fontWeight:600, boxSizing:"border-box", outline:"none", marginBottom:12 }}
            />
            {err && <div style={{ color:"#ff4444", fontSize:13, marginBottom:12 }}>⚠️ {err}</div>}
            <button onClick={handleAuth} disabled={loading} style={{ width:"100%", background: loading?"#555":"#ff6b00", color:"#fff", border:"none", borderRadius:14, padding:"16px", fontSize:16, fontWeight:700, cursor: loading?"not-allowed":"pointer", boxShadow:"0 6px 20px rgba(255,107,0,0.35)" }}>
              {loading ? "⏳ Chargement..." : `Accéder au menu 🍖`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HISTORIQUE COMMANDES CLIENT (style Glovo)
// ══════════════════════════════════════════════════════════════════════════════
function OrderHistory({ user, onViewOrder, onBack }) {
  const [orders, setOrders] = useState([]);
  const [tab, setTab]       = useState("active"); // active | history
  const [loading, setLoading] = useState(true);
  const { dark } = useTheme();
  const t = dark ? D : L;

  useEffect(() => {
    const fetch = async () => {
      const { data } = await sb.from("orders")
        .select("*, order_items(*)")
        .eq("client_phone", user?.phone)
        .order("created_at", { ascending: false });
      if (data) setOrders(data);
      setLoading(false);
    };
    fetch();
    const channel = sb.channel("history-" + user?.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetch)
      .subscribe();
    return () => sb.removeChannel(channel);
  }, [user]);

  const active  = orders.filter(o => o.status !== "delivered");
  const history = orders.filter(o => o.status === "delivered");
  const shown   = tab === "active" ? active : history;

  const statusColor = { pending:"#ff9500", confirmed:"#4fc3f7", preparing:"#a78bfa", ready:"#25D366", delivered:"#888" };
  const statusIcon  = { pending:"⏳", confirmed:"✅", preparing:"👨‍🍳", ready:"🔔", delivered:"🎉" };
  const statusLabel = { pending:"En attente", confirmed:"Confirmée", preparing:"En préparation", ready:"Prête !", delivered:"Livrée" };

  return (
    <div style={{ ...S.root, background: t.bg, color: t.text }}>
      <div style={S.header}>
        <div style={S.logoRow}>
          <button onClick={onBack} style={{ ...S.exitBtn, marginRight: 4 }}>←</button>
          <span style={S.logoEmoji}>📦</span>
          <div><div style={S.logoName}>Mes commandes</div><div style={S.logoTagline}>{user?.name} · {user?.phone}</div></div>
        </div>
      </div>

      {/* Tabs style Glovo */}
      <div style={{ display: "flex", background: t.card, borderBottom: `1px solid ${t.border}` }}>
        {[["active","En cours"],["history","Historique"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "14px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, background: "transparent", color: tab === k ? "#ff6b00" : t.muted, borderBottom: tab === k ? "3px solid #ff6b00" : "3px solid transparent" }}>
            {l}
            {k === "active" && active.length > 0 && <span style={{ background: "#ff6b00", color: "#fff", borderRadius: 999, fontSize: 10, padding: "1px 6px", marginLeft: 6 }}>{active.length}</span>}
          </button>
        ))}
      </div>

      <div style={S.content}>
        {loading && <div style={{ textAlign: "center", padding: 60, color: "#555" }}>⏳ Chargement...</div>}

        {!loading && shown.length === 0 && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>{tab === "active" ? "🛍️" : "📋"}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: t.text, marginBottom: 8 }}>
              {tab === "active" ? "Aucune commande en cours" : "Aucun historique"}
            </div>
            <div style={{ fontSize: 13, color: t.muted }}>
              {tab === "active" ? "Vos commandes en cours apparaîtront ici" : "Vos commandes passées apparaîtront ici"}
            </div>
          </div>
        )}

        {shown.map(order => {
          const st = order.status;
          const isActive = st !== "delivered";
          return (
            <div key={order.id} onClick={() => isActive && onViewOrder(order.id)}
              style={{ background: t.card, borderRadius: 16, marginBottom: 12, border: `1px solid ${t.border}`, overflow: "hidden", cursor: isActive ? "pointer" : "default", opacity: 1 }}>
              {/* Bande statut */}
              <div style={{ background: statusColor[st] + "22", borderLeft: `4px solid ${statusColor[st]}`, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: statusColor[st], fontWeight: 700, fontSize: 13 }}>{statusIcon[st]} {statusLabel[st]}</span>
                <span style={{ fontSize: 11, color: t.muted }}>{ft(order.created_at)}</span>
              </div>
              {/* Contenu */}
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: t.muted }}>Commande #{order.id}</span>
                  <span style={{ fontSize: 12, color: t.muted }}>{order.order_type === "table" ? `🪑 Table ${order.table_number}` : "🛍️ À emporter"}</span>
                </div>
                {(order.order_items || []).slice(0, 3).map((it, i) => (
                  <div key={i} style={{ fontSize: 13, color: t.text, marginBottom: 4 }}>
                    <span style={{ color: "#ff9500", fontWeight: 700 }}>{it.quantity}×</span> {it.name}
                  </div>
                ))}
                {(order.order_items || []).length > 3 && (
                  <div style={{ fontSize: 12, color: t.muted }}>+ {order.order_items.length - 3} autre(s) article(s)</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: "#ff9500" }}>{fp(order.total)}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {isActive && <span style={{ fontSize: 12, color: "#4fc3f7", fontWeight: 700 }}>Suivre →</span>}
                    {st === "delivered" && <button style={{ background: "transparent", border: "1px solid #555", color: "#888", borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); generateReceiptPDF(order, order.order_items||[]); }}>📄 Reçu</button>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
        payload => setOrder(payload.new))
      .subscribe();
    return () => sb.removeChannel(channel);
  }, [fetchOrder, orderId]);

  const cidx = STEPS_LIST.indexOf(order?.status || "pending");
  const st   = ORDER_STATUSES[order?.status] || ORDER_STATUSES.pending;

  if (loading) return <div style={{ ...S.root, background: t.bg }}><div style={{ textAlign: "center", padding: 80, color: "#555" }}>Chargement...</div></div>;

  return (
    <div style={{ ...S.root, background: t.bg }}>
      <div style={S.header}>
        <div style={S.logoRow}>
          <span style={S.logoEmoji}>🔥</span>
          <div><div style={{ ...S.logoName }}>THE STREET SNACK</div><div style={S.logoTagline}>Suivi commande</div></div>
          <button onClick={onBack} style={S.exitBtn}>✕</button>
        </div>
      </div>
      <div style={S.content}>
        {/* Statut */}
        <div style={{ background: st.bg, border: `2px solid ${st.color}`, borderRadius: 18, padding: 24, textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>{st.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: st.color }}>{st.label}</div>
          {order?.status === "ready" && <div style={{ fontSize: 13, color: "#25D366", marginTop: 8, fontWeight: 600 }}>🔔 Prête ! Venez récupérer votre commande.</div>}
          {order?.status === "preparing" && <div style={{ fontSize: 13, color: "#a78bfa", marginTop: 8 }}>On prépare votre commande, encore un peu...</div>}
        </div>

        {/* Progression */}
        <div style={{ background: t.card, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
            <div style={{ position: "absolute", top: 12, left: "10%", right: "10%", height: 3, background: t.border, borderRadius: 3 }} />
            <div style={{ position: "absolute", top: 12, left: "10%", height: 3, width: `${Math.max(0, (cidx / (STEPS_LIST.length - 1)) * 80)}%`, background: "#ff6b00", borderRadius: 3, transition: "width 0.5s" }} />
            {STEPS_LIST.map((s, i) => (
              <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, flex: 1 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: i <= cidx ? "#ff6b00" : t.border, border: `2px solid ${i <= cidx ? "#ff6b00" : t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff" }}>{i <= cidx ? "✓" : ""}</div>
                <div style={{ fontSize: 9, color: i <= cidx ? "#ff9500" : "#555", marginTop: 4, textAlign: "center", lineHeight: 1.2 }}>{ORDER_STATUSES[s].label.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Récap articles */}
        <div style={{ background: t.card, borderRadius: 14, padding: 14, marginBottom: 16, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#ff9500", marginBottom: 10 }}>📋 Votre commande #{orderId}</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
            👤 {order?.client_name} • {order?.order_type === "table" ? `🪑 Table ${order?.table_number}` : "🛍️ À emporter"} • {order?.created_at && ft(order.created_at)}
          </div>
          {items.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, color: t.text }}>
              <span>{it.quantity}× {it.name}</span><span style={{ color: "#ff9500" }}>{fp(it.price * it.quantity)}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, color: t.text }}>
            <span>Total</span><span style={{ color: "#ff9500" }}>{fp(order?.total)}</span>
          </div>
        </div>

        {/* PDF reçu */}
        {order?.status === "delivered" && (
          <button style={{ ...S.primaryBtn, background: "#1a1a2e", border: "1px solid #4fc3f7", color: "#4fc3f7" }}
            onClick={() => generateReceiptPDF(order, items)}>
            📄 Télécharger le reçu PDF
          </button>
        )}
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#444" }}>Mis à jour en temps réel via Supabase</div>
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
  // Restaurer session depuis localStorage
  const savedUser = (() => { try { const u = localStorage.getItem("ss_user"); return u ? JSON.parse(u) : null; } catch { return null; } })();

  const [dark, setDark]       = useState(true);
  const [appState, setApp]    = useState(savedUser ? "menu" : "splash");
  const [user, setUser]       = useState(savedUser);
  const [menu, setMenu]       = useState([]);
  const [cart, setCart]       = useState({});
  const [selCat, setSelCat]   = useState(null);
  const [orderType, setOT]    = useState("table");
  const [tableNum, setTN]     = useState("");
  const [note, setNote]       = useState("");
  const [trackId, setTrackId] = useState(null);
  const [submitting, setSub]  = useState(false);
  const [search, setSearch]   = useState("");
  const t = dark ? D : L;

  // Sauvegarder user dans localStorage à chaque changement
  useEffect(() => {
    if (user) localStorage.setItem("ss_user", JSON.stringify(user));
    else localStorage.removeItem("ss_user");
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tbl = params.get("table");
    if (tbl) { setTN(tbl); setOT("table"); }
  }, []);

  useEffect(() => {
    sb.from("menu_items").select("*").eq("available", true).order("category").order("sort_order")
      .then(({ data }) => { if (data) { setMenu(data); setSelCat(data[0]?.category || null); } });
  }, []);

  const cartItems  = Object.values(cart);
  const totalQty   = cartItems.reduce((s,i) => s+i.qty, 0);
  const totalPrice = cartItems.reduce((s,i) => s+i.qty*i.price, 0);
  const categories = [...new Set(menu.map(m => m.category))];

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

  const sendOrder = async () => {
    if (orderType === "table" && !tableNum.trim()) { alert("Numéro de table requis."); return; }
    setSub(true);
    const { data: order, error } = await sb.from("orders").insert({
      client_id:      user?.id || null,
      client_name:    user?.name || "Client",
      client_phone:   user?.phone || "",
      table_number:   orderType === "table" ? parseInt(tableNum) : null,
      order_type:     orderType,
      payment_method: "especes",
      payment_status: "confirmed",
      status:         "pending",
      note,
      total:          totalPrice,
    }).select().single();
    if (error || !order) { alert("Erreur lors de la commande."); setSub(false); return; }
    await sb.from("order_items").insert(
      cartItems.map(i => ({ order_id: order.id, menu_item_id: i.id, name: i.name, price: i.price, quantity: i.qty }))
    );
    setTrackId(order.id);
    setCart({});
    setNote("");
    setSub(false);
    setApp("tracking");
  };

  const filteredMenu = search.trim()
    ? menu.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : menu.filter(m => m.category === selCat);

  // ── ROUTING ──
  if (appState === "splash") return (
    <ThemeCtx.Provider value={{ dark, toggle: ()=>setDark(p=>!p) }}>
      <SplashScreen onDone={() => setApp("auth")} />
    </ThemeCtx.Provider>
  );

  return (
    <ThemeCtx.Provider value={{ dark, toggle: () => setDark(p => !p) }}>
      {appState === "auth"     && <AuthScreen onAuth={u => { setUser(u); localStorage.setItem("ss_user", JSON.stringify(u)); setApp("menu"); }} />}
      {appState === "tracking" && <OrderTracking orderId={trackId} onBack={() => setApp("menu")} />}
      {appState === "history"  && <OrderHistory user={user || JSON.parse(localStorage.getItem("ss_user") || "{}")} onViewOrder={id => { setTrackId(id); setApp("tracking"); }} onBack={() => setApp("menu")} />}

      {["menu","checkout"].includes(appState) && (
        <div style={{ fontFamily:"'Sora','Segoe UI',sans-serif", minHeight:"100vh", background: t.bg, color: t.text, paddingBottom: 100 }}>

          {/* ════ HEADER GLOVO ════ */}
          <div style={{ background: dark ? "#111" : "#fff", padding:"14px 16px", position:"sticky", top:0, zIndex:20, borderBottom:`1px solid ${t.border}`, boxShadow:"0 2px 12px rgba(0,0,0,0.15)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: appState==="menu" ? 12 : 0 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#ff6b00,#ff9500)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🔥</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:900, color: t.text, letterSpacing:0.5 }}>THE STREET SNACK</div>
                <div style={{ fontSize:11, color:"#ff9500", fontWeight:600 }}>
                  {user ? `👋 ${user.name}` : "Fast-food • Commande rapide"}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => setDark(p=>!p)} style={{ background: t.card, border:`1px solid ${t.border}`, color: t.text, borderRadius:10, width:34, height:34, fontSize:16, cursor:"pointer" }}>{dark?"☀️":"🌙"}</button>
                {/* Bouton commandes style Glovo */}
                <button onClick={() => setApp("history")} style={{ background: t.card, border:`1px solid ${t.border}`, color: t.text, borderRadius:10, width:34, height:34, fontSize:16, cursor:"pointer", position:"relative" }}>
                  📦
                </button>
                {user && <button onClick={() => { setUser(null); localStorage.removeItem("ss_user"); setApp("auth"); }} style={{ background: t.card, border:`1px solid ${t.border}`, color: t.muted, borderRadius:10, width:34, height:34, fontSize:14, cursor:"pointer" }}>🚪</button>}
              </div>
            </div>

            {/* Barre de recherche style Glovo */}
            {appState === "menu" && (
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:16, color:"#888" }}>🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un plat..."
                  style={{ width:"100%", background: t.card, border:`1px solid ${t.border}`, borderRadius:12, padding:"10px 12px 10px 38px", color: t.text, fontSize:14, boxSizing:"border-box", outline:"none" }}
                />
              </div>
            )}
          </div>

          {/* ════ MENU ════ */}
          {appState === "menu" && (
            <>
              {/* Catégories horizontales style Glovo */}
              {!search.trim() && (
                <div style={{ display:"flex", gap:8, padding:"12px 16px", overflowX:"auto", borderBottom:`1px solid ${t.border}`, background: dark ? "#111" : "#fff" }}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSelCat(cat)} style={{ flexShrink:0, padding:"8px 16px", borderRadius:20, border:"none", cursor:"pointer", fontWeight:700, fontSize:13, background: selCat===cat ? "#ff6b00" : t.card, color: selCat===cat ? "#fff" : t.muted, border: `1px solid ${selCat===cat ? "#ff6b00" : t.border}`, transition:"all 0.2s" }}>
                      {cat === "Pain Brochette" ? "🥖 Pain Brochette" :
                       cat === "Steak et Poulet" ? "🥩 Steak & Poulet" :
                       cat === "Supplément" ? "➕ Suppléments" :
                       cat === "Boissons" ? "🥤 Boissons" : cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Titre catégorie ou recherche */}
              <div style={{ padding:"16px 16px 8px" }}>
                <div style={{ fontSize:18, fontWeight:800, color: t.text }}>
                  {search.trim() ? `🔍 "${search}"` : selCat}
                </div>
                {!search.trim() && <div style={{ fontSize:12, color: t.muted, marginTop:2 }}>{menu.filter(m=>m.category===selCat).length} articles</div>}
              </div>

              {/* Grille articles style Glovo */}
              <div style={{ padding:"0 12px" }}>
                {filteredMenu.length === 0 && (
                  <div style={{ textAlign:"center", padding:"40px 0", color: t.muted }}>
                    <div style={{ fontSize:40, marginBottom:10 }}>🍽️</div>
                    <div>Aucun article trouvé</div>
                  </div>
                )}
                {filteredMenu.map(item => {
                  const qty = cart[item.id]?.qty || 0;
                  const out = item.stock === 0;
                  return (
                    <div key={item.id} style={{ display:"flex", gap:12, padding:"14px 0", borderBottom:`1px solid ${t.border}`, opacity: out ? 0.5 : 1 }}>
                      {/* Photo ou placeholder */}
                      <div style={{ width:90, height:90, borderRadius:14, background: item.image_url ? "transparent" : "linear-gradient(135deg,#1f1200,#2a1800)", flexShrink:0, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>
                        {item.image_url
                          ? <img src={item.image_url} alt={item.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                          : (item.category==="Boissons" ? "🥤" : item.category==="Supplément" ? "➕" : "🔥")
                        }
                      </div>
                      {/* Infos */}
                      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                        <div>
                          <div style={{ fontSize:14, fontWeight:700, color: t.text, marginBottom:3, display:"flex", alignItems:"center", gap:6 }}>
                            {item.name}
                            {out && <span style={{ background:"#ff4444", color:"#fff", fontSize:9, fontWeight:800, borderRadius:4, padding:"2px 5px" }}>ÉPUISÉ</span>}
                          </div>
                          <div style={{ fontSize:12, color: t.muted, lineHeight:1.4 }}>{item.description}</div>
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
                          <span style={{ fontSize:15, fontWeight:800, color:"#ff9500" }}>{fp(item.price)}</span>
                          {/* Boutons quantité style Glovo */}
                          {!out && (
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              {qty > 0 && (
                                <>
                                  <button onClick={() => remItem(item.id)} style={{ width:30, height:30, borderRadius:"50%", background:"#ff6b00", border:"none", color:"#fff", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>−</button>
                                  <span style={{ fontSize:16, fontWeight:800, color: t.text, minWidth:20, textAlign:"center" }}>{qty}</span>
                                </>
                              )}
                              <button onClick={() => addItem(item)} style={{ width:30, height:30, borderRadius:"50%", background:"#ff6b00", border:"none", color:"#fff", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ════ CHECKOUT STYLE GLOVO ════ */}
          {appState === "checkout" && (
            <div style={{ padding:"16px 14px" }}>

              {/* Back button */}
              <button onClick={() => setApp("menu")} style={{ background:"transparent", border:"none", color: t.muted, fontSize:14, cursor:"pointer", marginBottom:16, padding:0, display:"flex", alignItems:"center", gap:6 }}>
                ← Retour au menu
              </button>

              <div style={{ fontSize:20, fontWeight:800, color: t.text, marginBottom:20 }}>Ta commande 🧾</div>

              {/* Articles */}
              <div style={{ background: t.card, borderRadius:16, padding:16, marginBottom:16, border:`1px solid ${t.border}` }}>
                {cartItems.map(item => (
                  <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:12, marginBottom:12, borderBottom:`1px solid ${t.border}` }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600, color: t.text }}>{item.name}</div>
                      <div style={{ fontSize:13, color:"#ff9500", fontWeight:700, marginTop:2 }}>{fp(item.price)}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <button onClick={() => remItem(item.id)} style={{ width:28, height:28, borderRadius:"50%", background:"#2a2a2a", border:"none", color:"#fff", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                      <span style={{ fontSize:15, fontWeight:800, color: t.text, minWidth:20, textAlign:"center" }}>{item.qty}</span>
                      <button onClick={() => addItem(item)} style={{ width:28, height:28, borderRadius:"50%", background:"#ff6b00", border:"none", color:"#fff", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color: t.text, marginLeft:12, minWidth:70, textAlign:"right" }}>{fp(item.qty*item.price)}</div>
                  </div>
                ))}
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:17, fontWeight:800, color: t.text, paddingTop:4 }}>
                  <span>Total</span>
                  <span style={{ color:"#ff9500" }}>{fp(totalPrice)}</span>
                </div>
              </div>

              {/* Mode de livraison */}
              <div style={{ fontSize:14, fontWeight:700, color: t.text, marginBottom:10 }}>📍 Mode de réception</div>
              <div style={{ display:"flex", gap:10, marginBottom:16 }}>
                {[{k:"table",icon:"🪑",label:"Sur table"},{k:"emporter",icon:"🛍️",label:"À emporter"}].map(({k,icon,label}) => (
                  <button key={k} onClick={() => setOT(k)} style={{ flex:1, padding:"14px 10px", borderRadius:14, border:`2px solid ${orderType===k?"#ff6b00":t.border}`, background: orderType===k?"#1f1200":t.card, cursor:"pointer", textAlign:"center" }}>
                    <div style={{ fontSize:24, marginBottom:4 }}>{icon}</div>
                    <div style={{ fontSize:13, fontWeight:700, color: orderType===k?"#ff9500":t.muted }}>{label}</div>
                  </button>
                ))}
              </div>

              {orderType === "table" && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:700, color: t.text, marginBottom:8 }}>🪑 Numéro de table</div>
                  <input
                    style={{ width:"100%", background: t.card, border:`2px solid ${tableNum ? "#ff6b00" : t.border}`, borderRadius:12, padding:"14px", color: t.text, fontSize:16, boxSizing:"border-box", outline:"none", textAlign:"center", fontWeight:700 }}
                    placeholder="Ex : 5"
                    value={tableNum}
                    onChange={e => setTN(e.target.value)}
                    type="number"
                  />
                </div>
              )}

              {/* Note */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color: t.text, marginBottom:8 }}>📝 Instructions spéciales <span style={{ color: t.muted, fontWeight:400 }}>(optionnel)</span></div>
                <textarea
                  style={{ width:"100%", background: t.card, border:`1px solid ${t.border}`, borderRadius:12, padding:"12px 14px", color: t.text, fontSize:14, boxSizing:"border-box", outline:"none", resize:"none" }}
                  placeholder="Sans oignon, extra sauce, bien cuit..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Paiement — espèces uniquement */}
              <div style={{ background: t.card, borderRadius:14, padding:"14px 16px", marginBottom:20, border:`1px solid ${t.border}`, display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:"#0d2a0d", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>💵</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color: t.text }}>Paiement en espèces</div>
                  <div style={{ fontSize:12, color: t.muted }}>Règlement sur place à la livraison</div>
                </div>
                <div style={{ marginLeft:"auto", color:"#25D366", fontWeight:800, fontSize:13 }}>✓</div>
              </div>

              {/* Bouton commander */}
              <button
                onClick={sendOrder}
                disabled={submitting}
                style={{ width:"100%", background: submitting?"#555":"linear-gradient(135deg,#ff6b00,#ff9500)", color:"#fff", border:"none", borderRadius:16, padding:"16px", fontSize:16, fontWeight:800, cursor: submitting?"not-allowed":"pointer", boxShadow:"0 6px 20px rgba(255,107,0,0.4)", boxSizing:"border-box" }}
              >
                {submitting ? "⏳ Envoi en cours..." : `✅ Commander — ${fp(totalPrice)}`}
              </button>
            </div>
          )}

          {/* Cart bar fixe */}
          {appState === "menu" && totalQty > 0 && (
            <div onClick={() => setApp("checkout")} style={{ position:"fixed", bottom:16, left:12, right:12, background:"#ff6b00", borderRadius:16, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", boxShadow:"0 8px 30px rgba(255,107,0,0.5)", zIndex:99 }}>
              <div style={{ background:"rgba(255,255,255,0.25)", borderRadius:999, width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13, color:"#fff" }}>{totalQty}</div>
              <span style={{ fontWeight:700, fontSize:15, color:"#fff", flex:1, marginLeft:12 }}>Voir ma commande</span>
              <span style={{ fontWeight:800, fontSize:14, color:"#fff" }}>{fp(totalPrice)}</span>
            </div>
          )}

        </div>
      )}
    </ThemeCtx.Provider>
  );
}

