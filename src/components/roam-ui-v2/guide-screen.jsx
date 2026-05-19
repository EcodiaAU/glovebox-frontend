// roam-ui-v2/guide-screen.jsx
// Ported from prototype guide.jsx. Mock data; real services wire in v2.

import { useEffect, useRef, useState } from "react";
import { Icon, NetworkPill, AccountBtn } from "./shared";
import { FauxMap } from "./faux-map";

export function GuideScreen({ networkState = "online", fuelState = "warning", onTapPlace }) {
  const [tab, setTab] = useState("found");
  const [placeSheet, setPlaceSheet] = useState(null);

  return (
    <div className="page" style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "50px 16px 12px", background: "var(--c-bg)" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
        }}>
          <div className="t-display" style={{ fontWeight: 700, fontSize: 28, letterSpacing: -0.4 }}>Guide</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <NetworkPill state={networkState} compact />
            <AccountBtn />
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          background: "var(--c-surface-muted)", borderRadius: 14, padding: 4, gap: 4,
        }}>
          {[
            { id: "found", label: "Found", count: 6, icon: "pin" },
            { id: "chat",  label: "Chat",  count: null, icon: "sparkle" },
          ].map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                minHeight: 44, borderRadius: 10,
                background: active ? "var(--c-surface)" : "transparent",
                color: active ? "var(--c-text)" : "var(--c-text-muted)",
                fontWeight: active ? 700 : 600, fontSize: 14,
                boxShadow: active ? "var(--sh-card)" : "none",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <Icon name={t.icon} size={16} stroke={2}/>
                {t.label}
                {t.count !== null && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    padding: "0 6px", minWidth: 18, height: 18,
                    borderRadius: 999,
                    background: active ? "var(--c-accent-tint)" : "transparent",
                    color: active ? "var(--c-accent)" : "var(--c-text-muted)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{
        position: "relative", height: 168, margin: "0 16px",
        borderRadius: 18, overflow: "hidden",
        border: "1px solid var(--c-border)",
        boxShadow: "var(--sh-card)",
      }}>
        <FauxMap width={370} height={168} style="terrain" progress={0.32} showProgress showCar clusterSize="small"/>
        <div style={{ position: "absolute", left: 10, top: 10, display: "flex", gap: 8 }}>
          <MiniStat icon="fire" label="32°" sub="dry · 5pm"/>
          <MiniStat icon="fuel" label="184 km" sub="next fuel" warn={fuelState !== "healthy"}/>
        </div>
        <div style={{ position: "absolute", left: 10, right: 10, bottom: 10 }}>
          <ProgressBar pct={0.32}/>
        </div>
      </div>

      <div className="scroll-y" style={{ flex: 1, padding: "12px 16px 120px" }}>
        {tab === "found" && <FoundFeed onTap={(id) => { setPlaceSheet(id); onTapPlace?.(id); }}/>}
        {tab === "chat" && <ChatPanel/>}
      </div>
    </div>
  );
}

function MiniStat({ icon, label, sub, warn }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 10px", borderRadius: 999,
      background: "var(--c-surface)", border: "1px solid var(--c-border)",
      boxShadow: "var(--sh-card)",
      color: warn ? "var(--c-cat-solar)" : "var(--c-text)",
    }}>
      <Icon name={icon} size={14} stroke={2}/>
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "flex-start", lineHeight: 1,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{label}</span>
        <span className="t-mono" style={{ fontSize: 9, color: "var(--c-text-muted)" }}>{sub}</span>
      </div>
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 10px", borderRadius: 12,
      background: "rgba(0,0,0,0.55)", color: "white",
    }}>
      <div className="t-mono" style={{ fontSize: 11, fontWeight: 700, minWidth: 36 }}>
        {Math.round(pct * 100)}%
      </div>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: "var(--c-accent)" }}/>
      </div>
      <div className="t-mono" style={{ fontSize: 11, fontWeight: 700 }}>356 km · 5h 14m</div>
    </div>
  );
}

function FoundFeed({ onTap }) {
  const items = [
    { id: "cordillo", icon: "mountain", scene: "range", name: "Cordillo Downs Shearing Shed", dist: "184 km", cat: "Heritage",
      reason: "You mentioned old wool stations earlier. This is the largest stone-walled shearing shed in the Southern Hemisphere - five minutes off-route." },
    { id: "water", icon: "drop", scene: "water", name: "Coongie Lakes turnoff", dist: "498 km", cat: "Detour · 38 km RT",
      reason: "Weather window opens tomorrow morning. Birdlife peaks at sunrise. Track is firm after the recent dry spell." },
    { id: "cameron", icon: "cafe", scene: "cafe", name: "Cameron Corner Store", dist: "312 km", cat: "Roadhouse",
      reason: "This is your last reliable fuel for the next 212 km. Cold pies. Closes at 6pm and you're on track for 14:20." },
    { id: "tent", icon: "tent", scene: "camp", name: "Walkers Crossing camp", dist: "233 km", cat: "Free camp",
      reason: "Three vehicles overnighted here last night per a Roamer report - friendly. Cooper Creek frontage." },
    { id: "star", icon: "star", scene: "night", name: "Dark sky window", dist: "Tonight, 21:00-04:30", cat: "Astronomy",
      reason: "New moon over Strzelecki tonight. Bortle 1 sky. Your camp is well-positioned." },
    { id: "fire", icon: "leaf", scene: "bloom", name: "Banksia in bloom", dist: "78 km", cat: "Seasonal",
      reason: "Late-season flowering along the bull-dust section after rain two weeks ago." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="t-mono" style={{
        fontSize: 10, color: "var(--c-text-muted)", textTransform: "uppercase",
        letterSpacing: 0.5, padding: "4px 4px 2px",
      }}>
        6 found · sorted by distance ahead
      </div>
      {items.map(it => (
        <FoundCard key={it.id} item={it} onTap={() => onTap(it.id)}/>
      ))}
    </div>
  );
}

function FoundCard({ item, onTap }) {
  return (
    <div style={{
      borderRadius: 18, overflow: "hidden",
      background: "var(--c-surface)",
      border: "1px solid var(--c-border)",
      boxShadow: "var(--sh-card)",
    }}>
      <div style={{ display: "flex", gap: 0 }}>
        <ScenicPlaceholder kind={item.scene} icon={item.icon}/>
        <div style={{ flex: 1, padding: "12px 14px 8px", minWidth: 0 }}>
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
          }}>
            <div className="t-display" style={{
              fontWeight: 700, fontSize: 15, letterSpacing: -0.1, lineHeight: 1.25,
            }}>{item.name}</div>
            <div className="t-mono" style={{
              fontSize: 11, color: "var(--c-accent)", fontWeight: 700, whiteSpace: "nowrap",
            }}>{item.dist}</div>
          </div>
          <div className="t-mono" style={{
            fontSize: 10, color: "var(--c-text-muted)",
            textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2,
          }}>{item.cat}</div>
        </div>
      </div>
      <div style={{
        fontSize: 13, lineHeight: 1.5, color: "var(--c-text)", padding: "0 14px 4px",
      }}>
        <span style={{
          color: "var(--c-accent)", fontWeight: 700, fontSize: 11,
          letterSpacing: 0.4, textTransform: "uppercase", marginRight: 6,
        }}>
          ✦ Why
        </span>
        {item.reason}
      </div>
      <div style={{ display: "flex", gap: 8, padding: "10px 14px 14px" }}>
        <button onClick={onTap} style={{
          flex: 1, height: 40, borderRadius: 10,
          background: "var(--c-accent-tint)", color: "var(--c-accent)",
          fontWeight: 700, fontSize: 13,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Icon name="map" size={14} stroke={2.2}/> View on map
        </button>
        <button style={{
          width: 40, height: 40, borderRadius: 10,
          background: "var(--c-surface-muted)", color: "var(--c-text)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name="plus" size={16}/>
        </button>
      </div>
    </div>
  );
}

function ScenicPlaceholder({ kind = "plain", icon }) {
  const palettes = {
    plain: ["#C9A876", "#A87A48", "#7a4f25"],
    range: ["#D9C5A3", "#9a6f3d", "#5a3a1c"],
    water: ["#aed4e5", "#6fa2c2", "#3a6b88"],
    night: ["#1a2640", "#0a1224", "#000814"],
    cafe:  ["#e6c9a8", "#b08660", "#6b4828"],
    bloom: ["#d6e0a8", "#8a9b4a", "#4a5a25"],
    camp:  ["#c8a878", "#7a5a32", "#3b2a18"],
  };
  const p = palettes[kind] || palettes.plain;
  return (
    <div style={{
      width: 110, minHeight: 110, flexShrink: 0,
      position: "relative", overflow: "hidden",
      background: `linear-gradient(180deg, ${p[0]} 0%, ${p[1]} 70%, ${p[2]} 100%)`,
    }}>
      <svg viewBox="0 0 110 110" width="110" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        {kind === "night" ? (
          <g>
            {Array.from({ length: 28 }).map((_, i) => {
              const x = (i * 37) % 110, y = (i * 23) % 60;
              return <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 1.3 : 0.7} fill="#fff" opacity={0.5 + (i % 4) * 0.12}/>;
            })}
            <path d="M 0 80 Q 30 70 55 78 T 110 76 L 110 110 L 0 110 Z" fill={p[2]}/>
          </g>
        ) : (
          <g>
            <path d={`M 0 ${kind === "range" ? 40 : 60} Q 20 ${kind === "range" ? 18 : 50} 40 ${kind === "range" ? 30 : 55} T 80 ${kind === "range" ? 22 : 52} T 110 ${kind === "range" ? 32 : 56} L 110 110 L 0 110 Z`} fill={p[1]} opacity="0.75"/>
            <path d="M 0 80 Q 30 70 55 78 T 110 76 L 110 110 L 0 110 Z" fill={p[2]} opacity="0.9"/>
            {kind === "water" && (
              <g opacity="0.7">
                <path d="M 5 90 L 30 90 M 40 95 L 70 95 M 75 88 L 105 88 M 15 100 L 60 100" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
              </g>
            )}
            {kind === "camp" && (
              <g>
                <path d="M 70 88 L 80 70 L 90 88 Z" fill="#3b2a18"/>
                <path d="M 25 95 L 35 95 M 28 92 L 32 92" stroke="#ffb693" strokeWidth="1.5" strokeLinecap="round"/>
              </g>
            )}
            {kind === "bloom" && (
              <g>
                {[20, 40, 62, 85].map((x, i) => <circle key={i} cx={x} cy={86 - (i % 2) * 4} r="2.5" fill="#FFB693"/>)}
              </g>
            )}
          </g>
        )}
      </svg>
      <div style={{
        position: "absolute", left: 8, top: 8,
        width: 28, height: 28, borderRadius: 8,
        background: "rgba(0,0,0,0.45)", color: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={14} stroke={2.2}/>
      </div>
      <div className="t-mono" style={{
        position: "absolute", right: 6, bottom: 4,
        fontSize: 8, color: "rgba(255,255,255,0.65)", letterSpacing: 0.3,
      }}>placeholder</div>
    </div>
  );
}

function ChatPanel() {
  const [messages, setMessages] = useState([
    { from: "ai", text: "G'day. You're 32% along the Strzelecki - 184km until your next reliable fuel at Cameron Corner. The track is dry, traffic is light, and you're about 4 hours ahead of your overnight camp. What can I help with?" },
    { from: "user", text: "Any decent coffee between here and Cameron Corner?" },
    { from: "ai", text: "Realistically, no coffee shop. Your best bet is brewing your own at the Cordillo Downs shed (184km ahead) - it has a sheltered table and a tap. If you push to Cameron Corner Store (312km), they pour instant. I'll bookmark Cordillo as a coffee + leg-stretch stop." },
    { from: "user", text: "What's the bird activity at Coongie if I detour tomorrow?" },
    { from: "ai", text: "Coongie Lakes is one of the strongest waterbird sites in the channel country right now - recent reports list pelicans, black swans, and four cormorant species. Early morning is best. Allow 1.5 hours each way on the spur track; firm surface after the dry week.", streaming: true },
  ]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!draft.trim()) return;
    setMessages([...messages, { from: "user", text: draft }, { from: "ai", text: "Let me check…", streaming: true }]);
    setDraft("");
    setTimeout(() => {
      setMessages(m => {
        const copy = m.slice();
        copy[copy.length - 1] = {
          from: "ai",
          text: "I've flagged that for the camp tonight. There's also a Roamer report 6 km north of your route worth a look.",
        };
        return copy;
      });
    }, 1400);
  };

  return (
    <div ref={scrollRef} style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: "100%" }}>
      {messages.map((m, i) => (<ChatMessage key={i} msg={m}/>))}
      <div style={{ height: 80 }}/>
      <ChatInput value={draft} onChange={setDraft} onSend={send}/>
    </div>
  );
}

function ChatMessage({ msg }) {
  const isAi = msg.from === "ai";
  const phoneMatch = msg.text.match(/\+?\d[\d \-]{6,}\d/);
  const urlMatch = msg.text.match(/https?:\/\/(\S+)/);
  return (
    <div style={{ display: "flex", justifyContent: isAi ? "flex-start" : "flex-end" }}>
      <div style={{
        maxWidth: "82%",
        padding: "10px 14px",
        borderRadius: 16,
        borderBottomLeftRadius: isAi ? 4 : 16,
        borderBottomRightRadius: isAi ? 16 : 4,
        background: isAi ? "var(--c-surface)" : "var(--c-accent)",
        color: isAi ? "var(--c-text)" : "white",
        boxShadow: isAi ? "var(--sh-card)" : "none",
        border: isAi ? "1px solid var(--c-border)" : "none",
        fontSize: 14, lineHeight: 1.5,
      }}>
        {isAi && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 4,
          }}>
            <Icon name="sparkle" size={12} stroke={2.4} style={{ color: "var(--c-accent)" }}/>
            <span style={{
              fontSize: 10, fontWeight: 700, color: "var(--c-accent)",
              textTransform: "uppercase", letterSpacing: 0.4,
            }}>Roam Guide</span>
            {msg.streaming && (
              <span style={{ display: "inline-flex", gap: 2, marginLeft: 4 }}>
                <Dot d="0s"/><Dot d="0.2s"/><Dot d="0.4s"/>
              </span>
            )}
          </div>
        )}
        <div>{msg.text}</div>
        {isAi && (urlMatch || phoneMatch) && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {phoneMatch && (
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 10,
                background: "var(--c-success)", color: "white",
                fontSize: 12, fontWeight: 700,
              }}>
                <Icon name="phone" size={12} stroke={2.4}/> Call
              </button>
            )}
            {urlMatch && (
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 10,
                background: "var(--c-info)", color: "white",
                fontSize: 12, fontWeight: 700,
              }}>
                <Icon name="open" size={12} stroke={2.4}/> Visit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Dot({ d }) {
  return (
    <span style={{
      width: 4, height: 4, borderRadius: 999, background: "var(--c-accent)",
      animation: `pulse-soft 1s ease-in-out ${d} infinite`,
    }}/>
  );
}

function ChatInput({ value, onChange, onSend }) {
  return (
    <div style={{
      position: "absolute", left: 16, right: 16, bottom: 112,
      background: "var(--c-surface)",
      borderRadius: 22,
      border: "1px solid var(--c-border)",
      boxShadow: "var(--sh-floating)",
      padding: "6px 6px 6px 14px",
      display: "flex", alignItems: "center", gap: 8,
      zIndex: 5,
    }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onSend()}
        placeholder="Ask about anything along the route…"
        style={{
          flex: 1, border: "none", outline: "none", background: "transparent",
          fontSize: 14, color: "var(--c-text)", fontFamily: "var(--font-body)",
          minHeight: 36,
        }}
      />
      <button onClick={onSend} style={{
        width: 40, height: 40, borderRadius: 999,
        background: value.trim() ? "var(--c-accent)" : "var(--c-surface-muted)",
        color: value.trim() ? "white" : "var(--c-text-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s ease",
      }}>
        <Icon name="arrowUp" size={18} stroke={2.4}/>
      </button>
    </div>
  );
}
