import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

// The most common OAuth scope naming conventions Amazon uses
const SCOPES_TO_TEST = [
    'creatorsapi',
    'creators_api',
    'creators',
    'associates',
    'paapi',
    'paapi5',
    'product_advertising_api',
    'catalog',
    'profile',
    'amazon::associates',
    'amazon::creatorsapi'
];

async function runBruteForce() {
    console.log(`\n🕵️ Initiating Brute Force Scope Tester...`);

    const clientId = process.env.AMAZON_CREDENTIAL_ID.trim();
    const clientSecret = process.env.AMAZON_CREDENTIAL_SECRET.trim();
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    for (const scope of SCOPES_TO_TEST) {
        process.stdout.write(`Testing scope: "${scope}"... `);
        
        const bodyParams = new URLSearchParams({
            grant_type: 'client_credentials',
            scope: scope
        });
        
        const response = await fetch('https://api.amazon.com/auth/o2/token', {
            method: 'POST',
            headers: { 
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
            body: bodyParams.toString()
        });

        if (response.ok) {
            console.log(`✅ SUCCESS!`);
            console.log(`\n🎉 The correct scope is: ${scope}`);
            console.log(`You can now plug "${scope}" back into our main script!`);
            return;
        } else {
            console.log(`❌ Failed`);
        }
    }

    console.log(`\n⚠️ None of the guessed scopes worked.`);
    console.log(`💡 THE CHEAT CODE: Since you have access to the Amazon portal, download the "creatorsapi-nodejs-sdk" zip file they mention in the docs. If you extract it and open the code in VS Code, do a project-wide search for "scope". The exact string Amazon wants will be hardcoded right there in their auth files!`);
}

runBruteForce();