import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sdkPath = path.resolve(__dirname, '../../creatorsapi-nodejs-sdk/dist/index.js');

import sdk from '../../creatorsapi-nodejs-sdk/dist/index.js';
const { ApiClient, DefaultApi, GetItemsRequestContent } = sdk;

const apiClient = new ApiClient();
apiClient.credentialId = process.env.AMAZON_CREDENTIAL_ID.trim();
apiClient.credentialSecret = process.env.AMAZON_CREDENTIAL_SECRET.trim();
apiClient.version = process.env.AMZN_VERSION.trim();

const api = new DefaultApi(apiClient);

async function getFullDetails(url) {
    try {
        const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
        if (!asinMatch) return null;
        const asin = asinMatch[1];

		const getItemsRequest = new GetItemsRequestContent();
        // Removed the fallback. It will now strictly use your .env variable.
        getItemsRequest.partnerTag = process.env.AMAZON_PARTNER_TAG.trim();
        getItemsRequest.itemIds = [asin];
        getItemsRequest.marketplace = "www.amazon.com"; 
        getItemsRequest.resources = [
            'itemInfo.title',
            'itemInfo.byLineInfo',
            'offersV2.listings.price'
        ];

        // Add this line to verify exactly what is being sent
        console.log(`Sending API Request for ASIN: ${asin} using Tag: ${getItemsRequest.partnerTag}`);

        const response = await api.getItems("www.amazon.com", getItemsRequest);
        const item = response?.itemsResult?.items?.[0];

        if (!item) {
            console.log(`[Amazon SDK] No item data found for ASIN: ${asin}`);
            return null;
        }

        const name = item.itemInfo?.title?.displayValue || null;
        const brand = item.itemInfo?.byLineInfo?.brand?.displayValue || null;
        const price = item.offersV2?.listings?.[0]?.price?.amount || 0.00;

        return { name, brand, variantName: null, price };

    } catch (error) {
        console.error(`\n[Amazon SDK] FATAL ERROR for ${url}:`);
        
        // The SDK error structure varies, so we attempt to log the most descriptive parts
        if (error.response && error.response.text) {
            console.error("Response Body:", error.response.text);
        } else if (error.body) {
            console.error("Error Body:", error.body);
        } else {
            console.error("Raw Error Object:", error);
        }
        
        console.error("\nTerminating process to prevent cascading failures.");
        process.exit(1);
    }
}

async function getPrice(url) {
    const details = await getFullDetails(url);
    return details ? details.price : null;
}

export { getPrice, getFullDetails };