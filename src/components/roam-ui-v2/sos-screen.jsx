// roam-ui-v2/sos-screen.jsx
// Ported from prototype sos.jsx. Mock data initially; real services wire in v2.

import { useState } from "react";
import {
  Icon, NetworkPill, BottomSheet, PrimaryBtn, GhostBtn,
} from "./shared";
import { FauxMap } from "./faux-map";

export function SosScreen({ networkState = "online" }) {
  const [contacts, setContacts] = useState([
    { id: 1, name: "Mum",         phone: "+61 412 887 003", icon: "user"   },
    { id: 2, name: "Sarah (Co)",  phone: "+61 408 552 100", icon: "user"   },
    { id: 3, name: "RAA Outback", phone: "+61 1300 762 762", icon: "rotate" },
  ]);
  const [composer, setComposer] = useState(false);
  const [editing, setEditing]   = useState(null);

  return (
    <div className="page" style={{ background: "var(--c-bg)", position: "relative", height: "100%" }}>
      <div className="scroll-y" style={{ flex: 1, padding: "50px 16px 110px", height: "100%" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14,
        }}>
          <div>
            <div className="t-mono" style={{
              fontSize: 11, color: "var(--c-danger)", fontWeight: 700,
              letterSpacing: 1, textTransform: "uppercase",
            }}>SOS</div>
            <div className="t-display" style={{
              fontWeight: 700, fontSize: 28, letterSpacing: -0.4, whiteSpace: "nowrap",
            }}>Help & location</div>
          </div>
          <NetworkPill state={networkState} compact />
        </div>

        <LocationCard />

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10, marginTop: 16 }}>
          <EmergencyButton label="000" sub="Police · Fire · Ambulance" icon="sos" />
          <SecondaryEmergencyButton label="SES" sub="132 500" icon="warn" />
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 22, marginBottom: 10,
        }}>
          <div className="t-display" style={{ fontWeight: 700, fontSize: 17 }}>Speed dial</div>
          <button onClick={() => setComposer(true)} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "var(--c-text-muted)", fontSize: 13, fontWeight: 600,
            padding: "4px 8px",
          }}>
            <Icon name="msg" size={14} stroke={2}/> Bulk SMS
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {contacts.map(c => (
            <ContactCard
              key={c.id}
              contact={c}
              editing={editing === c.id}
              onEdit={() => setEditing(c.id)}
              onSave={(name, phone) => {
                setContacts(cs => cs.map(x => x.id === c.id ? { ...x, name, phone } : x));
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
              onDelete={() => setContacts(cs => cs.filter(x => x.id !== c.id))}
            />
          ))}
          <AddContact onAdd={(name, phone) =>
            setContacts(cs => [...cs, { id: Date.now(), name, phone, icon: "user" }])
          }/>
        </div>

        <div style={{
          marginTop: 22, padding: "14px",
          borderRadius: 14, background: "var(--c-surface-muted)",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <Icon name="leaf" size={18} style={{ color: "var(--c-success)" }}/>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Your last fix is saved offline</div>
            <div className="t-muted" style={{ fontSize: 12 }}>
              Glovebox keeps your last 7 known positions even without signal. SMS works on any one bar of 2G.
            </div>
          </div>
        </div>
      </div>

      <BottomSheet open={composer} onClose={() => setComposer(false)} title="Bulk SMS">
        <BulkSmsComposer contacts={contacts} onClose={() => setComposer(false)}/>
      </BottomSheet>
    </div>
  );
}

function LocationCard() {
  return (
    <div style={{
      borderRadius: 18, overflow: "hidden",
      border: "1px solid var(--c-border)",
      background: "var(--c-surface)",
      boxShadow: "var(--sh-card)",
    }}>
      <div style={{ position: "relative", height: 130 }}>
        <FauxMap width={370} height={130} style="satellite" clusterSize="small"/>
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ position: "relative", width: 40, height: 40 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: 999,
              background: "rgba(77,184,240,0.25)", animation: "ping-ring 2s ease-out infinite",
            }}/>
            <div style={{
              position: "absolute", inset: 12, borderRadius: 999,
              background: "var(--c-info)", border: "3px solid white",
            }}/>
          </div>
        </div>
        <div style={{
          position: "absolute", left: 10, bottom: 10,
          padding: "4px 10px", borderRadius: 999, background: "rgba(0,0,0,0.6)", color: "white",
          fontSize: 11, fontWeight: 700,
        }}>
          Last fix · 8 s ago
        </div>
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div className="t-mono" style={{
          fontSize: 11, color: "var(--c-text-muted)",
          textTransform: "uppercase", letterSpacing: 0.4,
        }}>
          Current location
        </div>
        <div className="t-mono" style={{
          fontSize: 18, fontWeight: 700, color: "var(--c-text)",
          marginTop: 4, letterSpacing: -0.2,
        }}>
          -27.84129, 140.32711
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
          <div className="t-mono" style={{ fontSize: 12, color: "var(--c-success)" }}>± 4 m</div>
          <div className="t-mono" style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
            Cordillo Downs Rd, SA
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <PrimaryBtn style={{ flex: 1 }}>
            <Icon name="target" size={16} stroke={2.2}/> Get new fix
          </PrimaryBtn>
          <GhostBtn>
            <Icon name="map" size={16}/> Open in Maps
          </GhostBtn>
        </div>
      </div>
    </div>
  );
}

function EmergencyButton({ label, sub, icon }) {
  return (
    <button style={{
      minHeight: 88, borderRadius: 18,
      background: "var(--c-danger)", color: "white",
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px",
      boxShadow: "var(--sh-card)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.18,
        background: "radial-gradient(circle at 80% 20%, white, transparent 60%)",
      }}/>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: "rgba(255,255,255,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <Icon name={icon} size={28} stroke={2.4}/>
      </div>
      <div style={{ textAlign: "left", position: "relative" }}>
        <div className="t-display" style={{
          fontWeight: 700, fontSize: 32, lineHeight: 1, letterSpacing: -0.5,
        }}>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{sub}</div>
      </div>
    </button>
  );
}

function SecondaryEmergencyButton({ label, sub, icon }) {
  return (
    <button style={{
      minHeight: 88, borderRadius: 18,
      background: "var(--c-surface)", color: "var(--c-text)",
      border: "1px solid var(--c-border)",
      display: "flex", flexDirection: "column",
      alignItems: "flex-start", justifyContent: "center",
      padding: "12px 14px", gap: 4, boxShadow: "var(--sh-card)",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: "var(--c-danger-tint)", color: "var(--c-danger)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={18} stroke={2.4}/>
      </div>
      <div className="t-display" style={{
        fontWeight: 700, fontSize: 18, letterSpacing: -0.2, marginTop: 4,
      }}>{label}</div>
      <div className="t-mono" style={{ fontSize: 11, color: "var(--c-text-muted)" }}>{sub}</div>
    </button>
  );
}

function ContactCard({ contact, editing, onEdit, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);

  if (editing) {
    return (
      <div style={{
        padding: 12, borderRadius: 16,
        background: "var(--c-surface)", border: "1.5px solid var(--c-accent)",
        boxShadow: "var(--sh-card)",
      }}>
        <input value={name} onChange={e => setName(e.target.value)} style={editInputStyle()} placeholder="Name"/>
        <input value={phone} onChange={e => setPhone(e.target.value)} style={{ ...editInputStyle(), fontFamily: "var(--font-mono)" }} placeholder="Phone"/>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 44, borderRadius: 10,
            background: "var(--c-surface-muted)", fontWeight: 600,
          }}>Cancel</button>
          <button onClick={onDelete} style={{
            width: 44, height: 44, borderRadius: 10,
            background: "var(--c-error-bg)", color: "var(--c-error-text)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><Icon name="trash" size={16}/></button>
          <button onClick={() => onSave(name, phone)} style={{
            flex: 1, height: 44, borderRadius: 10,
            background: "var(--c-accent)", color: "white", fontWeight: 700,
          }}>Save</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 16,
      background: "var(--c-surface)", border: "1px solid var(--c-border)",
      boxShadow: "var(--sh-card)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 999,
        background: "var(--c-surface-muted)", color: "var(--c-text-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={contact.icon} size={20}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{contact.name}</div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--c-text-muted)" }}>{contact.phone}</div>
      </div>
      <button style={{
        width: 48, height: 48, borderRadius: 12,
        background: "var(--c-success)", color: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><Icon name="phone" size={18} stroke={2.2}/></button>
      <button style={{
        width: 48, height: 48, borderRadius: 12,
        background: "var(--c-info-tint)", color: "var(--c-info)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><Icon name="msg" size={18} stroke={2.2}/></button>
      <button onClick={onEdit} style={{ width: 32, height: 48, color: "var(--c-text-muted)" }}>
        <Icon name="dots" size={16}/>
      </button>
    </div>
  );
}

function AddContact({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        minHeight: 56, borderRadius: 16,
        border: "1.5px dashed var(--c-border-strong)",
        color: "var(--c-text-muted)", fontSize: 14, fontWeight: 600,
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <Icon name="plus" size={18} stroke={2.2}/> Add emergency contact
      </button>
    );
  }
  return (
    <div style={{
      padding: 12, borderRadius: 16,
      background: "var(--c-surface)", border: "1.5px solid var(--c-accent)",
    }}>
      <input value={name} onChange={e => setName(e.target.value)} style={editInputStyle()} placeholder="Name"/>
      <input value={phone} onChange={e => setPhone(e.target.value)} style={{ ...editInputStyle(), fontFamily: "var(--font-mono)" }} placeholder="Phone (e.g. +61 412 …)"/>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setOpen(false)} style={{
          flex: 1, height: 44, borderRadius: 10,
          background: "var(--c-surface-muted)", fontWeight: 600,
        }}>Cancel</button>
        <button onClick={() => {
          if (name && phone) { onAdd(name, phone); setName(""); setPhone(""); setOpen(false); }
        }} style={{
          flex: 1, height: 44, borderRadius: 10,
          background: "var(--c-accent)", color: "white", fontWeight: 700,
        }}>Add</button>
      </div>
    </div>
  );
}

function editInputStyle() {
  return {
    width: "100%", minHeight: 44, borderRadius: 10,
    background: "var(--c-surface-muted)", border: "1px solid var(--c-border)",
    padding: "0 12px", fontSize: 15, fontFamily: "var(--font-body)",
    color: "var(--c-text)", marginBottom: 8, outline: "none",
  };
}

function BulkSmsComposer({ contacts, onClose }) {
  const [selected, setSelected] = useState(new Set(contacts.map(c => c.id)));
  const [msg, setMsg] = useState("I'm safe but delayed. At -27.84129, 140.32711. Will check in at the next signal.");

  const toggle = id => {
    setSelected(s => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      return ns;
    });
  };

  const segments = Math.ceil(msg.length / 160);

  return (
    <div>
      <div className="t-mono t-muted" style={{
        fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6,
      }}>Recipients</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {contacts.map(c => {
          const on = selected.has(c.id);
          return (
            <button key={c.id} onClick={() => toggle(c.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 12px", minHeight: 40, borderRadius: 999,
              background: on ? "var(--c-accent)" : "var(--c-surface-muted)",
              color: on ? "white" : "var(--c-text)",
              fontSize: 13, fontWeight: 600,
            }}>
              <Icon name={on ? "starFill" : "plus"} size={12} stroke={2.4}/>
              {c.name}
            </button>
          );
        })}
      </div>
      <div className="t-mono t-muted" style={{
        fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6,
      }}>Message</div>
      <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={4} style={{
        width: "100%", borderRadius: 12, padding: 12,
        background: "var(--c-surface-muted)", border: "1px solid var(--c-border)",
        fontSize: 14, fontFamily: "var(--font-body)", color: "var(--c-text)",
        resize: "none", outline: "none", marginBottom: 8,
      }}/>
      <div className="t-mono" style={{
        fontSize: 11, color: "var(--c-text-muted)", textAlign: "right",
      }}>
        {msg.length} chars · {segments} SMS segment{segments !== 1 ? "s" : ""}
      </div>
      <PrimaryBtn style={{ width: "100%", marginTop: 12 }} large onClick={onClose}>
        <Icon name="msg" size={16}/> Send to {selected.size} contacts
      </PrimaryBtn>
    </div>
  );
}
