import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  daysFrom,
  EXAM_LAST_DAY,
  formatDay,
  formatMonth,
  hoursValue,
  isoDate,
  type Journal as JournalData,
} from "./exam";

const emptyLog = { hours: "", note: "" };
const numberFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

export function Journal({
  planStart,
  journal,
  onChange,
}: {
  planStart: string;
  journal: JournalData;
  onChange: (day: string, patch: Partial<{ hours: string; note: string }>) => void;
}) {
  const today = isoDate(new Date());
  const days = useMemo(() => daysFrom(planStart, EXAM_LAST_DAY), [planStart]);
  const months = useMemo(() => {
    const groups: { key: string; days: string[] }[] = [];
    for (const day of days) {
      const key = day.slice(0, 7);
      const last = groups[groups.length - 1];
      if (!last || last.key !== key) groups.push({ key, days: [day] });
      else last.days.push(day);
    }
    return groups;
  }, [days]);

  const totalHours = days.reduce((sum, day) => sum + hoursValue(journal[day]?.hours ?? ""), 0);
  const filledDays = days.filter((day) => {
    const entry = journal[day];
    return Boolean(entry && (entry.hours || entry.note.trim()));
  }).length;

  function showToday() {
    const month = document.getElementById(`month-${today.slice(0, 7)}`);
    if (month instanceof HTMLDetailsElement) month.open = true;
    document.getElementById(`day-${today}`)?.scrollIntoView({ block: "center" });
  }

  return (
    <section className="journal" aria-labelledby="gunluk-baslik">
      <header className="journal-head">
        <div>
          <h2 id="gunluk-baslik">Günlük çalışma</h2>
          <p>Bugünden AYT gününe kadar her gün için saatini ve ne çalıştığını yaz.</p>
        </div>
        <div className="journal-summary">
          <strong>{numberFormat.format(totalHours)}</strong>
          <span>saat</span>
          <strong>{filledDays}</strong>
          <span>gün dolu</span>
        </div>
        <button type="button" onClick={showToday}>
          Bugüne git
        </button>
      </header>

      {months.map((month) => {
        const monthHours = month.days.reduce(
          (sum, day) => sum + hoursValue(journal[day]?.hours ?? ""),
          0,
        );
        return (
          <Month
            key={month.key}
            monthKey={month.key}
            startOpen={month.key === today.slice(0, 7)}
            title={formatMonth(month.key)}
            hoursLabel={`${numberFormat.format(monthHours)} saat`}
          >
            <ul>
              {month.days.map((day) => {
                const entry = journal[day] ?? emptyLog;
                const kind =
                  day === "2027-06-19" ? "TYT" : day === "2027-06-20" ? "AYT" : day === today ? "Bugün" : "";
                return (
                  <li key={day} id={`day-${day}`} className={day === today ? "day today" : "day"}>
                    <div className="day-date">
                      <strong>{formatDay(day)}</strong>
                      {kind ? <em>{kind}</em> : null}
                    </div>
                    <label>
                      <span>Saat</span>
                      <input
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`${formatDay(day)} çalışma saati`}
                        value={entry.hours}
                        onChange={(event) => onChange(day, { hours: event.target.value })}
                      />
                    </label>
                    <label className="day-note">
                      <span>Ne çalıştın?</span>
                      <textarea
                        rows={2}
                        maxLength={2000}
                        placeholder="Örneğin limit, paragraf, 40 soru fizik"
                        aria-label={`${formatDay(day)} çalışılanlar`}
                        value={entry.note}
                        onChange={(event) => onChange(day, { note: event.target.value })}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </Month>
        );
      })}
    </section>
  );
}

function Month({
  monthKey,
  startOpen,
  title,
  hoursLabel,
  children,
}: {
  monthKey: string;
  startOpen: boolean;
  title: string;
  hoursLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (ref.current && startOpen) ref.current.open = true;
  }, [startOpen]);

  return (
    <details ref={ref} id={`month-${monthKey}`} className="month">
      <summary>
        <span>{title}</span>
        <span>{hoursLabel}</span>
      </summary>
      {children}
    </details>
  );
}
