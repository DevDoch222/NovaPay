describe('fx conversion math', () => {
  const marginBps = 150;
  const usdNgnMid = 1600;
  const usdEurMid = 0.92;

  function usdPerUnit(currency: string) {
    switch (currency) {
      case 'USD':
        return 1;
      case 'NGN':
        return 1 / usdNgnMid;
      case 'EUR':
        return 1 / usdEurMid;
      default:
        throw new Error(currency);
    }
  }

  function midDestPerSource(source: string, dest: string) {
    return usdPerUnit(source) / usdPerUnit(dest);
  }

  function clientRate(mid: number) {
    return mid * (1 - marginBps / 10_000);
  }

  it('applies margin so customer gets less USD than mid', () => {
    const mid = midDestPerSource('NGN', 'USD');
    const client = clientRate(mid);
    expect(client).toBeLessThan(mid);
    const srcMajor = 160_000;
    const destMinor = Math.floor(srcMajor * client * 100);
    // ~$98.5 after 1.5% margin on $100 mid
    expect(destMinor).toBeGreaterThan(9800);
    expect(destMinor).toBeLessThan(10000);
  });

  it('triangulates USD↔EUR and NGN↔EUR through USD mids', () => {
    expect(midDestPerSource('USD', 'EUR')).toBeCloseTo(usdEurMid, 8);
    expect(midDestPerSource('EUR', 'USD')).toBeCloseTo(1 / usdEurMid, 8);
    expect(midDestPerSource('NGN', 'EUR')).toBeCloseTo(
      usdEurMid / usdNgnMid,
      10,
    );
    expect(midDestPerSource('EUR', 'NGN')).toBeCloseTo(
      usdNgnMid / usdEurMid,
      6,
    );
  });
});
