import express from 'express';
import { ParsedQs } from 'qs';
import * as RT from 'runtypes';

const app = express();
app.use(express.json());

/**
 * TYPES AND TYPE GUARDS
 *
 * Let's pretend we only allow Gmail addresses. This displays something a bit
 * more specific that the TS native type system cannot really represent.
 */
type GmailAddress = string;

const isEmail = (email: unknown): email is GmailAddress => {
  return typeof email === 'string' && email.endsWith('@gmail.com');
};

const PayloadRuntype = RT.Record({
  email: RT.Guard(isEmail),
});

// Let's require a query parameter "&foo=bar" just to show we can validate query
// parameters as well.
const QueryParamRuntype = RT.Record({
  foo: RT.Literal('bar'),
});

type Payload = RT.Static<typeof PayloadRuntype>;
type QueryParams = RT.Static<typeof QueryParamRuntype>;

/**
 * Some random function that requires the payload to be of the certain type.
 */
const payloadLogger = (payload: Payload) =>
  console.log(`Received payload: ${JSON.stringify(payload)}`);

/**
 * Some random function that requires the query parameters to be of the certain type.
 */
const queryLogger = (query: QueryParams) =>
  console.log(`Received params: ${JSON.stringify(query)}`);

/**
 * APPROACH 1:
 *
 * Parse the body and query types as the first thing inside the route handler.
 * This works fine but leaves the parsing to the route handler, meaning it can
 * be forgotten. Also it makes the route handler more verbose.
 */
app.post('/foo', (req, res) => {
  try {
    // Make sure the payload is of the correct type, runtypes throws if it's not.
    const payload = PayloadRuntype.check(req.body);
    // Make sure the query parameters are of the correct type, runtypes throws if they're not.
    const query = QueryParamRuntype.check(req.query);

    // Whatever you would actually do with the payload and query...
    payloadLogger(payload);
    queryLogger(query);

    res.json({ payload, query });
  } catch (err) {
    res.status(400).send({ error: err });
  }
});

/**
 * APPROACH 2:
 *
 * Parse the types in dedicated middleware functions. The req.body and req.query
 * are then guaranteed to be of the expected types inside the handler.
 */
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

app.listen(8080);
