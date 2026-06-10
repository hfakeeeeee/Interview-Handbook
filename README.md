# Interview Handbook

Website tong hop cau hoi phong van, toi uu de deploy bang GitHub Pages va dung
Firebase Firestore o free tier.

## Tinh nang

- Tao category rieng, sau do them question/answer vao category do.
- Chon category de load va tim kiem cac cau hoi thuoc category.
- Tim kiem full text theo question va answer.
- Xem cau hoi va cau tra loi trong panel rieng de on tap nhanh.
- Danh dau favorite bang localStorage.
- Them cau hoi moi. Khi chua cau hinh Firebase, du lieu se luu local trong trinh duyet.
- Khi da cau hinh Firebase, app doc/ghi collection `questions` tren Firestore.
- GitHub Actions workflow da san sang deploy len GitHub Pages.

## Chay local

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
```

## Cau hinh Firebase

1. Tao Firebase project.
2. Tao Web App trong Firebase Console.
3. Bat Firestore Database.
4. Copy `.env.example` thanh `.env.local`.
5. Dien cac bien `VITE_FIREBASE_*` tu Firebase web config.

Vi du:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

App se doc 2 collection:

```text
categories
questions
```

Document trong `categories`:

```json
{
  "name": "Frontend",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

Document trong `questions`:

```json
{
  "categoryId": "<category document id>",
  "question": "Hay giai thich event loop...",
  "answer": "Node.js chay JavaScript tren main thread...",
  "createdAt": "server timestamp",
  "updatedAt": "server timestamp"
}
```

File `firestore.rules` trong repo co rule mau: cho public read va chi cho create
voi schema hop le. Neu website cua ban can quyen admin/editor that su, nen them
Firebase Authentication va sua rule theo user role.

## Deploy GitHub Pages

1. Push code len branch `main`.
2. Vao GitHub repository settings.
3. Pages -> Build and deployment -> Source: `GitHub Actions`.
4. Them repository secrets:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Workflow `.github/workflows/deploy.yml` se build app va deploy folder `dist`.
Vite config tu dong dung base path `/<ten-repo>/`, nen repo nay se phu hop voi
GitHub Pages URL dang:

```text
https://<username>.github.io/Interview-Handbook/
```
