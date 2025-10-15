
# 🌐 The Polyverse Ledger

> A decentralized full-stack ledger system integrating blockchain smart contracts, Supabase database, IPFS storage, and a React-based dashboard.  
> Built with **Fastify**, **Prisma**, **Supabase**, **IPFS**, and **Smart Contracts (Hardhat)** for transparent and verifiable financial and identity records.

---

## 🧩 Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Frontend** | React.js, TypeScript, Tailwind CSS, Vite |
| **Backend** | Fastify, Prisma ORM, Node.js |
| **Blockchain** | Solidity, Hardhat, Ethers.js |
| **Database** | Supabase (PostgreSQL) |
| **Storage** | IPFS |
| **Deployment** | Docker, Google Cloud Run / Cloud Build |
| **Version Control** | Git & GitHub |

---

## 🏗️ Project Architecture

```

frontend (React + Vite)
↳ communicates with Fastify backend
backend (Fastify + Prisma + Supabase)
↳ stores invoice & user data
blockchain (Hardhat + Solidity)
↳ handles smart contract logic (InvoiceManager, Identity)
storage (IPFS)
↳ stores metadata and documents off-chain
database (Supabase)
↳ persistent storage synced with blockchain events

````

---

## ⚙️ Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/The-Polyverse-Ledger.git
cd The-Polyverse-Ledger
````

### 2. Install Dependencies

Install all dependencies (frontend + backend + blockchain):

```bash
npm install
```

If the project has subfolders for backend or frontend:

```bash
cd src
npm install
cd ..
```

---

## 🧾 Environment Configuration

Duplicate `.env.example` to create your own `.env`:

```bash
cp .env.example .env
```

### Example `.env` file

```bash
# Supabase
SUPABASE_URL=https://xyzcompany.supabase.co
SUPABASE_KEY=your-supabase-service-key

# Prisma
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/polyverse_db

# IPFS
IPFS_API_URL=https://ipfs.infura.io:5001
IPFS_PROJECT_ID=your_project_id
IPFS_PROJECT_SECRET=your_project_secret

# Blockchain
PRIVATE_KEY=your_wallet_private_key
ALCHEMY_API_KEY=your_alchemy_key
CHAIN_ID=11155111 # (example: Sepolia)

# Server
PORT=8080
NODE_ENV=development
```

---

## 💾 Database Setup (Supabase + Prisma)

### 1. Connect Prisma to Supabase

Edit `prisma/schema.prisma` and verify your `DATABASE_URL`.

### 2. Run Migrations

```bash
npx prisma migrate dev --name init
```

### 3. View Database Studio

```bash
npx prisma studio
```

---

## 🔗 Blockchain Setup (Hardhat)

### 1. Compile Contracts

```bash
npx hardhat compile
```

### 2. Run Local Blockchain

```bash
npx hardhat node
```

### 3. Deploy Smart Contracts

```bash
npx hardhat run blockchain/scripts/deploy.js --network localhost
```

### 4. Verify Contract

```bash
npx hardhat verify --network sepolia <DEPLOYED_CONTRACT_ADDRESS>
```

---

## 🧠 Backend (Fastify + Prisma)

### 1. Start Backend Server

```bash
npm run dev
```

### 2. Test API Endpoints

Once running, test:

```
GET  http://localhost:8080/api/users
POST http://localhost:8080/api/invoices
```

Backend handles:

* Invoice creation after on-chain transaction confirmation
* User registration and syncing with blockchain
* IPFS metadata upload and retrieval

---

## 💻 Frontend (React + Vite)

### 1. Start Frontend

```bash
npm run dev:frontend
```

### 2. Access UI

Open [http://localhost:5173](http://localhost:5173) in your browser.

Frontend features:

* Dashboard for invoices and users
* Connect Wallet (MetaMask via RainbowKit)
* On-chain/off-chain sync
* Real-time invoice updates

---

## ☁️ Docker Setup (Optional)

### 1. Build Docker Image

```bash
docker build -t polyverse-ledger .
```

### 2. Run Container

```bash
docker run -p 8080:8080 polyverse-ledger
```

---

## 🚀 Deployment (Google Cloud Run)

1. Configure your `cloudbuild.yaml` and `service.yaml` (already included).
2. Deploy using:

```bash
gcloud builds submit --config cloudbuild.yaml .
```

3. Deploy to Cloud Run:

```bash
gcloud run deploy polyverse-ledger --source . --platform managed
```

---

## 🧩 Useful Commands

| Task                 | Command                             |
| -------------------- | ----------------------------------- |
| Install Dependencies | `npm install`                       |
| Run Hardhat Node     | `npx hardhat node`                  |
| Deploy Contracts     | `npx hardhat run scripts/deploy.js` |
| Start Backend        | `npm run dev`                       |
| Start Frontend       | `npm run dev`                       |
| Prisma Migrate       | `npx prisma migrate dev`            |
| Prisma Studio        | `npx prisma studio`                 |
| Run Tests            | `npm test`                          |

---

## 🧰 Folder Structure

```
The-Polyverse-Ledger/
│
├── contracts/           # Solidity smart contracts
├── src/                 # React frontend + Fastify backend
├── prisma/              # Prisma schema and migrations
├── supabase/            # Supabase configuration
├── artifacts/           # Compiled contract ABIs
├── ignition/            # Hardhat Ignition deployment modules
├── dist-frontend/       # Production frontend build
├── .env.example         # Sample environment variables
├── Dockerfile           # Docker build configuration
├── cloudbuild.yaml      # Google Cloud Build configuration
└── README.md            # Project documentation
```

---

## 🧠 Troubleshooting

| Issue                     | Solution                                     |
| ------------------------- | -------------------------------------------- |
| `Internal JSON-RPC error` | Check contract address and network ID        |
| Database not updating     | Ensure Prisma URL points to Supabase         |
| IPFS upload failing       | Verify Infura credentials and network access |
| MetaMask connection error | Confirm wallet is on same chain as contract  |
| Prisma client error       | Run `npx prisma generate` again              |

---

## 👨‍💻 Author

**Aditya Telsinge**

* 💼 [LinkedIn](https://linkedin.com/in/aditya-telsinge)
* 💻 [GitHub](https://github.com/AdityaTel89)
* ✉️ [adityatelsinge@gmail.com](mailto:adityatelsinge@gmail.com)

---

## 🪐 License

This project is licensed under the **MIT License**.
See `LICENSE` for details.

---

### ⭐ If you found this project helpful, give it a star on GitHub!

```

