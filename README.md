# Type safe express payload parsing concept demonstration with runtypes

A concept demonstrating type safe HTTP body and query parsing using [express](https://expressjs.com/) and [runtypes](https://github.com/pelotom/runtypes).

## Starting

1. Install the dependencies

```bash
npm install
```

2. Start the server on http://localhost:8080

```bash
npm start
```

3. Make some requests with `curl` or the API client of your choice (test suite TODO)

```bash
# A completely valid request
curl -X POST -H "Content-Type: application/json" -d '{"email": "test@gmail.com"}' 'http://localhost:8080/bar?foo=bar'
# {"payload":{"email":"test@gmail.com"},"query":{"foo":"bar"}}

# The query param is there but the content is wrong
curl -X POST -H "Content-Type: application/json" -d '{"email": "test@gmail.com"}' 'http://localhost:8080/bar?foo=something'
# {"error":{"name":"ValidationError","code":"CONTENT_INCORRECT","details":{"foo":"Expected literal `bar`, but was `something`"}}}

# Wrong query param
curl -X POST -H "Content-Type: application/json" -d '{"email": "test@gmail.com"}' 'http://localhost:8080/bar?something=something'
# {"error":{"name":"ValidationError","code":"CONTENT_INCORRECT","details":{"foo":"Expected \"bar\", but was missing"}}}

# Email exists in body but isn't valid
curl -X POST -H "Content-Type: application/json" -d '{"email": "test@test.com"}' 'http://localhost:8080/bar?foo=bar'
# {"error":{"name":"ValidationError","code":"CONTENT_INCORRECT","details":{"email":"Failed constraint check for unknown"}}}

# Wrong key for the email in body
curl -X POST -H "Content-Type: application/json" -d '{"gmail": "test@gmail.com"}' 'http://localhost:8080/bar?foo=bar'
# {"error":{"name":"ValidationError","code":"CONTENT_INCORRECT","details":{"email":"Expected unknown, but was missing"}}}

# No body provided
curl -X POST -H "Content-Type: application/json" 'http://localhost:8080/bar?foo=bar'
# {"error":{"name":"ValidationError","code":"CONTENT_INCORRECT","details":{"email":"Expected unknown, but was missing"}}}
```

## How it works

**tl;dr:** see [index.ts](/index.ts).

By defining special express middleware functions for the type parsing, we can perform the input validation before actually getting into the route handler.

By writing the middleware functions like this (note that it's possible to write similar ones for header and path parameter parsing as well)

```typescript
type BodyTypeParserMiddlewareCreator = <T>(
  bodyParserRuntype: RT.Runtype<T>,
) => express.RequestHandler<any, any, T, any>;

const bodyTypeParserMiddleware: BodyTypeParserMiddlewareCreator =
  bodyParserRuntype => (req, res, next) => {
    try {
      bodyParserRuntype.check(req.body);
      next();
    } catch (err) {
      res.status(400).send({ error: err });
    }
  };

type QueryTypeParserMiddlewareCreator = <V extends ParsedQs>(
  queryParserRuntype: RT.Runtype<V>,
) => express.RequestHandler<any, any, any, V>;

const queryTypeParserMiddleware: QueryTypeParserMiddlewareCreator =
  queryParserRuntype => (req, res, next) => {
    try {
      queryParserRuntype.check(req.query);
      next();
    } catch (err) {
      res.status(400).send({ error: err });
    }
  };
```

we can then use them cleanly like this, as the inputs are guaranteed to be valid and properly typed when coming into the handler function. Note that the middleware order matters in that the first middleware that errors will decide the error that's returned to the caller.

```typescript
app.post(
  '/bar',
  bodyTypeParserMiddleware(PayloadRuntype),
  queryTypeParserMiddleware(QueryParamRuntype),
  (req, res) => {
    // req.body is now guaranteed to be a Payload
    const payload = req.body;
    // req.query is now guaranteed to be a QueryParams
    const query = req.query;

    // Whatever you would actually do with the payload and query...
    payloadLogger(payload);
    queryLogger(query);

    res.json({ payload, query });
  },
);
```
