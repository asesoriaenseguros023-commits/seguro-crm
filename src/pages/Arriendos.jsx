import { useState, useEffect } from "react";
import { supabase } from "../supabase.js";
import { S, BLUE } from "../constants.js";
import { fmt, mapInmueble, toInmuebleRow, mapArrendatario } from "../helpers.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";

const TABS = [
  { id: "inmuebles", label: "Inmuebles" },
  { id: "arrendatarios", label: "Arrendatarios" },
  { id: "contratos", label: "Contratos", proximamente: true },
  { id: "pagos", label: "Pagos", proximamente: true },
  { id: "movimientos", label: "Movimientos", proximamente: true },
];

const INMUEBLE_INIT = { nombre: "", direccion: "", valorCanonBase: "", diaVencimientoPago: 5, activo: true };
const ARRENDATARIO_INIT = { nombre: "", telefono: "", documento: "" };

// ─── Inmuebles ────────────────────────────────────────────────────────────
const InmueblesTab = ({ inmuebles, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(INMUEBLE_INIT);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const abrirNuevo = () => { setEditItem(null); setForm(INMUEBLE_INIT); setShowForm(true); };
  const abrirEditar = (i) => {
    setEditItem(i);
    setForm({ nombre: i.nombre, direccion: i.direccion, valorCanonBase: i.valorCanonBase, diaVencimientoPago: i.diaVencimientoPago, activo: i.activo });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const payload = { ...form, valorCanonBase: Number(form.valorCanonBase) || 0, diaVencimientoPago: Number(form.diaVencimientoPago) };
    if (editItem) await onEdit({ id: editItem.id, ...payload });
    else await onAdd(payload);
    setSaving(false);
    setShowForm(false);
    setEditItem(null);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Inmuebles</div>
          <div style={S.pageSub}>{inmuebles.length} inmuebles registrados</div>
        </div>
        <button style={S.btn("primary")} onClick={abrirNuevo}>
          <Icon name="plus" size={16} />Nuevo inmueble
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {inmuebles.map((i) => (
          <div key={i.id} style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 6px rgba(26,86,219,0.08)", border: `1px solid ${BLUE.border}`, borderTop: `3px solid ${BLUE.primary}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: BLUE.text }}>{i.nombre}</div>
                {i.direccion && <div style={{ fontSize: 12, color: "#6b87b0", marginTop: 2 }}>{i.direccion}</div>}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={S.btn("ghost")} onClick={() => abrirEditar(i)}><Icon name="edit" size={14} /></button>
                <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(i)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: BLUE.primary }}>{fmt(i.valorCanonBase)}</div>
                <div style={{ fontSize: 11, color: "#6b87b0" }}>Paga el día {i.diaVencimientoPago}</div>
              </div>
              <span style={S.chip(i.activo ? "#16a34a" : "#6b7280")}>{i.activo ? "Activo" : "Inactivo"}</span>
            </div>
          </div>
        ))}
        {inmuebles.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 13, padding: 20 }}>No hay inmuebles. Agrega el primero.</div>
        )}
      </div>

      {showForm && (
        <Modal
          title={editItem ? "Editar inmueble" : "Nuevo inmueble"}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => { setShowForm(false); setEditItem(null); }}>Cancelar</button>
              <button style={{ ...S.btn("primary"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          }
        >
          <div style={S.formGroup}>
            <label style={S.label}>Nombre *</label>
            <input style={S.input} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Local 1, Piso 2" autoFocus />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Dirección</label>
            <input style={S.input} value={form.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Ej. Cra 5 # 10-20" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={S.formGroup}>
              <label style={S.label}>Canon base *</label>
              <input style={S.input} type="number" value={form.valorCanonBase} onChange={(e) => set("valorCanonBase", e.target.value)} placeholder="0" />
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Día de pago *</label>
              <input style={S.input} type="number" min={1} max={31} value={form.diaVencimientoPago} onChange={(e) => set("diaVencimientoPago", e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} style={{ width: 16, height: 16, accentColor: BLUE.primary }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: BLUE.text }}>Inmueble activo</span>
          </div>
        </Modal>
      )}

      {delItem && (
        <Modal
          title="Eliminar inmueble"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
              <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar <strong>{delItem.nombre}</strong>? Esto solo es posible si no tiene contratos asociados.</p>
        </Modal>
      )}
    </div>
  );
};

// ─── Arrendatarios ────────────────────────────────────────────────────────
const ArrendatariosTab = ({ arrendatarios, onAdd, onEdit, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [delItem, setDelItem] = useState(null);
  const [form, setForm] = useState(ARRENDATARIO_INIT);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const abrirNuevo = () => { setEditItem(null); setForm(ARRENDATARIO_INIT); setShowForm(true); };
  const abrirEditar = (a) => { setEditItem(a); setForm({ nombre: a.nombre, telefono: a.telefono, documento: a.documento }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    if (editItem) await onEdit({ id: editItem.id, ...form });
    else await onAdd(form);
    setSaving(false);
    setShowForm(false);
    setEditItem(null);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div>
          <div style={S.pageTitle}>Arrendatarios</div>
          <div style={S.pageSub}>{arrendatarios.length} arrendatarios registrados</div>
        </div>
        <button style={S.btn("primary")} onClick={abrirNuevo}>
          <Icon name="plus" size={16} />Nuevo arrendatario
        </button>
      </div>

      <div style={S.tableWrap}>
        <div style={{ ...S.tableHead, gridTemplateColumns: "1.5fr 1fr 1fr 90px" }}>
          <div>Nombre</div><div>Teléfono</div><div>Documento</div><div></div>
        </div>
        {arrendatarios.map((a) => (
          <div key={a.id} style={{ ...S.tableRow, gridTemplateColumns: "1.5fr 1fr 1fr 90px" }}>
            <div style={{ fontWeight: 600, color: BLUE.text }}>{a.nombre}</div>
            <div>{a.telefono || "—"}</div>
            <div>{a.documento || "—"}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={S.btn("ghost")} onClick={() => abrirEditar(a)}><Icon name="edit" size={14} /></button>
              <button style={{ ...S.btn("ghost"), color: "#dc2626" }} onClick={() => setDelItem(a)}><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
        {arrendatarios.length === 0 && (
          <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>No hay arrendatarios. Agrega el primero.</div>
        )}
      </div>

      {showForm && (
        <Modal
          title={editItem ? "Editar arrendatario" : "Nuevo arrendatario"}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => { setShowForm(false); setEditItem(null); }}>Cancelar</button>
              <button style={{ ...S.btn("primary"), opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </>
          }
        >
          <div style={S.formGroup}>
            <label style={S.label}>Nombre *</label>
            <input style={S.input} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre completo" autoFocus />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Teléfono</label>
            <input style={S.input} value={form.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="Ej. 3001234567" />
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Documento</label>
            <input style={S.input} value={form.documento} onChange={(e) => set("documento", e.target.value)} placeholder="Cédula / NIT" />
          </div>
        </Modal>
      )}

      {delItem && (
        <Modal
          title="Eliminar arrendatario"
          onClose={() => setDelItem(null)}
          footer={
            <>
              <button style={S.btn("secondary")} onClick={() => setDelItem(null)}>Cancelar</button>
              <button style={S.btn("danger")} onClick={async () => { await onDelete(delItem.id); setDelItem(null); }}>Eliminar</button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#555" }}>¿Eliminar <strong>{delItem.nombre}</strong>? Esto solo es posible si no tiene contratos asociados.</p>
        </Modal>
      )}
    </div>
  );
};

// ─── Página raíz del módulo ───────────────────────────────────────────────
const ArriendosPage = () => {
  const [tab, setTab] = useState("inmuebles");
  const [inmuebles, setInmuebles] = useState([]);
  const [arrendatarios, setArrendatarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("inmuebles").select("*").order("nombre"),
      supabase.from("arrendatarios").select("*").order("nombre"),
    ]).then(([{ data: inm }, { data: arr }]) => {
      if (inm) setInmuebles(inm.map(mapInmueble));
      if (arr) setArrendatarios(arr.map(mapArrendatario));
      setLoading(false);
    });

    const channel = supabase.channel("arriendos-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "inmuebles" }, (payload) => {
        if (payload.eventType === "INSERT") setInmuebles((p) => p.some((x) => x.id === payload.new.id) ? p : [...p, mapInmueble(payload.new)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        if (payload.eventType === "UPDATE") setInmuebles((p) => p.map((x) => x.id === payload.new.id ? mapInmueble(payload.new) : x));
        if (payload.eventType === "DELETE") setInmuebles((p) => p.filter((x) => x.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "arrendatarios" }, (payload) => {
        if (payload.eventType === "INSERT") setArrendatarios((p) => p.some((x) => x.id === payload.new.id) ? p : [...p, mapArrendatario(payload.new)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        if (payload.eventType === "UPDATE") setArrendatarios((p) => p.map((x) => x.id === payload.new.id ? mapArrendatario(payload.new) : x));
        if (payload.eventType === "DELETE") setArrendatarios((p) => p.filter((x) => x.id !== payload.old.id));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const addInmueble = async (f) => {
    const { data, error } = await supabase.from("inmuebles").insert([toInmuebleRow(f)]).select().single();
    if (error) { console.error("addInmueble error:", error); return; }
    if (data) setInmuebles((p) => [...p, mapInmueble(data)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  };
  const editInmueble = async (f) => {
    const { error } = await supabase.from("inmuebles").update(toInmuebleRow(f)).eq("id", f.id);
    if (error) { console.error("editInmueble error:", error); return; }
    setInmuebles((p) => p.map((x) => x.id === f.id ? { ...x, ...f } : x));
  };
  const deleteInmueble = async (id) => {
    const { error } = await supabase.from("inmuebles").delete().eq("id", id);
    if (error) { console.error("deleteInmueble error:", error); return; }
    setInmuebles((p) => p.filter((x) => x.id !== id));
  };

  const addArrendatario = async (f) => {
    const { data, error } = await supabase.from("arrendatarios").insert([f]).select().single();
    if (error) { console.error("addArrendatario error:", error); return; }
    if (data) setArrendatarios((p) => [...p, mapArrendatario(data)].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  };
  const editArrendatario = async (f) => {
    const { error } = await supabase.from("arrendatarios").update({ nombre: f.nombre, telefono: f.telefono, documento: f.documento }).eq("id", f.id);
    if (error) { console.error("editArrendatario error:", error); return; }
    setArrendatarios((p) => p.map((x) => x.id === f.id ? { ...x, ...f } : x));
  };
  const deleteArrendatario = async (id) => {
    const { error } = await supabase.from("arrendatarios").delete().eq("id", id);
    if (error) { console.error("deleteArrendatario error:", error); return; }
    setArrendatarios((p) => p.filter((x) => x.id !== id));
  };

  if (loading) return <div style={{ padding: 40, color: "#6b87b0", fontSize: 13 }}>Cargando…</div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => !t.proximamente && setTab(t.id)}
            disabled={t.proximamente}
            style={{
              padding: "9px 18px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 13, cursor: t.proximamente ? "default" : "pointer",
              background: tab === t.id ? BLUE.primary : "#fff", color: tab === t.id ? "#fff" : t.proximamente ? "#bbb" : "#555",
              boxShadow: "0 1px 4px rgba(26,86,219,0.08)",
            }}
          >
            {t.label}{t.proximamente ? " (próximamente)" : ""}
          </button>
        ))}
      </div>

      {tab === "inmuebles" && <InmueblesTab inmuebles={inmuebles} onAdd={addInmueble} onEdit={editInmueble} onDelete={deleteInmueble} />}
      {tab === "arrendatarios" && <ArrendatariosTab arrendatarios={arrendatarios} onAdd={addArrendatario} onEdit={editArrendatario} onDelete={deleteArrendatario} />}
    </div>
  );
};

export default ArriendosPage;
