const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("02_InterestRateModel", function () {
  let deployer;
  let testModel;

  const PRECISION = ethers.utils.parseEther("1"); // 1e18
  const KINK = ethers.utils.parseEther("0.8"); // 80%
  const R_BASE = ethers.utils.parseEther("0.02"); // 2% base rate
  const SLOPE1 = ethers.utils.parseEther("0.05"); // 5% slope before kink
  const SLOPE2 = ethers.utils.parseEther("0.25"); // 25% slope after kink
  const RESERVE_FACTOR = ethers.utils.parseEther("0.1"); // 10% reserve factor

  before(async function () {
    [deployer] = await ethers.getSigners();
    
    const TestInterestRateModel = await ethers.getContractFactory("TestInterestRateModel");
    testModel = await TestInterestRateModel.deploy();
    await testModel.deployed();
  });

  describe("Utilization Rate", function () {
    it("Should return 0% when no cash and no borrows", async function () {
      const util = await testModel.testUtilization(0, 0);
      expect(util).to.equal(0);
    });

    it("Should return 0% when cash exists but no borrows", async function () {
      const cash = ethers.utils.parseEther("1000");
      const borrows = 0;
      const util = await testModel.testUtilization(cash, borrows);
      expect(util).to.equal(0);
    });

    it("Should return 50% utilization", async function () {
      const cash = ethers.utils.parseEther("1000");
      const borrows = ethers.utils.parseEther("1000");
      const util = await testModel.testUtilization(cash, borrows);
      
      // Utilization = borrows / (cash + borrows) = 1000 / 2000 = 50%
      expect(util).to.equal(ethers.utils.parseEther("0.5"));
    });

    it("Should return 80% utilization (at kink)", async function () {
      const cash = ethers.utils.parseEther("500");
      const borrows = ethers.utils.parseEther("2000");
      const util = await testModel.testUtilization(cash, borrows);
      
      // Utilization = 2000 / (500 + 2000) = 2000 / 2500 = 80%
      expect(util).to.equal(ethers.utils.parseEther("0.8"));
    });

    it("Should return 90% utilization (above kink)", async function () {
      const cash = ethers.utils.parseEther("100");
      const borrows = ethers.utils.parseEther("900");
      const util = await testModel.testUtilization(cash, borrows);
      
      // Utilization = 900 / (100 + 900) = 900 / 1000 = 90%
      expect(util).to.equal(ethers.utils.parseEther("0.9"));
    });
  });

  describe("Borrow Rate", function () {
    it("Should calculate correct borrow rate at 0% utilization", async function () {
      const util = 0;
      const borrowRate = await testModel.testRBorrow(util, R_BASE, SLOPE1, SLOPE2, KINK);
      
      // Rate = R_BASE + 0 * SLOPE1 = 2%
      expect(borrowRate).to.equal(R_BASE);
    });

    it("Should calculate correct borrow rate at 50% utilization (before kink)", async function () {
      const util = ethers.utils.parseEther("0.5"); // 50%
      const borrowRate = await testModel.testRBorrow(util, R_BASE, SLOPE1, SLOPE2, KINK);
      
      // Rate = R_BASE + 0.5 * SLOPE1 = 2% + 0.5 * 5% = 4.5%
      const expectedRate = R_BASE.add(SLOPE1.mul(util).div(PRECISION));
      expect(borrowRate).to.equal(expectedRate);
    });

    it("Should calculate correct borrow rate at kink (80%)", async function () {
      const util = KINK; // 80%
      const borrowRate = await testModel.testRBorrow(util, R_BASE, SLOPE1, SLOPE2, KINK);
      
      // Rate = R_BASE + KINK * SLOPE1 = 2% + 0.8 * 5% = 6%
      const expectedRate = R_BASE.add(SLOPE1.mul(KINK).div(PRECISION));
      expect(borrowRate).to.equal(expectedRate);
    });

    it("Should calculate correct borrow rate at 90% utilization (after kink)", async function () {
      const util = ethers.utils.parseEther("0.9"); // 90%
      const borrowRate = await testModel.testRBorrow(util, R_BASE, SLOPE1, SLOPE2, KINK);
      
      // Rate = R_BASE + KINK * SLOPE1 + (util - KINK) * SLOPE2
      // = 2% + 0.8 * 5% + (0.9 - 0.8) * 25%
      // = 2% + 4% + 0.1 * 25% = 8.5%
      const beforeKink = R_BASE.add(SLOPE1.mul(KINK).div(PRECISION));
      const afterKink = SLOPE2.mul(util.sub(KINK)).div(PRECISION);
      const expectedRate = beforeKink.add(afterKink);
      
      expect(borrowRate).to.equal(expectedRate);
    });
  });

  describe("Supply Rate", function () {
    it("Should return 0% supply rate when utilization is 0%", async function () {
      const borrowRate = R_BASE; // 2%
      const util = 0;
      const supplyRate = await testModel.testRSupply(borrowRate, util, RESERVE_FACTOR);
      
      // Supply rate = borrowRate * util * (1 - reserveFactor) = 2% * 0% * 90% = 0%
      expect(supplyRate).to.equal(0);
    });

    it("Should calculate correct supply rate at 50% utilization", async function () {
      const util = ethers.utils.parseEther("0.5"); // 50%
      const borrowRate = R_BASE.add(SLOPE1.mul(util).div(PRECISION)); // 4.5%
      const supplyRate = await testModel.testRSupply(borrowRate, util, RESERVE_FACTOR);
      
      // Supply rate = borrowRate * util * (1 - reserveFactor)
      // = 4.5% * 50% * (1 - 10%) = 4.5% * 50% * 90% = 2.025%
      const oneMinusReserveFactor = PRECISION.sub(RESERVE_FACTOR);
      const expectedRate = borrowRate.mul(util).mul(oneMinusReserveFactor).div(PRECISION.mul(PRECISION));
      
      expect(supplyRate).to.equal(expectedRate);
    });

    it("Should calculate correct supply rate at 80% utilization (kink)", async function () {
      const util = KINK; // 80%
      const borrowRate = R_BASE.add(SLOPE1.mul(KINK).div(PRECISION)); // 6%
      const supplyRate = await testModel.testRSupply(borrowRate, util, RESERVE_FACTOR);
      
      // Supply rate = 6% * 80% * 90% = 4.32%
      const oneMinusReserveFactor = PRECISION.sub(RESERVE_FACTOR);
      const expectedRate = borrowRate.mul(util).mul(oneMinusReserveFactor).div(PRECISION.mul(PRECISION));
      
      expect(supplyRate).to.equal(expectedRate);
    });

    it("Should calculate correct supply rate at 90% utilization", async function () {
      const util = ethers.utils.parseEther("0.9"); // 90%
      
      // Calculate borrow rate: 2% + 0.8 * 5% + 0.1 * 25% = 8.5%
      const beforeKink = R_BASE.add(SLOPE1.mul(KINK).div(PRECISION));
      const afterKink = SLOPE2.mul(util.sub(KINK)).div(PRECISION);
      const borrowRate = beforeKink.add(afterKink);
      
      const supplyRate = await testModel.testRSupply(borrowRate, util, RESERVE_FACTOR);
      
      // Supply rate = 8.5% * 90% * 90% = 6.885%
      const oneMinusReserveFactor = PRECISION.sub(RESERVE_FACTOR);
      const expectedRate = borrowRate.mul(util).mul(oneMinusReserveFactor).div(PRECISION.mul(PRECISION));
      
      expect(supplyRate).to.equal(expectedRate);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle 100% utilization", async function () {
      const util = PRECISION; // 100%
      const borrowRate = await testModel.testRBorrow(util, R_BASE, SLOPE1, SLOPE2, KINK);
      
      // Rate = R_BASE + KINK * SLOPE1 + (1 - KINK) * SLOPE2
      // = 2% + 0.8 * 5% + 0.2 * 25% = 2% + 4% + 5% = 11%
      const beforeKink = R_BASE.add(SLOPE1.mul(KINK).div(PRECISION));
      const afterKink = SLOPE2.mul(PRECISION.sub(KINK)).div(PRECISION);
      const expectedRate = beforeKink.add(afterKink);
      
      expect(borrowRate).to.equal(expectedRate);
    });

    it("Should handle very small utilization", async function () {
      const util = 1; // Very small but not zero
      const borrowRate = await testModel.testRBorrow(util, R_BASE, SLOPE1, SLOPE2, KINK);
      
      // Should be very close to base rate
      expect(borrowRate).to.be.gte(R_BASE);
      expect(borrowRate).to.be.lt(R_BASE.add(100)); // Very small addition
    });

    it("Should handle utilization correctly when cash and borrows are 0", async function () {
      const util = await testModel.testUtilization(0, 0);
      expect(util).to.equal(0);
    });
  });

  describe("Interest Rate Progression", function () {
    it("Should show increasing borrow rates as utilization increases", async function () {
      const utils = [
        0,
        ethers.utils.parseEther("0.2"), // 20%
        ethers.utils.parseEther("0.5"), // 50%
        KINK,                           // 80% (kink)
        ethers.utils.parseEther("0.9"), // 90%
        PRECISION                       // 100%
      ];
      
      let previousRate = 0;
      
      for (const util of utils) {
        const borrowRate = await testModel.testRBorrow(util, R_BASE, SLOPE1, SLOPE2, KINK);
        expect(borrowRate).to.be.gte(previousRate);
        previousRate = borrowRate;
        
        console.log(`Utilization: ${ethers.utils.formatEther(util)}% -> Borrow Rate: ${ethers.utils.formatEther(borrowRate)}%`);
      }
    });

    it("Should show supply rates are always less than borrow rates", async function () {
      const utils = [
        ethers.utils.parseEther("0.5"), // 50%
        KINK,                           // 80%
        ethers.utils.parseEther("0.9")  // 90%
      ];
      
      for (const util of utils) {
        const borrowRate = await testModel.testRBorrow(util, R_BASE, SLOPE1, SLOPE2, KINK);
        const supplyRate = await testModel.testRSupply(borrowRate, util, RESERVE_FACTOR);
        
        expect(supplyRate).to.be.lt(borrowRate);
        
        console.log(`Utilization: ${ethers.utils.formatEther(util)}% -> Borrow: ${ethers.utils.formatEther(borrowRate)}% | Supply: ${ethers.utils.formatEther(supplyRate)}%`);
      }
    });
  });
});

