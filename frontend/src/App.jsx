import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchIncome,
  fetchExpense,
  fetchSettings,
  addIncome,
  addExpense,
  formatCurrency,
  fetchPendingUpi,
  fetchConvertedUpi,
  convertUpi,
  syncUpiFromIncome,
} from "./api";
import {
  PERIODS,
  filterByPeriod,
  sumAmount,
  periodLabel,
  activeIncome,
} from "./utils/dateFilter";
import { formatDateTime } from "./utils/format";

const MODES = ["Cash", "UPI"];

function recordMatchesSearch(record, fields, query) {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return fields.some((field) =>
    String(record[field] ?? "").toLowerCase().includes(term)
  );
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`toast ${type}`} role="status">
      {message}
    </div>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <div className="search-box">
      <span className="search-icon">🔎</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, title, sender, or record ID"
        aria-label="Search records"
      />
      {value && (
        <button type="button" className="search-clear" onClick={() => onChange("")}>
          ×
        </button>
      )}
    </div>
  );
}

function PeriodFilter({ period, customRange, onPeriodChange, onCustomChange }) {
  return (
    <div className="filter-bar">
      <div className="filter-label">
        <span className="filter-icon">📅</span>
        <span>Time Period</span>
      </div>
      <div className="filter-pills">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`filter-pill ${period === p.id ? "active" : ""}`}
            onClick={() => onPeriodChange(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="filter-custom">
          <input
            type="date"
            value={customRange.from}
            onChange={(e) => onCustomChange({ ...customRange, from: e.target.value })}
            aria-label="From date"
          />
          <span className="filter-sep">to</span>
          <input
            type="date"
            value={customRange.to}
            onChange={(e) => onCustomChange({ ...customRange, to: e.target.value })}
            aria-label="To date"
          />
        </div>
      )}
    </div>
  );
}

function ModeToggle({ value, onChange, name }) {
  return (
    <div className="mode-toggle">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          className={`mode-btn ${m.toLowerCase()} ${value === m ? "active" : ""}`}
          onClick={() => onChange({ target: { name, value: m } })}
        >
          {m === "Cash" ? "💵" : "📱"} {m}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, variant, icon }) {
  return (
    <div className={`stat-card ${variant}`}>
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">{formatCurrency(value)}</div>
    </div>
  );
}

function EmptyTable({ icon, text }) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <p>{text}</p>
    </div>
  );
}

function DashboardView({ income, expense }) {
  const recentIncome = [...income].reverse().slice(0, 5);
  const recentExpense = [...expense].reverse().slice(0, 5);
  const totalIncome = sumAmount(activeIncome(income));
  const totalExpense = sumAmount(expense);

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Income" value={totalIncome} variant="income" icon="↑" />
        <StatCard label="Expense" value={totalExpense} variant="expense" icon="↓" />
        <StatCard
          label="Balance"
          value={totalIncome - totalExpense}
          variant="balance"
          icon="="
        />
      </div>

      <div className="recent-grid">
        <div className="panel">
          <div className="panel-header">
            <h3>Recent Income</h3>
            <span className="badge badge-green">{income.length}</span>
          </div>
          {recentIncome.length === 0 ? (
            <EmptyTable icon="🙏" text="No income in this period" />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentIncome.map((row, i) => (
                    <tr key={i}>
                      <td className="date-cell">{formatDateTime(row.Date, row.Time)}</td>
                      <td className="name-cell">{row.Name}</td>
                      <td className="amount-cell">{formatCurrency(row.Amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Recent Expenses</h3>
            <span className="badge badge-red">{expense.length}</span>
          </div>
          {recentExpense.length === 0 ? (
            <EmptyTable icon="📋" text="No expenses in this period" />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExpense.map((row, i) => (
                    <tr key={i}>
                      <td className="date-cell">{row.Date}</td>
                      <td className="name-cell">{row.Title}</td>
                      <td className="amount-cell expense">
                        {formatCurrency(row.Amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function IncomeView({ records, onSubmit }) {
  const [form, setForm] = useState({
    name: "",
    amount: "",
    mode: "Cash",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.amount) return;
    onSubmit(form);
    setForm({ name: "", amount: "", mode: "Cash" });
  }

  return (
    <div className="layout-split">
      <div className="panel form-panel">
        <div className="panel-header">
          <h3>Add Income</h3>
        </div>
        <div className="panel-body">
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="inc-name">Donor Name</label>
              <input
                id="inc-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter donor name"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="inc-amount">Amount (₹)</label>
              <input
                id="inc-amount"
                name="amount"
                type="number"
                min="1"
                value={form.amount}
                onChange={handleChange}
                placeholder="0"
                required
              />
            </div>
            <div className="form-group">
              <label>Payment Mode</label>
              <ModeToggle value={form.mode} onChange={handleChange} name="mode" />
            </div>
            <button type="submit" className="btn btn-primary">
              Record Income
            </button>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Income Records</h3>
          <span className="badge badge-green">{records.length} entries</span>
        </div>
        {records.length === 0 ? (
          <EmptyTable icon="🙏" text="No income in this period" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Name</th>
                  <th>Amount</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {[...records].reverse().map((row, i) => (
                  <tr key={i}>
                    <td className="date-cell">{formatDateTime(row.Date, row.Time)}</td>
                    <td className="name-cell">{row.Name}</td>
                    <td className="amount-cell">{formatCurrency(row.Amount)}</td>
                    <td>
                      <span className={`badge mode-${(row.Mode || "").toLowerCase()}`}>
                        {row.Mode}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseView({ records, onSubmit }) {
  const [form, setForm] = useState({
    title: "",
    amount: "",
    mode: "Cash",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.amount) return;
    onSubmit(form);
    setForm({ title: "", amount: "", mode: "Cash" });
  }

  return (
    <div className="layout-split">
      <div className="panel form-panel">
        <div className="panel-header">
          <h3>Add Expense</h3>
        </div>
        <div className="panel-body">
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="exp-title">Title</label>
              <input
                id="exp-title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="What was this expense for?"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="exp-amount">Amount (₹)</label>
              <input
                id="exp-amount"
                name="amount"
                type="number"
                min="1"
                value={form.amount}
                onChange={handleChange}
                placeholder="0"
                required
              />
            </div>
            <div className="form-group">
              <label>Payment Mode</label>
              <ModeToggle value={form.mode} onChange={handleChange} name="mode" />
            </div>
            <button type="submit" className="btn btn-primary btn-expense">
              Record Expense
            </button>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Expense Records</h3>
          <span className="badge badge-red">{records.length} entries</span>
        </div>
        {records.length === 0 ? (
          <EmptyTable icon="📋" text="No expenses in this period" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Amount</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {[...records].reverse().map((row, i) => (
                  <tr key={i}>
                    <td className="date-cell">{row.Date}</td>
                    <td className="name-cell">{row.Title}</td>
                    <td className="amount-cell expense">
                      {formatCurrency(row.Amount)}
                    </td>
                    <td>
                      <span className={`badge mode-${(row.Mode || "").toLowerCase()}`}>
                        {row.Mode}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function UpiConversionView({ pending, converted, onConvert, onRefresh, converting }) {
  const pendingTotal = sumAmount(
    pending.map((r) => ({ Amount: r.Amount }))
  );

  return (
    <div className="upi-layout">
      <div className="upi-summary">
        <div className="upi-summary-card pending">
          <span className="upi-summary-label">Pending UPI</span>
          <span className="upi-summary-value">{formatCurrency(pendingTotal)}</span>
          <span className="upi-summary-count">{pending.length} transaction(s)</span>
        </div>
        <div className="upi-summary-card converted">
          <span className="upi-summary-label">Converted to Cash</span>
          <span className="upi-summary-value">
            {formatCurrency(sumAmount(converted.map((r) => ({ Amount: r.Amount }))))}
          </span>
          <span className="upi-summary-count">{converted.length} conversion(s)</span>
        </div>
        <button type="button" className="btn btn-ghost upi-refresh" onClick={onRefresh}>
          ↻ Refresh
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Pending UPI — Convert to Cash</h3>
          <span className="badge mode-upi live-badge">Auto-fetching</span>
        </div>
        {pending.length === 0 ? (
          <EmptyTable icon="📱" text="No pending UPI payments" />
        ) : (
          <div className="upi-list">
            {pending.map((tx) => (
              <div className="upi-card" key={tx["Transaction ID"]}>
                <div className="upi-card-info">
                  <span className="upi-card-amount">{formatCurrency(tx.Amount)}</span>
                  <span className="upi-card-sender">{tx.Sender}</span>
                  <span className="upi-card-meta">
                    {formatDateTime(tx.Date, tx.Time)}
                    {tx.Reference && ` · Ref: ${tx.Reference}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-convert"
                  disabled={converting === tx["Transaction ID"]}
                  onClick={() => onConvert(tx["Transaction ID"])}
                >
                  {converting === tx["Transaction ID"] ? "Converting…" : "Convert to Cash"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Conversion History</h3>
          <span className="badge badge-green">{converted.length} records</span>
        </div>
        {converted.length === 0 ? (
          <EmptyTable icon="💱" text="No conversions yet" />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Converted At</th>
                  <th>Transaction ID</th>
                  <th>Amount</th>
                  <th>Cash Record</th>
                </tr>
              </thead>
              <tbody>
                {[...converted].reverse().map((row, i) => (
                  <tr key={i}>
                    <td className="date-cell">
                      {formatDateTime(row.Date, row.Time)}
                    </td>
                    <td className="mono-cell">{row["Transaction ID"]}</td>
                    <td className="amount-cell">{formatCurrency(row.Amount)}</td>
                    <td>
                      <span className="badge mode-cash">{row["Cash Income Ref"]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "income", label: "Income", icon: "🙏" },
  { id: "expense", label: "Expense", icon: "📋" },
  { id: "upi", label: "UPI to Cash", icon: "💱" },
];

const PAGE_META = {
  dashboard: { title: "Dashboard", subtitle: "Overview of temple finances" },
  income: { title: "Income", subtitle: "Record donations and offerings" },
  upi: {
    title: "UPI to Cash",
    subtitle: "Fetch pending UPI payments and convert to cash records",
  },
  expense: { title: "Expenses", subtitle: "Track temple expenditures" },
};

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [income, setIncome] = useState([]);
  const [expense, setExpense] = useState([]);
  const [settings, setSettings] = useState({ temple_name: "Temple Finance System" });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [period, setPeriod] = useState("all");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [pendingUpi, setPendingUpi] = useState([]);
  const [convertedUpi, setConvertedUpi] = useState([]);
  const [converting, setConverting] = useState(null);
  const [upiSynced, setUpiSynced] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const [inc, exp, sett] = await Promise.all([
        fetchIncome(),
        fetchExpense(),
        fetchSettings(),
      ]);
      setIncome(inc.data);
      setExpense(exp.data);
      setSettings(sett.data);
    } catch (err) {
      setToast({
        message: err.response
          ? "Server error loading data. Check that the backend and Google Sheet are set up."
          : "Could not connect to server. Is the backend running?",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUpi = useCallback(async () => {
    try {
      const [pending, converted] = await Promise.all([
        fetchPendingUpi(),
        fetchConvertedUpi(),
      ]);
      setPendingUpi(pending.data);
      setConvertedUpi(converted.data);
    } catch {
      /* UPI endpoints may fail if sheets not ready */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!upiSynced) {
      syncUpiFromIncome()
        .then(() => loadUpi())
        .catch(() => loadUpi())
        .finally(() => setUpiSynced(true));
    }
  }, [upiSynced, loadUpi]);

  useEffect(() => {
    loadUpi();
    const interval = setInterval(loadUpi, 15000);
    return () => clearInterval(interval);
  }, [loadUpi]);

  const filteredIncome = useMemo(() => {
    const periodRecords = activeIncome(filterByPeriod(income, period, customRange));
    return periodRecords.filter((row) =>
      recordMatchesSearch(row, ["Name", "Amount", "Mode", "Date", "Time"], searchQuery)
    );
  }, [income, period, customRange, searchQuery]);

  const filteredExpense = useMemo(() => {
    const periodRecords = filterByPeriod(expense, period, customRange);
    return periodRecords.filter((row) =>
      recordMatchesSearch(row, ["Title", "Amount", "Mode", "Date"], searchQuery)
    );
  }, [expense, period, customRange, searchQuery]);

  const filteredPendingUpi = useMemo(
    () =>
      pendingUpi.filter((row) =>
        recordMatchesSearch(
          row,
          ["Sender", "Transaction ID", "Reference", "Amount", "Date", "Time"],
          searchQuery
        )
      ),
    [pendingUpi, searchQuery]
  );

  const filteredConvertedUpi = useMemo(
    () =>
      convertedUpi.filter((row) =>
        recordMatchesSearch(
          row,
          ["Conversion ID", "Transaction ID", "Cash Income Ref", "Amount", "Date", "Time"],
          searchQuery
        )
      ),
    [convertedUpi, searchQuery]
  );

  async function handleAddIncome(form) {
    try {
      await addIncome({
        name: form.name,
        amount: form.amount,
        mode: form.mode,
      });
      const queued = form.mode === "UPI";
      setToast({
        message: queued
          ? "UPI income recorded — track conversion in UPI to Cash"
          : "Income recorded successfully",
        type: "success",
      });
      await Promise.all([load(), loadUpi()]);
    } catch {
      setToast({ message: "Failed to save income", type: "error" });
    }
  }

  async function handleConvertUpi(txId) {
    setConverting(txId);
    try {
      const res = await convertUpi(txId);
      setToast({
        message: `${formatCurrency(res.data.amount)} converted to cash`,
        type: "success",
      });
      await Promise.all([load(), loadUpi()]);
    } catch (err) {
      const msg = err.response?.data?.error || "Conversion failed";
      setToast({ message: msg, type: "error" });
    } finally {
      setConverting(null);
    }
  }

  async function handleAddExpense(form) {
    try {
      await addExpense({
        title: form.title,
        amount: form.amount,
        mode: form.mode,
      });
      setToast({ message: "Expense recorded successfully", type: "success" });
      await load();
    } catch {
      setToast({ message: "Failed to save expense", type: "error" });
    }
  }

  const meta = PAGE_META[tab];
  const templeName = settings.temple_name || "Temple Finance System";
  const activePeriodLabel = periodLabel(period, customRange);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🛕</div>
          <div>
            <h1>{templeName}</h1>
            <p>{settings.address || "Neelkanth Mahadev Mandir, Gulab Bari Ajmer"}</p>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-btn ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">Synced with Google Sheets</div>
      </aside>

      <main className="main">
        <header className="page-header">
          <div>
            <h2>{meta.title}</h2>
            <p>
              {meta.subtitle}
              {period !== "all" && (
                <span className="period-hint"> · Showing {activePeriodLabel}</span>
              )}
            </p>
          </div>
        </header>

        <SearchBox value={searchQuery} onChange={setSearchQuery} />

        {tab !== "upi" && (
          <PeriodFilter
            period={period}
            customRange={customRange}
            onPeriodChange={setPeriod}
            onCustomChange={setCustomRange}
          />
        )}

        {loading ? (
          <div className="loading">
            <div className="spinner" />
            <span>Loading data…</span>
          </div>
        ) : (
          <>
            {tab === "dashboard" && (
              <DashboardView income={filteredIncome} expense={filteredExpense} />
            )}
            {tab === "income" && (
              <IncomeView records={filteredIncome} onSubmit={handleAddIncome} />
            )}
            {tab === "upi" && (
              <UpiConversionView
                pending={filteredPendingUpi}
                converted={filteredConvertedUpi}
                onConvert={handleConvertUpi}
                onRefresh={loadUpi}
                converting={converting}
              />
            )}
            {tab === "expense" && (
              <ExpenseView records={filteredExpense} onSubmit={handleAddExpense} />
            )}
          </>
        )}
      </main>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
