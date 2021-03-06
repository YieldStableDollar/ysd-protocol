const contract = require('@truffle/contract');
const { POOL_START_DATE } = require('./pools');
const knownContracts = require('./known-contracts');

const Cash = artifacts.require('Cash');
const Bond = artifacts.require('Bond');
const SimpleERCFund = artifacts.require('SimpleERCFund');
const Share = artifacts.require('Share');
const IERC20 = artifacts.require('IERC20');
const MockDai = artifacts.require('MockDai');
const MockY3d = artifacts.require('MockY3d');

const SeigniorageOracle = artifacts.require('SeigniorageOracle');
const BondOracle = artifacts.require('BondOracle');
const Boardroom = artifacts.require('Boardroom')
const Treasury = artifacts.require('Treasury')

const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');

const DAY = 86400;
const HOUR = 3600;

const BOND_START_DATE = POOL_START_DATE
const TREASURY_START_DATE = POOL_START_DATE + (0.5 * DAY)

async function migration(deployer, network, accounts) {
  let uniswap, uniswapRouter;
  if (['dev'].includes(network)) {
    console.log('Deploying uniswap on dev network.');
    await deployer.deploy(UniswapV2Factory, accounts[0]);
    uniswap = await UniswapV2Factory.deployed();

    await deployer.deploy(UniswapV2Router02, uniswap.address, accounts[0]);
    uniswapRouter = await UniswapV2Router02.deployed();
  } else {
    uniswap = await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network]);
    uniswapRouter = await UniswapV2Router02.at(knownContracts.UniswapV2Router02[network]);
  }

  const usdt = knownContracts.USDT[network]
    ? await IERC20.at(knownContracts.USDT[network])
    : await MockDai.deployed();

  // 2. provide liquidity to YSD-DAI and YSS-DAI pair
  // if you don't provide liquidity to YSD-DAI and YSS-DAI pair after step 1 and before step 3,
  //  creating Oracle will fail with NO_RESERVES error.
  const unit = web3.utils.toBN(10 ** 18).toString();
  const usdtUnit = web3.utils.toBN(10 ** 6).toString();
  const max = web3.utils.toBN(10 ** 18).muln(10000).toString();

  const cash = await Cash.deployed();
  const share = await Share.deployed();

  console.log('Approving Uniswap on tokens for liquidity');
  // const y3dToken = knownContracts.Y3D[network] ? await IERC20.at(knownContracts.Y3D[network]) : await MockY3d.deployed();

  await Promise.all([
    approveIfNot(cash, accounts[0], uniswapRouter.address, max),
    approveIfNot(share, accounts[0], uniswapRouter.address, max),
    approveIfNot(usdt, accounts[0], uniswapRouter.address, max),
    // approveIfNot(y3dToken, accounts[0], uniswapRouter.address, max),
  ]);

  // WARNING: msg.sender must hold enough DAI to add liquidity to YSD-DAI & YSS-DAI pools
  // otherwise transaction will revert
  console.log('Adding liquidity to pools');
  const [BUSD_YSD_PAIR, BUSD_YSS_PAIR ] = await Promise.all([
    uniswap.getPair(usdt.address, cash.address),
    // uniswap.getPair(busd.address, y3dToken.address),
    uniswap.getPair(usdt.address, share.address)
  ])
  if (BUSD_YSD_PAIR === '0x0000000000000000000000000000000000000000') {
    console.log('Deploying BUSD_YSD_PAIR');
    await uniswapRouter.addLiquidity(
      cash.address, usdt.address, unit, usdtUnit, unit, usdtUnit, accounts[0], deadline(),
    );
  }

  if (BUSD_YSS_PAIR === '0x0000000000000000000000000000000000000000') {
    console.log('Deploying BUSD_YSS_PAIR');
    await uniswapRouter.addLiquidity(
      share.address, usdt.address, unit, usdtUnit, unit, usdtUnit, accounts[0],  deadline(),
    );
  }

  // if (BUSD_Y3D_PAIR === '0x0000000000000000000000000000000000000000') {
  //   console.log('Deploying BUSD_Y3D_PAIR');
  //   await uniswapRouter.addLiquidity(
  //     y3dToken.address, busd.address, unit, unit, unit, unit, accounts[0],  deadline(),
  //   );
  // }

  console.log(`BUSD-YSD pair address: ${await uniswap.getPair(usdt.address, cash.address)}`);
  console.log(`BUSD-YSS pair address: ${await uniswap.getPair(usdt.address, share.address)}`);
  // console.log(`BUSD_Y3D_PAIR pair address: ${await uniswap.getPair(busd.address, y3dToken.address)}`);

  // Deploy boardroom
  await deployer.deploy(Boardroom, cash.address, share.address);

  // 2. Deploy oracle for the pair between bac and busd
  await deployer.deploy(
    BondOracle,
    uniswap.address,
    cash.address,
    usdt.address,
    // _period in 0x3e233a85535d32De0FDeA8510D460c0Aef7fDFeC, likely is 1 hour(60min * 60sec)
    HOUR,
    BOND_START_DATE
  );

  await deployer.deploy(
    SeigniorageOracle,
    uniswap.address,
    cash.address,
    usdt.address,
    DAY,
    TREASURY_START_DATE
  );

  await deployer.deploy(
    Treasury,
    cash.address,
    Bond.address,
    Share.address,
    BondOracle.address, // bond
    SeigniorageOracle.address, // seigniorage
    Boardroom.address,
    SimpleERCFund.address,
    TREASURY_START_DATE,
  );
}

async function approveIfNot(token, owner, spender, amount) {
  const allowance = await token.allowance(owner, spender);
  if (web3.utils.toBN(allowance).gte(web3.utils.toBN(amount))) {
    return;
  }
  await token.approve(spender, amount);
  console.log(` - Approved ${token.symbol ? (await token.symbol()) : token.address}`);
}

function deadline() {
  // 30 minutes
  return Math.floor(new Date().getTime() / 1000) + 1800;
}

module.exports = migration;