const knownContracts = require('./known-contracts');
const { POOL_START_DATE } = require('./pools');

const Cash = artifacts.require('Cash');
const Share = artifacts.require('Share');
// const Oracle = artifacts.require('Oracle');
const MockDai = artifacts.require('MockDai');
const MockY3d = artifacts.require('MockY3d');
const IERC20 = artifacts.require('IERC20');

const BUSDYSDLPToken_YSSPool = artifacts.require('BUSDYSDLPTokenSharePool')
const BUSDYSSLPToken_YSSPool = artifacts.require('BUSDYSSLPTokenSharePool')
const BUSDY3DLPToken_YSSPool = artifacts.require('BUSDY3DLPTokenSharePool')

const UniswapV2Factory = artifacts.require('UniswapV2Factory');

module.exports = async (deployer, network, accounts) => {
  const uniswapFactory = ['dev'].includes(network)
    ? await UniswapV2Factory.deployed()
    : await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network]);
  const targetedStableCoin = knownContracts.USDT[network]
    ? await IERC20.at(knownContracts.USDT[network])
    : await MockDai.deployed();
  // const Y3D = knownContracts.Y3D[network]
  //   ? await IERC20.at(knownContracts.Y3D[network])
  //   : await MockY3d.deployed();
  // const oracle = await Oracle.deployed();

  // @XXX: remember to switch codehash for Oracle if you switch swap/network
  const [busd_ysd_lpt, busd_yss_lpt, busd_y3d_lpt] = await Promise.all([
    uniswapFactory.getPair(Cash.address, targetedStableCoin.address),
    uniswapFactory.getPair(Share.address, targetedStableCoin.address),
    // uniswapFactory.getPair(targetedStableCoin.address, Y3D.address)
  ])

  await deployer.deploy(BUSDYSDLPToken_YSSPool, Share.address, busd_ysd_lpt, POOL_START_DATE);
  await deployer.deploy(BUSDYSSLPToken_YSSPool, Share.address, busd_yss_lpt, POOL_START_DATE);
  // await deployer.deploy(BUSDY3DLPToken_YSSPool, Share.address, busd_y3d_lpt, POOL_START_DATE);
};
