import algoliasearch from "algoliasearch";

/* =========================
   ENV
========================= */

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;

/* =========================
   SITE CONFIG
========================= */

const BASE_URL = "https://www.iads.org";
const INDEX_NAME = "content2";

/* =========================
   ALGOLIA
========================= */

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
const index = client.initIndex(INDEX_NAME);

/* =========================
   COLLECTION ROUTING
========================= */

const COLLECTIONS = {
  News: {
    type: "news",
    urlPrefix: "/member/news/"
  },
  "Articles & Reports": {
    type: "articlesreports",
    urlPrefix: "/member/articles-reports/"
  },
  "Books & Conferences": {
    type: "booksconferences",
    urlPrefix: "/member/books-conferences/"
  },
  "White Papers": {
    type: "whitepaper",
    urlPrefix: "/member/white-papers/"
  }
};

/* =========================
   HELPERS
========================= */

function toTimestamp(dateString) {
  return Math.floor(new Date(dateString).getTime() / 1000);
}

/* =========================
   HANDLER
========================= */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    const { collection, operation, record } = req.body;

    const config = COLLECTIONS[collection];
    if (!config) {
      return res.status(200).json({ ignored: "unknown collection" });
    }

    const {
      "Item ID": itemId,
      Title,
      "Body Content": body,
      Source,
      Date,
      Slug,
      Status
    } = record;

    /* ---- UNPUBLISHED / INACTIVE ---- */
    if (Status !== "Active") {
      await index.deleteObject(itemId);
      return res.status(200).json({ deleted: itemId });
    }

    /* ---- SAFETY CHECK ---- */
    if (!Date || !Slug) {
      return res.status(200).json({ skipped: "missing date or slug" });
    }

    /* ---- BUILD CANONICAL URL ---- */
    const fullUrl = `${BASE_URL}${config.urlPrefix}${Slug}`;

    const algoliaRecord = {
      objectID: itemId,
      title: Title,
      body: body || "",
      source: Source || null,
      content_type: config.type,
      date: Date,
      timestamp: toTimestamp(Date),

      // ✅ ALWAYS FULL URL
      url: fullUrl
    };

    await index.saveObject(algoliaRecord);

    return res.status(200).json({
      indexed: itemId,
      operation,
      url: fullUrl
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
