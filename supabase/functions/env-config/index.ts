
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const requestedEnv = url.searchParams.get("env") || "development";
    
    console.log(`Requested environment configuration: ${requestedEnv}`);
    
    // In a real implementation, you might fetch different configuration values
    // from a database or environment variables based on the requested environment
    const config = {
      environment: requestedEnv,
      apiUrl: requestedEnv === "production" 
        ? "https://prod-api.example.com" 
        : "https://dev-api.example.com",
      // Add other environment-specific configuration as needed
    };
    
    console.log(`Returning configuration for ${requestedEnv} environment`);
    
    return new Response(JSON.stringify(config), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in env-config function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
