export const supabaseConfig = {
  url: "https://ljtamjayjlvglsitgzaf.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqdGFtamF5amx2Z2xzaXRnemFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjAxOTksImV4cCI6MjA5Mjc5NjE5OX0.VqW87HW23yOYBj_Cu3pa6VLyVdUnVYxS5kD0YUYjZHE",
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
