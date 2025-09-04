import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  ERC20Mintable,
  MockV3Aggregator,
  AddressToTokenMapV2,
  LendingConfigV2,
  LendingHelper,
  PoolFactory
} from "../typechain-types";

describe("01_Deploy", function () {
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  let weth: ERC20Mintable;
  let usdc: ERC20Mintable;
  let dai: ERC20Mintable;

  let wethUsdFeed: MockV3Aggregator;
  let usdcUsdFeed: MockV3Aggregator;
  let daiUsdFeed: MockV3Aggregator;

  let addressToTokenMap: AddressToTokenMapV2;
  let lendingConfig: LendingConfigV2;
  let lendingHelper: LendingHelper;
  let poolFactory: PoolFactory;

  before(async function () {
    [deployer, user1, user2] = await ethers.getSigners();
  });

  describe("Deploy Mock Tokens", function () {
    it("Should deploy WETH token", async function () {
      const ERC20Mintable = await ethers.getContractFactory("ERC20Mintable");
      weth = await ERC20Mintable.deploy(
        "Wrapped Ether",
        "WETH",
        18,
        ethers.utils.parseEther("1000000")
      );
      await weth.deployed();

      expect(await weth.name()).to.equal("Wrapped Ether");
      expect(await weth.symbol()).to.equal("WETH");
      expect(await weth.decimals()).to.equal(18);
      expect(await weth.totalSupply()).to.equal(ethers.utils.parseEther("1000000"));
    });

    it("Should deploy USDC token", async function () {
      const ERC20Mintable = await ethers.getContractFactory("ERC20Mintable");
      usdc = await ERC20Mintable.deploy(
        "USD Coin",
        "USDC",
        6,
        ethers.utils.parseUnits("1000000", 6)
      );
      await usdc.deployed();

      expect(await usdc.name()).to.equal("USD Coin");
      expect(await usdc.symbol()).to.equal("USDC");
      expect(await usdc.decimals()).to.equal(6);
      expect(await usdc.totalSupply()).to.equal(ethers.utils.parseUnits("1000000", 6));
    });

    it("Should deploy DAI token", async function () {
      const ERC20Mintable = await ethers.getContractFactory("ERC20Mintable");
      dai = await ERC20Mintable.deploy(
        "Dai Stablecoin",
        "DAI",
        18,
        ethers.utils.parseEther("1000000")
      );
      await dai.deployed();

      expect(await dai.name()).to.equal("Dai Stablecoin");
      expect(await dai.symbol()).to.equal("DAI");
      expect(await dai.decimals()).to.equal(18);
      expect(await dai.totalSupply()).to.equal(ethers.utils.parseEther("1000000"));
    });
  });

  describe("Deploy Mock Price Feeds", function () {
    it("Should deploy WETH/USD price feed", async function () {
      const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
      wethUsdFeed = await MockV3Aggregator.deploy(8, 300000000000); // $3000
      await wethUsdFeed.deployed();

      expect(await wethUsdFeed.decimals()).to.equal(8);
      const latestRoundData = await wethUsdFeed.latestRoundData();
      expect(latestRoundData.answer).to.equal(300000000000);
    });

    it("Should deploy USDC/USD price feed", async function () {
      const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
      usdcUsdFeed = await MockV3Aggregator.deploy(8, 100000000); // $1
      await usdcUsdFeed.deployed();

      expect(await usdcUsdFeed.decimals()).to.equal(8);
      const latestRoundData = await usdcUsdFeed.latestRoundData();
      expect(latestRoundData.answer).to.equal(100000000);
    });

    it("Should deploy DAI/USD price feed", async function () {
      const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
      daiUsdFeed = await MockV3Aggregator.deploy(8, 100000000); // $1
      await daiUsdFeed.deployed();

      expect(await daiUsdFeed.decimals()).to.equal(8);
      const latestRoundData = await daiUsdFeed.latestRoundData();
      expect(latestRoundData.answer).to.equal(100000000);
    });
  });

  describe("Deploy Core Contracts", function () {
    it("Should deploy AddressToTokenMapV2", async function () {
      const AddressToTokenMapV2 = await ethers.getContractFactory("AddressToTokenMapV2");
      addressToTokenMap = await AddressToTokenMapV2.deploy();
      await addressToTokenMap.deployed();

      expect(await addressToTokenMap.owner()).to.equal(deployer.address);
      expect(await addressToTokenMap.oracleStaleThreshold()).to.equal(3600);
    });

    it("Should deploy LendingConfigV2", async function () {
      const LendingConfigV2 = await ethers.getContractFactory("LendingConfigV2");
      lendingConfig = await LendingConfigV2.deploy();
      await lendingConfig.deployed();

      const hasAdminRole = await lendingConfig.hasRole(
        await lendingConfig.DEFAULT_ADMIN_ROLE(),
        deployer.address
      );
      expect(hasAdminRole).to.be.true;

      const hasRiskAdminRole = await lendingConfig.hasRole(
        await lendingConfig.RISK_ADMIN(),
        deployer.address
      );
      expect(hasRiskAdminRole).to.be.true;
    });

    it("Should deploy LendingHelper", async function () {
      const LendingHelper = await ethers.getContractFactory("LendingHelper");
      lendingHelper = await LendingHelper.deploy(
        addressToTokenMap.address,
        lendingConfig.address
      );
      await lendingHelper.deployed();

      // Basic sanity check
      expect(lendingHelper.address).to.not.equal(ethers.constants.AddressZero);
    });
  });

  describe("Setup Token Mappings", function () {
    it("Should set token data in batch", async function () {
      await addressToTokenMap.batchSetTokenData(
        [weth.address, usdc.address, dai.address],
        ["WETH", "USDC", "DAI"],
        [wethUsdFeed.address, usdcUsdFeed.address, daiUsdFeed.address],
        [18, 6, 18]
      );

      expect(await addressToTokenMap.getSymbol(weth.address)).to.equal("WETH");
      expect(await addressToTokenMap.getSymbol(usdc.address)).to.equal("USDC");
      expect(await addressToTokenMap.getSymbol(dai.address)).to.equal("DAI");

      expect(await addressToTokenMap.getPriceFeed(weth.address)).to.equal(wethUsdFeed.address);
      expect(await addressToTokenMap.getPriceFeed(usdc.address)).to.equal(usdcUsdFeed.address);
      expect(await addressToTokenMap.getPriceFeed(dai.address)).to.equal(daiUsdFeed.address);

      expect(await addressToTokenMap.getDecimals(weth.address)).to.equal(18);
      expect(await addressToTokenMap.getDecimals(usdc.address)).to.equal(6);
      expect(await addressToTokenMap.getDecimals(dai.address)).to.equal(18);
    });

    it("Should get prices correctly", async function () {
      // WETH: $3000 (8 decimals) -> 3000e18
      const wethPrice = await addressToTokenMap.getPrice(weth.address);
      expect(wethPrice).to.equal(ethers.utils.parseEther("3000"));

      // USDC: $1 (8 decimals) -> 1e18
      const usdcPrice = await addressToTokenMap.getPrice(usdc.address);
      expect(usdcPrice).to.equal(ethers.utils.parseEther("1"));

      // DAI: $1 (8 decimals) -> 1e18
      const daiPrice = await addressToTokenMap.getPrice(dai.address);
      expect(daiPrice).to.equal(ethers.utils.parseEther("1"));
    });
  });

  describe("Mint tokens to users", function () {
    it("Should mint tokens to test users", async function () {
      // Mint to user1
      await weth.mint(user1.address, ethers.utils.parseEther("100"));
      await usdc.mint(user1.address, ethers.utils.parseUnits("50000", 6));
      await dai.mint(user1.address, ethers.utils.parseEther("50000"));

      // Mint to user2
      await weth.mint(user2.address, ethers.utils.parseEther("50"));
      await usdc.mint(user2.address, ethers.utils.parseUnits("25000", 6));
      await dai.mint(user2.address, ethers.utils.parseEther("25000"));

      // Verify balances
      expect(await weth.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("100"));
      expect(await usdc.balanceOf(user1.address)).to.equal(ethers.utils.parseUnits("50000", 6));
      expect(await dai.balanceOf(user1.address)).to.equal(ethers.utils.parseEther("50000"));

      expect(await weth.balanceOf(user2.address)).to.equal(ethers.utils.parseEther("50"));
      expect(await usdc.balanceOf(user2.address)).to.equal(ethers.utils.parseUnits("25000", 6));
      expect(await dai.balanceOf(user2.address)).to.equal(ethers.utils.parseEther("25000"));
    });
  });
});

