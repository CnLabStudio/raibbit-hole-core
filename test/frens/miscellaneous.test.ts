import { expect } from "chai";
import { ethers, network } from "hardhat";
import { GalaxyFrens } from "../../build/typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { config as dotenvConfig } from "dotenv"
import { resolve } from "path"

dotenvConfig({ path: resolve(__dirname, "../../.env") })

describe("GalaxyFrens", function () {
  let frens: GalaxyFrens;
  let addrs: SignerWithAddress[];

  async function getCurTime() {
    const blockNum = await ethers.provider.getBlockNumber();
    const curTime = (await ethers.provider.getBlock(blockNum)).timestamp;
    return curTime;
  }

  before(async () => {
    addrs = await ethers.getSigners();

    const frensContract = await ethers.getContractFactory("GalaxyFrens", addrs[0]);
    frens = await frensContract.deploy(650, "https://api.raibbithole.xyz/metadata/");
  });

  describe("Miscellaneous", function () {
    describe("supportsInterface", function () {
      it("happy path", async function () {
        const erc165Id = await frens.supportsInterface("0x01ffc9a7");
        expect(erc165Id).to.be.true;
    
        const erc721Id = await frens.supportsInterface("0x80ac58cd");
        expect(erc721Id).to.be.true;
    
        const erc721MetaId = await frens.supportsInterface("0x5b5e139f");
        expect(erc721MetaId).to.be.true;
  
        const erc721EnumId = await frens.supportsInterface("0x780e9d63");
        expect(erc721EnumId).to.be.true;
    
        const erc2981Id = await frens.supportsInterface("0x2a55205a");
        expect(erc2981Id).to.be.true;
      });
    });

    describe("tokenURI", function () {
      it("happy path", async function () {
        await frens.mintGiveawayFrens(addrs[0].address, 1);
    
        const total = await frens.totalSupply();
        expect(total).to.be.equal(1);
  
        await frens.setBaseURI("https://test/");
        let tokenURI = await frens.tokenURI(0);
        expect(tokenURI).to.be.equal("https://test/0");
      });
  
      it("only owner", async function () {
        const tx = frens.connect(addrs[1]).setBaseURI("https://test");
        await expect(tx).to.be.rejectedWith('Ownable: caller is not the owner');
  
        await frens.setBaseURI("https://test2/");
        const tokenURI = await frens.tokenURI(0);
        expect(tokenURI).to.be.equal("https://test2/0");
      });
  
      it("token not exist", async function () {
        const tx = frens.connect(addrs[1]).setBaseURI("https://test");
        await expect(tx).to.be.rejectedWith('Ownable: caller is not the owner');
  
        await frens.setBaseURI("https://test2/");
        const tokenURI = await frens.tokenURI(0);
        expect(tokenURI).to.be.equal("https://test2/0");
        await expect(frens.tokenURI(1)).to.be.rejectedWith("TokenNotExist()");
      });
    });

    describe("set royalty", function () {
      it("only owner", async function() {
        let tx = frens.connect(addrs[1]).setDefaultRoyalty(addrs[0].address, 650);
        await expect(tx).to.be.rejectedWith('Ownable: caller is not the owner');

        tx = frens.connect(addrs[1]).setTokenRoyalty(2, addrs[0].address, 650);
        await expect(tx).to.be.rejectedWith('Ownable: caller is not the owner');

        let royalty = await frens.royaltyInfo(1, ethers.utils.parseEther('1'));
        expect(royalty[1]).to.be.equal(ethers.utils.parseEther('0.065'));

        await frens.setTokenRoyalty(2, addrs[0].address, 1000);

        royalty = await frens.royaltyInfo(2, ethers.utils.parseEther('1'));
        expect(royalty[1]).to.be.equal(ethers.utils.parseEther('0.1'));

        await frens.setDefaultRoyalty(addrs[0].address, 9999);
        royalty = await frens.royaltyInfo(1, ethers.utils.parseEther('1'));
        expect(royalty[1]).to.be.equal(ethers.utils.parseEther('0.9999'));
      });
    });

    describe("set token status", function (){
      it("happy Path", async function() {
        await frens.mintGiveawayFrens(addrs[1].address, 10);
        const total = await frens.totalSupply();
        expect(total).to.be.equal(11);

        await frens.connect(addrs[1]).transferFrom(addrs[1].address, addrs[3].address, 1);
        expect((await frens.balanceOf(addrs[1].address))).to.be.equal("9");
        expect((await frens.balanceOf(addrs[3].address))).to.be.equal("1");

        await frens.setTokenInvalid(2);
        expect((await frens.getTokenValidStatus(2))).to.be.true;
        
        let tx = frens.connect(addrs[1]).transferFrom(addrs[1].address, addrs[3].address, 2);
        await expect(tx).to.be.rejectedWith("InvalidToken()");

        await frens.setTokenValid(2);
        expect((await frens.getTokenValidStatus(2))).to.be.false;

        await frens.connect(addrs[1]).transferFrom(addrs[1].address, addrs[3].address, 2);
        expect((await frens.balanceOf(addrs[1].address))).to.be.equal("8");
        expect((await frens.balanceOf(addrs[3].address))).to.be.equal("2");
      });

      it("only owner", async function() {
        let tx = frens.connect(addrs[1]).setTokenInvalid(3);
        await expect(tx).to.be.rejectedWith('Ownable: caller is not the owner');
        
        await frens.connect(addrs[0]).setTokenInvalid(3);
        expect((await frens.getTokenValidStatus(3))).to.be.true;
          
        tx = frens.connect(addrs[1]).transferFrom(addrs[1].address, addrs[3].address, 3);
        await expect(tx).to.be.rejectedWith("InvalidToken()");

        tx = frens.connect(addrs[1]).setTokenValid(3);
        await expect(tx).to.be.rejectedWith('Ownable: caller is not the owner');

        await frens.connect(addrs[0]).setTokenValid(3);
        expect((await frens.getTokenValidStatus(3))).to.be.false;

        await frens.connect(addrs[1]).transferFrom(addrs[1].address, addrs[3].address, 3);
        expect((await frens.balanceOf(addrs[1].address))).to.be.equal("7");
        expect((await frens.balanceOf(addrs[3].address))).to.be.equal("3");
      });
    });

    describe("get dreaming", function (){
      it("happy path", async function() {
        const emptyList = await frens.getDreamingPeriodByOwner(addrs[4].address);
        expect(emptyList.length).to.be.equal(0);

        expect((await frens.balanceOf(addrs[1].address))).to.be.equal("7");

        let dreamingPeriod = await frens.getDreamingPeriod(0);
        expect(dreamingPeriod).to.be.equal('0');

        let initTime = await getCurTime();
        
        const tx = frens.connect(addrs[1]).setDreamingInitTime(initTime);
        await expect(tx).to.be.rejectedWith("Ownable: caller is not the owner");
        
        await frens.setDreamingInitTime(initTime+100);
        dreamingPeriod = await frens.getDreamingPeriod(0);
        expect(dreamingPeriod).to.be.equal('0');

        await frens.setDreamingInitTime(initTime);

        await network.provider.send("evm_increaseTime", [100]);
        await network.provider.send("evm_mine");

        dreamingPeriod = await frens.getDreamingPeriod(0);
        expect(dreamingPeriod).to.be.equal('103');
        dreamingPeriod = await frens.getDreamingPeriod(9);
        expect(dreamingPeriod).to.be.equal('103');

        await frens.connect(addrs[1]).transferFrom(addrs[1].address, addrs[3].address, 10);
        expect((await frens.balanceOf(addrs[1].address))).to.be.equal("6");
        expect((await frens.balanceOf(addrs[3].address))).to.be.equal("4");
        await network.provider.send("evm_increaseTime", [100]);
        await network.provider.send("evm_mine");

        let rawDreamingPeriodList = (await frens.getDreamingPeriodByOwner(addrs[3].address)).toString();
        let dreamingPeriodList = rawDreamingPeriodList.split(",");
        expect(dreamingPeriodList[2]).to.be.equal('204');
        expect(dreamingPeriodList[dreamingPeriodList.length-1]).to.be.equal('100');

        dreamingPeriod = await frens.getDreamingPeriod(10);
        expect(dreamingPeriod).to.be.equal('100');
        for(let i=3; i<10; i++) {
            dreamingPeriod = await frens.getDreamingPeriod(i);
            expect(dreamingPeriod).to.be.equal('204');
        }

        await frens.setDreamingInitTime(0);
        await network.provider.send("evm_increaseTime", [123]);
        await network.provider.send("evm_mine");
        for(let i=0; i<10; i++) {
            dreamingPeriod = await frens.getDreamingPeriod(i);
            expect(dreamingPeriod).to.be.equal('0');
        }

        rawDreamingPeriodList = (await frens.getDreamingPeriodByOwner(addrs[1].address)).toString();
        dreamingPeriodList = rawDreamingPeriodList.split(",");
        expect(dreamingPeriodList[0]).to.be.equal('0');
        expect(dreamingPeriodList[dreamingPeriodList.length-1]).to.be.equal('0');
      });
    });

    describe("set mission", async function (){
      it("happy path", async function (){
        let initTime = await getCurTime();
        await frens.setDreamingInitTime(initTime);

        await frens.setMission(addrs[10].address);
        await frens.mintGiveawayFrens(addrs[11].address, 1);
        await frens.connect(addrs[11]).transferFrom(addrs[11].address, addrs[12].address, 11);
        await network.provider.send("evm_increaseTime", [100]);
        await network.provider.send("evm_mine");
        let dreamTime = await frens.getDreamingPeriod(11);
        expect(dreamTime).to.be.equal(100);
        await frens.connect(addrs[12]).transferFrom(addrs[12].address, addrs[10].address, 11);
        await network.provider.send("evm_increaseTime", [100]);
        await network.provider.send("evm_mine");
        dreamTime = await frens.getDreamingPeriod(11);
        expect(dreamTime).to.be.equal(201);
      });

      it("only owner", async function() {
        const tx = frens.connect(addrs[1]).setMission(addrs[10].address);
        await expect(tx).to.be.rejectedWith("Ownable: caller is not the owner");
      });

      it("zero address", async function() {
        const tx = frens.setMission(ethers.constants.AddressZero);
        await expect(tx).to.be.rejectedWith("ZeroAddress()");
      });
    });

    describe("tokensOfOwner", async function() {
      it("zero token", async function() {
        const emptyList = await frens.tokensOfOwner(addrs[15].address, 0, 10);
        expect(emptyList.length).to.be.equal(0);
      });
    });
  });
});