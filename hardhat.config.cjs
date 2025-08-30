require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;

if (!PRIVATE_KEY) {
  throw new Error("❌ Missing PRIVATE_KEY in .env");
}

module.exports = {
  solidity: "0.8.19",
  paths: {
    sources: "./blockchain/contracts",
    artifacts: "./artifacts",
    cache: "./cache",
    tests: "./test",
  },
  networks: {
     
  // SKALE Calypso Hub (Free for DeFi)
  skaleCalypso: {
    url: "https://mainnet.skalenodes.com/v1/honorable-steel-rasalhague", 
    accounts: [PRIVATE_KEY],
    gasPrice: 1000000000,
    gas: 8000000,
    chainId: 1564830818,
  },
  skaleCalypsoTest: {
      url: "https://testnet.skalenodes.com/v1/giant-half-dual-testnet",
      accounts: [PRIVATE_KEY],
      gas: 8000000,
      gasPrice: 1000000000, // SKALE testnet uses free gas
      chainId: 974399131 // Calypso Testnet Chain ID
    },
    // Ethereum Mainnet
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [PRIVATE_KEY],
      gasPrice: 413000000, // 0.413 gwei (current average)
      gas: 2100000,
      chainId: 1,
    },
    
    // Ethereum Sepolia Testnet  
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [PRIVATE_KEY],
      gasPrice: 1000000000, // 1 gwei
      gas: 2100000,
      chainId: 11155111,
    },
    
    // Polygon Mainnet
    polygon: {
      url: "https://polygon-rpc.com/",
      accounts: [PRIVATE_KEY],
      gasPrice: 28600000000, // 28.6 gwei (current average)
      gas: 2100000,
      chainId: 137,
    },
    
    // Arbitrum One
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      accounts: [PRIVATE_KEY],
      gasPrice: 100000000, // 0.1 gwei (L2 benefits)
      gas: 2100000,
      chainId: 42161,
    },
    
    // Optimism
    optimism: {
      url: "https://mainnet.optimism.io",
      accounts: [PRIVATE_KEY],
      gasPrice: 8000000000, // 8 gwei (current fast price)
      gas: 2100000,
      chainId: 10,
    },
    
    // SKALE Europa Hub
    skale: {
      url: "https://mainnet.skalenodes.com/v1/elated-tan-skat",
      accounts: [PRIVATE_KEY],
      gasPrice: 1000000000, // Free gas on SKALE
      gas:  8000000,
      chainId: 2046399126,
    },
    
    // Holesky Testnet (your existing network)
    holesky: {
      url: "https://holesky.drpc.org",
      accounts: [PRIVATE_KEY],
      gasPrice: 1000000000, // 1 gwei
      chainId: 17000,
    },
  },
  
  // Contract verification settings
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      optimisticEthereum: process.env.OPTIMISM_API_KEY,
      holesky: process.env.ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: "holesky",
        chainId: 17000,
        urls: {
          apiURL: "https://api-holesky.etherscan.io/api",
          browserURL: "https://holesky.etherscan.io"
        }
      }
    ]
  }
};
