import json
import mimetypes
import os
import posixpath
import time
from email.utils import parsedate_to_datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock
from urllib import error, parse, request

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(ROOT_DIR, "dist")
PORT = int(os.environ.get("PORT", "8787"))

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
    "Referer": "https://journalism.thespread.news/",
}

CACHE = {}
CACHE_LOCK = Lock()
HOST_COOLDOWNS = {}
THIRD_PARTY_HOSTS = {
    "spread-api.onrender.com",
    "indexr-api.vercel.app",
}


def remember(key, ttl_seconds, loader, allow_stale=False, stale_ttl=30):
    now = time.time()
    with CACHE_LOCK:
        hit = CACHE.get(key)
    if hit and hit["expires_at"] > now:
        return hit["value"]

    try:
        value = loader()
    except Exception:
        if allow_stale and hit:
            with CACHE_LOCK:
                CACHE[key] = {
                    "expires_at": now + min(ttl_seconds, stale_ttl),
                    "value": hit["value"],
                }
            return hit["value"]
        raise

    with CACHE_LOCK:
        CACHE[key] = {"expires_at": now + ttl_seconds, "value": value}
    return value


def parse_retry_after(value):
    if not value:
        return None
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        pass

    try:
        return max(1, int(parsedate_to_datetime(value).timestamp() - time.time()))
    except Exception:
        return None


def get_host(url):
    return parse.urlparse(url).netloc


def set_host_cooldown(host, seconds):
    if seconds is None or seconds <= 0:
        return
    with CACHE_LOCK:
        HOST_COOLDOWNS[host] = max(HOST_COOLDOWNS.get(host, 0), time.time() + seconds)


def ensure_host_ready(url):
    host = get_host(url)
    with CACHE_LOCK:
        cooldown_until = HOST_COOLDOWNS.get(host, 0)
    remaining = int(cooldown_until - time.time())
    if remaining > 0:
        raise RuntimeError(f"{host} 暂时繁忙，请 {remaining} 秒后再试")
    return host


def fetch_json(url, method="GET", body=None, headers=None):
    encoded_body = None
    if body is not None:
        encoded_body = json.dumps(body).encode("utf-8")

    merged_headers = dict(DEFAULT_HEADERS)
    if headers:
        merged_headers.update(headers)

    host = ensure_host_ready(url)
    attempts = 2 if method == "GET" else 1

    for attempt in range(attempts):
        req = request.Request(url, data=encoded_body, method=method, headers=merged_headers)
        try:
            with request.urlopen(req, timeout=20) as response:
                return json.loads(response.read().decode("utf-8", errors="replace"))
        except error.HTTPError as exc:
            retry_after = parse_retry_after(exc.headers.get("Retry-After"))
            message = exc.read().decode("utf-8", errors="replace")[:180]

            if exc.code == 429:
                set_host_cooldown(host, retry_after or 30)
            elif host in THIRD_PARTY_HOSTS and exc.code in (500, 502, 503, 504):
                set_host_cooldown(host, 15)

            if method == "GET" and attempt + 1 < attempts and exc.code in (500, 502, 503, 504):
                time.sleep(0.6 * (attempt + 1))
                continue

            raise RuntimeError(f"{exc.code} {message}") from exc
        except Exception as exc:  # pragma: no cover
            if method == "GET" and attempt + 1 < attempts:
                time.sleep(0.6 * (attempt + 1))
                continue
            raise RuntimeError(str(exc)) from exc


def fetch_optional_json(url, method="GET", body=None, headers=None):
    try:
        return fetch_json(url, method=method, body=body, headers=headers)
    except Exception:
        return None


def to_number(value):
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    return num


def safe_json_array(value):
    if isinstance(value, list):
        return value
    if not isinstance(value, str):
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def extract_slug(raw):
    value = (raw or "").strip()
    if not value:
        return ""
    if "http" not in value:
        return value

    try:
        parsed = parse.urlparse(value)
        parts = [part for part in parsed.path.split("/") if part]
        return parts[-1] if parts else ""
    except Exception:
        return value


def map_search_market(market, extra_tags=None):
    tags = list(extra_tags or [])
    source_tags = market.get("tags") or market.get("tagLabels") or []
    for tag in source_tags:
        if tag and tag not in tags:
            tags.append(tag)

    return {
        "slug": market.get("slug"),
        "question": market.get("question"),
        "conditionId": market.get("conditionId"),
        "icon": market.get("icon") or market.get("image"),
        "active": market.get("active"),
        "endDate": market.get("endDate") or market.get("endDateIso"),
        "tags": tags[:6],
    }


def liquidity_band(spread):
    if spread is None:
        return "未知"
    if spread <= 0.02:
        return "紧密"
    if spread <= 0.05:
        return "可交易"
    return "偏薄"


def downsample(points, size=48):
    if len(points) <= size:
        return points

    stride = (len(points) - 1) / (size - 1)
    return [points[round(index * stride)] for index in range(size)]


def normalize_news_items(detail):
    articles = [
        {
            "signature": f"article:{item.get('id')}",
            "category": "文章",
            "title": item.get("title"),
            "source": item.get("source"),
            "correlation": item.get("correlation"),
            "url": item.get("link"),
            "publishedAt": item.get("published_at"),
            "score": 85,
        }
        for item in detail.get("articles", [])
    ]
    substacks = [
        {
            "signature": f"substack:{item.get('id')}",
            "category": "Substack",
            "title": item.get("title"),
            "source": item.get("author") or item.get("source"),
            "correlation": item.get("correlation"),
            "url": item.get("link"),
            "publishedAt": item.get("published_at"),
            "score": 82,
        }
        for item in detail.get("substacks", [])
    ]
    tweets = [
        {
            "signature": f"tweet:{item.get('id') or item.get('tweet_id')}",
            "category": "推文",
            "title": item.get("text"),
            "source": item.get("author_name") or item.get("author_handle"),
            "correlation": item.get("correlation"),
            "url": item.get("link"),
            "publishedAt": item.get("created_at"),
            "score": 35
            + min((to_number(item.get("likes")) or 0) / 30, 25)
            + min((to_number(item.get("retweets")) or 0) / 10, 20)
            + (0 if item.get("correlation") == "related" else 10),
        }
        for item in detail.get("tweets", [])
    ]

    merged = [*articles, *substacks, *tweets]
    merged = [item for item in merged if item.get("title") and item.get("publishedAt")]
    merged.sort(key=lambda item: item["publishedAt"], reverse=True)
    return merged


def build_probability_heatmap(history, start_ts, end_ts, buckets=24):
    if not history:
        return []

    bucket_seconds = max(1, int((end_ts - start_ts) / buckets))
    grouped = [[] for _ in range(buckets)]

    for point in history:
        timestamp = int(point.get("t") or 0)
        value = (to_number(point.get("p")) or 0) * 100
        index = min(buckets - 1, max(0, int((timestamp - start_ts) / bucket_seconds)))
        grouped[index].append(value)

    result = []
    for index, values in enumerate(grouped):
        if values:
            avg = sum(values) / len(values)
            change = values[-1] - values[0]
        else:
            avg = 0
            change = 0
        result.append(
            {
                "slot": index,
                "value": avg,
                "change": change,
            }
        )
    return result


def build_tweet_buckets(tweets, buckets=12):
    timestamps = []
    for tweet in tweets:
        timestamp = parse_date_ms(tweet.get("created_at", "")) / 1000
        if timestamp > 0:
            timestamps.append(timestamp)

    if not timestamps:
        return []

    start_ts = min(timestamps)
    end_ts = max(timestamps)
    bucket_seconds = max(1, int((end_ts - start_ts + 1) / buckets))
    grouped = [0 for _ in range(buckets)]

    for timestamp in timestamps:
        index = min(buckets - 1, max(0, int((timestamp - start_ts) / bucket_seconds)))
        grouped[index] += 1

    return [
        {
            "slot": index,
            "count": count,
            "startAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(start_ts + index * bucket_seconds)),
            "endAt": time.strftime(
                "%Y-%m-%dT%H:%M:%SZ",
                time.gmtime(min(end_ts, start_ts + ((index + 1) * bucket_seconds) - 1)),
            ),
        }
        for index, count in enumerate(grouped)
    ]


def summarize_holders(groups, tracked_index, tracked_token_id, fetch_limit=500):
    selected_group = None
    for group in groups:
        if str(group.get("token")) == str(tracked_token_id):
            selected_group = group
            break
    if not selected_group:
        for group in groups:
            holders = group.get("holders", [])
            if holders and holders[0].get("outcomeIndex") == tracked_index:
                selected_group = group
                break
    if not selected_group and groups:
        selected_group = groups[0]

    all_holders = (selected_group or {}).get("holders", [])
    holders = all_holders[:5]
    total_tracked = sum(to_number(holder.get("amount")) or 0 for holder in all_holders)
    top_holder = holders[0] if holders else None
    top_one_share = ((to_number(top_holder.get("amount")) or 0) / total_tracked) if top_holder and total_tracked else 0
    top_three_share = (
        sum(to_number(holder.get("amount")) or 0 for holder in holders[:3]) / total_tracked if total_tracked else 0
    )
    is_complete = len(all_holders) < fetch_limit

    return {
        "holders": [
            {
                "name": holder.get("name"),
                "amount": to_number(holder.get("amount")) or 0,
                "proxyWallet": holder.get("proxyWallet"),
                "outcomeIndex": holder.get("outcomeIndex"),
            }
            for holder in holders
        ],
        "topHolderName": top_holder.get("name") if top_holder else None,
        "topHolderAmount": to_number(top_holder.get("amount")) or 0 if top_holder else 0,
        "holderCount": len(all_holders),
        "totalTrackedAmount": total_tracked,
        "isComplete": is_complete,
        "topOneShare": top_one_share,
        "topThreeShare": top_three_share,
        "isConcentrated": top_one_share >= 0.45 or top_three_share >= 0.8,
    }


def aggregate_market(slug, outcome_index=None):
    gamma_markets = remember(
        f"upstream:gamma:markets:{slug}",
        60,
        lambda: fetch_json(f"https://gamma-api.polymarket.com/markets?slug={parse.quote(slug)}"),
        allow_stale=True,
    )
    market = gamma_markets[0] if isinstance(gamma_markets, list) and gamma_markets else None
    if not market:
        raise RuntimeError("没有找到对应市场")

    outcomes = safe_json_array(market.get("outcomes"))
    prices = safe_json_array(market.get("outcomePrices"))
    token_ids = safe_json_array(market.get("clobTokenIds"))
    outcome_count = max(len(outcomes), len(prices), len(token_ids), 1)
    if isinstance(outcome_index, int) and 0 <= outcome_index < outcome_count:
        tracked_index = outcome_index
    elif prices:
        tracked_index = max(range(len(prices)), key=lambda index: to_number(prices[index]) or 0)
    else:
        tracked_index = 0
    label = outcomes[tracked_index] if outcomes else "Outcome 1"
    probability = to_number((prices[tracked_index] if tracked_index < len(prices) else prices[0] if prices else 0)) or 0
    token_id = token_ids[tracked_index] if tracked_index < len(token_ids) else (token_ids[0] if token_ids else "")
    condition_id = market.get("conditionId")
    end_ts = int(time.time() // 300 * 300)
    start_ts = end_ts - 24 * 60 * 60

    history_payload = remember(
        f"upstream:clob:history:{token_id}:{end_ts}",
        300,
        lambda: fetch_optional_json(
            "https://clob.polymarket.com/prices-history?"
            + parse.urlencode(
                {
                    "market": token_id,
                    "interval": "1d",
                    "fidelity": 1,
                    "startTs": start_ts,
                    "endTs": end_ts,
                }
            )
        ),
        allow_stale=True,
    )
    spread_payload = remember(
        f"upstream:clob:spread:{token_id}",
        60,
        lambda: fetch_optional_json(
            f"https://clob.polymarket.com/spread?token_id={parse.quote(str(token_id))}"
        ),
        allow_stale=True,
    )
    holders_payload = remember(
        f"upstream:data:holders:{condition_id}",
        180,
        lambda: fetch_optional_json(
            f"https://data-api.polymarket.com/holders?market={parse.quote(str(condition_id))}&limit=500"
        ),
        allow_stale=True,
    )
    spread_lookup = remember(
        f"upstream:news:lookup:{condition_id}",
        900,
        lambda: fetch_optional_json(
            f"https://spread-api.onrender.com/api/markets/by-condition/{parse.quote(str(condition_id))}"
        ),
        allow_stale=True,
    )

    history = history_payload.get("history", []) if isinstance(history_payload, dict) else []
    history_points = downsample(
        [{"t": point.get("t"), "p": (to_number(point.get("p")) or 0) * 100} for point in history]
    )
    base_probability = (to_number(history[0].get("p")) or probability) if history else probability
    probability_change = (probability - base_probability) * 100
    spread_value = to_number((spread_payload or {}).get("spread")) if isinstance(spread_payload, dict) else None
    if spread_value is None:
        spread_value = to_number(market.get("spread"))

    news_detail = None
    if isinstance(spread_lookup, dict) and spread_lookup.get("id") is not None:
        news_detail = remember(
            f"upstream:news:detail:{spread_lookup.get('id')}",
            180,
            lambda: fetch_optional_json(
                f"https://spread-api.onrender.com/api/markets/{spread_lookup.get('id')}"
            ),
            allow_stale=True,
        )

    news_items = normalize_news_items(news_detail or {})
    now_ms = time.time() * 1000
    news_count_24h = sum(
        1
        for item in news_items
        if item.get("publishedAt")
        and now_ms - parse_date_ms(item["publishedAt"]) <= 24 * 60 * 60 * 1000
    )
    important_news = [item for item in news_items if item.get("score", 0) >= 70]
    first_event = market.get("events", [{}])[0] if market.get("events") else {}
    heatmap_24h = build_probability_heatmap(history, start_ts, end_ts)
    tweets = (news_detail or {}).get("tweets", [])
    tweet_buckets_all = build_tweet_buckets(tweets)
    event_detail = None
    event_slug = first_event.get("slug")
    if event_slug:
        event_payload = remember(
            f"upstream:gamma:event:{event_slug}",
            900,
            lambda: fetch_optional_json(
                f"https://gamma-api.polymarket.com/events?slug={parse.quote(str(event_slug))}"
            ),
            allow_stale=True,
        )
        if isinstance(event_payload, list) and event_payload:
            event_detail = event_payload[0]

    return {
        "slug": market.get("slug"),
        "question": market.get("question"),
        "image": market.get("image") or market.get("icon"),
        "conditionId": condition_id,
        "marketUrl": f"https://polymarket.com/market/{market.get('slug')}",
        "eventTitle": first_event.get("title"),
        "eventSlug": event_slug,
        "eventMarketCount": (
            len(event_detail.get("markets", []))
            if isinstance((event_detail or {}).get("markets"), list)
            else len(first_event.get("markets", [])) if isinstance(first_event.get("markets"), list) else None
        ),
        "currentOutcomeLabel": label,
        "selectedOutcomeIndex": tracked_index,
        "currentProbability": probability * 100,
        "probabilityChange24h": probability_change,
        "probabilityDirection": "up" if probability_change >= 0 else "down",
        "volumeTotal": to_number(market.get("volumeNum")) or 0,
        "volume24h": to_number(market.get("volume24hr")),
        "volume1w": to_number(market.get("volume1wk")),
        "spread": spread_value * 100 if spread_value is not None else None,
        "liquidityBand": liquidity_band(spread_value),
        "outcomes": [
            {
                "label": str(outcome),
                "probability": (to_number(prices[index]) or 0) * 100,
            }
            for index, outcome in enumerate(outcomes[:3])
        ],
        "history24h": history_points,
        "heatmap24h": heatmap_24h,
        "tweetBucketsAll": tweet_buckets_all,
        "tweetCount": len(tweets),
        "newsCount": len(news_items),
        "newsCount24h": news_count_24h,
        "newsCoverage": bool(news_detail),
        "recentImportantNews": important_news[:6],
        "newsFeed": news_items,
        "recentNewsKeys": [item.get("signature") for item in news_items[:40]],
        "holders": summarize_holders(
            holders_payload if isinstance(holders_payload, list) else [],
            tracked_index,
            token_id,
            fetch_limit=500,
        ),
        "refreshedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def parse_date_ms(value):
    try:
        from datetime import datetime

        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000
    except Exception:
        return 0


class Handler(BaseHTTPRequestHandler):
    server_version = "SpreadWatchCN/0.1"

    def log_message(self, format, *args):
        return

    def send_json(self, data, status=200):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def serve_file(self, filepath):
        if not os.path.isfile(filepath):
            return False

        content_type = mimetypes.guess_type(filepath)[0] or "application/octet-stream"
        with open(filepath, "rb") as file:
            payload = file.read()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
        return True

    def handle_search(self, query_string):
        params = parse.parse_qs(query_string)
        raw_query = (params.get("query") or [""])[0].strip()
        if not raw_query:
            self.send_json({"error": "query 不能为空"}, 400)
            return

        def loader():
            slug = extract_slug(raw_query)
            looks_like_slug = "-" in slug and " " not in raw_query

            if looks_like_slug:
                exact = fetch_optional_json(
                    f"https://gamma-api.polymarket.com/markets?slug={parse.quote(slug)}"
                )
                if isinstance(exact, list) and exact:
                    market = exact[0]
                    return [map_search_market(market)]

                event_exact = fetch_optional_json(
                    f"https://gamma-api.polymarket.com/events?slug={parse.quote(slug)}"
                )
                if isinstance(event_exact, list) and event_exact:
                    event = event_exact[0]
                    event_title = event.get("title") or "事件市场"
                    return [
                        map_search_market(
                            market,
                            extra_tags=[event_title, "事件"]
                        )
                        for market in (event.get("markets") or [])[:24]
                        if market.get("slug") and market.get("question")
                    ]

            response = fetch_json(
                "https://indexr-api.vercel.app/api/markets/search",
                method="POST",
                body={"keywords": [raw_query]},
                headers={"Content-Type": "application/json"},
            )
            return [
                map_search_market(market)
                for market in (response.get("data") or [])[:12]
            ]

        try:
            results = remember(f"search:{raw_query}", 90, loader, allow_stale=True)
            self.send_json({"results": results})
        except Exception as exc:
            self.send_json({"error": str(exc)}, 502)

    def handle_market(self, query_string):
        params = parse.parse_qs(query_string)
        slug = extract_slug((params.get("slug") or [""])[0])
        outcome_index_raw = (params.get("outcomeIndex") or [""])[0].strip()
        if not slug:
            self.send_json({"error": "slug 不能为空"}, 400)
            return

        try:
            outcome_index = int(outcome_index_raw) if outcome_index_raw != "" else None
        except ValueError:
            outcome_index = None

        try:
            cache_key = f"market:{slug}:{outcome_index if outcome_index is not None else 'auto'}"
            data = remember(cache_key, 120, lambda: aggregate_market(slug, outcome_index), allow_stale=True)
            self.send_json(data)
        except Exception as exc:
            self.send_json({"error": str(exc)}, 502)

    def serve_spa(self, raw_path):
        if not os.path.isdir(DIST_DIR):
            payload = "开发模式中。请运行 npm run dev".encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        clean_path = posixpath.normpath(parse.urlparse(raw_path).path)
        relative_path = clean_path.lstrip("/") or "index.html"
        candidate = os.path.abspath(os.path.join(DIST_DIR, relative_path))
        dist_abs = os.path.abspath(DIST_DIR)

        if not candidate.startswith(dist_abs):
            self.send_error(403)
            return

        if not self.serve_file(candidate):
            self.serve_file(os.path.join(DIST_DIR, "index.html"))

    def do_GET(self):
        parsed = parse.urlparse(self.path)
        if parsed.path == "/api/search":
            self.handle_search(parsed.query)
            return
        if parsed.path == "/api/market":
            self.handle_market(parsed.query)
            return
        if parsed.path.startswith("/api/"):
            self.send_json({"error": "Not found"}, 404)
            return
        self.serve_spa(self.path)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Spread Watch CN server running on http://127.0.0.1:{PORT}")
    server.serve_forever()
