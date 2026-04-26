export const supabaseConfig = {
  url: "https://vupfwbseswvdaiiyizpf.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1cGZ3YnNlc3d2ZGFpaXlpenBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzg4OTksImV4cCI6MjA5MjcxNDg5OX0.LQDfBbaU9cJI1e9HZZ9Nn0zNFQX4J9ch3FB6fnl2xmg",
};

export const appSettings = {
  siteName: "USDT Mine",
  currency: "USD",
};

export const isSupabaseConfigured =
  typeof supabaseConfig.url === "string" &&
  typeof supabaseConfig.anonKey === "string" &&
  supabaseConfig.url.length > 0 &&
  supabaseConfig.anonKey.length > 0 &&
  !supabaseConfig.url.startsWith("YOUR_") &&
  !supabaseConfig.anonKey.startsWith("YOUR_");
