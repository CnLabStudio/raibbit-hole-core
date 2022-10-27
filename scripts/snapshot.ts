import 'dotenv/config';
import * as fs from "fs";
import * as path from "path";
import progress from 'cli-progress';
import { ethers } from "hardhat";

async function main() {
    const factory = await ethers.getContractFactory("RugPullFrens");
    const erc721 = factory.attach(`${process.env.RPF_MAINNET}`);
    const totalSupply = (await erc721.totalSupply()).toNumber();
    console.log("Token total supply: ", totalSupply);

    const result = [];
    const ownerAddrSet = new Set();
    const outPath = path.resolve(__dirname, '../data/snapshot1024.json');

    const bar1 = new progress.SingleBar({}, progress.Presets.shades_classic);
    bar1.start(totalSupply,0);
    for(let i=0; i<totalSupply; i++) {
        bar1.increment();
        const ownerAddr = await erc721.ownerOf(i+1);
        ownerAddrSet.add(ownerAddr);
    }
    bar1.stop();
    
    const ownerAddrList = Array.from(ownerAddrSet) as string[];
    const bar2 = new progress.SingleBar({}, progress.Presets.shades_classic);
    bar2.start(ownerAddrList.length,0);
    for(let i=0; i<ownerAddrList.length; i++) {
        bar2.increment();
        result.push({
            address: ownerAddrList[i],
            amount: (await erc721.balanceOf(ownerAddrList[i])).toNumber()
        })
    }
    bar2.stop();
    console.log(result);
    fs.writeFile(outPath, JSON.stringify({"holdersList": result}), 
        function (err) {
            if (err) throw err;
            console.log('File is created successfully.');
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});