# Configuration de la Synchronisation (Supabase)

Pour que vos interventions soient partagées entre votre PC et votre téléphone, vous devez créer une base de données gratuite sur **Supabase**.

## 1. Créer le projet
1. Allez sur [supabase.com](https://supabase.com/) et créez un compte gratuit.
2. Créez un nouveau projet (nommez-le "Gestion Interventions").

## 2. Créer la table
1. Dans votre projet Supabase, allez dans **SQL Editor** (dans le menu de gauche).
2. Cliquez sur **New Query**.
3. Copiez et collez le code suivant, puis cliquez sur **Run** :

```sql
create table interventions (
  id text primary key,
  "dateSaisie" text,
  "numeroBon" text,
  demandeur text,
  "refBatiment" text,
  "dateDemande" text,
  "dateDevis" text,
  lieu text,
  etage text,
  piece text,
  demande text,
  description text,
  atelier text,
  passages jsonb,
  signature text,
  created_at timestamptz default now()
);

-- Désactiver RLS (Row Level Security) pour simplifier
alter table interventions disable row level security;
```

## 3. Configurer les clés dans Vercel
1. Allez dans **Project Settings** > **API**.
2. Copiez l'**URL** et la **anon public** key.
3. Allez sur votre tableau de bord **Vercel** pour ce projet.
4. Allez dans **Settings** > **Environment Variables**.
5. Ajoutez les deux variables suivantes :
   - `VITE_SUPABASE_URL` : (collez l'URL de Supabase)
   - `VITE_SUPABASE_ANON_KEY` : (collez la clé anon de Supabase)

## 4. Redéployer
Redéployez l'application sur Vercel. Désormais, une petite icône de nuage apparaîtra sur l'accueil :
- 🟢 Vert : Synchronisé
- 🔵 Bleu : En cours...
- ⚪ Gris : Mode local
