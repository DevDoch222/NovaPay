/**
 * Pure balance math covered without DB — ledger integrity helper.
 */
describe('ledger balance math', () => {
  function apply(
    balance: bigint,
    direction: 'debit' | 'credit',
    amount: bigint,
  ) {
    return direction === 'credit' ? balance + amount : balance - amount;
  }

  function isBalanced(
    legs: { direction: 'debit' | 'credit'; amount: bigint }[],
  ) {
    let debit = 0n;
    let credit = 0n;
    for (const leg of legs) {
      if (leg.direction === 'debit') debit += leg.amount;
      else credit += leg.amount;
    }
    return debit === credit;
  }

  it('credits increase and debits decrease user balance', () => {
    let bal = 0n;
    bal = apply(bal, 'credit', 500_000n);
    expect(bal).toBe(500_000n);
    bal = apply(bal, 'debit', 100_000n);
    expect(bal).toBe(400_000n);
  });

  it('requires balanced debit/credit legs', () => {
    expect(
      isBalanced([
        { direction: 'debit', amount: 100n },
        { direction: 'credit', amount: 100n },
      ]),
    ).toBe(true);
    expect(
      isBalanced([
        { direction: 'debit', amount: 100n },
        { direction: 'credit', amount: 90n },
      ]),
    ).toBe(false);
  });
});
