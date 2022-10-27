import { expect } from "chai";
import { ethers, network } from "hardhat";
import { RAIbbitHoleTicket, RugPullFrens } from "../../build/typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as config from "../../config/env.json"

describe("RAIbbitHoleTicket", function () {
  let ticket: RAIbbitHoleTicket;
  let rpf: RugPullFrens;
  let addrs: SignerWithAddress[];
  let rpfOwner: SignerWithAddress;
  let initTime: number;

  async function getCurTime() {
    const blockNum = await ethers.provider.getBlockNumber();
    const curTime = (await ethers.provider.getBlock(blockNum)).timestamp;
    return curTime;
  }

  before(async function () {
    addrs = await ethers.getSigners();

    const ticketContract = await ethers.getContractFactory("RAIbbitHoleTicket", addrs[0]);
    ticket = await ticketContract.deploy(650, "");

    const rpfOwnerAddr = config.Address.RPFOwner;
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [rpfOwnerAddr],
    });

    rpfOwner = await ethers.getSigner(rpfOwnerAddr);
    await network.provider.send("hardhat_setBalance", [
      rpfOwner.address,
      ethers.utils.parseEther("10").toHexString(),
    ]);

    const rpfContract = await ethers.getContractFactory("RugPullFrens", addrs[0]);
    rpf = rpfContract.attach(config.Address.RPF);
    await rpf.connect(rpfOwner).setPrice(ethers.utils.parseEther("0.00001"));
    if (!(await rpf.connect(rpfOwner).isPublicSaleActive())) {
      await rpf.connect(rpfOwner).setSupply(10000, 10000);
    }

    initTime = await getCurTime();
    await rpf.connect(rpfOwner).setPublicSale(true, initTime-360);
    await rpf.connect(rpfOwner).setIsBurnEnabled(true);
    await rpf.connect(addrs[0]).mintFrens(10, {value: ethers.utils.parseEther("0.0001")});
    await rpf.connect(addrs[1]).mintFrens(10, {value: ethers.utils.parseEther("0.0001")});
  });

  describe("Burn RPF Mint Ticket", function () {
    it("happy path - giveaway", async function() {
      await ticket.giveawayTicket(addrs[0].address, 100);
      await ticket.giveawayTicket(addrs[1].address, 100);

      const ticketBalance = await ticket.balanceOf(addrs[0].address, 0);
      expect(ticketBalance.toString()).to.be.equal('100');
      const totalTicket = await ticket.totalSupply();
      expect(totalTicket.toString()).to.be.equal('200');
    });

    it("mint zero ticket - giveaway", async function() {
      const tx = ticket.giveawayTicket(addrs[0].address, 0);
      await expect(tx).to.be.rejectedWith("InvalidInput()");
    });

    it("only authorized - giveaway", async function() {
      let tx = ticket.connect(addrs[1]).giveawayTicket(addrs[1].address, 100);
      await expect(tx).to.be.rejectedWith("Unauthorized()");

      tx = ticket.connect(addrs[1]).setAuthorizer(addrs[1].address, true);
      await expect(tx).to.be.rejectedWith("Ownable: caller is not the owner");

      await ticket.setAuthorizer(addrs[1].address, true);
      await ticket.connect(addrs[1]).giveawayTicket(addrs[1].address, 100);
      await ticket.setAuthorizer(addrs[1].address, false);

      const ticketBalance = await ticket.balanceOf(addrs[1].address, 0);
      expect(ticketBalance.toString()).to.be.equal('200');
      const totalTicket = await ticket.totalSupply();
      expect(totalTicket.toString()).to.be.equal('300');
    });

    it("only authorized - setPublicMintPhase", async function() {
      const tx = ticket.connect(addrs[1]).setPublicMintPhase(initTime, initTime+360);
      await expect(tx).to.be.rejectedWith("Unauthorized()");

      await ticket.setAuthorizer(addrs[1].address, true);
      await ticket.connect(addrs[1]).setPublicMintPhase(initTime, initTime+360);
      await ticket.setAuthorizer(addrs[1].address, false);
    });

    it("invalid time - setPublicMintPhase", async function() {
      const tx = ticket.setPublicMintPhase(initTime+360, initTime);
      await expect(tx).to.be.rejectedWith("InvalidInput()");
    });

    it("mint before mint time - burn rpf and mint", async function() {
      await ticket.setPublicMintPhase(initTime+350, initTime+360);
      await rpf.setApprovalForAll(ticket.address, true);

      const tx = ticket.mintTicket(3334);
      await expect(tx).to.be.rejectedWith("InvalidTime()");
    });

    it("happy path - setPublicMintPhase", async function() {
      await ticket.setPublicMintPhase(initTime, initTime+360);
    });

    it("happy path - burn rpf and mint", async function() {
      expect((await rpf.balanceOf(addrs[0].address)).toString()).to.be.equal("10");
      let rawTokensOfOwner = (await rpf.tokensOfOwner(addrs[0].address)).toString();
      let tokensOfOwner = rawTokensOfOwner.split(",");
      tokensOfOwner.sort();
      expect(tokensOfOwner[0]).to.be.equal('3334');
      expect(tokensOfOwner[tokensOfOwner.length-1]).to.be.equal('3343');

      await ticket.mintTicket(3334);
      const ticketBalance = await ticket.balanceOf(addrs[0].address, 0);
      expect(ticketBalance).to.be.equal('101');

      expect((await rpf.balanceOf(addrs[0].address)).toString()).to.be.equal("9");
      rawTokensOfOwner = (await rpf.tokensOfOwner(addrs[0].address)).toString();
      tokensOfOwner = rawTokensOfOwner.split(",");
      tokensOfOwner.sort();
      expect(tokensOfOwner[0]).to.be.equal('3335');
      expect(tokensOfOwner[tokensOfOwner.length-1]).to.be.equal('3343');
    });

    it("mint twice - burn rpf and mint", async function() {
      const tx = ticket.mintTicket(3335);
      await expect(tx).to.be.rejectedWith("InvalidAddress()");
    });

    it("exceed max ticket - burn rpf and mint", async function() {
      expect(await rpf.balanceOf(addrs[1].address)).to.be.equal(10);
      let tokensOfOwner = await rpf.tokensOfOwner(addrs[1].address);
      expect(tokensOfOwner[0]).to.be.equal(3344);
      expect(tokensOfOwner[tokensOfOwner.length-1]).to.be.equal(3353);

      await ticket.giveawayTicket(addrs[0].address, 2699);

      await rpf.connect(addrs[1]).setApprovalForAll(ticket.address, true);
      const tx = ticket.connect(addrs[1]).mintTicket(tokensOfOwner[0]);
      await expect(tx).to.be.rejectedWith("ExceedAmount()");
    });

    it("invalid time - burn rpf and mint", async function() {
      const curTime = await getCurTime();

      await network.provider.send("evm_increaseTime", [360-(curTime-initTime)]);
      await network.provider.send("evm_mine");

      let tx = ticket.mintTicket(3336);
      await expect(tx).to.be.rejectedWith("InvalidTime()");

      await ticket.setPublicMintPhase(curTime+3, curTime+100);

      tx = ticket.mintTicket(3336);
      await expect(tx).to.be.rejectedWith("InvalidTime()");
    });
  });
});
