## Local development (AI Assistant included)

The Assistant chat uses a Netlify Function (`/.netlify/functions/assistant`), so you **must** run the site using Netlify Dev locally.

### 1) Install dependencies

```bash
npm install
```

### 2) Set your API key (local)

Create a `.env` file in the repo root:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

### 3) Run locally (static site + functions)

```bash
npm run dev
```

Open `http://localhost:8766`.

### Notes

- Do **not** commit `.env`.
- If `netlify dev` fails with “too many open files (EMFILE)”, this repo already runs it with polling (see `package.json`).
- On Netlify, set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) in **Site settings → Environment variables**.

