# HomeFlow V2 - Application professionnelle

Application de gestion des tâches familiales construite avec React, TypeScript, Vite et Supabase.

## 🚀 Installation

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configuration Supabase

Créez un fichier `.env` à la racine du projet :

```env
VITE_SUPABASE_URL=https://phojiiaeesozznnlaxrl.supabase.co
VITE_SUPABASE_ANON_KEY=votre_clé_anon_ici
```

### 3. Lancer en développement

```bash
npm run dev
```

L'application sera disponible sur `http://localhost:5173`

## 📦 Build pour production

```bash
npm run build
```

## 🚢 Déploiement sur Vercel

### Méthode 1 : Via GitHub

1. Push ton code sur GitHub
2. Connecte le repository sur Vercel
3. Configure les variables d'environnement dans Vercel :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy !

### Méthode 2 : Via CLI Vercel

```bash
npm install -g vercel
vercel
```

## 🏗️ Structure du projet

```
homeflow-v2/
├── src/
│   ├── lib/
│   │   └── supabase.ts          # Client Supabase
│   ├── pages/
│   │   ├── Login.tsx            # Page de connexion
│   │   ├── SignUp.tsx           # Page d'inscription
│   │   └── Dashboard.tsx        # Dashboard principal
│   ├── store/
│   │   └── authStore.ts         # Store Zustand pour l'auth
│   ├── App.tsx                  # Composant principal
│   ├── main.tsx                 # Point d'entrée
│   └── index.css                # Styles globaux
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── vercel.json                  # Configuration Vercel
```

## ✅ Fonctionnalités actuelles

- ✅ Authentification par email/mot de passe
- ✅ Inscription de nouveaux utilisateurs
- ✅ Dashboard protégé
- ✅ Déconnexion
- ✅ Gestion d'état avec Zustand
- ✅ Routing avec React Router
- ✅ UI moderne avec Tailwind CSS
- ✅ Icons avec Lucide React
- ✅ Configuration TypeScript stricte

## 🎯 Prochaines étapes

1. Ajouter la gestion des foyers (households)
2. Ajouter la gestion des membres
3. Ajouter la gestion des tâches
4. Ajouter le système de points/gamification
5. Ajouter les notifications

## 🔧 Technologies utilisées

- **React 18** - UI Library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Supabase** - Backend as a Service
- **Zustand** - State management
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## 📝 Notes importantes

- Les variables d'environnement **doivent** être préfixées par `VITE_`
- Le fichier `vercel.json` est nécessaire pour le routing côté client
- Supabase gère automatiquement les sessions et tokens
