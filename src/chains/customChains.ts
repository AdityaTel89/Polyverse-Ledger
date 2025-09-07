import { mainnet, polygon, optimism, arbitrum } from "wagmi/chains";

export const holesky = {
  id: 17000,
  name: "Holesky",
  network: "holesky",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://holesky.drpc.org"] },
  },
  blockExplorers: {
    default: { name: "Holesky Explorer", url: "https://holesky.etherscan.io" },
  },
  testnet: true,
};
export const SKALE = {
  id: 1564830818,
  name: "SKALE Calypso Mainnet",
  network: "SKALE Calypso Mainnet",
  nativeCurrency: {
    name: "SKALE Calypso Mainnet",
    symbol: "sFUEL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://mainnet.skalenodes.com/v1/honorable-steel-rasalhague"],
    },
  },
  blockExplorers: {
    default: {
      name: "SKALE Calypso Mainnet",
      url: "https://honorable-steel-rasalhague.explorer.mainnet.skalenodes.com",
    },
  },
  testnet: false,
};


export const bsc = {
  id: 56,
  name: "BNB Smart Chain",
  network: "bsc",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://bsc-dataseed.binance.org/"] },
  },
  blockExplorers: {
    default: { name: "BscScan", url: "https://bscscan.com" },
  },
};

export const base = {
  id: 8453,
  name: "Base",
  network: "base",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://mainnet.base.org"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://basescan.org" },
  },
};

export const sepolia = {
  id: 11155111,
  name: "Sepolia",
  network: "sepolia",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.sepolia.org"] },
    public: { http: ["https://rpc.sepolia.org"] },
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://sepolia.etherscan.io" },
  },
  testnet: true,
};

export const supportedChains = [mainnet, polygon, optimism, arbitrum, holesky, bsc, base, sepolia, SKALE] as const;
