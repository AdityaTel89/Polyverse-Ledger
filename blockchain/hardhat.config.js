require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    skale: {
      url: "https://testnet.skalenodes.com/v1/giant-half-dual-testnet",
      accounts: ["eefcc6c6306e96fc64e12de673a38c0b3a4cb9044844e482a165ad37dc351da4"] // ⚠️ Add your full private key here without quotes
    }
  }
};




