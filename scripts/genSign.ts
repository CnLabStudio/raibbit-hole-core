import 'dotenv/config';
import * as fs from "fs";
import * as path from "path";
import progress from 'cli-progress';
import { ethers } from "hardhat";

type Whitelist = {
  address: string;
  quantity: number;
};

async function genSign(signer: any, address: string, maxMintableAmount: number) {
  const messageHash = ethers.utils.solidityKeccak256([ "address", "uint256" ], [ address, maxMintableAmount ]);
  const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
  return signature
}

async function main() {
  let addrs = await ethers.getSigners();
  console.log("Owner account:", addrs[0].address);
  console.log("Account balance:", (await addrs[0].getBalance()).toString());

  const result = [];
  const jsonPath = path.resolve(__dirname, '../data/snapshot1024.json');
  const outPath = path.resolve(__dirname, '../data/whitelist1025.json');

  const rawData = fs.readFileSync(jsonPath,{encoding:'utf8', flag:'r'});
  const snapshot = JSON.parse(rawData);
  const allWhitelist = snapshot["holdersList"].length;

  const bar1 = new progress.SingleBar({}, progress.Presets.shades_classic);
  bar1.start(allWhitelist,0);
  for(let i=0; i<allWhitelist; i++) {
    bar1.increment();
    const user = snapshot["holdersList"][i] as Whitelist;
    let signature: string;
    let amount: number;
    if (user["quantity"]<4) {
      amount = 1;
      signature = await genSign(addrs[0], user["address"], 1);
    } else if(user["quantity"]<8) {
      amount = 4;
      signature = await genSign(addrs[0], user["address"], 4);
    } else {
      amount = 8;
      signature = await genSign(addrs[0], user["address"], 8);
    }
    
    result.push({
      address: user["address"],
      amount: amount,
      signature: signature
    })
  }
  bar1.stop();
  fs.writeFileSync(outPath, JSON.stringify({whitelist: result}));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
});