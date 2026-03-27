# Deploying The AI Server To Firebase

This server should be deployed to Cloud Run, then exposed through Firebase Hosting using the rewrite already added in `firebase.json`.

## 1. Prerequisites

- Firebase project on the Blaze plan
- `gcloud` CLI installed and authenticated
- Firebase CLI installed and authenticated
- Billing enabled on the Google Cloud project behind your Firebase project

## 2. Select your project

```bash
gcloud auth login
gcloud config set project YOUR_FIREBASE_PROJECT_ID
firebase use YOUR_FIREBASE_PROJECT_ID
```

## 3. Enable the required Google Cloud APIs

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

## 4. Create or update the OpenAI secret

First time:

```bash
printf '%s' 'YOUR_OPENAI_API_KEY' | gcloud secrets create OPENAI_API_KEY --data-file=-
```

If the secret already exists:

```bash
printf '%s' 'YOUR_OPENAI_API_KEY' | gcloud secrets versions add OPENAI_API_KEY --data-file=-
```

## 5. Deploy the Cloud Run service

From the repo root:

```bash
npm run deploy:server
```

Then attach the OpenAI secret to the deployed service:

```bash
gcloud run services update my-money-ai-server --region asia-south1 --set-secrets OPENAI_API_KEY=OPENAI_API_KEY:latest
```

Notes:

- The server already reads `PORT` from Cloud Run automatically.
- In Cloud Run, Firebase Admin SDK will use Application Default Credentials, so you do not need `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH` there.
- The endpoint is left publicly reachable because Firebase Hosting rewrites require the Cloud Run service to allow unauthenticated invocation. The route still verifies Firebase ID tokens before it does any work.

## 6. Deploy Firebase Hosting

```bash
npm run deploy:hosting
```

That publishes the Vite app and forwards `/api/ai/**` to the Cloud Run service `my-money-ai-server` in `asia-south1`.

## 7. Optional checks

Check the Cloud Run service URL directly:

```bash
gcloud run services describe my-money-ai-server --region asia-south1 --format='value(status.url)'
```

Check logs:

```bash
gcloud run services logs read my-money-ai-server --region asia-south1 --limit=100
```
