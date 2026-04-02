import { TwitterApi } from "twitter-api-v2";
export class XClient {
    rw;
    botUserId = "";
    constructor() {
        const base = new TwitterApi({
            appKey: process.env.X_API_KEY,
            appSecret: process.env.X_API_SECRET,
            accessToken: process.env.X_ACCESS_TOKEN,
            accessSecret: process.env.X_ACCESS_SECRET,
        });
        this.rw = base.readWrite;
    }
    async getBotUserId() {
        if (this.botUserId)
            return this.botUserId;
        const me = await this.rw.v2.me();
        this.botUserId = me.data.id;
        return this.botUserId;
    }
    async getMentions(sinceId) {
        const handle = process.env.BOT_X_USERNAME ?? await this._getBotUsername();
        // recentSearch covers regular tweets AND public Community posts.
        // userMentionTimeline misses Community posts entirely.
        const result = await this.rw.v2.search(`@${handle} -is:retweet`, {
            ...(sinceId ? { since_id: sinceId } : {}),
            max_results: 10,
            expansions: ["referenced_tweets.id"],
            "tweet.fields": ["author_id", "text", "created_at", "referenced_tweets"],
        });
        const tweets = result.data?.data ?? [];
        const includes = result.data?.includes ?? {};
        const refMap = new Map((includes.tweets ?? []).map((t) => [t.id, t.text]));
        const botId = await this.getBotUserId();
        return tweets
            .filter(t => t.author_id !== botId) // never process own replies
            .map(t => {
            const refTexts = (t.referenced_tweets ?? [])
                .map((r) => refMap.get(r.id) ?? "")
                .filter(Boolean)
                .join(" ");
            return {
                id: t.id,
                authorId: t.author_id ?? "",
                mentionText: t.text, // mention only
                text: [t.text, refTexts].filter(Boolean).join(" "), // combined for CA scan
            };
        });
    }
    _cachedUsername = "";
    async _getBotUsername() {
        if (this._cachedUsername)
            return this._cachedUsername;
        const me = await this.rw.v2.me();
        this._cachedUsername = me.data.username;
        return this._cachedUsername;
    }
    /**
     * Post a thread of tweets as a reply.
     * imageUrl — if provided, attaches the token logo to the first tweet only.
     */
    async replyWithThread(replyToTweetId, tweets, imageUrl) {
        let parentId = replyToTweetId;
        let mediaId;
        if (imageUrl) {
            mediaId = await this._uploadImageFromUrl(imageUrl).catch(() => undefined);
        }
        for (let i = 0; i < tweets.length; i++) {
            const text = tweets[i];
            try {
                const payload = i === 0 && mediaId
                    ? { reply: { in_reply_to_tweet_id: parentId }, media: { media_ids: [mediaId] } }
                    : { reply: { in_reply_to_tweet_id: parentId } };
                const posted = await this.rw.v2.tweet(text, payload);
                parentId = posted.data.id;
                await sleep(1500);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes("403") || msg.includes("not authorized") || msg.includes("Community")) {
                    console.warn(`[bot] Skipped reply — Community post or permission denied (${msg.slice(0, 80)})`);
                    return;
                }
                throw err;
            }
        }
    }
    async _uploadImageFromUrl(url) {
        const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
        if (!res.ok)
            throw new Error(`Image fetch failed: ${res.status}`);
        const contentType = res.headers.get("content-type") ?? "image/png";
        const mimeType = contentType.split(";")[0].trim();
        const buffer = Buffer.from(await res.arrayBuffer());
        return await this.rw.v1.uploadMedia(buffer, { mimeType });
    }
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
