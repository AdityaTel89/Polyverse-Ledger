/*
  # Initial Schema for MythosNet Universal Registry Protocol

  1. New Tables
    - `blockchain`
      - Core table for registered blockchain networks
      - Includes UBID and BNS name system
    - `user`
      - Cross-chain user identities
      - Includes credit scoring and KYC status
    - `cross_chain_identity`
      - Maps user identities across different blockchains
    - `transaction`
      - Records all financial transactions
    - `cross_chain_transaction`
      - Tracks cross-chain transfers and swaps
    - `invoice`
      - Manages blockchain-verified invoices
      - Supports tokenization and escrow
    - `credit_score_history`
      - Tracks credit score changes over time
      - Stores scoring factors

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
    - Implement role-based access control
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Blockchain Networks
CREATE TABLE IF NOT EXISTS blockchain (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text UNIQUE NOT NULL,
  ubid text UNIQUE NOT NULL,
  bns_name text UNIQUE,
  api_key text UNIQUE NOT NULL,
  network_type text NOT NULL,
  chain_protocol text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS "user" (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  blockchain_id uuid REFERENCES blockchain(id),
  wallet_address text NOT NULL,
  credit_score integer DEFAULT 500,
  identity_hash text UNIQUE,
  kyc_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(blockchain_id, wallet_address)
);

-- Cross-Chain Identity Mapping
CREATE TABLE IF NOT EXISTS cross_chain_identity (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES "user"(id),
  blockchain_id uuid REFERENCES blockchain(id),
  wallet_address text NOT NULL,
  proof_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(blockchain_id, wallet_address)
);

-- Transactions
CREATE TABLE IF NOT EXISTS transaction (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES "user"(id),
  amount decimal NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  hash text NOT NULL,
  risk_score decimal,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Cross-Chain Transactions
CREATE TABLE IF NOT EXISTS cross_chain_transaction (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES "user"(id),
  source_blockchain_id uuid REFERENCES blockchain(id),
  destination_address text NOT NULL,
  amount decimal NOT NULL,
  asset_type text NOT NULL,
  status text NOT NULL,
  proof_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoice (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES "user"(id),
  blockchain_id uuid REFERENCES blockchain(id),
  amount decimal NOT NULL,
  currency text NOT NULL,
  due_date timestamptz NOT NULL,
  status text NOT NULL,
  ipfs_hash text,
  tokenized boolean DEFAULT false,
  token_address text,
  escrow_address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Credit Score History
CREATE TABLE IF NOT EXISTS credit_score_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES "user"(id),
  score integer NOT NULL,
  factors jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE blockchain ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_chain_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_chain_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_score_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public blockchains are viewable by everyone"
  ON blockchain FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own data"
  ON "user" FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view their own cross-chain identities"
  ON cross_chain_identity FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own transactions"
  ON transaction FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own cross-chain transactions"
  ON cross_chain_transaction FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own invoices"
  ON invoice FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own credit score history"
  ON credit_score_history FOR SELECT
  USING (auth.uid()::text = user_id::text);