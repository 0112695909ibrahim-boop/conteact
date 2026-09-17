const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RecurringAllowance", function () {
  const FEE_BPS = 50n; // 0.5%
  const DAY = 24 * 60 * 60;
  const PERIOD = 30 * DAY;
  const AMOUNT = ethers.parseUnits("100", 18);

  let recurringAllowance;
  let mockToken;
  let owner;
  let payer;
  let recipient;
  let secondRecipient;
  let feeCollector;
  let other;

  beforeEach(async function () {
    [owner, payer, recipient, secondRecipient, feeCollector, other] =
      await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy();

    const RecurringAllowance = await ethers.getContractFactory(
      "RecurringAllowance"
    );
    recurringAllowance = await RecurringAllowance.deploy(
      feeCollector.address,
      FEE_BPS
    );

    // تجهيز رصيد الدافع والموافقة للعقد على السحب.
    await mockToken.mint(payer.address, ethers.parseUnits("1000", 18));
    await mockToken
      .connect(payer)
      .approve(await recurringAllowance.getAddress(), ethers.MaxUint256);
  });

  async function createAllowance(
    amount = AMOUNT,
    period = PERIOD,
    account = payer,
    beneficiary = recipient
  ) {
    return recurringAllowance
      .connect(account)
      .createAllowance(
        beneficiary.address,
        await mockToken.getAddress(),
        amount,
        period
      );
  }

  async function advanceToNextWithdrawal() {
    await time.increase(PERIOD);
  }

  describe("constructor", function () {
    it("يخزن جامع الرسوم ونسبة الرسوم", async function () {
      expect(await recurringAllowance.platformFeeCollector()).to.equal(
        feeCollector.address
      );
      expect(await recurringAllowance.platformFeeBps()).to.equal(FEE_BPS);
    });

    it("يرفض عنوان جامع رسوم صفراً", async function () {
      const RecurringAllowance = await ethers.getContractFactory(
        "RecurringAllowance"
      );

      await expect(
        RecurringAllowance.deploy(ethers.ZeroAddress, FEE_BPS)
      ).to.be.revertedWith("Invalid collector address");
    });

    it("يرفض رسوماً تتجاوز 10%", async function () {
      const RecurringAllowance = await ethers.getContractFactory(
        "RecurringAllowance"
      );

      await expect(
        RecurringAllowance.deploy(feeCollector.address, 1001)
      ).to.be.revertedWith("Fee cannot exceed 10%");
    });
  });

  describe("createAllowance", function () {
    it("ينشئ تفويضاً بنجاح ويصدر الحدث", async function () {
      await expect(createAllowance())
        .to.emit(recurringAllowance, "AllowanceCreated")
        .withArgs(
          payer.address,
          recipient.address,
          await mockToken.getAddress(),
          AMOUNT,
          PERIOD
        );

      const allowance = await recurringAllowance.getAllowance(
        payer.address,
        recipient.address,
        await mockToken.getAddress()
      );

      expect(allowance.amount).to.equal(AMOUNT);
      expect(allowance.period).to.equal(PERIOD);
      expect(allowance.lastWithdraw).to.be.greaterThan(0);
      expect(allowance.isActive).to.equal(true);
      expect(allowance.nextWithdrawTime).to.equal(
        allowance.lastWithdraw + BigInt(PERIOD)
      );
    });

    it("يرفض المستفيد الصفري", async function () {
      await expect(
        recurringAllowance
          .connect(payer)
          .createAllowance(
            ethers.ZeroAddress,
            await mockToken.getAddress(),
            AMOUNT,
            PERIOD
          )
      ).to.be.revertedWith("Invalid recipient");
    });

    it("يرفض عنوان العملة الصفري", async function () {
      await expect(
        recurringAllowance
          .connect(payer)
          .createAllowance(recipient.address, ethers.ZeroAddress, AMOUNT, PERIOD)
      ).to.be.revertedWith("Invalid token");
    });

    it("يرفض مبلغاً صفراً أو فترة أقل من يوم", async function () {
      await expect(
        recurringAllowance
          .connect(payer)
          .createAllowance(recipient.address, await mockToken.getAddress(), 0, PERIOD)
      ).to.be.revertedWith("Amount must be > 0");

      await expect(
        recurringAllowance
          .connect(payer)
          .createAllowance(
            recipient.address,
            await mockToken.getAddress(),
            AMOUNT,
            DAY - 1
          )
      ).to.be.revertedWith("Min period is 1 day");
    });

    it("يمنع إنشاء تفويض نشط مكرر لنفس الدافع والمستفيد والعملة", async function () {
      await createAllowance();

      await expect(createAllowance()).to.be.revertedWith(
        "Allowance already active"
      );
    });
  });

  describe("withdraw", function () {
    it("يرفض السحب قبل انتهاء الفترة", async function () {
      await createAllowance();

      await expect(
        recurringAllowance
          .connect(recipient)
          .withdraw(payer.address, await mockToken.getAddress())
      ).to.be.revertedWith("Period not elapsed");
    });

    it("يسحب المبلغ الصافي ويرسل الرسوم إلى جامع الرسوم", async function () {
      await createAllowance();
      await advanceToNextWithdrawal();

      const netAmount = AMOUNT - (AMOUNT * FEE_BPS) / 10000n;
      const feeAmount = (AMOUNT * FEE_BPS) / 10000n;
      const tokenAddress = await mockToken.getAddress();

      await expect(
        recurringAllowance.connect(recipient).withdraw(payer.address, tokenAddress)
      )
        .to.emit(recurringAllowance, "FundsWithdrawn")
        .withArgs(
          payer.address,
          recipient.address,
          tokenAddress,
          netAmount,
          feeAmount
        );

      expect(await mockToken.balanceOf(recipient.address)).to.equal(netAmount);
      expect(await mockToken.balanceOf(feeCollector.address)).to.equal(feeAmount);
      expect(await mockToken.balanceOf(payer.address)).to.equal(
        ethers.parseUnits("1000", 18) - AMOUNT
      );
    });

    it("يسمح بسحب جديد بعد مرور دورة أخرى", async function () {
      await createAllowance();
      await advanceToNextWithdrawal();
      await recurringAllowance
        .connect(recipient)
        .withdraw(payer.address, await mockToken.getAddress());

      await expect(
        recurringAllowance
          .connect(recipient)
          .withdraw(payer.address, await mockToken.getAddress())
      ).to.be.revertedWith("Period not elapsed");

      await advanceToNextWithdrawal();
      await expect(
        recurringAllowance
          .connect(recipient)
          .withdraw(payer.address, await mockToken.getAddress())
      ).to.emit(recurringAllowance, "FundsWithdrawn");
    });

    it("يرفض المستفيد غير المصرح له", async function () {
      await createAllowance();
      await advanceToNextWithdrawal();

      await expect(
        recurringAllowance
          .connect(other)
          .withdraw(payer.address, await mockToken.getAddress())
      ).to.be.revertedWith("Allowance not active");
    });

    it("يفشل عند عدم وجود موافقة أو رصيد كافٍ لدى الدافع", async function () {
      await mockToken.connect(payer).approve(await recurringAllowance.getAddress(), 0);
      await createAllowance();
      await advanceToNextWithdrawal();

      await expect(
        recurringAllowance
          .connect(recipient)
          .withdraw(payer.address, await mockToken.getAddress())
      ).to.be.reverted;
    });
  });

  describe("cancelAllowance", function () {
    it("يلغي التفويض ويصدر الحدث", async function () {
      await createAllowance();
      const tokenAddress = await mockToken.getAddress();

      await expect(
        recurringAllowance
          .connect(payer)
          .cancelAllowance(recipient.address, tokenAddress)
      )
        .to.emit(recurringAllowance, "AllowanceCancelled")
        .withArgs(payer.address, recipient.address, tokenAddress);

      const allowance = await recurringAllowance.getAllowance(
        payer.address,
        recipient.address,
        tokenAddress
      );
      expect(allowance.isActive).to.equal(false);
      expect(allowance.nextWithdrawTime).to.equal(0);
    });

    it("يمنع السحب بعد الإلغاء", async function () {
      await createAllowance();
      await recurringAllowance
        .connect(payer)
        .cancelAllowance(recipient.address, await mockToken.getAddress());
      await advanceToNextWithdrawal();

      await expect(
        recurringAllowance
          .connect(recipient)
          .withdraw(payer.address, await mockToken.getAddress())
      ).to.be.revertedWith("Allowance not active");
    });

    it("يرفض الإلغاء من حساب غير الدافع", async function () {
      await createAllowance();

      await expect(
        recurringAllowance
          .connect(other)
          .cancelAllowance(recipient.address, await mockToken.getAddress())
      ).to.be.revertedWith("Allowance not active");
    });
  });

  describe("إدارة الرسوم", function () {
    it("يحدث جامع الرسوم من الحساب المصرح فقط", async function () {
      await expect(
        recurringAllowance
          .connect(feeCollector)
          .setFeeCollector(other.address)
      )
        .to.emit(recurringAllowance, "FeeCollectorUpdated")
        .withArgs(feeCollector.address, other.address);

      expect(await recurringAllowance.platformFeeCollector()).to.equal(
        other.address
      );
    });

    it("يرفض تحديث جامع الرسوم من حساب غير مصرح", async function () {
      await expect(
        recurringAllowance.connect(other).setFeeCollector(other.address)
      ).to.be.revertedWith("Only fee collector");
    });

    it("يرفض تعيين جامع رسوم صفراً", async function () {
      await expect(
        recurringAllowance
          .connect(feeCollector)
          .setFeeCollector(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("يحدث نسبة الرسوم ضمن الحد المسموح", async function () {
      await expect(recurringAllowance.connect(feeCollector).setPlatformFeeBps(1000))
        .to.emit(recurringAllowance, "FeeUpdated")
        .withArgs(FEE_BPS, 1000);

      expect(await recurringAllowance.platformFeeBps()).to.equal(1000);
    });

    it("يرفض نسبة رسوم أعلى من 10%", async function () {
      await expect(
        recurringAllowance.connect(feeCollector).setPlatformFeeBps(1001)
      ).to.be.revertedWith("Fee cannot exceed 10%");
    });
  });
});
