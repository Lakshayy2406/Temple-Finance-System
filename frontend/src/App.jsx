import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addTransaction,
  checkAuth,
  deleteTransaction,
  formatCurrency,
  getTransactions,
  isSupabaseConfigured,
  loginAdmin,
  logoutAdmin,
  onAuthStateChange,
  updateTransaction,
} from "./supabase";
import {
  PERIODS,
  filterByPeriod,
  getConversionDate,
  getTransactionDate,
  isInPeriod,
  periodLabel,
  sortByConversionDateDesc,
  sortByTransactionDateDesc,
  sumAmount,
} from "./utils/dateFilter";
import { formatIndianDateTime } from "./utils/format";
import {
  RECEIPT_TEMPLE_NAME,
  downloadReceiptPdf,
  receiptAmount,
  receiptParts,
} from "./utils/receipt";
import {
  downloadDashboardExcel,
  downloadDashboardPdf,
  downloadExpenseExcel,
  downloadExpensePdf,
  downloadIncomeExcel,
  downloadIncomePdf,
  downloadUpiExcel,
  downloadUpiPdf,
} from "./utils/reports";

const TEMPLE_NAME = "Temple Finance System";
const TEMPLE_ADDRESS = "Neelkanth Mahadev Mandir, Gulab Bari Ajmer";
const MODES = ["Cash", "UPI"];
const UPI_CONVERTED_MODE = "UPI Converted";

function today() {
  return new Date().toISOString();
}

function toIncomeRow(row) {
  const isConverted = row.category === UPI_CONVERTED_MODE;
  const mode = isConverted ? "Cash" : row.category || "General";
  return {
    ...row,
    Date: row.date,
    Time: getTransactionDate(row),
    Name: row.description || "-",
    Amount: row.amount,
    Mode: mode,
    HasReceipt: !isConverted && Boolean(row.receipt_no),
    Sender: row.description || "-",
    Reference: `TX-${String(row.id).slice(0, 8).toUpperCase()}`,
    "Receipt No": row.receipt_no || "",
    Status: isConverted ? "Converted" : row.category === "UPI" ? "Pending" : "Recorded",
    "Transaction ID": row.id,
    "Cash Income Ref": `INCOME-${String(row.id).slice(0, 8).toUpperCase()}`,
  };
}

function toExpenseRow(row) {
  return {
    ...row,
    Date: row.date,
    Title: row.description || "-",
    Amount: row.amount,
    Mode: row.category || "General",
  };
}

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

function LoginScreen({ onLogin, loading, error }) {
  const [form, setForm] = useState({ email: "", password: "" });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onLogin(form.email, form.password);
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="brand login-brand">
          <div className="brand-icon">🛕</div>
          <div>
            <h1>{TEMPLE_NAME}</h1>
            <p>{TEMPLE_ADDRESS}</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div>
            <h2>Admin Login</h2>
            <p>Sign in with your Supabase admin account.</p>
          </div>
          {!isSupabaseConfigured && (
            <div className="form-alert error">
              Supabase env vars are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
            </div>
          )}
          {error && <div className="form-alert error">{error}</div>}
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="admin@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Password"
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading || !isSupabaseConfigured}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
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
          x
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

function DownloadReport({ onPdf, onExcel }) {
  return (
    <div className="download-report">
      <span>📥 Download Report</span>
      <button type="button" className="btn btn-ghost report-btn" onClick={onPdf}>
        📥 PDF
      </button>
      <button type="button" className="btn btn-ghost report-btn" onClick={onExcel}>
        📊 Excel
      </button>
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

function EmptyTable({ icon, text }) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <p>{text}</p>
    </div>
  );
}

function ReceiptContent({ receipt }) {
  const { date, time } = receiptParts(receipt);

  return (
    <div className="receipt-paper">
      <div className="receipt-rule" />
      <div className="receipt-title">
        <h3>{RECEIPT_TEMPLE_NAME}</h3>
        <p>DONATION RECEIPT</p>
      </div>
      <div className="receipt-rule" />

      <div className="receipt-meta">
        <strong>Receipt No: {receipt.receipt_no || "Pending"}</strong>
        <span>Date: {date}</span>
        <span>Time: {time}</span>
      </div>

      <div className="receipt-field">
        <span>Received From:</span>
        <strong>{receipt.Name || receipt.description || "-"}</strong>
      </div>
      <div className="receipt-field">
        <span>Amount:</span>
        <strong>{receiptAmount(receipt.Amount ?? receipt.amount)}</strong>
      </div>
      <div className="receipt-field">
        <span>Payment Mode:</span>
        <strong>{receipt.Mode || receipt.category || "-"}</strong>
      </div>

      <p className="receipt-thanks">Thank You For Your Contribution</p>
      <div className="receipt-rule" />
    </div>
  );
}

function ReceiptModal({ receipt, onClose, onPrint, onDownload }) {
  if (!receipt) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="receipt-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Donation receipt"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="receipt-modal-header no-print">
          <div>
            <h3>Donation Receipt</h3>
            <p>{receipt.receipt_no || "Receipt number pending"}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close receipt">
            x
          </button>
        </div>
        <div id="printable-receipt">
          <ReceiptContent receipt={receipt} />
        </div>
        <div className="receipt-actions no-print">
          <button type="button" className="btn btn-ghost" onClick={onPrint}>
            Print Receipt
          </button>
          <button type="button" className="btn btn-primary receipt-download" onClick={onDownload}>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ income, expense, onViewReceipt }) {
  const recentIncome = income.slice(0, 5);
  const recentExpense = expense.slice(0, 5);
  const totalIncome = sumAmount(income);
  const totalExpense = sumAmount(expense);

  return (
    <>
      <div className="stats-grid">
        <StatCard label="Income" value={totalIncome} variant="income" icon="↑" />
        <StatCard label="Expense" value={totalExpense} variant="expense" icon="↓" />
        <StatCard label="Balance" value={totalIncome - totalExpense} variant="balance" icon="=" />
      </div>

      <div className="recent-grid">
        <RecordTable
          title="Recent Income"
          records={recentIncome}
          type="income"
          readOnly
          onViewReceipt={onViewReceipt}
        />
        <RecordTable title="Recent Expenses" records={recentExpense} type="expense" readOnly />
      </div>
    </>
  );
}

function TransactionForm({ type, onSubmit, saving }) {
  const [form, setForm] = useState({
    date: today(),
    description: "",
    amount: "",
    category: "Cash",
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.description || !form.amount || !form.date) return;
    onSubmit({ ...form, type });
  }

  const isExpense = type === "expense";

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor={`${type}-description`}>{isExpense ? "Title" : "Donor Name"}</label>
        <input
          id={`${type}-description`}
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder={isExpense ? "What was this expense for?" : "Enter donor name"}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor={`${type}-amount`}>Amount (₹)</label>
        <input
          id={`${type}-amount`}
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
        <ModeToggle value={form.category} onChange={handleChange} name="category" />
      </div>
      <button type="submit" className={`btn btn-primary ${isExpense ? "btn-expense" : ""}`} disabled={saving}>
        {saving ? "Saving..." : `Record ${isExpense ? "Expense" : "Income"}`}
      </button>
    </form>
  );
}

function RecordTable({ title, records, type, readOnly = false, onDelete, deletingId, onViewReceipt }) {
  const isExpense = type === "expense";

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        <span className={`badge ${isExpense ? "badge-red" : "badge-green"}`}>{records.length} entries</span>
      </div>
      {records.length === 0 ? (
        <EmptyTable
          icon={isExpense ? "📋" : "🙏"}
          text={`No ${isExpense ? "expenses" : "income"} in this period`}
        />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>{isExpense ? "Title" : "Name"}</th>
                <th>Amount</th>
                <th>Mode</th>
                {!isExpense && <th>Receipt</th>}
                {!readOnly && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={row.id}>
                  <td className="date-cell">{formatIndianDateTime(getTransactionDate(row))}</td>
                  <td className="name-cell">{isExpense ? row.Title : row.Name}</td>
                  <td className={`amount-cell ${isExpense ? "expense" : ""}`}>{formatCurrency(row.Amount)}</td>
                  <td>
                    <span className={`badge mode-${String(row.Mode || "").toLowerCase()}`}>{row.Mode}</span>
                  </td>
                  {!isExpense && row.HasReceipt && (
                    <td>
                      <button type="button" className="link-btn" onClick={() => onViewReceipt?.(row)}>
                        View Receipt
                      </button>
                    </td>
                  )}
                  {!isExpense && !row.HasReceipt && <td className="date-cell">-</td>}
                  {!readOnly && (
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="link-btn danger"
                          disabled={deletingId === row.id}
                          onClick={() => onDelete(row.id)}
                        >
                          {deletingId === row.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TransactionView({
  type,
  records,
  onSubmit,
  onDelete,
  onViewReceipt,
  saving,
  deletingId,
}) {
  const isExpense = type === "expense";

  return (
    <div className="layout-split">
      <div className="panel form-panel">
        <div className="panel-header">
          <h3>Add {isExpense ? "Expense" : "Income"}</h3>
        </div>
        <div className="panel-body">
          <TransactionForm
            type={type}
            onSubmit={onSubmit}
            saving={saving}
          />
        </div>
      </div>
      <RecordTable
        title={`${isExpense ? "Expense" : "Income"} Records`}
        records={records}
        type={type}
        onDelete={onDelete}
        deletingId={deletingId}
        onViewReceipt={onViewReceipt}
      />
    </div>
  );
}

function UpiConversionView({
  pending,
  converted,
  onConvert,
  onRefresh,
  converting,
}) {
  const pendingTotal = sumAmount(pending.map((r) => ({ Amount: r.Amount })));

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
                    {formatIndianDateTime(getTransactionDate(tx))}
                    {tx.Reference && ` · Ref: ${tx.Reference}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-convert"
                  disabled={converting === tx["Transaction ID"]}
                  onClick={() => onConvert(tx)}
                >
                  {converting === tx["Transaction ID"] ? "Converting..." : "Convert to Cash"}
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
                {converted.map((row) => (
                  <tr key={row.id}>
                    <td className="date-cell">{formatIndianDateTime(getConversionDate(row))}</td>
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
  const [transactions, setTransactions] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [converting, setConverting] = useState(null);
  const [toast, setToast] = useState(null);
  const [period, setPeriod] = useState("all");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeReceipt, setActiveReceipt] = useState(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setTransactions(await getTransactions());
    } catch (err) {
      setToast({ message: err.message || "Failed to load records", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    let mounted = true;
    checkAuth()
      .then((currentSession) => {
        if (mounted) setSession(currentSession);
      })
      .catch((err) => setLoginError(err.message))
      .finally(() => mounted && setAuthLoading(false));

    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return undefined;
    }

    const { data } = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setTransactions([]);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) load();
    else setLoading(false);
  }, [session, load]);

  const incomeRows = useMemo(
    () => transactions.filter((row) => row.type === "income").map(toIncomeRow),
    [transactions]
  );
  const expenseRows = useMemo(
    () => transactions.filter((row) => row.type === "expense").map(toExpenseRow),
    [transactions]
  );

  const filteredIncome = useMemo(() => {
    const periodRecords = filterByPeriod(incomeRows, period, customRange);
    return sortByTransactionDateDesc(
      periodRecords.filter((row) =>
        recordMatchesSearch(row, ["Name", "Amount", "Mode", "Date", "Receipt No"], searchQuery)
      )
    );
  }, [incomeRows, period, customRange, searchQuery]);

  const filteredExpense = useMemo(() => {
    const periodRecords = filterByPeriod(expenseRows, period, customRange);
    return sortByTransactionDateDesc(
      periodRecords.filter((row) =>
        recordMatchesSearch(row, ["Title", "Amount", "Mode", "Date"], searchQuery)
      )
    );
  }, [expenseRows, period, customRange, searchQuery]);

  const pendingUpi = useMemo(
    () => incomeRows.filter((row) => row.Mode === "UPI"),
    [incomeRows]
  );

  const convertedUpi = useMemo(
    () =>
      incomeRows.filter(
        (row) => row.category === UPI_CONVERTED_MODE
      ),
    [incomeRows]
  );

  const filteredPendingUpi = useMemo(
    () => {
      const periodRecords = filterByPeriod(pendingUpi, period, customRange);
      return sortByTransactionDateDesc(
        periodRecords.filter((row) =>
          recordMatchesSearch(
            row,
            ["Sender", "Transaction ID", "Reference", "Amount", "Date", "Time"],
            searchQuery
          )
        )
      );
    },
    [pendingUpi, period, customRange, searchQuery]
  );

  const filteredConvertedUpi = useMemo(
    () => {
      return sortByConversionDateDesc(
        convertedUpi.filter((row) =>
          isInPeriod(getConversionDate(row), period, customRange) &&
          recordMatchesSearch(
            row,
            ["Transaction ID", "Cash Income Ref", "Amount", "Date", "Time"],
            searchQuery
          )
        )
      );
    },
    [convertedUpi, period, customRange, searchQuery]
  );

  const reportSummary = useMemo(() => {
    const totalIncome = sumAmount(filteredIncome);
    const totalExpense = sumAmount(filteredExpense);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }, [filteredIncome, filteredExpense]);

  async function handleLogin(email, password) {
    setLoginLoading(true);
    setLoginError("");
    try {
      const data = await loginAdmin(email, password);
      setSession(data.session);
    } catch (err) {
      setLoginError(err.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await logoutAdmin();
    setToast({ message: "Logged out", type: "success" });
  }

  async function handleSubmit(form) {
    setSaving(true);
    try {
      const saved = await addTransaction(form);
      await load();
      if (saved.type === "income") {
        setActiveReceipt(toIncomeRow(saved));
        setToast({ message: "Donation saved and receipt generated", type: "success" });
      } else {
        setToast({ message: "Record saved successfully", type: "success" });
      }
    } catch (err) {
      setToast({ message: err.message || "Failed to save record", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Delete this transaction?");
    if (!confirmed) return;
    setDeletingId(id);
    try {
      await deleteTransaction(id);
      setToast({ message: "Record deleted", type: "success" });
      await load();
    } catch (err) {
      setToast({ message: err.message || "Failed to delete record", type: "error" });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleConvertUpi(tx) {
    setConverting(tx["Transaction ID"]);
    try {
      await updateTransaction(tx.id, {
        type: "income",
        category: UPI_CONVERTED_MODE,
        description: tx.description,
        amount: tx.amount,
        converted_at: new Date().toISOString(),
        receipt_no: null,
      });
      setToast({
        message: `${formatCurrency(tx.Amount)} converted to cash`,
        type: "success",
      });
      await load();
    } catch (err) {
      setToast({ message: err.message || "Conversion failed", type: "error" });
    } finally {
      setConverting(null);
    }
  }

  function handlePrintReceipt() {
    window.print();
  }

  function handleDownloadReceipt() {
    if (activeReceipt) downloadReceiptPdf(activeReceipt);
  }

  if (authLoading) {
    return (
      <div className="loading full-page">
        <div className="spinner" />
        <span>Checking session...</span>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} loading={loginLoading} error={loginError} />;
  }

  const meta = PAGE_META[tab];
  const activePeriodLabel = periodLabel(period, customRange);
  const reportActions = {
    dashboard: {
      onPdf: () =>
        downloadDashboardPdf({
          income: filteredIncome,
          expense: filteredExpense,
          summary: reportSummary,
        }),
      onExcel: () =>
        downloadDashboardExcel({
          income: filteredIncome,
          expense: filteredExpense,
          summary: reportSummary,
        }),
    },
    income: {
      onPdf: () => downloadIncomePdf(filteredIncome),
      onExcel: () => downloadIncomeExcel(filteredIncome),
    },
    expense: {
      onPdf: () => downloadExpensePdf(filteredExpense),
      onExcel: () => downloadExpenseExcel(filteredExpense),
    },
    upi: {
      onPdf: () =>
        downloadUpiPdf({
          pending: filteredPendingUpi,
          converted: filteredConvertedUpi,
        }),
      onExcel: () =>
        downloadUpiExcel({
          pending: filteredPendingUpi,
          converted: filteredConvertedUpi,
        }),
    },
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🛕</div>
          <div>
            <h1>{TEMPLE_NAME}</h1>
            <p>{TEMPLE_ADDRESS}</p>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-btn ${tab === item.id ? "active" : ""}`}
              onClick={() => {
                setTab(item.id);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <button type="button" className="btn btn-logout" onClick={handleLogout}>
          Logout
        </button>
        <div className="sidebar-footer">Synced with Supabase</div>
      </aside>

      <main className="main">
        <header className="page-header">
          <div>
            <h2>{meta.title}</h2>
            <p>
              {meta.subtitle}
              {period !== "all" && <span className="period-hint"> - Showing {activePeriodLabel}</span>}
            </p>
          </div>
        </header>

        <div className="search-report-row">
          <SearchBox value={searchQuery} onChange={setSearchQuery} />
          <DownloadReport
            onPdf={reportActions[tab].onPdf}
            onExcel={reportActions[tab].onExcel}
          />
        </div>

        <PeriodFilter
          period={period}
          customRange={customRange}
          onPeriodChange={setPeriod}
          onCustomChange={setCustomRange}
        />

        {loading ? (
          <div className="loading">
            <div className="spinner" />
            <span>Loading data...</span>
          </div>
        ) : (
          <>
            {tab === "dashboard" && (
              <DashboardView
                income={filteredIncome}
                expense={filteredExpense}
                onViewReceipt={setActiveReceipt}
              />
            )}
            {tab === "income" && (
              <TransactionView
                type="income"
                records={filteredIncome}
                onSubmit={handleSubmit}
                onDelete={handleDelete}
                onViewReceipt={setActiveReceipt}
                saving={saving}
                deletingId={deletingId}
              />
            )}
            {tab === "upi" && (
              <UpiConversionView
                pending={filteredPendingUpi}
                converted={filteredConvertedUpi}
                onConvert={handleConvertUpi}
                onRefresh={load}
                converting={converting}
              />
            )}
            {tab === "expense" && (
              <TransactionView
                type="expense"
                records={filteredExpense}
                onSubmit={handleSubmit}
                onDelete={handleDelete}
                onViewReceipt={setActiveReceipt}
                saving={saving}
                deletingId={deletingId}
              />
            )}
          </>
        )}
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <ReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
        onPrint={handlePrintReceipt}
        onDownload={handleDownloadReceipt}
      />
    </div>
  );
}
