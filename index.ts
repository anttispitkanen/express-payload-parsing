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
type Params = RT.Static<typeof QueryParamRuntype>;

/**
 * Some random function that requires the payload to be of the certain type.
 */
const payloadLogger = (payload: Payload) =>
  console.log(`Received payload: ${JSON.stringify(payload)}`);

/**
 * Some random function that requires the query parameters to be of the certain type.
 */
const paramsLogger = (params: Params) =>
  console.log(`Received params: ${JSON.stringify(params)}`);

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
    const params = QueryParamRuntype.check(req.query);

    // Whatever you would actually do with the payload...
    payloadLogger(payload);
    paramsLogger(params);

    res.json({ payload, params });
  } catch (err) {
    res.status(400).send({ error: err });
  }
});

/**
 * APPROACH 2:
 *
 * Parse the types in a dedicated middleware function. The req.body and req.query
 * are then guaranteed to be of the expected types inside the handler.
 */
type ParserMiddlewareCreator = <T, V extends ParsedQs>(
  bodyParserRuntype: RT.Runtype<T>,
  queryParserRuntype: RT.Runtype<V>,
) => express.RequestHandler<any, any, T, V>;

const typeParserMiddleware: ParserMiddlewareCreator =
  (bodyParserRuntype, queryParserRuntype) => (req, res, next) => {
    try {
      bodyParserRuntype.check(req.body);
      queryParserRuntype.check(req.query);
      next();
    } catch (err) {
      res.status(400).send({ error: err });
    }
  };

app.post(
  '/bar',
  typeParserMiddleware(PayloadRuntype, QueryParamRuntype),
  (req, res) => {
    // req.body is now guaranteed to be a Payload
    const payload = req.body;
    // req.query is now guaranteed to be a Params
    const params = req.query;

    // Whatever you would actually do with the payload and params...
    payloadLogger(payload);
    paramsLogger(params);

    res.json(payload);
  },
);

app.listen(8080);
