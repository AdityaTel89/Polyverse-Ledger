// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CreditScoring {
    address public owner;

    mapping(address => uint256) private scores;
    mapping(address => uint256) private invoicesPaid;
    mapping(address => uint256) private totalAmountPaid;

    event ScoreUpdated(address indexed user, uint256 score);
    event InvoiceRecorded(address indexed user, uint256 invoiceAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function recordInvoicePayment(address user, uint256 amount) external onlyOwner {
        invoicesPaid[user]++;
        totalAmountPaid[user] += amount;
        _updateScore(user);
        emit InvoiceRecorded(user, amount);
    }

    function _updateScore(address user) internal {
        // Sample scoring logic: base 300 + weight
        uint256 score = 300 + (invoicesPaid[user] * 5) + (totalAmountPaid[user] / 100);
        if (score > 900) score = 900;

        scores[user] = score;
        emit ScoreUpdated(user, score);
    }

    function getScore(address user) external view returns (uint256) {
        return scores[user];
    }

    function getStats(address user) external view returns (uint256 paid, uint256 amount) {
        return (invoicesPaid[user], totalAmountPaid[user]);
    }
}
