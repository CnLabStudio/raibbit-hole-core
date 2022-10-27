import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { RAIbbitHoleTicket, RugPullFrens } from "../../build/typechain"
import * as config from "../../config/env.json"

describe("Diamond Tickets", function () {
  let ticket: RAIbbitHoleTicket;
  let rpf: RugPullFrens;
  let addrs: SignerWithAddress[];
  let rpfOwner: SignerWithAddress;
  let initTime: number;

  before(async () => {
    addrs = await ethers.getSigners();

    const ticketContract = await ethers.getContractFactory("RAIbbitHoleTicket", addrs[0]);
    ticket = await ticketContract.deploy(650, "");
  });

  describe("Set Metadata and Infos", function () {
    it("happy path - supportsInterface", async function () {
      const erc1155Id = await ticket.supportsInterface("0xd9b67a26");
      expect(erc1155Id).to.be.true;
  
      const erc2981Id = await ticket.supportsInterface("0x2a55205a");
      expect(erc2981Id).to.be.true;
    });
    
    it("happy path - tokenURI", async function () {
      await ticket.giveawayTicket(addrs[0].address, 100);
  
      const total = await ticket.totalSupply();
      expect(total.toNumber()).to.be.equal(100);

      await ticket.setBaseURI("https://test");
      let tokenURI = await ticket.uri(0);
      expect(tokenURI).to.be.equal("https://test");
      tokenURI = await ticket.uri(1);
      expect(tokenURI).to.be.equal("https://test");
    });

    it("only owner - tokenURI", async function () {
      const tx = ticket.connect(addrs[1]).setBaseURI("https://test");
      await expect(tx).to.be.rejectedWith('Ownable: caller is not the owner');

      await ticket.setBaseURI("https://test2");
      let tokenURI = await ticket.uri(0);
      expect(tokenURI).to.be.equal("https://test2");
      tokenURI = await ticket.uri(1);
      expect(tokenURI).to.be.equal("https://test2");
    });

    it("only owner - set royalty", async function() {
        let tx = ticket.connect(addrs[1]).setDefaultRoyalty(addrs[0].address, 650);
        await expect(tx).to.be.rejectedWith('Ownable: caller is not the owner');

        tx = ticket.connect(addrs[1]).setTokenRoyalty(2, addrs[0].address, 650);
        await expect(tx).to.be.rejectedWith('Ownable: caller is not the owner');

        let royalty = await ticket.royaltyInfo(1, ethers.utils.parseEther('1'));
        expect(royalty[1]).to.be.equal(ethers.utils.parseEther('0.065'));

        await ticket.setTokenRoyalty(2, addrs[0].address, 1000);

        royalty = await ticket.royaltyInfo(2, ethers.utils.parseEther('1'));
        expect(royalty[1]).to.be.equal(ethers.utils.parseEther('0.1'));

        await ticket.setDefaultRoyalty(addrs[0].address, 9999);
        royalty = await ticket.royaltyInfo(1, ethers.utils.parseEther('1'));
        expect(royalty[1]).to.be.equal(ethers.utils.parseEther('0.9999'));
    });
  });
});