import { useEffect, useState } from "react";
import { TYT_AT } from "./exam";

const parts = [
  { key: "days", label: "gün" },
  { key: "hours", label: "saat" },
  { key: "minutes", label: "dakika" },
  { key: "seconds", label: "saniye" },
] as const;

function remaining(now: number) {
  const diff = Math.max(0, TYT_AT.getTime() - now);
  return {
    done: diff === 0,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

export function Countdown() {
  const [clock, setClock] = useState(() => remaining(Date.now()));

  useEffect(() => {
    const timer = window.setInterval(() => setClock(remaining(Date.now())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="countdown" aria-label="YKS sayacı">
      <div className="count-copy">
        <h2>YKS 2027</h2>
        <p>{clock.done ? "TYT saati geldi." : "TYT 19 Haziran 2027, saat 10:15. AYT ertesi gün."}</p>
      </div>
      <div className="count-grid">
        {parts.map((part) => (
          <div key={part.key}>
            <strong>{String(clock[part.key]).padStart(2, "0")}</strong>
            <span>{part.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
