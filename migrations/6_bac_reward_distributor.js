const { bacPools, INITIAL_YSD_FOR_POOLS } = require('./pools');

// Pools
// deployed first
const Cash = artifacts.require('Cash')
const InitialCashDistributor = artifacts.require('InitialCashDistributor');
const MultiPool = artifacts.require('YSDMultiPool')

// ============ Main Migration ============

module.exports = async (deployer, network, accounts) => {
  const unit = web3.utils.toBN(10 ** 18);
  const initialCashAmount = unit.muln(INITIAL_YSD_FOR_POOLS).toString();

  const cash = await Cash.deployed();
  // const pools = bacPools.map(({contractName}) => artifacts.require(contractName));

  await deployer.deploy(
    InitialCashDistributor,
    cash.address,
    [MultiPool.address],
    // pools.map(p => p.address),
    initialCashAmount,
  );
  const distributor = await InitialCashDistributor.deployed();

  console.log(`Setting distributor to InitialCashDistributor (${distributor.address})`);
  // for await (const poolInfo of pools) {
  //   const pool = await poolInfo.deployed()
  //   await pool.setRewardDistribution(distributor.address);
  // }
  // MultiPool.setRewardDistribution(distributor.address);
  // distributor.
  await cash.mint(distributor.address, initialCashAmount);
  console.log(`Deposited ${INITIAL_YSD_FOR_POOLS} YSD to InitialCashDistributor.`);

  await distributor.distribute();
}
