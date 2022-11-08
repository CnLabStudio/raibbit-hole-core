import { ethers } from "hardhat";

async function main() {
  let addrs = await ethers.getSigners();
  
  console.log("Owner account:", addrs[0].address);
  console.log("Account balance:", (await addrs[0].getBalance()).toString());

  const Frens = await ethers.getContractFactory("GalaxyFrens");
  const frens = await Frens.deploy(650, "https://api.raibbithole.xyz/metadata/");

  await frens.deployed();

  console.log("Token address:", frens.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});