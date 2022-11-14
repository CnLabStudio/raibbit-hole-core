import 'dotenv/config';
import * as fs from "fs";
import * as path from "path";
import progress from 'cli-progress';
import { ethers } from "hardhat";

type Whitelist = {
  address: string;
  amount: number;
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
  const jsonPath = path.resolve(__dirname, '../data/snapshot1023.json');
  const outPath = path.resolve(__dirname, '../data/whitelist1023.json');

  const rawData = fs.readFileSync(jsonPath,{encoding:'utf8', flag:'r'});
  const snapshot = JSON.parse(rawData);
  const allWhitelist = snapshot["holdersList"].length;

  const bar1 = new progress.SingleBar({}, progress.Presets.shades_classic);
  bar1.start(allWhitelist,0);
  for(let i=0; i<allWhitelist; i++) {
    bar1.increment();
    const user = snapshot["holdersList"][i] as Whitelist;
    result.push({
      address: user["address"],
      amount: user["amount"],
      signature: await genSign(addrs[0], user["address"], user["amount"])
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