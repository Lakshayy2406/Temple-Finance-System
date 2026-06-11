import axios from "axios";

const api = axios.create({ baseURL: "http://127.0.0.1:5000" });

export const fetchIncome = () => api.get("/income/all");
export const fetchExpense = () => api.get("/expense/all");
export const fetchSettings = () => api.get("/settings/");

export const addIncome = (data) => api.post("/income/add", data);
export const addExpense = (data) => api.post("/expense/add", data);

export const fetchPendingUpi = () => api.get("/upi/pending");
export const fetchConvertedUpi = () => api.get("/upi/converted");
export const convertUpi = (txId) => api.post(`/upi/convert/${txId}`);
export const syncUpiFromIncome = () => api.post("/upi/sync-from-income");

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export default api;
