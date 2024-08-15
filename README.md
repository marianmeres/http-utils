# @marianmeres/http-utils

A few [sweet](https://en.wikipedia.org/wiki/Syntactic_sugar) `fetch` helpers.

## Example

```javascript
import { HTTP_ERROR, HTTP_STATUS, createHttpApi } from '@marianmeres/http-utils';

// create api helper
const api = createHttpApi(
    // optional base url
    'https://api.example.com',
    // optional lazy evaluated default fetch params (can be overridden per call)
    async () => ({
        token: await getApiTokenFromDb() // example
    })

// EXAMPLE: assuming `/resource` returns json {"some":"data"}
const r = await api.get('/resource');
assert(r.some === 'data');

// EXAMPLE: assuming `/foo` returns 404 header and json {"message":"hey"}
// by default always throws
try {
    const r = await api.get('/foo');
} catch (e) {
    // see HTTP_ERROR for more
    assert(e instanceof HTTP_ERROR.NotFound);
    assert(e.toString() === 'HttpNotFoundError: Not Found');
    assert(e.status === HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.CODE);
    assert(e.statusText === HTTP_STATUS.ERROR_CLIENT.NOT_FOUND.TEXT);
    assert(e.body.message === 'hey');
}

// EXAMPLE: assuming `/foo` returns 404 header and json {"message":"hey"}
// will not throw if we pass false flag
const r = await api.get('/foo', { assert: false });
assert(r.message === 'hey');

// EXAMPLE: assuming POST to `/resource` returns OK and json {"message":"created"}
// the provided token below will override the one from the `getApiTokenFromDb()` call above
const r = await api.post('/resource', { some: 'data' }, { token: 'my-api-token' });
assert(r.message === 'created');

// EXAMPLE: raw Response
const r = await api.get('/resource', { raw: true });
assert(r instanceof Response);
```

See [`HTTP_STATUS`](./src/status.ts) and [`HTTP_ERROR`](./src/error.ts) for more.
