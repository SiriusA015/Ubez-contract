const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const OHMContractABI = require('../artifacts/contracts/OlympusERC20.sol/OlympusERC20Token.json').abi;
const IERC20 = require('../artifacts/contracts/OlympusERC20.sol/IERC20.json').abi;
const routerAbi = require("../artifacts/contracts/mocks/dexRouter.sol/PancakeswapRouter.json").abi;
const factoryAbi = require("../artifacts/contracts/mocks/dexfactory.sol/PancakeswapFactory.json").abi;

var owner;
var userWallet;

var stakingRouter;

describe("Create UserWallet", function () {
    it("Create account", async function () {
        [owner] = await ethers.getSigners();

        userWallet = ethers.Wallet.createRandom();
        userWallet = userWallet.connect(ethers.provider);
        var tx = await owner.sendTransaction({
            to: userWallet.address,
            value: ethers.utils.parseUnits("100", 18)
        });
        await tx.wait();
    });
});

describe("Staking factory deploy", function () {

    it("atariToken deploy", async function () {

        const [deployer] = await ethers.getSigners();

        const provider = waffle.provider;

        var DAO = { address: process.env.DAO };
        /* --------------- parameters --------------- */
        /////////////////////////////////////
        // Initial staking index
        const initialIndex = '7675210820';

        // First block epoch occurs
        const firstEpochBlock = '1';

        // What epoch will be first epoch
        const firstEpochNumber = '1';

        // How many blocks are in each epoch
        const epochLengthInBlocks = '1000';

        // Initial reward rate for epoch
        const initialRewardRate = '3000';

        // Ethereum 0 address, used when toggling changes in treasury
        const zeroAddress = '0x0000000000000000000000000000000000000000';

        // DAI bond BCV
        const daiBondBCV = '365';

        // Bond vesting length in blocks. 33110 ~ 5 days
        const bondVestingLength = '33110';

        // Min bond price
        const minBondPrice = '50';

        // Max bond payout
        const maxBondPayout = '500000000'

        // DAO fee for bond
        const bondFee = '10000';

        // Max debt bond can take on
        const maxBondDebt = '1000000000000000';

        // Initial Bond debt
        const intialBondDebt = '0'

        const largeApproval = '100000000000000000000000000000000';

        const initialMint = '10000000000000000000000000000';

        var exchangeRouter;
        var exchangeFactory;
        var wETH;
        {
            const Factory = await ethers.getContractFactory("PancakeswapFactory");
            exchangeFactory = await Factory.deploy(deployer.address);
            await exchangeFactory.deployed();
            //console.log(await exchangeFactory.INIT_CODE_PAIR_HASH());

            //console.log("exchangeFactory",exchangeFactory.address.yellow)
            /* ----------- WETH -------------- */
            //deploy WETH contract for test
            const WETH = await ethers.getContractFactory("WETH9");
            wETH = await WETH.deploy();
            await wETH.deployed();

            //console.log("WETH",wETH.address.yellow)

            /* ----------- Router -------------- */
            //deploy Router contract for test
            const Router = await ethers.getContractFactory("PancakeswapRouter");
            exchangeRouter = await Router.deploy(exchangeFactory.address, wETH.address);
            await exchangeRouter.deployed();

            //console.log("exchangeRouter",exchangeRouter.address.yellow)
        }

        // Deploy OHM
        const OHM = await ethers.getContractFactory('OlympusERC20Token');
        const ohm = await OHM.deploy();
        await ohm.deployed();

        // Deploy DAI
        const DAI = await ethers.getContractFactory('DAI');
        const dai = await DAI.deploy(0);
        await dai.deployed();

        // Deploy 10,000,000 mock DAI and mock Frax
        await dai.mint(deployer.address, initialMint);

        {
            tx = await dai.approve(exchangeRouter.address, ethers.utils.parseUnits("1000000", 18));

            tx = await exchangeFactory.createPair(ohm.address, dai.address);
            var daiLP = await exchangeFactory.getPair(ohm.address, dai.address);
        }
        /* ----------- test ------------- */
        ////////////////////////////////////

        var nonce = await provider.getTransactionCount(deployer.address);
        //console.log(nonce);
        var startTIme = new Date().getTime();

        //console.log("--------------deploy OHM finish----------------")
        // Deploy treasury
        //@dev changed function in treaury from 'valueOf' to 'valueOfToken'... solidity function was coflicting w js object property name
        const Treasury = await ethers.getContractFactory('OlympusTreasury');
        const treasury = await Treasury.deploy(ohm.address, dai.address, dai.address, 0, { nonce: nonce++ });
        //await treasury.deployed();

        // Deploy bonding calc
        const OlympusBondingCalculator = await ethers.getContractFactory('OlympusBondingCalculator');
        const olympusBondingCalculator = await OlympusBondingCalculator.deploy(ohm.address, { nonce: nonce++ });
        //await olympusBondingCalculator.deployed();

        // Deploy staking distributor
        const Distributor = await ethers.getContractFactory('Distributor');
        const distributor = await Distributor.deploy(treasury.address, ohm.address, epochLengthInBlocks, firstEpochBlock, { nonce: nonce++ });
        //await distributor.deployed();

        // Deploy sOHM
        const SOHM = await ethers.getContractFactory('sOlympus');
        const sOHM = await SOHM.deploy({ nonce: nonce++ });
        //await sOHM.deployed();

        // Deploy Staking
        const Staking = await ethers.getContractFactory('OlympusStaking');
        const staking = await Staking.deploy(ohm.address, sOHM.address, epochLengthInBlocks, firstEpochNumber, firstEpochBlock, { nonce: nonce++ });
        //await staking.deployed();

        // Deploy staking warmpup
        const StakingWarmpup = await ethers.getContractFactory('StakingWarmup');
        const stakingWarmup = await StakingWarmpup.deploy(staking.address, sOHM.address, { nonce: nonce++ });
        //await stakingWarmup.deployed();

        // Deploy staking helper
        const StakingHelper = await ethers.getContractFactory('StakingHelper');
        const stakingHelper = await StakingHelper.deploy(staking.address, ohm.address, { nonce: nonce++ });
        //await stakingHelper.deployed();

        //@dev changed function call to Treasury of 'valueOf' to 'valueOfToken' in BondDepository due to change in Treausry contract
        const DAIBond = await ethers.getContractFactory('OlympusBondDepository');
        const daiBond = await DAIBond.deploy(ohm.address, dai.address, treasury.address, DAO.address, zeroAddress, { nonce: nonce++ });

        //console.log("--------------deploy finish----------------")

        {
            // queue and toggle DAI and Frax bond reserve depositor
            var tx = await treasury.queue('0', daiBond.address, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            await tx.wait();
            tx = await treasury.toggle('0', daiBond.address, zeroAddress, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            await tx.wait();

            //console.log("--------------treasury 1----------------")
            // Set DAI and Frax bond terms
            tx = await daiBond.initializeBondTerms(daiBondBCV, bondVestingLength, minBondPrice, maxBondPayout, bondFee, maxBondDebt, intialBondDebt, { nonce: nonce++ });
            //await tx.wait();

            // Set staking for DAI and Frax bond
            tx = await daiBond.setStaking(staking.address, stakingHelper.address, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            //await tx.wait();

            // Initialize sOHM and set the index
            tx = await sOHM.initialize(staking.address, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            //await tx.wait();
            tx = await sOHM.setIndex(initialIndex, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            //await tx.wait();

            //console.log("-------------- bonds and sOHM ----------------");

            // set distributor contract and warmup contract
            tx = await staking.setContract('0', distributor.address, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            await tx.wait();
            tx = await staking.setContract('1', stakingWarmup.address, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            await tx.wait();

            // Set treasury for OHM token
            tx = await ohm.setVault(treasury.address, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            // Add staking contract as distributor recipient
            tx = await distributor.addRecipient(staking.address, initialRewardRate, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });

            // queue and toggle reward manager
            tx = await treasury.queue('8', distributor.address, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            tx = await treasury.toggle('8', distributor.address, zeroAddress, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });

            // queue and toggle deployer reserve depositor
            tx = await treasury.queue('0', deployer.address, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            tx = await treasury.toggle('0', deployer.address, zeroAddress, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });

            //console.log( "final : ",deployer.address);
            // queue and toggle liquidity depositor
            tx = await treasury.queue('4', deployer.address, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });

            tx = await treasury.toggle('4', deployer.address, zeroAddress, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
            // Stake OHM through helper
        }
        //console.log("-------------- environment ----------------");

        var tx = await dai.approve(treasury.address, largeApproval, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
        var tx = await ohm.approve(stakingHelper.address, '1000000000000000000000000', { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });
        var tx = await dai.approve(daiBond.address, largeApproval, { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });

        //100,000,000,000,000,000,000
        tx = await treasury.deposit('100000000000000000000', dai.address, '50000000000', { nonce: nonce++, gasLimit: "200000", gasPrice: "200000000000" });

        //console.log(" ohm.balanceOf",String(await ohm.balanceOf(deployer.address)) )
        //console.log(" dai.balanceOf",String(await dai.balanceOf(deployer.address)) )

        //console.log("debtRatio",ethers.utils.formatUnits(await daiBond.debtRatio()));

        //console.log("bondPriceInUSD",ethers.utils.formatUnits(await daiBond.bondPriceInUSD()));
        try {
            var tx = await stakingHelper.stake('10000000000', { nonce: nonce++ });
            await tx.wait();
        } catch (err) {
            //console.log("staking error",err);
        }

        //console.log(ethers.utils.formatUnits(await daiBond.payoutFor("10000000000000000000"),18));

        await daiBond.deposit('10000000000000000000', '60000', deployer.address, { nonce: nonce++ });

        //console.log("-------------- Exchange add liquidity ----------------");
        {
            //dai, wFTM - ohm add liquidity
            {

                tx = await ohm.approve(exchangeRouter.address, ethers.utils.parseUnits("100000000", 9), { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });

                tx = await dai.approve(exchangeRouter.address, ethers.utils.parseUnits("1000000", 18), { nonce: nonce++, gasLimit: "100000", gasPrice: "200000000000" });

                //console.log(ethers.utils.formatUnits(await ohm.allowance(deployer.address, exchangeRouter.address),9));
                //console.log(ethers.utils.formatUnits(await dai.allowance(deployer.address, exchangeRouter.address),18));

                try {
                    //DAI
                    var tx = await exchangeRouter.addLiquidity(
                        ohm.address,
                        dai.address,
                        ethers.utils.parseUnits("6", 9),
                        ethers.utils.parseUnits("10", 18),
                        0,
                        0,
                        deployer.address,
                        "111111111111111111111",
                        { nonce: nonce++, gasLimit: "500000", gasPrice: "200000000000" }
                    );
                } catch (err) {
                    //console.log("err",err)
                }
            }
            //console.log( "OHM: " + ohm.address );
            //console.log( "DAI: " + dai.address );
        }
        var end = new Date().getTime();

        //console.log("deploy ended ",(Number(end) - startTIme) /1000)

        // var daiLP = await exchangeFactory.getPair(ohm.address,dai.address);
        // var wFTMLP = await exchangeFactory.getPair(ohm.address,dai.address);

        //console.log( "DAI_ADDRESS: ",dai.address);
        //console.log( "OHM_ADDRESS: ",ohm.address);
        //console.log( "STAKING_ADDRESS: ",staking.address);
        //console.log( "STAKING_HELPER_ADDRESS: ",stakingHelper.address);
        //console.log( "SOHM_ADDRESS: ",sOHM.address);
        //console.log( "DISTRIBUTOR_ADDRESS: ",distributor.address);
        //console.log( "BONDINGCALC_ADDRESS: ",olympusBondingCalculator.address);
        //console.log( "TREASURY_ADDRESS: ",treasury.address);


        //console.log( "bondAddress: ",daiBond.address);
        //console.log( "daiLP: ",daiLP);
    });

});
