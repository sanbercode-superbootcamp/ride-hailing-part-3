import { expect } from 'chai';
import * as nock from 'nock';
import { getMovementLogs } from './monitor';

const TRACKER_PORT = process.env["TRACKER_PORT"] || 3000;

describe('Monitoring Service', function() {
  it('should get movement logs from tracker service.', async function() {
    const riderId = 3;
    const logs = [{
      time: '1994-11-27',
      east: 2,
      west: 1,
      north: 5,
      south: 1
    }];

    nock(`http://localhost:${TRACKER_PORT}`)
      .get(`/movement/${riderId}`)
      .reply(200, {
        ok: true,
        logs
      });

    const resp = await getMovementLogs(riderId, null);
    expect(resp[0].time).to.be.equal(logs[0].time);
    expect(resp[0].east).to.be.equal(logs[0].east);
    expect(resp[0].west).to.be.equal(logs[0].west);
    expect(resp[0].north).to.be.equal(logs[0].north);
    expect(resp[0].south).to.be.equal(logs[0].south);
  });
});