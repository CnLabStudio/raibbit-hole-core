import { expect } from "chai";
import { ethers, network } from "hardhat";
import { GalaxyFrens } from "../../build/typechain";
import { Wallet } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { config as dotenvConfig } from "dotenv"
import { resolve } from "path"
import * as config from "../../config/env.json"

dotenvConfig({ path: resolve(__dirname, "../../.env") })

describe("GalaxyFrens", function () {
    let frens: GalaxyFrens;
    let addrs: SignerWithAddress[];
    let rpfOwner: Wallet;
    let initTime: number;

    async function genSign(signer: any, address: string, maxMintableAmount: number) {
        const messageHash = ethers.utils.solidityKeccak256([ "address", "uint256" ], [ address, maxMintableAmount ]);
        const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
        return signature
    }

    async function getCurTime() {
        const blockNum = await ethers.provider.getBlockNumber();
        const curTime = (await ethers.provider.getBlock(blockNum)).timestamp;
        return curTime;
    }

    before(async function () {
        addrs = await ethers.getSigners();

        const frensContract = await ethers.getContractFactory("GalaxyFrens", addrs[0]);
        frens = await frensContract.deploy(650, "https://api.raibbithole.xyz/metadata/");

        const rpfOwnerAddr = config.Address.RPFDeployer;
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [rpfOwnerAddr],
        });

        rpfOwner = new ethers.Wallet(`${process.env.PROJECT_PK}`, ethers.provider);
    });

    describe("Giveaway", function () {
        it("happy path", async function() {
            await frens.mintGiveawayFrens(addrs[0].address, 100);
            await frens.mintGiveawayFrens(addrs[1].address, 100);
      
            const frensBalance = await frens.balanceOf(addrs[0].address);
            expect(frensBalance).to.be.equal('100');
            const totalFrens = await frens.totalSupply();
            expect(totalFrens).to.be.equal('200');
        });

        it("only authorized", async function() {
            let tx = frens.connect(addrs[1]).mintGiveawayFrens(addrs[1].address, 100);
            await expect(tx).to.be.rejectedWith("Unauthorized()");
      
            tx = frens.connect(addrs[1]).setAuthorizer(addrs[1].address, true);
            await expect(tx).to.be.rejectedWith("Ownable: caller is not the owner");
      
            await frens.setAuthorizer(addrs[1].address, true);
            await frens.connect(addrs[1]).mintGiveawayFrens(addrs[1].address, 100);

            await frens.setAuthorizer(addrs[1].address, false);
            tx = frens.connect(addrs[1]).mintGiveawayFrens(addrs[1].address, 100);
            await expect(tx).to.be.rejectedWith("Unauthorized()");
      
            const frensBalance = await frens.balanceOf(addrs[1].address);
            expect(frensBalance).to.be.equal('200');
            const totalFrens = await frens.totalSupply();
            expect(totalFrens).to.be.equal('300');
        });
    });

    describe("RPF Holders Mint", function () {
        it("mint phase unset", async function() {
            const sign = await genSign(rpfOwner, addrs[1].address, 10);
            const tx = frens.connect(addrs[1]).mintRPFHoldersFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("InvalidTime()");
        });

        it("only owner - set rpf holders mint", async function () {
            initTime = await getCurTime();
            let tx = frens.connect(addrs[1]).setRPFHoldersMintPhase(initTime+3, initTime+5);
            await expect(tx).to.be.rejectedWith("Unauthorized()");

            await frens.setAuthorizer(addrs[1].address, true);
            await frens.connect(addrs[1]).setRPFHoldersMintPhase(initTime+3, initTime+5);

            await frens.setAuthorizer(addrs[1].address, false);
            tx = frens.connect(addrs[1]).setRPFHoldersMintPhase(initTime+3, initTime+5);
            await expect(tx).to.be.rejectedWith("Unauthorized()");
        });

        it("invalid mint time - set rpf holders mint", async function () {
            initTime = await getCurTime();
            const tx = frens.setRPFHoldersMintPhase(initTime+5, initTime+3);
            await expect(tx).to.be.rejectedWith("InvalidInput()");
        });

        it("before mint time", async function () {
            initTime = await getCurTime();
            await frens.setRPFHoldersMintPhase(initTime+3, initTime+5);
      
            const sign = await genSign(addrs[0], addrs[1].address, 10);
      
            const tx = frens.connect(addrs[1]).mintRPFHoldersFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("InvalidTime()");
        });

        it("happy path", async function () {
            initTime = await getCurTime();
            await frens.setRPFHoldersMintPhase(initTime, initTime+100);
            const sign = await genSign(rpfOwner, addrs[1].address, 10);
      
            await frens.connect(addrs[1]).mintRPFHoldersFrens(1, 10, sign);
      
            const totalFrens = await frens.totalSupply();
            expect(totalFrens).to.be.equal('301');
            const frensBalance = await frens.balanceOf(addrs[1].address);
            expect(frensBalance).to.be.equal('201');
            const tokensList = await frens.tokensOfOwner(addrs[1].address, 200, 200);
            expect(tokensList[tokensList.length-1]).to.be.equal('300');
        });

        it("exceed amount", async function () {
            const sign = await genSign(rpfOwner, addrs[1].address, 10);
      
            await frens.connect(addrs[1]).mintRPFHoldersFrens(9, 10, sign);
      
            const tx = frens.connect(addrs[1]).mintRPFHoldersFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("NotEnoughQuota()");
        });

        it("change signer", async function () {
            let sign = await genSign(rpfOwner, addrs[1].address, 20);
      
            await frens.setSignerRPF(addrs[1].address);
            const tx = frens.connect(addrs[1]).mintRPFHoldersFrens(1, 20, sign);
            await expect(tx).to.be.rejectedWith("InvalidSignature()");

            sign = await genSign(addrs[1], addrs[1].address, 20);
            await frens.connect(addrs[1]).mintRPFHoldersFrens(10, 20, sign);

            const frensBalance = await frens.balanceOf(addrs[1].address);
            expect(frensBalance).to.be.equal('220');
        });

        it("change signer - only owner", async function () {
            let tx = frens.connect(addrs[1]).setSignerRPF(rpfOwner.address);
            await expect(tx).to.be.rejectedWith("Ownable: caller is not the owner");

            tx = frens.connect(addrs[1]).setSignerGF(rpfOwner.address);
            await expect(tx).to.be.rejectedWith("Ownable: caller is not the owner");

            await frens.setSignerRPF(rpfOwner.address);
            expect(await frens.signerRPF()).to.be.equal(rpfOwner.address);

            await frens.setSignerGF(rpfOwner.address);
            expect(await frens.signerGF()).to.be.equal(rpfOwner.address);
            await frens.setSignerGF(addrs[0].address);
            expect(await frens.signerGF()).to.be.equal(addrs[0].address);
        });

        it("change signer - zero address", async function () {
            let tx = frens.setSignerRPF(ethers.constants.AddressZero);
            await expect(tx).to.be.rejectedWith("ZeroAddress()");

            tx = frens.setSignerGF(ethers.constants.AddressZero);
            await expect(tx).to.be.rejectedWith("ZeroAddress()");
        });

        it("invalid time", async function () {
            const curTime = await getCurTime();
            await network.provider.send("evm_increaseTime", [100-(curTime-initTime)]);
            await network.provider.send("evm_mine");
      
            const sign = await genSign(rpfOwner, addrs[1].address, 10);
      
            const tx = frens.connect(addrs[1]).mintRPFHoldersFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("InvalidTime()");
        });
    });

    describe("Whitelist Mint", function () {
        it("mint phase unset", async function() {
            const sign = await genSign(addrs[0], addrs[1].address, 10);
            const tx = frens.connect(addrs[1]).mintWhitelistFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("InvalidTime()");
        });

        it("only owner - set whitelist mint", async function () {
            initTime = await getCurTime();
            let tx = frens.connect(addrs[1]).setWhitelistMintPhase(initTime+3, initTime+5);
            await expect(tx).to.be.rejectedWith("Unauthorized()");

            await frens.setAuthorizer(addrs[1].address, true);
            await frens.connect(addrs[1]).setWhitelistMintPhase(initTime+3, initTime+5);

            await frens.setAuthorizer(addrs[1].address, false);
            tx = frens.connect(addrs[1]).setWhitelistMintPhase(initTime+3, initTime+5);
            await expect(tx).to.be.rejectedWith("Unauthorized()");
        });

        it("invalid mint time - set whitelist mint", async function () {
            initTime = await getCurTime();
            const tx = frens.setWhitelistMintPhase(initTime+5, initTime+3);
            await expect(tx).to.be.rejectedWith("InvalidInput()");
        });

        it("before mint time", async function () {
            initTime = await getCurTime();
            await frens.setWhitelistMintPhase(initTime+3, initTime+5);
      
            const sign = await genSign(addrs[0], addrs[1].address, 10);
      
            const tx = frens.connect(addrs[1]).mintWhitelistFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("InvalidTime()");
        });

        it("happy path", async function () {
            initTime = await getCurTime();
            await frens.setWhitelistMintPhase(initTime, initTime+100);
            const sign = await genSign(addrs[0], addrs[1].address, 10);
      
            await frens.connect(addrs[1]).mintWhitelistFrens(1, 10, sign);
      
            const totalFrens = await frens.totalSupply();
            expect(totalFrens).to.be.equal('321');
            const frensBalance = await frens.balanceOf(addrs[1].address);
            expect(frensBalance).to.be.equal('221');
            const tokensList = await frens.tokensOfOwner(addrs[1].address, 220, 220);
            expect(tokensList[tokensList.length-1]).to.be.equal('320');
        });

        it("exceed amount", async function () {
            const sign = await genSign(addrs[0], addrs[1].address, 10);
      
            await frens.connect(addrs[1]).mintWhitelistFrens(9, 10, sign);
      
            const tx = frens.connect(addrs[1]).mintWhitelistFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("NotEnoughQuota()");
        });

        it("change signer", async function () {
            let sign = await genSign(addrs[0], addrs[1].address, 20);
      
            await frens.setSignerGF(addrs[1].address);
            const tx = frens.connect(addrs[1]).mintWhitelistFrens(1, 20, sign);
            await expect(tx).to.be.rejectedWith("InvalidSignature()");

            sign = await genSign(addrs[1], addrs[1].address, 20);
            await frens.connect(addrs[1]).mintWhitelistFrens(10, 20, sign);

            const frensBalance = await frens.balanceOf(addrs[1].address);
            expect(frensBalance).to.be.equal('240');
        });

        it("invalid time", async function () {
            const curTime = await getCurTime();
            await network.provider.send("evm_increaseTime", [100-(curTime-initTime)]);
            await network.provider.send("evm_mine");
      
            const sign = await genSign(addrs[0], addrs[1].address, 10);
      
            const tx = frens.connect(addrs[1]).mintWhitelistFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("InvalidTime()");
        });
    });

    describe("Public Mint", function () {
        it("mint phase unset", async function() {
            const tx = frens.connect(addrs[1]).mintPublicFrens(10);
            await expect(tx).to.be.rejectedWith("InvalidTime()");
        });

        it("only owner - set public mint", async function () {
            initTime = await getCurTime();
            let tx = frens.connect(addrs[1]).setPublicMintPhase(initTime+3, initTime+5);
            await expect(tx).to.be.rejectedWith("Unauthorized()");

            await frens.setAuthorizer(addrs[1].address, true);
            await frens.connect(addrs[1]).setPublicMintPhase(initTime+3, initTime+5);

            await frens.setAuthorizer(addrs[1].address, false);
            tx = frens.connect(addrs[1]).setPublicMintPhase(initTime+3, initTime+5);
            await expect(tx).to.be.rejectedWith("Unauthorized()");
        });

        it("invalid mint time - set public mint", async function () {
            initTime = await getCurTime();
            const tx = frens.setPublicMintPhase(initTime+5, initTime+3);
            await expect(tx).to.be.rejectedWith("InvalidInput()");
        });

        it("before mint time", async function () {
            initTime = await getCurTime();
            await frens.setPublicMintPhase(initTime+3, initTime+5);
      
            const tx = frens.connect(addrs[1]).mintPublicFrens(10);
            await expect(tx).to.be.rejectedWith("InvalidTime()");
        });

        it("happy path", async function () {
            initTime = await getCurTime();
            await frens.setPublicMintPhase(initTime, initTime+100);
      
            await frens.connect(addrs[1]).mintPublicFrens(10);
      
            const totalFrens = await frens.totalSupply();
            expect(totalFrens).to.be.equal('350');
            const frensBalance = await frens.balanceOf(addrs[1].address);
            expect(frensBalance).to.be.equal('250');
            const tokensList = await frens.tokensOfOwner(addrs[1].address, 249, 249);
            expect(tokensList[tokensList.length-1]).to.be.equal('349');
        });

        it("invalid time", async function () {
            const curTime = await getCurTime();
            await network.provider.send("evm_increaseTime", [100-(curTime-initTime)]);
            await network.provider.send("evm_mine");
      
            const tx = frens.connect(addrs[1]).mintPublicFrens(10);
            await expect(tx).to.be.rejectedWith("InvalidTime()");
        });
    });

    describe("Signature", function () {
        it("wrong amount - rpf holder", async function () {
            initTime = await getCurTime();
            await frens.setRPFHoldersMintPhase(initTime, initTime+100);
            const sign = await genSign(rpfOwner, addrs[1].address, 10);
      
            const tx = frens.connect(addrs[1]).mintRPFHoldersFrens(1, 20, sign);
            await expect(tx).to.be.rejectedWith("InvalidSignature()");
        });

        it("invalid signer - rpf holder", async function () {
            const sign = await genSign(addrs[1], addrs[1].address, 10);
      
            const tx = frens.connect(addrs[1]).mintRPFHoldersFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("InvalidSignature()");
        });

        it("wrong amount - whitelist", async function () {
            initTime = await getCurTime();
            await frens.setWhitelistMintPhase(initTime, initTime+100);
            const sign = await genSign(addrs[1], addrs[1].address, 10);
      
            const tx = frens.connect(addrs[1]).mintWhitelistFrens(1, 20, sign);
            await expect(tx).to.be.rejectedWith("InvalidSignature()");
        });

        it("invalid signer - whitelist", async function () {
            const sign = await genSign(rpfOwner, addrs[1].address, 10);
      
            const tx = frens.connect(addrs[1]).mintWhitelistFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("InvalidSignature()");
        });
    });

    describe("Max Amount", function () {
        it("rpf holders", async function() {
            await frens.mintGiveawayFrens(addrs[2].address, 550);
            expect(await frens.totalSupply()).to.be.equal('900');

            initTime = await getCurTime();
            await frens.setRPFHoldersMintPhase(initTime, initTime+100);
            const sign = await genSign(rpfOwner, addrs[1].address, 10);
      
            const tx = frens.connect(addrs[1]).mintRPFHoldersFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("ExceedAmount()");
        });

        it("public - per tx", async function() {
            initTime = await getCurTime();
            await frens.setPublicMintPhase(initTime, initTime+100);
      
            let tx = frens.connect(addrs[1]).mintPublicFrens(20);
            await expect(tx).to.be.rejectedWith("ExceedAmount()");
            await frens.connect(addrs[1]).mintPublicFrens(10);
        });

        it("whitelist", async function() {
            await frens.mintGiveawayFrens(addrs[2].address, 890);
            expect(await frens.totalSupply()).to.be.equal('1800');

            initTime = await getCurTime();
            await frens.setWhitelistMintPhase(initTime, initTime+100);
            const sign = await genSign(addrs[0], addrs[1].address, 10);
      
            const tx = frens.connect(addrs[1]).mintWhitelistFrens(1, 10, sign);
            await expect(tx).to.be.rejectedWith("ExceedAmount()");
        });

        it("public", async function() {
            initTime = await getCurTime();
            await frens.setPublicMintPhase(initTime, initTime+100);
      
            let tx = frens.connect(addrs[1]).mintPublicFrens(10);
            await expect(tx).to.be.rejectedWith("ExceedAmount()");
        });

        it("giveaway", async function() {
            await frens.mintGiveawayFrens(addrs[2].address, 200);
            expect(await frens.totalSupply()).to.be.equal('2000');

            const tx = frens.mintGiveawayFrens(addrs[2].address, 1);
            await expect(tx).to.be.rejectedWith("ExceedAmount()");
        });
    });
});
