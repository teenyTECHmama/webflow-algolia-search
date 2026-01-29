import algoliasearch from "algoliasearch";
import fetch from "node-fetch";

/* =========================
   CONFIG
========================= */

const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;

if (!WEBFLOW_API_TOKEN || !ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
  throw new Error("Missing required environment variables");
}

/* =========================
   ALGOLIA CLIENTS
========================= */
const INDEX_NAME = "content2";
const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
const index = client.initIndex(INDEX_NAME);

/*
  Add new collections here — Replace IDs + dateField keys.
*/
const COLLECTIONS = [
  {
    id: "6810f8ac48ac573ed368cc26",
    type: "news",
    urlPrefix: "/member/news/",
    dateField: "date"
  },
  {
    id: "6810f93700e7c73c9f48f52f",
    type: "articlesreports",
    urlPrefix: "/member/articles-reports/",
    dateField: "date"
  },
  {
    id: "6811137ec06846bb5c41e37b",
    type: "booksconferences",
    urlPrefix: "/member/books-conferences/",
    dateField: "date"
  },
    {
    id: "6811ed82712ca3755b871d5d",
    type: "iadsmembernews",
    urlPrefix: "/member/iads-member-news/",
    dateField: "date"
  },
  {
    id: "681b35f6db9abacfac4d0337",
    type: "whitepaper",
    urlPrefix: "/member/white-papers/",
    dateField: "date"
  }
];



/* =========================
   HELPERS
========================= */

async function fetchCollectionItems(collectionId) {
  const allItems = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const res = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
          "accept-version": "2.0.0"
        }
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Webflow API error (${res.status}): ${text}`
      );
    }

    const data = await res.json();
    const items = data.items || [];

    allItems.push(...items);

    if (items.length < limit) {
      break; // no more pages
    }

    offset += limit;
  }

  return allItems;
}

function toTimestamp(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${dateString}`);
  }
  return Math.floor(date.getTime() / 1000);
}
/* =========================
   MAIN
========================= */


async function sync() {
  let records = [];

  for (const collection of COLLECTIONS) {
    const items = await fetchCollectionItems(collection.id);

  const mapped = items
  .filter(item => !item.isDraft && !item.isArchived)
  .map(item => {
    const rawDate = item.fieldData.date;

    if (!rawDate) {
      console.warn(
        `⚠️ Skipping item without date: ${item.id} (${item.fieldData.name})`
      );
      return null;
    }

    return {
      objectID: item.id,
      title: item.fieldData.name,
      body: item.fieldData.body || "",
      source: item.fieldData.source || null,
      content_type: collection.type,
      date: rawDate,
      timestamp: toTimestamp(rawDate),
      url: `${collection.urlPrefix}${item.fieldData.slug}`
    };
  })
  .filter(Boolean);

    records = records.concat(mapped);
  }

  await index.saveObjects(records);
  console.log(`✅ Indexed ${records.length} records`);
}

sync().catch(console.error);

