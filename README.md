# CodeSenseiAI 🤖

An AI-powered GitHub App that automatically reviews pull requests using Google Gemini 2.5 Flash. When a developer opens a PR, CodeSenseiAI fetches the code diff, maps exact line positions, analyzes the code for bugs, security vulnerabilities, and bad practices, then posts inline review comments directly on the affected lines — just like a senior engineer would.

---

## 🔗 Live Demo

**Frontend:** https://codesenseiai-gold.vercel.app

**Backend API:** https://codesenseiai.onrender.com

---

## Demo

> Open a pull request → CodeSenseiAI reviews it automatically with inline comments

![CodeSenseiAI posting inline review comments]![alt text](image.png)

---

## Features

- **Automatic PR reviews** — triggers instantly when a pull request is opened
- **Exact inline comments** — posts feedback on the precise diff positions using a custom diff parser
- **Current implementation display** — shows the problematic code block alongside the fix so developers never need to leave the review
- **Severity levels** — 🔴 Critical, 🟠 Major, 🟡 Minor, 🔵 Style with real-world impact explanations
- **Suggested fixes** — clean code suggestions for every issue found
- **PR summary comment** — overall review summary posted at the top of every PR
- **Individual comment retry** — if batch posting fails, retries each comment individually so one bad position never kills the whole review
- **Graceful fallback** — unresolvable positions post as a summary body comment instead of failing silently
- **Gemini 1.5 Flash fallback** — switches to a stable model automatically if Gemini 2.5 Flash is overloaded
- **Exponential backoff** — retries on 503 errors with 1s → 2s → 4s delays
- **Async processing** — responds 200 to GitHub immediately, processes review in background to avoid webhook timeouts
- **Diff filtering** — skips lockfiles, minified files, and binary assets before sending to Gemini
- **HMAC-SHA256 verification** — validates every webhook signature so only GitHub can trigger reviews

---

## How It Works

```
Developer opens PR
       ↓
GitHub fires pull_request.opened webhook
       ↓
CodeSenseiAI responds 200 immediately (async processing begins)
       ↓
Verifies HMAC-SHA256 signature
       ↓
Fetches PR files via GitHub API (Octokit)
       ↓
Builds exact line → diff position map (custom diffParser)
       ↓
Sends numbered diff to Gemini 2.5 Flash with structured prompt
       ↓
Parses JSON response [{file, start_line, end_line, severity, comment, suggestion}]
       ↓
Maps line numbers to exact diff positions
       ↓
Posts inline review comments with current implementation + suggested fix
       ↓
Posts PR summary comment with severity breakdown
```

---

## What CodeSenseiAI Catches

| Category | Examples |
|---|---|
| 🔴 Security | Hardcoded secrets, SQL injection, `eval()` misuse, password logging, exposed API keys |
| 🟠 Bugs | Missing error handling, unhandled promise rejections, type mismatches |
| 🟡 Performance | Inefficient queries, unnecessary re-renders, blocking operations |
| 🔵 Style | Naming conventions, POSIX standards, readability issues |

---

## Comment Format

Every review comment follows this structure:

```
🔴 Critical — Security: Hardcoded Credentials in Source

Hardcoding API keys directly in source code exposes credentials to anyone
with repository access. In production this means immediate full access to
your database and third-party services.

Current implementation (lines 4–5):
\`\`\`js
const API_KEY = "sk-abc123xyz789";
const DB_PASSWORD = "admin123";
\`\`\`

Suggested fix:
\`\`\`js
const API_KEY = process.env.API_KEY;
const DB_PASSWORD = process.env.DB_PASSWORD;
\`\`\`

🤖 CodeSenseiAI · Powered by Gemini 2.5 Flash
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express.js |
| GitHub Integration | @octokit/auth-app, @octokit/rest |
| AI Model | Google Gemini 2.5 Flash (fallback: 1.5 Flash) |
| Logging | Pino |
| Testing | Jest |
| Deployment | Render |
| CI/CD | GitHub Actions |

---

## Project Structure

```
codesensei/
├── src/
│   ├── app.js                        # Express server entry point
│   ├── webhook/
│   │   ├── router.js                 # POST /webhook — responds 200 immediately, processes async
│   │   ├── verify.js                 # HMAC-SHA256 signature verification
│   │   └── handlers/
│   │       ├── pullRequest.js        # Main handler — orchestrates all layers
│   │       └── index.js              # Handler exports
│   ├── github/
│   │   ├── auth.js                   # GitHub App JWT + installation token generation
│   │   ├── diff.js                   # Fetches PR file diffs via GitHub API
│   │   ├── diffParser.js             # Builds exact line→position maps + structured diff
│   │   └── review.js                 # Posts inline comments with retry + fallback logic
│   ├── llm/
│   │   ├── prompts.js                # Structured system prompt for Gemini
│   │   ├── analyze.js                # Sends diff to Gemini, handles backoff + fallback model
│   │   └── parse.js                  # Parses and validates LLM JSON output
│   └── utils/
│       ├── logger.js                 # Structured logging with Pino
│       └── errors.js                 # Custom error classes + Express error handler
├── tests/
│   ├── webhook.test.js               # Signature verification tests
│   ├── llm.test.js                   # Parse and analyze unit tests
│   └── fixtures/
│       └── pr_payload.json           # Sample GitHub webhook payload for tests
├── .github/
│   └── workflows/
│       └── deploy.yml                # CI/CD — run tests then deploy to Render
├── .env.example                      # Environment variable template
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A GitHub account
- A Google AI Studio account (free tier available at aistudio.google.com)
- A Render account for deployment

### 1. Clone the repository

```bash
git clone https://github.com/MaheshRaghava/CodeSenseiAI.git
cd codesensei
npm install
```

### 2. Create a GitHub App

Go to **GitHub → Settings → Developer Settings → GitHub Apps → New GitHub App**:

| Field | Value |
|---|---|
| Homepage URL | `http://localhost:3000` |
| Webhook URL | Your smee.io URL for local dev, or Render URL for production |
| Webhook Secret | A strong secret string |
| Repository permissions — Pull requests | Read & Write |
| Subscribe to events | Pull request |

After creating:
- Note your **App ID** from the General tab
- Generate and download a **Private Key** (.pem file)
- Install the app on your target repository

### 3. Set up environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
```

**Formatting the private key on Windows (PowerShell):**

```powershell
$key = (Get-Content "private-key.pem" -Raw) -replace "`r`n", "\n" -replace "`n", "\n"
Add-Content .env "GITHUB_PRIVATE_KEY=$key"
```

**Getting your Gemini API key:**
Go to https://aistudio.google.com/app/apikey → Create API Key. Free tier works.

### 4. Run locally with smee

Terminal 1 — start the server:
```bash
npm run dev
```

Terminal 2 — forward webhooks to localhost:
```bash
npm install -g smee-client
smee --url https://smee.io/your-channel --target http://localhost:3000/webhook
```

### 5. Test it

Open a pull request on the repo where the app is installed. Within seconds CodeSenseiAI will post inline review comments on the PR with severity labels, current implementation context, and suggested fixes.

---

## Running Tests

```bash
npm test
```

Tests cover:
- HMAC-SHA256 signature verification (valid, invalid, tampered payloads)
- LLM response parsing (clean JSON, markdown fences, empty array, broken response)
- Field validation (missing file, line, or comment fields filtered correctly)

---

## Deployment (Render)

### 1. Create a Web Service on Render

```
Render Dashboard → New → Web Service → Connect GitHub repo
```

| Setting | Value |
|---|---|
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |

Add all `.env` variables under the **Environment** tab.

### 2. Add GitHub Secrets for CI/CD

```
GitHub repo → Settings → Secrets and variables → Actions
```

| Secret | Where to find it |
|---|---|
| `RENDER_API_KEY` | Render → Account Settings → API Keys |
| `RENDER_SERVICE_ID` | Render → Your Service → Settings → Service ID |

Every push to `main` runs tests first, then deploys to Render if they pass.

### 3. Update your GitHub App Webhook URL

Replace the smee URL with your live Render URL:
```
https://your-service.onrender.com/webhook
```

---

## Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| `GITHUB_APP_ID` | GitHub App numeric ID | ✅ |
| `GITHUB_PRIVATE_KEY` | RSA private key with `\n` line breaks | ✅ |
| `GITHUB_WEBHOOK_SECRET` | Secret set when creating the GitHub App | ✅ |
| `GEMINI_API_KEY` | Google AI Studio API key | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |
| `LOG_LEVEL` | Pino log level: info, debug, warn (default: info) | ❌ |

---

## Architecture Decisions

**Why async webhook processing?**
GitHub has a 10-second webhook timeout. Gemini responses can take 10–30 seconds. Responding 200 immediately and processing in the background ensures GitHub never marks deliveries as failed.

**Why a custom diff parser instead of trusting Gemini for line numbers?**
Gemini estimates line numbers from diff text — it doesn't parse them deterministically. The custom diffParser builds an exact map of file line number → GitHub diff position, which is what the review API requires. This is the same approach used by production tools like CodeRabbit.

**Why show current implementation in comments?**
Developers reviewing a PR shouldn't need to switch to their editor to understand the context of a comment. Showing the problematic lines alongside the fix makes reviews self-contained and faster to act on.

**Why individual comment retry?**
A single bad position in a batch `createReview` call causes all comments to fail. Retrying individually means one unresolvable position (like a file-end marker) never blocks the other 6 comments from posting inline.

**Why Gemini 2.5 Flash over GPT-4?**
Free tier available with no billing setup required — making this accessible for students and open source contributors without upfront cost.

---

## Why Build This When GitHub Copilot Exists?

Copilot helps you **write** code. CodeSenseiAI reviews code **after it's written**.

More importantly, CodeSenseiAI is programmable infrastructure — you control the prompt, the rules, and the logic:

- **Custom review rules** — enforce your team's specific standards, not generic advice
- **Security-focused teams** — tune the prompt to flag every hardcoded secret or insecure auth pattern
- **Junior developer onboarding** — adjust tone to explain issues educationally rather than just flagging them
- **Regulated environments** — keep review data within your own infrastructure, no third-party data sharing

---

## Author

**Mahesh Raghava**
- GitHub: [@MaheshRaghava](https://github.com/MaheshRaghava)
- LinkedIn: [linkedin.com/in/mahesh-raghava](https://linkedin.com/in/mahesh-raghava)
- Email: maheshraghavak@gmail.com

---

## License

MIT License — feel free to fork, extend, and build on top of this.