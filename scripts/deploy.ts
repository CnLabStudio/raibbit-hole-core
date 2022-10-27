import { ethers } from "hardhat";

async function main() {
  let addrs = await ethers.getSigners();
  
  console.log("Owner account:", addrs[0].address);
  console.log("Account balance:", (await addrs[0].getBalance()).toString());

  const Tickets = await ethers.getContractFactory("RAIbbitHoleTicket");
  const ticket = await Tickets.deploy(650, "ipfs://QmanNhSsKqbgkycyHXtbFdrKGBNNm2iXfMrQp8TiApdfeM");

  await ticket.deployed();

  console.log("Token address:", ticket.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});