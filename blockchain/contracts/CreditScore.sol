// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract CreditScore {
    address public owner;
    address public operator; // new authorized operator

    mapping(address => uint256) public scores;

    event ScoreUpdated(address indexed user, uint256 newScore);
    event OperatorUpdated(address newOperator);

    // Modifier that allows only the owner or the operator to update scores
    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner || msg.sender == operator, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        operator = msg.sender; // Initially, the operator is set to the owner.
    }

    // Owner can later update the operator (for example, to set InvoiceManager as the operator)
    function setOperator(address _operator) external {
        require(msg.sender == owner, "Only owner can set operator");
        operator = _operator;
        emit OperatorUpdated(_operator);
    }

    function getScore(address user) external view returns (uint256) {
        return scores[user];
    }

    function setScore(address user, uint256 score) external onlyOwnerOrOperator {
        scores[user] = score;
        emit ScoreUpdated(user, score);
    }

    function increaseScore(address user, uint256 amount) external onlyOwnerOrOperator {
        scores[user] += amount;
        emit ScoreUpdated(user, scores[user]);
    }

    function decreaseScore(address user, uint256 amount) external onlyOwnerOrOperator {
        if (scores[user] >= amount) {
            scores[user] -= amount;
        } else {
            scores[user] = 0;
        }
        emit ScoreUpdated(user, scores[user]);
    }
}
