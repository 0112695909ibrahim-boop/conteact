const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RecurringAllowance", function () {
  let RecurringAllowance, recurringAllowance;
  let MockToken, mockToken;
  let owner, payer, recipient, feeCollector;

  beforeEach(async function () {
    [owner, payer, recipient, feeCollector] = await ethers.getSigners();

    // نشر عملة وهمية (Mock ERC20) للاختبار
    MockToken = await ethers.getContractFactory("MockERC20"); // ستحتاج لإنشاء Mock بسيط أو استخدام OpenZeppelin
    // ملاحظة: للاختبار السريع، يمكنك استخدام أي عملة ERC20 موجودة على الشبكة الاختبارية، 
    // أو إنشاء Mock Token بسيط.
    
    // نشر عقد الاشتراكات
    RecurringAllowance = await ethers.getContractFactory("RecurringAllowance");
    recurringAllowance = await RecurringAllowance.deploy(feeCollector.address, 50); // 0.5% رسوم
  });

  it("يجب إنشاء تفويض بنجاح", async function () {
    const amount = ethers.parseUnits("100", 18); // 100 Token
    const period = 30 * 24 * 60 * 60; // 30 days

    await expect(
      recurringAllowance.connect(payer).createAllowance(recipient.address, "0xTokenAddress", amount, period)
    ).to.emit(recurringAllowance, "AllowanceCreated");
    
    const allowance = await recurringAllowance.getAllowance(payer.address, recipient.address, "0xTokenAddress");
    expect(allowance.isActive).to.be.true;
  });

  it("يجب أن يفشل السحب إذا لم يمر الوقت المحدد", async function () {
    // ... (تفاصيل اختبار الفشل)
  });
});
