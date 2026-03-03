const http = require('http');

const request = (method, path, body, extraHeaders = {}) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders)
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: {} });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

describe('Bonus System Full Integration Tests', () => {
  const aliceId = '11111111-1111-1111-1111-111111111111';
  const bobId   = '22222222-2222-2222-2222-222222222222';

  test('Race Condition: Concurrent requests', async () => {
    const path = '/users/' + aliceId + '/spend';
    const ridBase = 'race-' + Date.now();

    const promises = [1, 2, 3, 4, 5].map(i =>
        request('POST', path, { amount: 200, requestId: ridBase + '-' + i })
    );

    const responses = await Promise.all(promises);
    const successes = responses.filter(r => r.status === 200).length;

    expect(successes).toBeLessThanOrEqual(3);
  });

  test('Idempotency and 409 Conflict', async () => {
    const rid = 'idemp-' + Date.now();
    const path = '/users/' + bobId + '/spend';
    const payload = { amount: 10, requestId: rid };

    const res1 = await request('POST', path, payload);
    const res2 = await request('POST', path, payload);

    expect(res1.status).toBe(200);
    expect(res1.data.duplicated).toBe(false);

    expect(res2.status).toBe(200);
    expect(res2.data.duplicated).toBe(true);

    const res3 = await request('POST', path, { amount: 99, requestId: rid });
    expect(res3.status).toBe(409);
  });

  test('Queue: expire-accruals endpoint', async () => {
    const res = await request('POST', '/jobs/expire-accruals');
    expect(res.status).toBe(200);
    expect(res.data.queued).toBe(true);
  });
});
