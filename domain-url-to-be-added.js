import algoliasearch from "algoliasearch";
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;

const client = algoliasearch("ALGOLIA_APP_ID", "ALGOLIA_ADMIN_KEY");

const index = client.initIndex("content2");

const BASE_URL = "https://www.iads.org";

async function fixUrls() {
  const recordsToUpdate = [];

  await index.browseObjects({
    batch: batch => {
      batch.forEach(record => {
        if (record.url && !record.url.startsWith("http")) {
          recordsToUpdate.push({
            objectID: record.objectID,
            url: `${BASE_URL}${record.url}`
          });
        }
      });
    }
  });

  if (recordsToUpdate.length > 0) {
    await index.partialUpdateObjects(recordsToUpdate);
    console.log(`✅ Updated ${recordsToUpdate.length} URLs`);
  } else {
    console.log("🎉 No URLs needed fixing");
  }
}

fixUrls();
