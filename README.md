# EduAI

> **Apprendre autrement, progresser intelligemment.**

EduAI est une plateforme intelligente d’apprentissage en ligne (**E-Learning**) intégrant des fonctionnalités basées sur l’**Intelligence Artificielle** afin de proposer une expérience d’apprentissage moderne, personnalisée et accessible.

Le projet est conçu selon une architecture **Web + Mobile + API Backend**, avec une approche **Multi-Tenant**, permettant à plusieurs entreprises ou organisations d’utiliser la plateforme tout en garantissant l’isolation de leurs données.

---

## 📌 Présentation

EduAI a pour objectif de centraliser et moderniser la gestion de la formation en ligne.

La plateforme permettra notamment de gérer :

* les apprenants ;
* les formateurs ;
* les entreprises et organisations ;
* les formations ;
* les modules et leçons ;
* les vidéos et ressources pédagogiques ;
* les inscriptions ;
* la progression des apprenants ;
* les quiz et évaluations ;
* les résultats ;
* les certificats ;
* les notifications ;
* les abonnements ;
* les statistiques ;
* les fonctionnalités d’Intelligence Artificielle.

---

## 🎯 Objectifs

Les principaux objectifs d’EduAI sont de :

* faciliter l’accès à la formation en ligne ;
* améliorer le suivi pédagogique des apprenants ;
* permettre aux formateurs de gérer leurs contenus ;
* proposer une expérience personnalisée grâce à l’IA ;
* automatiser certaines tâches pédagogiques ;
* fournir des outils de suivi et d’analyse ;
* garantir la sécurité et l’isolation des données ;
* proposer une plateforme multilingue et responsive.

---

## 🏗️ Architecture

EduAI est organisé autour de trois applications principales :

```text
                    ┌─────────────────────┐
                    │       EduAI         │
                    │   Plateforme SaaS   │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
      ┌────────────┐    ┌────────────┐    ┌────────────┐
      │    Web     │    │   Mobile   │    │  Backend   │
      │   React    │    │  Flutter   │    │ Node/Express│
      └────────────┘    └────────────┘    └──────┬─────┘
                                                  │
                         ┌────────────────────────┼──────────────────┐
                         │                        │                  │
                         ▼                        ▼                  ▼
                  ┌────────────┐          ┌────────────┐     ┌────────────┐
                  │ PostgreSQL │          │  Service   │     │   Auth &   │
                  │  + Prisma  │          │     IA     │     │ Multi-Tenant│
                  └────────────┘          └────────────┘     └────────────┘
```

Le Web et le Mobile communiquent avec le Backend à travers une **API REST**.

Le Backend constitue la couche centrale responsable de :

* l’authentification ;
* l’autorisation ;
* la validation des données ;
* la logique métier ;
* l’accès à la base de données ;
* la gestion Multi-Tenant ;
* la sécurité ;
* l’intégration avec les services d’IA.

---

## 🧑‍💻 Technologies

### Backend

* **Node.js**
* **Express.js**
* **TypeScript**
* **Prisma ORM**
* **PostgreSQL**
* **REST API**
* **JWT**
* **Refresh Token**
* **Argon2id**
* **Zod**

### Application Web

* **React**
* **TypeScript**

### Application Mobile

* **Flutter**
* **Dart**

### Intelligence Artificielle

L’IA sera intégrée au Backend à travers un service dédié permettant notamment d’exploiter des modèles de langage externes.

Les fonctionnalités envisagées comprennent :

* assistant pédagogique ;
* questions/réponses ;
* explications personnalisées ;
* recommandations de formations ;
* analyse des performances ;
* détection des difficultés ;
* parcours personnalisés ;
* assistance à la génération de quiz ;
* résumé et reformulation de contenus ;
* assistance aux formateurs.

### Outils

* Git
* GitHub
* Visual Studio Code
* Postman
* Swagger / OpenAPI
* UML
* Mermaid / draw.io
* Figma selon les besoins de conception

---

## 👥 Gestion des utilisateurs

EduAI adopte une architecture basée sur les rôles et permissions.

### SUPER_ADMIN

Administrateur global de la plateforme.

Il peut notamment gérer :

* les tenants ;
* les utilisateurs ;
* les configurations globales ;
* la supervision de la plateforme ;
* les paramètres de sécurité.

### TENANT_ADMIN

Administrateur d’une entreprise ou organisation utilisant EduAI.

Il gère les ressources de son propre Tenant.

### FORMATEUR

Le formateur peut notamment :

* créer des formations ;
* gérer les modules ;
* créer les leçons ;
* ajouter des ressources ;
* créer des évaluations ;
* suivre les apprenants ;
* consulter les statistiques.

### APPRENANT

L’apprenant peut notamment :

* consulter le catalogue ;
* s’inscrire aux formations ;
* suivre les cours ;
* regarder les vidéos ;
* consulter les ressources ;
* réaliser les quiz ;
* suivre sa progression ;
* utiliser l’assistant IA ;
* consulter ses certificats.

---

## 🌐 Multi-Tenant

EduAI est conçu comme une plateforme **SaaS Multi-Tenant**.

Chaque entreprise ou organisation constitue un **Tenant**.

L’isolation des données est assurée côté Backend et ne repose pas uniquement sur l’interface utilisateur.

Une requête concernant une ressource doit prendre en compte :

```text
Identité utilisateur
        ↓
Rôle
        ↓
Permission
        ↓
Tenant
        ↓
Ressource
```

Un utilisateur d’un Tenant ne doit jamais pouvoir accéder aux ressources appartenant à un autre Tenant.

---

## 🔐 Sécurité

La sécurité constitue une composante fondamentale de l’architecture EduAI.

Les principes prévus comprennent notamment :

* authentification JWT ;
* Refresh Tokens ;
* hachage des mots de passe avec Argon2id ;
* contrôle d’accès basé sur les rôles et permissions ;
* isolation stricte des Tenants ;
* validation des données ;
* protection des API ;
* limitation des requêtes ;
* gestion centralisée des erreurs ;
* sécurisation CORS ;
* Helmet ;
* gestion sécurisée des secrets ;
* HTTPS en production ;
* journalisation et audit.

Pour les données nécessitant un chiffrement réversible, l’architecture prévoit l’utilisation d’un chiffrement **AES-256-GCM** associé à une gestion sécurisée des clés.

Les clés cryptographiques ne doivent pas être stockées en clair dans le code source ou dans Git.

---

## ✉️ Vérification des comptes

Lors de l'inscription, l'utilisateur devra vérifier son adresse e-mail grâce à un **OTP à usage unique**.

Le système devra notamment gérer :

* génération sécurisée de l’OTP ;
* durée de validité limitée ;
* invalidation après utilisation ;
* nombre d’essais limité ;
* renvoi contrôlé du code ;
* protection contre les abus ;
* stockage sécurisé ;
* absence de l’OTP dans les logs.

---

## 🆓 Période d'essai

EduAI prévoit une période d'essai basée sur le nombre de connexions à la plateforme.

La période d'essai correspond à :

**30 connexions/visites de la plateforme.**

Le compteur sera conservé côté Backend.

L'utilisateur pourra consulter le nombre de visites restantes.

À l'expiration :

* l'accès opérationnel sera bloqué ;
* les données seront conservées ;
* les données pourront être exportées ;
* une souscription pourra réactiver le compte ;
* les données existantes seront conservées après réactivation.

---

## 🌍 Multilingue

EduAI est conçu pour prendre en charge plusieurs langues.

Les langues prévues sont :

* 🇫🇷 Français
* 🇬🇧 English
* 🇸🇦 العربية

La sélection de la langue devra être directement accessible depuis l'interface.

---

## 🎨 Design & Expérience utilisateur

La plateforme doit proposer un **Design System cohérent** entre les différentes interfaces.

Les thèmes prévus sont :

* Light ;
* Dark ;
* Professional / Modern.

L'interface devra être responsive avec notamment les breakpoints suivants :

| Format       |       Largeur |
| ------------ | ------------: |
| Mobile       |      ≤ 480 px |
| Tablet       |  481 – 768 px |
| Desktop      | 769 – 1024 px |
| Wide Desktop |     ≥ 1280 px |

Les composants devront pouvoir se réorganiser automatiquement selon la taille de l'écran.

---

## 📱 Application Mobile

L'application mobile sera principalement orientée vers l'expérience de l'apprenant.

Elle pourra notamment proposer :

* onboarding ;
* inscription et connexion ;
* catalogue ;
* recherche ;
* formations ;
* vidéos ;
* ressources ;
* quiz ;
* résultats ;
* progression ;
* recommandations IA ;
* assistant IA ;
* certificats ;
* notifications ;
* profil et paramètres.

---

## 💻 Application Web

L'application Web couvrira notamment :

### Espace public

* Landing page ;
* présentation de la plateforme ;
* fonctionnalités ;
* avantages ;
* catalogue ;
* démonstrations vidéo ;
* changement de langue ;
* changement de thème.

### Espace apprenant

* tableau de bord ;
* formations ;
* progression ;
* quiz ;
* résultats ;
* certificats ;
* recommandations ;
* assistant IA ;
* notifications.

### Espace formateur

* tableau de bord ;
* création de formations ;
* gestion des modules ;
* gestion des leçons ;
* ressources ;
* quiz ;
* suivi des apprenants ;
* statistiques ;
* assistance IA.

### Administration

* utilisateurs ;
* Tenants ;
* formateurs ;
* apprenants ;
* formations ;
* catégories ;
* inscriptions ;
* certificats ;
* abonnements ;
* paiements ;
* notifications ;
* statistiques ;
* journaux d'audit ;
* paramètres.

---

## 🤖 Intelligence Artificielle

L'IA constitue l'un des éléments différenciateurs du projet.

Elle devra être intégrée progressivement afin de fournir une assistance pédagogique utile et contrôlée.

Les contenus générés automatiquement devront pouvoir être vérifiés et validés par un formateur avant leur publication lorsqu'ils sont destinés à être intégrés aux contenus pédagogiques officiels.

---

## 📁 Structure du projet

```text
EduAI/
│
├── backend/       # API REST et logique métier
├── web/           # Application Web React
├── mobile/        # Application Mobile Flutter
├── docs/          # Documentation et rapports
├── assets/        # Ressources graphiques
│
├── .gitignore
└── README.md
```

---

## 🚧 État du projet

Le projet est actuellement en phase de **mise en place technique et de développement**.

Les différentes fonctionnalités seront développées progressivement conformément au cahier des charges et aux décisions d'architecture du projet.

Les fonctionnalités présentées dans ce document qui ne sont pas encore implémentées représentent les **objectifs prévus du projet**.

---

## 📚 Documentation

La documentation du projet sera progressivement organisée dans le dossier :

```text
docs/
```

Elle pourra notamment contenir :

* cahier des charges ;
* rapports journaliers ;
* diagrammes UML ;
* architecture ;
* documentation API ;
* décisions techniques ;
* documentation de déploiement.

---

## 👨‍💻 Projet

**Nom :** EduAI
**Type :** Plateforme E-Learning intelligente
**Architecture :** Web + Mobile + Backend API
**Approche :** SaaS Multi-Tenant
**Langues :** Français / English / العربية

> **EduAI — Apprendre autrement, progresser intelligemment.**
