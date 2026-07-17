const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");

const albumArtHandler = require("../api/_lib/routes/album-art");
const albumImageHandler = require("../api/_lib/routes/album-image");

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function createResponse() {
  return {
    body: null,
    headers: new Map(),
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), String(value));
    },
    json(payload) {
      this.body = payload;
    },
    send(payload) {
      this.body = payload;
    },
  };
}

test("앨범 아트 검색 API는 iTunes 결과의 이미지 URL을 반환한다", async () => {
  let requestedUrl = "";

  global.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({
      results: [
        {
          trackName: "Blue Hour",
          artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/example/100x100bb.jpg",
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const response = createResponse();

  await albumArtHandler({ method: "GET", query: { title: "Blue Hour" } }, response);

  assert.equal(response.statusCode, 200);
  assert.match(requestedUrl, /^https:\/\/itunes\.apple\.com\/search\?/);
  assert.equal(
    response.body.artworkUrl,
    "https://is1-ssl.mzstatic.com/image/thumb/Music/example/600x600bb.jpg",
  );
});

test("앨범 이미지 프록시는 허용된 Apple Music 이미지만 중계한다", async () => {
  const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const artworkUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music/example/600x600bb.jpg";

  global.fetch = async (url) => {
    assert.equal(String(url), artworkUrl);
    return new Response(imageBytes, {
      status: 200,
      headers: { "Content-Type": "image/jpeg" },
    });
  };

  const response = createResponse();

  await albumImageHandler({ method: "GET", query: { url: artworkUrl } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(response.body, imageBytes);
});

test("앨범 이미지 프록시는 허용되지 않은 호스트를 차단한다", async () => {
  global.fetch = async () => {
    throw new Error("invalid host must not be fetched");
  };
  const response = createResponse();

  await albumImageHandler({
    method: "GET",
    query: { url: "https://example.com/image/cover.jpg" },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "invalid_artwork_url");
});
