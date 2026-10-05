// Fonction serverless pour empêcher la mise en veille de Supabase (Vercel Cron / Request externe)
export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        error: "Variables d'environnement manquantes (VITE_SUPABASE_URL ou SUPABASE_URL non trouvée)." 
      });
    }

    // Requête légère sur la table interventions pour générer de l'activité réelle en BDD
    const response = await fetch(`${SUPABASE_URL}/rest/v1/interventions?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (response.ok) {
      return res.status(200).json({ 
        status: "ok", 
        message: "Supabase maintenu éveillé avec succès !",
        timestamp: new Date().toISOString()
      });
    } else {
      const errorText = await response.text();
      return res.status(500).json({ 
        error: "Échec de la connexion à Supabase", 
        details: errorText 
      });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

