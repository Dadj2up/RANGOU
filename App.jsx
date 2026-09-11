import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart,
  ArrowLeft,
  Search,
  Plus,
  User,
  Package,
  Warehouse,
  CreditCard,
  Tag,
  Image as ImageIcon,
  Phone,
  FileText,
  MapPin,
  Smartphone,
  Banknote,
  Loader2,
  CheckCircle2,
} from "lucide-react";

const INK = "#1C2333";
const BLUE = "#33507E";
const BLUE_DARK = "#25395C";
const GOLD = "#C88A2E";
const PAPER = "#F6F4EF";
const CARD = "#FFFFFF";
const LINE = "#E7E3D8";

const STOCK_KEY = "rangou:stock";
const ABONNEMENT_KEY = "rangou:abonnements";

// Tarifs des abonnements : les durées disponibles et le prix diffèrent selon
// qu'il s'agit d'un fournisseur ou d'un revendeur.
const PRICING = {
  Revendeur: { "1": 1000, "3": 2500, "12": 10000 },
  Fournisseur: { "1": 5000, "2": 7500, "12": 25000 },
};
const DUREE_LABEL = { "1": "1 mois", "2": "2 mois", "3": "3 mois", "12": "12 mois" };

// Moyens de paiement proposés pour régler l'abonnement avant de recevoir la carte.
const PAYMENT_METHODS = [
  { id: "orange", label: "Orange Money", icon: Smartphone },
  { id: "mtn", label: "MTN Mobile Money", icon: Smartphone },
  { id: "moov", label: "Moov Money", icon: Smartphone },
  { id: "wave", label: "Wave", icon: Smartphone },
  { id: "carte", label: "Carte bancaire", icon: CreditCard },
  { id: "especes", label: "Espèces (à l'agence)", icon: Banknote },
];

// Aucun produit pré-rempli : n'importe quel type de marchandise (alimentaire,
// électronique, vêtement, matériaux, etc.) peut être ajouté par un fournisseur.
const seedStock = [];

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function fmtFCFA(n) {
  return `${Number(n).toLocaleString("fr-FR")} FCFA`;
}

function genCardNumber() {
  const block = () => String(Math.floor(1000 + Math.random() * 9000));
  return `RGA-${block()}-${block()}`;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function fmtDate(d) {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Essaie d'extraire des coordonnées (lat, lng) d'un lien Google Maps collé
// par l'utilisateur, quel que soit son format (@lat,lng / q=lat,lng / ll=lat,lng).
function parseMapsLink(text) {
  if (!text) return null;
  const patterns = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}

// Convertit un texte de lieu (ex : "Yopougon, Abidjan") en coordonnées GPS
// automatiquement, via un service de géocodage public, sans action de l'utilisateur.
async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
    query
  )}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("geocode failed");
  const data = await res.json();
  if (data && data[0]) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }
  return null;
}

function mapEmbedUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
}

function Screen({ children }) {
  return (
    <div
      style={{
        maxWidth: 380,
        margin: "0 auto",
        minHeight: 640,
        background: PAPER,
        borderRadius: 28,
        padding: "28px 22px 26px",
        fontFamily:
          "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
        color: INK,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 1px 3px rgba(28,35,51,0.08)",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

function TopBar({ title, onBack, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 22,
      }}
    >
      <button
        onClick={onBack}
        aria-label="Retour"
        style={{
          border: "none",
          background: "transparent",
          padding: 6,
          marginLeft: -6,
          cursor: onBack ? "pointer" : "default",
          visibility: onBack ? "visible" : "hidden",
          color: INK,
        }}
      >
        <ArrowLeft size={22} />
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>
        {title}
      </h1>
      <div style={{ width: 28 }}>{right}</div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "15px 18px",
        borderRadius: 16,
        border: "none",
        background: disabled ? "#A9B4C4" : BLUE,
        color: "#fff",
        fontSize: 16,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s ease, transform 0.05s ease",
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.98)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: "#6B7385", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  borderRadius: 13,
  border: `1px solid ${LINE}`,
  background: CARD,
  fontSize: 15,
  color: INK,
  outline: "none",
  fontFamily: "inherit",
};

export default function App() {
  const [role, setRole] = useState(null); // 'fournisseur' | 'revendeur'
  const [screen, setScreen] = useState("home"); // home | add | list | detail
  const [page, setPage] = useState(null); // null | 'abonnement'
  const [stock, setStock] = useState(seedStock);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [abonnements, setAbonnements] = useState([]);
  const [aForm, setAForm] = useState({
    nom: "",
    telephone: "",
    type: "Revendeur",
    duree: "1",
    carteIdentite: null,
    codeAcces: "",
  });
  const [aCard, setACard] = useState(null);
  const [aStep, setAStep] = useState("form"); // form | payment
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [payingNow, setPayingNow] = useState(false);

  const [form, setForm] = useState({
    marchandise: "",
    categorie: "",
    nombre: "",
    localisation: "",
    geo: null,
    geoStatus: "idle",
    contact: "",
    photo: null,
    code: "",
    prix: "",
  });

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STOCK_KEY, true);
        if (res && res.value) {
          setStock(JSON.parse(res.value));
        } else {
          await window.storage.set(STOCK_KEY, JSON.stringify(seedStock), true);
        }
      } catch (e) {
        // no stored value yet, keep seed
      } finally {
        setLoaded(true);
      }
      try {
        const res2 = await window.storage.get(ABONNEMENT_KEY, true);
        if (res2 && res2.value) setAbonnements(JSON.parse(res2.value));
      } catch (e) {
        // no cards yet
      }
    })();
  }, []);

  // Dès que le fournisseur remplit "Localisation", on cherche la position
  // automatiquement (pas besoin de coller un lien ni d'appuyer sur un bouton).
  useEffect(() => {
    const text = form.localisation;
    if (!text || text.trim().length < 3) return;

    const linkGeo = parseMapsLink(text);
    if (linkGeo) {
      setForm((f) =>
        f.localisation === text ? { ...f, geo: linkGeo, geoStatus: "done" } : f
      );
      return;
    }

    setForm((f) => (f.localisation === text ? { ...f, geoStatus: "searching" } : f));
    const timer = setTimeout(async () => {
      try {
        const geo = await geocodeAddress(text);
        setForm((f) =>
          f.localisation === text
            ? { ...f, geo: geo || f.geo, geoStatus: geo ? "done" : "error" }
            : f
        );
      } catch (err) {
        setForm((f) => (f.localisation === text ? { ...f, geoStatus: "error" } : f));
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [form.localisation]);

  const persist = useCallback(async (next) => {
    setStock(next);
    try {
      await window.storage.set(STOCK_KEY, JSON.stringify(next), true);
    } catch (e) {
      // best-effort; UI already updated
    }
  }, []);

  function goHome() {
    setRole(null);
    setScreen("home");
    setSelectedId(null);
    setSearch("");
  }

  function handleAddStock(e) {
    e.preventDefault();
    const nombre = parseInt(form.nombre, 10);
    const prix = parseFloat(form.prix);
    if (!form.marchandise.trim() || !nombre || !prix) {
      showToast("Complète le nom, le nombre et le prix.");
      return;
    }
    const id = slugify(form.marchandise);
    const existing = stock.find((s) => s.id === id);
    let next;
    if (existing) {
      next = stock.map((s) =>
        s.id === id
          ? {
              ...s,
              count: s.count + nombre,
              price: prix,
              lieu: form.localisation || s.lieu,
              geo: form.geo || s.geo,
              categorie: form.categorie || s.categorie,
              contact: form.contact || s.contact,
              photo: form.photo || s.photo,
            }
          : s
      );
    } else {
      next = [
        ...stock,
        {
          id,
          name: form.marchandise.trim(),
          count: nombre,
          price: prix,
          lieu: form.localisation,
          geo: form.geo,
          categorie: form.categorie,
          contact: form.contact,
          photo: form.photo,
        },
      ];
    }
    persist(next);
    showToast(`${form.marchandise} ajouté au stock`);
    setForm({
      marchandise: "",
      categorie: "",
      nombre: "",
      localisation: "",
      geo: null,
      geoStatus: "idle",
      contact: "",
      photo: null,
      code: "",
      prix: "",
    });
  }

  async function handlePhotoChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch (err) {
      showToast("Impossible de charger la photo.");
    }
  }

  function handleLocalisationChange(text) {
    // La géolocalisation se fait automatiquement via l'effet ci-dessus ;
    // ici on se contente de mettre à jour le texte tapé par le fournisseur.
    setForm((f) => ({ ...f, localisation: text }));
  }

  function handleVendre() {
    const item = stock.find((s) => s.id === selectedId);
    if (!item || item.count <= 0) return;
    const next = stock.map((s) =>
      s.id === selectedId ? { ...s, count: s.count - 1 } : s
    );
    persist(next);
    showToast("Vente enregistrée");
  }

  function handleSubmitForm(e) {
    e.preventDefault();
    if (!aForm.nom.trim() || !aForm.telephone.trim()) {
      showToast("Complète le nom et le téléphone.");
      return;
    }
    if (!aForm.carteIdentite) {
      showToast("Ajoute une photo de la carte d'identité.");
      return;
    }
    if (!/^\d{4}$/.test(aForm.codeAcces)) {
      showToast("Le code d'accès doit avoir exactement 4 chiffres.");
      return;
    }
    // On ne crée pas encore la carte : il faut d'abord payer.
    setAStep("payment");
  }

  // La carte n'est générée et sauvegardée qu'une fois le paiement confirmé —
  // impossible d'y accéder avant.
  async function handleConfirmPayment() {
    if (!paymentMethod) {
      showToast("Choisis un moyen de paiement.");
      return;
    }
    setPayingNow(true);
    setTimeout(async () => {
      const dureeMois = parseInt(aForm.duree, 10);
      const montant = PRICING[aForm.type][aForm.duree];
      const now = new Date();
      const card = {
        id: `${Date.now()}`,
        nom: aForm.nom.trim(),
        telephone: aForm.telephone.trim(),
        type: aForm.type,
        duree: aForm.duree,
        montant,
        moyenPaiement: PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label || paymentMethod,
        carteIdentite: aForm.carteIdentite,
        codeAcces: aForm.codeAcces,
        numero: genCardNumber(),
        dateCreation: now.toISOString(),
        expiration: addMonths(now, dureeMois).toISOString(),
      };
      const next = [...abonnements, card];
      setAbonnements(next);
      try {
        await window.storage.set(ABONNEMENT_KEY, JSON.stringify(next), true);
      } catch (err) {
        // best-effort
      }
      setPayingNow(false);
      setACard(card);
    }, 1400);
  }

  async function handleIdCardChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      setAForm((f) => ({ ...f, carteIdentite: dataUrl }));
    } catch (err) {
      showToast("Impossible de charger la carte d'identité.");
    }
  }

  const selectedItem = stock.find((s) => s.id === selectedId);
  const filteredStock = stock.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Filet de sécurité : si on se retrouve sur l'écran détail sans article
  // correspondant (article supprimé, id obsolète…), on revient à la liste
  // au lieu d'afficher un écran vide.
  useEffect(() => {
    if (loaded && role === "revendeur" && screen === "detail" && !selectedItem) {
      setScreen("list");
    }
  }, [loaded, role, screen, selectedItem]);

  // ---------- CARTE ABONNEMENT ----------
  if (page === "abonnement") {
    const closeAbonnement = () => {
      setPage(null);
      setACard(null);
      setAStep("form");
      setPaymentMethod(null);
      setPayingNow(false);
      setAForm({
        nom: "",
        telephone: "",
        type: "Revendeur",
        duree: "1",
        carteIdentite: null,
        codeAcces: "",
      });
    };

    if (aCard) {
      return (
        <Screen>
          <TopBar title="Carte créée" onBack={closeAbonnement} />
          <div
            style={{
              borderRadius: 20,
              padding: "24px 22px",
              background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_DARK} 100%)`,
              color: "#fff",
              marginTop: 8,
              boxShadow: "0 10px 24px rgba(37,57,92,0.28)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Rangou · Carte abonnement</div>
                <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4 }}>{aCard.type}</div>
              </div>
              <CreditCard size={26} strokeWidth={1.6} />
            </div>
            <div style={{ marginTop: 30, fontSize: 19, letterSpacing: 1.5, fontWeight: 600 }}>
              {aCard.numero}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
              <div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>Titulaire</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{aCard.nom}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>Expire le</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                  {fmtDate(new Date(aCard.expiration))}
                </div>
              </div>
            </div>
          </div>
          <p style={{ color: "#6B7385", fontSize: 13, marginTop: 18, textAlign: "center" }}>
            Téléphone lié : {aCard.telephone} · {fmtFCFA(aCard.montant)} payés pour {DUREE_LABEL[aCard.duree]}
            {aCard.moyenPaiement ? ` via ${aCard.moyenPaiement}` : ""}
          </p>
          <div style={{ flex: 1 }} />
          <PrimaryButton onClick={closeAbonnement}>Terminer</PrimaryButton>
        </Screen>
      );
    }

    if (aStep === "form") {
    return (
      <Screen>
        <TopBar title="Carte abonnement" onBack={closeAbonnement} />
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 18px" }}>
          Créer une carte d'abonnement
        </h2>
        <form onSubmit={handleSubmitForm} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Field label="Nom complet">
            <input
              style={inputStyle}
              placeholder="Ex : Awa Diallo"
              value={aForm.nom}
              onChange={(e) => setAForm({ ...aForm, nom: e.target.value })}
            />
          </Field>
          <Field label="Téléphone">
            <input
              style={inputStyle}
              placeholder="Ex : 07 00 00 00 00"
              value={aForm.telephone}
              onChange={(e) => setAForm({ ...aForm, telephone: e.target.value })}
            />
          </Field>
          <Field label="Type de carte">
            <div style={{ display: "flex", gap: 10 }}>
              {["Fournisseur", "Revendeur"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setAForm({ ...aForm, type: t, duree: Object.keys(PRICING[t])[0] })
                  }
                  style={{
                    flex: 1,
                    padding: "12px 10px",
                    borderRadius: 13,
                    border: `1px solid ${aForm.type === t ? BLUE : LINE}`,
                    background: aForm.type === t ? BLUE : CARD,
                    color: aForm.type === t ? "#fff" : INK,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Durée de l'abonnement">
            <select
              style={inputStyle}
              value={aForm.duree}
              onChange={(e) => setAForm({ ...aForm, duree: e.target.value })}
            >
              {Object.keys(PRICING[aForm.type]).map((d) => (
                <option key={d} value={d}>
                  {DUREE_LABEL[d]} — {fmtFCFA(PRICING[aForm.type][d])}
                </option>
              ))}
            </select>
          </Field>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "13px 16px",
              borderRadius: 13,
              background: PAPER,
              border: `1px solid ${LINE}`,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 14, color: "#6B7385" }}>Montant à payer</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: GOLD }}>
              {fmtFCFA(PRICING[aForm.type][aForm.duree])}
            </span>
          </div>
          <Field label="Carte d'identité">
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 13,
                border: `1px dashed ${LINE}`,
                background: CARD,
                cursor: "pointer",
              }}
            >
              {aForm.carteIdentite ? (
                <img
                  src={aForm.carteIdentite}
                  alt="Aperçu carte d'identité"
                  style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: PAPER,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <FileText size={20} color="#9099A8" />
                </div>
              )}
              <span style={{ fontSize: 14, color: aForm.carteIdentite ? INK : "#6B7385" }}>
                {aForm.carteIdentite ? "Changer la photo" : "Ajouter une photo de la CI"}
              </span>
              <input type="file" accept="image/*" onChange={handleIdCardChange} style={{ display: "none" }} />
            </label>
          </Field>
          <Field label="Code d'accès (4 chiffres)">
            <input
              style={{ ...inputStyle, letterSpacing: 4 }}
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={aForm.codeAcces}
              onChange={(e) =>
                setAForm({ ...aForm, codeAcces: e.target.value.replace(/\D/g, "").slice(0, 4) })
              }
            />
          </Field>
          <div style={{ flex: 1 }} />
          <PrimaryButton onClick={handleSubmitForm}>Continuer vers le paiement</PrimaryButton>
        </form>
        {toast && <Toast>{toast}</Toast>}
      </Screen>
    );
    }
  }

  // ---------- ABONNEMENT : PAIEMENT (obligatoire avant d'obtenir la carte) ----------
  if (page === "abonnement" && aStep === "payment") {
    const montant = PRICING[aForm.type][aForm.duree];
    const backToForm = () => {
      setAStep("form");
      setPaymentMethod(null);
    };
    return (
      <Screen>
        <TopBar title="Paiement" onBack={payingNow ? undefined : backToForm} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 16px",
            borderRadius: 16,
            background: PAPER,
            border: `1px solid ${LINE}`,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: "#6B7385" }}>
              Abonnement {aForm.type} · {DUREE_LABEL[aForm.duree]}
            </div>
            <div style={{ fontSize: 12, color: "#9099A8", marginTop: 2 }}>{aForm.nom}</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>{fmtFCFA(montant)}</div>
        </div>

        <div style={{ fontSize: 13, color: "#6B7385", marginBottom: 10 }}>
          Choisis un moyen de paiement
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            const active = paymentMethod === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={payingNow}
                onClick={() => setPaymentMethod(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 14px",
                  borderRadius: 14,
                  border: `1px solid ${active ? BLUE : LINE}`,
                  background: active ? "#EAF0FA" : CARD,
                  cursor: payingNow ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: active ? BLUE : PAPER,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={17} color={active ? "#fff" : BLUE} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: INK }}>{m.label}</span>
                {active && (
                  <CheckCircle2 size={18} color={BLUE} style={{ marginLeft: "auto" }} />
                )}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />
        <PrimaryButton onClick={handleConfirmPayment} disabled={!paymentMethod || payingNow}>
          {payingNow ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={17} style={{ animation: "rangou-spin 0.8s linear infinite" }} />
              Paiement en cours…
            </span>
          ) : (
            `Payer ${fmtFCFA(montant)}`
          )}
        </PrimaryButton>
        <style>{`@keyframes rangou-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        {toast && <Toast>{toast}</Toast>}
      </Screen>
    );
  }

  // ---------- HOME ----------
  if (!role) {
    return (
      <Screen>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 28 }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Rangou</h1>
            <p style={{ color: "#6B7385", marginTop: 6, fontSize: 14 }}>
              Le lien entre fournisseurs et revendeurs — tout type de produit
            </p>
          </div>
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: 28,
              background: BLUE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShoppingCart size={46} color="#fff" strokeWidth={1.8} />
          </div>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            <PrimaryButton
              onClick={() => {
                setRole("fournisseur");
                setScreen("add");
              }}
            >
              Fournisseur
            </PrimaryButton>
            <PrimaryButton
              onClick={() => {
                setRole("revendeur");
                setScreen("list");
              }}
              style={{ background: CARD, color: INK, border: `1px solid ${LINE}` }}
            >
              Rangouman
            </PrimaryButton>
          </div>
        </div>
        {loaded && (
          <button
            onClick={() => setPage("abonnement")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              marginTop: 18,
              padding: "13px 16px",
              borderRadius: 14,
              border: `1px dashed ${BLUE}`,
              background: "transparent",
              color: BLUE,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <CreditCard size={17} />
            Créer une carte abonnement
          </button>
        )}
        {loaded && (
          <p style={{ textAlign: "center", fontSize: 11, color: "#9099A8", marginTop: 12 }}>
            Le stock est partagé entre tous ceux qui ouvrent cette appli.
          </p>
        )}
      </Screen>
    );
  }

  // ---------- FOURNISSEUR: AJOUTER UN STOCK ----------
  if (role === "fournisseur") {
    return (
      <Screen>
        <TopBar title="Espace fournisseur" onBack={goHome} />
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 18px" }}>Ajouter un stock</h2>
        <form onSubmit={handleAddStock} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Field label="Marchandise">
            <input
              style={inputStyle}
              placeholder="Ex : sac de riz, téléphone, chaussures, ciment…"
              value={form.marchandise}
              onChange={(e) => setForm({ ...form, marchandise: e.target.value })}
            />
          </Field>
          <Field label="Catégorie (optionnel)">
            <input
              style={inputStyle}
              placeholder="Ex : alimentation, électronique, mode, matériaux…"
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value })}
            />
          </Field>
          <Field label="Nombre">
            <input
              style={inputStyle}
              type="number"
              min="1"
              placeholder="20"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </Field>
          <Field label="Localisation">
            <input
              style={inputStyle}
              placeholder="Ex : Entrepôt 3, Yopougon, Abidjan…"
              value={form.localisation}
              onChange={(e) => handleLocalisationChange(e.target.value)}
            />
            {form.geoStatus === "searching" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, color: "#6B7385" }}>
                <MapPin size={14} />
                Recherche de la position…
              </div>
            )}
            {form.geoStatus === "error" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, color: "#B4552F" }}>
                <MapPin size={14} />
                Position introuvable. Précise le quartier ou la ville.
              </div>
            )}
            {form.geoStatus === "done" && form.geo && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, color: BLUE, fontWeight: 600 }}>
                  <MapPin size={14} />
                  Position trouvée
                </div>
                <div style={{ marginTop: 10, borderRadius: 13, overflow: "hidden", border: `1px solid ${LINE}` }}>
                  <iframe
                    title="Aperçu carte"
                    src={mapEmbedUrl(form.geo.lat, form.geo.lng)}
                    width="100%"
                    height="130"
                    style={{ border: 0, display: "block" }}
                    loading="lazy"
                  />
                </div>
              </>
            )}
          </Field>
          <Field label="Contact">
            <input
              style={inputStyle}
              placeholder="Ex : 07 00 00 00 00"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
          </Field>
          <Field label="Photo du produit">
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 13,
                border: `1px dashed ${LINE}`,
                background: CARD,
                cursor: "pointer",
              }}
            >
              {form.photo ? (
                <img
                  src={form.photo}
                  alt="Aperçu du produit"
                  style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: PAPER,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ImageIcon size={20} color="#9099A8" />
                </div>
              )}
              <span style={{ fontSize: 14, color: form.photo ? INK : "#6B7385" }}>
                {form.photo ? "Changer la photo" : "Ajouter une photo"}
              </span>
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
            </label>
          </Field>
          <Field label="Code carte Wanter">
            <input
              style={inputStyle}
              placeholder="1234-5678-9012"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
          <Field label="Prix unitaire (FCFA)">
            <input
              style={inputStyle}
              type="number"
              min="0"
              placeholder="1250"
              value={form.prix}
              onChange={(e) => setForm({ ...form, prix: e.target.value })}
            />
          </Field>
          <div style={{ flex: 1 }} />
          <PrimaryButton onClick={handleAddStock}>Ajouter</PrimaryButton>
        </form>

        {stock.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 13, color: "#6B7385", marginBottom: 8 }}>Stock actuel</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 130, overflowY: "auto" }}>
              {stock.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: CARD,
                    borderRadius: 12,
                    border: `1px solid ${LINE}`,
                    fontSize: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {s.photo ? (
                      <img
                        src={s.photo}
                        alt={s.name}
                        style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          background: PAPER,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Package size={15} color={BLUE} />
                      </div>
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  </div>
                  <span style={{ fontWeight: 600, flexShrink: 0 }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {toast && <Toast>{toast}</Toast>}
      </Screen>
    );
  }

  // ---------- REVENDEUR: LISTE DES MARCHANDISES ----------
  if (role === "revendeur" && screen === "list") {
    return (
      <Screen>
        <TopBar title="Marchandises" onBack={goHome} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: CARD,
            border: `1px solid ${LINE}`,
            borderRadius: 14,
            padding: "11px 14px",
            marginBottom: 20,
          }}
        >
          <Search size={17} color="#9099A8" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 15, width: "100%", fontFamily: "inherit" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          {filteredStock.length === 0 && stock.length === 0 && (
            <p style={{ color: "#9099A8", fontSize: 14, textAlign: "center", marginTop: 30 }}>
              Aucun produit pour l'instant. Dès qu'un fournisseur ajoute une marchandise — quel qu'en soit le type — elle apparaît ici.
            </p>
          )}
          {filteredStock.length === 0 && stock.length > 0 && (
            <p style={{ color: "#9099A8", fontSize: 14, textAlign: "center", marginTop: 30 }}>
              Aucun résultat pour cette recherche.
            </p>
          )}
          {filteredStock.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedId(s.id);
                setScreen("detail");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                textAlign: "left",
                padding: "12px 14px",
                background: CARD,
                border: `1px solid ${LINE}`,
                borderRadius: 16,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: PAPER,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {s.photo ? (
                  <img src={s.photo} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <Package size={20} color={BLUE} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "#9099A8" }}>
                  {[s.categorie, s.lieu].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.count}</div>
            </button>
          ))}
        </div>
        {toast && <Toast>{toast}</Toast>}
      </Screen>
    );
  }

  // ---------- REVENDEUR: DETAIL / VENDRE ----------
  if (role === "revendeur" && screen === "detail" && selectedItem) {
    return (
      <Screen>
        <TopBar title="Rangouman" onBack={() => setScreen("list")} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 8 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background: BLUE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
              overflow: "hidden",
            }}
          >
            {selectedItem.photo ? (
              <img src={selectedItem.photo} alt={selectedItem.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <User size={40} color="#fff" strokeWidth={1.6} />
            )}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{selectedItem.name}</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 16px",
              background: CARD,
              border: `1px solid ${LINE}`,
              borderRadius: 16,
            }}
          >
            <span style={{ color: "#6B7385", fontSize: 15 }}>Disponible</span>
            <span style={{ fontWeight: 700, fontSize: 17 }}>{selectedItem.count}</span>
          </div>

          {selectedItem.lieu && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 16px",
                background: CARD,
                border: `1px solid ${LINE}`,
                borderRadius: 16,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#6B7385", fontSize: 15 }}>
                <Warehouse size={16} /> Lieu
              </span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{selectedItem.lieu}</span>
            </div>
          )}

          {selectedItem.geo && (
            <div
              style={{
                borderRadius: 16,
                overflow: "hidden",
                border: `1px solid ${LINE}`,
                background: CARD,
              }}
            >
              <iframe
                title="Localisation"
                src={mapEmbedUrl(selectedItem.geo.lat, selectedItem.geo.lng)}
                width="100%"
                height="180"
                style={{ border: 0, display: "block" }}
                loading="lazy"
              />
            </div>
          )}

          {selectedItem.contact && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 16px",
                background: CARD,
                border: `1px solid ${LINE}`,
                borderRadius: 16,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#6B7385", fontSize: 15 }}>
                <Phone size={16} /> Contact fournisseur
              </span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{selectedItem.contact}</span>
            </div>
          )}

          <div
            style={{
              padding: "16px 16px",
              background: CARD,
              border: `1px solid ${LINE}`,
              borderRadius: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: "#6B7385", fontSize: 14, marginBottom: 8 }}>
              <span>Prix Wanter SN</span>
              <Tag size={16} color={GOLD} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: GOLD }}>{fmtFCFA(selectedItem.price)}</div>
          </div>
        </div>

        <div style={{ flex: 1 }} />
        <PrimaryButton onClick={handleVendre} disabled={selectedItem.count <= 0}>
          {selectedItem.count <= 0 ? "Rupture de stock" : "Vendre"}
        </PrimaryButton>
        {toast && <Toast>{toast}</Toast>}
      </Screen>
    );
  }

  // Filet de sécurité final : ne jamais rendre un écran vide, même dans un
  // état transitoire imprévu (ex. le temps que l'effet ci-dessus corrige
  // l'écran). On réaffiche quelque chose de cohérent plutôt que rien.
  return (
    <Screen>
      <TopBar title="Rangou" onBack={goHome} />
      <p style={{ color: "#9099A8", fontSize: 14, textAlign: "center", marginTop: 30 }}>
        Chargement…
      </p>
    </Screen>
  );
}

function Toast({ children }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 22,
        transform: "translateX(-50%)",
        background: BLUE_DARK,
        color: "#fff",
        padding: "10px 18px",
        borderRadius: 999,
        fontSize: 13,
        boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}
