const dotenv = require('dotenv');
dotenv.config();
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ ERREUR : Variables d'environnement VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY introuvables.");
  console.error("Veuillez créer un fichier .env ou .env.local avec vos identifiants Supabase.");
  process.exit(1);
}

console.log(`📡 Connexion à Supabase (${SUPABASE_URL})...`);

fetch(`${SUPABASE_URL}/rest/v1/interventions?select=id&limit=1`, {
  method: 'GET',
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  }
})
.then(async (res) => {
  if (res.ok) {
    console.log("✅ SUCCÈS : Supabase a bien été contacté et est maintenu éveillé !");
  } else {
    const errorText = await res.text();
    console.error("❌ ERREUR Supabase :", res.status, errorText);
    process.exit(1);
  }
})
.catch((err) => {
  console.error("❌ ERREUR Réseau :", err.message);
  process.exit(1);
});
