// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract UserRegistry {
    struct User {
        address wallet;
        string metadataURI; // IPFS or HTTPS link to JSON metadata
        uint256 registeredAt;
    }

    mapping(address => User) public users;
    mapping(address => bool) public isRegistered;

    event UserRegistered(address indexed user, string metadataURI, uint256 timestamp);
    event MetadataUpdated(address indexed user, string newMetadataURI);

    function registerUser(string calldata _metadataURI) external {
        require(!isRegistered[msg.sender], "Already registered");

        users[msg.sender] = User({
            wallet: msg.sender,
            metadataURI: _metadataURI,
            registeredAt: block.timestamp
        });
        isRegistered[msg.sender] = true;

        emit UserRegistered(msg.sender, _metadataURI, block.timestamp);
    }

    function updateMetadata(string calldata _newMetadataURI) external {
        require(isRegistered[msg.sender], "User not registered");

        users[msg.sender].metadataURI = _newMetadataURI;

        emit MetadataUpdated(msg.sender, _newMetadataURI);
    }

    function getUser(address _wallet) external view returns (User memory) {
        require(isRegistered[_wallet], "User not registered");
        return users[_wallet];
    }
}
