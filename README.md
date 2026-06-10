# Interview Handbook

A GitHub Pages-friendly website for organizing interview questions by category,
with Firebase Firestore as the database.

## Features

- Create categories, then add question/answer entries into each category.
- Edit and delete empty categories.
- Browse and search questions by category.
- Search full text across question and answer content.
- View questions and answers in a focused reading panel.
- Answers support Markdown, including comparison tables.
- Edit a question's category, question text, and answer text.
- Delete questions with confirmation.
- Mark questions as favorites in localStorage.
- Use localStorage fallback when Firebase is not configured.
- Deploy to GitHub Pages through GitHub Actions.

## Local Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Firebase Setup

1. Create a Firebase project.
2. Create a Web App in Firebase Console.
3. Enable Firestore Database.
4. Copy `.env.example` to `.env.local`.
5. Fill the `VITE_FIREBASE_*` variables from your Firebase web config.

Example:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

The app reads two collections:

```text
categories
questions
```

Document in `categories`:

```json
{
  "name": "Frontend",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

Document in `questions`:

```json
{
  "categoryId": "<category document id>",
  "question": "Explain the Java event loop...",
  "answer": "JavaScript runs on a main thread...",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

The `firestore.rules` file contains starter rules for public read and basic
schema validation. If this becomes a real multi-user app, add Firebase
Authentication and role-based rules.

## GitHub Pages Deploy

1. Push code to the `main` branch.
2. Open GitHub repository settings.
3. Go to Pages -> Build and deployment -> Source: `GitHub Actions`.
4. Add repository secrets:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

The workflow `.github/workflows/deploy.yml` builds the app and deploys `dist`.
The Vite config automatically uses the repository name as the GitHub Pages base
path, so this repository works with a URL like:

```text
https://<username>.github.io/Interview-Handbook/
```
