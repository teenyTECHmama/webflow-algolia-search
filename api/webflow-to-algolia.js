import fetch from "node-fetch";
import algoliasearch from "algoliasearch";

/* =========================
   ENV
========================= */

const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;

/* =========================
   SITE CONFIG
========================= */

const BASE_URL = "https://www.iads.org";

/* =========================
   ALGOLIA
========================= */

const INDEX_NAME = "content2";
const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
const index = client.initIndex(INDEX_NAME);

/* =========================
   COLLECTION MAP
========================= */

const COLLECTIONS = {
  "6810f8ac48ac573ed368cc26": {
    type: "news",
    urlPrefix: "/member/news/",
    dateField: "date"
  },
  "6810f93700e7c73c9f48f52f": {
    type: "articlesreports",
    urlPrefix: "/member/articles-reports/",
    dateField: "date",
    exclusiveField: "is_this_an_iads_exclusive"
  },
  "6811137ec06846bb5c41e37b": {
    type: "booksconferences",
    urlPrefix: "/member/books-conferences/",
    dateField: "date"
  },
  "6811ed82712ca3755b871d5d": {
    type: "iadsmembernews",
    urlPrefix: "/member/iads-member-news/",
    dateField: "date"
  },
  "681b35f6db9abacfac4d0337": {
    type: "whitepaper",
    urlPrefix: "/member/white-papers/",
    dateField: "date"
  }
};

/* =========================
   HELPERS
========================= */

function toTimestamp(dateString) {
  return Math.floor(new Date(dateString).getTime() / 1000);
}

async function fetchItem(collectionId, itemId) {
  const res = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items/${itemId}`,
    {
      headers: {
        Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
        "accept-version": "2.0.0"
      }
    }
  );

  if (!res.ok) {
    throw new Error(`Webflow API error ${res.status}`);
  }

  return res.json();
}

/* =========================
   WEBHOOK HANDLER
========================= */

export default async function handler(req, res) {

  // 🔎 Simple GET test (for browser sanity)
  if (req.method === "GET") {
    return res.status(200).json({ ok: true });
  }

  // 🔐 Webflow sends POST
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { collectionId, itemId } = req.body;

  const config = COLLECTIONS[collectionId];
  if (!config) {
    return res.status(200).json({ ignored: true });
  }

  const item = await fetchItem(collectionId, itemId);

  // 🧹 Always trust item state, NOT trigger name
  if (item.isDraft || item.isArchived) {
    await index.deleteObject(item.id);
    return res.status(200).json({ deleted: item.id });
  }

  const rawDate = item.fieldData[config.dateField];
  if (!rawDate) {
    return res.status(200).json({ skipped: "missing date" });
  }

  const isExclusive = config.exclusiveField
    ? Boolean(item.fieldData[config.exclusiveField])
    : false;

  const record = {
    objectID: item.id,
    title: item.fieldData.name,
    body: item.fieldData.body || "",
    source: item.fieldData.source || null,
    content_type: config.type,
    exclusive: isExclusive,
    date: rawDate,
    timestamp: toTimestamp(rawDate),
    url: `${BASE_URL}${config.urlPrefix}${item.fieldData.slug}`
  };

  await index.saveObject(record);

  return res.status(200).json({ indexed: item.id });
}
