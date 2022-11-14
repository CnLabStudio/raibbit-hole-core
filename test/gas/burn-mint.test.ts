import { expect } from "chai";
import { ethers, network } from "hardhat";
import { GalaxyFrensV1, GalaxyFrens } from "../../build/typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { config as dotenvConfig } from "dotenv"
import { resolve } from "path"
import * as config from "../../config/env.json"

dotenvConfig({ path: resolve(__dirname, "../../.env") })

describe("GalaxyFrens", function () {
    let frensV1: GalaxyFrensV1;
    let frensV2: GalaxyFrens;
    let addrs: SignerWithAddress[];
    let gfHolder: SignerWithAddress;

    function range(size: number, startAt = 0) {
        return [...Array(size).keys()].map(i => i + startAt);
    }

    before(async function () {
        addrs = await ethers.getSigners();

        const frensContractV1 = await ethers.getContractFactory("GalaxyFrensV1", addrs[0]);
        frensV1 = frensContractV1.attach(`${config.Address.GFMainnet}`);

        const frensContractV2 = await ethers.getContractFactory("GalaxyFrens", addrs[0]);
        frensV2 = await frensContractV2.deploy();

        const gfHolderAddr = config.Address.GFHolder;
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [gfHolderAddr],
        });

        network.provider.request({
            method: 'hardhat_setBalance', 
            params: [gfHolderAddr, ethers.utils.parseEther('10.0').toHexString()] 
        });

        gfHolder = await ethers.getSigner(gfHolderAddr);
    });

    describe("Reveal", function () {
        it("happy path", async function() {
            const frensV1Balance = await frensV1.balanceOf(gfHolder.address);
            expect(frensV1Balance).to.be.equal('200');

            await frensV1.connect(gfHolder).setApprovalForAll(frensV2.address, true);

            const revealSize = 40;
            await frensV2.connect(gfHolder).reveal(range(revealSize, 1800));
            const frensV2Balance = await frensV2.balanceOf(gfHolder.address);
            expect(frensV2Balance).to.be.equal(revealSize);
        });
    });
});