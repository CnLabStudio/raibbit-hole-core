import 'dotenv/config';
import {DynamoDB} from 'aws-sdk';
import * as fs from "fs";
import * as path from "path";

const tableName = `${process.env.AWS_TABLE_NAME}`;
const awsConfig = {
    "region": process.env.AWS_REGION,
    "endpoint": process.env.AWS_ENDPOINT,
    "accessKeyId": process.env.AWS_ACCESSKEYID,
    "secretAccessKey": process.env.AWS_SECRETKEY
};

async function main() {
    const dynamo = new DynamoDB.DocumentClient(awsConfig);

    const jsonPath = path.resolve(__dirname, '../data/whitelist1025.json');
    const rawData = fs.readFileSync(jsonPath,{encoding:'utf8', flag:'r'});
    const snapshot = JSON.parse(rawData);
    const allWhitelist = snapshot["whitelist"].length;

    for(let i=0; i<allWhitelist; i++) {
        const holder = snapshot["whitelist"][i];
        const input = {
            address: holder.address.toLowerCase(),
            maxQuantity: holder.amount,
            signedSinature: holder.signature
        };

        const params: DynamoDB.DocumentClient.PutItemInput = {
            TableName: tableName,
            Item:  input
        };

        try {
            await dynamo.put(params, function(err, data){
                if (err) console.log(err);
                else console.log(i, "Success", data);
            }).promise();
        } catch (err) {
            return err;
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
});