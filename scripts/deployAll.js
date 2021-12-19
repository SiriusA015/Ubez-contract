// @dev. This script will deploy this V1.1 of Olympus. It will deploy the whole ecosystem except for the LP tokens and their bonds. 
// This should be enough of a test environment to learn about and test implementations with the Olympus as of V1.1.
// Not that the every instance of the Treasury's function 'valueOf' has been changed to 'valueOfToken'... 
// This solidity function was conflicting w js object property name

const { ethers } = require("hardhat");
const colors = require('colors');

async function main() {

    const [deployer] = await ethers.getSigners();
    var MockDAO = {address :process.env.MOCKDAO};
    console.log('Deploying contracts with the account: ' + deployer.address);
    console.log('Deploying contracts with the account: ' + MockDAO.address);

    // Initial staking index
    const initialIndex = '7675210820';

    // First block epoch occurs
    const firstEpochBlock = '8961000';

    // What epoch will be first epoch
    const firstEpochNumber = '338';

    // How many blocks are in each epoch
    const epochLengthInBlocks = '2200';

    // Initial reward rate for epoch
    const initialRewardRate = '3000';

    // Ethereum 0 address, used when toggling changes in treasury
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    // Large number for approval for Frax and DAI
    const largeApproval = '100000000000000000000000000000000';

    // Initial mint for Frax and DAI (10,000,000)
    const initialMint = '10000000000000000000000000';

    // DAI bond BCV
    const daiBondBCV = '369';

    // Frax bond BCV
    const fraxBondBCV = '690';

    // Bond vesting length in blocks. 33110 ~ 5 days
    const bondVestingLength = '33110';

    // Min bond price
    const minBondPrice = '50000';

    // Max bond payout
    const maxBondPayout = '50'

    // DAO fee for bond
    const bondFee = '10000';

    // Max debt bond can take on
    const maxBondDebt = '1000000000000000';

    // Initial Bond debt
    const intialBondDebt = '0'

    
    // exchanger deploy and add liquidity

	var exchangeRouter;
	var exchangeFactory;
	var wETH;
    {
        const Factory = await ethers.getContractFactory("PancakeswapFactory");
		exchangeFactory = await Factory.deploy(deployer.address);
		await exchangeFactory.deployed();
		console.log(await exchangeFactory.INIT_CODE_PAIR_HASH());

		console.log("exchangeFactory",exchangeFactory.address.yellow)
		/* ----------- WETH -------------- */
		//deploy WETH contract for test
		const WETH = await ethers.getContractFactory("WETH9");
		wETH = await WETH.deploy();
		await wETH.deployed();

		console.log("WETH",wETH.address.yellow)

		/* ----------- Router -------------- */
		//deploy Router contract for test
		const Router = await ethers.getContractFactory("PancakeswapRouter");
		exchangeRouter = await Router.deploy(exchangeFactory.address,wETH.address);
		await exchangeRouter.deployed();

		console.log("exchangeRouter",exchangeRouter.address.yellow)
    }

    // Deploy OHM
    const OHM = await ethers.getContractFactory('OlympusERC20Token');
    const ohm = await OHM.deploy();
    await ohm.deployed();

    // Deploy DAI
    const DAI = await ethers.getContractFactory('DAI');
    const dai = await DAI.deploy( 0 );
    await dai.deployed();
    
    // Deploy 10,000,000 mock DAI and mock Frax
    await dai.mint( deployer.address, initialMint );

    
    var tx = await exchangeFactory.createPair(ohm.address,dai.address, {nonce : nonce++, gasLimit : "500000", gasPrice : "200000000000"});

    var daiLP = await exchangeFactory.getPair(ohm.address,dai.address);

    // Deploy treasury
    //@dev changed function in treaury from 'valueOf' to 'valueOfToken'... solidity function was coflicting w js object property name
    const Treasury = await ethers.getContractFactory('OlympusTreasury'); 
    const treasury = await Treasury.deploy( ohm.address, dai.address, daiLP, 0 );

    // Deploy bonding calc
    const OlympusBondingCalculator = await ethers.getContractFactory('OlympusBondingCalculator');
    const olympusBondingCalculator = await OlympusBondingCalculator.deploy( ohm.address );

    // Deploy staking distributor
    const Distributor = await ethers.getContractFactory('Distributor');
    const distributor = await Distributor.deploy(treasury.address, ohm.address, epochLengthInBlocks, firstEpochBlock);

    // Deploy sOHM
    const SOHM = await ethers.getContractFactory('sOlympus');
    const sOHM = await SOHM.deploy();

    // Deploy Staking
    const Staking = await ethers.getContractFactory('OlympusStaking');
    const staking = await Staking.deploy( ohm.address, sOHM.address, epochLengthInBlocks, firstEpochNumber, firstEpochBlock );

    // Deploy staking warmpup
    const StakingWarmpup = await ethers.getContractFactory('StakingWarmup');
    const stakingWarmup = await StakingWarmpup.deploy(staking.address, sOHM.address);

    // Deploy staking helper
    const StakingHelper = await ethers.getContractFactory('StakingHelper');
    const stakingHelper = await StakingHelper.deploy(staking.address, ohm.address);

    // Deploy DAI bond
    //@dev changed function call to Treasury of 'valueOf' to 'valueOfToken' in BondDepository due to change in Treausry contract
    const DAIBond = await ethers.getContractFactory('MockOlympusBondDepository');
    var daiBond;
    try {
        daiBond = await DAIBond.deploy(ohm.address, dai.address, treasury.address, MockDAO.address, zeroAddress);
    }catch(err){
    console.log("MockDAOERROR")
    }
    
    // Deploy Frax bond
    //@dev changed function call to Treasury of 'valueOf' to 'valueOfToken' in BondDepository due to change in Treausry contract
    const FraxBond = await ethers.getContractFactory('MockOlympusBondDepository');
    const fraxBond = await FraxBond.deploy(ohm.address, frax.address, treasury.address, MockDAO.address, zeroAddress);

    // queue and toggle DAI and Frax bond reserve depositor
    await treasury.queue('0', daiBond.address);
    await treasury.queue('0', fraxBond.address);
    await treasury.toggle('0', daiBond.address, zeroAddress);
    await treasury.toggle('0', fraxBond.address, zeroAddress);

    // Set DAI and Frax bond terms
    await daiBond.initializeBondTerms(daiBondBCV, bondVestingLength, minBondPrice, maxBondPayout, bondFee, maxBondDebt, intialBondDebt);
    await fraxBond.initializeBondTerms(fraxBondBCV, bondVestingLength, minBondPrice, maxBondPayout, bondFee, maxBondDebt, intialBondDebt);

    // Set staking for DAI and Frax bond
    await daiBond.setStaking(staking.address, stakingHelper.address);
    await fraxBond.setStaking(staking.address, stakingHelper.address);

    // Initialize sOHM and set the index
    await sOHM.initialize(staking.address);
    await sOHM.setIndex(initialIndex);

    // set distributor contract and warmup contract
    await staking.setContract('0', distributor.address);
    await staking.setContract('1', stakingWarmup.address);

    // Set treasury for OHM token
    await ohm.setVault(treasury.address);

    // Add staking contract as distributor recipient
    await distributor.addRecipient(staking.address, initialRewardRate);

    // queue and toggle reward manager
    await treasury.queue('8', distributor.address);
    await treasury.toggle('8', distributor.address, zeroAddress);

    // queue and toggle deployer reserve depositor
    await treasury.queue('0', deployer.address);
    await treasury.toggle('0', deployer.address, zeroAddress);

    // queue and toggle liquidity depositor
    await treasury.queue('4', deployer.address, );
    await treasury.toggle('4', deployer.address, zeroAddress);

    // Approve the treasury to spend DAI and Frax
    await dai.approve(treasury.address, largeApproval );
    await frax.approve(treasury.address, largeApproval );

    // Approve dai and frax bonds to spend deployer's DAI and Frax
    await dai.approve(daiBond.address, largeApproval );
    await frax.approve(fraxBond.address, largeApproval );

    // Approve staking and staking helper contact to spend deployer's OHM
    await ohm.approve(staking.address, largeApproval);
    await ohm.approve(stakingHelper.address, largeApproval);

    // Deposit 9,000,000 DAI to treasury, 600,000 OHM gets minted to deployer and 8,400,000 are in treasury as excesss reserves
    await treasury.deposit('9000000000000000000000000', dai.address, '8400000000000000');

    // Deposit 5,000,000 Frax to treasury, all is profit and goes as excess reserves
    await treasury.deposit('5000000000000000000000000', frax.address, '5000000000000000');

    // Stake OHM through helper
    await stakingHelper.stake('100000000000');

    // Bond 1,000 OHM and Frax in each of their bonds
    await daiBond.deposit('1000000000000000000000', '60000', deployer.address );
    await fraxBond.deposit('1000000000000000000000', '60000', deployer.address );

    console.log(" ohm.balanceOf",String(await ohm.balanceOf(deployer.address)) )
    console.log(" dai.balanceOf",String(await dai.balanceOf(deployer.address)) )
    console.log(" frax.balanceOf",String(await frax.balanceOf(deployer.address)) )

    //dai, frax - ohm add liquidity
    {
        
		tx = await ohm.approve(exchangeRouter.address,ethers.utils.parseUnits("100000000",9));
		await tx.wait();
        tx = await dai.approve(exchangeRouter.address,ethers.utils.parseUnits("1000000",18));
		await tx.wait();
		tx = await frax.approve(exchangeRouter.address,ethers.utils.parseUnits("1000000",18));
		await tx.wait();
        //DAI
        var tx = await exchangeRouter.addLiquidity(
			ohm.address,
			dai.address,
			ethers.utils.parseUnits("100000",9),
			ethers.utils.parseUnits("800000",18),
			0,
			0,
			deployer.address,
			"111111111111111111111"
		);
		await tx.wait();

        var daiLP = await exchangeFactory.getPair(ohm.address,dai.address);

        //frax
        var tx = await exchangeRouter.addLiquidity(
			ohm.address,
			frax.address,
			ethers.utils.parseUnits("100000",9),
			ethers.utils.parseUnits("800000",18),
			0,
			0,
			deployer.address,
			"111111111111111111111"
		);
		await tx.wait();
        
        var fraxLP = await exchangeFactory.getPair(ohm.address,dai.address);
    }

    console.log( "DAI_ADDRESS: ",dai.address);
    console.log( "OHM_ADDRESS: ",ohm.address);
    console.log( "STAKING_ADDRESS: ",staking.address);
    console.log( "STAKING_HELPER_ADDRESS: ",stakingHelper.address);
    console.log( "SOHM_ADDRESS: ",sOHM.address);
    console.log( "DISTRIBUTOR_ADDRESS: ",distributor.address);
    console.log( "BONDINGCALC_ADDRESS: ",olympusBondingCalculator.address);
    console.log( "TREASURY_ADDRESS: ",treasury.address);

    console.log( "bondAddress: ",daiBond.address);
    console.log( "reserveAddress: ",daiLP);
    console.log( "bondAddress: ",fraxBond.address);
    console.log( "reserveAddress: ",fraxLP);

    console.log( "OHM: " + ohm.address );
    console.log( "DAI: " + dai.address );
    console.log( "Frax: " + frax.address );
    console.log( "Treasury: " + treasury.address );
    console.log( "Calc: " + olympusBondingCalculator.address );
    console.log( "Staking: " + staking.address );
    console.log( "sOHM: " + sOHM.address );
    console.log( "Distributor: " + distributor.address);
    console.log( "Staking Wawrmup: " + stakingWarmup.address);
    console.log( "Staking Helper: " + stakingHelper.address);
    console.log("DAI Bond: " + daiBond.address);
    console.log("Frax Bond: " + fraxBond.address);
}

main()
    .then(() => process.exit())
    .catch(error => {
        console.error(error);
        process.exit(1);
})