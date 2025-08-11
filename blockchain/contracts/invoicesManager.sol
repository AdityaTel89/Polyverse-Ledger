// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ICreditScoring {
    function recordInvoicePayment(address user, uint amount, uint paidTimestamp) external;
}

contract InvoiceManager {
    struct Invoice {
        uint id;
        address issuer;
        address recipient;
        uint amount;
        uint dueDate;
        bool paid;
    }

    uint public invoiceCount;
    mapping(uint => Invoice) public invoices;
    mapping(address => uint[]) public userInvoices;

    ICreditScoring public creditScoring;

    event InvoiceCreated(uint id, address indexed issuer, address indexed recipient, uint amount, uint dueDate);
    event InvoicePaid(uint id);

    constructor(address _creditScoringAddress) {
        creditScoring = ICreditScoring(_creditScoringAddress);
    }

    function createInvoice(address _recipient, uint _amount, uint _dueDate) external {
        invoiceCount++;
        invoices[invoiceCount] = Invoice(invoiceCount, msg.sender, _recipient, _amount, _dueDate, false);
        userInvoices[msg.sender].push(invoiceCount);

        emit InvoiceCreated(invoiceCount, msg.sender, _recipient, _amount, _dueDate);
    }

    function markInvoicePaid(uint _invoiceId) external {
        Invoice storage inv = invoices[_invoiceId];
        require(msg.sender == inv.recipient, "Only recipient can mark as paid");
        require(!inv.paid, "Already paid");

        inv.paid = true;
        emit InvoicePaid(_invoiceId);

        
        creditScoring.recordInvoicePayment(inv.recipient, inv.amount, block.timestamp);
    }

    function getInvoicesByUser(address _user) external view returns (uint[] memory) {
        return userInvoices[_user];
    }
}


