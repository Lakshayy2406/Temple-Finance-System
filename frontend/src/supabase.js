import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

function requireClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  return supabase;
}

function normalizeTransaction(input) {
  return {
    date: input.date,
    type: input.type,
    category: input.category?.trim() || null,
    description: input.description?.trim() || null,
    amount: Number(input.amount),
  };
}

export async function loginAdmin(email, password) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function logoutAdmin() {
  const { error } = await requireClient().auth.signOut();
  if (error) throw error;
}

export async function checkAuth() {
  const { data, error } = await requireClient().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  return requireClient().auth.onAuthStateChange(callback);
}

export async function addTransaction(transaction) {
  const { data: userData, error: userError } = await requireClient().auth.getUser();
  if (userError) throw userError;

  const payload = {
    ...normalizeTransaction(transaction),
    created_by: userData.user?.id ?? null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await requireClient()
    .from("transactions")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTransactions() {
  const { data, error } = await requireClient()
    .from("transactions")
    .select("*")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateTransaction(id, transaction) {
  const { data, error } = await requireClient()
    .from("transactions")
    .update(normalizeTransaction(transaction))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  const { error } = await requireClient().from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
