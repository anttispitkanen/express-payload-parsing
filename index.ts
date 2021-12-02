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

// Let's require a string numeric path param, like a database ID
const PathParamRuntype = RT.Record({
  id: RT.Union(RT.Literal('1'), RT.Literal('2')),
});

// Static types for function signatures
type Payload = RT.Static<typeof PayloadRuntype>;
type QueryParams = RT.Static<typeof QueryParamRuntype>;
type PathParams = RT.Static<typeof PathParamRuntype>;

/**
 * Some random functions that require the parameters to be of certain types. The
 * compiler would let us know if we were passing anys or unknowns to these.
 */
const payloadLogger = (payload: Payload) =>
  console.log(`Received payload: ${JSON.stringify(payload)}`);

const queryLogger = (query: QueryParams) =>
  console.log(`Received query params: ${JSON.stringify(query)}`);

const paramsLogger = (params: PathParams) =>
  console.log(`Received path params: ${JSON.stringify(params)}`);

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

type PathParamsParserMiddlewareCreator = <U>(
  pathParamParserRuntype: RT.Runtype<U>,
) => express.RequestHandler<U, any, any, any>;

const pathParamsParserMiddleware: PathParamsParserMiddlewareCreator =
  pathParamsParserRuntype => (req, res, next) => {
    try {
      pathParamsParserRuntype.check(req.params);
      next();
    } catch (err) {
      res.status(400).send({ error: err });
    }
  };

app.post(
  '/bar/:id',
  bodyTypeParserMiddleware(PayloadRuntype),
  queryTypeParserMiddleware(QueryParamRuntype),
  pathParamsParserMiddleware(PathParamRuntype),
  (req, res) => {
    // req.body is now guaranteed to be a Payload
    const payload = req.body;
    // req.query is now guaranteed to be a QueryParams
    const query = req.query;
    // req.params is now guaranteed to be a PathParams
    const params = req.params;

    // Whatever you would actually do with the payload and query...
    payloadLogger(payload);
    queryLogger(query);
    paramsLogger(params);

    res.json({ payload, query, params });
  },
);

app.listen(8080);
