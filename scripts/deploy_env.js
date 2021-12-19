// @dev. This script will deploy this V1.1 of Olympus. It will deploy the whole ecosystem except for the LP tokens and their bonds. 
// This should be enough of a test environment to learn about and test implementations with the Olympus as of V1.1.
// Not that the every instance of the Treasury's function 'valueOf' has been changed to 'valueOfToken'... 
// This solidity function was conflicting w js object property name

const { ethers } = require("hardhat");
const colors = require('colors');

async function main() {

    const [deployer] = await ethers.getSigners();
    var DAO = {address :process.env.DAO};
    console.log('Deploying contracts with the account: ' + deployer.address);
    console.log('Deploying contracts with the account: ' + DAO.address);

    // exchanger deploy and add liquidity

    const initialMint = '10000000000000000000000000';

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

    // Deploy Frax
    const Frax = await ethers.getContractFactory('FRAX');
    const frax = await Frax.deploy( 0 );
    await frax.deployed();
    
    // Deploy 10,000,000 mock DAI and mock Frax
    await dai.mint( deployer.address, initialMint );
    await frax.mint( deployer.address, initialMint );

    
    console.log(" ohm.balanceOf",String(await ohm.balanceOf(deployer.address)) )
    console.log(" dai.balanceOf",String(await dai.balanceOf(deployer.address)) )
    console.log(" frax.balanceOf",String(await frax.balanceOf(deployer.address)) )

    console.log( "OHM: " + ohm.address );
    console.log( "DAI: " + dai.address );
    console.log( "Frax: " + frax.address );
    console.log( "Router: " + exchangeRouter.address );
    console.log( "Factory: " + exchangeFactory.address );
}

main()
    .then(() => process.exit())
    .catch(error => {
        console.error(error);
        process.exit(1);
})