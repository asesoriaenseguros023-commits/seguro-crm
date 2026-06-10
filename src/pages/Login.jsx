import { useState } from "react";
import { supabase } from "../supabase.js";
import { BLUE } from "../constants.js";
import { FontLoader } from "../components/Modal.jsx";

const ADMIN_EMAIL = "minchitas@gmail.com";

const LoginPage = ({ onLogin }) => {
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!pass) { setError("Ingresa la contraseña."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: pass,
    });
    if (err) { setError("Contraseña incorrecta."); setLoading(false); }
    else { onLogin(); }
  };

  const inputStyle = {
    width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8,
    padding: "12px 14px", fontSize: 14, color: "#1a1a1a", background: "#fff",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <>
      <FontLoader />
      <div
        style={{
          minHeight: "100vh",
          background: BLUE.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div
              style={{
                width: 110, height: 110, borderRadius: 18, overflow: "hidden",
                margin: "0 auto 16px", boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
              }}
            >
              <img
                src="/logo.png"
                alt="Logo Asesoría en Seguros"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>
              Asesoría en Seguros Tocancipá
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
              NIT: 46.662.968
            </div>
          </div>

          <div
            style={{
              background: "#fff", borderRadius: 14, padding: "32px 28px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 24,
                textAlign: "center",
              }}
            >
              Iniciar sesión
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 11, fontWeight: 700, color: "#6b7280",
                  letterSpacing: 1, textTransform: "uppercase",
                  display: "block", marginBottom: 6,
                }}
              >
                Usuario
              </label>
              <input
                style={{ ...inputStyle, background: "#f9fafb", color: "#6b7280", cursor: "not-allowed" }}
                type="text"
                value="Administrador"
                readOnly
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  fontSize: 11, fontWeight: 700, color: "#6b7280",
                  letterSpacing: 1, textTransform: "uppercase",
                  display: "block", marginBottom: 6,
                }}
              >
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inputStyle, paddingRight: 44 }}
                  type={showPass ? "text" : "password"}
                  value={pass}
                  onChange={(e) => { setPass(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="••••••••"
                  autoFocus
                />
                <button
                  onClick={() => setShowPass((v) => !v)}
                  style={{
                    position: "absolute", right: 12, top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16,
                  }}
                >
                  {showPass ? "S" : "V"}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: "#fef2f2", color: "#dc2626", borderRadius: 8,
                  padding: "10px 14px", fontSize: 13, marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <button
              style={{
                width: "100%", background: BLUE.primary, color: "#fff",
                border: "none", borderRadius: 8, padding: "13px 16px",
                fontSize: 16, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1, fontFamily: "inherit",
              }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Iniciando sesión…" : "Entrar"}
            </button>
          </div>

          <div
            style={{
              textAlign: "center", marginTop: 20, fontSize: 12,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Calle 11 No 5 - 89 Primer Piso Emisora de Tocancipá
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
