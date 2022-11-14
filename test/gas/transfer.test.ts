import { expect } from "chai";
import { ethers } from "hardhat";
import { GalaxyFrensV1 } from "../../build/typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("GalaxyFrens", function () {
    let frens: GalaxyFrensV1;
    let addrs: SignerWithAddress[];

    before(async function () {
        addrs = await ethers.getSigners();

        const frensContract = await ethers.getContractFactory("GalaxyFrensV1", addrs[0]);
        frens = await frensContract.deploy(650, "https://api.raibbithole.xyz/metadata/");
    });

    describe("Transfer", function () {
        it("happy path", async function() {
            await frens.mintGiveawayFrens(addrs[0].address, 200);
      
            let frensBalance = await frens.balanceOf(addrs[0].address);
            for (let i=0; i<frensBalance.toNumber(); i++) {
                await frens.transferFrom(addrs[0].address, addrs[1].address, i);
            }
            frensBalance = await frens.balanceOf(addrs[1].address);
            expect(frensBalance).to.be.equal('200');
        });
    });
});
